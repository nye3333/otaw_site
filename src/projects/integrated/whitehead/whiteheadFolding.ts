export const WHITEHEAD_MIN_RANK = 2;
export const WHITEHEAD_MAX_RANK = 5;

const GENERATOR_NAMES = ["a", "b", "c", "d", "e"] as const;

type InternalDart = {
  id: number;
  from: number;
  to: number;
  label: number;
  inv: number;
  lineage: number[];
};

type InternalState = {
  rank: number;
  vertexCount: number;
  darts: InternalDart[];
};

type ParseWordResult =
  | { ok: true; letters: number[] }
  | { ok: false; error: string };

type ValidateInputResult =
  | { ok: true; parsedWords: number[][] }
  | { ok: false; error: string };

export type WhiteheadInput = {
  rank: number;
  petalWords: string[];
};

export type WhiteheadEdgeView = {
  id: number;
  from: number;
  to: number;
  labelForward: number;
  labelBackward: number;
  lineage: number[];
};

export type WhiteheadDartView = {
  id: number;
  from: number;
  to: number;
  label: number;
  edgeId: number;
};

export type WhiteheadSnapshot = {
  rank: number;
  vertexCount: number;
  edgeCount: number;
  vertices: number[];
  edges: WhiteheadEdgeView[];
  darts: WhiteheadDartView[];
};

export type WhiteheadFoldChoice = {
  vertex: number;
  label: number;
  dartA: number;
  dartB: number;
  edgeA: number;
  edgeB: number;
};

export type WhiteheadFoldStep = {
  index: number;
  beforeStateIndex: number;
  afterStateIndex: number;
  fold: WhiteheadFoldChoice;
  description: string;
  operations: string[];
};

export type WhiteheadMove = {
  kind: "swap" | "fold-type2";
  a: number;
  A: number[];
  description: string;
};

export type WhiteheadRunResult = {
  ok: boolean;
  error?: string;
  states: WhiteheadSnapshot[];
  steps: WhiteheadFoldStep[];
  whiteheadMoves: WhiteheadMove[];
  abelianizationDeterminant: number | null;
  diagnostic: string;
  terminatedByStepLimit: boolean;
  isImmersion: boolean;
  isStandardRose: boolean;
};

class Dsu {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = new Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }

  find(x: number): number {
    const p = this.parent[x]!;
    if (p === x) return x;
    const r = this.find(p);
    this.parent[x] = r;
    return r;
  }

  union(a: number, b: number): void {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    if (ra > rb) {
      const t = ra;
      ra = rb;
      rb = t;
    }
    this.parent[rb] = ra;
  }
}

function edgeIdForDart(dartId: number): number {
  return Math.floor(dartId / 2);
}

function orderedLabels(rank: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= rank; i++) {
    out.push(i);
    out.push(-i);
  }
  return out;
}

export function labelToString(label: number): string {
  const idx = Math.abs(label) - 1;
  if (idx < 0 || idx >= GENERATOR_NAMES.length) return "?";
  const base = GENERATOR_NAMES[idx]!;
  return label > 0 ? base : base.toUpperCase();
}

function parseWord(raw: string, rank: number): ParseWordResult {
  const letters: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === " " || ch === "\t" || ch === "\n") continue;
    const lower = ch.toLowerCase();
    const baseIdx = GENERATOR_NAMES.findIndex((g) => g === lower);
    if (baseIdx < 0) {
      return { ok: false, error: `Invalid character "${ch}".` };
    }
    if (baseIdx + 1 > rank) {
      return {
        ok: false,
        error: `Character "${ch}" exceeds rank ${rank}.`,
      };
    }
    const label = ch === lower ? baseIdx + 1 : -(baseIdx + 1);
    letters.push(label);
  }
  if (letters.length === 0) {
    return { ok: false, error: "Each petal label must contain at least one letter." };
  }
  return { ok: true, letters };
}

