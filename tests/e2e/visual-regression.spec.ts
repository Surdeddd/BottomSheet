import { expect, test } from "@playwright/test";

/**
 * Visual-regression sweep for the demo page across critical breakpoints.
 *
 * Why this exists:
 *   The demo's hero, adapter row, and device frame are all CSS-driven and
 *   easy to break with a single rule change. Unit tests can't catch
 *   "I shifted the device frame 4px and broke the 320px layout"; a baseline
 *   screenshot can.
 *
 * Breakpoints (defined in playwright.config.ts as separate projects):
 *   - 320  — critical mobile minimum (small Android, old iPhone SE)
 *   - 375  — iPhone standard
 *   - 480  — narrow tablet / phablet
 *   - 720  — wide tablet
 *   - 1280 — desktop
 *
 * States captured per breakpoint:
 *   1. hero        — page top: hero + adapter row visible
 *   2. minimized   — device frame, React adapter active, sheet at minimized snap
 *   3. full        — device frame, React adapter active, sheet snapped to full
 *
 * Flake mitigation:
 *   - We wait for `networkidle` (web fonts) before any screenshot.
 *   - The engine writes `data-animating="true"` on `.bs-root` while the
 *     spring is in flight; we explicitly wait for that flag to clear before
 *     each screenshot so the sheet is captured only once it has settled.
 *   - `animations: "disabled"` is enforced via the Playwright config's
 *     toHaveScreenshot defaults, which freezes CSS animations and caret blink.
 *   - `maxDiffPixelRatio: 0.02` (also from config) tolerates tiny anti-alias
 *     drift across machines/CI.
 */

const REACT_SHEET = `.device-screen[data-screen="react"] .bs-sheet`;
const REACT_ROOT = `.device-screen[data-screen="react"] .bs-root`;
const SNAP_CHIP = (label: string) => `#snap-chips button:has-text("${label}")`;

type SizeRange = "minimized" | "full";

/** Resolves once the engine has stopped animating (data-animating removed). */
const waitForSheetSettled = async (page: import("@playwright/test").Page) => {
  await page.waitForFunction(
    sel => {
      const root = document.querySelector(sel) as HTMLElement | null;
      // No data-animating attribute means the spring has settled.
      return !!root && root.getAttribute("data-animating") !== "true";
    },
    REACT_ROOT,
    { timeout: 5000 },
  );
};

/**
 * Waits for the React adapter sheet's `--bs-size` to fall within the band
 * for a known snap, then waits for the spring to settle. We pass a string
 * tag (not a function) so nothing dynamic gets evaluated in the page.
 */
const waitForSnap = async (
  page: import("@playwright/test").Page,
  range: SizeRange,
) => {
  await page.waitForFunction(
    ({ sel, range }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      const raw = el?.style.getPropertyValue("--bs-size");
      const v = raw ? parseFloat(raw) : NaN;
      if (!Number.isFinite(v)) return false;
      if (range === "minimized") return v > 50 && v < 200;
      if (range === "full") return v > 400;
      return false;
    },
    { sel: REACT_SHEET, range },
    { timeout: 5000 },
  );
  await waitForSheetSettled(page);
};

// Skipped on CI until Linux baseline snapshots are generated and committed.
// Run locally to seed baselines (`npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots`)
// against a Linux runner — macOS-generated PNGs differ in font hinting and
// won't match Ubuntu CI. Re-enable by removing this `skip()` once baselines
// land in `tests/e2e/visual-regression.spec.ts-snapshots/`.
test.skip(!!process.env.CI, "visual-regression baselines not yet generated");

test.describe("Visual regression — demo layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Hero/adapter row + the React mount must be present before we start.
    await page.waitForSelector(REACT_SHEET);
    // Web fonts (Fraunces/Hanken Grotesk/JetBrains Mono via Google Fonts) are
    // stable only after network idle — flake-mitigation #1.
    await page.waitForLoadState("networkidle");
    // The default initial snap is "minimized"; make sure the spring has
    // settled to it before any screenshot.
    await waitForSnap(page, "minimized");
  });

  test("hero + adapter row", async ({ page }) => {
    // Scroll to top deterministically — different breakpoints can land at
    // slightly different scroll positions after font-load reflow.
    await page.evaluate(() => window.scrollTo(0, 0));
    const adapterRow = page.locator(".adapter-row");
    await adapterRow.waitFor({ state: "visible" });

    // Capture exactly the hero + adapter row span (top of doc → bottom of row).
    // Using a clip rect keeps the screenshot independent of the device frame
    // state below.
    const clip = await page.evaluate(() => {
      const hero = document.querySelector(".hero") as HTMLElement | null;
      const row = document.querySelector(".adapter-row") as HTMLElement | null;
      if (!hero || !row) return { x: 0, y: 0, width: 0, height: 0 };
      const heroRect = hero.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const top = Math.max(0, heroRect.top + window.scrollY);
      const bottom = rowRect.bottom + window.scrollY;
      return {
        x: 0,
        y: top,
        width: window.innerWidth,
        height: Math.ceil(bottom - top),
      };
    });

    await expect(page).toHaveScreenshot("hero-and-adapters.png", {
      fullPage: false,
      clip,
    });
  });

  test("device frame — react adapter, minimized snap", async ({ page }) => {
    // Default state is React/minimized; re-click to be sure no stray click
    // leaked from a previous test, then re-confirm settle.
    await page
      .locator('.adapter[data-adapter="react"]')
      .click({ force: true });
    await waitForSnap(page, "minimized");

    const device = page.locator(".device-wrap");
    await device.waitFor({ state: "visible" });
    await expect(device).toHaveScreenshot("device-react-minimized.png");
  });

  test("device frame — react adapter, full snap", async ({ page }) => {
    await page
      .locator('.adapter[data-adapter="react"]')
      .click({ force: true });
    // From the demo's snapPoints, "full" resolves to a size > 400 in bottom mode.
    await page.locator(SNAP_CHIP("full")).click();
    await waitForSnap(page, "full");

    const device = page.locator(".device-wrap");
    await device.waitFor({ state: "visible" });
    await expect(device).toHaveScreenshot("device-react-full.png");
  });
});
