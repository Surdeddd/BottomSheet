import { expect, test, type Page } from "@playwright/test";
import { events, mount, openLab, settled, snapTo, state } from "./_lab";

const active = (page: Page) =>
  page.evaluate(() => document.activeElement?.id ?? "");

const focus = (page: Page, selector: string) =>
  page.evaluate(sel => {
    document.querySelector<HTMLElement>(sel)!.focus();
  }, selector);

const call = (page: Page, method: "open" | "close" | "expand" | "collapse") =>
  page.evaluate(name => {
    void window.lab.engine()[name]();
  }, method);

const inertIds = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("[inert]"), node => node.id),
  );

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

test.describe("focus", () => {
  test("focusTrap takes focus when the sheet opens and gives it back", async ({
    page,
  }) => {
    await focus(page, "#before");
    await mount(page, { initial: "closed", focusTrap: true });
    expect(await active(page)).toBe("before");

    await call(page, "open");
    await settled(page);
    expect(await active(page)).toBe("handle-0");

    await call(page, "close");
    await settled(page);
    expect(await active(page)).toBe("before");
  });

  test("Tab wraps at both ends of the sheet", async ({ page }) => {
    await mount(page, { focusTrap: true });
    await focus(page, "#last-0");
    await page.keyboard.press("Tab");
    expect(await active(page)).toBe("handle-0");
    await page.keyboard.press("Shift+Tab");
    expect(await active(page)).toBe("last-0");
  });

  test("focus that leaves the sheet is brought back, except into data-bs-focus-allow", async ({
    page,
  }) => {
    await mount(page, { focusTrap: true });
    await focus(page, "#outside-plain");
    expect(await active(page)).toBe("handle-0");

    await focus(page, "#outside-allowed");
    expect(await active(page)).toBe("outside-allowed");
  });

  test("the trap lets go once the sheet is closed", async ({ page }) => {
    await mount(page, { focusTrap: true });
    await call(page, "close");
    await settled(page);
    await focus(page, "#outside-plain");
    expect(await active(page)).toBe("outside-plain");
  });

  test("initialFocus picks the element, false focuses the sheet itself", async ({
    page,
  }) => {
    await mount(page, { focusTrap: true, initialFocus: "#field-0" });
    expect(await active(page)).toBe("field-0");

    await focus(page, "#before");
    await mount(page, { focusTrap: true, initialFocus: false });
    expect(await active(page)).toBe("sheet-0");
    await expect(page.locator("#sheet-0")).toHaveAttribute("tabindex", "-1");
  });

  test("returnFocusTo names where focus goes on close", async ({ page }) => {
    await focus(page, "#before");
    await mount(page, {
      initial: "closed",
      focusTrap: true,
      returnFocusTo: "#after",
    });
    await call(page, "open");
    await settled(page);
    await call(page, "close");
    await settled(page);
    expect(await active(page)).toBe("after");
  });
});

test.describe("the page behind the sheet", () => {
  const body = (page: Page) =>
    page.evaluate(() => ({
      position: document.body.style.position,
      top: document.body.style.top,
      scrollY: window.scrollY,
      pageTop: document.querySelector("#before")!.getBoundingClientRect().top,
    }));

  test("lockBodyScroll pins the page where it was and restores it", async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, 400));
    await mount(page, { initial: "closed" });
    const free = await body(page);
    expect(free.scrollY).toBe(400);
    expect(free.position).toBe("");

    await call(page, "open");
    await settled(page);
    const locked = await body(page);
    expect(locked.position).toBe("fixed");
    expect(locked.top).toBe("-400px");
    expect(locked.pageTop).toBeCloseTo(free.pageTop, 0);

    await page.evaluate(() => window.scrollBy(0, 600));
    expect((await body(page)).pageTop).toBeCloseTo(free.pageTop, 0);

    await call(page, "close");
    await settled(page);
    const released = await body(page);
    expect(released.position).toBe("");
    expect(released.scrollY).toBe(400);
  });

  test("lockBodyScroll: false leaves the page scrollable", async ({ page }) => {
    await mount(page, { lockBodyScroll: false });
    expect((await body(page)).position).toBe("");
    await page.evaluate(() => window.scrollTo(0, 300));
    expect((await body(page)).scrollY).toBe(300);
  });

  test("inertSiblings makes everything outside the sheet inert while it is open", async ({
    page,
  }) => {
    await mount(page, { initial: "closed", inertSiblings: true });
    expect(await inertIds(page)).toEqual([]);

    await call(page, "open");
    await settled(page);
    const ids = await inertIds(page);
    expect(ids).toEqual(
      expect.arrayContaining(["app", "sibling", "portal", "outside-plain"]),
    );
    expect(ids).not.toContain("mount");
    expect(ids).not.toContain("root-0");

    await call(page, "close");
    await settled(page);
    expect(await inertIds(page)).toEqual([]);
  });
});

