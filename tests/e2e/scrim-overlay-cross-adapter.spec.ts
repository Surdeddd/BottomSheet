import { expect, test } from "@playwright/test";

type AdapterKey =
  | "vanilla"
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "lit"
  | "element";

const ADAPTERS: AdapterKey[] = [
  "vanilla",
  "react",
  "vue",
  "svelte",
  "solid",
  "lit",
  "element",
];

const screenSelector = (a: AdapterKey) =>
  `.device-screen[data-screen="${a}"]`;
const sheetSelector = (a: AdapterKey) => `${screenSelector(a)} .bs-sheet`;
const bsScreenSelector = (a: AdapterKey) => `${screenSelector(a)} .bs-screen`;
const overlaySelector = `.bs-scrim-overlay`;
const fabSelector = `${overlaySelector} button.floating-action`;
const floatingToggle = "#tg-scrim-floating";
const cinematicPresetChip = `[data-scrim-preset="cinematic"]`;

const activate = async (
  page: import("@playwright/test").Page,
  key: AdapterKey,
) => {
  await page.locator(`.adapter[data-adapter="${key}"]`).click({ force: true });
  await page.waitForFunction(
    adapter => {
      const screen = document.querySelector(
        `.device-screen[data-screen="${adapter}"]`,
      );
      if (!screen || screen.hasAttribute("hidden")) return false;
      let sheet = screen.querySelector(".bs-sheet") as HTMLElement | null;
      if (!sheet) {
        for (const el of Array.from(screen.querySelectorAll("*"))) {
          const s = (el as HTMLElement).shadowRoot?.querySelector(".bs-sheet");
          if (s) {
            sheet = s as HTMLElement;
            break;
          }
        }
      }
      if (!sheet) return false;
      const raw = sheet.style.getPropertyValue("--bs-size");
      return raw ? parseFloat(raw) > 0 : false;
    },
    key,
    { timeout: 40_000 },
  );
};

const clickSnap = async (
  page: import("@playwright/test").Page,
  label: "minimized" | "half" | "full" | "closed",
) => {
  await page.locator(`#snap-chips button:has-text("${label}")`).click();
};

const waitForSnap = async (
  page: import("@playwright/test").Page,
  adapter: AdapterKey,
  snap: string,
) => {
  await page.waitForFunction(
    ({ adapter, snap }) => {
      const screen = document.querySelector(
        `.device-screen[data-screen="${adapter}"]`,
      );
      if (!screen) return false;
      let sheet = screen.querySelector(".bs-sheet");
      if (!sheet) {
        for (const el of Array.from(screen.querySelectorAll("*"))) {
          const s = (el as HTMLElement).shadowRoot?.querySelector(".bs-sheet");
          if (s) {
            sheet = s;
            break;
          }
        }
      }
      return sheet?.getAttribute("data-active") === snap;
    },
    { adapter, snap },
    { timeout: 8000 },
  );
};

