import { expect, test } from "@playwright/test";

const SHEET = "#waapi-sheet";

const sizeOf = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  return el ? parseFloat(el.style.getPropertyValue("--bs-size")) : NaN;
};

test.describe("WAAPI settle (opt-in)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/waapi.html");
    // The fixture mounts closed, and closed sheets rest at visibility:hidden.
    await page.waitForSelector(SHEET, { state: "attached" });
  });

  test("snap settles via a real WAAPI animation with coherent vars and events", async ({
    page,
  }) => {
    await page.click("#snap-half");
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return s > 295 && s < 305;
      },
      SHEET,
      { timeout: 8000 },
    );
    await page.waitForFunction(
      sel =>
        (document.querySelector(sel) as HTMLElement | null)?.dataset
          .openedAt === "half",
      SHEET,
      { timeout: 8000 },
    );

    const state = await page.evaluate(sel => {
      const el = document.querySelector(sel) as HTMLElement;
      return {
        waapiSeen: Number(el.dataset.waapiSeen ?? "0"),
        transform: el.style.transform,
        size: parseFloat(el.style.getPropertyValue("--bs-size")),
        progress: el.style.getPropertyValue("--bs-progress"),
        liveAnimations: el.getAnimations().length,
      };
    }, SHEET);

    expect(state.waapiSeen).toBeGreaterThan(0);
    expect(state.liveAnimations).toBe(0);
    expect(state.transform).toContain("translate3d");
    expect(Math.abs(state.size - 300)).toBeLessThan(1);
    expect(parseFloat(state.progress)).toBeGreaterThan(0);
  });

  test("retarget mid-flight and close land correctly", async ({ page }) => {
    await page.click("#snap-half");
    await page.click("#snap-full");
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return s > 350;
      },
      SHEET,
      { timeout: 8000 },
    );

    await page.click("#close");
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el
          ? parseFloat(el.style.getPropertyValue("--bs-size"))
          : 999;
        return Math.abs(s) < 1;
      },
      SHEET,
      { timeout: 8000 },
    );

    await page.waitForFunction(
      sel =>
        (document.querySelector(sel) as HTMLElement).getAnimations().length ===
        0,
      SHEET,
      { timeout: 4000 },
    );
  });
});
