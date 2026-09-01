import { initReveal } from "./animations/reveal.js";
import { initTunnel } from "./canvas/tunnel.js";

function init() {
  initReveal();
  initTunnel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
