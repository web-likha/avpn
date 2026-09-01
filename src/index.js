import { initLocomotiveScroll } from "./lib/locomotive.js";
import { initReveal } from "./animations/reveal.js";
import { initTunnel } from "./canvas/tunnel.js";

function init() {
  initLocomotiveScroll();
  initReveal();
  initTunnel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
