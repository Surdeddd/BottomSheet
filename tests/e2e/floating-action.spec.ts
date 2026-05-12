import { expect, test } from "@playwright/test";

const reactScreen = `.device-screen[data-screen="react"]`;
const sheetSelector = `${reactScreen} .bs-sheet`;
const screenSelector = `${reactScreen} .bs-screen`;
const overlaySelector = `${reactScreen} .bs-root > .bs-scrim-overlay`;
const fabSelector = `${overlaySelector} button.floating-action`;
const floatingToggle = "#tg-scrim-floating";
const cinematicPresetChip = `[data-scrim-preset="cinematic"]`;

test.describe("Floating-action overlay", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(sheetSelector);
    await page.waitForSelector(screenSelector, { state: "attached" });

    await page.locator(cinematicPresetChip).first().click({ force: true });
    await page.locator(`#snap-chips button:has-text("half")`).click();
    await page.waitForFunction(
      sel => document.querySelector(sel)?.getAttribute("data-active") === "half",
      sheetSelector,
      { timeout: 8000 },
    );
  });

  test("no .bs-scrim-overlay exists before the checkbox is clicked", async ({
    page,
  }) => {
    await expect(page.locator(`.bs-scrim-overlay`)).toHaveCount(0);
    await expect(page.locator(floatingToggle)).not.toBeChecked();
  });

  test("checking #tg-scrim-floating injects .floating-action as a sibling of .bs-screen on .bs-root", async ({
    page,
  }) => {
    await page.locator(floatingToggle).check();

    const overlay = page.locator(overlaySelector);
    await expect(overlay).toHaveCount(1);

    await expect(
      page.locator(`${screenSelector} .bs-scrim-overlay`),
    ).toHaveCount(0);

    const fab = page.locator(fabSelector);
    await expect(fab).toHaveCount(1);
    await expect(fab).toBeVisible();
  });

  test("injected button is a real <button type='button'> and is focusable", async ({
    page,
  }) => {
    await page.locator(floatingToggle).check();
    const fab = page.locator(fabSelector);
    await expect(fab).toBeVisible();

    await expect(fab).toHaveAttribute("type", "button");
    const tag = await fab.evaluate(el => el.tagName.toLowerCase());
    expect(tag).toBe("button");

    await expect(fab).not.toHaveAttribute("disabled", "");
    await expect(fab).not.toHaveAttribute("aria-disabled", "true");
  });

  test("clicking the floating button snaps the sheet to 'full'", async ({
    page,
  }) => {
    await page.locator(floatingToggle).check();
    const fab = page.locator(fabSelector);
    await expect(fab).toBeVisible();

    await fab.click();

    await page.waitForFunction(
      sel => document.querySelector(sel)?.getAttribute("data-active") === "full",
      sheetSelector,
      { timeout: 8000 },
    );
    await expect(page.locator(sheetSelector)).toHaveAttribute(
      "data-active",
      "full",
    );
  });

  test("unchecking the toggle removes the .bs-scrim-overlay from the DOM", async ({
    page,
  }) => {
    const toggle = page.locator(floatingToggle);

    await toggle.check();
    await expect(page.locator(overlaySelector)).toHaveCount(1);

    await toggle.uncheck();
    await expect(page.locator(overlaySelector)).toHaveCount(0);
    await expect(page.locator(fabSelector)).toHaveCount(0);
  });
});
