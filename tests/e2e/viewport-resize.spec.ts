import { expect, test } from "@playwright/test";

const sheetSelector = `.device-screen[data-screen="react"] .bs-sheet`;
const chip = (text: string) => `#snap-chips button:has-text("${text}")`;

const readSheetMetrics = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    size: parseFloat(el.style.getPropertyValue("--bs-size")) || 0,
    inlineHeight: el.style.height,
    computedHeight: parseFloat(cs.height) || 0,
    rectHeight: el.getBoundingClientRect().height,
  };
};

test.describe("Viewport resize — address-bar collapse simulation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector(sheetSelector);
  });

  test("expands to full, then grows viewport — size stays valid", async ({
    page,
  }) => {
    await page.click(chip("full"));
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return s > 400;
      },
      sheetSelector,
      { timeout: 4000 },
    );

    const before = await page.evaluate(readSheetMetrics, sheetSelector);
    expect(before).not.toBeNull();
    expect(before!.size).toBeGreaterThan(400);

    await page.setViewportSize({ width: 375, height: 745 });
    await page.waitForTimeout(120);

    const after = await page.evaluate(readSheetMetrics, sheetSelector);
    expect(after).not.toBeNull();
    expect(after!.size).toBeGreaterThan(400);
    expect(after!.rectHeight).toBeLessThanOrEqual(745);
  });

  test("shrinking viewport below active size clamps --bs-size", async ({
    page,
  }) => {
    await page.click(chip("full"));
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return s > 400;
      },
      sheetSelector,
      { timeout: 4000 },
    );

    await page.setViewportSize({ width: 375, height: 360 });
    await page.waitForTimeout(160);

    const metrics = await page.evaluate(readSheetMetrics, sheetSelector);
    expect(metrics).not.toBeNull();
    expect(metrics!.size).toBeLessThanOrEqual(360);
    expect(metrics!.rectHeight).toBeLessThanOrEqual(360);
  });

  test("engine.state.size from public API tracks the clamp", async ({
    page,
  }) => {
    await page.click(chip("full"));
    await page.waitForFunction(
      () => {
        const ro = document.querySelector("#ro-size");
        const v = ro?.textContent ? parseInt(ro.textContent, 10) : 0;
        return v > 400;
      },
      undefined,
      { timeout: 4000 },
    );

    await page.setViewportSize({ width: 375, height: 360 });
    await page.waitForFunction(
      () => {
        const ro = document.querySelector("#ro-size");
        const v = ro?.textContent ? parseInt(ro.textContent, 10) : 9999;
        return v <= 360;
      },
      undefined,
      { timeout: 2000 },
    );

    const reported = await page.evaluate(() => {
      const ro = document.querySelector("#ro-size");
      return ro?.textContent ? parseInt(ro.textContent, 10) : null;
    });
    expect(reported).not.toBeNull();
    expect(reported!).toBeLessThanOrEqual(360);
  });
});
