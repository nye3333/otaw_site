import type {
  F2Layout,
  F2TreeBuild,
  OverlayEdge,
  OverlayPolyline,
  Vec2,
  WhiteheadPair,
} from "./f2AxisOverlay";
import {
  F2_DEFAULT_POWER_K,
  F2_DEFAULT_TREE_DEPTH,
  F2_MAX_POWER_K,
  F2_MAX_TREE_DEPTH,
  buildF2Tree,
  computeAxisOverlay,
  formatWordLetters,
  generatorLabel,
  layoutF2Polar,
  overlayCosetStrokeStyle,
  parseF2Word,
  reduceWord,
} from "./f2AxisOverlay";

export type F2SectionElements = {
  canvas: HTMLCanvasElement;
  wordInput: HTMLInputElement;
  depthSlider: HTMLInputElement;
  depthValue: HTMLElement;
  powerSlider: HTMLInputElement | undefined;
  powerValue: HTMLElement | undefined;
  warningEl: HTMLElement;
  whiteheadSvg: SVGSVGElement;
  whiteheadPanel: HTMLElement;
  whiteheadCaption: HTMLElement;
  spliceToggle: HTMLInputElement;
  spliceSvg: SVGSVGElement;
  splicePanel: HTMLElement;
  spliceCaption: HTMLElement;
};

export type F2UiState = {
  build: F2TreeBuild | null;
  layout: F2Layout | null;
  overlayEdges: OverlayEdge[];
  overlayPolylines: OverlayPolyline[];
  localWhiteheadPairs: WhiteheadPair[];
};

let cacheDepth = -1;
let cacheBuild: F2TreeBuild | null = null;

function getBuild(depth: number): F2TreeBuild {
  if (cacheDepth === depth && cacheBuild !== null) return cacheBuild;
  cacheBuild = buildF2Tree(depth);
  cacheDepth = depth;
  return cacheBuild;
}

export function createF2UiState(): F2UiState {
  return {
    build: null,
    layout: null,
    overlayEdges: [],
    overlayPolylines: [],
    localWhiteheadPairs: [],
  };
}

