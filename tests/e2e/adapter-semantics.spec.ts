import { expect, test, type Page } from "@playwright/test";

const ADAPTERS = ["react", "vue", "svelte", "solid", "element"] as const;

const ready = async (page: Page, query: string): Promise<void> => {
  await page.goto(`/fixtures/adapters-fit.html${query}`);
  await page.waitForFunction(
    names =>
      (names as string[]).every(
        n => document.querySelector(`[data-action="${n}"]`) !== null,
      ),
    [...ADAPTERS],
  );
};

const sheetOf = (page: Page, adapter: string) =>
  page.evaluate(name => {
    const button = document.querySelector(
      `[data-action="${name}"]`,
    ) as HTMLElement;
    const slotted = button.closest("[slot]") as HTMLElement | null;
    const sheet = (
      button.closest(".bs-sheet") ?? slotted!.assignedSlot!.closest(".bs-sheet")
    ) as HTMLElement;
    return {
      role: sheet.getAttribute("role"),
      modal: sheet.getAttribute("aria-modal"),
    };
  }, adapter);

type Handles = Record<string, { open: (id: string) => Promise<unknown> }>;

const spoken = (page: Page, adapter: string) =>
  page.evaluate(name => {
    const button = document.querySelector(
      `[data-action="${name}"]`,
    ) as HTMLElement;
    const slotted = button.closest("[slot]") as HTMLElement | null;
    const sheet = (
      button.closest(".bs-sheet") ?? slotted!.assignedSlot!.closest(".bs-sheet")
    ) as HTMLElement;
    const root = sheet.getRootNode() as Document | ShadowRoot;
    const live = (sheet.querySelector('[role="status"]') ??
      root.querySelector('[role="status"]')) as HTMLElement;
    const handle = sheet.querySelector(".bs-handle") as HTMLElement;
    return {
      status: (live.textContent ?? "").trim(),
      slider: handle.getAttribute("aria-valuetext"),
    };
  }, adapter);

const openAt = (page: Page, adapter: string, id: string): Promise<void> =>
  page.evaluate(
    async ([name, snap]) => {
      const handles = (window as unknown as { bsAdapters: Handles }).bsAdapters;
      await handles[name as string]!.open(snap as string);
    },
    [adapter, id],
  );

test.describe("what every adapter tells a screen reader about the snap", () => {
  for (const adapter of ADAPTERS) {
    test(`${adapter}: says the label of a point, and its id when it has none`, async ({
      page,
    }) => {
      await ready(page, "");

      await openAt(page, adapter, "half");
      await expect
        .poll(() => spoken(page, adapter), { timeout: 10_000 })
        .toEqual({ status: "Half open", slider: "Half open" });

      await openAt(page, adapter, "full");
      await expect
        .poll(() => spoken(page, adapter), { timeout: 10_000 })
        .toEqual({ status: "full", slider: "full" });
    });
  }
});

test.describe("the role of the sheet in every adapter", () => {
  for (const adapter of ADAPTERS) {
    test(`${adapter}: a region when it does not trap focus`, async ({
      page,
    }) => {
      await ready(page, "");

      expect(await sheetOf(page, adapter)).toEqual({
        role: "region",
        modal: null,
      });
    });

    test(`${adapter}: a modal dialog when it traps focus`, async ({ page }) => {
      await ready(page, "?trap=1");

      expect(await sheetOf(page, adapter)).toEqual({
        role: "dialog",
        modal: "true",
      });
    });
  }
});
