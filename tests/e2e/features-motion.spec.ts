import { expect, test, type Page } from "@playwright/test";
import { mount, openLab, settled, snapTo, state } from "./_lab";

const PRESETS = [
  "spring",
  "tween",
  "ios-spring",
  "material-bounce",
  "linear",
  "snappy",
] as const;

const written = (page: Page) =>
  page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("#sheet-0")!;
    const scrim = document.querySelector<HTMLElement>("#scrim-0")!;
    const button = document.querySelector("#before")!.getBoundingClientRect();
    return {
      size: sheet.style.getPropertyValue("--bs-size"),
      progress: sheet.style.getPropertyValue("--bs-progress"),
      backdrop: document.querySelector<HTMLElement>("#backdrop-0")!.style
        .opacity,
      scrim: scrim.style.opacity,
      scrimDisplay: getComputedStyle(scrim).display,
      overPage:
        document.elementFromPoint(button.left + 4, button.top + 4)?.id ?? "",
    };
  });

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

test.describe("animation", () => {
  for (const animation of PRESETS) {
    test(`${animation}: the sheet lands on its snap and leaves exact values`, async ({
      page,
    }) => {
      await mount(page, {
        animation,
        scrimColor: "rgba(0, 0, 0, 0.5)",
        scrimTapToClose: true,
      });

      expect((await snapTo(page, "full")).size).toBe(500);
      expect(await written(page)).toMatchObject({
        size: "500px",
        progress: "1",
        backdrop: "1",
        scrim: "1",
      });

      expect((await snapTo(page, "half")).size).toBe(300);
      expect(await written(page)).toMatchObject({
        size: "300px",
        progress: "0.6",
        backdrop: "0.6",
      });

      await page.evaluate(() => void window.lab.engine().close());
      expect((await settled(page)).size).toBe(0);
      expect(await written(page)).toEqual({
        size: "0px",
        progress: "0",
        backdrop: "0",
        scrim: "0",
        scrimDisplay: "none",
        overPage: "before",
      });
    });
  }

  test("settleAnimation: waapi lands on the same exact values", async ({
    page,
  }) => {
    await mount(page, {
      animation: "spring",
      settleAnimation: "waapi",
      scrimColor: "rgba(0, 0, 0, 0.5)",
      scrimInteractive: true,
    });
    expect((await snapTo(page, "full")).size).toBe(500);
    expect(await written(page)).toMatchObject({ size: "500px", progress: "1" });

    await page.evaluate(() => void window.lab.engine().close());
    await settled(page);
    expect(await written(page)).toMatchObject({
      progress: "0",
      scrimDisplay: "none",
      overPage: "before",
    });
  });

  test("a custom spring lands on its snap", async ({ page }) => {
    await mount(page, {
      animation: "spring",
      spring: { stiffness: 420, damping: 30, mass: 0.8 },
    });
    expect((await snapTo(page, "full")).size).toBe(500);
  });

  test("duration sets how long a tween takes", async ({ page }) => {
    const time = (duration: number) =>
      page.evaluate(async ms => {
        window.lab.mount({ animation: "tween", duration: ms });
        const started = performance.now();
        await window.lab.engine().snapTo("full");
        return performance.now() - started;
      }, duration);

    const slow = await time(500);
    const fast = await time(40);
    expect(slow).toBeGreaterThan(400);
    expect(fast).toBeLessThan(slow / 2);
  });

  test("viewTransitions still lands the sheet on its snap", async ({ page }) => {
    await mount(page, { viewTransitions: true });
    const after = await snapTo(page, "full");
    expect(after.size).toBe(500);
    expect(after.activeId).toBe("full");
  });
});

test.describe("reduced motion", () => {
  const jump = (page: Page, respect: boolean) =>
    page.evaluate(respectReducedMotion => {
      window.lab.mount({
        animation: "tween",
        duration: 400,
        respectReducedMotion,
      });
      void window.lab.engine().snapTo("full");
      const { size, isAnimating } = window.lab.engine().state;
      return { size, isAnimating };
    }, respect);

  test("respectReducedMotion snaps without animating when the user asks for less motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await jump(page, true)).toEqual({ size: 500, isAnimating: false });
    expect((await settled(page)).activeId).toBe("full");
  });

  test("respectReducedMotion: false keeps the animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const moving = await jump(page, false);
    expect(moving.isAnimating).toBe(true);
    expect(moving.size).toBeLessThan(500);
    expect((await settled(page)).size).toBe(500);
  });

  test("without the preference the sheet animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect((await jump(page, true)).isAnimating).toBe(true);
    expect((await settled(page)).size).toBe(500);
    expect((await state(page)).isAnimating).toBe(false);
  });
});
