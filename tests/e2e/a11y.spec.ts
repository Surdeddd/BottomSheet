import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SEVERITY_FILTER = ["moderate", "serious", "critical"] as const;

const formatViolations = (
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
): string => {
  if (violations.length === 0) return "no violations";
  return violations
    .map(v => {
      const nodes = v.nodes
        .slice(0, 3)
        .map(n => `    ${n.target.join(" ")}`)
        .join("\n");
      return `[${v.impact}] ${v.id}: ${v.description}\n  Help: ${v.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
};

const settleMotion = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    const frame = (): Promise<void> =>
      new Promise(r => requestAnimationFrame(() => r()));
    await frame();
    await frame();
    const deadline = performance.now() + 4000;
    for (;;) {
      const clocked = document.getAnimations().filter(a => {
        if (a.playState !== "running") return false;
        if (a.timeline !== document.timeline) return false;
        return a.effect?.getComputedTiming().iterations !== Infinity;
      });
      const left = deadline - performance.now();
      if (clocked.length === 0 || left <= 0) return;
      await Promise.race([
        Promise.allSettled(clocked.map(a => a.finished)),
        new Promise(r => setTimeout(r, left)),
      ]);
      await frame();
    }
  });

const blockingViolations = async (
  builder: AxeBuilder,
): Promise<Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]> => {
  const results = await builder
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.filter(v =>
    SEVERITY_FILTER.includes(v.impact as (typeof SEVERITY_FILTER)[number]),
  );
};

test.describe("a11y — axe-core demo audit", () => {
  test("hero + adapter selector — moderate+ violations = 0", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await settleMotion(page);
    const blocking = await blockingViolations(new AxeBuilder({ page }));
    expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
  });

  test("React adapter at minimized snap — moderate+ violations = 0", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-adapter="react"]');
    await page.waitForSelector(
      '.device-screen[data-screen="react"] .bs-sheet',
    );
    await settleMotion(page);
    const blocking = await blockingViolations(
      new AxeBuilder({ page }).include('.device-screen[data-screen="react"]'),
    );
    expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
  });

  test("React adapter at full snap (focus-trap active) — moderate+ violations = 0", async ({
    page,
  }) => {
    await page.goto("/");
    await page.click('[data-adapter="react"]');
    await page.waitForSelector(
      '.device-screen[data-screen="react"] .bs-sheet',
    );
    await page.click('#snap-chips .chip:has-text("full")');
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLElement>(
          '.device-screen[data-screen="react"] .bs-sheet',
        );
        const v = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
        return v > 400;
      },
      undefined,
      { timeout: 4000 },
    );
    await settleMotion(page);
    const blocking = await blockingViolations(
      new AxeBuilder({ page }).include(
        '.device-screen[data-screen="react"] .bs-sheet',
      ),
    );
    expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
  });

  test("dark theme — moderate+ violations = 0", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await settleMotion(page);
    await page.click("#theme-toggle", { force: true });
    await page.waitForFunction(
      () => document.documentElement.getAttribute("data-theme") === "dark",
      undefined,
      { timeout: 4000 },
    );
    await settleMotion(page);
    const blocking = await blockingViolations(new AxeBuilder({ page }));
    expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
  });
});
