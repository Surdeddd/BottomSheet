import { expect, test } from "@playwright/test";

/**
 * Pull-to-refresh suppression in `top` mode.
 *
 * In `top` mode the sheet pulls down from the top of the viewport. A user
 * dragging the handle further down at scroll-top would, on real mobile
 * Chrome, trigger the browser's pull-to-refresh gesture and reload the
 * page — losing all in-page state. The library suppresses this via
 * `overscroll-behavior: contain` on `.bs-sheet` and `.bs-content`
 * (see src/styles/bottom-sheet.css ~L61 and L220, mirrored in
 * src/web-component/baseStyles.ts).
 *
 * Playwright cannot reproduce the *real* browser pull-to-refresh gesture
 * because Chromium's headed test runner doesn't drive that UI surface, and
 * `overscroll-behavior` is the only honest way to disable it. So this test
 * proves two things at once:
 *   1. The CSS contract is in place on the elements that matter.
 *   2. After a programmatic downward drag in `top` mode the page does not
 *      navigate / reload — `performance.navigation.type` stays at 0
 *      (TYPE_NAVIGATE; reload would be TYPE_RELOAD = 1) and our injected
 *      sentinel survives.
 *
 * If a future regression breaks the CSS, assertion (1) catches it; if a
 * regression makes the engine swallow the gesture in a way that *does*
 * trigger a reload, the sentinel disappears and assertion (2) catches it.
 */

const reactScreen = `.device-screen[data-screen="react"]`;
const sheetSelector = `${reactScreen} .bs-sheet`;
const handleSelector = `${reactScreen} .bs-handle`;

test.describe("Pull-to-refresh suppression in top mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(sheetSelector);
    // Switch to top mode via the demo's mode chip. This remounts the React
    // adapter, so wait for the new `.bs-sheet` (with data-mode="top") to
    // settle at its initial snap.
    await page.locator(`#mode-chips button[data-mode="top"]`).click();
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return false;
        if (el.dataset.mode !== "top") return false;
        const s = parseFloat(el.style.getPropertyValue("--bs-size")) || 0;
        return s > 0;
      },
      sheetSelector,
      { timeout: 5000 },
    );
  });

  test("`.bs-sheet` and `.bs-content` declare overscroll-behavior: contain", async ({
    page,
  }) => {
    const result = await page.evaluate(
      ({ sheet, screen }) => {
        const sheetEl = document.querySelector(sheet) as HTMLElement | null;
        const contentEl = document.querySelector(
          `${screen} .bs-content`,
        ) as HTMLElement | null;
        if (!sheetEl || !contentEl) return null;
        return {
          sheet: getComputedStyle(sheetEl).overscrollBehavior,
          content: getComputedStyle(contentEl).overscrollBehavior,
        };
      },
      { sheet: sheetSelector, screen: reactScreen },
    );
    expect(result).not.toBeNull();
    // Computed values may collapse to a single keyword when block===inline.
    // "contain" is what the stylesheet sets; browsers may serialize as
    // "contain" or "contain contain". Accept either.
    expect(result!.sheet).toMatch(/contain/);
    expect(result!.content).toMatch(/contain/);
  });

  test("downward drag from handle in top mode does not reload the page", async ({
    page,
  }) => {
    // Plant a sentinel on window. A real reload wipes it; if we still see
    // it after the drag we know no navigation happened.
    await page.evaluate(() => {
      (window as unknown as { __ptrSentinel?: number }).__ptrSentinel =
        Date.now();
    });
    const sentinelBefore = await page.evaluate(
      () =>
        (window as unknown as { __ptrSentinel?: number }).__ptrSentinel ?? null,
    );
    expect(sentinelBefore).not.toBeNull();

    // Read handle center for the drag origin.
    const handleBox = await page.locator(handleSelector).boundingBox();
    expect(handleBox).not.toBeNull();
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;

    // The engine listens to PointerEvents (see core/gestures.ts L45).
    // Playwright's mouse driver synthesizes pointermove/down/up alongside
    // mouse events on Chromium, including with `hasTouch: true` devices,
    // so this is a valid drive path even in mobile-chrome project.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Several incremental moves let the gesture's velocity tracker register
    // a real flick rather than a teleport.
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(startX, startY + i * 30, { steps: 2 });
    }
    await page.mouse.up();

    // Settle: spring needs ~300ms to finish; we wait longer than the demo's
    // animation envelope to ensure no pending state.
    await page.waitForTimeout(500);

    // Sentinel must still be present — i.e. no reload happened.
    const sentinelAfter = await page.evaluate(
      () =>
        (window as unknown as { __ptrSentinel?: number }).__ptrSentinel ?? null,
    );
    expect(sentinelAfter).toBe(sentinelBefore);

    // Belt-and-braces: performance.navigation.type === 0 (TYPE_NAVIGATE).
    // 1 = TYPE_RELOAD, 2 = TYPE_BACK_FORWARD. Deprecated but still
    // populated in Chromium and the most direct refresh signal we have.
    const navType = await page.evaluate(() => performance.navigation.type);
    expect(navType).toBe(0);

    // Sheet must still exist and be visible — top mode shouldn't have
    // closed itself from a downward drag (downward = expand in top mode).
    const sheetVisible = await page
      .locator(sheetSelector)
      .evaluate(el => {
        const s = parseFloat(
          (el as HTMLElement).style.getPropertyValue("--bs-size"),
        );
        return Number.isFinite(s) && s > 0;
      });
    expect(sheetVisible).toBe(true);
  });
});
