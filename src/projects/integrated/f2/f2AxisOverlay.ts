import type { FreeCayleyGraph } from "../shared/FreeGroup";
import { FreeGroup, FreeGroupElement } from "../shared/FreeGroup";

export const F2_MAX_TREE_DEPTH = 8;
export const F2_DEFAULT_TREE_DEPTH = 4;

/** Half-length along ⟨w⟩: use powers w^k for k ∈ [−K, K]. */
export const F2_DEFAULT_POWER_K = 18;
export const F2_MAX_POWER_K = 96;

export type F2TreeBuild = {
  graph: FreeCayleyGraph;
  grp: FreeGroup;
  depth: number;
  indexOf: Map<string, number>;
};

export type Vec2 = { x: number; y: number };

export type F2Layout = {
  pos: Vec2[];
  depth: number;
};

/** Undirected edge as sorted pair of vertex indices. */
export type EdgePair = readonly [number, number];

/** One ⟨w⟩ branch in the ball: tree vertices along merged geodesics, tagged by coset rep index. */
export type OverlayPolyline = {
  rep: number;
  verts: number[];
};

/** Deduped tree edge with coset rep tag (for stats / compatibility). */
export type OverlayEdge = readonly [number, number, number];

export type WhiteheadPair = readonly [number, number];

export function wordKey(word: number[]): string {
  return word.join(",");
}

export function invertWord(w: number[]): number[] {
  return [...w].reverse().map((x) => -x);
}

/** Cyclic reduction in F2: repeatedly cancel inverse letters at both ends. */
export function cyclicReduceWord(letters: number[]): number[] {
  const out = [...letters];
  while (out.length >= 2 && out[0] === -out[out.length - 1]!) {
    out.shift();
    out.pop();
  }
  return out;
}

function dirFromLetter(letter: number): number | undefined {
  if (letter === 1) return 0;
  if (letter === -1) return 1;
  if (letter === 2) return 2;
  if (letter === -2) return 3;
  return undefined;
}

/**
 * Local Whitehead graph Wh_B(*){w}: each cyclic adjacent pair x y contributes
 * an (undirected) edge from x^{-1} to y. Multiplicity is preserved.
 */
export function computeLocalWhiteheadPairs(wReduced: number[]): WhiteheadPair[] {
  const cyc = cyclicReduceWord(wReduced);
  if (cyc.length === 0) return [];

  const pairs: WhiteheadPair[] = [];
  for (let i = 0; i < cyc.length; i++) {
    const x = cyc[i]!;
    const y = cyc[(i + 1) % cyc.length]!;
    const from = dirFromLetter(-x);
    const to = dirFromLetter(y);
    if (from === undefined || to === undefined) continue;
    pairs.push(from <= to ? [from, to] : [to, from]);
  }
  return pairs;
}

/** Parse `a`,`b` and uppercase / inverse forms. Returns null if invalid. */
export function parseF2Word(input: string): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === " " || c === "\t") continue;
    if (c === "a") {
      out.push(1);
      continue;
    }
    if (c === "b") {
      out.push(2);
      continue;
    }
    if (c === "A") {
      out.push(-1);
      continue;
    }
    if (c === "B") {
      out.push(-2);
      continue;
    }
    return null;
  }
  return out;
}

export function reduceWord(grp: FreeGroup, letters: number[]): FreeGroupElement {
  let e = grp.id;
  for (const L of letters) {
    const gen = new FreeGroupElement(grp, [L]);
    e = e.mul(gen);
  }
  return e;
}

/** Pretty-print reduced generator letters for UI (F₂ only). */
export function formatWordLetters(letters: number[]): string {
  let s = "";
  for (const L of letters) {
    if (L === 1) s += "a";
    else if (L === -1) s += "A";
    else if (L === 2) s += "b";
    else if (L === -2) s += "B";
    else s += "?";
  }
  return s || "1";
}

