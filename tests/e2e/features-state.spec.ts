import { expect, test, type Page } from "@playwright/test";
import {
  SLOW,
  drag,
  events,
  mount,
  openLab,
  settled,
  snapTo,
  state,
  viewport,
} from "./_lab";

const stack = (page: Page, index: number) =>
  page.evaluate(i => {
    const sheet = document.querySelector<HTMLElement>(`#sheet-${i}`)!;
    return {
      depth: sheet.dataset.stackDepth ?? "",
      scale: getComputedStyle(sheet).scale,
      top: window.lab.engine(i).isTop(),
      above: window.lab.engine(i).depth(),
      zIndex: Number(getComputedStyle(sheet).zIndex),
    };
  }, index);

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

test.describe("remembered and automatic state", () => {
  test("persistKey restores the last snap on the next visit", async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.removeItem("lab-sheet"));
    await mount(page, { persistKey: "lab-sheet" });
    await snapTo(page, "half");
    expect(await page.evaluate(() => localStorage.getItem("lab-sheet"))).toBe(
      "half",
    );

    await page.reload();
    await page.waitForFunction(() => !!window.lab);
    await mount(page, { persistKey: "lab-sheet" });
    expect((await state(page)).activeId).toBe("half");
    expect((await state(page)).size).toBe(300);

    await page.evaluate(() => localStorage.setItem("lab-sheet", "gone"));
    await mount(page, { persistKey: "lab-sheet" });
    expect((await state(page)).activeId).toBe("peek");

    await page.evaluate(() => localStorage.setItem("lab-sheet", "full"));
    await mount(page, {
      persistKey: "lab-sheet",
      allowed: ["closed", "peek", "half"],
    });
    expect((await state(page)).activeId).toBe("peek");
    await page.evaluate(() => localStorage.removeItem("lab-sheet"));
  });

  test("autoCollapseAfter drops an idle sheet to its smallest open snap", async ({
    page,
  }) => {
    const idle = await page.evaluate(async () => {
      window.lab.mount({ autoCollapseAfter: 300 });
      await window.lab.engine().snapTo("full");
      const landed = performance.now();
      while (window.lab.engine().state.activeId === "full") {
        if (performance.now() - landed > 3000) break;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      return performance.now() - landed;
    });
    expect(idle).toBeGreaterThan(280);
    expect(idle).toBeLessThan(1500);
    expect((await settled(page)).activeId).toBe("peek");
  });

  test("autoCollapseAfter waits for a transition in flight to land first", async ({
    page,
  }) => {
    const log = await page.evaluate(async () => {
      window.lab.mount({ autoCollapseAfter: 300, duration: 500 });
      await new Promise(resolve => setTimeout(resolve, 150));
      await window.lab.engine().snapTo("full");
      const landed = window.lab.engine().state.activeId;
      const started = performance.now();
      while (window.lab.engine().state.activeId !== "peek") {
        if (performance.now() - started > 3000) break;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      return { landed, events: window.lab.events() };
    });
    expect(log.landed).toBe("full");
    expect(log.events).toContain("snap:full");
  });

  test("linked sheets make room for the one that opens", async ({ page }) => {
    await mount(page, { initial: "closed" });
    await mount(page, { initial: "full" }, true);
    await page.evaluate(() => window.lab.link(0, 1));

    await page.evaluate(() => void window.lab.engine(0).open());
    await settled(page, 0);
    expect((await settled(page, 1)).activeId).toBe("peek");
    expect((await state(page, 0)).activeId).toBe("peek");
  });
});

test.describe("several sheets", () => {
  test("the stack tracks which sheet is on top", async ({ page }) => {
    await mount(page, { initial: "closed" });
    await mount(page, { initial: "closed" }, true);
    await page.evaluate(() => void window.lab.engine(0).snapTo("full"));
    await settled(page, 0);
    await page.evaluate(() => void window.lab.engine(1).snapTo("half"));
    await settled(page, 1);

    const lower = await stack(page, 0);
    const upper = await stack(page, 1);
    expect(lower.top).toBe(false);
    expect(lower.above).toBe(1);
    expect(upper.top).toBe(true);
    expect(upper.above).toBe(0);
    expect(upper.zIndex).toBeGreaterThan(lower.zIndex);

    await page.keyboard.press("Escape");
    expect((await settled(page, 1)).phase).toBe("closed");
    expect((await state(page, 0)).phase).toBe("open");
    expect((await stack(page, 0)).top).toBe(true);
  });

  test("stackEffect scales the sheets behind the top one", async ({ page }) => {
    await mount(page, { initial: "closed", stackEffect: true });
    await mount(page, { initial: "closed", stackEffect: true }, true);
    await page.evaluate(() => void window.lab.engine(0).snapTo("full"));
    await settled(page, 0);
    expect((await stack(page, 0)).depth).toBe("0");

    await page.evaluate(() => void window.lab.engine(1).snapTo("half"));
    await settled(page, 1);
    await expect
      .poll(async () => (await stack(page, 0)).scale)
      .toBe("0.96");
    expect((await stack(page, 0)).depth).toBe("1");
    expect((await stack(page, 1)).depth).toBe("0");

    await page.evaluate(() => void window.lab.engine(1).close());
    await settled(page, 1);
    await expect.poll(async () => (await stack(page, 0)).depth).toBe("0");
    await expect
      .poll(async () => Number((await stack(page, 0)).scale.replace("none", "1")))
      .toBe(1);
  });
});

