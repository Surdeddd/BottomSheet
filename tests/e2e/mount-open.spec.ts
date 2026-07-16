import { expect, test, type Page } from "@playwright/test";

const readAll = (page: Page) =>
  page.evaluate(() => {
    const s = (c: string): number => {
      const el = document.querySelector(
        `.bs-sheet[data-case="${c}"]`,
      ) as HTMLElement | null;
      return el ? parseFloat(el.style.getPropertyValue("--bs-size")) || 0 : 0;
    };
    return { vh: window.innerHeight, A: s("A"), B: s("B"), C: s("C"), D: s("D"), E: s("E") };
  });

const openCount = (page: Page, c: string) =>
  page.evaluate(cc => {
    const el = document.querySelector(
      `.bs-sheet[data-case="${cc}"]`,
    ) as HTMLElement | null;
    return el ? (el.dataset.openCount ?? null) : null;
  }, c);

test.describe("mount-open: initial-open and sync snapTo land at resolved sizes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/mount-open.html");
    await page.waitForSelector('.bs-sheet[data-case="D"]');
    await page.waitForFunction(
      () => {
        const s = (c: string): number => {
          const el = document.querySelector(
            `.bs-sheet[data-case="${c}"]`,
          ) as HTMLElement | null;
          return el
            ? parseFloat(el.style.getPropertyValue("--bs-size")) || 0
            : 0;
        };
        return (
          s("A") > 300 &&
          s("B") > 250 &&
          s("C") > 300 &&
          s("D") > 300 &&
          s("E") > 300
        );
      },
      null,
      { timeout: 12000 },
    );
  });

  test("A: synchronous snapTo on a fit snap reaches natural size", async ({ page }) => {
    const r = await readAll(page);
    expect(r.A).toBeGreaterThan(300);
    expect(r.A).toBeLessThanOrEqual(r.vh);
  });

  test("B: teleport then snapTo reaches the pixel snap", async ({ page }) => {
    const r = await readAll(page);
    expect(Math.abs(r.B - 300)).toBeLessThan(3);
  });

  test("C: hidden-host percent snap reaches its size after reveal", async ({ page }) => {
    const r = await readAll(page);
    expect(r.C).toBeGreaterThan(0.75 * r.vh);
    expect(r.C).toBeLessThanOrEqual(r.vh + 1);
  });

  test("D: initial-open fit snap heals to natural size and observes the open event", async ({ page }) => {
    const r = await readAll(page);
    expect(r.D).toBeGreaterThan(300);
    expect(Math.abs(r.D - r.A)).toBeLessThan(6);
    expect(await openCount(page, "D")).toBe("1");
  });

  test("E: born-open percent snap reaches its size and stays event-silent", async ({ page }) => {
    const r = await readAll(page);
    expect(r.E).toBeGreaterThan(0.75 * r.vh);
    expect(r.E).toBeLessThanOrEqual(r.vh + 1);
    expect(await openCount(page, "E")).toBe("0");
  });
});
