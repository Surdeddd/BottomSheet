import { expect, test } from "@playwright/test";

test("vv resize fires on setViewportSize", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("http://localhost:5173");
  await page.waitForSelector(`.device-screen[data-screen="react"] .bs-sheet`);

  await page.evaluate(() => {
    (window as unknown as { __vv: number }).__vv = 0;
    (window as unknown as { __rz: number }).__rz = 0;
    window.visualViewport?.addEventListener("resize", () => {
      (window as unknown as { __vv: number }).__vv++;
    });
    window.addEventListener("resize", () => {
      (window as unknown as { __rz: number }).__rz++;
    });
  });

  const before = await page.evaluate(() => ({
    vv: (window as unknown as { __vv: number }).__vv,
    rz: (window as unknown as { __rz: number }).__rz,
    vvH: window.visualViewport?.height,
    inner: window.innerHeight,
  }));
  console.log("BEFORE", JSON.stringify(before));

  await page.setViewportSize({ width: 375, height: 360 });
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => ({
    vv: (window as unknown as { __vv: number }).__vv,
    rz: (window as unknown as { __rz: number }).__rz,
    vvH: window.visualViewport?.height,
    inner: window.innerHeight,
    sheetSize: parseFloat(
      (document.querySelector(
        `.device-screen[data-screen="react"] .bs-sheet`,
      ) as HTMLElement | null)?.style.getPropertyValue("--bs-size") ?? "0",
    ),
    sheetInlineH: (document.querySelector(
      `.device-screen[data-screen="react"] .bs-sheet`,
    ) as HTMLElement | null)?.style.height,
  }));
  console.log("AFTER", JSON.stringify(after));

  expect(after.rz).toBeGreaterThan(0);
});
