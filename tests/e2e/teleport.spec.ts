import { expect, test } from "@playwright/test";

test.describe("engine-level teleport", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/teleport.html");
    await page.waitForSelector(".bs-sheet", { state: "attached" });
    await page.waitForTimeout(250);
  });

  test("a teleported sheet keeps the theme defaults", async ({ page }) => {
    const styles = await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>(".bs-sheet")!;
      const backdrop = document.querySelector<HTMLElement>(".bs-backdrop")!;
      const root = sheet.closest<HTMLElement>(".bs-root")!;
      const cs = getComputedStyle(sheet);
      return {
        insideApp: document.getElementById("app")!.contains(sheet),
        rootParent: root.parentElement === document.body,
        teleported: root.hasAttribute("data-bs-teleported"),
        background: cs.backgroundColor,
        radius: cs.borderTopLeftRadius,
        backdrop: getComputedStyle(backdrop).backgroundColor,
        width: Math.round(sheet.getBoundingClientRect().width),
        viewport: window.innerWidth,
      };
    });
    expect(styles.insideApp).toBe(false);
    expect(styles.rootParent).toBe(true);
    expect(styles.teleported).toBe(true);
    expect(styles.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.radius).toBe("20px");
    expect(styles.backdrop).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.width).toBe(styles.viewport);
  });

  test("a button slot left in the app still rides the sheet's size", async ({
    page,
  }) => {
    const size = await page.evaluate(() => {
      const slot = document.querySelector<HTMLElement>(".bs-button-slot")!;
      const home = slot.closest<HTMLElement>(".bs-root")!;
      return {
        homeSize: home.style.getPropertyValue("--bs-size"),
        slotBottom: getComputedStyle(slot).bottom,
      };
    });
    expect(size.homeSize).toBe("280px");
    expect(size.slotBottom).toBe("292px");
  });
});
