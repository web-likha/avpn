import { gsap, ScrollTrigger } from "../lib/gsap.js";

/**
 * Fades/slides in any element tagged with [data-animate="reveal"] in Webflow.
 * Optional [data-animate-delay] (seconds) for stagger-by-hand cases.
 */
export function initReveal() {
  const els = document.querySelectorAll('[data-animate="reveal"]');

  els.forEach((el) => {
    const delay = parseFloat(el.getAttribute("data-animate-delay")) || 0;

    gsap.from(el, {
      opacity: 0,
      y: 40,
      duration: 0.8,
      delay,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });
  });
}
