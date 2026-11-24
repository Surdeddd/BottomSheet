import { expect, test, type Page } from "@playwright/test";
import { mount, settled, snapTo, viewport } from "./_lab";

const POINTS = [
  { id: "closed", size: 0 },
  { id: "half", size: "50%" },
  { id: "full", size: "full" },
];

const PANEL = { width: 300, height: 400 };

const boxes = (page: Page) =>
  page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const sizes = Object.fromEntries(
      window.lab
        .engine(0)
        .getResolvedSnaps()
        .map(snap => [snap.id, snap.size]),
    );
    return {
      panel: rect("#panel-0"),
      sheet: rect("#sheet-0"),
      backdrop: rect("#backdrop-0"),
      sizes,
    };
  });

test.describe("bounds: what a percentage is a percentage of", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/features.html");
    await page.waitForFunction(() => "lab" in window);
  });

  test("by default a sheet inside a panel is still measured against the window", async ({
    page,
  }) => {
    await mount(page, { snapPoints: POINTS, initial: "half", panel: PANEL });
    await settled(page);
    const { height } = await viewport(page);

    const seen = await boxes(page);

    expect(seen.sizes.half).toBeCloseTo(height / 2, 0);
    expect(seen.sizes.full).toBeCloseTo(height, 0);
  });

  test("bounds: container measures percentages and full against the panel", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);

    const seen = await boxes(page);

    expect(seen.sizes).toEqual({ closed: 0, half: 200, full: 400 });
  });

  test("the sheet and its backdrop stay inside the panel", async ({ page }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);
    const half = await boxes(page);

    expect(half.sheet!.left).toBeCloseTo(half.panel!.left, 0);
    expect(half.sheet!.right).toBeCloseTo(half.panel!.right, 0);
    expect(half.sheet!.top).toBeCloseTo(half.panel!.bottom - 200, 0);
    expect(half.backdrop).toEqual(half.panel);

    await snapTo(page, "full");
    const full = await boxes(page);

    expect(full.sheet!.top).toBeCloseTo(full.panel!.top, 0);
    expect(full.sheet!.bottom).toBeCloseTo(full.panel!.bottom, 0);
  });

  test("the sheet follows its panel when the panel is resized", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);

    await page.evaluate(() => {
      (document.querySelector("#panel-0") as HTMLElement).style.height = "300px";
    });

    await expect
      .poll(async () => (await boxes(page)).sizes, { timeout: 5000 })
      .toEqual({ closed: 0, half: 150, full: 300 });
    await expect
      .poll(
        async () => {
          const seen = await boxes(page);
          return Math.round(seen.panel!.bottom - seen.sheet!.top);
        },
        { timeout: 5000 },
      )
      .toBe(150);
  });

  test("a side sheet takes its percentage from the panel's width", async ({
    page,
  }) => {
    await mount(page, {
      mode: "left",
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);

    const seen = await boxes(page);

    expect(seen.sizes).toEqual({ closed: 0, half: 150, full: 300 });
    expect(seen.sheet!.top).toBeCloseTo(seen.panel!.top, 0);
    expect(seen.sheet!.bottom).toBeCloseTo(seen.panel!.bottom, 0);
    expect(seen.sheet!.right).toBeCloseTo(seen.panel!.left + 150, 0);
  });

  test("a CSS length with a percentage resolves against the panel too", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "most", size: "calc(100% - 40px)" },
      ],
      initial: "most",
      maxHeight: "90%",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);

    const seen = await boxes(page);

    expect(seen.sizes.most).toBeCloseTo(360, 0);
    expect(seen.panel!.bottom - seen.sheet!.top).toBeCloseTo(360, 0);
  });

  test("anchors, a scrim overlay, a scrim stage and the above-sheet scrim stay inside the panel", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      scrimMode: "above-sheet",
      panel: PANEL,
    });
    await settled(page);

    const inside = await page.evaluate(() => {
      const ids = [
        window.lab.anchor({ position: "sheet-top-right" }),
        window.lab.anchor({ position: "dock-top" }),
        window.lab.scrimOverlay({ position: "top-left" }),
        ...window.lab.stages([{ for: "half", position: "center" }]),
      ];
      const panel = document.querySelector("#panel-0")!.getBoundingClientRect();
      const within = (selector: string): boolean => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.left >= panel.left - 0.5 &&
          r.right <= panel.right + 0.5 &&
          r.top >= panel.top - 0.5 &&
          r.bottom <= panel.bottom + 0.5
        );
      };
      const scrim = document.querySelector("#scrim-0")!.getBoundingClientRect();
      return {
        marks: ids.map(id => within(`#${id}`)),
        scrimLeft: Math.round(scrim.left - panel.left),
        scrimTop: Math.round(scrim.top - panel.top),
        scrimRight: Math.round(panel.right - scrim.right),
        scrimBottom: Math.round(panel.bottom - scrim.bottom),
      };
    });

    expect(inside.marks).toEqual([true, true, true, true]);
    expect(inside).toMatchObject({
      scrimLeft: 0,
      scrimTop: 0,
      scrimRight: 0,
      scrimBottom: 200,
    });
  });

  test("a sheet bound to its panel does not rise for the on-screen keyboard", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);
    const before = await boxes(page);

    await page.evaluate(() => {
      const vv = window.visualViewport!;
      const full = window.innerHeight;
      Object.defineProperty(vv, "height", {
        configurable: true,
        get: () => full - 300,
      });
      vv.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(300);

    const after = await boxes(page);
    expect(after.sizes).toEqual(before.sizes);
    expect(after.sheet).toEqual(before.sheet);
    await expect(page.locator("#sheet-0")).not.toHaveCSS(
      "--bs-keyboard-inset",
      "300px",
    );
  });

  test("destroying the sheet takes the marks off the page", async ({ page }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: PANEL,
    });
    await settled(page);
    const marked = await page.evaluate(
      () => document.querySelectorAll("[data-bs-bounds]").length,
    );

    const left = await page.evaluate(() => {
      const panel = document.querySelector("#panel-0")!;
      const root = document.querySelector("#root-0")!;
      window.lab.engine(0).destroy();
      return {
        marks: root.parentElement
          ? root.parentElement.querySelectorAll("[data-bs-bounds]").length
          : 0,
        probes: panel.querySelectorAll("[data-bs-probe]").length,
      };
    });

    expect(marked).toBe(1);
    expect(left).toEqual({ marks: 0, probes: 0 });
  });

  test("without a positioned panel the option falls back to the window", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: POINTS,
      initial: "half",
      bounds: "container",
      panel: { ...PANEL, positioned: false },
    });
    await settled(page);
    const { height } = await viewport(page);

    const seen = await boxes(page);

    expect(seen.sizes.half).toBeCloseTo(height / 2, 0);
  });
});
