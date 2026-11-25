import { expect, test, type Page } from "@playwright/test";
import { mount, move, press, settled, snapTo, viewport } from "./_lab";
import type { LabOptions } from "../../demo/fixtures/features";

const FIXTURE = "/fixtures/features.html";
const NAVY = "rgb(35, 64, 120)";
const PLUM = "rgb(120, 35, 96)";
const FLAT = { sheen: 0 } as const;

type Rgb = [number, number, number];
type Box = { left: number; top: number; right: number; bottom: number };
type Painted = Box & { count: number };
type Mode = "bottom" | "top" | "left" | "right";

const rgbOf = (colour: string): Rgb =>
  colour.match(/\d+/g)!.map(Number) as unknown as Rgb;

const open = async (page: Page): Promise<void> => {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!window.lab);
};

const mountGl = async (
  page: Page,
  options: LabOptions = {},
  keep = false,
): Promise<number> => {
  const index = await mount(
    page,
    { surface: NAVY, ...options, webgl: { ...FLAT, ...options.webgl } },
    keep,
  );
  const renderer = await page.evaluate(i => window.lab.renderer(i), index);
  test.skip(renderer !== "webgl", `renderer bailed: ${renderer}`);
  return index;
};

const painted = async (page: Page, colour = NAVY): Promise<Painted> => {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, ink }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const { data: px } = ctx.getImageData(0, 0, img.width, img.height);
      let left = img.width;
      let top = img.height;
      let right = -1;
      let bottom = -1;
      let count = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          if (
            Math.abs(px[i]! - ink[0]) > 6 ||
            Math.abs(px[i + 1]! - ink[1]) > 6 ||
            Math.abs(px[i + 2]! - ink[2]) > 6
          ) {
            continue;
          }
          count++;
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
      return {
        left: left / scale,
        top: top / scale,
        right: (right + 1) / scale,
        bottom: (bottom + 1) / scale,
        count,
      };
    },
    { data: shot, ink: rgbOf(colour) },
  );
};

const tint = async (page: Page, x: number, y: number): Promise<Rgb> => {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, x, y }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const [r = 0, g = 0, b = 0] = ctx.getImageData(
        Math.round(x * scale),
        Math.round(y * scale),
        1,
        1,
      ).data;
      return [r, g, b] as [number, number, number];
    },
    { data: shot, x, y },
  );
};

const onScreen = (page: Page, selector = "#sheet-0"): Promise<Box> =>
  page.evaluate(sel => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return {
      left: Math.max(0, r.left),
      top: Math.max(0, r.top),
      right: Math.min(window.innerWidth, r.right),
      bottom: Math.min(window.innerHeight, r.bottom),
    };
  }, selector);

const off = (a: Box, b: Box): number =>
  Math.max(
    Math.abs(a.left - b.left),
    Math.abs(a.top - b.top),
    Math.abs(a.right - b.right),
    Math.abs(a.bottom - b.bottom),
  );

const expectOnSheet = async (
  page: Page,
  selector = "#sheet-0",
  colour = NAVY,
): Promise<void> => {
  await expect
    .poll(
      async () => off(await painted(page, colour), await onScreen(page, selector)),
      { timeout: 15_000 },
    )
    .toBeLessThan(1.5);
};

type Rim = { centre: number; corner: number };

const rims = async (
  page: Page,
  vertical: boolean,
  lead: "min" | "max",
  centre: number,
  corner: number,
): Promise<{ near: Rim; far: Rim }> => {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, ink, vertical, lead, centre, corner }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const { data: px } = ctx.getImageData(0, 0, img.width, img.height);
      const length = vertical ? img.height : img.width;
      const inked = (cross: number, along: number): boolean => {
        const x = vertical ? cross : along;
        const y = vertical ? along : cross;
        const i = (y * img.width + x) * 4;
        return (
          Math.abs(px[i]! - ink[0]) <= 6 &&
          Math.abs(px[i + 1]! - ink[1]) <= 6 &&
          Math.abs(px[i + 2]! - ink[2]) <= 6
        );
      };
      const span = (at: number): [number, number] => {
        const cross = Math.round(at * scale);
        let first = -1;
        let last = -1;
        for (let along = 0; along < length; along++) {
          if (!inked(cross, along)) continue;
          if (first < 0) first = along;
          last = along;
        }
        return [first / scale, (last + 1) / scale];
      };
      const [centreMin, centreMax] = span(centre);
      const [cornerMin, cornerMax] = span(corner);
      const low = { centre: centreMin, corner: cornerMin };
      const high = { centre: centreMax, corner: cornerMax };
      return lead === "min" ? { near: low, far: high } : { near: high, far: low };
    },
    { data: shot, ink: rgbOf(NAVY), vertical, lead, centre, corner },
  );
};

