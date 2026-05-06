import type {
  WhiteheadFoldStep,
  WhiteheadRunResult,
  WhiteheadSnapshot,
} from "./whiteheadFolding";
import {
  WHITEHEAD_MAX_RANK,
  WHITEHEAD_MIN_RANK,
  labelToString,
  runWhiteheadFolding,
} from "./whiteheadFolding";

type WhiteheadElements = {
  rankSelect: HTMLSelectElement;
  wordsContainer: HTMLElement;
  runButton: HTMLButtonElement;
  prevButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  playButton: HTMLButtonElement;
  statusText: HTMLElement;
  stepText: HTMLElement;
  diagnosticText: HTMLElement;
  svg: SVGSVGElement;
  log: HTMLOListElement;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_WORDS = ["a", "b", "c", "d", "e"];

type UiState = {
  run: WhiteheadRunResult | null;
  stateIndex: number;
  playTimer: number | null;
};

function createWordInputRow(idx: number, initialValue: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "whitehead-word-row";

  const label = document.createElement("label");
  label.textContent = `x${idx + 1} ↦`;
  label.setAttribute("for", `whitehead-word-${idx}`);

  const input = document.createElement("input");
  input.type = "text";
  input.id = `whitehead-word-${idx}`;
  input.className = "whitehead-word-input";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.value = initialValue;
  input.placeholder = initialValue;

  row.appendChild(label);
  row.appendChild(input);
  return row;
}

function currentWordInputs(container: HTMLElement): HTMLInputElement[] {
  return [...container.querySelectorAll("input.whitehead-word-input")];
}

function ensureWordRows(elements: WhiteheadElements): void {
  const rank = parseInt(elements.rankSelect.value, 10);
  elements.wordsContainer.innerHTML = "";
  for (let i = 0; i < rank; i++) {
    const defaultValue = DEFAULT_WORDS[i] ?? "a";
    elements.wordsContainer.appendChild(createWordInputRow(i, defaultValue));
  }
}

function clearSvg(svg: SVGSVGElement): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function createSvgNode<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function getSvgSize(svg: SVGSVGElement): { width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  const width = rect.width > 1 ? rect.width : Number(svg.getAttribute("width") ?? 900);
  const height =
    rect.height > 1 ? rect.height : Number(svg.getAttribute("height") ?? 540);
  return { width, height };
}

function layoutVertices(
  state: WhiteheadSnapshot,
  width: number,
  height: number,
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  if (state.vertexCount === 0) return out;
  const cx = width / 2;
  const cy = height / 2;
  if (state.vertexCount === 1) {
    out.set(0, { x: cx, y: cy });
    return out;
  }

  const radius = Math.min(width, height) * 0.34;
  for (let i = 0; i < state.vertexCount; i++) {
    const θ = -Math.PI / 2 + (i * Math.PI * 2) / state.vertexCount;
    out.set(i, {
      x: cx + radius * Math.cos(θ),
      y: cy + radius * Math.sin(θ),
    });
  }
  return out;
}

function edgePairKey(a: number, b: number): string {
  return a <= b ? `${a},${b}` : `${b},${a}`;
}

function edgeGroupOffsets(groupSize: number): number[] {
  if (groupSize <= 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < groupSize; i++) {
    out.push(i - (groupSize - 1) / 2);
  }
  return out;
}

function drawEdgeLabel(
  svg: SVGSVGElement,
  x: number,
  y: number,
  text: string,
  highlighted: boolean,
): void {
  const label = createSvgNode("text");
  label.setAttribute("x", x.toFixed(2));
  label.setAttribute("y", y.toFixed(2));
  label.setAttribute("class", highlighted ? "whitehead-edge-label is-active" : "whitehead-edge-label");
  label.textContent = text;
  svg.appendChild(label);
}

function drawGraphState(
  svg: SVGSVGElement,
  state: WhiteheadSnapshot,
  activeStep: WhiteheadFoldStep | null,
): void {
  clearSvg(svg);
  const { width, height } = getSvgSize(svg);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const positions = layoutVertices(state, width, height);
  const activeEdges = new Set<number>();
  if (activeStep !== null) {
    activeEdges.add(activeStep.fold.edgeA);
    activeEdges.add(activeStep.fold.edgeB);
  }

  const edgeGroups = new Map<string, number[]>();
  for (const edge of state.edges) {
    const key = edgePairKey(edge.from, edge.to);
    const list = edgeGroups.get(key) ?? [];
    list.push(edge.id);
    edgeGroups.set(key, list);
  }

  const edgeOffset = new Map<number, number>();
  for (const ids of edgeGroups.values()) {
    ids.sort((a, b) => a - b);
    const offsets = edgeGroupOffsets(ids.length);
    for (let i = 0; i < ids.length; i++) {
      edgeOffset.set(ids[i]!, offsets[i]!);
    }
  }

  const loopCountByVertex = new Map<number, number>();

  for (const edge of state.edges) {
    const pFrom = positions.get(edge.from);
    const pTo = positions.get(edge.to);
    if (!pFrom || !pTo) continue;

    const highlighted = activeEdges.has(edge.id);
    const path = createSvgNode("path");
    path.setAttribute(
      "class",
      highlighted ? "whitehead-edge-path is-active" : "whitehead-edge-path",
    );

    let labelX = (pFrom.x + pTo.x) / 2;
    let labelY = (pFrom.y + pTo.y) / 2;

    if (edge.from === edge.to) {
      const loopIdx = loopCountByVertex.get(edge.from) ?? 0;
      loopCountByVertex.set(edge.from, loopIdx + 1);
      const angle = -Math.PI / 2 + loopIdx * 0.75;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const vx = -uy;
      const vy = ux;
      const tipR = 50 + loopIdx * 9;
      const basePull = 18 + loopIdx * 2;
      const spread = 22 + loopIdx * 2;
      const tipSpread = 16 + loopIdx * 1.5;
      const tx = pFrom.x + ux * tipR;
      const ty = pFrom.y + uy * tipR;
      const c1x = pFrom.x + ux * basePull + vx * spread;
      const c1y = pFrom.y + uy * basePull + vy * spread;
      const c2x = tx + vx * tipSpread;
      const c2y = ty + vy * tipSpread;
      const c3x = tx - vx * tipSpread;
      const c3y = ty - vy * tipSpread;
      const c4x = pFrom.x + ux * basePull - vx * spread;
      const c4y = pFrom.y + uy * basePull - vy * spread;
      path.setAttribute(
        "d",
        `M ${pFrom.x.toFixed(2)} ${pFrom.y.toFixed(2)} C ${c1x.toFixed(
          2,
        )} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${tx.toFixed(
          2,
        )} ${ty.toFixed(2)} C ${c3x.toFixed(2)} ${c3y.toFixed(2)} ${c4x.toFixed(
          2,
        )} ${c4y.toFixed(2)} ${pFrom.x.toFixed(2)} ${pFrom.y.toFixed(2)}`,
      );
      labelX = tx + ux * 12;
      labelY = ty + uy * 12;
    } else {
      const off = edgeOffset.get(edge.id) ?? 0;
      const dx = pTo.x - pFrom.x;
      const dy = pTo.y - pFrom.y;
      const len = Math.hypot(dx, dy);
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : 0;
      const bend = off * 20;
      const cx = (pFrom.x + pTo.x) / 2 + nx * bend;
      const cy = (pFrom.y + pTo.y) / 2 + ny * bend;
      path.setAttribute(
        "d",
        `M ${pFrom.x.toFixed(2)} ${pFrom.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(
          2,
        )} ${pTo.x.toFixed(2)} ${pTo.y.toFixed(2)}`,
      );
      labelX = cx;
      labelY = cy - 4;
    }

    svg.appendChild(path);
    drawEdgeLabel(
      svg,
      labelX,
      labelY,
      `${labelToString(edge.labelForward)}/${labelToString(edge.labelBackward)}`,
      highlighted,
    );
  }

  for (const v of state.vertices) {
    const p = positions.get(v);
    if (!p) continue;
    const dot = createSvgNode("circle");
    dot.setAttribute("cx", p.x.toFixed(2));
    dot.setAttribute("cy", p.y.toFixed(2));
    dot.setAttribute("r", "7");
    dot.setAttribute("class", "whitehead-vertex-dot");
    svg.appendChild(dot);

    const label = createSvgNode("text");
    label.setAttribute("x", (p.x + 10).toFixed(2));
    label.setAttribute("y", (p.y - 10).toFixed(2));
    label.setAttribute("class", "whitehead-vertex-label");
    label.textContent = `v${v}`;
    svg.appendChild(label);
  }
}

function setStatus(elements: WhiteheadElements, state: UiState): void {
  if (!state.run) {
    elements.statusText.textContent = "Enter rank and petal labels, then run folds.";
    elements.stepText.textContent = "";
    elements.diagnosticText.textContent = "";
    return;
  }
  if (!state.run.ok) {
    elements.statusText.textContent = state.run.error ?? "Input validation failed.";
    elements.stepText.textContent = "";
    elements.diagnosticText.textContent = "";
    return;
  }
  const base = [
    `States: ${state.run.states.length}`,
    `Folds: ${state.run.steps.length}`,
    `Whitehead moves: ${state.run.whiteheadMoves.length}`,
    `Immersion: ${state.run.isImmersion ? "yes" : "no"}`,
    `Standard rose: ${state.run.isStandardRose ? "yes" : "no"}`,
  ];
  if (state.run.terminatedByStepLimit) {
    base.push("Stopped at step limit");
  }
  elements.statusText.textContent = base.join(" | ");

  const current = state.stateIndex;
  const last = Math.max(0, state.run.states.length - 1);
  if (current < state.run.steps.length) {
    const next = state.run.steps[current]!;
    elements.stepText.textContent = `State ${current}/${last}. Next fold: ${next.description}`;
  } else {
    elements.stepText.textContent = `State ${current}/${last}. No further folds.`;
  }
  elements.diagnosticText.textContent = state.run.diagnostic;
}

function setButtons(elements: WhiteheadElements, state: UiState): void {
  const hasRun = state.run !== null && state.run.ok;
  const maxIndex = hasRun ? state.run!.states.length - 1 : 0;
  elements.prevButton.disabled = !hasRun || state.stateIndex <= 0;
  elements.nextButton.disabled = !hasRun || state.stateIndex >= maxIndex;
  elements.playButton.disabled = !hasRun || maxIndex <= 0;
  elements.playButton.textContent = state.playTimer === null ? "Play" : "Pause";
}

function fillStepLog(elements: WhiteheadElements, run: WhiteheadRunResult): void {
  elements.log.innerHTML = "";
  if (!run.ok) return;
  if (run.steps.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No folds needed: map is already an immersion.";
    elements.log.appendChild(li);
    return;
  }
  for (const step of run.steps) {
    const li = document.createElement("li");
    const extra =
      step.operations.length > 0
        ? ` ${step.operations.map((op) => `[${op}]`).join(" ")}`
        : "";
    li.textContent = `${step.description}${extra}`;
    elements.log.appendChild(li);
  }
}

function rerender(elements: WhiteheadElements, state: UiState): void {
  if (state.run && state.run.ok && state.run.states.length > 0) {
    const snapshot = state.run.states[state.stateIndex]!;
    const activeStep =
      state.stateIndex < state.run.steps.length
        ? state.run.steps[state.stateIndex]!
        : null;
    drawGraphState(elements.svg, snapshot, activeStep);
  } else {
    clearSvg(elements.svg);
  }
  setStatus(elements, state);
  setButtons(elements, state);
}

function runFromInputs(elements: WhiteheadElements, state: UiState): void {
  const rank = parseInt(elements.rankSelect.value, 10);
  const words = currentWordInputs(elements.wordsContainer).map((x) => x.value);
  state.run = runWhiteheadFolding({ rank, petalWords: words });
  state.stateIndex = 0;
  fillStepLog(elements, state.run);
  rerender(elements, state);
}

function stopPlayback(state: UiState): void {
  if (state.playTimer !== null) {
    window.clearInterval(state.playTimer);
    state.playTimer = null;
  }
}

export function bindWhiteheadFoldingPage(elements: WhiteheadElements): void {
  const state: UiState = {
    run: null,
    stateIndex: 0,
    playTimer: null,
  };

  ensureWordRows(elements);

  elements.rankSelect.addEventListener("change", () => {
    ensureWordRows(elements);
    stopPlayback(state);
    state.run = null;
    state.stateIndex = 0;
    rerender(elements, state);
  });

  elements.runButton.addEventListener("click", () => {
    stopPlayback(state);
    runFromInputs(elements, state);
  });

  elements.prevButton.addEventListener("click", () => {
    if (!state.run || !state.run.ok) return;
    state.stateIndex = Math.max(0, state.stateIndex - 1);
    rerender(elements, state);
  });

  elements.nextButton.addEventListener("click", () => {
    if (!state.run || !state.run.ok) return;
    const maxIndex = state.run.states.length - 1;
    state.stateIndex = Math.min(maxIndex, state.stateIndex + 1);
    rerender(elements, state);
  });

  elements.playButton.addEventListener("click", () => {
    if (!state.run || !state.run.ok) return;
    if (state.playTimer !== null) {
      stopPlayback(state);
      rerender(elements, state);
      return;
    }
    const maxIndex = state.run.states.length - 1;
    state.playTimer = window.setInterval(() => {
      if (!state.run || !state.run.ok) return;
      if (state.stateIndex >= maxIndex) {
        stopPlayback(state);
      } else {
        state.stateIndex += 1;
      }
      rerender(elements, state);
    }, 850);
    rerender(elements, state);
  });

  window.addEventListener("resize", () => rerender(elements, state));
  rerender(elements, state);
}

export function setupWhiteheadPageFromDocument(
  root: ParentNode = document,
): void {
  const rankSelect = root.querySelector("#whitehead-rank");
  const wordsContainer = root.querySelector("#whitehead-words");
  const runButton = root.querySelector("#whitehead-run");
  const prevButton = root.querySelector("#whitehead-prev");
  const nextButton = root.querySelector("#whitehead-next");
  const playButton = root.querySelector("#whitehead-play");
  const statusText = root.querySelector("#whitehead-status");
  const stepText = root.querySelector("#whitehead-step");
  const diagnosticText = root.querySelector("#whitehead-diagnostic");
  const svg = root.querySelector("#whitehead-svg");
  const log = root.querySelector("#whitehead-log");

  if (
    !(rankSelect instanceof HTMLSelectElement) ||
    !(wordsContainer instanceof HTMLElement) ||
    !(runButton instanceof HTMLButtonElement) ||
    !(prevButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement) ||
    !(playButton instanceof HTMLButtonElement) ||
    !(statusText instanceof HTMLElement) ||
    !(stepText instanceof HTMLElement) ||
    !(diagnosticText instanceof HTMLElement) ||
    !(svg instanceof SVGSVGElement) ||
    !(log instanceof HTMLOListElement)
  ) {
    throw new Error("Whitehead page is missing required elements.");
  }

  for (let n = WHITEHEAD_MIN_RANK; n <= WHITEHEAD_MAX_RANK; n++) {
    const option = document.createElement("option");
    option.value = `${n}`;
    option.textContent = `${n}`;
    rankSelect.appendChild(option);
  }
  rankSelect.value = "2";

  bindWhiteheadFoldingPage({
    rankSelect,
    wordsContainer,
    runButton,
    prevButton,
    nextButton,
    playButton,
    statusText,
    stepText,
    diagnosticText,
    svg,
    log,
  });
}
