import { expect, test, type Page } from "@playwright/test";

type SheetOptions = {
  closeOnBack?: boolean;
  routedTo?: string;
  closeOnRouteChange?: boolean;
  persistent?: boolean;
  duration?: number;
  initial?: string;
};

type FixtureApi = {
  create: (name: string, options?: SheetOptions) => void;
  open: (name: string) => Promise<void>;
  close: (name: string) => Promise<void>;
  destroy: (name: string) => void;
  isOpen: (name: string) => boolean;
  settled: () => Promise<void>;
};

declare global {
  interface Window {
    bsHistory: FixtureApi;
  }
}

const SETTLE_MS = 350;

const create = (
  page: Page,
  name: string,
  options: SheetOptions = { closeOnBack: true },
): Promise<void> =>
  page.evaluate(([n, o]) => window.bsHistory.create(n, o), [
    name,
    options,
  ] as const);

const open = (page: Page, name: string): Promise<void> =>
  page.evaluate(n => window.bsHistory.open(n), name);

const close = (page: Page, name: string): Promise<void> =>
  page.evaluate(n => window.bsHistory.close(n), name);

const isOpen = (page: Page, name: string): Promise<boolean> =>
  page.evaluate(n => window.bsHistory.isOpen(n), name);

const entry = (page: Page): Promise<Record<string, unknown>> =>
  page.evaluate(() => ({ ...(history.state ?? {}) }));

const address = (page: Page): Promise<{ search: string; hash: string }> =>
  page.evaluate(() => ({ search: location.search, hash: location.hash }));

const settle = async (page: Page): Promise<void> => {
  await page.evaluate(() => window.bsHistory.settled());
  await page.waitForTimeout(SETTLE_MS);
};

const back = async (page: Page): Promise<void> => {
  await page.goBack();
  await settle(page);
};

