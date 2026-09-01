# Locomotive Scroll — dev notes

Page-wide smooth scroll, built on Lenis, with declarative parallax via
`data-scroll-speed`. Setup lives in `src/lib/locomotive.js`; it's not a
per-instance component like the others, it's global scroll infrastructure
initialized once from `src/index.js`.

Not yet tagged on any live AVPN page — see "Webflow setup" below.

---

## Webflow setup

Nothing to add on the code side; the bundle already includes it. Three
attributes, all added via Element Settings → custom attributes in the
Designer:

```
body
data-smooth-scroll-init = ""      ← turns Locomotive on for the whole page

any element you want to drift
data-scroll = ""                  ← required for data-scroll-speed to do anything
data-scroll-speed = "0.3"         ← v5 scale: keep it small, 0.1–0.5 typical
```

No `data-smooth-scroll-init` on `<body>` → `initLocomotiveScroll()` early-returns
and the page scrolls natively, untouched. That's the supported "not opted in"
state, not a broken one — same idea as the tunnel's bare-wireframe fallback.

### The one layout trap

**Scope: this only affects individual `[data-scroll-speed]` elements, not the
page-wide smooth scroll.** By default (no custom `wrapper`/`content` in
`lenisOptions`, which we don't set), Lenis scrolls the real document via
`requestAnimationFrame` — it does not transform `<body>`/`<html>` or wrap the
page in a translated container. v5's own release notes call this out
explicitly: it "eliminates layout shifts caused by CSS transforms," which was
a v4 problem. So enabling smooth scroll never conflicts with anything else on
the page by itself.

The actual trap is narrower: Locomotive writes each `[data-scroll-speed]`
element's parallax offset as an inline `element.style.transform`. Anything
else that also sets `transform` on **that specific element** — a `transform`
set directly in the Style panel, a CSS class from another component, a GSAP
tween animating `transform`/`x`/`y`/`scale` on it — gets silently
overwritten, not merged. Position `[data-scroll-speed]` elements with
margin/padding/flex/grid instead of transform. (Found this the hard way
building the `index.html` demo: two boxes meant to sit side-by-side via
`transform: translate(...)` collapsed onto the same spot the moment
Locomotive's own transform took over.)

**When building any new animation in this repo, check: does the element I'm
about to tween also carry `data-scroll-speed`?** If yes, don't animate
`transform`/`x`/`y`/`scale`/`rotate` on it via GSAP — animate something else
(opacity, filter, a wrapper element instead) or drop the parallax attribute
from that element.

This project doesn't use Webflow's native IX2 interactions at all (this repo's
GSAP components replace that entirely), so IX2 isn't a source of this
conflict here — the risk is specifically GSAP tweens written in this repo.

### Pinning

v4's `data-scroll-sticky` attribute is gone in v5. For a pinned/sticky
element (e.g. an image column that stays put while text scrolls past beside
it — the pattern on svinogradov.art's second section), use native CSS
`position: sticky; top: 0` in the Designer. No script involvement needed.

---

## Tuning

Only one option is currently passed at init, in `src/lib/locomotive.js`:

```js
new LocomotiveScroll({
  initCustomTicker: (render) => gsap.ticker.add(render),
  destroyCustomTicker: (render) => gsap.ticker.remove(render),
});
```

Locomotive forwards most config through `lenisOptions` (`lerp`, `duration`,
`easing`, `orientation`, a custom `wrapper`/`content` pair, etc. — see the
[v5 docs](https://scroll.locomotive.ca/docs/)). None of that is wired up yet;
add it inside that same `new LocomotiveScroll({...})` call if a page needs it.

Per-element parallax is entirely attribute-driven, no JS changes needed to
tune it:

| Attribute | Example | What it does |
|---|---|---|
| `data-scroll` | (empty) | Required — enables viewport detection/parallax on the element. |
| `data-scroll-speed` | `0.3` / `-0.3` | Parallax intensity. Positive lags behind scroll, negative leads it. v5 formula: `translateValue = progress × containerSize × speed × -1` — small numbers go a long way. |
| `data-scroll-enable-touch-speed` | (empty) | Parallax is off on touch devices by default in v5; add this to opt an element back in. |

---

## Local development

```
npm run dev
```

Serves `index.html`, which has `data-smooth-scroll-init` on `<body>` and a
`.parallax-demo` section with two boxes at `data-scroll-speed="0.3"` and
`"-0.3"` — scroll to see them drift apart. Same idea as the tunnel's preview
block: it carries the same `data-*` attributes a real Webflow page would.

```
npm run webflow
```

Same loop as every other component here: rebuilds `dist/` on save, serves it
at `http://localhost:4173/animations.min.js`, and the site's footer script
tag points there once it's added. Save → refresh the published page.

### Two traps (same as tunnel.md)

- **Safari won't load the dev bundle** — `https://` page, `http://localhost`
  script, blocked. Develop in Chrome.
- **Custom code doesn't run in the Designer canvas.** Test against
  `avpn-25-26.webflow.io`, not Designer preview.

---

## How it works

- **GSAP owns the render loop.** `initCustomTicker`/`destroyCustomTicker` hand
  Locomotive's per-frame render to `gsap.ticker` instead of its own
  `requestAnimationFrame`, and `gsap.ticker.lagSmoothing(0)` is set so GSAP
  never skips frames to "catch up" — that would desync the smoothed scroll
  position from ScrollTrigger-driven animations.
- **ScrollTrigger sync.** `locomotiveScroll.lenisInstance.on("scroll",
  ScrollTrigger.update)` — Locomotive v5 exposes the underlying Lenis
  instance as `.lenisInstance`; every Lenis scroll tick forces ScrollTrigger
  to recompute, so `reveal.js`'s scroll-triggered fades stay correctly
  positioned against the lerped (not raw) scroll value.
- **Singleton.** `initLocomotiveScroll()` returns the existing instance on a
  second call rather than creating another one — there's only ever one smooth
  scroll per page.
- **CSS is inlined, not imported as an asset.** Locomotive/Lenis ships one
  line of base CSS (`html.lenis` height/overflow rules). Rather than adding a
  second build output nobody wires into the Webflow embed, it's a string
  constant in `locomotive.js`, injected via a `<style>` tag at init.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Page scrolls natively, no smoothing | `data-smooth-scroll-init` missing from `<body>`. Supported default state, not a bug. |
| `data-scroll-speed` element doesn't move | Missing the sibling `data-scroll` attribute — speed alone does nothing without it. |
| Parallax element snapped into the wrong position, or an IX2 animation on it stopped working | Something else is also setting `transform` on that element — Locomotive's inline transform is winning. Reposition without `transform`. |
| Nothing loads on the live site | Dev server isn't running, you're in Safari, or the site was never published after the footer tag was added. |
| Scroll-triggered reveals fire at the wrong scroll position once Locomotive is on | Check the `ScrollTrigger.update` wiring in `locomotive.js` hasn't been removed or reordered relative to `initReveal()` in `index.js`. |

---

## Cost

Measured by building with and without `locomotive-scroll` imported:

| | Minified | Gzipped |
|---|---|---|
| Without | 639.05 kB | 176.50 kB |
| With | 673.76 kB | 185.53 kB |
| **Delta** | **~34.7 kB** | **~9.0 kB** |

Consistent with Locomotive's own v5 release notes ("reduced to 9.4kB
gzipped" on top of Lenis) — v5 is a thin attribute/effects layer over Lenis,
not a reimplementation of smooth scroll, which is why the addition is small
even though three.js (from the tunnel) dominates the bundle either way.
