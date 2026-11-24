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

const outline = async (
  page: Page,
  centre: number,
  corner: number,
): Promise<{ centre: number; corner: number; pill: number }> => {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, centre, corner }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const first = (x: number, from: number, above: number): number => {
        const column = Math.round(x * scale);
        for (let row = Math.round(from * scale); row < img.height; row++) {
          if (ctx.getImageData(column, row, 1, 1).data[0]! > above) {
            return row / scale;
          }
        }
        return -1;
      };
      const edge = first(centre, 90, 26);
      return {
        centre: edge,
        corner: first(corner, 90, 26),
        pill: first(centre, edge + 2, 80),
      };
    },
    { data: shot, centre, corner },
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

const shot = async (page: Page): Promise<string> =>
  (await page.screenshot()).toString("base64");

const labelColour = (page: Page): Promise<string> =>
  page.$eval(".rich-label", el => (el as HTMLElement).style.color);

const pressHandle = async (page: Page): Promise<Point> => {
  const handle = await boxOf(page, ".bs-handle");
  const at: Point = [
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  ];
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  return at;
};

const awayAndBack = async (page: Page, from: Point): Promise<void> => {
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(from[0], from[1] + i * 5);
    await page.waitForTimeout(30);
  }
  await page.waitForFunction(
    () =>
      (document.querySelector(".rich-label") as HTMLElement).style.color ===
      "transparent",
    undefined,
    { timeout: 5000 },
  );
  for (let i = 5; i >= 0; i--) {
    await page.mouse.move(from[0], from[1] + i * 5);
    await page.waitForTimeout(30);
  }
};

const changedShare = (
  page: Page,
  a: string,
  b: string,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> =>
  page.evaluate(
    async ({ a, b, box }) => {
      const load = async (data: string): Promise<ImageData> => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const scale = img.width / window.innerWidth;
        return ctx.getImageData(
          Math.round(box.x * scale),
          Math.round(box.y * scale),
          Math.round(box.width * scale),
          Math.round(Math.min(box.height, window.innerHeight - box.y) * scale),
        );
      };
      const one = await load(a);
      const two = await load(b);
      let strong = 0;
      for (let i = 0; i < one.data.length; i += 4) {
        const diff = Math.max(
          Math.abs(one.data[i]! - two.data[i]!),
          Math.abs(one.data[i + 1]! - two.data[i + 1]!),
          Math.abs(one.data[i + 2]! - two.data[i + 2]!),
        );
        if (diff > 64) strong++;
      }
      return strong / (one.data.length / 4);
    },
    { a, b, box },
  );

