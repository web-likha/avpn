import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const BUNDLE_PATH = fileURLToPath(new URL("../../dist/animations.min.js", import.meta.url));
const SETTLE_TOLERANCE = 8;
const GEOMETRY_TOLERANCE = 2;
const LAZY_IMAGE_DELAY = 1200;

function expectWithin(actual, expected, tolerance = GEOMETRY_TOLERANCE) {
  expect(
    Math.abs(actual - expected),
    `expected ${actual} to be within ${tolerance}px of ${expected}`,
  ).toBeLessThanOrEqual(tolerance);
}

async function settledScrollY(page) {
  let previous = Number.NaN;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await page.evaluate(() => window.scrollY);
    if (Math.abs(current - previous) < 0.5) return current;
    previous = current;
    await page.waitForTimeout(80);
  }

  return page.evaluate(() => window.scrollY);
}

async function scrollTo(page, target) {
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width / 2, viewport.height / 2);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = await settledScrollY(page);
    const remaining = target - current;
    if (Math.abs(remaining) <= SETTLE_TOLERANCE) return current;
    await page.mouse.wheel(0, Math.sign(remaining) * Math.min(Math.abs(remaining), 500));
  }

  throw new Error(`could not settle the page at scrollY ${target}`);
}

function readForewordState(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector("[data-foreword-fade-init]");
    const arc = document.querySelector(".sticky-picture_arc");
    const content = document.querySelector(".sticky-picture_content");
    const triggers = wrap?._forewordFadeTriggers ?? [];
    const wrapRect = wrap.getBoundingClientRect();
    const arcRect = arc.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();

    return {
      opacity: Number(getComputedStyle(wrap).opacity),
      pinnedTop: parseFloat(getComputedStyle(wrap).top),
      triggerCount: triggers.length,
      revealStart: triggers[0]?.start,
      revealEnd: triggers[0]?.end,
      fadeStart: triggers[1]?.start,
      fadeEnd: triggers[1]?.end,
      coversWordmark: arcRect.bottom > wrapRect.top,
      arcToWordmarkGap: arcRect.bottom - wrapRect.top,
      wrapHeight: wrapRect.height,
      arcOffsetTop: arcRect.top + window.scrollY,
      arcHeight: arcRect.height,
      contentOffsetTop: contentRect.top + window.scrollY,
      contentHeight: contentRect.height,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
    };
  });
}

test.beforeEach(async ({ page }) => {
  expect(existsSync(BUNDLE_PATH), `no bundle at ${BUNDLE_PATH} — run \`npm run build\``).toBe(true);

  let served = 0;
  await page.route("**/animations.min.js", async (route) => {
    served += 1;
    await route.fulfill({ path: BUNDLE_PATH, contentType: "application/javascript" });
  });

  await page.route(/\.(png|jpe?g|webp|avif|gif)(\?|$)/i, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, LAZY_IMAGE_DELAY));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect
    .poll(() => page.evaluate(() => Boolean(document.querySelector("[data-foreword-fade-init]")?._forewordFadeTriggers)))
    .toBe(true);

  expect(served, "the published page should still request animations.min.js").toBeGreaterThan(0);
});

test("wires both stages to the arc and the text column", async ({ page }) => {
  await scrollTo(page, 2500);
  const state = await readForewordState(page);

  const arcBottomInPage = state.arcOffsetTop + state.arcHeight;

  expect(state.triggerCount).toBe(2);
  expect(state.revealEnd).toBe(state.fadeStart);

  expectWithin(state.revealStart, arcBottomInPage - (state.pinnedTop + state.wrapHeight));
  expectWithin(state.revealEnd, arcBottomInPage - state.pinnedTop);
});

test("measures the fade against the fully loaded text column", async ({ page }) => {
  await scrollTo(page, 2500);
  const state = await readForewordState(page);

  expectWithin(
    state.fadeEnd,
    state.contentOffsetTop + state.contentHeight - 0.8 * state.viewportHeight,
  );
});

test("runs the wordmark from hidden to full to gone on the way down", async ({ page }) => {
  const bounds = await readForewordState(page);

  await scrollTo(page, bounds.revealStart - 150);
  const covered = await readForewordState(page);
  expect(covered.coversWordmark).toBe(true);
  expect(covered.opacity).toBeLessThan(0.01);

  await scrollTo(page, covered.revealEnd);
  const handoff = await readForewordState(page);
  expect(Math.abs(handoff.arcToWordmarkGap)).toBeLessThan(20);
  expect(handoff.opacity).toBeGreaterThan(0.9);

  const { fadeEnd } = await readForewordState(page);
  await scrollTo(page, fadeEnd);
  const finished = await readForewordState(page);
  expect(finished.opacity).toBeLessThan(0.05);
});

test("does not re-show the wordmark when scrolling back under the arc", async ({ page }) => {
  const bounds = await readForewordState(page);

  await scrollTo(page, bounds.revealStart - 150);
  const { fadeEnd } = await readForewordState(page);
  await scrollTo(page, fadeEnd);
  expect((await readForewordState(page)).opacity).toBeLessThan(0.05);

  await scrollTo(page, bounds.revealStart - 150);
  const back = await readForewordState(page);
  expect(back.coversWordmark).toBe(true);
  expect(back.opacity).toBeLessThan(0.01);
});
