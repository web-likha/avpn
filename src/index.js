import { ScrollTrigger } from "./lib/gsap.js";
import { initLocomotiveScroll } from "./lib/locomotive.js";
import { initDrawPathScroll } from "./animations/drawPathScroll.js";
import { initSplitReveal } from "./animations/splitReveal.js";
import { initMarqueeScrollDirection } from "./animations/marqueeScrollDirection.js";
import { initForewordFade } from "./animations/forewordAnim.js";
import { initTunnel } from "./canvas/tunnel.js";
import { initTunnel2 } from "./canvas/tunnel2.js";

function init() {
  initLocomotiveScroll();
  initDrawPathScroll();
  initSplitReveal();
  initMarqueeScrollDirection();
  initForewordFade();
  initTunnel();
  initTunnel2();
  watchImagesForRefresh();
}

function watchImagesForRefresh() {
  let refreshTimer;
  document.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener(
      "load",
      () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);
      },
      { once: true }
    );
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.addEventListener("load", () => ScrollTrigger.refresh());
