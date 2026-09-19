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

const hitInMaskBand = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight * 0.35,
    );
    if (!el) return "none";
    return el.classList.contains("bs-backdrop") ? "bs-backdrop" : el.tagName;
  });

const press = async (page: Page, testId: string): Promise<void> => {
  await page.locator(`[data-testid="${testId}"]`).click();
  await page.waitForTimeout(360);
};

test.describe.configure({ mode: "serial" });

test.describe("every sheet in a stack owns its backdrop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/stacking.html");
    await page.waitForSelector('.bs-sheet[data-case="A"]', {
      state: "attached",
    });
    await page.waitForTimeout(120);
  });

  test("each open sheet dims with its own backdrop", async ({ page }) => {
    await press(page, "open-A");
    await press(page, "open-B");

    const a = await scrim(page, "A");
    const b = await scrim(page, "B");
    expect(a.opacity).toBeGreaterThan(0.1);
    expect(a.pointerEvents).toBe("auto");
    expect(b.opacity).toBeGreaterThan(0.1);
    expect(b.pointerEvents).toBe("auto");
  });

  test("closing the top sheet never lets the page show through", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");

    const hits = await page.evaluate(async () => {
      const sheets = (window as unknown as {
        bsSheets: Record<string, { close: () => Promise<void> }>;
      }).bsSheets;
      const seen: string[] = [];
      let done = false;
      void sheets.B!.close().then(() => {
        done = true;
      });
      const probe = (): void => {
        const el = document.elementFromPoint(
          window.innerWidth / 2,
          window.innerHeight * 0.35,
        );
        seen.push(
          el && el.classList.contains("bs-backdrop") ? "mask" : "page",
        );
      };
      while (!done) {
        probe();
        await new Promise(r => requestAnimationFrame(r));
      }
      for (let i = 0; i < 6; i++) {
        probe();
        await new Promise(r => requestAnimationFrame(r));
      }
      return seen;
    });

    expect(hits.length).toBeGreaterThan(4);
    expect(hits.filter(h => h === "page")).toEqual([]);
  });

  test("a sheet opened while another is still opening stays on top", async ({
    page,
  }) => {
    const flips = await page.evaluate(async () => {
      const sheets = (window as unknown as {
        bsSheets: Record<string, { open: (id: string) => Promise<void> }>;
      }).bsSheets;
      const zOf = (c: string): number =>
        parseInt(
          (document.querySelector(`.bs-sheet[data-case="${c}"]`) as HTMLElement)
            .style.zIndex,
          10,
        );
      const openingA = sheets.A!.open("half");
      await new Promise(r => setTimeout(r, 60));
      const openingB = sheets.B!.open("half");
      let done = false;
      void Promise.all([openingA, openingB]).then(() => {
        done = true;
      });
      const samples: boolean[] = [];
      while (!done) {
        samples.push(zOf("B") > zOf("A"));
        await new Promise(r => setTimeout(r, 4));
      }
      for (let i = 0; i < 10; i++) {
        samples.push(zOf("B") > zOf("A"));
        await new Promise(r => setTimeout(r, 4));
      }
      return { total: samples.length, wrong: samples.filter(s => !s).length };
    });

    expect(flips.total).toBeGreaterThanOrEqual(10);
    expect(flips.wrong).toBe(0);
  });

  test("the first sheet landing does not cut the second sheet's open short", async ({
    page,
  }) => {
    const run = await page.evaluate(async () => {
      const sheets = (window as unknown as {
        bsSheets: Record<
          string,
          {
            open: (id: string) => Promise<void>;
            state: { size: number; isAnimating: boolean };
          }
        >;
      }).bsSheets;
      const openingA = sheets.A!.open("half");
      await new Promise(r => setTimeout(r, 60));
      const bStarted = performance.now();
      let aLandedAfterBStart = -1;
      let bSizeWhenALanded = -1;
      let bAnimatingWhenALanded = false;
      void openingA.then(async () => {
        aLandedAfterBStart = performance.now() - bStarted;
        await new Promise(r => requestAnimationFrame(() => r(null)));
        await new Promise(r => requestAnimationFrame(() => r(null)));
        bSizeWhenALanded = sheets.B!.state.size;
        bAnimatingWhenALanded = sheets.B!.state.isAnimating;
      });
      await sheets.B!.open("half");
      const bTook = performance.now() - bStarted;
      await openingA;
      return {
        bTook,
        aLandedAfterBStart,
        bSizeWhenALanded,
        bAnimatingWhenALanded,
        bFinal: sheets.B!.state.size,
      };
    });

    expect(run.bTook).toBeGreaterThanOrEqual(150);
    if (run.aLandedAfterBStart >= 0 && run.aLandedAfterBStart < 100) {
      expect(run.bAnimatingWhenALanded).toBe(true);
    }
    expect(run.bFinal).toBeGreaterThan(0);
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
    expect((await scrim(page, "B")).pointerEvents).toBe("auto");
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

    expect(await hitInMaskBand(page)).not.toBe("bs-backdrop");
    await press(page, "counter");
    await expect(page.locator("#controls")).toHaveAttribute("data-clicks", "1");
  });

  test("the sheet below stays dimmed after the top one closes", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "close-B");

    const a = await scrim(page, "A");
    expect(a.opacity).toBeGreaterThan(0.1);
    expect(a.pointerEvents).toBe("auto");
    expect(await hitInMaskBand(page)).toBe("bs-backdrop");
  });

  test("a three-deep stack keeps a live scrim under every sheet", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");
    await press(page, "open-C");

    const all = await Promise.all(
      ["A", "B", "C"].map(name => scrim(page, name)),
    );
    for (const s of all) {
      expect(s.opacity).toBeGreaterThan(0.1);
      expect(s.pointerEvents).toBe("auto");
    }
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
    expect(await hitInMaskBand(page)).not.toBe("bs-backdrop");
    await press(page, "counter");
    await expect(page.locator("#controls")).toHaveAttribute("data-clicks", "1");
  });

  test("escape closes only the top sheet and leaves the one below dimmed", async ({
    page,
  }) => {
    await press(page, "open-A");
    await press(page, "open-B");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    const a = await scrim(page, "A");
    const b = await scrim(page, "B");
    expect(b.pointerEvents).toBe("none");
    expect(a.pointerEvents).toBe("auto");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    expect((await scrim(page, "A")).pointerEvents).toBe("none");
    await press(page, "counter");
    await expect(page.locator("#controls")).toHaveAttribute("data-clicks", "1");
  });

  test("rapid repeated opens of the second sheet keep both scrims and one top", async ({
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
    expect(a.pointerEvents).toBe("auto");
    expect(b.pointerEvents).toBe("auto");
    const zOrder = await page.evaluate(() => {
      const z = (c: string) =>
        parseInt(
          (document.querySelector(`.bs-sheet[data-case="${c}"]`) as HTMLElement)
            .style.zIndex,
          10,
        );
      return z("B") > z("A");
    });
    expect(zOrder).toBe(true);
  });
});
