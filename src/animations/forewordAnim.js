import { gsap, ScrollTrigger } from "../lib/gsap.js";

export function initForewordFade() {
  document
    .querySelectorAll("[data-foreword-fade-init]")
    .forEach((wordmark) => {
      wordmark._forewordFadeTriggers?.forEach((instance) => instance.kill());

      const cover = resolveElement(wordmark, "data-foreword-fade-cover", null);
      const fadeTrigger = resolveElement(
        wordmark,
        "data-foreword-fade-trigger",
        wordmark
      );
      const end = wordmark.getAttribute("data-foreword-fade-end") || "bottom 80%";
      const pinnedTop = () => parseFloat(getComputedStyle(wordmark).top) || 0;

      let reveal = null;
      let fade = null;

      const render = () => {
        const revealed = reveal ? reveal.progress : 1;
        const faded = fade ? fade.progress : 0;
        gsap.set(wordmark, { opacity: revealed * (1 - faded) });
      };

      if (cover) {
        reveal = ScrollTrigger.create({
          trigger: cover,
          start: () => `bottom top+=${pinnedTop() + wordmark.offsetHeight}`,
          end: () => `bottom top+=${pinnedTop()}`,
          onUpdate: render,
          onRefresh: render,
        });
      }

      fade = ScrollTrigger.create({
        trigger: cover || fadeTrigger,
        start: cover ? () => `bottom top+=${pinnedTop()}` : "top top",
        endTrigger: fadeTrigger,
        end,
        onUpdate: render,
        onRefresh: render,
      });

      wordmark._forewordFadeTriggers = [reveal, fade].filter(Boolean);
      render();
    });
}

function resolveElement(wordmark, attribute, fallback) {
  const selector = wordmark.getAttribute(attribute);
  if (!selector) return fallback;

  return (
    wordmark.closest(selector) || document.querySelector(selector) || fallback
  );
}
