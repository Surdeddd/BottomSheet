import { expect, test } from "@playwright/test";

/**
 * Mobile-Chrome address-bar collapse simulation.
 *
 * On real mobile Chrome the URL bar shrinks while scrolling, which causes
 * `window.innerHeight` to grow by ~78px (iOS Safari is similar). The engine
 * registers a ResizeObserver on documentElement plus a window `resize`
 * fallback (see core/BottomSheetEngine.ts ~L386), and re-clamps `size`
 * against `maxAxisSize` when the viewport changes.
 *
 * Playwright simulates this via `page.setViewportSize`. Pixel 5's default
 * viewport is 393×851 (devicePixelRatio aside); we drive it through the
 * iOS-style 375×667 → 375×745 transition described in the task to keep the
 * test platform-agnostic.
 *
 * What this test verifies:
 *   - After resize the sheet element's inline `height` (which the engine
 *     writes from `maxAxisSize`) stays bounded by the new viewport.
 *   - The active snap's size never exceeds the new `maxAxisSize`.
 *   - Shrinking the viewport below the active snap clamps `--bs-size`.
 *
 * Note on the demo's snap points (`demo/apps/shared.ts`): the bottom-mode
 * snaps are absolute px (110/320/620), not "45dvh" or "%". So we cannot
 * exercise the percentage re-resolution path here — that needs a separate
 * fixture with `size: "45dvh"`. We therefore test the *clamping* path,
 * which is the load-bearing behavior on mobile-Chrome address-bar collapse.
 */

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
    // Wait for spring to settle on the full snap (size > 400 in the demo).
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

    // Address bar collapses → viewport grows by ~78px.
    await page.setViewportSize({ width: 375, height: 745 });
    // Give the ResizeObserver a frame to fire and the engine to recompute.
    await page.waitForTimeout(120);

    const after = await page.evaluate(readSheetMetrics, sheetSelector);
    expect(after).not.toBeNull();
    // Sheet must still be open and not have collapsed.
    expect(after!.size).toBeGreaterThan(400);
    // Sheet height must not exceed the new window height.
    expect(after!.rectHeight).toBeLessThanOrEqual(745);
  });

  test("shrinking viewport below active size clamps --bs-size", async ({
    page,
  }) => {
    // Drive to "full" (620px in the demo's bottom mode), well above the
    // tight viewport we'll resize to.
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

    // Force the viewport smaller than the resolved "full" snap. The engine
    // recomputes maxAxisSize against window.innerHeight on resize and clamps
    // both the sheet's inline height and the live `--bs-size`.
    await page.setViewportSize({ width: 375, height: 360 });
    await page.waitForTimeout(160);

    const metrics = await page.evaluate(readSheetMetrics, sheetSelector);
    expect(metrics).not.toBeNull();
    // The sheet must not exceed the new window height.
    expect(metrics!.size).toBeLessThanOrEqual(360);
    // And the rendered box must not bleed past the viewport.
    expect(metrics!.rectHeight).toBeLessThanOrEqual(360);
  });

  test("engine.state.size from public API tracks the clamp", async ({
    page,
  }) => {
    // The Lit/element wrapper exposes `sheetState`; for the React mount we
    // rely on the live readout (#ro-size) the demo wires up via
    // controller.onUpdate, which forwards engine.state on every tick.
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
    // Wait for the engine to react and the readout to reflect the clamp.
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
