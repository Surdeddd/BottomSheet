import { expect, test, type Page } from "@playwright/test";
import {
  SLOW,
  centreOf,
  drag,
  events,
  mount,
  move,
  openLab,
  pointerDrag,
  press,
  settled,
  snapTo,
  state,
  touchDrag,
  viewport,
  visible,
} from "./_lab";

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

const onScreenTop = (page: Page): Promise<number> =>
  page.evaluate(
    () => document.querySelector("#sheet-0")!.getBoundingClientRect().top,
  );

test.describe("snap points", () => {
  test("pixels, percentages and full resolve against the viewport", async ({
    page,
  }) => {
    await mount(page, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "peek", size: 120 },
        { id: "half", size: "50%" },
        { id: "tall", size: "full" },
      ],
    });
    const { height } = await viewport(page);
    expect((await state(page)).size).toBe(120);
    expect(await visible(page)).toBeCloseTo(120, 0);

    expect((await snapTo(page, "half")).size).toBeCloseTo(height / 2, 0);
    expect(await visible(page)).toBeCloseTo(height / 2, 0);

    expect((await snapTo(page, "tall")).size).toBeCloseTo(height, 0);
  });

  test("any CSS length is a snap size", async ({ page }) => {
    await mount(page, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "vh", size: "40vh" },
        { id: "clamp", size: "clamp(100px, 50vh, 240px)" },
        { id: "calc", size: "calc(100vh - 200px)" },
      ],
      initial: "vh",
    });
    const { height } = await viewport(page);
    expect((await state(page)).size).toBeCloseTo(height * 0.4, 0);
    expect((await snapTo(page, "clamp")).size).toBeCloseTo(240, 0);
    expect((await snapTo(page, "calc")).size).toBeCloseTo(height - 200, 0);
  });

  test("allowed limits where the sheet can go", async ({ page }) => {
    await mount(page, { allowed: ["closed", "peek", "full"] });
    expect(
      await page.evaluate(() => window.lab.engine().getAllowedIds()),
    ).toEqual(["closed", "peek", "full"]);

    expect((await snapTo(page, "half")).activeId).toBe("peek");

    await page.focus("#handle-0");
    await page.keyboard.press("ArrowUp");
    expect((await settled(page)).activeId).toBe("full");
  });

  test("maxHeight caps the largest snap and follows setMaxHeight", async ({
    page,
  }) => {
    await mount(page, { maxHeight: 260 });
    expect((await snapTo(page, "full")).size).toBe(260);
    expect(await visible(page)).toBeCloseTo(260, 0);

    await page.evaluate(() => window.lab.engine().setMaxHeight(400));
    expect((await settled(page)).size).toBe(400);
  });

  test("getResolvedSnaps reports every point in pixels", async ({ page }) => {
    await mount(page);
    expect(
      await page.evaluate(() => [...window.lab.engine().getResolvedSnaps()]),
    ).toEqual([
      { id: "closed", size: 0 },
      { id: "peek", size: 120 },
      { id: "half", size: 300 },
      { id: "full", size: 500 },
    ]);
  });

  test("open, expand, collapse and close pick their documented targets", async ({
    page,
  }) => {
    await mount(page, { initial: "closed" });
    expect((await state(page)).phase).toBe("closed");

    await page.evaluate(() => void window.lab.engine().open());
    expect((await settled(page)).activeId).toBe("peek");

    await page.evaluate(() => void window.lab.engine().expand());
    expect((await settled(page)).activeId).toBe("full");

    await page.evaluate(() => void window.lab.engine().collapse());
    expect((await settled(page)).activeId).toBe("peek");

    await page.evaluate(() => void window.lab.engine().close());
    const closed = await settled(page);
    expect(closed.size).toBe(0);
    expect(closed.phase).toBe("closed");
  });

  test("setSnapPoints replaces the points while the sheet is open", async ({
    page,
  }) => {
    await mount(page, { initial: "half" });
    await page.evaluate(() =>
      window.lab.engine().setSnapPoints([
        { id: "closed", size: 0 },
        { id: "low", size: 100 },
        { id: "high", size: 400 },
      ]),
    );
    const after = await settled(page);
    expect(after.activeId).toBe("high");
    expect(after.size).toBe(400);
    expect(after.phase).toBe("open");
    expect(
      await page.evaluate(() => window.lab.engine().getAllowedIds()),
    ).toEqual(["closed", "low", "high"]);
    expect((await snapTo(page, "low")).size).toBe(100);
  });

  test("setAllowed moves an open sheet to the nearest point it may keep", async ({
    page,
  }) => {
    await mount(page, { initial: "half" });
    await page.evaluate(() =>
      window.lab.engine().setAllowed(["closed", "peek", "full"]),
    );
    const after = await settled(page);
    expect(after.activeId).toBe("peek");
    expect(after.phase).toBe("open");

    await page.evaluate(() =>
      window.lab.engine().setAllowed(["closed", "half", "full"], "full"),
    );
    expect((await settled(page)).activeId).toBe("full");
  });

  test("radius is applied and follows setRadius", async ({ page }) => {
    await mount(page, { radius: 12 });
    const radius = () =>
      page.evaluate(
        () =>
          getComputedStyle(document.querySelector("#sheet-0")!)
            .borderTopLeftRadius,
      );
    expect(await radius()).toBe("12px");
    await page.evaluate(() => window.lab.engine().setRadius("30px"));
    expect(await radius()).toBe("30px");
  });
});

