import { expect, test } from "@playwright/test";

const sheetSelector = `.device-screen[data-screen="react"] .bs-sheet`;
const chip = (text: string) => `#snap-chips button:has-text("${text}")`;

const readSize = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  return el ? parseFloat(el.style.getPropertyValue("--bs-size")) : null;
};

test.describe("React BottomSheet", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(sheetSelector);
  });

  test("starts at minimized snap", async ({ page }) => {
    const size = await page.evaluate(readSize, sheetSelector);
    expect(size).toBeGreaterThan(50);
    expect(size).toBeLessThan(200);
  });

  test("snapTo full expands the sheet", async ({ page }) => {
    await page.click(chip("full"));
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return s > 400;
      },
      sheetSelector,
    );
  });

  test("snapTo half lands at intermediate size", async ({ page }) => {
    await page.click(chip("half"));
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return s > 200 && s < 400;
      },
      sheetSelector,
    );
  });

  test.fixme("close brings sheet to size 0", async ({ page }) => {
    await page.click(chip("closed"));
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 999;
        return s === 0;
      },
      sheetSelector,
    );
  });

  test.fixme("Escape closes sheet via closeOnEscape", async ({ page }) => {
    await page.click(chip("half"));
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      sel => {
        const el = document.querySelector(sel) as HTMLElement | null;
        const s = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 999;
        return s === 0;
      },
      sheetSelector,
    );
  });

  test("focusTrap moves focus into the sheet", async ({
    page,
    browserName,
  }) => {
    test.fixme(
      browserName === "webkit",
      "focusTrap activeElement check flaky on WebKit",
    );
    await page.click(chip("half"));
    await page.waitForTimeout(400);
    const isInside = await page.evaluate(sel => {
      const sheet = document.querySelector(sel);
      return sheet?.contains(document.activeElement);
    }, sheetSelector);
    expect(isInside).toBe(true);
  });

  test("live readout 'snap.active' updates after snap", async ({ page }) => {
    await page.click(chip("half"));
    await page.waitForFunction(
      () => document.querySelector("#ro-active")?.textContent?.includes("half"),
      undefined,
      { timeout: 10000 },
    );
  });
});

test.describe("Theme + i18n toggles", () => {
  test("theme toggle switches data-theme attribute", async ({ page }, testInfo) => {
    test.fixme(
      testInfo.project.name === "mobile-safari",
      "TODO: WebKit theme-toggle DOM-attr timing — pre-existing flake",
    );
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.theme);
    const before = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    await page.locator("#theme-toggle").click({ force: true });
    await page.waitForFunction(
      prev => document.documentElement.dataset.theme !== prev,
      before,
      { timeout: 10000 },
    );
    const after = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(after).not.toBe(before);
    expect(["light", "dark"]).toContain(after);
  });

  test("language toggle replaces data-i18n strings", async ({ page }, testInfo) => {
    test.fixme(
      testInfo.project.name === "mobile-safari",
      "TODO: WebKit lang-toggle DOM-replace timing — pre-existing flake",
    );
    await page.goto("/");
    await page.waitForSelector('[data-i18n="ctrl.mode"]');
    const initial = (
      await page.locator('[data-i18n="ctrl.mode"]').textContent()
    )?.trim();
    await page.locator("#lang-toggle").click({ force: true });
    await page.waitForFunction(
      prev =>
        document
          .querySelector('[data-i18n="ctrl.mode"]')
          ?.textContent?.trim() !== prev,
      initial,
      { timeout: 10000 },
    );
    const after = (
      await page.locator('[data-i18n="ctrl.mode"]').textContent()
    )?.trim();
    expect(after).not.toBe(initial);
  });
});