export function validateWhiteheadInput(input: WhiteheadInput): ValidateInputResult {
  if (input.rank < WHITEHEAD_MIN_RANK || input.rank > WHITEHEAD_MAX_RANK) {
    return {
      ok: false,
      error: `Rank must be between ${WHITEHEAD_MIN_RANK} and ${WHITEHEAD_MAX_RANK}.`,
    };
  }
  if (input.petalWords.length !== input.rank) {
    return {
      ok: false,
      error: `Expected ${input.rank} petal labels, received ${input.petalWords.length}.`,
    };
  }

  const parsedWords: number[][] = [];
  for (let i = 0; i < input.petalWords.length; i++) {
    const parsed = parseWord(input.petalWords[i]!, input.rank);
    if (!parsed.ok) {
      return {
        ok: false,
        error: `x${i + 1} label invalid: ${parsed.error}`,
      };
    }
    parsedWords.push(parsed.letters);
  }
  return { ok: true, parsedWords };
}

function buildInitialState(rank: number, parsedWords: number[][]): InternalState {
  const darts: InternalDart[] = [];
  let nextVertex = 1;
  let nextSegment = 0;

  const addUndirectedEdge = (from: number, to: number, label: number, segment: number) => {
    const d = darts.length;
    const di = d + 1;
    darts.push({
      id: d,
      from,
      to,
      label,
      inv: di,
      lineage: [segment],
    });
    darts.push({
      id: di,
      from: to,
      to: from,
      label: -label,
      inv: d,
      lineage: [segment],
    });
  };

  const base = 0;
  for (let i = 0; i < parsedWords.length; i++) {
    const letters = parsedWords[i]!;
    let cur = base;
    for (let j = 0; j < letters.length; j++) {
      const next = j === letters.length - 1 ? base : nextVertex++;
      addUndirectedEdge(cur, next, letters[j]!, nextSegment++);
      cur = next;
    }
  }

  return {
    rank,
    vertexCount: nextVertex,
    darts,
  };
}

function findNextFold(state: InternalState): WhiteheadFoldChoice | null {
  const labelOrder = orderedLabels(state.rank);
  const labelPriority = new Map<number, number>();
  for (let i = 0; i < labelOrder.length; i++) labelPriority.set(labelOrder[i]!, i);

  for (let v = 0; v < state.vertexCount; v++) {
    const byLabel = new Map<number, number[]>();
    for (const d of state.darts) {
      if (d.from !== v) continue;
      const list = byLabel.get(d.label) ?? [];
      list.push(d.id);
      byLabel.set(d.label, list);
    }

    const labels = [...byLabel.keys()];
    labels.sort((a, b) => (labelPriority.get(a) ?? 999) - (labelPriority.get(b) ?? 999));
    for (const label of labels) {
      const list = byLabel.get(label);
      if (!list || list.length < 2) continue;
      list.sort((a, b) => a - b);
      const dartA = list[0]!;
      const dartB = list[1]!;
      return {
        vertex: v,
        label,
        dartA,
        dartB,
        edgeA: edgeIdForDart(dartA),
        edgeB: edgeIdForDart(dartB),
      };
    }
  }
  return null;
}

