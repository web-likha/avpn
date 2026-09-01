import { defineConfig } from "vite";

// Production build outputs one self-executing script for Webflow's custom
// code embed. Dev mode (`vite`) ignores this and just serves index.html with
// fast HMR for local preview.
export default defineConfig({
  build: {
    outDir: "dist",
    cssCodeSplit: false,
    lib: {
      entry: "src/index.js",
      formats: ["iife"],
      name: "AVPNAnimations",
      fileName: () => "animations.min.js",
    },
  },
});
