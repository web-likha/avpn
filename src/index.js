import { initLocomotiveScroll } from "./lib/locomotive.js";
import { initSplitReveal } from "./animations/splitReveal.js";
import { initTunnel } from "./canvas/tunnel.js";
import { initTunnel2 } from "./canvas/tunnel2.js";

function init() {
  initLocomotiveScroll();
  initSplitReveal();
  initTunnel();
  initTunnel2();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
