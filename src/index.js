import { initLocomotiveScroll } from "./lib/locomotive.js";
import { initSplitReveal } from "./animations/splitReveal.js";
import { initTunnel } from "./canvas/tunnel.js";

function init() {
  initLocomotiveScroll();
  initSplitReveal();
  initTunnel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
