import { expect, test } from "@playwright/test";

const FIXTURE = "/fixtures/webgl.html";
const SHEET = ".bs-sheet";

test.describe("WebGL renderer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForSelector(SHEET);
  });

  test("mounts a canvas behind the sheet and suppresses its DOM paint", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const canvas = page.locator("canvas");
    await expect(canvas).toHaveCount(1);

    const marked = await page.getAttribute(SHEET, "data-bs-webgl");
    expect(marked).toBe("on");

    const paint = await page.$eval(SHEET, el => {
      const cs = getComputedStyle(el as HTMLElement);
      return { bg: cs.backgroundColor, shadow: cs.boxShadow };
    });
    expect(paint.bg).toBe("rgba(0, 0, 0, 0)");
    expect(paint.shadow).toBe("none");
  });

  test("the canvas covers the viewport and does not take pointer events", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const box = await page.$eval("canvas", el => {
      const c = el as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        pointer: getComputedStyle(c).pointerEvents,
        hidden: c.getAttribute("aria-hidden"),
      };
    });
    const vp = page.viewportSize();
    expect(box.w).toBe(vp?.width);
    expect(box.h).toBe(vp?.height);
    expect(box.pointer).toBe("none");
    expect(box.hidden).toBe("true");
  });

  test("gestures and snapping still work with the renderer on", async ({
    page,
  }) => {
    await page.click("#to-full");
    await page.waitForFunction(() => {
      const el = document.querySelector(".bs-sheet") as HTMLElement | null;
      const v = parseFloat(el?.style.getPropertyValue("--bs-size") ?? "");
      return Number.isFinite(v) && v > 300;
    });

    await page.click("#to-min");
    await page.waitForFunction(() => {
      const el = document.querySelector(".bs-sheet") as HTMLElement | null;
      const v = parseFloat(el?.style.getPropertyValue("--bs-size") ?? "");
      return Number.isFinite(v) && v < 200;
    });
  });

  test("a lost context restores the DOM sheet instead of leaving it blank", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    await page.click("#lose-context");
    await page.waitForFunction(
      () => !document.querySelector(".bs-sheet")?.hasAttribute("data-bs-webgl"),
      undefined,
      { timeout: 5000 },
    );

    const bg = await page.$eval(
      SHEET,
      el => getComputedStyle(el as HTMLElement).backgroundColor,
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("the sheet keeps its accessibility contract under the renderer", async ({
    page,
  }) => {
    await expect(page.locator(`${SHEET}[role="dialog"]`)).toHaveCount(1);
    await expect(page.locator('.bs-handle[role="slider"]')).toHaveCount(1);
    await expect(page.locator('.bs-content[role="region"]')).toHaveCount(1);
    await expect(page.locator(".sheet-body")).toBeVisible();
  });
});