export function buildF2Tree(maxDepth: number): F2TreeBuild {
  const grp = new FreeGroup(2, maxDepth);
  const graph = grp.cayleyRight;
  const indexOf = new Map<string, number>();
  for (let i = 0; i < graph.length; i++) {
    indexOf.set(wordKey(graph[i]![0].word), i);
  }
  return { graph, grp, depth: maxDepth, indexOf };
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/** Edge direction in the F₂ ball built from `cayleyRight`: toEl = fromEl·g for generator g at index d. */
function dirFromTo(
  grp: FreeGroup,
  fromEl: FreeGroupElement,
  toEl: FreeGroupElement,
): number | undefined {
  for (let d = 0; d < grp.gens.length; d++) {
    const g = grp.gens[d]!;
    if (fromEl.mul(g).equal(toEl)) return d;
  }
  return undefined;
}

function invertElement(grp: FreeGroup, e: FreeGroupElement): FreeGroupElement {
  return new FreeGroupElement(grp, invertWord(e.word));
}

/**
 * Order one DSU ⟨w⟩ component ∩ ball along w-steps (path graph, degree ≤ 2).
 */
function orderCosetWChain(
  comp: ReadonlySet<number>,
  graph: FreeCayleyGraph,
  indexOf: Map<string, number>,
  w: FreeGroupElement,
  wInv: FreeGroupElement,
): number[] {
  if (comp.size === 0) return [];
  if (comp.size === 1) return [Math.min(...comp)];

  const wAdj = new Map<number, number[]>();
  for (const i of comp) {
    const el = graph[i]![0];
    const out: number[] = [];
    const jw = indexOf.get(wordKey(el.mul(w).word));
    const jwi = indexOf.get(wordKey(el.mul(wInv).word));
    if (jw !== undefined && comp.has(jw)) out.push(jw);
    if (jwi !== undefined && comp.has(jwi)) out.push(jwi);
    wAdj.set(i, out);
  }

  let start: number | null = null;
  for (const i of comp) {
    if ((wAdj.get(i) ?? []).length === 1) {
      start = i;
      break;
    }
  }
  if (start === null) start = Math.min(...comp);

  const chain: number[] = [start];
  let prev = -1;
  let cur = start;
  while (chain.length < comp.size) {
    const nb = wAdj.get(cur) ?? [];
    const next = nb.find((j) => j !== prev);
    if (next === undefined) break;
    chain.push(next);
    prev = cur;
    cur = next;
  }
  return chain;
}

/**
 * Left cosets of ⟨w⟩ in the truncated ball: partition vertices by **same coset** (connect `v` to `v·w`
 * when both lie in the ball). Each component is one connected piece of coset ∩ ball along ⟨w⟩ steps.
 * For each component we draw the **full** w-chain inside the ball: merge tree geodesics between
 * consecutive vertices on that axis so **every vertex** of the component lies on the coloured overlay.
 * Hue is `overlayCosetStrokeStyle(rep)` for minimum-index representative `rep`.
 *
 * `maxPowerK` is kept for API compatibility; chain extent is determined only by the ball (all ⟨w⟩ edges
 * whose endpoints lie in the ball).
 *
 * Whitehead pairs: at interior vertices of the **w-chain** (has two w-neighbours in the ball), using the
 * first Cayley step toward those neighbours along the tree.
 */
export function computeAxisOverlay(
  build: F2TreeBuild,
  wLetters: number[],
  maxPowerK: number = F2_DEFAULT_POWER_K,
): {
  overlayEdges: OverlayEdge[];
  overlayPolylines: OverlayPolyline[];
  localWhiteheadPairs: WhiteheadPair[];
} {
  void maxPowerK;
  const { graph, grp, indexOf } = build;
  const w = reduceWord(grp, wLetters);
  if (w.word.length === 0) {
    return {
      overlayEdges: [],
      overlayPolylines: [],
      localWhiteheadPairs: [],
    };
  }
  const localWhiteheadPairs = computeLocalWhiteheadPairs(w.word);

  const wInv = invertElement(grp, w);

  const n = graph.length;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]!);
    return parent[i]!;
  };

  const union = (a: number, b: number) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent[rb] = ra;
    else parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    const vEl = graph[i]![0];
    const jw = indexOf.get(wordKey(vEl.mul(w).word));
    if (jw !== undefined) union(i, jw);
    const jwi = indexOf.get(wordKey(vEl.mul(wInv).word));
    if (jwi !== undefined) union(i, jwi);
  }

  const overlaySeen = new Set<string>();
  const overlayList: OverlayEdge[] = [];
  const overlayPolylines: OverlayPolyline[] = [];

  const addEdge = (a: number, b: number, rep: number) => {
    const dedupe = `${edgeKey(a, b)}@${rep}`;
    if (overlaySeen.has(dedupe)) return;
    overlaySeen.add(dedupe);
    overlayList.push([a, b, rep]);
  };

  const pathVertices = (from: number, to: number): number[] => {
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
    const verts: number[] = [];
    let cur = to;
    while (cur !== from) {
      verts.push(cur);
      cur = par[cur]!;
    }
    verts.push(from);
    verts.reverse();
    return verts;
  };

  const seenRoot = new Set<number>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (seenRoot.has(r)) continue;
    seenRoot.add(r);

    const comp = new Set<number>();
    for (let j = 0; j < n; j++) {
      if (find(j) === r) comp.add(j);
    }

    const chain = orderCosetWChain(comp, graph, indexOf, w, wInv);
    if (chain.length === 1) {
      overlayPolylines.push({ rep: r, verts: [chain[0]!] });
      continue;
    }
    if (chain.length < 2) continue;

    const polyVerts: number[] = [];
    for (let j = 0; j < chain.length - 1; j++) {
      const seg = pathVertices(chain[j]!, chain[j + 1]!);
      if (seg.length === 0) continue;
      if (polyVerts.length === 0) {
        polyVerts.push(...seg);
      } else {
        const join = seg[0] === polyVerts[polyVerts.length - 1];
        const startIdx = join ? 1 : 0;
        for (let s = startIdx; s < seg.length; s++) polyVerts.push(seg[s]!);
      }
    }

    if (polyVerts.length >= 2) {
      overlayPolylines.push({ rep: r, verts: [...polyVerts] });
      for (let j = 0; j < polyVerts.length - 1; j++) {
        addEdge(polyVerts[j]!, polyVerts[j + 1]!, r);
      }
    }
  }

  return { overlayEdges: overlayList, overlayPolylines, localWhiteheadPairs };
}

