# Locomotive Scroll — dev notes

Page-wide smooth scroll, built on Lenis, with declarative parallax via
`data-scroll-speed`. Setup lives in `src/lib/locomotive.js`; it's not a
per-instance component like the others, it's global scroll infrastructure
initialized once from `src/index.js`.

Live on the Home page: `<body>` carries `data-smooth-scroll-init`, and the
`section_sticky-picture` section (the CEO's Foreword) uses the crop-box
parallax pattern documented below.

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

## The crop-box parallax pattern

This is the effect on svinogradov.art's second section, and what
`section_sticky-picture` on the Home page uses. Getting it right hinges on one
idea: **the image pans inside a frame that does not move.** Everything meant
to stay still — the frame, a signature overlay, a caption — must live
*outside* the element carrying `data-scroll-speed`.

```
photo-group          static
  photo-holder       static, position:relative — anchors the overlay, NOT clipped
    image-inner      static CROP BOX: fixed aspect-ratio, overflow:hidden, radius
      img            [data-scroll][data-scroll-speed] ← the ONLY moving element
                     position:absolute, height:160%, top:-30%
    signature        position:absolute → anchored to photo-holder
  name-block         static
```

Why each piece:

- **The crop box** (`overflow: hidden` + a fixed `aspect-ratio`) is what makes
  it read as a parallax rather than a floating image. Without it the image
  just slides around and collides with its neighbours.
- **The image must be taller than its box** so there is something to pan into.
  `height: 160%; top: -30%` gives 30% of slack above and below.
- **Overlays anchor to the holder, not the crop box** — an element inside an
  `overflow: hidden` box gets clipped, so a signature that deliberately
  overhangs the photo edge has to be a sibling of the crop box.

### Speed must fit the slack

v5's translate is `progress × containerSize × speed`, where `containerSize` is
the viewport height. So the travel is roughly **`viewportHeight × speed`, in
each direction**, and the image needs at least that much slack or it pans past
its own edge and exposes a gap at the extremes.

| Viewport | speed | travel | slack needed | image height for a ~500px box |
|---|---|---|---|---|
| 1267px | 0.1 | ±127px | 127px each side | 160% (≈150px each side) ✅ |
| 1267px | 0.2 | ±253px | 253px each side | 160% is not enough ❌ |

**To make the drift more pronounced, raise the image height first, not just
the speed.** The current section runs `speed: 0.1` against a 160%-tall image.

### The mistake to avoid

Putting `data-scroll-speed` on a *group* (photo + caption + overlay together)
makes the whole card drift, which then slides over whatever sits below it — in
this section it dragged the photo down over the CEO's name and hid it. The
attribute belongs on the innermost image alone.

---

## Mask reveals (`initSplitReveal`)

The big faint "Our CEO's Foreword" wordmark slides up from behind a mask, the
same way svinogradov.art reveals its year. That site does it in pure CSS — a
clipped wrapper plus an inner line transitioning from `translateY(150%)` to `0`
when a class flips:

```css
.year-period          { overflow: hidden; opacity: 0.1; }
.year-period__section span { transform: translateY(150%);
                             transition: transform .75s cubic-bezier(.33,1,.68,1); }
```

Ours gets the same result from `src/animations/splitReveal.js`, using GSAP
SplitText (which builds the per-line masks itself) driven by ScrollTrigger.
Nothing about the reveal lives in Webflow styles.

```html
<div data-split="heading" data-split-reveal="words" data-split-start="bottom 50%">
  Our CEO's Foreword
</div>
```

| Attribute | Default | Purpose |
|---|---|---|
| `data-split="heading"` | — | Marks the element (required) |
| `data-split-reveal` | `lines` | `lines` \| `words` \| `chars` |
| `data-split-start` | `clamp(top 80%)` | ScrollTrigger start, `"<triggerPoint> <viewportPoint>"` |
| `data-split-trigger` | the element | CSS selector to measure against instead |
| `data-split-opacity` | disabled | `"true"` scrubs split targets to opacity 0 before the section ends |
| `data-split-once` | `true` | `"false"` replays on re-entry |

`clamp()` on the default start stops it resolving above the top of the page,
which would otherwise let the tween render part-finished on load. A bare value
like `bottom 50%` opts out — fine below the fold, keep the clamp near the hero.

`data-split-trigger` exists for this section specifically: the wordmark sits in
a `position: sticky` wrapper, and a sticky element stops moving once pinned, so
its own position is a poor scroll reference. Point the trigger at a stable
ancestor (`.section_sticky-picture`) if a custom start behaves oddly.

### Fading the wordmark out (`initForewordFade`)

The CEO foreword wordmark also needs to fade to nothing before it overlaps the
gradient arc lower in the section — but on its own start/end window, not the
one driving the entrance reveal above. Rather than overload `data-split-opacity`
with a second, independently-tunable range, that fade lives in its own script,
`src/animations/forewordAnim.js`:

```html
<div data-foreword-fade-init data-foreword-fade-trigger=".sticky-picture_photo-group">
  Our CEO's Foreword
</div>
```

| Attribute | Default | Purpose |
|---|---|---|
| `data-foreword-fade-init` | — | Marks the element (required) |
| `data-foreword-fade-trigger` | the element | CSS selector to measure against instead |
| `data-foreword-fade-start` | `top 10%` | ScrollTrigger start, `"<triggerPoint> <viewportPoint>"` |
| `data-foreword-fade-end` | `bottom 80%` | ScrollTrigger end, same syntax |

`scrub: true` ties opacity directly to scroll position each tick, in both
directions — scrolling back up rewinds the fade for free, with no separate
reverse animation to write or run.

### Why ScrollTrigger and not an IntersectionObserver

This was built with a hand-rolled IntersectionObserver first, and it could not
work. **A masked element cannot observe itself.** IntersectionObserver clips the
intersection rect against ancestors' `overflow` *and* `clip-path`, so a line
parked outside its own mask reports `intersectionRatio: 0` despite having a
perfectly real on-screen rect. It never "enters view", the class never lands,
and it never reveals — a permanent deadlock that looks exactly like "the script
didn't run". Swapping `overflow: hidden` for `clip-path` does not dodge it;
Chrome's observer honours `clip-path` too.

ScrollTrigger works off scroll offsets and measured bounds, so clipping is
irrelevant to it. It is also already synced to Lenis in `lib/locomotive.js`,
which a separate observer would not have been.

### Why `gsap.from()` and no hidden CSS state

The resting CSS state is plain visible text; GSAP moves it to the hidden state
at init. If the bundle fails to load, the text sits there unanimated instead of
being stranded invisible behind its mask. That matters here — see the hosting
note in "Local development": the published site currently loads the bundle from
`localhost`, so a failed load is the normal case for anyone but the developer.

Never reintroduce a CSS-hidden start state for a reveal. It converts a missing
bundle from a cosmetic problem into missing content.

### Why not Locomotive's own `is-inview`

Locomotive v5 does add `is-inview`, but only to elements it tracks for an
effect — i.e. ones carrying `data-scroll-speed`. A plain `data-scroll` element
never got the class in testing. And giving a masked line a speed is not a way
out: Locomotive would write an inline `transform` that overwrites the very
transform the reveal depends on.

### Sizing the wordmark to the viewport

The wrapper sets `font-size` in `cqw` against a `container-type: inline-size`
section, so the line scales with the viewport instead of a breakpoint ladder.
`8.4cqw` fills ~96% of the width for this particular string. **That number is
string- and font-specific** — re-measure if the copy changes:

```js
const r = document.createRange();
r.selectNodeContents(document.querySelector('.sticky-picture_bgtext-inner'));
r.getBoundingClientRect().width / window.innerWidth;   // aim for ~0.96
```

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

### Three traps

- **Safari won't load the dev bundle** — `https://` page, `http://localhost`
  script, blocked. Develop in Chrome.
- **Custom code doesn't run in the Designer canvas.** Test against
  `avpn-25-26.webflow.io`, not Designer preview.
- **Don't screenshot immediately after scrolling.** Smooth scroll is lerped,
  so a capture taken right after a scroll shows a mid-animation frame — the
  pinned element looks misplaced and overlays look detached, neither of which
  is real. Wait ~2s for it to settle, and prefer measuring
  `getBoundingClientRect()` offsets over eyeballing a screenshot.

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
| Parallax element snapped into the wrong position, or another animation on it stopped working | Something else is also setting `transform` on that element — Locomotive's inline transform is winning. Reposition without `transform`. |
| Gap / empty edge appears at the extremes of the parallax | The image panned past its own edge: `viewportHeight × speed` exceeds the slack. Increase the image height (more slack) or lower the speed — see "Speed must fit the slack". |
| An overlay (signature, badge, caption) drifts away from the image | It's outside the moving element while the image moves, or vice versa. Only the innermost image should carry `data-scroll-speed`; overlays anchor to the static holder. |
| A caption below the image gets covered by it | `data-scroll-speed` is on a group rather than the image alone, so the whole card drifts downward over its neighbours. |
| Nothing loads on the live site | Dev server isn't running, you're in Safari, or the site was never published after the footer tag was added. |
| Scroll-triggered reveals fire at the wrong scroll position once Locomotive is on | Check the `ScrollTrigger.update` wiring in `locomotive.js` hasn't been removed or reordered relative to `initSplitReveal()` in `index.js`. |

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
