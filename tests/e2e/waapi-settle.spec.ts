import { expect, test } from "@playwright/test";

const SHEET = "#waapi-sheet";

const sizeOf = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  return el ? parseFloat(el.style.getPropertyValue("--bs-size")) : NaN;
};

test.describe("WAAPI settle (opt-in)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/waapi.html");

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

  test("a press on the handle mid-settle holds the sheet where it is", async ({
    page,
  }) => {
    await page.click("#snap-half");
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        return el?.dataset.openedAt === "half" && el.getAnimations().length === 0;
      },
      SHEET,
      { timeout: 8000 },
    );

    const r = await page.evaluate(async sel => {
      const sheet = document.querySelector(sel) as HTMLElement;
      const handle = sheet.querySelector(".bs-handle") as HTMLElement;
      const start = sheet.getBoundingClientRect().top;
      (document.querySelector("#snap-full") as HTMLElement).click();
      const deadline = performance.now() + 4000;
      while (
        start - sheet.getBoundingClientRect().top < 20 &&
        performance.now() < deadline
      ) {
        await new Promise(res => requestAnimationFrame(res));
      }
      let before = NaN;
      let running = false;
      document.addEventListener(
        "pointerdown",
        () => {
          before = sheet.getBoundingClientRect().top;
          running = sheet.getAnimations().length > 0;
        },
        { capture: true, once: true },
      );
      const box = handle.getBoundingClientRect();
      const init = {
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        pointerId: 7,
        button: 0,
        pointerType: "mouse",
        bubbles: true,
      };
      handle.dispatchEvent(new PointerEvent("pointerdown", init));
      const after: number[] = [];
      for (let i = 0; i < 3; i++) {
        await new Promise(res =>
          requestAnimationFrame(() => setTimeout(res, 0)),
        );
        after.push(sheet.getBoundingClientRect().top);
      }
      handle.dispatchEvent(new PointerEvent("pointerup", init));
      return { start, before, running, after };
    }, SHEET);

    expect(r.start - r.before).toBeGreaterThan(20);
    expect(r.running).toBe(true);
    for (const top of r.after) {
      expect(top - r.before).toBeLessThan(1.5);
      expect(Math.abs(top - r.after[0]!)).toBeLessThan(0.5);
    }
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
