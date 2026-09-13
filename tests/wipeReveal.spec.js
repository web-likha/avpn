import { test, expect } from "@playwright/test";

const ROOT = '[data-testid="wipe-reveal"]';
const WIPE = `${ROOT} [data-wipe-reveal]`;
const BAND = '.hband[data-hscroll-init]';
const BAND_WIPE = `${BAND} [data-wipe-reveal]`;
const START_CLIP = "inset(100% 0% 0% 0%)";
const END_CLIP = "inset(0% 0% 0% 0%)";

async function loadFixture(page) {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect
    .poll(() => page.locator(WIPE).first().evaluate((image) => Boolean(image._wipeTween)))
    .toBe(true);
}

function normalizeClipPath(clipPath) {
  return clipPath.replace(/\s+/g, "").toLowerCase();
}

async function serializedClipPath(page, clipPath) {
  return page
    .evaluate((value) => {
      const scratch = document.createElement("div");
      scratch.style.clipPath = value;
      return scratch.style.clipPath;
    }, clipPath)
    .then(normalizeClipPath);
}

function clipTopPercent(clipPath) {
  return Number.parseFloat(clipPath.match(/^inset\((-?[\d.]+)%/)?.[1]);
}

test("wipes in from the bottom once and stays revealed on scroll-up", async ({ page }) => {
  await loadFixture(page);

  const image = page.locator(WIPE).first();
  expect(await image.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(800);
  const triggerStart = await image.evaluate((element) => element._wipeTween.scrollTrigger.start);
  const expectedStart = await serializedClipPath(page, START_CLIP);
  const expectedEnd = await serializedClipPath(page, END_CLIP);
  await expect
    .poll(() => image.evaluate((element) => element.style.clipPath).then(normalizeClipPath))
    .toBe(expectedStart);

  // Read the start live: ScrollTrigger.refresh can move it while the page is
  // still growing, and the mid-flight sample needs to land just past it.
  await image.evaluate((element) => {
    window.scrollTo({ top: element._wipeTween.scrollTrigger.start + 2, behavior: "instant" });
  });
  await expect
    .poll(async () => {
      const clipPath = await image.evaluate((element) => element.style.clipPath);
      const top = clipTopPercent(clipPath);
      return Number.isFinite(top) && top > 0 && top < 100;
    })
    .toBe(true);

  await page.evaluate((y) => window.scrollTo({ top: y + 80, behavior: "instant" }), triggerStart);
  await expect
    .poll(() => image.evaluate((element) => element.style.clipPath).then(normalizeClipPath))
    .toBe(expectedEnd);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(100);
  await expect
    .poll(() => image.evaluate((element) => element.style.clipPath).then(normalizeClipPath))
    .toBe(expectedEnd);
});

test("uses data-wipe-trigger position instead of the image position", async ({ page }) => {
  await loadFixture(page);

  const image = page.locator(WIPE).nth(1);
  const result = await image.evaluate((element) => {
    const trigger = element._wipeTween.scrollTrigger;
    const triggerElement = document.querySelector(element.dataset.wipeTrigger);
    return {
      trigger: trigger.vars.trigger === triggerElement,
      imageTop: element.getBoundingClientRect().top,
      triggerTop: triggerElement.getBoundingClientRect().top,
      start: trigger.start,
      imageStart: window.scrollY + element.getBoundingClientRect().top - window.innerHeight * 0.8,
    };
  });

  expect(result.trigger).toBe(true);
  expect(Math.abs(result.imageTop - result.triggerTop)).toBeGreaterThan(1);
  expect(result.start + 40).toBeLessThan(result.imageStart);

  await page.evaluate((y) => window.scrollTo({ top: y + 80, behavior: "instant" }), result.start);
  await expect
    .poll(() => image.evaluate((element) => element.style.clipPath).then(normalizeClipPath))
    .toBe(await serializedClipPath(page, END_CLIP));
});

test("wipes from the bottom while an active band scrolls horizontally", async ({ page }) => {
  await loadFixture(page);
  await expect(page.locator(`${BAND}[data-hscroll-active]`)).toHaveCount(1);

  const image = page.locator(BAND_WIPE);
  const result = await image.evaluate((element) => {
    const trigger = element._wipeTween.scrollTrigger;
    const viewport = element.closest("[data-hscroll-init]").querySelector("[data-hscroll-viewport]");
    return {
      horizontal: trigger.vars.horizontal === true,
      scroller: trigger.scroller === viewport,
      start: trigger.start,
      bandTop: element.closest("[data-hscroll-init]").getBoundingClientRect().top + window.scrollY,
    };
  });

  expect(result.horizontal).toBe(true);
  expect(result.scroller).toBe(true);
  expect(await image.evaluate((element) => element._wipeTween.scrollTrigger.vars.start)).toBe("clamp(left 80%)");
  await expect
    .poll(() => image.evaluate((element) => element.style.clipPath).then(normalizeClipPath))
    .toBe(await serializedClipPath(page, START_CLIP));

  await page.evaluate(
    ({ bandTop, start }) => window.scrollTo({ top: bandTop + start + 80, behavior: "instant" }),
    result,
  );
  await expect
    .poll(() => image.evaluate((element) => element.style.clipPath).then(normalizeClipPath))
    .toBe(await serializedClipPath(page, END_CLIP));
});