test.describe("sheets and the browser history", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/history.html");
    await page.waitForFunction(() => "bsHistory" in window);
  });

  test("the sheet's entry keeps what the router stored in the page's entry", async ({
    page,
  }) => {
    await page.evaluate(() =>
      history.replaceState(
        { back: null, current: location.pathname, position: 3 },
        "",
      ),
    );
    await create(page, "a");
    await open(page, "a");

    const marker = await entry(page);
    expect(marker.__bs).toBe(true);
    expect(marker.current).toBe("/fixtures/history.html");
    expect(marker.position).toBe(3);

    await close(page, "a");
    await settle(page);
    const base = await entry(page);
    expect(base.__bs).toBeUndefined();
    expect(base.current).toBe("/fixtures/history.html");
    expect(base.position).toBe(3);
  });

  test("Back closes the sheet and stays on the page", async ({ page }) => {
    await create(page, "a");
    await open(page, "a");
    await back(page);

    expect(await isOpen(page, "a")).toBe(false);
    expect(page.url()).toContain("/fixtures/history.html");
    expect((await entry(page)).__bs).toBeUndefined();
  });

  test("one Back closes only the upper of two sheets", async ({ page }) => {
    await create(page, "lower");
    await create(page, "upper");
    await open(page, "lower");
    await open(page, "upper");

    await back(page);
    expect(await isOpen(page, "upper")).toBe(false);
    expect(await isOpen(page, "lower")).toBe(true);

    await back(page);
    expect(await isOpen(page, "lower")).toBe(false);
    expect(page.url()).toContain("/fixtures/history.html");
  });

  test("closing a sheet never undoes a navigation the app made over it", async ({
    page,
  }) => {
    await create(page, "a");
    await open(page, "a");
    await page.evaluate(() => history.pushState({ app: 1 }, "", "?next=1"));
    await close(page, "a");
    await settle(page);

    expect((await address(page)).search).toBe("?next=1");
    expect((await entry(page)).app).toBe(1);

    await back(page);
    expect((await address(page)).search).toBe("");
    expect((await entry(page)).__bs).toBeUndefined();
    expect(page.url()).toContain("/fixtures/history.html");
  });

  test("destroying a sheet never undoes a navigation the app made over it", async ({
    page,
  }) => {
    await create(page, "a");
    await open(page, "a");
    await page.evaluate(() => history.pushState({ app: 1 }, "", "?next=1"));
    await page.evaluate(() => window.bsHistory.destroy("a"));
    await settle(page);

    expect((await address(page)).search).toBe("?next=1");
    expect((await entry(page)).app).toBe(1);
  });

  test("a navigation made right after an awaited close survives", async ({
    page,
  }) => {
    await create(page, "a", { closeOnBack: true, duration: 0 });
    await open(page, "a");
    await page.evaluate(async () => {
      await window.bsHistory.close("a");
      history.pushState({ app: 1 }, "", "?after=1");
    });
    await page.waitForTimeout(600);

    expect((await address(page)).search).toBe("?after=1");
    expect((await entry(page)).app).toBe(1);
  });

  test("a hash link inside the sheet keeps it open and leaves no dead Back press", async ({
    page,
  }) => {
    await create(page, "a");
    await open(page, "a");
    await page.locator('[data-testid="hash-a"]').click();
    await page.waitForTimeout(SETTLE_MS);

    expect(await isOpen(page, "a")).toBe(true);
    expect((await address(page)).hash).toBe("#details");

    await close(page, "a");
    await settle(page);
    expect((await address(page)).hash).toBe("#details");

    await back(page);
    expect((await address(page)).hash).toBe("");
    expect((await entry(page)).__bs).toBeUndefined();
    expect(page.url()).toContain("/fixtures/history.html");
  });

  test("a routed sheet keeps its address when the sheet under it closes", async ({
    page,
  }) => {
    await create(page, "lower");
    await create(page, "upper", { closeOnBack: true, routedTo: "?sheet=up" });
    await open(page, "lower");
    await open(page, "upper");
    expect((await address(page)).search).toBe("?sheet=up");

    await close(page, "lower");
    await settle(page);
    expect(await isOpen(page, "upper")).toBe(true);
    expect((await address(page)).search).toBe("?sheet=up");

    await back(page);
    expect(await isOpen(page, "upper")).toBe(false);
    expect((await address(page)).search).toBe("");
  });

  test("closeOnRouteChange ignores a History API call that keeps the address", async ({
    page,
  }) => {
    await create(page, "r", { closeOnRouteChange: true });
    await open(page, "r");
    await page.evaluate(() =>
      history.replaceState({ scroll: 120 }, "", location.href),
    );
    await page.waitForTimeout(SETTLE_MS);
    expect(await isOpen(page, "r")).toBe(true);

    await page.evaluate(() => history.pushState(null, "", "?other=1"));
    await page.waitForTimeout(SETTLE_MS);
    expect(await isOpen(page, "r")).toBe(false);
  });

  test("a persistent sheet survives Back and gets its entry back", async ({
    page,
  }) => {
    await create(page, "p", { closeOnBack: true, persistent: true });
    await open(page, "p");
    await back(page);

    expect(await isOpen(page, "p")).toBe(true);
    expect((await entry(page)).__bs).toBe(true);
    expect(page.url()).toContain("/fixtures/history.html");
  });

  test("a sheet reopened in the tick it was closed still closes on Back", async ({
    page,
  }) => {
    await create(page, "a");
    await open(page, "a");
    await page.evaluate(() => {
      void window.bsHistory.close("a");
      void window.bsHistory.open("a");
    });
    await settle(page);

    expect(await isOpen(page, "a")).toBe(true);
    expect((await entry(page)).__bs).toBe(true);

    await back(page);
    expect(await isOpen(page, "a")).toBe(false);
    expect((await entry(page)).__bs).toBeUndefined();
    expect(page.url()).toContain("/fixtures/history.html");
  });

  test("two sheets closed in one tick leave the history on the page's own entry", async ({
    page,
  }) => {
    await create(page, "lower");
    await create(page, "upper");
    await open(page, "lower");
    await open(page, "upper");
    await page.evaluate(() => {
      void window.bsHistory.close("lower");
      void window.bsHistory.close("upper");
    });
    await settle(page);

    expect((await entry(page)).__bs).toBeUndefined();
    expect(page.url()).toContain("/fixtures/history.html");
  });

  test("a marker left by a reload is stepped off once a sheet is set up", async ({
    page,
  }) => {
    await create(page, "a");
    await open(page, "a");
    await page.reload();
    await page.waitForFunction(() => "bsHistory" in window);
    expect((await entry(page)).__bs).toBe(true);

    await create(page, "b");
    await settle(page);
    expect((await entry(page)).__bs).toBeUndefined();
    expect(page.url()).toContain("/fixtures/history.html");
  });
});
