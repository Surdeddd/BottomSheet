import { expect, test, type Page } from "@playwright/test";
import type { LabOverlayOptions } from "../../demo/fixtures/features-overlay";
import { SLOW, move, openLab, viewport } from "./_lab";

const mountOverlay = (page: Page, options: LabOverlayOptions = {}) =>
  page.evaluate(o => window.overlayLab.mount(o), options);

const call = async (page: Page, method: "open" | "close" | "toggle") => {
  await page.evaluate(name => {
    void window.overlayLab.engine()[name]();
  }, method);
  await page.waitForTimeout(40);
  return page.evaluate(() => window.overlayLab.settled());
};

const overlayEvents = (page: Page) =>
  page.evaluate(() => window.overlayLab.events());

const panel = (page: Page) =>
  page.evaluate(() => {
    const node = document.querySelector<HTMLElement>("#ovl-panel")!;
    const backdrop = document.querySelector<HTMLElement>("#ovl-backdrop")!;
    const filter = backdrop.style as CSSStyleDeclaration & {
      webkitBackdropFilter?: string;
    };
    const box = node.getBoundingClientRect();
    return {
      hidden: node.hasAttribute("hidden"),
      state: node.dataset.state ?? "",
      modal: node.getAttribute("aria-modal"),
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      width: box.width,
      height: box.height,
      backdropOpacity: Number(backdrop.style.opacity || "0"),
      backdropPointer: backdrop.style.pointerEvents,
      backdropFilter:
        filter.backdropFilter || filter.webkitBackdropFilter || "",
      parent: node.parentElement?.id || node.parentElement?.tagName || "",
    };
  });

const active = (page: Page) =>
  page.evaluate(() => document.activeElement?.id ?? "");

