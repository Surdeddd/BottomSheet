import { expect, test, type Page } from "@playwright/test";

type Clip = { x: number; y: number; width: number; height: number };

type Engine = {
  snapTo: (id: string) => Promise<void>;
  state: { size: number };
};

const unsupported = (page: Page) =>
  page.getAttribute("#status", "data-unsupported");

const layout = (page: Page) =>
  page.evaluate(() => {
    const sheet = document.querySelector(".bs-sheet") as HTMLElement;
    const content = sheet.querySelector(".bs-content") as HTMLElement;
    const footer = sheet.querySelector(".bs-footer") as HTMLElement;
    const handle = sheet.querySelector(".bs-handle") as HTMLElement;
    return {
      viewport: window.innerHeight,
      width: window.innerWidth,
      mode: sheet.getAttribute("data-bs-fit-content"),
      sheetTop: sheet.getBoundingClientRect().top,
      handleBottom: handle.getBoundingClientRect().bottom,
      contentTop: content.getBoundingClientRect().top,
      contentBottom: content.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom,
      labelColor: (footer.querySelector(".foot-label") as HTMLElement).style
        .color,
      rowColor: (content.querySelector('[data-row="3"]') as HTMLElement).style
        .color,
      lastRowBottom: (
        content.querySelector('[data-row="100"]') as HTMLElement
      ).getBoundingClientRect().bottom,
    };
  });

const scrollListTo = (page: Page, top: number | "end") =>
  page.evaluate(async t => {
    const content = document.querySelector(".bs-content") as HTMLElement;
    content.scrollTop = t === "end" ? content.scrollHeight : (t as number);
    await new Promise(r => setTimeout(r, 80));
  }, top);

const holdDrag = async (page: Page, dy: number): Promise<void> => {
  const box = (await page.locator(".bs-handle").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, y - (dy * i) / 8);
  await page.waitForTimeout(300);
};

const scan = async (page: Page, clip: Clip) => {
  const png = await page.screenshot({ clip });
  return page.evaluate(
    async ([b64, w, h]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const g = canvas.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, img.width, img.height).data;
      const sx = img.width / (w as number);
      const sy = img.height / (h as number);
      let dark = 0;
      let pinkTop = -1;
      let pinkBottom = -1;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          const r = data[i]!;
          const gr = data[i + 1]!;
          const b = data[i + 2]!;
          if (0.299 * r + 0.587 * gr + 0.114 * b < 90) dark++;
          if (r > 180 && gr < 70 && b > 50 && b < 150) {
            if (pinkTop < 0) pinkTop = y / sy;
            pinkBottom = (y + 1) / sy;
          }
        }
      }
      return { dark, pinkTop, pinkBottom, scale: sx };
    },
    [png.toString("base64"), clip.width, clip.height] as const,
  );
};

test.describe("WebGL renderer with fitContentToSnap", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/webgl-fit.html");
    await page.waitForSelector(".bs-sheet[data-bs-fit-content]", {
      state: "attached",
    });
    await page.waitForTimeout(400);
  });

  test("at rest the scroll container ends at the footer, and the footer at the screen edge", async ({
    page,
  }) => {
    test.skip(!!(await unsupported(page)), "renderer bailed");
    const l = await layout(page);

    expect(l.mode).toBe("rest");
    expect(Math.abs(l.contentBottom - l.footerTop)).toBeLessThan(1.5);
    expect(Math.abs(l.footerBottom - l.viewport)).toBeLessThan(1.5);
  });

  test("a drag lifts the list but leaves the pinned footer in the DOM, on the screen edge", async ({
    page,
  }) => {
    test.skip(!!(await unsupported(page)), "renderer bailed");
    await holdDrag(page, 90);
    const l = await layout(page);
    await page.mouse.up();

    expect(l.mode).toBe("moving");
    expect(l.rowColor).toBe("transparent");
    expect(l.labelColor).not.toBe("transparent");
    expect(Math.abs(l.footerBottom - l.viewport)).toBeLessThan(2);
  });

  test("the footer paints its own surface while the sheet moves, so no row shows through", async ({
    page,
  }) => {
    test.skip(!!(await unsupported(page)), "renderer bailed");
    const seen = await page.evaluate(async () => {
      const engine = (window as unknown as { bsGl: Engine }).bsGl;
      const sheet = document.querySelector(".bs-sheet") as HTMLElement;
      const footer = sheet.querySelector(".bs-footer") as HTMLElement;
      const moving: string[] = [];
      let done = false;
      void engine.snapTo("full").then(() => {
        done = true;
      });
      while (!done) {
        await new Promise(r => requestAnimationFrame(r));
        if (sheet.getAttribute("data-bs-fit-content") === "moving") {
          moving.push(getComputedStyle(footer).backgroundColor);
        }
      }
      await new Promise(r => setTimeout(r, 60));
      return {
        moving,
        rest: getComputedStyle(footer).backgroundColor,
      };
    });

    expect(seen.moving.length).toBeGreaterThan(0);
    expect(seen.moving.every(c => c !== "rgba(0, 0, 0, 0)")).toBe(true);
    expect(seen.rest).toBe("rgba(0, 0, 0, 0)");
  });

  test("rows scrolled out of the list are not drawn over the handle during a drag", async ({
    page,
  }) => {
    test.skip(!!(await unsupported(page)), "renderer bailed");
    await scrollListTo(page, 600);
    await holdDrag(page, 60);
    const l = await layout(page);
    const band = await scan(page, {
      x: 6,
      y: Math.ceil(l.sheetTop + 6),
      width: 120,
      height: Math.max(4, Math.floor(l.contentTop - l.sheetTop - 10)),
    });
    await page.mouse.up();

    expect(band.dark).toBe(0);
  });

  test("a list scrolled to its end stays above the footer through a drag", async ({
    page,
  }) => {
    test.skip(!!(await unsupported(page)), "renderer bailed");
    await scrollListTo(page, "end");
    await holdDrag(page, 150);
    const l = await layout(page);
    const column = await scan(page, {
      x: 18,
      y: 0,
      width: 4,
      height: Math.floor(l.viewport),
    });
    await page.mouse.up();

    expect(column.pinkBottom).toBeGreaterThan(0);
    expect(Math.abs(column.pinkBottom - l.lastRowBottom)).toBeLessThan(3);
    expect(l.footerTop - column.pinkBottom).toBeGreaterThanOrEqual(0);
    expect(l.footerTop - column.pinkBottom).toBeLessThan(40);
  });

  test("an upward drag reveals the rows that were below the resting edge", async ({
    page,
  }) => {
    test.skip(!!(await unsupported(page)), "renderer bailed");
    const before = await layout(page);
    await holdDrag(page, 150);
    const l = await layout(page);
    const edge = Math.min(l.footerTop, l.viewport);
    const band = await scan(page, {
      x: 6,
      y: Math.ceil(edge - 120),
      width: 120,
      height: 110,
    });
    await page.mouse.up();

    expect(before.sheetTop - l.sheetTop).toBeGreaterThan(100);
    expect(band.dark).toBeGreaterThan(20);
  });
});
