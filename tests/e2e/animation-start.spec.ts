import { expect, test, type Page } from "@playwright/test";

type Sheets = {
  bsSheets: Record<string, { state: { isAnimating: boolean } }>;
};

const recordSizes = (page: Page, name: string) =>
  page.evaluate(n => {
    const sheet = document.querySelector(
      `.bs-sheet[data-case="${n}"]`,
    ) as HTMLElement;
    const sizes: number[] = [];
    const read = (): number =>
      parseFloat(sheet.style.getPropertyValue("--bs-size"));
    const observer = new MutationObserver(() => sizes.push(read()));
    observer.observe(sheet, { attributes: true, attributeFilter: ["style"] });
    (window as unknown as { __stop: () => number[] }).__stop = () => {
      observer.disconnect();
      return sizes;
    };
    return read();
  }, name);

const stopRecording = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __stop: () => number[] }).__stop(),
  );

const settled = (page: Page, name: string) =>
  expect
    .poll(() =>
      page.evaluate(
        n =>
          !(window as unknown as Sheets).bsSheets[n]!.state.isAnimating,
        name,
      ),
    )
    .toBe(true);

test.describe("an animation started by a tap", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/stacking.html");
    await page.waitForFunction(() => "bsSheets" in window);
  });

  test("a close never lifts the sheet before it falls", async ({ page }) => {
    await page.locator('[data-testid="open-A"]').click();
    await settled(page, "A");
    const start = await recordSizes(page, "A");

    await page.locator('[data-testid="close-A"]').click();
    await settled(page, "A");
    const sizes = await stopRecording(page);

    expect(start).toBeGreaterThan(100);
    expect(sizes.length).toBeGreaterThan(2);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(start + 0.5);
  });

  test("an open never dips below where it started", async ({ page }) => {
    const start = await recordSizes(page, "A");

    await page.locator('[data-testid="open-A"]').click();
    await settled(page, "A");
    const sizes = await stopRecording(page);

    expect(sizes.length).toBeGreaterThan(2);
    expect(Math.min(...sizes.filter(Number.isFinite))).toBeGreaterThanOrEqual(
      (Number.isFinite(start) ? start : 0) - 0.5,
    );
  });
});
