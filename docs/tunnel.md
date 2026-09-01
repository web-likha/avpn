# Tunnel — dev notes

An infinite wireframe corridor the camera flies through, with images tiled onto
the floor, ceiling and walls. WebGL via three.js, in `src/canvas/tunnel.js`.

Currently mounted on the **Home** page inside `.section_hero`.

---

## Webflow setup

Already wired on AVPN 25/26 (site `6a962b118007b0241d50a7a2`):

```
section.section_hero          position:relative · overflow:clip · min-height:100svh
└── div.hero_tunnel           position:absolute · inset 0 · z-index:1
    │                         data-tunnel-init = "true"        ← done
    └── div                   data-tunnel-images = "true"      ← add with the assets
        ├── img  (Webflow asset)
        ├── img
        └── …
```

The mount must be a **`div`, not a `<canvas>`**. The component creates and owns
its own canvas inside the mount. Two reasons this isn't arbitrary:

- Children of a `<canvas>` are fallback content for non-supporting browsers —
  never rendered, and not reliably loaded, so the image manifest inside one would
  never resolve a source.
- On WebGL context loss the component rebuilds by removing its canvas. If that
  canvas were the Webflow-authored node, a GPU reset would delete it from the page.

The mount needs an explicit size in CSS (not JS) so there's no layout shift while
three.js boots, and `position: relative` on it or an ancestor so the hidden image
manifest anchors inside it.

**Attribute values are ignored** — the selectors are `[data-tunnel-init]` and
`[data-tunnel-images]`. Set them to `true` anyway; Webflow's custom-attribute
field wants a value.

### With no images

The corridor renders as bare wireframe. That's a supported state, not a broken
one — the component shipped before the art did. Add the manifest later and the
slabs appear on the next page load, with no code change.

---

## Images

Webflow owns the assets. The script reads each `<img>`'s `currentSrc`, so it
inherits whatever `srcset` variant the browser picked — you get Webflow's
responsive image handling for free.

| | |
|---|---|
| **Aspect ratio** | Any. Textures are cover-fitted (cropped to fill, never stretched). 3:2 or square crop least. |
| **Count** | 8–15. Slabs pick randomly, so under ~6 the repetition is visible. |
| **Size** | ~800–1000px on the long edge. Slabs render small and in perspective; bigger just costs GPU memory. |
| **Composition** | Keep subjects centered — cropping is always from the center. |

Slabs come in two reciprocal shapes: walls are **1.56 landscape** (5.6 × 3.6
world units), floor and ceiling are **0.64 portrait** (3.6 × 5.6). Each texture
is pre-fitted to both at load, so one pool serves every surface.

### Don't style the manifest

The script hides it itself — 1px, `opacity: 0`, `aria-hidden`, and it forces
`loading="eager"`. **Setting `display: none` on it in the Designer breaks the
effect**: a lazily-loaded, undisplayed image never resolves a `currentSrc`, so
you get the wireframe with no slabs and no error.

---

## Tuning

CSS custom properties on the mount. Webflow's style panel can't author these, so
put them in the page's custom code:

```html
<style>
  .hero_tunnel {
    --tunnel-speed: 3.5;
    --tunnel-line-color: #b0b0b0;
  }
</style>
```

| Property | Default | What it does |
|---|---|---|
| `--tunnel-bg` | `transparent` | Background color. Transparent lets the section's own background show through. |
| `--tunnel-line-color` | `#b0b0b0` | Wireframe color. |
| `--tunnel-line-opacity` | `0.5` | Wireframe opacity. |
| `--tunnel-image-opacity` | `0.85` | Slab opacity once faded in. |
| `--tunnel-speed` | `3.5` | World units per second. |
| `--tunnel-fill-rate` | `0.2` | Slab density on floor and walls (0–1). |
| `--tunnel-ceiling-rate` | `0.12` | Ceiling density — deliberately sparser, so the corridor reads as open above. |
| `--tunnel-fov` | `70` | Camera field of view. Higher = wider, more dramatic perspective. |

Corridor dimensions (24 × 16 world units, 6 × 4 grid, 6-deep segments) are **not**
tunables — they're in `src/canvas/tunnel.js` as constants. Changing them changes
what the tunnel is, and shifts the slab aspect ratios with it.

---

## Local development

```
npm run webflow
```

Rebuilds `dist/` on save and serves it at `http://localhost:4173/animations.min.js`.
The Webflow site footer already points there, so the loop is **save → refresh the
published page**. No republish needed for JS changes.

Publish the site **once** after the footer script tag is added; custom code only
reaches the live page on publish.

`npm run dev` is separate — it serves `index.html`, a local stand-in for the
Webflow page with the same `data-*` attributes. Faster for pure visual iteration,
and it works with the dev server off.

### Two traps

- **Safari won't load the dev bundle.** It blocks `http://localhost` from an
  `https://` page where Chrome and Firefox allow it. Nothing in the console makes
  the cause obvious. Develop in Chrome.
- **Custom code doesn't run in the Designer canvas.** Test against
  `avpn-25-26.webflow.io`, not Designer preview.

---

## How it works

- **14 segments** of corridor, each 6 units deep, positioned in a line ahead of
  the camera. As the camera passes one, it's moved to the far end and repopulated
  with a new random slab layout — so the tunnel is endless without allocating.
- **Camera easing.** Position lerps toward the travel target at `0.06`, which
  smooths out frame-rate jitter rather than snapping.
- **Slab placement** never puts two adjacent on the same surface. The gaps are
  what read as a corridor rather than a box.
- **Textures load once** into a pool shared by every slab. Recycling a segment
  disposes its materials and geometries but never the textures — the pool owns
  those, and the instance frees them on teardown.
- **Cover-fit** clones each texture per orientation and shrinks the UV window.
  Clones share their `source`, so three.js uploads the pixels once and refcounts
  them: two orientations cost one texture's memory.

Lifecycle rules it follows (see `skills/threejs-canvas/SKILL.md`): one render
loop per instance, paused off-screen via `IntersectionObserver`; `ResizeObserver`
on the container rather than `window.resize`; DPR capped at 2; full GPU disposal
on teardown; rebuild on `webglcontextrestored`; a single static frame under
`prefers-reduced-motion`.

`initTunnel()` is idempotent — calling it again tears down existing instances
first. A generation token means a slow texture load from an older call can't
resurrect itself over a newer one.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Wireframe renders, no images | Manifest missing, or it's `display: none` (see above), or the images failed CORS. |
| Nothing renders at all | Mount has no height, or the mount is still a `<canvas>` element. |
| Nothing loads on the live site | Dev server isn't running, or you're in Safari, or the site was never published after the footer tag was added. |
| Images look squashed | Shouldn't happen — cover-fit handles any ratio. If it does, check that the source isn't already distorted. |
| Hero content hidden behind the tunnel | `.hero_tunnel` is `z-index: 1`; give content `z-index: 2` or higher. |
| Blank canvas after waking a laptop | WebGL context loss. The component rebuilds on restore; if it didn't, that's a bug worth reporting. |

---

## Cost

The bundle is 638 KB minified / 176 KB gzipped, of which three.js is 525 KB
(132 KB gzipped) — measured by building with and without it.

AVPN is a one-pager, so the page carrying that weight is the page using it. The
site-wide footer tag is the right call here; no need to split the bundle per page.

Worth knowing if the hero ever needs to load faster: three.js is 82% of the
payload, so any real win comes from trimming it (or dropping the effect), not
from optimizing anything in `tunnel.js`.
