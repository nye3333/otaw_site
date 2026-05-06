import "./integrated/cayley-tools.css";

import { bindF2Section, createF2UiState } from "./integrated/f2/f2Tree2dUi";
import { mountInfinitePlotter } from "./integrated/infinite/infinitePlot";
import { setupWhiteheadPageFromDocument } from "./integrated/whitehead/whiteheadFoldingUi";

function initProjectsTools(): void {
  const infiniteRoot = document.getElementById("project-infinite-mount");
  if (infiniteRoot) {
    mountInfinitePlotter(infiniteRoot);
  }

  const whiteheadRoot = document.getElementById("project-whitehead-mount");
  if (whiteheadRoot) {
    setupWhiteheadPageFromDocument(whiteheadRoot);
  }

  const f2Root = document.getElementById("project-f2-mount");
  if (f2Root) {
    const canvas = f2Root.querySelector("#f2-canvas");
    const wordInput = f2Root.querySelector("#f2-word-input");
    const depthSlider = f2Root.querySelector("#f2-depth-slider");
    const depthValue = f2Root.querySelector("#f2-depth-value");
    const powerSlider = f2Root.querySelector("#f2-power-slider");
    const powerValue = f2Root.querySelector("#f2-power-value");
    const spliceToggle = f2Root.querySelector("#f2-splice-toggle");
    const warningEl = f2Root.querySelector("#f2-warning");
    const whiteheadSvg = f2Root.querySelector("#f2-whitehead-svg");
    const whiteheadPanel = f2Root.querySelector("#f2-whitehead-panel");
    const whiteheadCaption = f2Root.querySelector("#f2-whitehead-caption");
    const spliceSvg = f2Root.querySelector("#f2-splice-svg");
    const splicePanel = f2Root.querySelector("#f2-splice-panel");
    const spliceCaption = f2Root.querySelector("#f2-splice-caption");

    if (
      !(canvas instanceof HTMLCanvasElement) ||
      !(wordInput instanceof HTMLInputElement) ||
      !(depthSlider instanceof HTMLInputElement) ||
      !(depthValue instanceof HTMLElement) ||
      !(powerSlider instanceof HTMLInputElement) ||
      !(powerValue instanceof HTMLElement) ||
      !(spliceToggle instanceof HTMLInputElement) ||
      !(warningEl instanceof HTMLElement) ||
      !(whiteheadSvg instanceof SVGSVGElement) ||
      !(whiteheadPanel instanceof HTMLElement) ||
      !(whiteheadCaption instanceof HTMLElement) ||
      !(spliceSvg instanceof SVGSVGElement) ||
      !(splicePanel instanceof HTMLElement) ||
      !(spliceCaption instanceof HTMLElement)
    ) {
      console.error("F₂ tool: missing required DOM nodes.");
      return;
    }

    bindF2Section(
      {
        canvas,
        wordInput,
        depthSlider,
        depthValue,
        powerSlider,
        powerValue,
        spliceToggle,
        warningEl,
        whiteheadSvg,
        whiteheadPanel,
        whiteheadCaption,
        spliceSvg,
        splicePanel,
        spliceCaption,
      },
      createF2UiState(),
    );
  }
}

window.addEventListener("DOMContentLoaded", initProjectsTools);