test.describe("Scrim overlay (FAB) — cross-adapter", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(sheetSelector("react"));
    await page.waitForSelector(bsScreenSelector("react"), { state: "attached" });
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter}: FAB renders inside .bs-root, NOT inside .bs-screen`, async ({
      page,
    }, testInfo) => {
      await activate(page, adapter);
      await page.locator(cinematicPresetChip).first().click({ force: true });
      await clickSnap(page, "half");
      await waitForSnap(page, adapter, "half");

      await page.locator(floatingToggle).check();

      await expect(page.locator(overlaySelector)).toHaveCount(1);

      const parents = await page.evaluate(() => {
        let overlay = document.querySelector(".bs-scrim-overlay");
        if (!overlay) {
          for (const host of Array.from(document.querySelectorAll("*"))) {
            const o = (host as HTMLElement).shadowRoot?.querySelector(
              ".bs-scrim-overlay",
            );
            if (o) {
              overlay = o;
              break;
            }
          }
        }
        if (!overlay || !overlay.parentElement) return null;
        return {
          isBsRoot: overlay.parentElement.classList.contains("bs-root"),
          isBsScreen: overlay.parentElement.classList.contains("bs-screen"),
          parentClass: overlay.parentElement.className,
        };
      });
      expect(parents).not.toBeNull();
      expect(parents!.isBsRoot, `parent classes: ${parents!.parentClass}`).toBe(
        true,
      );
      expect(parents!.isBsScreen).toBe(false);
    });

    test(`${adapter}: FAB stays at full opacity while scrim dims`, async ({
      page,
    }, testInfo) => {
      await activate(page, adapter);
      await page.locator(cinematicPresetChip).first().click({ force: true });
      await page.locator(floatingToggle).check();
      await clickSnap(page, "half");
      await waitForSnap(page, adapter, "half");

      await expect(page.locator(overlaySelector)).toHaveCount(1);
      const fab = page.locator(fabSelector);
      await expect(fab).toBeVisible();

      const fabOpacity = await fab.evaluate(
        el => getComputedStyle(el as HTMLElement).opacity,
      );
      expect(parseFloat(fabOpacity)).toBeGreaterThan(0.95);

      await page.waitForFunction(
        sel => {
          const screen = document.querySelector(
            `.device-screen[data-screen="${sel}"]`,
          );
          if (!screen) return false;
          let el = screen.querySelector(".bs-screen");
          if (!el) {
            for (const host of Array.from(screen.querySelectorAll("*"))) {
              const s = (host as HTMLElement).shadowRoot?.querySelector(
                ".bs-screen",
              );
              if (s) {
                el = s;
                break;
              }
            }
          }
          if (!el) return false;
          return parseFloat(getComputedStyle(el as HTMLElement).opacity) > 0.15;
        },
        adapter,
        { timeout: 4000 },
      );
      const scrimOpacity = await page
        .locator(bsScreenSelector(adapter))
        .evaluate(el => getComputedStyle(el as HTMLElement).opacity);
      expect(parseFloat(scrimOpacity)).toBeGreaterThan(0.15);
    });

    test(`${adapter}: FAB rides the sheet (sheet-top-right anchored to --bs-size)`, async ({
      page,
    }, testInfo) => {
      await activate(page, adapter);
      await page.locator(cinematicPresetChip).first().click({ force: true });
      await page.locator(floatingToggle).check();

      await clickSnap(page, "minimized");
      await waitForSnap(page, adapter, "minimized");
      await page.waitForFunction(
        sel => {
          const screen = document.querySelector(
            `.device-screen[data-screen="${sel}"]`,
          );
          let el = (screen?.querySelector(".bs-sheet") ?? null) as HTMLElement | null;
          if (!el && screen) {
            for (const host of Array.from(screen.querySelectorAll("*"))) {
              const s = (host as HTMLElement).shadowRoot?.querySelector(".bs-sheet");
              if (s) {
                el = s as HTMLElement;
                break;
              }
            }
          }
          const raw = el?.style.getPropertyValue("--bs-size");
          return raw ? parseFloat(raw) > 50 && parseFloat(raw) < 200 : false;
        },
        adapter,
        { timeout: 8000 },
      );
      await expect(page.locator(fabSelector)).toBeVisible();
      const topMin = await page
        .locator(fabSelector)
        .evaluate(el => (el as HTMLElement).getBoundingClientRect().top);

      await clickSnap(page, "full");
      await waitForSnap(page, adapter, "full");
      await page.waitForFunction(
        sel => {
          const screen = document.querySelector(
            `.device-screen[data-screen="${sel}"]`,
          );
          let el = (screen?.querySelector(".bs-sheet") ?? null) as HTMLElement | null;
          if (!el && screen) {
            for (const host of Array.from(screen.querySelectorAll("*"))) {
              const s = (host as HTMLElement).shadowRoot?.querySelector(".bs-sheet");
              if (s) {
                el = s as HTMLElement;
                break;
              }
            }
          }
          const raw = el?.style.getPropertyValue("--bs-size");
          return raw ? parseFloat(raw) > 400 : false;
        },
        adapter,
        { timeout: 8000 },
      );
      const topFull = await page
        .locator(fabSelector)
        .evaluate(el => (el as HTMLElement).getBoundingClientRect().top);

      expect(
        topFull,
        `FAB top should move up: minimized=${topMin}, full=${topFull}`,
      ).toBeLessThan(topMin - 100);
    });

    test(`${adapter}: FAB renders above the sheet (z-index > sheet)`, async ({
      page,
    }, testInfo) => {
      await activate(page, adapter);
      await page.locator(cinematicPresetChip).first().click({ force: true });
      await page.locator(floatingToggle).check();
      await clickSnap(page, "half");
      await waitForSnap(page, adapter, "half");

      await expect(page.locator(overlaySelector)).toHaveCount(1);

      const overlayZ = await page
        .locator(overlaySelector)
        .evaluate(el => getComputedStyle(el as HTMLElement).zIndex);
      const sheetZ = await page
        .locator(sheetSelector(adapter))
        .evaluate(el => getComputedStyle(el as HTMLElement).zIndex);

      const overlayN = parseInt(overlayZ, 10);
      const sheetN = parseInt(sheetZ, 10);
      expect(
        Number.isFinite(overlayN),
        `overlay z-index must resolve to a number, got ${overlayZ}`,
      ).toBe(true);
      expect(
        Number.isFinite(sheetN),
        `sheet z-index must resolve to a number, got ${sheetZ}`,
      ).toBe(true);
      expect(overlayN).toBeGreaterThan(sheetN);
    });

    test(`${adapter}: unchecking the floating toggle removes overlay from DOM`, async ({
      page,
    }, testInfo) => {
      await activate(page, adapter);
      await page.locator(cinematicPresetChip).first().click({ force: true });
      await clickSnap(page, "half");
      await waitForSnap(page, adapter, "half");

      const toggle = page.locator(floatingToggle);
      await toggle.check();
      await expect(page.locator(overlaySelector)).toHaveCount(1);

      await toggle.uncheck();
      await expect(page.locator(overlaySelector)).toHaveCount(0);
      await expect(page.locator(fabSelector)).toHaveCount(0);
    });
  }
});
