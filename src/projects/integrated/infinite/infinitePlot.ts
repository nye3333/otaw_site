import * as dat from "dat.gui";
import ForceGraph3D from "3d-force-graph";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Vector2 } from "three";

import { FreeGroup } from "../shared/FreeGroup";

type LinkRec = { source: number; target: number; group: number; depth: number };

function sphereDirectionsForLetters(n: number): { x: number; y: number; z: number }[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 1, y: 0, z: 0 }];
  const out: { x: number; y: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }
  return out;
}

function clearGuiFolder(folder: dat.GUI): void {
  const f = folder as unknown as { __controllers: Array<{ remove: () => void }> };
  while (f.__controllers.length > 0) {
    f.__controllers[0]!.remove();
  }
}

/** Mount infinite free-group Cayley ball plotter inside `root` (no recording UI). */
export function mountInfinitePlotter(root: HTMLElement): void {
  root.innerHTML = `
<div class="cayley-infinite-layout">
  <div class="cayley-infinite-sidebar">
    <div class="cayley-infinite-groups-header">Infinite groups</div>
    <div class="cayley-infinite-groups-list">
      <div class="cayley-group-listing infinite-group-entry" data-ngens="2">
        <p class="cayley-group-listing-name">F<sub>2</sub></p>
        <p class="cayley-group-listing-desc">Free group on 2 generators (4-valent tree)</p>
      </div>
      <div class="cayley-group-listing infinite-group-entry" data-ngens="3">
        <p class="cayley-group-listing-name">F<sub>3</sub></p>
        <p class="cayley-group-listing-desc">Free group on 3 generators (6-valent tree)</p>
      </div>
    </div>
    <div class="cayley-infinite-controls">
      <label class="cayley-depth-label">Depth: <span data-role="depth-value">5</span></label>
      <input type="range" data-role="depth-slider" min="1" max="7" value="5" />
    </div>
  </div>
  <div class="cayley-infinite-plot" data-role="plot">
    <div data-role="plot-invisible"></div>
  </div>
</div>`;

  const plotHost = root.querySelector<HTMLElement>('[data-role="plot"]');
  const plotInv = root.querySelector<HTMLElement>('[data-role="plot-invisible"]');
  const depthSlider = root.querySelector<HTMLInputElement>('[data-role="depth-slider"]');
  const depthValue = root.querySelector<HTMLElement>('[data-role="depth-value"]');

  if (!plotHost || !plotInv || !depthSlider || !depthValue) {
    throw new Error("Infinite plotter: missing DOM hooks.");
  }

  const UIPARAMS: Record<string, number | boolean> = {};
  let activeFree: number | null = null;

  const bloomPass = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.1, 0.1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plt: any = ForceGraph3D()(plotInv)
    .width(plotHost.clientWidth)
    .height(plotHost.clientHeight)
    .linkAutoColorBy((d: LinkRec) => d.group)
    .linkWidth(2)
    .linkOpacity(1)
    .nodeColor(() => "rgb(255,255,255)")
    .nodeOpacity(1)
    .d3AlphaDecay(0.005);

  plt.scene();
  plt.postProcessingComposer().addPass(bloomPass);

  const ro = new ResizeObserver(() => {
    plt.width(plotHost.clientWidth).height(plotHost.clientHeight);
  });
  ro.observe(plotHost);

  const linkForceCtx = plt.d3Force("link");
  if (!linkForceCtx || typeof linkForceCtx.distance !== "function") {
    throw new Error("Infinite plotter: link force unavailable.");
  }

  const gui = new dat.GUI({ autoPlace: false });
  plotHost.appendChild(gui.domElement);
  gui.domElement.classList.add("cayley-infinite-gui");
  const linkVis = gui.addFolder("linkVisibility");
  linkVis.close();
  const linkArrows = gui.addFolder("linkArrows");
  linkArrows.close();
  gui.close();

  function highlightActiveFree(): void {
    root.querySelectorAll(".infinite-group-entry").forEach((c) => {
      const sel = "cayley-group-listing-selected";
      if (activeFree !== null && parseInt((c as HTMLElement).dataset.ngens ?? "0", 10) === activeFree) {
        c.classList.add(sel);
      } else {
        c.classList.remove(sel);
      }
    });
  }

  function plotFree(ngens: number, isDepthChange: boolean): void {
    const preserve = isDepthChange && activeFree === ngens;

    activeFree = ngens;
    const depth = parseInt(depthSlider.value, 10);
    const G = new FreeGroup(ngens, depth);
    const cayley = G.cayley;

    const BASE_DIST = 40;
    const DECAY = 0.8;

    const posMap: Record<
      number,
      { x: number; y: number; z: number; vx: number; vy: number; vz: number }
    > = {};
    if (preserve) {
      const cur = plt.graphData() as {
        nodes: Array<{ id: number; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number }>;
      };
      const damp = 0.22;
      cur.nodes.forEach((n) => {
        posMap[n.id] = {
          x: n.x ?? 0,
          y: n.y ?? 0,
          z: n.z ?? 0,
          vx: (n.vx ?? 0) * damp,
          vy: (n.vy ?? 0) * damp,
          vz: (n.vz ?? 0) * damp,
        };
      });
    }

    const nodes = cayley.map((_, idx) => {
      const node: { id: number; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number } = {
        id: idx,
      };
      const pm = posMap[idx];
      if (pm) Object.assign(node, pm);
      return node;
    });

    const flatArr: LinkRec[] = cayley.flatMap((n, idx) =>
      n[1].map((m, jdx) => ({
        source: idx,
        target: m,
        group: jdx,
        depth: n[0].depth,
      })),
    );

    if (preserve) {
      const nLetters = G.ngen / 2;
      const baseDirs = sphereDirectionsForLetters(nLetters);
      const genDirs: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < G.ngen; i++) {
        const letter = G.gens[i]!.word[0]!;
        const idxLetter = Math.abs(letter) - 1;
        const sgn = letter > 0 ? 1 : -1;
        const b = baseDirs[idxLetter]!;
        genDirs.push({ x: sgn * b.x, y: sgn * b.y, z: sgn * b.z });
      }
      flatArr.forEach((link) => {
        const src = posMap[link.source];
        if (src && posMap[link.target] === undefined) {
          const node = nodes[link.target]!;
          const len = BASE_DIST * Math.pow(DECAY, link.depth);
          const d = genDirs[link.group]!;
          node.x = src.x + d.x * len;
          node.y = src.y + d.y * len;
          node.z = src.z + d.z * len;
          node.vx = 0;
          node.vy = 0;
          node.vz = 0;
        }
      });
    }

    linkForceCtx.distance((d: LinkRec) => BASE_DIST * Math.pow(DECAY, d.depth));

    plt.linkDirectionalArrowLength(15).graphData({ nodes, links: flatArr });

    if (preserve) {
      plt.d3AlphaDecay(0.022).d3VelocityDecay(0.58);
    } else {
      plt.d3AlphaDecay(0.005).d3VelocityDecay(0.4);
    }

    if (!isDepthChange) {
      clearGuiFolder(linkVis);
      clearGuiFolder(linkArrows);

      new Array(G.ngen).fill(true).forEach((_, idx) => {
        UIPARAMS[`linkVisibility #${idx}`] = true;
        UIPARAMS[`linkArrows #${idx}`] = 0;
      });
      UIPARAMS.arrowPos = 0.5;

      new Array(G.ngen).fill(1).forEach((_, idx) => {
        linkVis
          .add(UIPARAMS, `linkVisibility #${idx}`, true)
          .onChange(() =>
            plt.linkVisibility((d: LinkRec) => UIPARAMS[`linkVisibility #${d.group}`] as boolean),
          );

        linkArrows
          .add(UIPARAMS, `linkArrows #${idx}`, 0, 30, 0.01)
          .onChange(() =>
            plt.linkDirectionalArrowLength((d: LinkRec) => UIPARAMS[`linkArrows #${d.group}`] as number),
          )
          .setValue(15);
      });
      linkArrows.add(UIPARAMS, "arrowPos", 0, 1, 0.01).onChange(() =>
        plt.linkDirectionalArrowRelPos(UIPARAMS.arrowPos as number),
      );

      highlightActiveFree();
    }
  }

  root.querySelectorAll(".infinite-group-entry").forEach((entry) => {
    entry.addEventListener("click", () => {
      const n = parseInt((entry as HTMLElement).dataset.ngens ?? "0", 10);
      plotFree(n, false);
    });
  });

  depthSlider.addEventListener("input", () => {
    depthValue.textContent = depthSlider.value;
    if (activeFree !== null) {
      plotFree(activeFree, true);
    }
  });

  plotFree(2, false);
}