test.describe("modes", () => {
  for (const mode of ["bottom", "top", "left", "right"] as const) {
    test(`${mode}: the sheet shows its size from that edge`, async ({
      page,
    }) => {
      await mount(page, { mode, initial: "half" });
      expect(await visible(page)).toBeCloseTo(300, 0);
      await expect(page.locator("#sheet-0")).toHaveAttribute("data-mode", mode);
      await expect(page.locator("#handle-0")).toHaveAttribute(
        "aria-orientation",
        mode === "bottom" || mode === "top" ? "vertical" : "horizontal",
      );
    });
  }

  test("start and end follow the writing direction", async ({ page }) => {
    await mount(page, { mode: "start", dir: "rtl" });
    await expect(page.locator("#sheet-0")).toHaveAttribute("data-mode", "right");
    await mount(page, { mode: "end", dir: "rtl" });
    await expect(page.locator("#sheet-0")).toHaveAttribute("data-mode", "left");
    await mount(page, { mode: "start", dir: "ltr" });
    await expect(page.locator("#sheet-0")).toHaveAttribute("data-mode", "left");
  });

  test("the sheet and its handle keep their size without a page reset", async ({
    page,
  }) => {
    await mount(page, { initial: "full" });
    const box = await page.evaluate(() => {
      const sheet = document.querySelector("#sheet-0")!;
      const handle = document.querySelector("#handle-0")!;
      return {
        reset: getComputedStyle(document.body).boxSizing,
        sheet: sheet.getBoundingClientRect().height,
        handle: handle.getBoundingClientRect().height,
      };
    });
    expect(box.reset).toBe("content-box");
    expect(box.sheet).toBe(500);
    expect(box.handle).toBe(44);
  });

  test("setMode moves an open sheet to another edge", async ({ page }) => {
    await mount(page, { initial: "half" });
    await page.evaluate(() => window.lab.engine().setMode("top"));
    const after = await settled(page);
    expect(after.activeId).toBe("half");
    expect(await page.evaluate(() => window.lab.engine().getMode())).toBe(
      "top",
    );
    await expect(page.locator("#sheet-0")).toHaveAttribute("data-mode", "top");
    expect(await visible(page)).toBeCloseTo(300, 0);
  });
});

