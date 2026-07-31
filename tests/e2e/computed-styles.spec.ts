import { expect, test, type Page } from "@playwright/test";

const SHEET = ".bs-sheet";

const prop = (page: Page, selector: string, name: string, pseudo?: string) =>
  expect.poll(() =>
    page.$eval(
      selector,
      (el, args) =>
        getComputedStyle(el as HTMLElement, args.pseudo || undefined)
          .getPropertyValue(args.name)
          .trim(),
      { name, pseudo: pseudo ?? "" },
    ),
  );

test.describe("computed styles — the geometry pixels miss", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(SHEET);
    await page.waitForLoadState("networkidle");
  });

  test("the sheet keeps its painted contract", async ({ page }) => {
    await prop(page, SHEET, "border-top-left-radius").toBe("20px");
    await prop(page, SHEET, "border-top-right-radius").toBe("20px");
    await prop(page, SHEET, "background-color").toBe("rgb(255, 255, 255)");
    await prop(page, SHEET, "position").toBe("absolute");
    await prop(page, SHEET, "overflow").toBe("hidden");
    await prop(page, SHEET, "display").toBe("flex");
    await prop(page, SHEET, "flex-direction").toBe("column");
    await prop(page, SHEET, "overscroll-behavior").toBe("contain");
  });

  test("the handle stays the size the design calls for", async ({ page }) => {
    await prop(page, ".bs-handle", "width", "::before").toBe("40px");
    await prop(page, ".bs-handle", "height", "::before").toBe("5px");
    await prop(page, ".bs-handle", "touch-action").not.toBe("auto");
  });

  test("the scroll container is the one that scrolls", async ({ page }) => {
    await prop(page, ".bs-content", "overflow-y").toMatch(/auto|scroll/);
    await prop(page, ".bs-content", "overscroll-behavior").toBe("contain");
  });

  test("size and progress are exposed as custom properties", async ({
    page,
  }) => {
    await prop(page, SHEET, "--bs-size").toMatch(/^[\d.]+px$/);
    await expect
      .poll(() =>
        page.$eval(SHEET, el =>
          Number.parseFloat(
            getComputedStyle(el as HTMLElement)
              .getPropertyValue("--bs-progress")
              .trim(),
          ),
        ),
      )
      .toBeGreaterThanOrEqual(0);
  });

  test("a closed sheet drops its shadow and leaves hit-testing", async ({
    page,
  }) => {

    const closed = await page.evaluate(() => {
      const root = document.createElement("div");
      root.className = "bs-root";
      const probe = document.createElement("section");
      probe.className = "bs-sheet";
      probe.setAttribute("data-mode", "bottom");
      probe.setAttribute("data-bs-rest", "closed");
      root.appendChild(probe);
      document.body.appendChild(root);
      const cs = getComputedStyle(probe);
      const out = { shadow: cs.boxShadow, visibility: cs.visibility };
      root.remove();
      return out;
    });

    expect(closed.shadow).toBe("none");
    expect(closed.visibility).toBe("hidden");
  });
});
