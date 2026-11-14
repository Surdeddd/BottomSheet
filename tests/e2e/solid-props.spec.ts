import { expect, test, type Page } from "@playwright/test";

type SolidApi = {
  setPersistent: (value: boolean | undefined) => void;
  setMode: (value: string | undefined) => void;
  setRadius: (value: number) => void;
  setAllowed: (value: string[] | undefined) => void;
  canDismiss: () => boolean;
  allowedIds: () => string[];
  headerMounts: () => number;
};

declare global {
  interface Window {
    bsSolid: SolidApi;
  }
}

const sheetMode = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector<HTMLElement>(".bs-sheet")?.dataset.mode ?? null,
  );

test.describe("Solid adapter props", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/solid-props.html");
    await page.waitForFunction(() => "bsSolid" in window);
    await page.waitForSelector(".bs-sheet", { state: "attached" });
    await page.waitForTimeout(120);
  });

  test("an optional prop applies the first time it gets a value", async ({
    page,
  }) => {
    expect(await page.evaluate(() => window.bsSolid.canDismiss())).toBe(true);
    await page.evaluate(() => window.bsSolid.setPersistent(true));
    expect(await page.evaluate(() => window.bsSolid.canDismiss())).toBe(false);

    await page.evaluate(() => window.bsSolid.setAllowed(["half", "full"]));
    expect(await page.evaluate(() => window.bsSolid.allowedIds())).toEqual([
      "half",
      "full",
    ]);

    await page.evaluate(() => window.bsSolid.setMode("top"));
    expect(await sheetMode(page)).toBe("top");
  });

  test("a prop that goes back to undefined returns to the default", async ({
    page,
  }) => {
    await page.evaluate(() => window.bsSolid.setPersistent(true));
    await page.evaluate(() => window.bsSolid.setPersistent(undefined));
    expect(await page.evaluate(() => window.bsSolid.canDismiss())).toBe(true);
  });

  test("radius is reactive", async ({ page }) => {
    const radius = (): Promise<string> =>
      page.evaluate(() =>
        getComputedStyle(document.querySelector(".bs-sheet")!)
          .getPropertyValue("--bs-radius")
          .trim(),
      );
    expect(await radius()).toBe("12px");
    await page.evaluate(() => window.bsSolid.setRadius(28));
    expect(await radius()).toBe("28px");
  });

  test("engine options the adapter does not name itself reach the engine", async ({
    page,
  }) => {
    const scrim = await page.evaluate(
      () => document.querySelector<HTMLElement>(".bs-screen")!.style.background,
    );
    expect(scrim).toContain("rgba(0, 0, 0, 0.7)");
  });

  test("the handle and the content take their accessible names from props", async ({
    page,
  }) => {
    await expect(page.locator(".bs-handle")).toHaveAttribute(
      "aria-label",
      "Resize the panel",
    );
    await expect(page.locator(".bs-content")).toHaveAttribute(
      "aria-label",
      "Panel content",
    );
  });

  test("the header is created once", async ({ page }) => {
    expect(await page.evaluate(() => window.bsSolid.headerMounts())).toBe(1);
    await expect(page.locator('[data-testid="solid-header"]')).toHaveCount(1);
  });

  test("logical modes are written to the DOM as a physical edge", async ({
    page,
  }) => {
    await page.evaluate(() => window.bsSolid.setMode("start"));
    expect(await sheetMode(page)).toBe("left");
    await page.evaluate(() => window.bsSolid.setMode("right"));
    expect(await sheetMode(page)).toBe("right");
    await page.evaluate(() => window.bsSolid.setMode("end"));
    expect(await sheetMode(page)).toBe("right");
  });
});