test.describe("dragging", () => {
  test("a slow drag lands on the nearest snap", async ({ page }) => {
    await mount(page);
    const after = await drag(page, "#handle-0", { dy: -150, ...SLOW });
    expect(after.activeId).toBe("half");
    expect(after.size).toBe(300);
  });

  test("a flick carries the sheet to the next snap", async ({ page }) => {
    await mount(page);
    const after = await pointerDrag(page, "#handle-0", "mouse", {
      dy: -60,
      steps: 3,
      pause: 10,
    });
    expect(after.size).toBeGreaterThanOrEqual(300);
  });

  const NEAR = [
    { id: "closed", size: 0 },
    { id: "peek", size: 120 },
    { id: "half", size: 180 },
    { id: "full", size: 500 },
  ];

  test("dragThreshold sends a short touch drag back to where it started", async ({
    page,
  }) => {
    await mount(page, { snapPoints: NEAR, dragThreshold: 60 });
    const short = await touchDrag(page, "#handle-0", {
      dy: -40,
      steps: 10,
      pause: 50,
    });
    expect(short.activeId).toBe("peek");
    expect(short.size).toBe(120);

    await mount(page, { snapPoints: NEAR, dragThreshold: 10 });
    const counted = await touchDrag(page, "#handle-0", {
      dy: -40,
      steps: 10,
      pause: 50,
    });
    expect(counted.activeId).toBe("half");
  });

  test("flickVelocity decides when a touch flick carries the sheet further", async ({
    page,
  }) => {
    await mount(page, { flickVelocity: 0.2 });
    const flicked = await touchDrag(page, "#handle-0", {
      dy: -60,
      steps: 3,
      pause: 12,
    });
    expect(flicked.size).toBeGreaterThanOrEqual(300);

    await mount(page, { flickVelocity: 50 });
    const dragged = await touchDrag(page, "#handle-0", {
      dy: -60,
      steps: 3,
      pause: 12,
    });
    expect(dragged.activeId).toBe("peek");
  });

  test("a mouse keeps its own thresholds whatever the options say", async ({
    page,
  }) => {
    await mount(page, { snapPoints: NEAR, dragThreshold: 200 });
    const after = await drag(page, "#handle-0", { dy: -40, ...SLOW });
    expect(after.activeId).toBe("half");
  });

  test("rubberBand: false stops the sheet at its largest snap", async ({
    page,
  }) => {
    await mount(page, { initial: "full", rubberBand: false });
    const from = await press(page, "#handle-0");
    await move(page, from, { dy: -140, ...SLOW });
    expect((await state(page)).size).toBeLessThanOrEqual(500.5);
    await page.mouse.up();
    expect((await settled(page)).size).toBe(500);
  });

  test("rubberBand lets the sheet stretch past its largest snap and return", async ({
    page,
  }) => {
    await mount(page, { initial: "full", rubberBand: true });
    const from = await press(page, "#handle-0");
    await move(page, from, { dy: -140, ...SLOW });
    const stretched = (await state(page)).size;
    expect(stretched).toBeGreaterThan(500);
    expect(stretched).toBeLessThan(640);
    await page.mouse.up();
    expect((await settled(page)).size).toBe(500);
  });

  test("disableDrag blocks the gesture until it is lifted", async ({ page }) => {
    await mount(page, { disableDrag: true });
    await drag(page, "#handle-0", { dy: -150, ...SLOW });
    expect(await events(page)).not.toContain("dragstart");
    expect((await state(page)).activeId).toBe("peek");

    await page.evaluate(() => window.lab.engine().setDisableDrag(false));
    expect((await drag(page, "#handle-0", { dy: -150, ...SLOW })).activeId).toBe(
      "half",
    );
  });

  test("a drag to the bottom closes the sheet unless disableClose is set", async ({
    page,
  }) => {
    await mount(page);
    expect((await drag(page, "#handle-0", { dy: 90, steps: 4 })).size).toBe(0);

    await mount(page, { disableClose: true });
    const kept = await drag(page, "#handle-0", { dy: 90, steps: 4 });
    expect(kept.size).toBeGreaterThan(0);
    expect(kept.phase).toBe("open");
  });

  for (const [mode, pull] of [
    ["bottom", { dy: -90 }],
    ["top", { dy: 90 }],
    ["left", { dx: 90 }],
    ["right", { dx: -90 }],
  ] as const) {
    test(`${mode}: dragging the handle with a mouse selects no text`, async ({
      page,
    }) => {
      await mount(page, { mode });
      const from = await press(page, "#handle-0");
      await move(page, from, { ...pull, steps: 6, pause: 20 });

      expect((await state(page)).size).toBeGreaterThan(150);
      expect(
        await page.evaluate(() => getSelection()?.toString().trim() ?? ""),
      ).toBe("");
      await page.mouse.up();
    });
  }

  test("the sheet's chrome cannot be selected, its content can", async ({
    page,
  }) => {
    await mount(page);
    const selectable = (selector: string): Promise<boolean> =>
      page.evaluate(sel => {
        const style = getComputedStyle(document.querySelector(sel)!);
        const value =
          style.getPropertyValue("-webkit-user-select") ||
          style.getPropertyValue("user-select");
        return value !== "none";
      }, selector);

    expect(await selectable("#sheet-0")).toBe(false);
    expect(await selectable("#handle-0")).toBe(false);
    expect(await selectable("#content-0")).toBe(true);
  });

  test("a drag that runs past the sheet selects no text of the page behind it", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const text = document.createElement("p");
      text.textContent = "Words on the page behind the sheet. ".repeat(400);
      text.style.cssText =
        "position:fixed;inset:0;margin:0;overflow:hidden;font-size:16px";
      document.body.prepend(text);
    });
    await mount(page, { initial: "full", backdropOpacity: 0 });

    const from = await press(page, "#handle-0");
    const pulled = await move(page, from, { dy: -160, ...SLOW });

    expect(pulled.y).toBeLessThan((await onScreenTop(page)) - 20);

    expect(await page.evaluate(() => getSelection()!.toString().trim())).toBe(
      "",
    );
    await page.mouse.up();
    await settled(page);
  });

  test("a drag reports dragstart, drag and dragend before the snap", async ({
    page,
  }) => {
    await mount(page);
    await page.evaluate(() => window.lab.clear());
    await drag(page, "#handle-0", { dy: -150, ...SLOW });
    const log = await events(page);
    expect(log[0]).toBe("dragstart");
    expect(log.indexOf("dragend")).toBeGreaterThan(0);
    expect(log.indexOf("snap:half")).toBeGreaterThan(log.indexOf("dragend"));
    expect(await page.evaluate(() => window.lab.drags())).toBeGreaterThan(3);
  });
});