const swipe = async (
  page: Page,
  { at, dx = 0, dy = 0 }: { at: [number, number]; dx?: number; dy?: number },
) => {
  const box = await page.locator("#ovl-panel").boundingBox();
  const from = {
    x: box!.x + box!.width * at[0],
    y: box!.y + box!.height * at[1],
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await move(page, from, { dx, dy, ...SLOW });
  await page.mouse.up();
  await page.waitForTimeout(60);
  return page.evaluate(() => window.overlayLab.settled());
};

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

test.describe("overlay", () => {
  test("opens and closes, announcing each step", async ({ page }) => {
    await mountOverlay(page);
    const closed = await panel(page);
    expect(closed.hidden).toBe(true);
    expect(closed.state).toBe("closed");

    expect((await call(page, "open")).isOpen).toBe(true);
    const open = await panel(page);
    expect(open.hidden).toBe(false);
    expect(open.state).toBe("open");
    expect(open.modal).toBe("true");
    expect(await overlayEvents(page)).toEqual([
      "before-open",
      "open",
      "onOpen",
    ]);

    expect((await call(page, "close")).isOpen).toBe(false);
    expect((await panel(page)).hidden).toBe(true);
    expect((await overlayEvents(page)).slice(3)).toEqual([
      "before-close",
      "close:programmatic",
      "onClose",
    ]);

    expect((await call(page, "toggle")).isOpen).toBe(true);
    expect((await call(page, "toggle")).isOpen).toBe(false);
  });

  test("initialOpen opens the panel as it is built", async ({ page }) => {
    await mountOverlay(page, { initialOpen: true });
    await page.waitForTimeout(60);
    expect(
      (await page.evaluate(() => window.overlayLab.settled())).isOpen,
    ).toBe(true);
    expect((await panel(page)).state).toBe("open");
  });

  for (const edge of ["bottom", "top", "left", "right"] as const) {
    test(`${edge}: the panel rests against its edge`, async ({ page }) => {
      await mountOverlay(page, { edge });
      await call(page, "open");
      const { width, height } = await viewport(page);
      const box = await panel(page);
      if (edge === "bottom") expect(box.bottom).toBeCloseTo(height, 0);
      if (edge === "top") expect(box.top).toBeCloseTo(0, 0);
      if (edge === "left") expect(box.left).toBeCloseTo(0, 0);
      if (edge === "right") expect(box.right).toBeCloseTo(width, 0);
      if (edge === "bottom" || edge === "top") {
        expect(box.width).toBeCloseTo(width, 0);
      } else {
        expect(box.height).toBeCloseTo(height, 0);
      }
    });
  }

  test("Escape and a backdrop tap close with their own reason", async ({
    page,
  }) => {
    await mountOverlay(page);
    await call(page, "open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(60);
    await page.evaluate(() => window.overlayLab.settled());
    expect(await overlayEvents(page)).toContain("close:escape");

    await call(page, "open");
    const { width } = await viewport(page);
    await page.mouse.click(width / 2, 24);
    await page.waitForTimeout(60);
    await page.evaluate(() => window.overlayLab.settled());
    expect(await overlayEvents(page)).toContain("close:backdrop");
  });

  test("closeOnEscape and closeOnBackdrop can be turned off, also at runtime", async ({
    page,
  }) => {
    await mountOverlay(page, { closeOnEscape: false, closeOnBackdrop: false });
    await call(page, "open");
    const { width } = await viewport(page);
    await page.keyboard.press("Escape");
    await page.mouse.click(width / 2, 24);
    await page.waitForTimeout(250);
    expect((await page.evaluate(() => window.overlayLab.state())).isOpen).toBe(
      true,
    );

    await page.evaluate(() =>
      window.overlayLab.engine().setOverlay({ closeOnEscape: true }),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(60);
    expect(
      (await page.evaluate(() => window.overlayLab.settled())).isOpen,
    ).toBe(false);
  });

  test("closeOnOutsidePointer closes on a press outside the panel", async ({
    page,
  }) => {
    await mountOverlay(page, {
      closeOnOutsidePointer: true,
      backdropOpacity: 0,
      lockBodyScroll: false,
    });
    await call(page, "open");
    await page.mouse.click(40, 24);
    await page.waitForTimeout(60);
    await page.evaluate(() => window.overlayLab.settled());
    expect(await overlayEvents(page)).toContain("close:outside-pointer");
  });

  test("focus moves in, wraps and goes back where it is told", async ({
    page,
  }) => {
    await page.evaluate(() => document.getElementById("before")!.focus());
    await mountOverlay(page, { returnFocus: "#after" });
    await call(page, "open");
    expect(await active(page)).toBe("ovl-first");

    await page.evaluate(() => document.getElementById("ovl-last")!.focus());
    await page.keyboard.press("Tab");
    expect(await active(page)).toBe("ovl-first");

    await call(page, "close");
    expect(await active(page)).toBe("after");
  });

  test("initialFocus picks the focused element", async ({ page }) => {
    await mountOverlay(page, { initialFocus: "#ovl-field" });
    await call(page, "open");
    expect(await active(page)).toBe("ovl-field");
  });

  test("the page is locked while the panel is open", async ({ page }) => {
    await mountOverlay(page);
    await call(page, "open");
    expect(await page.evaluate(() => document.body.style.position)).toBe(
      "fixed",
    );
    await call(page, "close");
    expect(await page.evaluate(() => document.body.style.position)).toBe("");

    await mountOverlay(page, { lockBodyScroll: false });
    await call(page, "open");
    expect(await page.evaluate(() => document.body.style.position)).toBe("");
  });

  test("a preset sets the backdrop, and setOverlay changes it live", async ({
    page,
  }) => {
    await mountOverlay(page, { preset: "dialog" });
    await call(page, "open");
    const dialog = await panel(page);
    expect(dialog.backdropOpacity).toBe(0.6);
    expect(dialog.backdropFilter).toBe("blur(8px)");
    expect(dialog.backdropPointer).toBe("auto");

    await page.evaluate(() =>
      window.overlayLab.engine().setOverlay({ preset: "toast" }),
    );
    const toast = await panel(page);
    expect(toast.backdropOpacity).toBe(0);
    expect(toast.backdropFilter).toBe("");
    expect(toast.backdropPointer).toBe("none");

    await page.evaluate(() =>
      window.overlayLab.engine().setBackdropOpacity(0.3),
    );
    expect((await panel(page)).backdropOpacity).toBe(0.3);
  });

  test("peek leaves a strip of the closed panel on screen", async ({ page }) => {
    await mountOverlay(page, { peek: 60 });
    const { height } = await viewport(page);
    const closed = await panel(page);
    expect(closed.hidden).toBe(false);
    expect(closed.top).toBeCloseTo(height - 60, 0);

    await call(page, "open");
    expect((await panel(page)).bottom).toBeCloseTo(height, 0);
    await call(page, "close");
    expect((await panel(page)).top).toBeCloseTo(height - 60, 0);
  });

  test("swipeToClose closes past the threshold and springs back before it", async ({
    page,
  }) => {
    await mountOverlay(page, { swipeToClose: true });
    await call(page, "open");
    const height = (await panel(page)).height;

    const top: [number, number] = [0.9, 0.06];
    expect((await swipe(page, { at: top, dy: height * 0.15 })).isOpen).toBe(
      true,
    );
    expect((await panel(page)).state).toBe("open");

    expect((await swipe(page, { at: top, dy: height * 0.5 })).isOpen).toBe(
      false,
    );
    expect(await overlayEvents(page)).toContain("close:swipe");
  });

  test("swipeToClose follows the panel's edge", async ({ page }) => {
    await mountOverlay(page, { edge: "left", swipeToClose: true });
    await call(page, "open");
    const width = (await panel(page)).width;
    expect(
      (await swipe(page, { at: [0.3, 0.9], dx: width * 0.5 })).isOpen,
    ).toBe(true);
    expect(
      (await swipe(page, { at: [0.9, 0.9], dx: -width * 0.5 })).isOpen,
    ).toBe(false);
  });

  test("the panel's content can be replaced and cleared", async ({ page }) => {
    await mountOverlay(page);
    await call(page, "open");
    await page.evaluate(() => {
      const node = document.createElement("p");
      node.id = "ovl-swapped";
      node.textContent = "swapped";
      window.overlayLab.engine().setOverlayChildren(node);
    });
    await expect(page.locator("#ovl-swapped")).toBeVisible();
    expect(await page.locator("#ovl-first").count()).toBe(0);

    await page.evaluate(() => window.overlayLab.engine().clearOverlayChildren());
    expect(await page.locator("#ovl-swapped").count()).toBe(0);
  });

  test("mountTo: body moves the panel out and puts it back on destroy", async ({
    page,
  }) => {
    await mountOverlay(page, { mountTo: "body" });
    expect((await panel(page)).parent).toBe("ovl-root");
    await call(page, "open");
    expect((await panel(page)).parent).toBe("BODY");

    const parent = await page.evaluate(() => {
      window.overlayLab.engine().destroy();
      return document.querySelector("#ovl-panel")?.parentElement?.id ?? "";
    });
    expect(parent).toBe("ovl-root");
  });

  test("reduced motion opens the panel without a transition", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const elapsed = await page.evaluate(async () => {
      window.overlayLab.mount({ duration: 600 });
      const started = performance.now();
      await window.overlayLab.engine().open();
      return performance.now() - started;
    });
    expect(elapsed).toBeLessThan(300);
  });
});
