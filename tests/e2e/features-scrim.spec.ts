import { expect, test, type Page } from "@playwright/test";
import {
  events,
  mount,
  openLab,
  settled,
  snapTo,
  state,
  viewport,
} from "./_lab";

type Layer = {
  opacity: number;
  display: string;
  pointerEvents: string;
  background: string;
  blur: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const layer = (page: Page, selector: string): Promise<Layer> =>
  page.evaluate(sel => {
    const node = document.querySelector<HTMLElement>(sel)!;
    const style = node.style as CSSStyleDeclaration & {
      webkitBackdropFilter?: string;
    };
    const computed = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return {
      opacity: Number(node.style.opacity || "0"),
      display: computed.display,
      pointerEvents: computed.pointerEvents,
      background: computed.backgroundColor,
      blur: style.backdropFilter || style.webkitBackdropFilter || "",
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
    };
  }, selector);

const topmost = async (page: Page): Promise<string> => {
  const { width } = await viewport(page);
  return page.evaluate(
    x => document.elementFromPoint(x, 24)?.id ?? "",
    width / 2,
  );
};

const tapAbove = async (page: Page): Promise<void> => {
  const { width } = await viewport(page);
  await page.mouse.click(width / 2, 24);
};

const box = (page: Page, selector: string) =>
  page.evaluate(sel => {
    const node = document.querySelector<HTMLElement>(sel)!;
    const rect = node.getBoundingClientRect();
    const wrapper = node.parentElement!;
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      visibility: getComputedStyle(wrapper).visibility,
      opacity: Number(getComputedStyle(wrapper).opacity),
      pointerEvents: getComputedStyle(wrapper).pointerEvents,
      zIndex: Number(getComputedStyle(wrapper).zIndex),
    };
  }, selector);

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

test.describe("backdrop", () => {
  test("backdropRange maps progress onto the backdrop's opacity", async ({
    page,
  }) => {
    await mount(page, { backdropRange: [0.5, 1] });
    const resting = await layer(page, "#backdrop-0");
    expect(resting.opacity).toBe(0);
    expect(resting.pointerEvents).toBe("none");

    await snapTo(page, "half");
    expect((await layer(page, "#backdrop-0")).opacity).toBeCloseTo(0.2, 2);

    await snapTo(page, "full");
    const full = await layer(page, "#backdrop-0");
    expect(full.opacity).toBe(1);
    expect(full.pointerEvents).toBe("auto");
  });

  test("setBackdropRange re-maps a sheet at rest", async ({ page }) => {
    await mount(page, { initial: "half" });
    expect((await layer(page, "#backdrop-0")).opacity).toBeCloseTo(0.6, 2);
    await page.evaluate(() => window.lab.engine().setBackdropRange([0, 0.5]));
    expect((await layer(page, "#backdrop-0")).opacity).toBe(1);
  });

  test("backdropOpacity is the opacity the backdrop reaches, not where it gets there", async ({
    page,
  }) => {
    await mount(page, { initial: "half", backdropOpacity: 0.5 });
    const half = await layer(page, "#backdrop-0");
    expect(half.opacity).toBeCloseTo(0.3, 2);
    expect(half.pointerEvents).toBe("auto");

    await snapTo(page, "full");
    expect((await layer(page, "#backdrop-0")).opacity).toBe(0.5);

    await page.evaluate(() => window.lab.engine().setBackdropOpacity(0.2));
    expect((await layer(page, "#backdrop-0")).opacity).toBe(0.2);
  });

  test("backdropColor paints the backdrop and leaves the scrim layer clear", async ({
    page,
  }) => {
    await mount(page, { initial: "half", backdropColor: "rgb(10, 20, 30)" });
    expect((await layer(page, "#backdrop-0")).background).toBe(
      "rgb(10, 20, 30)",
    );
    expect((await layer(page, "#scrim-0")).background).toBe("rgba(0, 0, 0, 0)");

    await page.evaluate(() =>
      window.lab.engine().setBackdropColor("rgb(40, 50, 60)"),
    );
    expect((await layer(page, "#backdrop-0")).background).toBe(
      "rgb(40, 50, 60)",
    );
  });

  test("a backdrop with no opacity still keeps taps off the page", async ({
    page,
  }) => {
    await mount(page, { initial: "half", backdropOpacity: 0 });
    const hidden = await layer(page, "#backdrop-0");
    expect(hidden.opacity).toBe(0);
    expect(hidden.pointerEvents).toBe("auto");
  });
});

