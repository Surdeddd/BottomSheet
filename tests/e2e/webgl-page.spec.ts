import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/fixtures/webgl.html";
const SHEET = ".bs-sheet";

type Rgb = { r: number; g: number; b: number };
type Point = [number, number];

const sample = async (page: Page, points: Point[]): Promise<Rgb[]> => {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, pts }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      return pts.map(([x, y]) => {
        const [r = 0, g = 0, b = 0] = ctx.getImageData(
          Math.round(x * scale),
          Math.round(y * scale),
          1,
          1,
        ).data;
        return { r, g, b };
      });
    },
    { data: shot, pts: points },
  );
};

const column = async (
  page: Page,
  x: number,
  y: number,
  reach: number,
): Promise<number[]> => {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, x, y, reach }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const row = Math.round(y * scale);
      const out: number[] = [];
      for (let d = -reach; d <= reach; d++) {
        out.push(ctx.getImageData(Math.round(x * scale), row + d, 1, 1).data[0]!);
      }
      return out;
    },
    { data: shot, x, y, reach },
  );
};

const open = async (page: Page, query = ""): Promise<void> => {
  await page.goto(`${FIXTURE}${query}`);
  await page.waitForSelector(SHEET);
  const unsupported = await page.getAttribute("#status", "data-unsupported");
  test.skip(!!unsupported, `renderer bailed: ${unsupported}`);
  await page.waitForTimeout(400);
};

const boxOf = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return box;
};

const SURFACE = 30;
const BACKGROUND = 24;

