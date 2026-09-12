import { expect, test, type Page } from "@playwright/test";

type Scrim = { opacity: number; pointerEvents: string };

const scrim = (page: Page, name: string): Promise<Scrim> =>
  page.evaluate(c => {
    const el = document.querySelector(
      `.bs-backdrop[data-case="${c}"]`,
    ) as HTMLElement | null;
    if (!el) return { opacity: -1, pointerEvents: "missing" };
    const cs = getComputedStyle(el);
    return {
      opacity: Number(cs.opacity),
      pointerEvents: cs.pointerEvents,
    };
  }, name);

const topmostAt = (page: Page, x: number, y: number): Promise<string> =>
  page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px as number, py as number);
      if (!el) return "none";
      return (
        (el as HTMLElement).dataset?.testid ?? el.className ?? el.tagName
      );
    },
    [x, y],
  );

const press = async (page: Page, testId: string): Promise<void> => {
  await page.locator(`[data-testid="${testId}"]`).click();
  await page.waitForTimeout(360);
};

test.describe.configure({ mode: "serial" });

test.describe("stacked sheets never strand a backdrop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/stacking.html");
    await page.waitForSelector('.bs-sheet[data-case="A"]', {
      state: "attached",
    });
    await page.waitForTimeout(120);
  });

  test("only the top sheet dims while a stack is open", async ({ page }) => {
    await press(page, "open-A");
    expect((await scrim(page, "A")).opacity).toBeGreaterThan(0.1);

    await press(page, "open-B");

    const a = await scrim(page, "A");
    const b = await scrim(page, "B");
    expect(a.opacity).toBeLessThan(0.05);
    expect(a.pointerEvents).toBe("none");
    expect(b.opacity).toBeGreaterThan(0.1);
    expect(b.pointerEvents).toBe("auto");
  });

  test("closing the buried sheet leaves nothing clickable behind", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "close-A");

    const a = await scrim(page, "A");
    expect(a.opacity).toBeLessThan(0.05);
    expect(a.pointerEvents).toBe("none");
  });

  test("the page is interactive again once the whole stack closes", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "close-A");
    await press(page, "close-B");

    for (const name of ["A", "B"]) {
      const s = await scrim(page, name);
      expect(s.opacity).toBeLessThan(0.05);
      expect(s.pointerEvents).toBe("none");
    }

    expect(await topmostAt(page, 60, 40)).not.toBe("bs-backdrop");
    await press(page, "counter");
    await expect(page.locator("#controls")).toHaveAttribute("data-clicks", "1");
  });

  test("the backdrop follows top status back down the stack", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "close-B");

    const a = await scrim(page, "A");
    expect(a.opacity).toBeGreaterThan(0.1);
    expect(a.pointerEvents).toBe("auto");
  });

  test("a three-deep stack keeps exactly one live scrim", async ({ page }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "open-C");

    const all = await Promise.all(
      ["A", "B", "C"].map(name => scrim(page, name)),
    );
    expect(all.filter(s => s.pointerEvents === "auto")).toHaveLength(1);
    expect(all[2]!.pointerEvents).toBe("auto");
  });

  test("unwinding a three-deep stack out of order clears every scrim", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "open-C");
    await press(page, "close-B");
    await press(page, "close-C");
    await press(page, "close-A");

    for (const name of ["A", "B", "C"]) {
      const s = await scrim(page, name);
      expect(s.opacity).toBeLessThan(0.05);
      expect(s.pointerEvents).toBe("none");
    }
    await press(page, "counter");
    await expect(page.locator("#controls")).toHaveAttribute("data-clicks", "1");
  });

  test("rapid repeated opens of the second sheet settle on one scrim", async ({
    page,
  }) => {
    await press(page, "open-A");
    const openB = page.locator('[data-testid="open-B"]');
    for (let i = 0; i < 6; i++) {
      await openB.dispatchEvent("click");
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);

    const a = await scrim(page, "A");
    const b = await scrim(page, "B");
    expect(a.pointerEvents).toBe("none");
    expect(b.pointerEvents).toBe("auto");
  });
});