function applyFold(state: InternalState, fold: WhiteheadFoldChoice): InternalState {
  const dsuVertices = new Dsu(state.vertexCount);
  const dsuDarts = new Dsu(state.darts.length);

  const da = state.darts[fold.dartA]!;
  const db = state.darts[fold.dartB]!;

  dsuVertices.union(da.to, db.to);
  dsuDarts.union(fold.dartA, fold.dartB);
  dsuDarts.union(da.inv, db.inv);

  const vertexReps = new Set<number>();
  for (let i = 0; i < state.vertexCount; i++) vertexReps.add(dsuVertices.find(i));
  const sortedVertexReps = [...vertexReps].sort((a, b) => a - b);
  const vertexMap = new Map<number, number>();
  for (let i = 0; i < sortedVertexReps.length; i++) {
    vertexMap.set(sortedVertexReps[i]!, i);
  }

  const dartClassMembers = new Map<number, number[]>();
  for (let i = 0; i < state.darts.length; i++) {
    const r = dsuDarts.find(i);
    const list = dartClassMembers.get(r) ?? [];
    list.push(i);
    dartClassMembers.set(r, list);
  }

  const newDarts: InternalDart[] = [];
  const classReps = [...dartClassMembers.keys()].sort((a, b) => a - b);
  const emitted = new Set<number>();

  const pushPair = (rep: number, invRep: number) => {
    const repMembers = dartClassMembers.get(rep) ?? [];
    const invMembers = dartClassMembers.get(invRep) ?? [];
    const repDartId = Math.min(...repMembers);
    const invDartId = Math.min(...invMembers);
    const repDart = state.darts[repDartId]!;
    const invDart = state.darts[invDartId]!;
    const from = vertexMap.get(dsuVertices.find(repDart.from));
    const to = vertexMap.get(dsuVertices.find(repDart.to));
    const fromInv = vertexMap.get(dsuVertices.find(invDart.from));
    const toInv = vertexMap.get(dsuVertices.find(invDart.to));
    if (from === undefined || to === undefined || fromInv === undefined || toInv === undefined) {
      throw new Error("Failed to map quotient vertices during fold.");
    }

    const lineageForward = new Set<number>();
    for (const id of repMembers) {
      for (const seg of state.darts[id]!.lineage) lineageForward.add(seg);
    }
    const lineageBackward = new Set<number>();
    for (const id of invMembers) {
      for (const seg of state.darts[id]!.lineage) lineageBackward.add(seg);
    }
    for (const seg of lineageBackward) lineageForward.add(seg);

    const d = newDarts.length;
    const di = d + 1;
    newDarts.push({
      id: d,
      from,
      to,
      label: repDart.label,
      inv: di,
      lineage: [...lineageForward].sort((a, b) => a - b),
    });
    newDarts.push({
      id: di,
      from: fromInv,
      to: toInv,
      label: invDart.label,
      inv: d,
      lineage: [...lineageForward].sort((a, b) => a - b),
    });
  };

  for (const rep of classReps) {
    if (emitted.has(rep)) continue;
    const invRep = dsuDarts.find(state.darts[rep]!.inv);
    emitted.add(rep);
    emitted.add(invRep);
    if (rep <= invRep) pushPair(rep, invRep);
    else pushPair(invRep, rep);
  }

  return {
    rank: state.rank,
    vertexCount: sortedVertexReps.length,
    darts: newDarts,
  };
}

function snapshotOf(state: InternalState): WhiteheadSnapshot {
  const vertices = Array.from({ length: state.vertexCount }, (_, i) => i);
  const darts: WhiteheadDartView[] = [];
  const edges: WhiteheadEdgeView[] = [];

  for (let i = 0; i < state.darts.length; i += 2) {
    const d = state.darts[i]!;
    const di = state.darts[i + 1]!;
    const edgeId = edgeIdForDart(d.id);
    darts.push({
      id: d.id,
      from: d.from,
      to: d.to,
      label: d.label,
      edgeId,
    });
    darts.push({
      id: di.id,
      from: di.from,
      to: di.to,
      label: di.label,
      edgeId,
    });
    edges.push({
      id: edgeId,
      from: d.from,
      to: d.to,
      labelForward: d.label,
      labelBackward: di.label,
      lineage: [...d.lineage],
    });
  }

  return {
    rank: state.rank,
    vertexCount: state.vertexCount,
    edgeCount: edges.length,
    vertices,
    edges,
    darts,
  };
}

function isStandardRose(state: InternalState): boolean {
  if (state.vertexCount !== 1) return false;
  if (state.darts.length !== state.rank * 2) return false;

  const counts = new Map<number, number>();
  for (const d of state.darts) {
    if (d.from !== 0 || d.to !== 0) return false;
    counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
  }

  for (const label of orderedLabels(state.rank)) {
    if ((counts.get(label) ?? 0) !== 1) return false;
  }
  return true;
}

function abelianizationMatrix(rank: number, parsedWords: number[][]): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i < rank; i++) {
    const row = new Array<number>(rank).fill(0);
    for (const letter of parsedWords[i] ?? []) {
      const j = Math.abs(letter) - 1;
      if (j >= 0 && j < rank) row[j] += letter > 0 ? 1 : -1;
    }
    matrix.push(row);
  }
  return matrix;
}