test.describe("keyboard", () => {
  test("arrows step through the snaps, End and Home jump", async ({ page }) => {
    await mount(page);
    await page.focus("#handle-0");
    await page.keyboard.press("ArrowUp");
    expect((await settled(page)).activeId).toBe("half");
    await page.keyboard.press("ArrowUp");
    expect((await settled(page)).activeId).toBe("full");
    await page.keyboard.press("ArrowDown");
    expect((await settled(page)).activeId).toBe("half");
    await page.keyboard.press("End");
    expect((await settled(page)).activeId).toBe("full");
    await page.keyboard.press("Home");
    expect((await settled(page)).activeId).toBe("closed");
  });

  const expanding = [
    ["top", "ArrowDown", "ArrowUp"],
    ["left", "ArrowRight", "ArrowLeft"],
    ["right", "ArrowLeft", "ArrowRight"],
  ] as const;
  for (const [mode, grow, shrink] of expanding) {
    test(`${mode}: ${grow} grows the sheet away from its edge`, async ({
      page,
    }) => {
      await mount(page, { mode });
      await page.focus("#handle-0");
      await page.keyboard.press(grow);
      expect((await settled(page)).activeId).toBe("half");
      await page.keyboard.press(shrink);
      expect((await settled(page)).activeId).toBe("peek");
    });
  }

  test("Escape closes the sheet, and closeOnEscape: false keeps it", async ({
    page,
  }) => {
    await mount(page);
    await page.keyboard.press("Escape");
    expect((await settled(page)).phase).toBe("closed");
    expect(await events(page)).toContain("before-close:escape");

    await mount(page, { closeOnEscape: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    expect((await state(page)).phase).toBe("open");
  });

  test("the handle exposes the active snap as a slider value", async ({
    page,
  }) => {
    await mount(page);
    const handle = page.locator("#handle-0");
    await expect(handle).toHaveAttribute("aria-valuemin", "0");
    await expect(handle).toHaveAttribute("aria-valuemax", "3");
    await expect(handle).toHaveAttribute("aria-valuenow", "1");
    await expect(handle).toHaveAttribute("aria-valuetext", "peek");
    await snapTo(page, "full");
    await expect(handle).toHaveAttribute("aria-valuenow", "3");
    await expect(handle).toHaveAttribute("aria-valuetext", "full");
  });
});
