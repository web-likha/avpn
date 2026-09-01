import { initReveal } from "./animations/reveal.js";

function init() {
  initReveal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
