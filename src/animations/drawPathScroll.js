import { gsap, ScrollTrigger } from "../lib/gsap.js";

/**
 * Draw Path on Scroll — Osmo Supply resource, wired into this repo's build.
 *
 * Scrubs an SVG path's stroke from 0% to 100% across the wrapper's scroll
 * range, with an optional separate SVG for mobile. The DOM contract is Osmo's
 * and is left exactly as shipped:
 *
 *   [data-draw-scroll-wrap]      the scroll trigger; one timeline per wrapper
 *     [data-draw-scroll-desktop] SVG used above 768px
 *       [data-draw-scroll-path]  the <path> that draws
 *     [data-draw-scroll-mobile]  optional SVG used at/below 767px
 *       [data-draw-scroll-path]
 *
 * Only two things differ from the resource as published, both required to fit
 * this repo rather than a Webflow embed:
 *
 *   1. GSAP and its plugins come from `src/lib/gsap.js` (npm) instead of CDN
 *      <script> tags, so registerPlugin lives there, not here.
 *   2. The function is exported and called from `src/index.js` alongside every
 *      other component, instead of self-invoking on DOMContentLoaded — that's
 *      this repo's convention and keeps one boot path for the whole bundle.
 *
 * The animation logic, attribute names, matchMedia breakpoint, ScrollTrigger
 * start/end, teardown and refresh behaviour are unchanged.
 *
 * Note this draws a *stroke*; it cannot animate a fill. To reveal filled
 * artwork (see the signature demo in index.html) the drawn path is the stroke
 * inside an SVG <mask>, and the filled artwork sits in a masked <g>.
 */
export function initDrawPathScroll() {
  const mm = gsap.matchMedia();
  const wrappers = document.querySelectorAll("[data-draw-scroll-wrap]");

  mm.add(
    {
      isDesktop: "(min-width: 768px)",
      isMobile: "(max-width: 767px)",
    },
    (context) => {
      const { isMobile } = context.conditions;

      wrappers.forEach((wrap) => {
        // Kill any previous timeline for this wrapper
        if (wrap._drawTl) {
          if (wrap._drawTl.scrollTrigger) {
            wrap._drawTl.scrollTrigger.kill();
          }
          wrap._drawTl.kill();
          wrap._drawTl = null;
        }

        const desktopSVG = wrap.querySelector("[data-draw-scroll-desktop]");
        const mobileSVG = wrap.querySelector("[data-draw-scroll-mobile]"); // optional

        // default: desktop
        let svgToUse = desktopSVG;

        // on mobile, use mobileSVG if it exists
        if (isMobile && mobileSVG) {
          svgToUse = mobileSVG;
        }

        if (!svgToUse) return;

        const path = svgToUse.querySelector("[data-draw-scroll-path]");
        if (!path) return;

        const tl = gsap.timeline({
          defaults: {
            ease: "linear", // scroll speed controls easing
          },
          scrollTrigger: {
            trigger: wrap,
            start: "clamp(top center)", // When top of wrap reaches center of viewport
            end: "clamp(bottom center)", // When bottom of wrap reaches center of viewport
            scrub: true,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(path, { drawSVG: 0 }, { drawSVG: "100%", duration: 1 });

        // Keep a reference so we can kill it on breakpoint change
        wrap._drawTl = tl;
      });

      // Make sure ScrollTrigger recalculates
      ScrollTrigger.refresh();

      // Cleanup when breakpoint changes
      return () => {
        wrappers.forEach((wrap) => {
          if (wrap._drawTl) {
            if (wrap._drawTl.scrollTrigger) {
              wrap._drawTl.scrollTrigger.kill();
            }
            wrap._drawTl.kill();
            wrap._drawTl = null;
          }
        });
      };
    }
  );
}