test.describe("scrim", () => {
  test("a preset sets colour, blur and range", async ({ page }) => {
    await mount(page, { initial: "half", scrimPreset: "cinematic" });
    const cinematic = await layer(page, "#scrim-0");
    expect(cinematic.background).toBe("rgba(0, 0, 0, 0.7)");
    expect(cinematic.blur).toBe("blur(12px)");
    expect(cinematic.opacity).toBeCloseTo(0.6, 2);

    await page.evaluate(() => window.lab.engine().setScrim({ preset: "subtle" }));
    const subtle = await layer(page, "#scrim-0");
    expect(subtle.background).toBe("rgba(0, 0, 0, 0.2)");
    expect(subtle.blur).toBe("");
    expect(subtle.opacity).toBeCloseTo((0.6 - 0.3) / 0.7, 2);
  });

  test("screenRange hides the scrim below its start", async ({ page }) => {
    await mount(page, { scrimColor: "rgb(10, 20, 30)", screenRange: [0.5, 1] });
    expect((await layer(page, "#scrim-0")).display).toBe("none");

    await snapTo(page, "full");
    const full = await layer(page, "#scrim-0");
    expect(full.display).not.toBe("none");
    expect(full.opacity).toBe(1);
    expect(full.background).toBe("rgb(10, 20, 30)");

    await page.evaluate(() => window.lab.engine().setScreenRange([0, 1]));
    await snapTo(page, "peek");
    expect((await layer(page, "#scrim-0")).opacity).toBeCloseTo(0.24, 2);
  });

  test("scrimMode decides how much of the screen the scrim covers", async ({
    page,
  }) => {
    await mount(page, {
      initial: "half",
      scrimMode: "above-sheet",
      scrimColor: "rgba(0, 0, 0, 0.5)",
    });
    const { height, width } = await viewport(page);
    const above = await layer(page, "#scrim-0");
    expect(above.top).toBe(0);
    expect(above.bottom).toBeCloseTo(height - 300, 0);
    expect(above.right).toBeCloseTo(width, 0);

    await snapTo(page, "full");
    expect((await layer(page, "#scrim-0")).bottom).toBeCloseTo(height - 500, 0);

    await page.evaluate(() => window.lab.engine().setScrimMode("full"));
    expect((await layer(page, "#scrim-0")).bottom).toBeCloseTo(height, 0);

    await page.evaluate(() => window.lab.engine().setScrimMode("off"));
    expect((await layer(page, "#scrim-0")).display).toBe("none");
    expect(
      await page.evaluate(() => window.lab.engine().getScrimState()),
    ).toEqual({ mode: "off", enabled: true });
  });

  for (const mode of ["top", "left", "right"] as const) {
    test(`${mode}: the above-sheet scrim stops at the sheet's edge`, async ({
      page,
    }) => {
      await mount(page, {
        mode,
        initial: "half",
        scrimMode: "above-sheet",
        scrimColor: "rgba(0, 0, 0, 0.5)",
      });
      const { height, width } = await viewport(page);
      const scrim = await layer(page, "#scrim-0");
      if (mode === "top") expect(scrim.top).toBeCloseTo(300, 0);
      if (mode === "left") expect(scrim.left).toBeCloseTo(300, 0);
      if (mode === "right") expect(scrim.right).toBeCloseTo(width - 300, 0);
      if (mode !== "top") expect(scrim.bottom).toBeCloseTo(height, 0);
    });
  }

  test("scrimTapToClose closes on a tap and steps aside when switched off", async ({
    page,
  }) => {
    await mount(page, { initial: "half", scrimTapToClose: true });
    expect(await topmost(page)).toBe("scrim-0");
    await tapAbove(page);
    expect((await settled(page)).phase).toBe("closed");
    expect(await events(page)).toContain("before-close:backdrop");

    await mount(page, { initial: "half" });
    expect(await topmost(page)).toBe("backdrop-0");
    await page.evaluate(() => window.lab.engine().setScrimTapToClose(true));
    expect(await topmost(page)).toBe("scrim-0");
    await page.evaluate(() => window.lab.engine().setScrimTapToClose(false));
    expect(await topmost(page)).toBe("backdrop-0");
  });

  test("a persistent sheet ignores a tap on the scrim", async ({ page }) => {
    await mount(page, {
      initial: "half",
      scrimTapToClose: true,
      persistent: true,
    });
    await tapAbove(page);
    await page.waitForTimeout(250);
    expect((await state(page)).phase).toBe("open");
  });

  test("scrimInteractive decides whether the scrim takes pointer input", async ({
    page,
  }) => {
    await mount(page, { initial: "half", scrimInteractive: true });
    expect(await topmost(page)).toBe("scrim-0");
    await page.evaluate(() => window.lab.engine().setScrimInteractive(false));
    expect(await topmost(page)).toBe("backdrop-0");
  });

  test("setScrimEnabled switches both dim layers off and back on", async ({
    page,
  }) => {
    await mount(page, { initial: "full", scrimColor: "rgba(0, 0, 0, 0.5)" });
    await page.evaluate(() => window.lab.engine().setScrimEnabled(false));
    expect((await layer(page, "#backdrop-0")).opacity).toBe(0);
    expect((await layer(page, "#scrim-0")).display).toBe("none");
    expect(
      await page.evaluate(() => window.lab.engine().getScrimState()),
    ).toEqual({ mode: "full", enabled: false });

    await page.evaluate(() => window.lab.engine().setScrimEnabled(true));
    expect((await layer(page, "#backdrop-0")).opacity).toBe(1);
    expect((await layer(page, "#scrim-0")).opacity).toBe(1);
  });

  test("setScrimColor and setScrimBlur apply live and clear with null", async ({
    page,
  }) => {
    await mount(page, { initial: "half" });
    await page.evaluate(() => {
      window.lab.engine().setScrimColor("rgb(200, 30, 30)");
      window.lab.engine().setScrimBlur("6px");
    });
    const tinted = await layer(page, "#scrim-0");
    expect(tinted.background).toBe("rgb(200, 30, 30)");
    expect(tinted.blur).toBe("blur(6px)");

    await page.evaluate(() => {
      window.lab.engine().setScrimColor(null);
      window.lab.engine().setScrimBlur(null);
    });
    const cleared = await layer(page, "#scrim-0");
    expect(cleared.background).toBe("rgba(0, 0, 0, 0)");
    expect(cleared.blur).toBe("");
  });

  test("setScrim applies a whole batch at once", async ({ page }) => {
    await mount(page, { initial: "half" });
    await page.evaluate(() =>
      window.lab.engine().setScrim({
        preset: "monitoring",
        mode: "above-sheet",
        tapToClose: true,
      }),
    );
    const { height } = await viewport(page);
    const scrim = await layer(page, "#scrim-0");
    expect(scrim.background).toBe("rgba(15, 15, 20, 0.55)");
    expect(scrim.blur).toBe("blur(4px)");
    expect(scrim.bottom).toBeCloseTo(height - 300, 0);
    await tapAbove(page);
    expect((await settled(page)).phase).toBe("closed");
  });
});

