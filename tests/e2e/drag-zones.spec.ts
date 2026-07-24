import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/fixtures/drag-zones.html";
const mainSheet = '[data-sheet="main"] .bs-sheet';
const content = '[data-sheet="main"] .bs-content';
const topRow = '[data-sheet="main"] [data-row="1"]';

const sizeOf = (page: Page, selector: string) =>
  page.evaluate(sel => {
    const el = document.querySelector(sel) as HTMLElement | null;
    return el ? parseFloat(el.style.getPropertyValue("--bs-size")) : NaN;
  }, selector);

/** Real touch input — synthetic events would not exercise scroll arbitration. */
const swipe = async (
  page: Page,
  selector: string,
  fromY: number,
  toY: number,
  steps = 12,
) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const x = Math.round(box.x + box.width / 2);
  const client = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
    client.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd" ? [] : [{ x, y: Math.round(y), id: 1 }],
    });

  await send("touchStart", fromY);
  for (let i = 1; i <= steps; i++) {
    await send("touchMove", fromY + ((toY - fromY) * i) / steps);
  }
  await send("touchEnd", toY);
  await client.detach();
};

test.describe("closed sheets and content drag", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CDP touch injection is Chromium-only",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    // Closed sheets are visibility:hidden by design — wait for attachment, not visibility.
    await page.waitForSelector(mainSheet, { state: "attached" });
  });

  test("closed sheets rest with no shadow at all", async ({ page }) => {
    const shadows = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".bs-sheet")).map(el => ({
        rest: el.getAttribute("data-bs-rest"),
        shadow: getComputedStyle(el).boxShadow,
        visibility: getComputedStyle(el).visibility,
      })),
    );
    expect(shadows.length).toBeGreaterThan(1);
    for (const s of shadows) {
      expect(s.rest).toBe("closed");
      expect(s.shadow).toBe("none");
      expect(s.visibility).toBe("hidden");
    }
  });

  test("an open sheet paints its shadow again", async ({ page }) => {
    await page.click("#open-half");
    await page.waitForFunction(
      sel => document.querySelector(sel)?.getAttribute("data-bs-rest") === null,
      mainSheet,
    );
    const shadow = await page.evaluate(
      sel => getComputedStyle(document.querySelector(sel)!).boxShadow,
      mainSheet,
    );
    expect(shadow).not.toBe("none");
  });

  test("dragging the content down collapses the sheet", async ({ page }) => {
    await page.click("#open-half");
    await page.waitForTimeout(300);
    const before = await sizeOf(page, mainSheet);
    expect(before).toBeGreaterThan(200);

    const box = (await page.locator(topRow).boundingBox())!;
    await swipe(page, topRow, box.y + 4, box.y + 220);
    await page.waitForTimeout(400);

    const after = await sizeOf(page, mainSheet);
    expect(after).toBeLessThan(before);
  });

  test("the sheet follows the finger mid-gesture", async ({ page }) => {
    await page.click("#open-half");
    await page.waitForTimeout(300);

    const box = (await page.locator(topRow).boundingBox())!;
    const x = Math.round(box.x + box.width / 2);
    const client = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
      client.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y: Math.round(y), id: 1 }],
      });

    const start = box.y + 4;
    await send("touchStart", start);
    await send("touchMove", start + 20);
    await send("touchMove", start + 90);
    const mid = await sizeOf(page, mainSheet);
    await send("touchEnd", start + 90);
    await client.detach();

    expect(mid).toBeLessThan(295);
    expect(mid).toBeGreaterThan(180);
  });

  test("scrolling long content never moves the sheet", async ({ page }) => {
    await page.click("#open-full");
    await page.waitForTimeout(400);
    const before = await sizeOf(page, mainSheet);

    const box = (await page.locator(content).boundingBox())!;
    await swipe(page, content, box.y + box.height - 40, box.y + 40);
    await page.waitForTimeout(400);

    const scrollTop = await page.evaluate(
      sel => (document.querySelector(sel) as HTMLElement).scrollTop,
      content,
    );
    const after = await sizeOf(page, mainSheet);
    expect(scrollTop).toBeGreaterThan(0);
    expect(after).toBe(before);
  });

  test("dragFromContent: false on the active point blocks the gesture", async ({
    page,
  }) => {
    await page.click("#open-full");
    await page.waitForTimeout(400);
    const before = await sizeOf(page, mainSheet);

    const box = (await page.locator(topRow).boundingBox())!;
    await swipe(page, topRow, box.y + 4, box.y + 260);
    await page.waitForTimeout(400);

    expect(await sizeOf(page, mainSheet)).toBe(before);
    expect(
      await page.getAttribute(mainSheet, "data-active"),
    ).toBe("full");
  });

  test("a data-bs-no-drag region does not drag the sheet", async ({ page }) => {
    await page.click("#open-half");
    await page.waitForTimeout(300);
    const before = await sizeOf(page, mainSheet);

    const box = (await page.locator(".no-drag").boundingBox())!;
    await swipe(page, ".no-drag", box.y + 4, box.y + 200);
    await page.waitForTimeout(400);

    expect(await sizeOf(page, mainSheet)).toBe(before);
  });

  test("the handle still drags after all the gating", async ({ page }) => {
    await page.click("#open-half");
    await page.waitForTimeout(300);
    const before = await sizeOf(page, mainSheet);

    const box = (await page.locator(`${mainSheet} .bs-handle`).boundingBox())!;
    await swipe(page, `${mainSheet} .bs-handle`, box.y + 10, box.y + 220);
    await page.waitForTimeout(400);

    expect(await sizeOf(page, mainSheet)).toBeLessThan(before);
  });
});