test.describe("limits that follow the viewport", () => {
  test("a percentage maxHeight is resolved again when the viewport changes", async ({
    page,
  }) => {
    await mount(page, { initial: "full", maxHeight: "50%" });
    const { width, height } = await viewport(page);
    expect((await state(page)).size).toBeCloseTo(Math.min(500, height / 2), 0);

    await page.setViewportSize({ width, height: 480 });
    await expect
      .poll(async () => (await state(page)).size, { timeout: 3000 })
      .toBeCloseTo(240, 0);
  });

  test("percentage snaps follow a resize", async ({ page }) => {
    await mount(page, {
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "half", size: "50%" },
      ],
      initial: "half",
    });
    const { width, height } = await viewport(page);
    expect((await state(page)).size).toBeCloseTo(height / 2, 0);

    await page.setViewportSize({ width, height: 520 });
    await expect
      .poll(async () => (await state(page)).size, { timeout: 3000 })
      .toBeCloseTo(260, 0);
    expect((await state(page)).activeId).toBe("half");
  });

  test("recompute picks up a fit snap whose content grew", async ({ page }) => {
    await mount(page, {
      rows: 2,
      snapPoints: [
        { id: "closed", size: 0 },
        { id: "fit", size: "fit" },
      ],
      initial: "fit",
    });
    const before = (await state(page)).size;
    expect(before).toBeGreaterThan(100);

    await page.evaluate(() => {
      const content = document.querySelector("#content-0")!;
      for (let i = 0; i < 3; i++) {
        const row = document.createElement("div");
        row.className = "lab-row";
        row.textContent = "extra";
        content.prepend(row);
      }
      window.lab.engine().recompute();
    });
    const after = await settled(page);
    expect(after.size).toBeCloseTo(before + 3 * 45, 0);
  });
});

test.describe("where a drag may start", () => {
  test("dragFrom: handle ignores the rest of the sheet", async ({ page }) => {
    await mount(page);
    expect(await page.evaluate(() => window.lab.engine().getDragFrom())).toBe(
      "handle",
    );
    await drag(page, "#header-0 h2", { dy: -150, ...SLOW });
    expect(await events(page)).not.toContain("dragstart");
    expect((await state(page)).activeId).toBe("peek");
  });

  test("dragFrom: sheet starts a drag anywhere outside data-bs-no-drag", async ({
    page,
  }) => {
    await mount(page, { dragFrom: "sheet" });
    expect(
      (await drag(page, "#header-0 h2", { dy: -150, ...SLOW })).activeId,
    ).toBe("half");

    await page.evaluate(() =>
      document.querySelector("#header-0")!.setAttribute("data-bs-no-drag", ""),
    );
    await page.evaluate(() => window.lab.clear());
    await drag(page, "#header-0 h2", { dy: -150, ...SLOW });
    expect(await events(page)).not.toContain("dragstart");
    expect((await state(page)).activeId).toBe("half");
  });

  test("dragFrom: zones limits the drag to data-bs-drag", async ({ page }) => {
    await mount(page, { dragFrom: "zones" });
    await drag(page, "#header-0 h2", { dy: -150, ...SLOW });
    expect(await events(page)).not.toContain("dragstart");

    await page.evaluate(() =>
      document.querySelector("#header-0")!.setAttribute("data-bs-drag", ""),
    );
    expect(
      (await drag(page, "#header-0 h2", { dy: -150, ...SLOW })).activeId,
    ).toBe("half");
  });

  test("setDragFrom switches the drag surface on a live sheet", async ({
    page,
  }) => {
    await mount(page);
    await page.evaluate(() => window.lab.engine().setDragFrom("sheet"));
    expect(await page.evaluate(() => window.lab.engine().getDragFrom())).toBe(
      "sheet",
    );
    expect(
      (await drag(page, "#header-0 h2", { dy: -150, ...SLOW })).activeId,
    ).toBe("half");
  });
});