export function layoutF2Polar(graph: FreeCayleyGraph, root = 0): F2Layout {
  const n = graph.length;
  const pos: Vec2[] = new Array(n);
  for (let i = 0; i < n; i++) pos[i] = { x: 0, y: 0 };

  const grp = graph[0]![0].grp;

  const depthOf = (i: number) => graph[i]![0].depth;

  // Draw directions in the cyclic order a, b, a^{-1}, b^{-1}
  // so a is opposite A and b is opposite B around the tree.
  const dirRingOrder = (d: number): number => {
    if (d === 0) return 0; // a
    if (d === 2) return 1; // b
    if (d === 1) return 2; // A
    if (d === 3) return 3; // B
    return 99;
  };

  const children = (i: number): number[] => {
    const di = depthOf(i);
    const ei = graph[i]![0];
    const out: number[] = [];
    for (const j of graph[i]![1]) {
      if (depthOf(j) === di + 1) out.push(j);
    }
    out.sort((a, b) => {
      const da = dirFromTo(grp, ei, graph[a]![0]);
      const db = dirFromTo(grp, ei, graph[b]![0]);
      return dirRingOrder(da ?? 99) - dirRingOrder(db ?? 99);
    });
    return out;
  };

  const dfs = (i: number, θ0: number, θ1: number, radius: number) => {
    const mid = (θ0 + θ1) / 2;
    pos[i] = {
      x: radius * Math.cos(mid),
      y: radius * Math.sin(mid),
    };
    const ch = children(i);
    if (ch.length === 0) return;
    const span = θ1 - θ0;
    const step = span / ch.length;
    for (let c = 0; c < ch.length; c++) {
      const θa = θ0 + c * step;
      const θb = θa + step;
      dfs(ch[c]!, θa, θb, radius + 1);
    }
  };

  dfs(root, 0, Math.PI * 2, 0);

  let maxR = 1;
  for (let i = 0; i < n; i++) {
    const { x, y } = pos[i]!;
    maxR = Math.max(maxR, Math.hypot(x, y));
  }
  const scale = maxR > 0 ? 1 / maxR : 1;
  for (let i = 0; i < n; i++) {
    pos[i]!.x *= scale;
    pos[i]!.y *= scale;
  }

  return { pos, depth: graph[root]![0].depth };
}

const GEN_LABELS = ["a", "a⁻¹", "b", "b⁻¹"];

export function generatorLabel(dir: number): string {
  return GEN_LABELS[dir] ?? "?";
}

/** Distinct overlay stroke per coset representative (vertex index). */
export function overlayCosetStrokeStyle(rep: number): string {
  const hue = (rep * 137.508) % 360;
  return `hsl(${hue}, 76%, 58%)`;
}
