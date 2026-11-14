import { expect, test, type Locator, type Page } from "@playwright/test";

const ADAPTERS = [
  "react",
  "vue",
  "svelte",
  "solid",
  "lit",
  "element",
  "vanilla",
] as const;

type Rgb = { r: number; g: number; b: number };

const FRAME = "#device-frame";
const TOGGLE = "#tg-webgl";
const NOTE = "#renderer-note";
const FORCE = "#renderer-force";

const screen = (adapter: string): string =>
  `.device-screen[data-screen="${adapter}"]`;

const sheetOf = (page: Page, adapter: string): Locator =>
  page.locator(`${screen(adapter)} .bs-sheet`);

const canvasOf = (page: Page, adapter: string): Locator =>
  page.locator(`${screen(adapter)} canvas`);

const open = async (page: Page, hash = ""): Promise<void> => {
  await page.goto(`/${hash}`);
  await page.waitForSelector(".device-screen:not([hidden]) .bs-sheet", {
    state: "attached",
  });
};

const pick = async (page: Page, adapter: string): Promise<void> => {
  const button = page.locator(`[data-adapter="${adapter}"]`);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
  }
  await sheetOf(page, adapter).waitFor({ state: "attached" });
  await page.waitForTimeout(500);
};

const surfaceColour = async (page: Page, adapter: string): Promise<Rgb> => {
  const frame = page.locator(FRAME);
  await frame.scrollIntoViewIfNeeded();
  const frameBox = await frame.boundingBox();
  const sheetBox = await sheetOf(page, adapter).boundingBox();
  if (!frameBox || !sheetBox) throw new Error("no box");
  const shot = (await frame.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, x, y, width }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / width;
      const [r = 0, g = 0, b = 0] = ctx.getImageData(
        Math.round(x * scale),
        Math.round(y * scale),
        1,
        1,
      ).data;
      return { r, g, b };
    },
    {
      data: shot,
      x: sheetBox.x - frameBox.x + 8,
      y: sheetBox.y - frameBox.y + 56,
      width: frameBox.width,
    },
  );
};

const distance = (a: Rgb, b: Rgb): number =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));

const turnOn = async (page: Page, adapter: string): Promise<void> => {
  await page.locator(TOGGLE).check();
  const force = page.locator(FORCE);
  const note = page.locator(NOTE);
  const settled = async (): Promise<string> => {
    if ((await canvasOf(page, adapter).count()) > 0) return "drawn";
    if (await force.isVisible()) return "asks";
    const key = await note.getAttribute("data-i18n");
    return key === "ctrl.webgl.note.no-webgl" ? "none" : "";
  };
  await expect.poll(settled, { timeout: 8000 }).not.toBe("");
  test.skip((await settled()) === "none", "this browser has no WebGL");
  if (await force.isVisible()) await force.click();
  await expect(canvasOf(page, adapter)).toHaveCount(1);
  await expect(sheetOf(page, adapter)).toHaveAttribute("data-bs-webgl", "on");
  await page.waitForTimeout(500);
};

const drawsOnCpu = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const plain = String(gl.getParameter(gl.RENDERER));
    const info = /^webkit webgl$/i.test(plain)
      ? gl.getExtension("WEBGL_debug_renderer_info")
      : null;
    const name = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : plain;
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  });