test.describe("dismissal", () => {
  const tapBackdrop = async (page: Page) => {
    const width = await page.evaluate(() => innerWidth);
    await page.mouse.click(width / 2, 24);
  };

  test("a backdrop tap closes the sheet", async ({ page }) => {
    await mount(page, { initial: "half" });
    await tapBackdrop(page);
    expect((await settled(page)).phase).toBe("closed");
    expect(await events(page)).toContain("before-close:backdrop");
  });

  test("persistent refuses the backdrop and Escape, not close()", async ({
    page,
  }) => {
    await mount(page, { initial: "half", persistent: true });
    expect(await page.evaluate(() => window.lab.engine().canDismiss())).toBe(
      false,
    );
    await tapBackdrop(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    expect((await state(page)).phase).toBe("open");

    await page.evaluate(() => window.lab.engine().setPersistent(false));
    expect(await page.evaluate(() => window.lab.engine().canDismiss())).toBe(
      true,
    );
    await page.keyboard.press("Escape");
    expect((await settled(page)).phase).toBe("closed");

    await mount(page, { initial: "half", persistent: true });
    await call(page, "close");
    expect((await settled(page)).phase).toBe("closed");
  });

  test("disableClose refuses every way out until it is lifted", async ({
    page,
  }) => {
    await mount(page, { initial: "half", disableClose: true });
    await call(page, "close");
    await page.keyboard.press("Escape");
    await tapBackdrop(page);
    await page.waitForTimeout(250);
    expect((await state(page)).activeId).toBe("half");

    await page.focus("#handle-0");
    await page.keyboard.press("Home");
    const lowest = await settled(page);
    expect(lowest.activeId).toBe("peek");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
    expect((await state(page)).activeId).toBe("peek");

    await page.evaluate(() => window.lab.engine().setDisableClose(false));
    await call(page, "close");
    expect((await settled(page)).phase).toBe("closed");
  });

  test("a before-snap listener can veto one snap and let the others through", async ({
    page,
  }) => {
    await mount(page, { veto: "full" });
    await page.evaluate(() => void window.lab.engine().snapTo("full"));
    await page.waitForTimeout(250);
    expect((await state(page)).activeId).toBe("peek");
    const log = await events(page);
    expect(log).toContain("before-snap:full");
    expect(log).not.toContain("snap:full");

    expect((await snapTo(page, "half")).activeId).toBe("half");
  });

  test("a before-close listener can keep the sheet open", async ({ page }) => {
    await mount(page, { initial: "half", vetoClose: true });
    await page.keyboard.press("Escape");
    await call(page, "close");
    await page.waitForTimeout(250);
    expect((await state(page)).phase).toBe("open");
    const log = await events(page);
    expect(log).toContain("before-close:escape");
    expect(log).toContain("before-close:programmatic");
    expect(log).not.toContain("close");
  });
});

test.describe("events", () => {
  test("opening and closing announce themselves in order", async ({ page }) => {
    await mount(page, { initial: "closed" });
    await page.evaluate(() => window.lab.clear());

    await call(page, "open");
    await settled(page);
    expect(await events(page)).toEqual([
      "before-snap:peek",
      "open:peek",
      "snap:peek",
      "opened:peek",
    ]);

    await page.evaluate(() => window.lab.clear());
    await call(page, "close");
    await settled(page);
    expect(await events(page)).toEqual([
      "before-close:programmatic",
      "before-snap:closed",
      "close",
      "snap:closed",
      "closed",
    ]);
  });

  test("a snap between two open points fires neither open nor close", async ({
    page,
  }) => {
    await mount(page);
    await page.evaluate(() => window.lab.clear());
    await snapTo(page, "full");
    expect(await events(page)).toEqual(["before-snap:full", "snap:full"]);
    expect(await page.evaluate(() => window.lab.snaps())).toEqual([
      { id: "full", size: 500, progress: 1 },
    ]);
  });

  test("a sheet born open stays silent", async ({ page }) => {
    await mount(page, { initial: "half" });
    await page.waitForTimeout(200);
    expect(await events(page)).toEqual([]);
  });

  test("an open reversed half-way lands closed without opened", async ({
    page,
  }) => {
    await mount(page, { initial: "closed", duration: 600 });
    await page.evaluate(async () => {
      window.lab.clear();
      void window.lab.engine().open();
      await new Promise(resolve => setTimeout(resolve, 150));
      void window.lab.engine().close();
    });
    const after = await settled(page);
    expect(after.phase).toBe("closed");
    const log = (await events(page)).filter(
      entry => !entry.startsWith("before-") && !entry.startsWith("snap:"),
    );
    expect(log).toEqual(["open:peek", "close", "closed"]);
  });

  test("a close reversed half-way lands open without closed", async ({
    page,
  }) => {
    await mount(page, { initial: "half", duration: 600 });
    await page.evaluate(async () => {
      window.lab.clear();
      void window.lab.engine().close();
      await new Promise(resolve => setTimeout(resolve, 150));
      void window.lab.engine().snapTo("half");
    });
    const after = await settled(page);
    expect(after.phase).toBe("open");
    const log = (await events(page)).filter(
      entry => !entry.startsWith("before-") && !entry.startsWith("snap:"),
    );
    expect(log).toEqual(["close", "open:half", "opened:half"]);
  });

  test("progress runs from 0 to 1 across the allowed range", async ({ page }) => {
    await mount(page, { initial: "closed", duration: 200 });
    await page.evaluate(() => window.lab.clear());
    await snapTo(page, "full");
    const values = await page.evaluate(() => window.lab.progress());
    expect(values.length).toBeGreaterThan(3);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(values[values.length - 1]).toBe(1);
    expect((await state(page)).progress).toBe(1);
    await expect(page.locator("#sheet-0")).toHaveCSS("--bs-progress", "1");
  });

  test("dragTo moves the sheet to any size without changing its snap", async ({
    page,
  }) => {
    await mount(page);
    await page.evaluate(() => window.lab.engine().dragTo(210));
    const after = await state(page);
    expect(after.size).toBe(210);
    expect(after.activeId).toBe("peek");
  });
});