/** Exact integer determinant via Bareiss fraction-free elimination. */
function determinantInteger(matrix: number[][]): number {
  const n = matrix.length;
  if (n === 0) return 1;
  const a: bigint[][] = matrix.map((row) => row.map((v) => BigInt(v)));
  let sign = 1n;
  let prev = 1n;

  for (let k = 0; k < n - 1; k++) {
    let pivotRow = k;
    while (pivotRow < n && a[pivotRow]![k] === 0n) pivotRow++;
    if (pivotRow === n) return 0;
    if (pivotRow !== k) {
      const tmp = a[k]!;
      a[k] = a[pivotRow]!;
      a[pivotRow] = tmp;
      sign = -sign;
    }

    const pivot = a[k]![k]!;
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) {
        const num = pivot * a[i]![j]! - a[i]![k]! * a[k]![j]!;
        a[i]![j] = num / prev;
      }
    }
    prev = pivot;
    for (let i = k + 1; i < n; i++) a[i]![k] = 0n;
  }

  const detBig = sign * a[n - 1]![n - 1]!;
  return Number(detBig);
}

export const RANDOM_UNIMODULAR_MAX_PETAL_LENGTH = 10;

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Deterministic unimodular sample via elementary row ops from I (determinant ±1). */
function sampleUnimodularMatrix(n: number, steps: number, rng: () => number): number[][] {
  const M: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  const kChoices = [-2, -1, 1, 2];
  for (let s = 0; s < steps; s++) {
    const op = randomIntInclusive(rng, 0, n >= 2 ? 2 : 1);
    if (op === 0) {
      let i = randomIntInclusive(rng, 0, n - 1);
      let j = randomIntInclusive(rng, 0, n - 1);
      while (j === i) j = randomIntInclusive(rng, 0, n - 1);
      const k = kChoices[randomIntInclusive(rng, 0, kChoices.length - 1)]!;
      const rowJ = M[j]!;
      for (let c = 0; c < n; c++) {
        M[i]![c] += k * rowJ[c]!;
      }
    } else if (op === 1 && n >= 2) {
      let i = randomIntInclusive(rng, 0, n - 1);
      let j = randomIntInclusive(rng, 0, n - 1);
      while (j === i) j = randomIntInclusive(rng, 0, n - 1);
      const tmp = M[i]!;
      M[i] = M[j]!;
      M[j] = tmp;
    } else {
      const i = randomIntInclusive(rng, 0, n - 1);
      M[i] = M[i]!.map((x) => -x);
    }
  }
  const det = determinantInteger(M);
  if (Math.abs(det) !== 1) {
    throw new Error(`Internal error: expected unimodular matrix, det=${det}`);
  }
  return M;
}

function exponentWordLengthFromRow(row: number[], rank: number): number {
  let s = 0;
  for (let j = 0; j < rank; j++) s += Math.abs(row[j]!);
  return s;
}

function exponentRowToWord(row: number[], rank: number): string {
  let out = "";
  for (let j = 0; j < rank; j++) {
    const e = row[j]!;
    const ch = GENERATOR_NAMES[j]!;
    if (e > 0) out += ch.repeat(e);
    else if (e < 0) out += ch.toUpperCase().repeat(-e);
  }
  return out;
}

function rowsWithinPetalLengthLimit(
  M: number[][],
  rank: number,
  maxLen: number,
): boolean {
  for (const row of M) {
    const len = exponentWordLengthFromRow(row, rank);
    if (len === 0 || len > maxLen) return false;
  }
  return true;
}

/**
 * Random petal words whose abelianization has determinant ±1 (GL(n,Z) automorphism candidate on Z^n).
 * Each petal has length in [1, {@link RANDOM_UNIMODULAR_MAX_PETAL_LENGTH}] (exponent-sum realization).
 * This does not certify a free-group automorphism.
 */
