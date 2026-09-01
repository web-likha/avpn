// One command for developing against the live Webflow site:
// rebuilds dist/ on every save, and serves it as plain static files for
// Webflow's footer <script> tag to load.
//
// Both halves are needed. The build is not optional — three.js and GSAP are npm
// imports, so a browser can't run src/ directly. And the serving has to be
// static: `vite dev` rewrites JS on the way out, which would send Webflow a
// different file than the one that ships.

import { build, preview } from "vite";

const PORT = 4173;

await build({ build: { watch: {} } });

const server = await preview({
  preview: { port: PORT, strictPort: true },
});

const url = `http://localhost:${PORT}/animations.min.js`;
console.log(`\n  Webflow footer script tag:\n\n  <script src="${url}"></script>\n`);
console.log("  Rebuilds on save. Refresh the published Webflow page to see changes.\n");

server.bindCLIShortcuts();