test.describe("elements around the sheet", () => {
  test("setScrimOverlay places a floating element and removes it", async ({
    page,
  }) => {
    await mount(page, { initial: "half" });
    const { width, height } = await viewport(page);
    const corner = await page.evaluate(() =>
      window.lab.scrimOverlay({ position: "top-right", inset: "20px" }),
    );
    const fixed = await box(page, `#${corner}`);
    expect(fixed.top).toBeCloseTo(20, 0);
    expect(fixed.right).toBeCloseTo(width - 20, 0);

    const riding = await page.evaluate(() =>
      window.lab.scrimOverlay({ position: "sheet-top-left", inset: "10px" }),
    );
    expect(await page.locator(`#${corner}`).count()).toBe(0);
    const ridden = await box(page, `#${riding}`);
    expect(ridden.left).toBeCloseTo(10, 0);
    expect(ridden.bottom).toBeCloseTo(height - 300 - 10, 0);

    await snapTo(page, "full");
    expect((await box(page, `#${riding}`)).bottom).toBeCloseTo(
      height - 500 - 10,
      0,
    );

    await page.evaluate(() => window.lab.dropExtras());
    expect(await page.locator(`#${riding}`).count()).toBe(0);
  });

  test("an anchor rides the sheet's edge and shows on the snaps it names", async ({
    page,
  }) => {
    await mount(page);
    const { width, height } = await viewport(page);
    const id = await page.evaluate(() =>
      window.lab.anchor({
        position: "sheet-top-right",
        inset: "12px",
        showOn: ["half", "full"],
        animation: "none",
      }),
    );
    expect((await box(page, `#${id}`)).visibility).toBe("hidden");

    await snapTo(page, "half");
    const shown = await box(page, `#${id}`);
    expect(shown.visibility).toBe("visible");
    expect(shown.pointerEvents).toBe("auto");
    expect(shown.right).toBeCloseTo(width - 12, 0);
    expect(shown.bottom).toBeCloseTo(height - 300 - 12, 0);
    expect(shown.zIndex).toBeGreaterThan(
      await page.evaluate(() =>
        Number(getComputedStyle(document.querySelector("#sheet-0")!).zIndex),
      ),
    );

    await snapTo(page, "full");
    expect((await box(page, `#${id}`)).bottom).toBeCloseTo(height - 500 - 12, 0);

    await snapTo(page, "peek");
    expect((await box(page, `#${id}`)).visibility).toBe("hidden");

    await page.evaluate(() => window.lab.dropExtras());
    expect(await page.locator(`#${id}`).count()).toBe(0);
  });

  test("an anchor without showOn is there whenever the sheet is open", async ({
    page,
  }) => {
    await mount(page, { initial: "closed" });
    const id = await page.evaluate(() =>
      window.lab.anchor({ position: "top-left", animation: "none" }),
    );
    expect((await box(page, `#${id}`)).visibility).toBe("hidden");

    await page.evaluate(() => void window.lab.engine().open());
    await settled(page);
    const open = await box(page, `#${id}`);
    expect(open.visibility).toBe("visible");
    expect(open.top).toBeCloseTo(16, 0);
    expect(open.left).toBeCloseTo(16, 0);

    await page.evaluate(() => void window.lab.engine().close());
    await settled(page);
    expect((await box(page, `#${id}`)).visibility).toBe("hidden");
  });

  test("showOn takes a predicate and fadeRange ties opacity to progress", async ({
    page,
  }) => {
    await mount(page);
    const id = await page.evaluate(() =>
      window.lab.anchor({
        position: "center",
        minSize: 250,
        fadeRange: [0.5, 1],
        interactive: false,
        animation: "none",
      }),
    );
    expect((await box(page, `#${id}`)).visibility).toBe("hidden");

    await snapTo(page, "half");
    const half = await box(page, `#${id}`);
    expect(half.visibility).toBe("visible");
    expect(half.pointerEvents).toBe("none");
    expect(half.opacity).toBeCloseTo(0.2, 2);

    await snapTo(page, "full");
    expect((await box(page, `#${id}`)).opacity).toBe(1);
  });

  test("a docked bar spans the screen edge and stays while the sheet is closed", async ({
    page,
  }) => {
    await mount(page, { initial: "closed" });
    const { width, height } = await viewport(page);
    const id = await page.evaluate(() =>
      window.lab.anchor({ position: "dock-bottom", animation: "none" }),
    );
    const bar = await page.evaluate(sel => {
      const wrapper = document.querySelector(sel)!.parentElement!;
      const rect = wrapper.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        visibility: getComputedStyle(wrapper).visibility,
      };
    }, `#${id}`);
    expect(bar.visibility).toBe("visible");
    expect(bar.left).toBe(0);
    expect(bar.right).toBeCloseTo(width, 0);
    expect(bar.bottom).toBeCloseTo(height, 0);
  });

  test("scrim stages swap their element by snap id and by progress", async ({
    page,
  }) => {
    await mount(page);
    const [teaser, expanded] = await page.evaluate(() =>
      window.lab.stages([
        { for: "peek" },
        { forRange: [0.5, 1], position: "top-center" },
      ]),
    );
    expect((await box(page, `#${teaser}`)).visibility).toBe("visible");
    expect((await box(page, `#${expanded}`)).visibility).toBe("hidden");

    await snapTo(page, "full");
    expect((await box(page, `#${teaser}`)).visibility).toBe("hidden");
    const shown = await box(page, `#${expanded}`);
    expect(shown.visibility).toBe("visible");
    expect(shown.top).toBeCloseTo(16, 0);

    await page.evaluate(() => window.lab.stages(null));
    expect(await page.locator(`#${teaser}`).count()).toBe(0);
    expect(await page.locator(`#${expanded}`).count()).toBe(0);
  });
});