test.describe("WebGL renderer and the page around it", () => {
  for (const frame of ["transform", "contain", "plain"] as const) {
    test(`inside a frame (${frame}) the surface is drawn on the sheet and nowhere else`, async ({
      page,
    }) => {
      await open(page, `?frame=${frame}`);
      const sheet = await boxOf(page, SHEET);
      const mount = await boxOf(page, "#mount");

      const [inside, above, below] = await sample(page, [
        [sheet.x + 6, sheet.y + 70],
        [sheet.x + 6, sheet.y - 30],
        [sheet.x + 6, mount.y + mount.height + 12],
      ]);
      expect(inside!.r, "the sheet has its surface").toBeGreaterThan(SURFACE);
      expect(above!.r, "nothing above the sheet").toBeLessThan(BACKGROUND);
      expect(below!.r, "nothing under the frame").toBeLessThan(BACKGROUND);
    });
  }

  test("only the corners the sheet itself rounds are rounded", async ({
    page,
  }) => {
    await open(page, "?frame=plain&sheen=0");
    await page.click("#to-full");
    const mount = await boxOf(page, "#mount");
    await expect
      .poll(
        async () => {
          const box = await boxOf(page, SHEET);
          return Math.round(box.y + box.height);
        },
        { timeout: 5000 },
      )
      .toBe(Math.round(mount.y + mount.height));
    await page.waitForTimeout(400);
    const sheet = await boxOf(page, SHEET);

    const [bottom, top] = await sample(page, [
      [mount.x + 1.5, mount.y + mount.height - 1.5],
      [sheet.x + 1.5, sheet.y + 1.5],
    ]);
    expect(bottom!.r, "square where the DOM sheet is square").toBeGreaterThan(
      SURFACE,
    );
    expect(top!.r, "rounded where the DOM sheet is rounded").toBeLessThan(
      BACKGROUND,
    );
  });

  test("the surface stays on a sheet that scrolls away with the page", async ({
    page,
  }) => {
    await open(page, "?frame=plain&lock=off");
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(80);

    const sheet = await boxOf(page, SHEET);
    const [inside, above] = await sample(page, [
      [sheet.x + 6, sheet.y + 70],
      [sheet.x + 6, sheet.y - 30],
    ]);
    expect(inside!.r).toBeGreaterThan(SURFACE);
    expect(above!.r).toBeLessThan(BACKGROUND);
  });

  test("a resting sheet is not redrawn while the page scrolls under it", async ({
    page,
  }) => {
    await open(page, "?lock=off");

    const result = await page.evaluate(async () => {
      let draws = 0;
      const protos = [
        WebGLRenderingContext.prototype,
        typeof WebGL2RenderingContext !== "undefined"
          ? WebGL2RenderingContext.prototype
          : null,
      ].filter(Boolean) as WebGLRenderingContext[];
      const originals = protos.map(p => p.drawArrays);
      protos.forEach((proto, i) => {
        const original = originals[i]!;
        proto.drawArrays = function (
          this: WebGLRenderingContext,
          ...args: Parameters<WebGLRenderingContext["drawArrays"]>
        ) {
          draws++;
          return original.apply(this, args);
        };
      });
      const frame = () =>
        new Promise<void>(done => requestAnimationFrame(() => done()));
      for (let i = 1; i <= 8; i++) {
        window.scrollTo(0, i * 60);
        await frame();
        await frame();
      }
      protos.forEach((proto, i) => {
        proto.drawArrays = originals[i]!;
      });
      return { draws, scrollY: window.scrollY };
    });

    expect(result.scrollY).toBeGreaterThan(0);
    expect(result.draws).toBe(0);
  });

  test("the surface takes the new colour when the theme changes under a resting sheet", async ({
    page,
  }) => {
    await open(page);
    const sheet = await boxOf(page, SHEET);
    const point: Point = [sheet.x + 6, sheet.y + 70];
    expect((await sample(page, [point]))[0]!.r).toBeLessThan(90);

    await page.evaluate(() => document.documentElement.classList.add("light"));

    await expect
      .poll(async () => (await sample(page, [point]))[0]!.r, { timeout: 4000 })
      .toBeGreaterThan(200);
  });

  test("a sheet coloured through the stylesheet variable keeps its surface after a resize", async ({
    page,
  }) => {
    await open(page, "?theme=variable");
    const sheet = await boxOf(page, SHEET);
    const point: Point = [sheet.x + 6, sheet.y + 70];
    expect((await sample(page, [point]))[0]!.r).toBeGreaterThan(SURFACE);

    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(300);

    expect((await sample(page, [point]))[0]!.r).toBeGreaterThan(SURFACE);
  });

  test("a sheet coloured through the stylesheet variable follows the theme", async ({
    page,
  }) => {
    await open(page, "?theme=variable");
    const sheet = await boxOf(page, SHEET);
    const point: Point = [sheet.x + 6, sheet.y + 70];

    await page.evaluate(() => document.documentElement.classList.add("light"));

    await expect
      .poll(async () => (await sample(page, [point]))[0]!.r, { timeout: 4000 })
      .toBeGreaterThan(200);
  });

  test("the surface takes the new colour of a sheet that animates its background", async ({
    page,
  }) => {
    await open(page, "?animated=1");
    await page.waitForTimeout(500);
    const sheet = await boxOf(page, SHEET);
    const point: Point = [sheet.x + 6, sheet.y + 70];
    expect((await sample(page, [point]))[0]!.r).toBeLessThan(90);

    await page.evaluate(() => document.documentElement.classList.add("light"));

    await expect
      .poll(async () => (await sample(page, [point]))[0]!.r, { timeout: 4000 })
      .toBeGreaterThan(200);
    expect(
      await page.$eval(SHEET, el => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
  });

  test("the surface follows the system colour scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "?scheme=follow");
    const sheet = await boxOf(page, SHEET);
    const point: Point = [sheet.x + 6, sheet.y + 70];
    expect((await sample(page, [point]))[0]!.r).toBeLessThan(90);

    await page.emulateMedia({ colorScheme: "light" });

    await expect
      .poll(async () => (await sample(page, [point]))[0]!.r, { timeout: 4000 })
      .toBeGreaterThan(200);
  });

  test("the surface is drawn without a multisampled buffer", async ({
    page,
  }) => {
    await open(page);
    const antialias = await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const gl =
        canvas.getContext("webgl2") ??
        (canvas.getContext("webgl") as WebGLRenderingContext | null);
      return gl?.getContextAttributes()?.antialias ?? null;
    });
    expect(antialias).toBe(false);
  });

  test("the edge of the surface is smoothed by the shader itself", async ({
    page,
  }) => {
    await open(page, "?sheen=0");
    await page.$eval(SHEET, el => {
      (el as HTMLElement).style.borderTopColor = "transparent";
    });
    await page.waitForTimeout(200);
    const sheet = await boxOf(page, SHEET);
    const reds = await column(page, sheet.x + sheet.width / 4, sheet.y, 3);
    const outside = reds[0]!;
    const inside = reds[reds.length - 1]!;

    expect(inside - outside).toBeGreaterThan(12);
    expect(reds.some(r => r > outside + 2 && r < inside - 2)).toBe(true);
  });

  test("declines a software rasteriser unless it is told to draw on it", async ({
    page,
  }) => {
    await page.goto(`${FIXTURE}?software=refuse`);
    await page.waitForSelector(SHEET);
    const software = await page.evaluate(() => {
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
    test.skip(!software, "this browser draws WebGL on a GPU");

    await expect(page.locator("#status")).toHaveAttribute(
      "data-unsupported",
      "software-renderer",
    );
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await page.getAttribute(SHEET, "data-bs-webgl")).toBeNull();
    expect(
      await page.$eval(SHEET, el => getComputedStyle(el).backgroundColor),
    ).not.toBe("rgba(0, 0, 0, 0)");
  });
});
