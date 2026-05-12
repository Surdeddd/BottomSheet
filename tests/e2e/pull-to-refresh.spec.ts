import { expect, test } from "@playwright/test";

const reactScreen = `.device-screen[data-screen="react"]`;
const sheetSelector = `${reactScreen} .bs-sheet`;
const handleSelector = `${reactScreen} .bs-handle`;

test.describe("Pull-to-refresh suppression in top mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(sheetSelector);
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
    expect(result!.sheet).toMatch(/contain/);
    expect(result!.content).toMatch(/contain/);
  });

  test("downward drag from handle in top mode does not reload the page", async ({
    page,
  }) => {
    await page.evaluate(() => {
      (window as unknown as { __ptrSentinel?: number }).__ptrSentinel =
        Date.now();
    });
    const sentinelBefore = await page.evaluate(
      () =>
        (window as unknown as { __ptrSentinel?: number }).__ptrSentinel ?? null,
    );
    expect(sentinelBefore).not.toBeNull();

    const handleBox = await page.locator(handleSelector).boundingBox();
    expect(handleBox).not.toBeNull();
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(startX, startY + i * 30, { steps: 2 });
    }
    await page.mouse.up();

    await page.waitForTimeout(500);

    const sentinelAfter = await page.evaluate(
      () =>
        (window as unknown as { __ptrSentinel?: number }).__ptrSentinel ?? null,
    );
    expect(sentinelAfter).toBe(sentinelBefore);

    const navType = await page.evaluate(() => performance.navigation.type);
    expect(navType).toBe(0);

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
