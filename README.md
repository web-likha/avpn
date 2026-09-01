# AVPN — Webflow Animation Scripts

Custom animation code for the AVPN site, built in Webflow by Weblikha. Webflow owns
layout, content, and CMS-free structure; this repo only owns the JS that Webflow's
native Designer/Interactions can't do.

## How it fits together

- Build the page and its native Interactions/styles in Webflow as normal.
- Tag elements that need custom behavior with namespaced `data-<component>-*`
  attributes in the Designer (Element Settings → custom attributes). No classes or
  IDs required.
- The bundled script in `dist/animations.min.js` reads those attributes and drives
  DOM/scroll animation with GSAP, and canvas/WebGL components with three.js.
- Paste the built script into Webflow's site-wide **Footer Code** (or a page's before
  `</body>` custom code) via a `<script>` tag pointing at the hosted file, or paste the
  contents directly if Webflow hosting isn't set up yet.

See `skills/webflow-animation-embed/SKILL.md` for the code convention every
component follows, and `skills/threejs-canvas/SKILL.md` for canvas-specific rules.

## Structure

```
index.html     local preview page (Vite dev only) — never shipped to Webflow
src/
  lib/         shared setup (gsap registration, helpers)
  animations/  DOM/scroll components (GSAP), one file per component
  canvas/      WebGL/canvas components (three.js), one file per component
  index.js     entry point — imports and initializes every component
docs/          per-component dev notes (setup, tuning, troubleshooting)
scripts/       build/serve helpers
dist/          bundled output pasted into Webflow custom code
```

## Component docs

- [`docs/tunnel.md`](docs/tunnel.md) — the hero tunnel canvas: Webflow setup,
  image requirements, tunables, troubleshooting.
- [`docs/locomotive.md`](docs/locomotive.md) — page-wide smooth scroll and
  `data-scroll-speed` parallax: Webflow setup, tuning, troubleshooting.

## Local development

`index.html` stands in for a Webflow page — it carries the same `data-*`
attributes you'd add in the Designer, so components render the same way locally
as they will in production. Add a block for any new component you're building so
it's visible during `npm run dev`.

## Adding a new component

1. Create a new file in `src/animations/` (GSAP) or `src/canvas/` (three.js),
   following the convention in the matching skill doc, keyed off a new
   `data-<component>-init` attribute.
2. Import and call its init function from `src/index.js`.
3. Add a matching block to `index.html` to preview it locally.
4. Run `npm run build` and commit the updated `dist/animations.min.js`.

## Commands

```
npm install
npm run dev     # Vite dev server with HMR at index.html — fast local preview
npm run build   # production build -> dist/animations.min.js
npm run webflow # rebuild on save + serve dist/ for the live Webflow site
```

`npm run webflow` is the Webflow loop: the published site pulls the bundle off
this machine, so a save is live on refresh with no republish. See
`skills/webflow-animation-embed/SKILL.md` for the script tag and its caveats.
