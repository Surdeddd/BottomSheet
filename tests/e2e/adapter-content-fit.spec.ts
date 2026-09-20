import { expect, test, type Page } from "@playwright/test";

const ADAPTERS = ["react", "vue", "svelte", "solid", "element"] as const;

type Adapter = (typeof ADAPTERS)[number];

type Handles = Record<
  string,
  { open: (id: string) => Promise<void>; close: () => Promise<void> }
>;

const openAt = (page: Page, adapter: Adapter, id: string): Promise<void> =>
  page.evaluate(
    async ([name, snap]) => {
      const handles = (window as unknown as { bsAdapters: Handles }).bsAdapters;
      await handles[name as string]!.open(snap as string);
      await new Promise(r => setTimeout(r, 80));
    },
    [adapter, id],
  );

const measure = (page: Page, adapter: Adapter) =>
  page.evaluate(name => {
    const button = document.querySelector(
      `[data-action="${name}"]`,
    ) as HTMLElement;
    const slotted = button.closest("[slot]") as HTMLElement | null;
    const footer = (button.closest(".bs-footer") ??
      slotted!.assignedSlot!.closest(".bs-footer")) as HTMLElement;
    const sheet = footer.closest(".bs-sheet") as HTMLElement;
    const content = sheet.querySelector(".bs-content") as HTMLElement;
    content.scrollTop = content.scrollHeight;
    const last = document.querySelector(
      `[data-owner="${name}"][data-row="100"]`,
    ) as HTMLElement;
    const rect = footer.getBoundingClientRect();
    return {
      viewport: window.innerHeight,
      marked: sheet.hasAttribute("data-bs-fit-content"),
      footerTop: rect.top,
      footerBottom: rect.bottom,
      footerHeight: rect.height,
      lastRowBottom: last.getBoundingClientRect().bottom,
      scrolled: content.scrollTop,
    };
  }, adapter);

test.describe("fitContentToSnap through every adapter", () => {
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
    test(`${adapter}: the list ends above a footer that rests on the screen edge at half`, async ({
      page,
    }) => {
      await openAt(page, adapter, "half");
      const m = await measure(page, adapter);

      expect(m.marked).toBe(true);
      expect(m.footerHeight).toBeGreaterThan(20);
      expect(Math.abs(m.footerBottom - m.viewport)).toBeLessThan(1.5);
      expect(m.scrolled).toBeGreaterThan(0);
      expect(m.lastRowBottom).toBeLessThanOrEqual(m.footerTop + 1);
      expect(m.footerTop - m.lastRowBottom).toBeLessThan(40);
    });

    test(`${adapter}: the footer button takes a click at half`, async ({
      page,
    }) => {
      await openAt(page, adapter, "half");
      await page.evaluate(name => {
        const button = document.querySelector(
          `[data-action="${name}"]`,
        ) as HTMLElement;
        button.addEventListener("click", () => {
          button.dataset.clicked = "yes";
        });
      }, adapter);

      await page.locator(`[data-action="${adapter}"]`).click();

      expect(
        await page.getAttribute(`[data-action="${adapter}"]`, "data-clicked"),
      ).toBe("yes");
    });
  }
});
