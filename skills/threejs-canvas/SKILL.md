# Three.js Canvas

Use this when adding, changing, or shipping a WebGL/canvas component (three.js)
from this repo into the AVPN Webflow site.

## Context

- Same relationship to Webflow as [[webflow-animation-embed]]: Webflow owns
  layout/content, this repo only owns what Webflow can't do natively — here,
  that's anything running on a `<canvas>` via three.js.
- Canvas components live in `src/canvas/`, separate from `src/animations/`
  (GSAP/DOM work), because their lifecycle is different: a render loop and GPU
  resources instead of one-shot tweens.
- Each canvas mounts into an element tagged `data-<component>-init` in the
  Designer, same namespaced-attribute contract as GSAP components.

## Component convention

Follow the same `init<Component>()` shape as [[webflow-animation-embed]] — module
setup once, one function loops over every instance, idempotent re-init guard,
namespaced data attributes, define-then-invoke at the bottom — plus these
canvas-specific rules:

1. **One render loop per instance, not a shared global loop.** Track the
   `requestAnimationFrame` id on the mount element (`container._rafId`) so it can
   be cancelled on teardown; don't rely on a module-level loop that outlives the
   element.

2. **Dispose GPU resources on every re-init and on element removal.** Call
   `.dispose()` on geometries, materials, textures, and the renderer itself before
   rebuilding — WebGL contexts are a finite, page-wide resource and leaking them
   compounds fast on a static site with several canvases.

3. **Pause the render loop when off-screen.** Wrap the mount element in an
   `IntersectionObserver` and stop calling `requestAnimationFrame` while it's not
   visible — canvases are the most expensive thing on the page; don't render what
   nobody sees.

4. **Cap devicePixelRatio.** Use `Math.min(window.devicePixelRatio, 2)` for
   `renderer.setPixelRatio` — uncapped DPR tanks performance on high-density
   displays for no visible gain.

5. **Resize via `ResizeObserver` on the container, not `window.resize`.** Webflow
   layouts reflow independently of viewport width (breakpoints, content changes),
   so watch the actual element's box, not the window.

6. **Handle WebGL context loss.** Listen for `webglcontextlost` /
   `webglcontextrestored` on the canvas and rebuild the scene on restore — losing
   a context (backgrounded tab, GPU driver reset) shouldn't leave a permanently
   blank canvas.

7. **Respect `prefers-reduced-motion`.** If the component is decorative motion
   rather than core content, render a single static frame instead of a continuous
   loop when the user has reduced motion enabled.

## Steps

1. Add a component file in `src/canvas/`, following the convention above, keyed
   off its own `data-<component>-init` attribute.
2. Wire it up in `src/index.js` (import + call its init function).
3. Add a preview block with the matching `data-*` attributes to `index.html`,
   then `npm run dev` for a fast local preview with HMR; `npm run build` for the
   final bundle.
4. Commit the updated `dist/animations.min.js`.
5. In Webflow, add an empty element (usually a `div`) where the canvas should
   mount, tag it `data-<component>-init`, and set explicit width/height (via CSS,
   not JS) so there's no layout shift while three.js initializes.
6. Publish.

## Constraints

- Keep it lean: no react-three-fiber, no scene-graph framework — raw three.js,
  same as raw GSAP for DOM work.
- One canvas component per file, same as GSAP components.
- Never let a canvas component assume it's the only one on the page — multiple
  instances (e.g. several product cards with a mini WebGL preview) must each get
  their own renderer, loop, and disposal.
