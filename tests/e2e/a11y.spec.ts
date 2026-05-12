import { expect, test } from "@playwright/test";
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

test.describe("a11y — axe-core demo audit", () => {
  test("hero + adapter selector — moderate+ violations = 0", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(v =>
      SEVERITY_FILTER.includes(v.impact as (typeof SEVERITY_FILTER)[number]),
    );
    expect(
      blocking,
      `\n${formatViolations(blocking)}\n`,
    ).toEqual([]);
  });

  test("React adapter at minimized snap — moderate+ violations = 0", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-adapter="react"]');
    await page.waitForSelector(
      '.device-screen[data-screen="react"] .bs-sheet',
    );
    const results = await new AxeBuilder({ page })
      .include('.device-screen[data-screen="react"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(v =>
      SEVERITY_FILTER.includes(v.impact as (typeof SEVERITY_FILTER)[number]),
    );
    expect(
      blocking,
      `\n${formatViolations(blocking)}\n`,
    ).toEqual([]);
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
    const results = await new AxeBuilder({ page })
      .include('.device-screen[data-screen="react"] .bs-sheet')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(v =>
      SEVERITY_FILTER.includes(v.impact as (typeof SEVERITY_FILTER)[number]),
    );
    expect(
      blocking,
      `\n${formatViolations(blocking)}\n`,
    ).toEqual([]);
  });

  test("dark theme — moderate+ violations = 0", async ({ page }) => {
    await page.goto("/");
    await page.click("#theme-toggle", { force: true });
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(v =>
      SEVERITY_FILTER.includes(v.impact as (typeof SEVERITY_FILTER)[number]),
    );
    expect(
      blocking,
      `\n${formatViolations(blocking)}\n`,
    ).toEqual([]);
  });
});