test.describe("WebGL renderer and the page around it", () => {
  test("comes up wherever the browser has WebGL", async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForSelector(SHEET);
    const available = await page.evaluate(
      () => !!document.createElement("canvas").getContext("webgl"),
    );
    test.skip(!available, "this browser has no WebGL");

    await expect(page.locator("#status")).toHaveAttribute("data-unsupported", "");
    await expect(page.locator(SHEET)).toHaveAttribute("data-bs-webgl", "on");
  });

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

  test("the content stays in the DOM through a drag unless lifting is asked for", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      const counter = window as unknown as { uploads: number };
      counter.uploads = 0;
      const protos = [
        WebGLRenderingContext.prototype,
        typeof WebGL2RenderingContext !== "undefined"
          ? WebGL2RenderingContext.prototype
          : null,
      ].filter(Boolean) as WebGLRenderingContext[];
      for (const proto of protos) {
        const original = proto.texImage2D as (...args: unknown[]) => void;
        proto.texImage2D = function (
          this: WebGLRenderingContext,
          ...args: unknown[]
        ) {
          counter.uploads += 1;
          return original.apply(this, args);
        } as WebGLRenderingContext["texImage2D"];
      }
    });

    const handle = await boxOf(page, ".bs-handle");
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - i * 24);
    await page.waitForTimeout(150);

    const held = await page.evaluate(() => ({
      text: (document.querySelector(".sheet-body") as HTMLElement).style.color,
      card: getComputedStyle(document.querySelector(".sheet-card")!)
        .backgroundColor,
      image: (document.querySelector(".sheet-swatch") as HTMLElement).style
        .opacity,
      uploads: (window as unknown as { uploads: number }).uploads,
    }));
    await page.mouse.up();

    expect(held.text).toBe("");
    expect(held.card).not.toBe("rgba(0, 0, 0, 0)");
    expect(held.image).toBe("");
    expect(held.uploads).toBe(0);
  });

  test("a press that does not move the sheet leaves the picture alone, even with lifting on", async ({
    page,
  }) => {
    await open(page, "?lift=1&rich=1");
    await page.click("#to-full");
    await page.waitForTimeout(1300);

    const sheet = await boxOf(page, SHEET);
    const rest = await shot(page);
    await pressHandle(page);
    await page.waitForTimeout(400);
    const held = await shot(page);
    const colour = await labelColour(page);
    await page.mouse.up();

    expect(colour).toBe("");
    expect(await changedShare(page, rest, held, sheet)).toBeLessThan(0.002);
  });

  test("lifted content is drawn where the DOM had it", async ({
    page,
    browserName,
  }) => {
    await open(page, "?lift=1&rich=1");
    await page.click("#to-full");
    await page.waitForTimeout(1300);

    const sheet = await boxOf(page, SHEET);
    const rest = await shot(page);
    const from = await pressHandle(page);
    await awayAndBack(page, from);
    await page.waitForTimeout(1200);
    const held = await shot(page);
    const colour = await labelColour(page);
    await page.mouse.up();

    expect(colour).toBe("transparent");
    expect(await changedShare(page, rest, held, sheet)).toBeLessThan(
      browserName === "chromium" ? 0.012 : 0.004,
    );
  });

  test.describe("on a screen of one device pixel per CSS pixel", () => {
    test.use({ deviceScaleFactor: 1 });

    test("lifted content lands on the very pixels the DOM had it on, and goes back to them", async ({
      page,
    }) => {
      await open(page, "?lift=1&rich=1");
      await page.click("#to-full");
      await page.waitForTimeout(1300);

      const sheet = await boxOf(page, SHEET);
      const rest = await shot(page);
      const from = await pressHandle(page);
      await awayAndBack(page, from);
      await page.waitForTimeout(1200);
      const held = await shot(page);
      const colour = await labelColour(page);
      await page.mouse.up();
      await page.waitForFunction(
        () =>
          (document.querySelector(".rich-label") as HTMLElement).style
            .color === "",
        undefined,
        { timeout: 8000 },
      );
      await page.waitForTimeout(600);
      const after = await shot(page);

      expect(colour).toBe("transparent");
      expect(await changedShare(page, rest, held, sheet)).toBeLessThan(0.002);
      expect(await changedShare(page, rest, after, sheet)).toBeLessThan(0.001);
    });
  });

  test("the middle of the leading edge stays on the sheet and the corners trail", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await open(page, "?slow=4000&jelly=4&sheen=0");
    const moving = (): Promise<boolean> =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __webglEngine: { state: { isAnimating: boolean } };
            }
          ).__webglEngine.state.isAnimating,
      );
    const landing = (): Promise<unknown> =>
      page.waitForFunction(
        () =>
          !(
            window as unknown as {
              __webglEngine: { state: { isAnimating: boolean } };
            }
          ).__webglEngine.state.isAnimating,
        undefined,
        { timeout: 20_000 },
      );
    const sheet = await boxOf(page, SHEET);
    const centre = sheet.x + sheet.width / 2;
    const corner = sheet.x + 28;

    const inFlight = async (
      go: string,
      back: string,
    ): Promise<{ centre: number; corner: number; pill: number }> => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.click(go);
        await page.waitForTimeout(1200);
        const seen = await outline(page, centre, corner);
        if (await moving()) return seen;
        await landing();
        await page.click(back);
        await landing();
      }
      throw new Error("the sheet landed before a frame could be taken in flight");
    };

    const rest = await outline(page, centre, corner);
    expect(Math.abs(rest.corner - rest.centre)).toBeLessThan(1);
    const handleGap = rest.pill - rest.centre;
    expect(handleGap).toBeGreaterThan(2);

    const opening = await inFlight("#to-full", "#to-min");
    expect(opening.centre).toBeLessThan(rest.centre - 40);
    expect(Math.abs(opening.pill - opening.centre - handleGap)).toBeLessThan(1.5);
    expect(opening.corner - opening.centre).toBeGreaterThan(2);
    expect(opening.corner - opening.centre).toBeLessThan(9);

    await landing();
    await expect
      .poll(
        async () => {
          const landed = await outline(page, centre, corner);
          return Math.abs(landed.corner - landed.centre);
        },
        { timeout: 20_000 },
      )
      .toBeLessThan(1);

    const closing = await inFlight("#to-min", "#to-full");
    expect(Math.abs(closing.pill - closing.centre - handleGap)).toBeLessThan(1.5);
    expect(closing.centre - closing.corner).toBeGreaterThan(2);
    expect(closing.centre - closing.corner).toBeLessThan(23);
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