export function randomUnimodularPetalWords(
  rank: number,
  rng: () => number = Math.random,
): string[] {
  if (rank < WHITEHEAD_MIN_RANK || rank > WHITEHEAD_MAX_RANK) {
    throw new Error(`rank must be between ${WHITEHEAD_MIN_RANK} and ${WHITEHEAD_MAX_RANK}`);
  }
  const maxLen = RANDOM_UNIMODULAR_MAX_PETAL_LENGTH;
  const maxAttempts = 800;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const steps = randomIntInclusive(rng, 5, 36);
    const M = sampleUnimodularMatrix(rank, steps, rng);
    if (!rowsWithinPetalLengthLimit(M, rank, maxLen)) continue;

    const petalWords = M.map((row) => exponentRowToWord(row, rank));
    const checked = validateWhiteheadInput({ rank, petalWords });
    if (!checked.ok) continue;
    const ab = abelianizationMatrix(rank, checked.parsedWords);
    const det = determinantInteger(ab);
    if (Math.abs(det) !== 1) continue;
    return petalWords;
  }
  throw new Error(
    `randomUnimodularPetalWords: no unimodular sample with each petal length ≤ ${maxLen} after ${maxAttempts} attempts`,
  );
}

type Branding = {
  treeEdges: Set<number>;
  complementEdgeIds: number[];
  edgeToCompIndex: Map<number, number>;
  parent: number[];
  parentEdge: number[];
};

function edgeIsLoop(state: InternalState, edgeId: number): boolean {
  const d = state.darts[edgeId * 2]!;
  return d.from === d.to;
}

function buildBranding(state: InternalState, preferTree: Set<number> = new Set()): Branding {
  const edgeCount = state.darts.length / 2;
  const adj: Array<Array<{ to: number; edgeId: number }>> = Array.from(
    { length: state.vertexCount },
    () => [],
  );

  for (let e = 0; e < edgeCount; e++) {
    if (edgeIsLoop(state, e)) continue;
    const d = state.darts[e * 2]!;
    adj[d.from]!.push({ to: d.to, edgeId: e });
    adj[d.to]!.push({ to: d.from, edgeId: e });
  }

  const treeEdges = new Set<number>();
  const parent = new Array<number>(state.vertexCount).fill(-1);
  const parentEdge = new Array<number>(state.vertexCount).fill(-1);
  const seen = new Array<boolean>(state.vertexCount).fill(false);
  const q: number[] = [0];
  seen[0] = true;
  parent[0] = 0;

  while (q.length > 0) {
    const u = q.shift()!;
    const out = [...adj[u]!];
    out.sort((a, b) => {
      const pa = preferTree.has(a.edgeId) ? 0 : 1;
      const pb = preferTree.has(b.edgeId) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.edgeId - b.edgeId;
    });
    for (const next of out) {
      if (seen[next.to]) continue;
      seen[next.to] = true;
      parent[next.to] = u;
      parentEdge[next.to] = next.edgeId;
      treeEdges.add(next.edgeId);
      q.push(next.to);
    }
  }

  const complementEdgeIds: number[] = [];
  for (let e = 0; e < edgeCount; e++) {
    if (!treeEdges.has(e)) complementEdgeIds.push(e);
  }
  complementEdgeIds.sort((a, b) => a - b);

  const edgeToCompIndex = new Map<number, number>();
  for (let i = 0; i < complementEdgeIds.length; i++) {
    edgeToCompIndex.set(complementEdgeIds[i]!, i + 1);
  }

  return { treeEdges, complementEdgeIds, edgeToCompIndex, parent, parentEdge };
}

function pathEdgeSetToRoot(v: number, parent: number[], parentEdge: number[]): Set<number> {
  const out = new Set<number>();
  let cur = v;
  while (cur !== 0 && cur >= 0) {
    const e = parentEdge[cur]!;
    if (e >= 0) out.add(e);
    const p = parent[cur]!;
    if (p === cur || p < 0) break;
    cur = p;
  }
  return out;
}