test.describe("the demo's renderer switch", () => {
  for (const adapter of ADAPTERS) {
    test(`${adapter}: WebGL draws the sheet where the DOM drew it`, async ({
      page,
    }) => {
      await open(page);
      await pick(page, adapter);
      const dom = await surfaceColour(page, adapter);

      await turnOn(page, adapter);

      expect(distance(await surfaceColour(page, adapter), dom)).toBeLessThan(40);
      const frame = await page.locator(FRAME).boundingBox();
      const canvas = await canvasOf(page, adapter).boundingBox();
      expect(canvas!.x).toBeGreaterThanOrEqual(frame!.x - 1);
      expect(canvas!.y).toBeGreaterThanOrEqual(frame!.y - 1);
      expect(canvas!.width).toBeLessThanOrEqual(frame!.width + 2);
      expect(canvas!.height).toBeLessThanOrEqual(frame!.height + 2);
    });
  }

  for (const adapter of ["react", "element"] as const) {
    test(`${adapter}: the surface follows the theme switch`, async ({
      page,
    }) => {
      await open(page);
      await pick(page, adapter);
      const first = await surfaceColour(page, adapter);
      await page.click("#theme-toggle");
      await page.waitForTimeout(900);
      const second = await surfaceColour(page, adapter);
      expect(distance(first, second)).toBeGreaterThan(60);

      await turnOn(page, adapter);
      expect(distance(await surfaceColour(page, adapter), second)).toBeLessThan(
        40,
      );

      await page.click("#theme-toggle");
      await expect
        .poll(
          async () => distance(await surfaceColour(page, adapter), first),
          { timeout: 6000 },
        )
        .toBeLessThan(40);
      await expect(canvasOf(page, adapter)).toHaveCount(1);
    });
  }

  test("switching back hands the paint to the DOM again", async ({ page }) => {
    await open(page);
    await turnOn(page, "react");

    await page.locator(TOGGLE).uncheck();

    await expect(canvasOf(page, "react")).toHaveCount(0);
    const sheet = sheetOf(page, "react");
    await expect(sheet).not.toHaveAttribute("data-bs-webgl", "on");
    expect(
      await sheet.evaluate(el => getComputedStyle(el).backgroundColor),
    ).not.toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator(NOTE)).toHaveAttribute(
      "data-i18n",
      "ctrl.webgl.note.dom",
    );
  });

  test("the choice travels in the link", async ({ page }) => {
    await open(page);
    await turnOn(page, "react");
    await expect
      .poll(() => page.evaluate(() => location.hash), { timeout: 3000 })
      .toContain("webgl=1");

    await page.goto("/#adapter=vanilla&webgl=1&cpu=1");
    await page.reload();
    await sheetOf(page, "vanilla").waitFor({ state: "attached" });
    await expect(page.locator(TOGGLE)).toBeChecked();
    await expect(canvasOf(page, "vanilla")).toHaveCount(1);
    await expect(page.locator(NOTE)).not.toHaveAttribute(
      "data-i18n",
      "ctrl.webgl.note.dom",
    );
  });

  test("the snippet shows how to switch it on", async ({ page }) => {
    await open(page);
    await expect(page.locator("#code-react")).not.toContainText("webglRenderer");

    await turnOn(page, "react");

    await expect(page.locator("#code-react")).toContainText(
      'import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";',
    );
    await expect(page.locator("#code-react")).toContainText(
      "<BottomSheet features={[webglRenderer(",
    );
  });

  test("says why the sheet stayed on the DOM under reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);

    await page.locator(TOGGLE).check();

    await expect(page.locator(NOTE)).toHaveAttribute(
      "data-i18n",
      "ctrl.webgl.note.reduced-motion",
    );
    await expect(canvasOf(page, "react")).toHaveCount(0);
    await expect(page.locator(FORCE)).toBeHidden();
  });

  test("on a software rasteriser it asks before drawing on the CPU", async ({
    page,
  }) => {
    await open(page);
    test.skip(!(await drawsOnCpu(page)), "this browser draws WebGL on a GPU");

    await page.locator(TOGGLE).check();

    await expect(page.locator(NOTE)).toHaveAttribute(
      "data-i18n",
      "ctrl.webgl.note.software-renderer",
    );
    await expect(canvasOf(page, "react")).toHaveCount(0);

    await page.locator(FORCE).click();

    await expect(canvasOf(page, "react")).toHaveCount(1);
    await expect(page.locator(NOTE)).toHaveAttribute(
      "data-i18n",
      "ctrl.webgl.note.cpu",
    );
    await expect(page.locator(FORCE)).toBeHidden();
    await expect(page.locator("#code-react")).toContainText(
      "webglRenderer({ allowSoftware: true })",
    );
  });

  test("the overlay panel has no such renderer, and the switch says so", async ({
    page,
  }) => {
    await open(page);

    await page.click('#mode-chips [data-mode="overlay"]');

    await expect(page.locator(TOGGLE)).toBeDisabled();
    await expect(page.locator(NOTE)).toHaveAttribute(
      "data-i18n",
      "ctrl.webgl.note.overlay",
    );

    await page.click('#mode-chips [data-mode="bottom"]');
    await expect(page.locator(TOGGLE)).toBeEnabled();
  });
});
