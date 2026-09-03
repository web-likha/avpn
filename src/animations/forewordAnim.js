import { gsap } from "../lib/gsap.js";

/**
 * CEO foreword background wordmark: scrubs opacity to zero as its trigger
 * element scrolls through view, so the wordmark doesn't linger and overlap
 * the gradient arc behind the sticky photo. Kept separate from splitReveal's
 * built-in opacity scrub because this section needs its own fade window
 * instead of tracking the entrance trigger's start/end.
 *
 * Webflow contract:
 *   [data-foreword-fade-init]    the wordmark element to fade out
 *   [data-foreword-fade-trigger] CSS selector for the element to measure
 *                                 scroll position against (nearest matching
 *                                 ancestor, else first match on the page).
 *                                 Defaults to the wordmark itself.
 *   [data-foreword-fade-start]   ScrollTrigger start, "<triggerPoint>
 *                                 <viewportPoint>". Default "top 10%".
 *   [data-foreword-fade-end]     ScrollTrigger end, same syntax. Default
 *                                 "bottom 80%".
 *
 * scrub: true ties opacity directly to scroll position, so scrolling back
 * up rewinds the fade for free — no separate reverse animation to write or
 * run.
 */
export function initForewordFade() {
  document
    .querySelectorAll("[data-foreword-fade-init]")
    .forEach((wordmark) => {
      // Idempotent re-init: kill any previous tween before creating a new one.
      wordmark._forewordFadeTween?.kill();

      const trigger = resolveTrigger(wordmark);
      const start = wordmark.getAttribute("data-foreword-fade-start") || "top 10%";
      const end = wordmark.getAttribute("data-foreword-fade-end") || "bottom 80%";

      wordmark._forewordFadeTween = gsap.to(wordmark, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger,
          start,
          end,
          scrub: true,
        },
      });
    });
}

/**
 * [data-foreword-fade-trigger] selector → nearest matching ancestor, else
 * the first match on the page. Falls back to the wordmark itself when unset
 * or unmatched, so a typo degrades to self-tracking rather than breaking.
 */
function resolveTrigger(wordmark) {
  const selector = wordmark.getAttribute("data-foreword-fade-trigger");
  if (!selector) return wordmark;

  return (
    wordmark.closest(selector) || document.querySelector(selector) || wordmark
  );
}
