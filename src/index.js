import { initLocomotiveScroll } from "./lib/locomotive.js";
import { initDrawPathScroll } from "./animations/drawPathScroll.js";
import { initSplitReveal } from "./animations/splitReveal.js";
import { initMarqueeScrollDirection } from "./animations/marqueeScrollDirection.js";
import { initTunnel } from "./canvas/tunnel.js";
import { initTunnel2 } from "./canvas/tunnel2.js";

function init() {
  initLocomotiveScroll();
  // Must run before initSplitReveal(). initDrawPathScroll() calls
  // ScrollTrigger.refresh() as part of the upstream Osmo resource, and a
  // refresh after SplitText has initialized makes its autoSplit re-split the
  // heading — which drops the gsap.from() start state and leaves the reveal
  // sitting visible instead of hidden. Ordering it first keeps the refresh
  // ahead of that setup. Covered by the "initializes the scroll-linked reveal
  // state" check in tests/animations.spec.js.
  initDrawPathScroll();
  initSplitReveal();
  initMarqueeScrollDirection();
  initTunnel();
  initTunnel2();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