export function redrawF2Canvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pad: number,
  state: F2UiState,
  panX: number,
  panY: number,
  scale: number,
  selectedVertex: number | null,
  selectedPolylineIndex: number | null,
  statsLine?: string,
): void {
  ctx.fillStyle = "rgb(3, 2, 56)";
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2 + panX;
  const cy = height / 2 + panY;
  const R = Math.min(width, height) / 2 - pad;

  const toScreen = (p: Vec2): Vec2 => ({
    x: cx + p.x * R * scale,
    y: cy + p.y * R * scale,
  });

  const build = state.build;
  const layout = state.layout;
  if (!build || !layout) return;

  const { graph } = build;
  const { pos } = layout;

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < graph.length; i++) {
    const a = pos[i]!;
    const pa = toScreen(a);
    for (const j of graph[i]![1]) {
      if (j < i) continue;
      const b = pos[j]!;
      const pb = toScreen(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const polys = state.overlayPolylines;
  for (let pi = 0; pi < polys.length; pi++) {
    if (pi === selectedPolylineIndex) continue;
    const { rep, verts } = polys[pi]!;
    if (verts.length === 1) {
      const p = toScreen(pos[verts[0]!]!);
      ctx.fillStyle = overlayCosetStrokeStyle(rep);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (verts.length < 2) continue;
    ctx.strokeStyle = overlayCosetStrokeStyle(rep);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const p0 = toScreen(pos[verts[0]!]!);
    ctx.moveTo(p0.x, p0.y);
    for (let t = 1; t < verts.length; t++) {
      const p = toScreen(pos[verts[t]!]!);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  if (
    selectedPolylineIndex !== null &&
    selectedPolylineIndex >= 0 &&
    selectedPolylineIndex < polys.length
  ) {
    const sel = polys[selectedPolylineIndex]!;
    const { verts } = sel;
    if (verts.length === 1) {
      const p = toScreen(pos[verts[0]!]!);
      ctx.strokeStyle = "rgba(255, 230, 120, 0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (verts.length >= 2) {
      ctx.strokeStyle = "rgba(255, 230, 120, 0.95)";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      const p0 = toScreen(pos[verts[0]!]!);
      ctx.moveTo(p0.x, p0.y);
      for (let t = 1; t < verts.length; t++) {
        const p = toScreen(pos[verts[t]!]!);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  const nodeR = selectedVertex === null ? 2.2 : 2;
  for (let i = 0; i < pos.length; i++) {
    const p = toScreen(pos[i]!);
    ctx.fillStyle =
      i === selectedVertex ? "#01fdc7" : "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === selectedVertex ? 5 : nodeR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(1,253,198,0.45)";
  ctx.font = "11px Courier New";
  ctx.fillText("1", toScreen(pos[0]!).x + 5, toScreen(pos[0]!).y - 5);

  if (statsLine) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "11px Courier New";
    ctx.fillText(statsLine, 8, 16);
  }
}

/** Hit test in canvas pixels; returns vertex index or null. */
export function pickVertex(
  mx: number,
  my: number,
  width: number,
  height: number,
  pad: number,
  state: F2UiState,
  panX: number,
  panY: number,
  scale: number,
  hitPx: number,
): number | null {
  const layout = state.layout;
  const build = state.build;
  if (!layout || !build) return null;

  const cx = width / 2 + panX;
  const cy = height / 2 + panY;
  const R = Math.min(width, height) / 2 - pad;

  const toScreen = (p: Vec2): Vec2 => ({
    x: cx + p.x * R * scale,
    y: cy + p.y * R * scale,
  });

  let best: number | null = null;
  let bestD = Infinity;
  const { pos } = layout;
  for (let i = 0; i < pos.length; i++) {
    const p = toScreen(pos[i]!);
    const dx = p.x - mx;
    const dy = p.y - my;
    const d = dx * dx + dy * dy;
    if (d < bestD && d <= hitPx * hitPx) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Hit-test coloured overlay chains in canvas pixels; returns polyline index or null. */
export function pickOverlayPolyline(
  mx: number,
  my: number,
  width: number,
  height: number,
  pad: number,
  state: F2UiState,
  panX: number,
  panY: number,
  scale: number,
  hitPx: number,
): number | null {
  const layout = state.layout;
  const build = state.build;
  if (!layout || !build) return null;

  const cx = width / 2 + panX;
  const cy = height / 2 + panY;
  const R = Math.min(width, height) / 2 - pad;

  const toScreen = (p: Vec2): Vec2 => ({
    x: cx + p.x * R * scale,
    y: cy + p.y * R * scale,
  });

  const { pos } = layout;
  let best: number | null = null;
  let bestD = Infinity;

  for (let pi = 0; pi < state.overlayPolylines.length; pi++) {
    const { verts } = state.overlayPolylines[pi]!;
    if (verts.length === 1) {
      const i = verts[0]!;
      const p = toScreen(pos[i]!);
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < bestD && d <= hitPx) {
        bestD = d;
        best = pi;
      }
      continue;
    }
    for (let j = 0; j < verts.length - 1; j++) {
      const ia = verts[j]!;
      const ib = verts[j + 1]!;
      const pa = toScreen(pos[ia]!);
      const pb = toScreen(pos[ib]!);
      const d = distPointToSegment(mx, my, pa.x, pa.y, pb.x, pb.y);
      if (d < bestD && d <= hitPx) {
        bestD = d;
        best = pi;
      }
    }
  }
  return best;
}

type SpliceBoundaryVertex = {
  id: string;
  label: string;
};

type SpliceGraph = {
  path: number[];
  vertices: SpliceBoundaryVertex[];
  edges: Array<{ a: string; b: string; rep: number }>;
};

function pathVerticesInTree(graph: F2TreeBuild["graph"], from: number, to: number): number[] {
  if (from === to) return [from];
  const par = new Int32Array(graph.length).fill(-1);
  const q: number[] = [from];
  par[from] = from;
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++]!;
    if (u === to) break;
    for (const v of graph[u]![1]) {
      if (par[v] === -1) {
        par[v] = u;
        q.push(v);
      }
    }
  }
  if (par[to] === -1) return [];
  const path: number[] = [];
  let cur = to;
  while (cur !== from) {
    path.push(cur);
    cur = par[cur]!;
  }
  path.push(from);
  path.reverse();
  return path;
}

function dirFromToBuild(build: F2TreeBuild, fromIdx: number, toIdx: number): number | undefined {
  const fromEl = build.graph[fromIdx]![0];
  const toEl = build.graph[toIdx]![0];
  for (let d = 0; d < build.grp.gens.length; d++) {
    const g = build.grp.gens[d]!;
    if (fromEl.mul(g).equal(toEl)) return d;
  }
  return undefined;
}

function computeSplicedIntervalGraph(
  build: F2TreeBuild,
  overlayPolylines: OverlayPolyline[],
  startIdx: number,
  endIdx: number,
): SpliceGraph {
  const { graph } = build;
  const path = pathVerticesInTree(graph, startIdx, endIdx);
  if (path.length === 0) return { path: [], vertices: [], edges: [] };

  const inX = new Set<number>(path);
  const boundary = new Map<string, SpliceBoundaryVertex>();
  const usedBoundary = new Set<string>();
  const edges: Array<{ a: string; b: string; rep: number }> = [];

  const ensureBoundary = (inside: number, outside: number): string => {
    const id = `${inside}->${outside}`;
    if (!boundary.has(id)) {
      const dir = dirFromToBuild(build, inside, outside);
      const centerWord = formatWordLetters(graph[inside]![0].word);
      const label = `${centerWord}:${generatorLabel(dir ?? -1)}`;
      boundary.set(id, { id, label });
    }
    return id;
  };

  // Components of T\X correspond to oriented boundary edges (x -> y) with x in X, y outside X.
  for (const x of path) {
    for (const y of graph[x]![1]) {
      if (!inX.has(y)) ensureBoundary(x, y);
    }
  }

  for (const poly of overlayPolylines) {
    const verts = poly.verts;
    if (verts.length < 2) continue;

    let firstIn = -1;
    let lastIn = -1;
    for (let i = 0; i < verts.length; i++) {
      if (!inX.has(verts[i]!)) continue;
      if (firstIn < 0) firstIn = i;
      lastIn = i;
    }
    if (firstIn < 0 || lastIn < 0) continue;

    let leftId: string | null = null;
    let rightId: string | null = null;
    if (firstIn > 0 && !inX.has(verts[firstIn - 1]!)) {
      leftId = ensureBoundary(verts[firstIn]!, verts[firstIn - 1]!);
      usedBoundary.add(leftId);
    }
    if (lastIn + 1 < verts.length && !inX.has(verts[lastIn + 1]!)) {
      rightId = ensureBoundary(verts[lastIn]!, verts[lastIn + 1]!);
      usedBoundary.add(rightId);
    }
    if (leftId && rightId) {
      edges.push({ a: leftId, b: rightId, rep: poly.rep });
    }
  }

  const vertices = [...boundary.values()].filter((v) => usedBoundary.has(v.id));
  return { path, vertices, edges };
}

function drawSplicedSvg(svg: SVGSVGElement, graph: SpliceGraph | null): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!graph || graph.vertices.length === 0) return;

  const ns = "http://www.w3.org/2000/svg";
  const vb = 220;
  svg.setAttribute("viewBox", `${-vb / 2} ${-vb / 2} ${vb} ${vb}`);

  const n = graph.vertices.length;
  const r = 78;
  const positions = new Map<string, Vec2>();
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n - Math.PI / 2;
    positions.set(graph.vertices[i]!.id, { x: r * Math.cos(t), y: r * Math.sin(t) });
  }

  const grouped = new Map<string, { a: string; b: string; reps: number[] }>();
  for (const e of graph.edges) {
    const key = e.a <= e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
    const got = grouped.get(key);
    if (got) got.reps.push(e.rep);
    else grouped.set(key, { a: e.a, b: e.b, reps: [e.rep] });
  }

  for (const g of grouped.values()) {
    const pa = positions.get(g.a);
    const pb = positions.get(g.b);
    if (!pa || !pb) continue;
    if (g.a === g.b) continue;
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = -dy / len;
    const uy = dx / len;
    const cnt = g.reps.length;
    for (let i = 0; i < cnt; i++) {
      const off = (i - (cnt - 1) / 2) * 4.2;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(pa.x + ux * off));
      line.setAttribute("y1", String(pa.y + uy * off));
      line.setAttribute("x2", String(pb.x + ux * off));
      line.setAttribute("y2", String(pb.y + uy * off));
      line.setAttribute("stroke", overlayCosetStrokeStyle(g.reps[i]!));
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
    }
  }

  for (const v of graph.vertices) {
    const p = positions.get(v.id);
    if (!p) continue;
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", String(p.x));
    c.setAttribute("cy", String(p.y));
    c.setAttribute("r", "10");
    c.setAttribute("fill", "rgb(3,2,56)");
    c.setAttribute("stroke", "#01fdc7");
    c.setAttribute("stroke-width", "1.5");
    svg.appendChild(c);

    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(p.x));
    t.setAttribute("y", String(p.y + 4));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#fff");
    t.setAttribute("font-size", "9");
    t.setAttribute("font-family", "Courier New, monospace");
    t.textContent = v.label;
    svg.appendChild(t);
  }
}

function whiteheadPositions(): Vec2[] {
  const r = 44;
  return [
    { x: 0, y: -r },
    { x: r, y: 0 },
    { x: 0, y: r },
    { x: -r, y: 0 },
  ];
}

export type WhiteheadDiagramLabels = {
  centerWord: string;
};

export function drawWhiteheadSvg(
  svg: SVGSVGElement,
  pairs: WhiteheadPair[] | undefined,
  diagramLabels?: WhiteheadDiagramLabels,
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ns = "http://www.w3.org/2000/svg";
  const vbW = 180;
  const vbH = 156;
  svg.setAttribute(
    "viewBox",
    `${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`,
  );

  const positions = whiteheadPositions();
  const genLabels = ["a", "a⁻¹", "b", "b⁻¹"];

  if (diagramLabels) {
    const title = document.createElementNS(ns, "text");
    title.setAttribute("x", "0");
    title.setAttribute("y", String(-vbH / 2 + 18));
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("fill", "#01fdc7");
    title.setAttribute("font-size", "12");
    title.setAttribute("font-family", "Courier New, monospace");
    title.textContent =
      diagramLabels.centerWord === "" || diagramLabels.centerWord === "1"
        ? "1 (identity)"
        : diagramLabels.centerWord;
    svg.appendChild(title);
  }

  if (pairs?.length) {
    const grouped = new Map<string, { a: number; b: number; count: number }>();
    for (const [rawA, rawB] of pairs) {
      const a = Math.min(rawA, rawB);
      const b = Math.max(rawA, rawB);
      const k = `${a},${b}`;
      const got = grouped.get(k);
      if (got) got.count += 1;
      else grouped.set(k, { a, b, count: 1 });
    }

    for (const { a, b, count } of grouped.values()) {
      const pa = positions[a]!;
      const pb = positions[b]!;
      if (a === b) {
        for (let i = 0; i < count; i++) {
          const mag = Math.hypot(pa.x, pa.y) || 1;
          const nx = pa.x / mag;
          const ny = pa.y / mag;
          const cx = pa.x + nx * (15 + i * 5);
          const cy = pa.y + ny * (15 + i * 5);
          const loop = document.createElementNS(ns, "ellipse");
          loop.setAttribute("cx", String(cx));
          loop.setAttribute("cy", String(cy));
          loop.setAttribute("rx", String(5 + i * 1.3));
          loop.setAttribute("ry", String(3.4 + i * 0.9));
          loop.setAttribute("fill", "none");
          loop.setAttribute("stroke", "rgba(247,101,252,0.95)");
          loop.setAttribute("stroke-width", "2");
          svg.appendChild(loop);
        }
        continue;
      }

      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = -dy / len;
      const uy = dx / len;
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 5.2;
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", String(pa.x + ux * off));
        line.setAttribute("y1", String(pa.y + uy * off));
        line.setAttribute("x2", String(pb.x + ux * off));
        line.setAttribute("y2", String(pb.y + uy * off));
        line.setAttribute("stroke", "rgba(247,101,252,0.95)");
        line.setAttribute("stroke-width", "2");
        svg.appendChild(line);
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    const c = document.createElementNS(ns, "circle");
    const { x, y } = positions[i]!;
    c.setAttribute("cx", String(x));
    c.setAttribute("cy", String(y));
    c.setAttribute("r", "10");
    c.setAttribute("fill", "rgb(3,2,56)");
    c.setAttribute("stroke", "#01fdc7");
    c.setAttribute("stroke-width", "1.5");
    svg.appendChild(c);

    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y + 4));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#fff");
    t.setAttribute("font-size", "11");
    t.setAttribute("font-family", "Courier New, monospace");
    t.textContent = genLabels[i]!;
    svg.appendChild(t);
  }
}

export type RecomputeResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

export function recomputeF2(
  state: F2UiState,
  wordRaw: string,
  depth: number,
  maxPowerK: number = F2_DEFAULT_POWER_K,
): RecomputeResult {
  const letters = parseF2Word(wordRaw);
  if (letters === null) {
    return { ok: false, error: "Use only a, b, A (=a⁻¹), B (=b⁻¹), spaces." };
  }

  const build = getBuild(depth);
  state.build = build;
  state.layout = layoutF2Polar(build.graph);

  const rawLabel = formatWordLetters(letters);
  const w = reduceWord(build.grp, letters);
  if (w.word.length === 0) {
    state.overlayEdges = [];
    state.overlayPolylines = [];
    state.localWhiteheadPairs = [];
    return {
      ok: true,
      warning: `Reduced word is empty — overlay hidden. (Input was ${rawLabel}.)`,
    };
  }

  const { overlayEdges, overlayPolylines, localWhiteheadPairs } =
    computeAxisOverlay(build, letters, maxPowerK);
  state.overlayEdges = overlayEdges;
  state.overlayPolylines = overlayPolylines;
  state.localWhiteheadPairs = localWhiteheadPairs;

  const redLabel = formatWordLetters(w.word);
  const notes: string[] = [];
  if (rawLabel !== redLabel) {
    notes.push(
      `Subgroup ⟨w⟩ uses reduced generator ⟨${redLabel}⟩ (you typed ${rawLabel}).`,
    );
  }
  if (depth >= 5) {
    notes.push("Depth ≥5 can feel sluggish — max depth here is 8.");
  }
  if (notes.length > 0) {
    return { ok: true, warning: notes.join(" ") };
  }
  return { ok: true };
}

export function bindF2Section(
  el: Partial<F2SectionElements>,
  state: F2UiState,
): () => void {
  const {
    canvas,
    wordInput,
    depthSlider,
    depthValue,
    powerSlider,
    powerValue,
    warningEl,
    whiteheadSvg,
    whiteheadPanel,
    whiteheadCaption,
    spliceToggle,
    spliceSvg,
    splicePanel,
    spliceCaption,
  } = el;
  if (
    !canvas ||
    !wordInput ||
    !depthSlider ||
    !depthValue ||
    !warningEl ||
    !whiteheadSvg ||
    !whiteheadPanel ||
    !whiteheadCaption ||
    !spliceToggle ||
    !spliceSvg ||
    !splicePanel ||
    !spliceCaption
  ) {
    return () => undefined;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  const eln: F2SectionElements = {
    canvas,
    wordInput,
    depthSlider,
    depthValue,
    powerSlider,
    powerValue,
    warningEl,
    whiteheadSvg,
    whiteheadPanel,
    whiteheadCaption,
    spliceToggle,
    spliceSvg,
    splicePanel,
    spliceCaption,
  };
  let panX = 0;
  let panY = 0;
  let scale = 1;
  let selectedVertex: number | null = null;
  let selectedPolylineIndex: number | null = null;
  let intervalStartVertex: number | null = null;
  let dragMoved = false;

  const pad = 28;

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = eln.canvas.clientWidth;
    const h = eln.canvas.clientHeight;
    eln.canvas.width = w * dpr;
    eln.canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const statsLine =
      state.build ?
        `|V|=${state.build.graph.length}  edges=${state.overlayEdges.length}  chains=${state.overlayPolylines.length}`
      : undefined;
    redrawF2Canvas(
      ctx,
      w,
      h,
      pad,
      state,
      panX,
      panY,
      scale,
      selectedVertex,
      selectedPolylineIndex,
      statsLine,
    );
  };

  const run = () => {
    const depth = Math.min(
      F2_MAX_TREE_DEPTH,
      Math.max(1, parseInt(eln.depthSlider.value, 10) || F2_DEFAULT_TREE_DEPTH),
    );
    eln.depthSlider.value = String(depth);
    eln.depthValue.textContent = String(depth);

    const maxK = eln.powerSlider
      ? Math.min(
          F2_MAX_POWER_K,
          Math.max(
            1,
            parseInt(eln.powerSlider.value, 10) || F2_DEFAULT_POWER_K,
          ),
        )
      : F2_DEFAULT_POWER_K;
    if (eln.powerSlider) eln.powerSlider.value = String(maxK);
    if (eln.powerValue) eln.powerValue.textContent = String(maxK);

    const res = recomputeF2(state, eln.wordInput.value, depth, maxK);
    if (!res.ok) {
      eln.warningEl.textContent = res.error;
      eln.warningEl.style.color = "#ff6b83";
    } else {
      eln.warningEl.textContent = res.warning ?? "";
      eln.warningEl.style.color = "rgba(255,255,255,0.65)";
    }
    drawWhiteheadSvg(eln.whiteheadSvg, undefined, undefined);
    eln.whiteheadPanel.style.display = "none";
    drawSplicedSvg(eln.spliceSvg, null);
    eln.splicePanel.style.display = "none";
    intervalStartVertex = null;
    selectedVertex = null;
    selectedPolylineIndex = null;
    draw();
  };

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    dragMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    eln.canvas.setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    panX += dx;
    panY += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    draw();
  };

  const onUp = (e: PointerEvent) => {
    dragging = false;
    try {
      eln.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const z = e.deltaY > 0 ? 0.92 : 1.09;
    scale = Math.min(6, Math.max(0.35, scale * z));
    draw();
  };

  const onClick = (e: MouseEvent) => {
    if (dragMoved) return;
    const rect = eln.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = eln.canvas.clientWidth;
    const h = eln.canvas.clientHeight;
    const hit = pickVertex(mx, my, w, h, pad, state, panX, panY, scale, 14);
    if (hit !== null) {
      if (eln.spliceToggle.checked) {
        selectedPolylineIndex = null;
        selectedVertex = hit;
        const b = state.build;
        if (!b) return;
        if (intervalStartVertex === null) {
          intervalStartVertex = hit;
          const startWord = formatWordLetters(b.graph[hit]![0].word);
          eln.spliceCaption.innerHTML =
            `Start set at <strong>${startWord === "1" ? "1" : startWord}</strong>. Click another vertex to splice <code>Wh<sub>𝔅</sub>(X){⟨w⟩}</code> over interval <code>X=[u,v]</code>.`;
          drawSplicedSvg(eln.spliceSvg, null);
          eln.splicePanel.style.display = "block";
          eln.whiteheadPanel.style.display = "none";
          draw();
          return;
        }

        const start = intervalStartVertex;
        const end = hit;
        intervalStartVertex = null;
        const sp = computeSplicedIntervalGraph(
          b,
          state.overlayPolylines,
          start,
          end,
        );
        drawSplicedSvg(eln.spliceSvg, sp);
        const sWord = formatWordLetters(b.graph[start]![0].word);
        const eWord = formatWordLetters(b.graph[end]![0].word);
        eln.spliceCaption.innerHTML =
          `<strong>${sWord}</strong> → <strong>${eWord}</strong> — interval length ${Math.max(0, sp.path.length - 1)}, boundary vertices ${sp.vertices.length}, edges ${sp.edges.length}.`;
        eln.splicePanel.style.display = "block";
        eln.whiteheadPanel.style.display = "none";
        draw();
        return;
      }

      selectedPolylineIndex = null;
      selectedVertex = hit;
      const pairs = state.localWhiteheadPairs;
      const b = state.build;
      const centerEl = b?.graph[hit]?.[0];
      const diagramLabels =
        b && centerEl ?
          { centerWord: formatWordLetters(centerEl.word) }
        : undefined;
      drawWhiteheadSvg(eln.whiteheadSvg, pairs, diagramLabels);
      const cw =
        centerEl ? formatWordLetters(centerEl.word) : String(hit);
      const cwEsc = cw.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const edgeCount = pairs?.length ?? 0;
      eln.whiteheadCaption.innerHTML =
        pairs?.length ?
          `<strong>${cwEsc === "" || cwEsc === "1" ? "1" : cwEsc}</strong> — Local Whitehead graph for the line pattern of ⟨w⟩ at this vertex (translation-equivalent copy of <code>Wh<sub>𝔅</sub>(*)</code>). Showing ${edgeCount} edge${edgeCount === 1 ? "" : "s"} with multiplicity.`
        : `<strong>${cwEsc === "" || cwEsc === "1" ? "1" : cwEsc}</strong> — Whitehead graph has no edges for this generator (e.g. reduced to identity).`;
      eln.whiteheadPanel.style.display = "block";
      draw();
      return;
    }

    const hitLine = pickOverlayPolyline(
      mx,
      my,
      w,
      h,
      pad,
      state,
      panX,
      panY,
      scale,
      11,
    );
    if (hitLine !== null) {
      intervalStartVertex = null;
      selectedVertex = null;
      selectedPolylineIndex = hitLine;
      eln.whiteheadPanel.style.display = "none";
      draw();
      return;
    }

    intervalStartVertex = null;
    selectedVertex = null;
    selectedPolylineIndex = null;
    eln.whiteheadPanel.style.display = "none";
    draw();
  };

  const onSpliceToggleInput = () => {
    intervalStartVertex = null;
    drawSplicedSvg(eln.spliceSvg, null);
    if (!eln.spliceToggle.checked) eln.splicePanel.style.display = "none";
    else {
      eln.spliceCaption.innerHTML =
        "Interval splice mode: click two tree vertices to set X = [u,v].";
      eln.splicePanel.style.display = "block";
    }
  };

  eln.wordInput.addEventListener("input", run);
  eln.depthSlider.addEventListener("input", run);
  eln.spliceToggle.addEventListener("input", onSpliceToggleInput);
  if (eln.powerSlider) eln.powerSlider.addEventListener("input", run);
  eln.canvas.addEventListener("pointerdown", onDown);
  eln.canvas.addEventListener("pointermove", onMove);
  eln.canvas.addEventListener("pointerup", onUp);
  eln.canvas.addEventListener("pointercancel", onUp);
  eln.canvas.addEventListener("wheel", onWheel, { passive: false });
  eln.canvas.addEventListener("click", onClick);

  const ro = new ResizeObserver(draw);
  ro.observe(eln.canvas);

  run();

  return () => {
    eln.wordInput.removeEventListener("input", run);
    eln.depthSlider.removeEventListener("input", run);
    eln.spliceToggle.removeEventListener("input", onSpliceToggleInput);
    if (eln.powerSlider)
      eln.powerSlider.removeEventListener("input", run);
    eln.canvas.removeEventListener("pointerdown", onDown);
    eln.canvas.removeEventListener("pointermove", onMove);
    eln.canvas.removeEventListener("pointerup", onUp);
    eln.canvas.removeEventListener("pointercancel", onUp);
    eln.canvas.removeEventListener("wheel", onWheel);
    eln.canvas.removeEventListener("click", onClick);
    ro.disconnect();
  };
}