function treeOrientationAwayFromRootDart(
  state: InternalState,
  edgeId: number,
  parent: number[],
): number {
  const d = state.darts[edgeId * 2]!;
  if (parent[d.to] === d.from) return d.id;
  return d.inv;
}

function makeWhiteheadMove(
  kind: "swap" | "fold-type2",
  a: number,
  A: Set<number>,
  detail: string,
): WhiteheadMove {
  const sortedA = [...A].sort((x, y) => {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (ax !== ay) return ax - ay;
    return x - y;
  });
  const atoms = sortedA.map((s) => (s > 0 ? `x${s}` : `x${Math.abs(s)}^-1`));
  return {
    kind,
    a,
    A: sortedA,
    description: `${detail} => (A,a) with a=${a > 0 ? `x${a}` : `x${Math.abs(a)}^-1`} and A={${atoms.join(", ")}}`,
  };
}

function computeASubset(
  state: InternalState,
  branding: Branding,
  treeEdgeId: number,
  forcedPos: number,
  forcedNeg: number,
): Set<number> {
  const pathCache = new Map<number, Set<number>>();
  const pathSet = (v: number): Set<number> => {
    const got = pathCache.get(v);
    if (got) return got;
    const built = pathEdgeSetToRoot(v, branding.parent, branding.parentEdge);
    pathCache.set(v, built);
    return built;
  };

  const A = new Set<number>();
  for (const edgeId of branding.complementEdgeIds) {
    const i = branding.edgeToCompIndex.get(edgeId);
    if (i === undefined) continue;
    const d = state.darts[edgeId * 2]!;
    if (pathSet(d.from).has(treeEdgeId)) A.add(i);
    if (pathSet(d.to).has(treeEdgeId)) A.add(-i);
  }

  A.add(forcedPos);
  if (A.has(forcedNeg)) A.delete(forcedNeg);
  return A;
}

function rootPathEdges(v: number, parent: number[], parentEdge: number[]): number[] {
  const rev: number[] = [];
  let cur = v;
  while (cur !== 0 && cur >= 0) {
    const e = parentEdge[cur]!;
    if (e >= 0) rev.push(e);
    const p = parent[cur]!;
    if (p === cur || p < 0) break;
    cur = p;
  }
  rev.reverse();
  return rev;
}

function maybeSwapMoveForEdge(
  state: InternalState,
  branding: Branding,
  offTreeEdgeId: number,
): WhiteheadMove | null {
  const idx = branding.edgeToCompIndex.get(offTreeEdgeId);
  if (idx === undefined) return null;
  const d = state.darts[offTreeEdgeId * 2]!;
  const pu = rootPathEdges(d.from, branding.parent, branding.parentEdge);
  const pv = rootPathEdges(d.to, branding.parent, branding.parentEdge);
  let k = 0;
  while (k < pu.length && k < pv.length && pu[k] === pv[k]) k++;

  let chosenEdge = -1;
  let epsilon = 1;
  if (k < pu.length) {
    chosenEdge = pu[k]!;
    epsilon = 1;
  } else if (k < pv.length) {
    chosenEdge = pv[k]!;
    epsilon = -1;
  } else {
    return null;
  }

  const forcedPos = epsilon > 0 ? idx : -idx;
  const forcedNeg = -forcedPos;
  const A = computeASubset(state, branding, chosenEdge, forcedPos, forcedNeg);
  return makeWhiteheadMove(
    "swap",
    forcedPos,
    A,
    `Swap edge e${offTreeEdgeId} with tree edge t${chosenEdge}`,
  );
}

