import { expect, test, type Page } from "@playwright/test";

type Sheets = Record<
  string,
  {
    open: (id: string) => Promise<void>;
    snapTo: (id: string) => Promise<void>;
    close: () => Promise<void>;
    state: { size: number };
  }
>;

const openAt = (page: Page, name: string, id: string): Promise<void> =>
  page.evaluate(
    async ([n, snap]) => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      await sheets[n as string]!.open(snap as string);
      await new Promise(r => setTimeout(r, 60));
    },
    [name, id],
  );

const endOfList = (page: Page, name: string) =>
  page.evaluate(n => {
    const content = document.querySelector(
      `.bs-content[data-case="${n}"]`,
    ) as HTMLElement;
    content.scrollTop = content.scrollHeight;
    const last = content.querySelector('[data-row="100"]') as HTMLElement;
    const rect = last.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    return {
      viewport: window.innerHeight,
      lastRowTop: rect.top,
      lastRowBottom: rect.bottom,
      boxBelowViewport: Math.max(0, box.bottom - window.innerHeight),
      inset: parseFloat(
        getComputedStyle(content, "::after").height.replace("px", ""),
      ),
    };
  }, name);

test.describe("fitContentToSnap keeps the whole list reachable", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/content-fit.html");
    await page.waitForSelector('.bs-sheet[data-case="fit"]', {
      state: "attached",
    });
    await page.waitForTimeout(150);
  });

  test("without the option the end of the list is below the screen at half", async ({
    page,
  }) => {
    await openAt(page, "plain", "half");
    const r = await endOfList(page, "plain");

    expect(r.boxBelowViewport).toBeGreaterThan(100);
    expect(r.lastRowBottom).toBeGreaterThan(r.viewport + 50);
  });

  test("with the option the last row scrolls into view at half", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    const r = await endOfList(page, "fit");

    expect(r.lastRowBottom).toBeLessThanOrEqual(r.viewport + 1);
    expect(r.lastRowTop).toBeGreaterThan(r.viewport * 0.5);
  });

  test("the spacer is exactly the part of the sheet that is off screen", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    const half = await endOfList(page, "fit");
    expect(Math.abs(half.inset - half.boxBelowViewport)).toBeLessThan(2);

    await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      await sheets.fit!.snapTo("full");
      await new Promise(r => setTimeout(r, 60));
    });
    const full = await endOfList(page, "fit");
    expect(full.inset).toBeLessThan(1);
    expect(full.lastRowBottom).toBeLessThanOrEqual(full.viewport + 1);
  });

  test("a list pinned to its end stays put on screen while the sheet expands", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    await endOfList(page, "fit");

    const track = await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const last = document.querySelector(
        '.bs-content[data-case="fit"] [data-row="100"]',
      ) as HTMLElement;
      const vh = window.innerHeight;
      const gaps: number[] = [];
      let done = false;
      void sheets.fit!.snapTo("full").then(() => {
        done = true;
      });
      while (!done) {
        gaps.push(vh - last.getBoundingClientRect().bottom);
        await new Promise(r => requestAnimationFrame(r));
      }
      for (let i = 0; i < 6; i++) {
        gaps.push(vh - last.getBoundingClientRect().bottom);
        await new Promise(r => requestAnimationFrame(r));
      }
      return { gaps, worst: Math.max(...gaps.map(Math.abs)) };
    });

    expect(track.gaps.length).toBeGreaterThan(4);
    expect(track.worst).toBeLessThan(48);
  });

  test("a list scrolled to the middle keeps its scroll position across an expand", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    const moved = await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const content = document.querySelector(
        '.bs-content[data-case="fit"]',
      ) as HTMLElement;
      content.scrollTop = 600;
      const before = content.scrollTop;
      await sheets.fit!.snapTo("full");
      await new Promise(r => setTimeout(r, 60));
      return { before, after: content.scrollTop };
    });

    expect(moved.after).toBe(moved.before);
  });

  test("collapsing back to half makes the end reachable again", async ({
    page,
  }) => {
    await openAt(page, "fit", "full");
    await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      await sheets.fit!.snapTo("half");
      await new Promise(r => setTimeout(r, 60));
    });
    const r = await endOfList(page, "fit");

    expect(r.lastRowBottom).toBeLessThanOrEqual(r.viewport + 1);
  });
});
