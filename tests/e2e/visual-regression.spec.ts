import { expect, test } from "@playwright/test";

const REACT_SHEET = `.device-screen[data-screen="react"] .bs-sheet`;
const REACT_ROOT = `.device-screen[data-screen="react"] .bs-root`;
const SNAP_CHIP = (label: string) => `#snap-chips button:has-text("${label}")`;

type SizeRange = "minimized" | "full";

const waitForSheetSettled = async (page: import("@playwright/test").Page) => {
  await page.waitForFunction(
    sel => {
      const root = document.querySelector(sel) as HTMLElement | null;
      return !!root && root.getAttribute("data-animating") !== "true";
    },
    REACT_ROOT,
    { timeout: 5000 },
  );
};

const waitForSnap = async (
  page: import("@playwright/test").Page,
  range: SizeRange,
) => {
  await page.waitForFunction(
    ({ sel, range }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      const raw = el?.style.getPropertyValue("--bs-size");
      const v = raw ? parseFloat(raw) : NaN;
      if (!Number.isFinite(v)) return false;
      if (range === "minimized") return v > 50 && v < 200;
      if (range === "full") return v > 400;
      return false;
    },
    { sel: REACT_SHEET, range },
    { timeout: 5000 },
  );
  await waitForSheetSettled(page);
};

test.describe("Visual regression — demo layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(REACT_SHEET);
    await page.waitForLoadState("networkidle");
    await waitForSnap(page, "minimized");
  });

  test("hero + adapter row", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const adapterRow = page.locator(".adapter-row");
    await adapterRow.waitFor({ state: "visible" });

    const clip = await page.evaluate(() => {
      const hero = document.querySelector(".hero") as HTMLElement | null;
      const row = document.querySelector(".adapter-row") as HTMLElement | null;
      if (!hero || !row) return { x: 0, y: 0, width: 0, height: 0 };
      const heroRect = hero.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const top = Math.max(0, heroRect.top + window.scrollY);
      const bottom = rowRect.bottom + window.scrollY;
      return {
        x: 0,
        y: top,
        width: window.innerWidth,
        height: Math.ceil(bottom - top),
      };
    });

    await expect(page).toHaveScreenshot("hero-and-adapters.png", {
      fullPage: false,
      clip,
    });
  });

  test("device frame — react adapter, minimized snap", async ({ page }) => {
    await page
      .locator('.adapter[data-adapter="react"]')
      .click({ force: true });
    await waitForSnap(page, "minimized");

    const device = page.locator(".device-wrap");
    await device.waitFor({ state: "visible" });
    await expect(device).toHaveScreenshot("device-react-minimized.png");
  });

  test("device frame — react adapter, full snap", async ({ page }) => {
    await page
      .locator('.adapter[data-adapter="react"]')
      .click({ force: true });
    await page.locator(SNAP_CHIP("full")).click();
    await waitForSnap(page, "full");

    const device = page.locator(".device-wrap");
    await device.waitFor({ state: "visible" });
    await expect(device).toHaveScreenshot("device-react-full.png");
  });
});
