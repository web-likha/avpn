import LocomotiveScroll from "locomotive-scroll";
import { gsap, ScrollTrigger } from "./gsap.js";

// Copied from locomotive-scroll@5.0.1's dist/locomotive-scroll.css. Inlined
// instead of imported as an asset so the Webflow embed stays the single
// dist/animations.min.js script tag, with no separate CSS file to wire up.
const LOCOMOTIVE_CSS =
  "html.lenis,html.lenis body{height:auto}.lenis:not(.lenis-autoToggle).lenis-stopped{overflow:clip}.lenis [data-lenis-prevent-touch],.lenis [data-lenis-prevent-wheel],.lenis [data-lenis-prevent]{overscroll-behavior:contain}.lenis.lenis-smooth iframe{pointer-events:none}.lenis.lenis-autoToggle{transition-behavior:allow-discrete;transition-duration:1ms;transition-property:overflow}";

let locomotiveScroll;

/**
 * Boots the page-wide smooth scroll (Locomotive Scroll v5, built on Lenis)
 * and keeps GSAP's ScrollTrigger synced to its lerped position. Singleton —
 * only one instance runs per page — gated on [data-smooth-scroll-init] so a
 * page can opt out in Webflow without touching this file.
 */
export function initLocomotiveScroll() {
  if (locomotiveScroll) return locomotiveScroll;
  if (!document.querySelector("[data-smooth-scroll-init]")) return null;

  const style = document.createElement("style");
  style.textContent = LOCOMOTIVE_CSS;
  document.head.appendChild(style);

  locomotiveScroll = new LocomotiveScroll({
    initCustomTicker: (render) => gsap.ticker.add(render),
    destroyCustomTicker: (render) => gsap.ticker.remove(render),
  });

  // https://github.com/darkroomengineering/lenis/blob/main/README.md#gsap-scrolltrigger
  locomotiveScroll.lenisInstance.on("scroll", ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);

  return locomotiveScroll;
}

export function getLocomotiveScroll() {
  return locomotiveScroll;
}
