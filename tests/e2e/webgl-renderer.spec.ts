import { expect, test } from "@playwright/test";

const FIXTURE = "/fixtures/webgl.html";
const SHEET = ".bs-sheet";

test.describe("WebGL renderer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.waitForSelector(SHEET);
  });

  test("mounts a canvas behind the sheet and suppresses its DOM paint", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const canvas = page.locator("canvas");
    await expect(canvas).toHaveCount(1);

    const marked = await page.getAttribute(SHEET, "data-bs-webgl");
    expect(marked).toBe("on");

    const paint = await page.$eval(SHEET, el => {
      const cs = getComputedStyle(el as HTMLElement);
      return { bg: cs.backgroundColor, shadow: cs.boxShadow };
    });
    expect(paint.bg).toBe("rgba(0, 0, 0, 0)");
    expect(paint.shadow).toBe("none");
  });

  test("the canvas covers the viewport and does not take pointer events", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const box = await page.$eval("canvas", el => {
      const c = el as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        pointer: getComputedStyle(c).pointerEvents,
        hidden: c.getAttribute("aria-hidden"),
      };
    });
    const vp = page.viewportSize();
    expect(box.w).toBe(vp?.width);
    expect(box.h).toBe(vp?.height);
    expect(box.pointer).toBe("none");
    expect(box.hidden).toBe("true");
  });

  test("gestures and snapping still work with the renderer on", async ({
    page,
  }) => {
    await page.click("#to-full");
    await page.waitForFunction(() => {
      const el = document.querySelector(".bs-sheet") as HTMLElement | null;
      const v = parseFloat(el?.style.getPropertyValue("--bs-size") ?? "");
      return Number.isFinite(v) && v > 300;
    });

    await page.click("#to-min");
    await page.waitForFunction(() => {
      const el = document.querySelector(".bs-sheet") as HTMLElement | null;
      const v = parseFloat(el?.style.getPropertyValue("--bs-size") ?? "");
      return Number.isFinite(v) && v < 200;
    });
  });

  test("a lost context restores the DOM sheet instead of leaving it blank", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    await page.click("#lose-context");
    await page.waitForFunction(
      () => !document.querySelector(".bs-sheet")?.hasAttribute("data-bs-webgl"),
      undefined,
      { timeout: 5000 },
    );

    const bg = await page.$eval(
      SHEET,
      el => getComputedStyle(el as HTMLElement).backgroundColor,
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("lifts the content into the texture while dragging and hands it back", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const readColor = () =>
      page.$eval(".sheet-body", el => (el as HTMLElement).style.color);

    expect(await readColor()).toBe("");

    const box = await page.locator(".bs-handle").boundingBox();
    if (!box) throw new Error("no handle box");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(cx, cy - i * 24);
    }

    const lifted = await page
      .waitForFunction(
        () => {
          const body = document.querySelector(".sheet-body") as HTMLElement;
          if (body.style.color === "transparent") return "lifted";
          const gone = !document
            .querySelector(".bs-sheet")
            ?.hasAttribute("data-bs-webgl");
          return gone ? "withdrawn" : false;
        },
        undefined,
        { timeout: 5000 },
      )
      .then(h => h.jsonValue());

    if (lifted === "withdrawn") {
      await page.mouse.up();
      test.skip(true, "renderer withdrew — no GL context available");
      return;
    }

    await page.mouse.up();

    await page.waitForFunction(
      () =>
        (document.querySelector(".sheet-body") as HTMLElement).style.color ===
        "",
      undefined,
      { timeout: 8000 },
    );
  });

  test("hands the content back promptly, not when the spring finishes", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const box = await page.locator(".bs-handle").boundingBox();
    if (!box) throw new Error("no handle box");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy - i * 30);

    const lifted = await page
      .waitForFunction(
        () => {
          const b = document.querySelector(".sheet-body") as HTMLElement;
          if (b.style.color === "transparent") return "lifted";
          const gone = !document
            .querySelector(".bs-sheet")
            ?.hasAttribute("data-bs-webgl");
          return gone ? "withdrawn" : false;
        },
        undefined,
        { timeout: 5000 },
      )
      .then(h => h.jsonValue());

    if (lifted === "withdrawn") {
      await page.mouse.up();
      test.skip(true, "renderer withdrew — no GL context available");
      return;
    }

    const measuring = page.evaluate(async () => {
      const body = document.querySelector(".sheet-body") as HTMLElement;
      const sheet = document.querySelector(".bs-sheet") as HTMLElement;
      const size = (): number =>
        parseFloat(sheet.style.getPropertyValue("--bs-size")) || 0;

      let frames = 0;
      while (frames < 200 && body.style.color !== "") {
        await new Promise(r => requestAnimationFrame(r));
        frames++;
      }
      if (body.style.color !== "") return { frames: -1, stillMoving: false };

      const at = size();
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      return { frames, stillMoving: Math.abs(size() - at) > 0.5 };
    });
    await page.mouse.up();
    const { frames, stillMoving } = await measuring;

    expect(frames).toBeGreaterThan(-1);
    expect(frames).toBeLessThanOrEqual(15);
    expect(stillMoving).toBe(true);
  });

  test("lifts backgrounds, borders and images too, not just text", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const box = await page.locator(".bs-handle").boundingBox();
    if (!box) throw new Error("no handle box");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy - i * 26);

    const lifted = await page
      .waitForFunction(
        () => {
          const card = document.querySelector(".sheet-card") as HTMLElement;
          const img = document.querySelector(".sheet-swatch") as HTMLElement;
          const bg = getComputedStyle(card).backgroundColor;
          if (bg === "rgba(0, 0, 0, 0)" && img.style.opacity === "0")
            return "lifted";
          const gone = !document
            .querySelector(".bs-sheet")
            ?.hasAttribute("data-bs-webgl");
          return gone ? "withdrawn" : false;
        },
        undefined,
        { timeout: 5000 },
      )
      .then(h => h.jsonValue());

    await page.mouse.up();
    if (lifted === "withdrawn") {
      test.skip(true, "renderer withdrew — no GL context available");
      return;
    }

    await page.waitForFunction(
      () => {
        const card = document.querySelector(".sheet-card") as HTMLElement;
        const img = document.querySelector(".sheet-swatch") as HTMLElement;
        return (
          getComputedStyle(card).backgroundColor !== "rgba(0, 0, 0, 0)" &&
          img.style.opacity === ""
        );
      },
      undefined,
      { timeout: 8000 },
    );
  });

  test("the surface is drawn where the sheet is on every frame of a snap", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);

    const runs = await page.evaluate(async () => {
      const sheet = document.querySelector(".bs-sheet") as HTMLElement;
      let drawnTop: number | null = null;
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
          drawnTop = sheet.getBoundingClientRect().top;
          return original.apply(this, args);
        };
      });
      const out: { frames: number; stale: number }[] = [];
      for (const id of ["#to-full", "#to-min"]) {
        let frames = 0;
        let stale = 0;
        let watching = true;
        const frameStart = (): void => {
          if (!watching) return;
          requestAnimationFrame(frameStart);
          if (drawnTop === null) return;
          frames++;
          if (Math.abs(drawnTop - sheet.getBoundingClientRect().top) > 0.5) {
            stale++;
          }
          drawnTop = null;
        };
        drawnTop = null;
        requestAnimationFrame(frameStart);
        (document.querySelector(id) as HTMLElement).click();
        await new Promise(r => setTimeout(r, 900));
        watching = false;
        out.push({ frames, stale });
      }
      protos.forEach((proto, i) => {
        proto.drawArrays = originals[i]!;
      });
      return out;
    });

    for (const run of runs) {
      expect(run.frames).toBeGreaterThanOrEqual(2);
      expect(run.stale).toBe(0);
    }
  });

  test("an idle 2px size change still moves the surface", async ({
    page,
  }) => {
    const unsupported = await page.getAttribute("#status", "data-unsupported");
    test.skip(!!unsupported, `renderer bailed: ${unsupported}`);
    await page.waitForTimeout(300);

    const r = await page.evaluate(async () => {
      const sheet = document.querySelector(".bs-sheet") as HTMLElement;
      const engine = (
        window as unknown as {
          __webglEngine?: { setSnapPoints: (p: unknown[]) => void };
        }
      ).__webglEngine;
      if (!engine) return null;
      let drawnTop = NaN;
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
          drawnTop = sheet.getBoundingClientRect().top;
          return original.apply(this, args);
        };
      });
      engine.setSnapPoints([
        { id: "closed", size: 0 },
        { id: "minimized", size: 142 },
        { id: "full", size: "80%" },
      ]);
      await new Promise(res => setTimeout(res, 200));
      protos.forEach((proto, i) => {
        proto.drawArrays = originals[i]!;
      });
      return { drawnTop, top: sheet.getBoundingClientRect().top };
    });

    expect(r).not.toBeNull();
    expect(Math.abs(r!.drawnTop - r!.top)).toBeLessThan(0.5);
  });

  test("the sheet keeps its accessibility contract under the renderer", async ({
    page,
  }) => {
    await expect(page.locator(`${SHEET}[role="dialog"]`)).toHaveCount(1);
    await expect(page.locator('.bs-handle[role="slider"]')).toHaveCount(1);
    await expect(page.locator('.bs-content[role="region"]')).toHaveCount(1);
    await expect(page.locator(".sheet-body")).toBeVisible();
  });
});
