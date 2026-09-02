import { gsap, ScrollTrigger } from "../lib/gsap.js";

/**
 * A continuously moving marquee that reverses while the page scrolls upward
 * and receives an additional horizontal drift from ScrollTrigger.
 *
 * Webflow contract:
 *   [data-marquee-scroll-direction-target]  marquee root/configuration scope
 *   [data-marquee-collection-target]        content to animate and duplicate
 *   [data-marquee-scroll-target]            moving overflow track
 */
export function initMarqueeScrollDirection() {
  document
    .querySelectorAll("[data-marquee-scroll-direction-target]")
    .forEach((marquee) => {
      // Idempotent re-init: remove the previous animation and generated copies
      // before reading the original content again.
      const previous = marquee._marqueeScrollDirectionInstance;
      previous?.animation.kill();
      previous?.directionTrigger.kill();
      previous?.scrollTimeline.kill();
      marquee
        .querySelectorAll('[data-marquee-generated="scroll-direction"]')
        .forEach((clone) => clone.remove());

      const marqueeContent = marquee.querySelector(
        "[data-marquee-collection-target]",
      );
      const marqueeScroll = marquee.querySelector(
        "[data-marquee-scroll-target]",
      );
      if (!marqueeContent || !marqueeScroll) return;

      const speed = Number.parseFloat(marquee.dataset.marqueeSpeed);
      const direction = marquee.dataset.marqueeDirection === "right" ? 1 : -1;
      const duplicateAmount = Number.parseInt(
        marquee.dataset.marqueeDuplicate || "0",
        10,
      );
      const scrollSpeed = Number.parseFloat(
        marquee.dataset.marqueeScrollSpeed,
      );
      if (![speed, scrollSpeed].every(Number.isFinite)) return;

      const speedMultiplier =
        window.innerWidth < 479
          ? 0.25
          : window.innerWidth < 991
            ? 0.5
            : 1;
      const marqueeSpeed =
        speed * (marqueeContent.offsetWidth / window.innerWidth) * speedMultiplier;

      marqueeScroll.style.marginLeft = `${scrollSpeed * -1}%`;
      marqueeScroll.style.width = `${scrollSpeed * 2 + 100}%`;

      if (duplicateAmount > 0) {
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < duplicateAmount; index += 1) {
          const clone = marqueeContent.cloneNode(true);
          clone.setAttribute("data-marquee-generated", "scroll-direction");
          fragment.appendChild(clone);
        }
        marqueeScroll.appendChild(fragment);
      }

      const marqueeItems = marquee.querySelectorAll(
        "[data-marquee-collection-target]",
      );
      const animation = gsap
        .to(marqueeItems, {
          xPercent: -100,
          repeat: -1,
          duration: marqueeSpeed,
          ease: "linear",
        })
        .totalProgress(0.5);

      gsap.set(marqueeItems, { xPercent: direction === 1 ? 100 : -100 });
      animation.timeScale(direction).play();
      marquee.setAttribute("data-marquee-status", "normal");

      const directionTrigger = ScrollTrigger.create({
        trigger: marquee,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const isScrollingDown = self.direction === 1;
          animation.timeScale(isScrollingDown ? -direction : direction);
          marquee.setAttribute(
            "data-marquee-status",
            isScrollingDown ? "normal" : "inverted",
          );
        },
      });

      const scrollTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: marquee,
          start: "0% 100%",
          end: "100% 0%",
          scrub: 0,
        },
      });
      const scrollStart = direction === -1 ? scrollSpeed : -scrollSpeed;
      scrollTimeline.fromTo(
        marqueeScroll,
        { x: `${scrollStart}vw` },
        { x: `${-scrollStart}vw`, ease: "none" },
      );

      marquee._marqueeScrollDirectionInstance = {
        animation,
        directionTrigger,
        scrollTimeline,
      };
    });
}