const EDGES: Record<Mode, { vertical: boolean; lead: "min" | "max" }> = {
  bottom: { vertical: true, lead: "min" },
  top: { vertical: true, lead: "max" },
  left: { vertical: false, lead: "max" },
  right: { vertical: false, lead: "min" },
};

const HANDLE_PULL: Record<Mode, { dx?: number; dy?: number }> = {
  bottom: { dy: -90 },
  top: { dy: 90 },
  left: { dx: 90 },
  right: { dx: -90 },
};

test.describe("the WebGL renderer across the engine's features", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  for (const mode of ["bottom", "top", "left", "right"] as const) {
    test(`${mode}: the surface is drawn on the sheet at every snap point and under a held drag`, async ({
      page,
    }) => {
      await mountGl(page, { mode });
      await expectOnSheet(page);

      await snapTo(page, "half");
      await expectOnSheet(page);

      await snapTo(page, "full");
      await expectOnSheet(page);

      await snapTo(page, "peek");
      const from = await press(page, "#handle-0");
      await move(page, from, { ...HANDLE_PULL[mode], steps: 6, pause: 20 });
      await expectOnSheet(page);
      await page.mouse.up();
      await settled(page);
      await expectOnSheet(page);
    });

    test(`${mode}: with a bend the surface comes to rest on the sheet`, async ({
      page,
    }) => {
      await mountGl(page, { mode, disableClose: true, webgl: { jelly: 2 } });

      await snapTo(page, "full");
      await expectOnSheet(page);

      const from = await press(page, "#handle-0");
      const back = HANDLE_PULL[mode];
      await move(page, from, {
        dx: -(back.dx ?? 0),
        dy: -(back.dy ?? 0),
        steps: 4,
        pause: 10,
      });
      await expectOnSheet(page);
      await page.mouse.up();
      await settled(page);
      await expectOnSheet(page);
    });
  }

  for (const mode of ["bottom", "top", "left", "right"] as const) {
    test(`${mode}: in flight the leading edge bends and the far edge stays straight`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await mountGl(page, {
        mode,
        snapPoints: [
          { id: "closed", size: 0 },
          { id: "peek", size: 80 },
          { id: "full", size: 200 },
        ],
        animation: "linear",
        duration: 6000,
        webgl: { jelly: 16 },
      });
      await page.evaluate(side => {
        document.querySelector<HTMLElement>("#sheet-0")!.style[side] = "150px";
      }, mode);
      await expectOnSheet(page);

      const { vertical, lead } = EDGES[mode];
      const box = await onScreen(page);
      const centre = vertical
        ? (box.left + box.right) / 2
        : (box.top + box.bottom) / 2;
      const corner = (vertical ? box.left : box.top) + 28;
      const flying = (): Promise<boolean> =>
        page.evaluate(() => window.lab.state().isAnimating);
      const landed = (): Promise<void> =>
        expect.poll(flying, { timeout: 10_000 }).toBe(false);

      const bent = async (): Promise<{ near: Rim; far: Rim }> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          await page.evaluate(() => {
            void window.lab.engine().snapTo("full");
          });
          for (let i = 0; i < 40; i++) {
            const seen = await rims(page, vertical, lead, centre, corner);
            if (!(await flying())) break;
            if (Math.abs(seen.near.corner - seen.near.centre) > 2) return seen;
          }
          await landed();
          await page.evaluate(() => {
            void window.lab.engine().snapTo("peek");
          });
          await landed();
        }
        throw new Error("the sheet landed before its leading edge was seen bent");
      };

      const seen = await bent();
      const devicePixel = await page.evaluate(() => 1 / devicePixelRatio);
      expect(
        Math.abs(seen.far.corner - seen.far.centre),
      ).toBeLessThanOrEqual(devicePixel + 0.01);
      expect(Math.abs(seen.near.corner - seen.near.centre)).toBeLessThan(23);
    });
  }

  test("selecting everything on the page does not tint the surface", async ({
    page,
  }) => {
    await mountGl(page, { initial: "half" });
    await expectOnSheet(page);

    await page.evaluate(() =>
      getSelection()!.selectAllChildren(document.documentElement),
    );

    expect(await page.evaluate(() => getSelection()!.isCollapsed)).toBe(false);
    await expectOnSheet(page);
  });

  test("draws nothing for a closed sheet, and the surface comes and goes with it", async ({
    page,
  }) => {
    await mountGl(page, { initial: "closed" });
    expect((await painted(page)).count).toBe(0);

    await snapTo(page, "half");
    await expectOnSheet(page);

    await page.evaluate(() => {
      void window.lab.engine().close();
    });
    await settled(page);
    await expect.poll(async () => (await painted(page)).count).toBe(0);
  });

  test("the surface rises with the sheet above the on-screen keyboard and comes back down", async ({
    page,
  }) => {
    await mountGl(page, { initial: "full", rows: 2 });
    const { height } = await viewport(page);
    await expectOnSheet(page);

    const keyboard = (covered: number): Promise<void> =>
      page.evaluate(px => {
        const vv = window.visualViewport!;
        const full = window.innerHeight;
        Object.defineProperty(vv, "height", {
          configurable: true,
          get: () => full - px,
        });
        vv.dispatchEvent(new Event("resize"));
      }, covered);

    await keyboard(300);
    await expect
      .poll(async () => (await onScreen(page)).bottom, { timeout: 3000 })
      .toBe(height - 300);
    await expectOnSheet(page);
    expect((await painted(page)).bottom).toBeLessThanOrEqual(height - 299);

    await keyboard(0);
    await expect
      .poll(async () => (await onScreen(page)).bottom, { timeout: 3000 })
      .toBe(height);
    await expectOnSheet(page);
  });

  test("the surface lands with the sheet when the page stalls through a whole transition", async ({
    page,
  }) => {
    await mountGl(page, { initial: "half" });
    await expectOnSheet(page);

    await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>("#sheet-0")!;
      sheet.style.bottom = "150px";
      sheet.getBoundingClientRect();
      const until = performance.now() + 400;
      while (performance.now() < until);
    });

    await expectOnSheet(page);
  });

  test("inside a panel the surface stays inside it, on the sheet", async ({
    page,
  }) => {
    await mountGl(page, {
      panel: { width: 320, height: 480 },
      bounds: "container",
      lockBodyScroll: false,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: "50%" },
        { id: "full", size: "full" },
      ],
      initial: "half",
    });
    await page.evaluate(() =>
      document.querySelector("#panel-0")!.scrollIntoView({ block: "center" }),
    );
    const panel = await onScreen(page, "#panel-0");
    expect(panel.bottom - panel.top).toBe(480);

    await expectOnSheet(page);
    const half = await painted(page);
    expect(Math.abs(half.bottom - half.top - 240)).toBeLessThan(1.5);

    await snapTo(page, "full");
    await expectOnSheet(page);
    const full = await painted(page);
    expect(full.left).toBeGreaterThanOrEqual(panel.left - 0.5);
    expect(full.right).toBeLessThanOrEqual(panel.right + 0.5);
    expect(full.top).toBeGreaterThanOrEqual(panel.top - 0.5);
    expect(full.bottom).toBeLessThanOrEqual(panel.bottom + 0.5);
  });

  test("two sheets in a stack each get a surface, and the upper one covers the lower", async ({
    page,
  }) => {
    await mountGl(page, { initial: "half" });
    await mountGl(page, { initial: "full", surface: PLUM }, true);
    await settled(page, 1);

    await expect(page.locator("canvas")).toHaveCount(2);
    await expectOnSheet(page, "#sheet-1", PLUM);
    expect((await painted(page, NAVY)).count).toBe(0);

    await page.evaluate(() => {
      void window.lab.engine(1).snapTo("peek");
    });
    await settled(page, 1);
    await expectOnSheet(page, "#sheet-1", PLUM);
    const lower = await onScreen(page, "#sheet-0");
    const upper = await onScreen(page, "#sheet-1");
    expect(upper.top - lower.top).toBeGreaterThan(100);
    const [red, , blue] = await tint(
      page,
      lower.left + 8,
      (lower.top + upper.top) / 2,
    );
    expect(blue).toBeGreaterThan(red + 30);
  });

  test("the surface follows the sheet to another edge", async ({ page }) => {
    await mountGl(page, { initial: "half" });
    await expectOnSheet(page);

    await page.evaluate(() => window.lab.engine().setMode("left"));
    await settled(page);
    await expectOnSheet(page);

    await page.evaluate(() => window.lab.engine().setMode("top"));
    await settled(page);
    await expectOnSheet(page);
  });

  test("the surface follows the sheet through a resize of the window", async ({
    page,
  }) => {
    await mountGl(page, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: "50%" },
      ],
      initial: "half",
    });
    await expectOnSheet(page);
    const before = await viewport(page);

    await page.setViewportSize({
      width: before.width + 80,
      height: before.height - 120,
    });
    await expect
      .poll(async () => {
        const box = await onScreen(page);
        return Math.round(box.bottom - box.top);
      })
      .toBe(Math.round((before.height - 120) / 2));
    await expectOnSheet(page);
  });

  test("a sheet on the logical end edge of a right-to-left page gets its surface", async ({
    page,
  }) => {
    await mountGl(page, { mode: "end", dir: "rtl", initial: "half" });

    const sheet = await onScreen(page);
    expect(sheet.left).toBe(0);
    await expectOnSheet(page);
  });

  test("a sheet takes one WebGL context and gives it back when it goes", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const made: HTMLCanvasElement[] = [];
      (window as unknown as { __made: HTMLCanvasElement[] }).__made = made;
      const original = HTMLCanvasElement.prototype.getContext as (
        this: HTMLCanvasElement,
        ...args: unknown[]
      ) => unknown;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: unknown[]
      ) {
        const context = original.apply(this, args);
        if (context && String(args[0]).includes("webgl") && !made.includes(this)) {
          made.push(this);
        }
        return context;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await open(page);
    const contexts = (): Promise<boolean[]> =>
      page.evaluate(() =>
        (window as unknown as { __made: HTMLCanvasElement[] }).__made.map(canvas =>
          (
            (canvas.getContext("webgl2") ??
              canvas.getContext("webgl")) as WebGLRenderingContext
          ).isContextLost(),
        ),
      );

    await mountGl(page, { initial: "half" });
    expect(await contexts()).toEqual([false]);

    await page.evaluate(() => window.lab.unmount());
    await expect.poll(contexts).toEqual([true]);
  });

  test("taking the sheet away takes the canvas with it and gives the paint back to the DOM", async ({
    page,
  }) => {
    await mountGl(page, { initial: "half" });
    await expect(page.locator("canvas")).toHaveCount(1);

    await page.evaluate(() => window.lab.unmount());
    await expect(page.locator("canvas")).toHaveCount(0);

    await mount(page, { initial: "half", surface: NAVY });
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(
      await page.$eval("#sheet-0", el => getComputedStyle(el).backgroundColor),
    ).toBe(NAVY);
  });

  test("under reduced motion the renderer steps aside and the DOM paints the sheet", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await mount(page, { initial: "half", surface: NAVY, webgl: {} });

    expect(await page.evaluate(() => window.lab.renderer())).toBe(
      "reduced-motion",
    );
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(
      await page.$eval("#sheet-0", el => getComputedStyle(el).backgroundColor),
    ).toBe(NAVY);
  });
});