function maybeType2FoldMove(
  state: InternalState,
  branding: Branding,
  fold: WhiteheadFoldChoice,
): WhiteheadMove | null {
  const edgeAInTree = branding.treeEdges.has(fold.edgeA);
  const edgeBInTree = branding.treeEdges.has(fold.edgeB);
  if (edgeAInTree === edgeBInTree) return null;

  const treeEdge = edgeAInTree ? fold.edgeA : fold.edgeB;
  const nonTreeEdge = edgeAInTree ? fold.edgeB : fold.edgeA;
  if (!edgeIsLoop(state, nonTreeEdge)) return null;

  const idx = branding.edgeToCompIndex.get(nonTreeEdge);
  if (idx === undefined) return null;

  const treeFoldDart = edgeAInTree ? fold.dartA : fold.dartB;
  const awayDart = treeOrientationAwayFromRootDart(state, treeEdge, branding.parent);
  const epsilon = treeFoldDart === awayDart ? 1 : -1;
  const forcedPos = epsilon > 0 ? idx : -idx;
  const forcedNeg = -forcedPos;
  const A = computeASubset(state, branding, treeEdge, forcedPos, forcedNeg);
  return makeWhiteheadMove(
    "fold-type2",
    forcedPos,
    A,
    `Type-2 fold using tree edge t${treeEdge} and loop edge e${nonTreeEdge}`,
  );
}

export function runWhiteheadFolding(
  input: WhiteheadInput,
  maxSteps = 1200,
): WhiteheadRunResult {
  const checked = validateWhiteheadInput(input);
  if (!checked.ok) {
    return {
      ok: false,
      error: checked.error,
      states: [],
      steps: [],
      whiteheadMoves: [],
      abelianizationDeterminant: null,
      diagnostic: "Input validation failed.",
      terminatedByStepLimit: false,
      isImmersion: false,
      isStandardRose: false,
    };
  }

  const abMatrix = abelianizationMatrix(input.rank, checked.parsedWords);
  const abDet = determinantInteger(abMatrix);

  let state = buildInitialState(input.rank, checked.parsedWords);
  const states: WhiteheadSnapshot[] = [snapshotOf(state)];
  const steps: WhiteheadFoldStep[] = [];
  const whiteheadMoves: WhiteheadMove[] = [];

  let terminatedByStepLimit = false;
  for (let step = 0; step < maxSteps; step++) {
    const fold = findNextFold(state);
    if (fold === null) break;

    const preferTree = new Set<number>();
    preferTree.add(fold.edgeA);
    preferTree.add(fold.edgeB);
    const branding = buildBranding(state, preferTree);
    const operations: string[] = [];

    const offTreeCandidates = [fold.edgeA, fold.edgeB].filter(
      (e, idx, arr) => !branding.treeEdges.has(e) && arr.indexOf(e) === idx,
    );
    for (const e of offTreeCandidates) {
      if (edgeIsLoop(state, e)) continue;
      const swapMove = maybeSwapMoveForEdge(state, branding, e);
      if (swapMove !== null) {
        whiteheadMoves.push(swapMove);
        operations.push(swapMove.description);
      }
    }

    const type2Move = maybeType2FoldMove(state, branding, fold);
    if (type2Move !== null) {
      whiteheadMoves.push(type2Move);
      operations.push(type2Move.description);
    }

    const nextState = applyFold(state, fold);
    const beforeIndex = states.length - 1;
    const afterIndex = states.length;
    steps.push({
      index: step + 1,
      beforeStateIndex: beforeIndex,
      afterStateIndex: afterIndex,
      fold,
      description: `Fold at v${fold.vertex} on label ${labelToString(fold.label)}: identify darts ${fold.dartA} and ${fold.dartB}.`,
      operations,
    });
    state = nextState;
    states.push(snapshotOf(state));
  }

  if (steps.length >= maxSteps && findNextFold(state) !== null) {
    terminatedByStepLimit = true;
  }

  const isImmersion = findNextFold(state) === null;
  const isRose = isImmersion && isStandardRose(state);
  const unimodular = Math.abs(abDet) === 1;
  const diagnostic = isRose
    ? `Reached the standard rose. Abelianization determinant is ${abDet}.`
    : unimodular
      ? `Automorphism candidate by abelianization (det = ${abDet}), but the run did not end at the standard rose.`
      : `Not an automorphism candidate: det(abelianization) = ${abDet}, so standard-rose termination is not expected.`;

  return {
    ok: true,
    states,
    steps,
    whiteheadMoves,
    abelianizationDeterminant: abDet,
    diagnostic,
    terminatedByStepLimit,
    isImmersion,
    isStandardRose: isRose,
  };
}
