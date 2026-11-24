import { expect, test, type Page } from "@playwright/test";

const ADAPTERS = ["react", "svelte", "solid"] as const;

type Handles = Record<
  string,
  { open: (id: string) => Promise<unknown>; close: () => Promise<unknown> }
>;

const move = (page: Page, adapter: string, id: string | null): Promise<void> =>
  page.evaluate(
    async ([name, snap]) => {
      const handles = (window as unknown as { bsAdapters: Handles }).bsAdapters;
      if (snap) await handles[name as string]!.open(snap);
      else await handles[name as string]!.close();
    },
    [adapter, id] as const,
  );

const seen = (page: Page, adapter: string) =>
  page.evaluate(name => {
    const shown = (node: Element | null): boolean => {
      if (!node) return false;
      for (let at: Element | null = node; at; at = at.parentElement) {
        const cs = getComputedStyle(at);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        if (parseFloat(cs.opacity) < 0.5) return false;
      }
      return true;
    };
    const anchor = document.querySelector(`[data-anchor="${name}"]`);
    const stage = document.querySelector(`[data-stage="${name}"]`);
    const sheet = (
      document.querySelector(`[data-action="${name}"]`) as HTMLElement
    ).closest(".bs-sheet") as HTMLElement;
    const a = anchor?.getBoundingClientRect();
    const s = sheet.getBoundingClientRect();
    return {
      anchor: shown(anchor),
      stage: shown(stage),
      aboveSheet: a ? Math.round(s.top - a.bottom) : null,
      fromRight: a ? Math.round(s.right - a.right) : null,
    };
  }, adapter);

test.describe("anchors and scrim stages as props", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/adapters-fit.html");
    await page.waitForFunction(
      names =>
        (names as string[]).every(
          n => document.querySelector(`[data-action="${n}"]`) !== null,
        ),
      [...ADAPTERS],
    );
    await page.waitForTimeout(150);
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter}: an anchor rides the sheet on its snaps and a stage shows on its own`, async ({
      page,
    }) => {
      expect((await seen(page, adapter)).anchor).toBe(false);

      await move(page, adapter, "half");
      await expect
        .poll(async () => (await seen(page, adapter)).anchor, { timeout: 5000 })
        .toBe(true);
      const half = await seen(page, adapter);
      expect(half.stage).toBe(false);
      expect(half.aboveSheet).toBeGreaterThanOrEqual(0);
      expect(half.aboveSheet).toBeLessThan(40);
      expect(half.fromRight).toBeGreaterThanOrEqual(0);
      expect(half.fromRight).toBeLessThan(40);

      await move(page, adapter, "full");
      await expect
        .poll(async () => (await seen(page, adapter)).stage, { timeout: 5000 })
        .toBe(true);

      await move(page, adapter, null);
      await expect
        .poll(async () => (await seen(page, adapter)).anchor, { timeout: 5000 })
        .toBe(false);
    });
  }
});
