import { expect, test, type Page } from "@playwright/test";
import { SLOW, move, openLab, viewport } from "./_lab";

const SNAPS = 'snap-points="closed:0,peek:120,half:300,full:500"';

const markup = (attrs = "", inner = "<p>content</p>"): string =>
  `<bottom-sheet ${SNAPS} initial="peek" animation="tween" ${attrs}>${inner}</bottom-sheet>`;

const mountEl = (
  page: Page,
  html: string,
  veto: { snap?: string; close?: boolean } = {},
) =>
  page.evaluate(([m, v]) => window.elementLab.mount(m, v), [html, veto] as const);

const elState = (page: Page) => page.evaluate(() => window.elementLab.state());

const elSettled = (page: Page) =>
  page.evaluate(() => window.elementLab.settled());

const elEvents = (page: Page) =>
  page.evaluate(() => window.elementLab.events());

const elSnap = async (page: Page, id: string) => {
  await page.evaluate(snap => {
    void window.elementLab.el().snapTo(snap);
  }, id);
  return elSettled(page);
};

const setAttr = (page: Page, name: string, value: string | null) =>
  page.evaluate(
    ([n, v]) => {
      const el = window.elementLab.el();
      if (v === null) el.removeAttribute(n);
      else el.setAttribute(n, v);
    },
    [name, value] as const,
  );

const partBox = (page: Page, name: string) =>
  page.evaluate(n => window.elementLab.box(n), name);

const partStyle = (page: Page, name: string, property: string) =>
  page.evaluate(
    ([n, p]) =>
      getComputedStyle(window.elementLab.part(n)).getPropertyValue(p),
    [name, property] as const,
  );

test.beforeEach(async ({ page }) => {
  await openLab(page);
});

test.describe("<bottom-sheet> attributes", () => {
  test("shorthand snap points, initial and allowed build the sheet", async ({
    page,
  }) => {
    await mountEl(page, markup('allowed="closed,peek,full"'));
    const state = await elState(page);
    expect(state?.activeId).toBe("peek");
    expect(state?.size).toBe(120);
    expect(
      await page.evaluate(() => [
        ...window.elementLab.el().getEngine()!.getResolvedSnaps(),
      ]),
    ).toEqual([
      { id: "closed", size: 0 },
      { id: "peek", size: 120 },
      { id: "half", size: 300 },
      { id: "full", size: 500 },
    ]);
    expect(
      await page.evaluate(() =>
        window.elementLab.el().getEngine()!.getAllowedIds(),
      ),
    ).toEqual(["closed", "peek", "full"]);
  });

  test("JSON snap points take any CSS size", async ({ page }) => {
    await mountEl(
      page,
      `<bottom-sheet snap-points='[{"id":"min","size":96},{"id":"half","size":"50%"}]' initial="half" animation="tween"><p>content</p></bottom-sheet>`,
    );
    const { height } = await viewport(page);
    expect((await elState(page))?.size).toBeCloseTo(height / 2, 0);
  });

  test("the sheet and its handle are the size they declare inside the shadow root", async ({
    page,
  }) => {
    await mountEl(page, markup());
    expect(await page.evaluate(() => window.elementLab.visible())).toBeCloseTo(
      120,
      0,
    );
    expect((await partBox(page, "sheet")).height).toBe(500);
    expect((await partBox(page, "handle")).height).toBe(44);
  });

  test("mode puts the sheet on another edge, and changes in place", async ({
    page,
  }) => {
    await mountEl(page, markup('mode="left"'));
    expect(await partStyle(page, "sheet", "left")).toBe("0px");
    expect(await page.evaluate(() => window.elementLab.visible())).toBeCloseTo(
      120,
      0,
    );

    const same = await page.evaluate(() => {
      const el = window.elementLab.el();
      const before = el.getEngine();
      el.setAttribute("mode", "top");
      return before === el.getEngine();
    });
    expect(same).toBe(true);
    await elSettled(page);
    expect(
      await page.evaluate(() =>
        window.elementLab.part("sheet").getAttribute("data-mode"),
      ),
    ).toBe("top");
  });

  test("radius, max-height and scrim-color apply to a live sheet", async ({
    page,
  }) => {
    await mountEl(page, markup('radius="12"'));
    expect(await partStyle(page, "sheet", "border-top-left-radius")).toBe(
      "12px",
    );
    await setAttr(page, "radius", "28px");
    expect(await partStyle(page, "sheet", "border-top-left-radius")).toBe(
      "28px",
    );

    await setAttr(page, "max-height", "260");
    expect((await elSnap(page, "full")).size).toBe(260);

    await setAttr(page, "scrim-color", "rgb(20, 40, 60)");
    expect(await partStyle(page, "screen", "background-color")).toBe(
      "rgb(20, 40, 60)",
    );
  });

  test("the snap attribute and property move the sheet", async ({ page }) => {
    await mountEl(page, markup());
    await setAttr(page, "snap", "half");
    expect((await elSettled(page)).activeId).toBe("half");

    await page.evaluate(() => {
      window.elementLab.el().snap = "full";
    });
    expect((await elSettled(page)).activeId).toBe("full");
    expect(await page.evaluate(() => window.elementLab.el().snap)).toBe("full");
  });

  test("at creation the snap attribute wins over initial", async ({ page }) => {
    await mountEl(page, markup('snap="half"'));
    expect((await elState(page))?.activeId).toBe("half");
  });

  test("persistent, disable-close and disable-drag switch on a live sheet", async ({
    page,
  }) => {
    await mountEl(page, markup());
    const el = () => page.evaluate(() => window.elementLab.el().canDismiss());
    expect(await el()).toBe(true);
    await setAttr(page, "persistent", "true");
    expect(await el()).toBe(false);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    expect((await elState(page))?.phase).toBe("open");
    await setAttr(page, "persistent", "false");

    await setAttr(page, "disable-close", "true");
    await page.evaluate(() => void window.elementLab.el().close());
    await page.waitForTimeout(250);
    expect((await elState(page))?.phase).toBe("open");
    await setAttr(page, "disable-close", "false");

    await setAttr(page, "disable-drag", "true");
    const handle = await partBox(page, "handle");
    const from = {
      x: handle.left + handle.width / 2,
      y: handle.top + handle.height / 2,
    };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await move(page, from, { dy: -150, ...SLOW });
    await page.mouse.up();
    expect((await elSettled(page)).activeId).toBe("peek");
    expect(await elEvents(page)).not.toContain("drag-start");
  });

  test("an attribute that rebuilds the engine keeps the active snap", async ({
    page,
  }) => {
    await mountEl(page, markup());
    await elSnap(page, "half");
    const rebuilt = await page.evaluate(() => {
      const el = window.elementLab.el();
      const before = el.getEngine();
      el.setAttribute("animation", "linear");
      return before !== el.getEngine();
    });
    expect(rebuilt).toBe(true);
    expect((await elState(page))?.activeId).toBe("half");
  });

  test("backdrop, sheet-label and focus-trap shape the dialog", async ({
    page,
  }) => {
    await mountEl(
      page,
      markup('backdrop="false" sheet-label="Filters" focus-trap="true"'),
    );
    expect(await partStyle(page, "backdrop", "display")).toBe("none");
    const dialog = await page.evaluate(() => {
      const sheet = window.elementLab.part("sheet");
      return {
        role: sheet.getAttribute("role"),
        label: sheet.getAttribute("aria-label"),
        modal: sheet.getAttribute("aria-modal"),
      };
    });
    expect(dialog).toEqual({ role: "dialog", label: "Filters", modal: "true" });
  });

  test("close-on-escape and lock-body-scroll can be turned off", async ({
    page,
  }) => {
    await mountEl(page, markup());
    expect(await page.evaluate(() => document.body.style.position)).toBe(
      "fixed",
    );
    await page.keyboard.press("Escape");
    expect((await elSettled(page)).phase).toBe("closed");

    await mountEl(
      page,
      markup('close-on-escape="false" lock-body-scroll="false"'),
    );
    expect(await page.evaluate(() => document.body.style.position)).toBe("");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    expect((await elState(page))?.phase).toBe("open");
  });

  test("return-focus-to names where focus lands on close", async ({ page }) => {
    await mountEl(page, markup('return-focus-to="#after"'));
    await page.evaluate(() => void window.elementLab.el().close());
    await elSettled(page);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("after");
  });

  test("stylesheet links a sheet into the shadow root", async ({ page }) => {
    await mountEl(page, markup('stylesheet="/fixtures/missing.css"'));
    expect(
      await page.evaluate(
        () =>
          window.elementLab
            .el()
            .shadowRoot!.querySelector<HTMLLinkElement>("link[rel=stylesheet]")
            ?.getAttribute("href") ?? "",
      ),
    ).toBe("/fixtures/missing.css");
  });
});

test.describe("<bottom-sheet> behaviour", () => {
  test("slots project the header, the content and the footer", async ({
    page,
  }) => {
    await mountEl(
      page,
      markup(
        "",
        '<h2 slot="header" id="el-title">Title</h2><p id="el-body">Body</p><button slot="footer" id="el-apply" type="button">Apply</button>',
      ),
    );
    await elSnap(page, "full");
    const header = await partBox(page, "header");
    const content = await partBox(page, "content");
    const footer = await partBox(page, "footer");
    const title = await page.locator("#el-title").boundingBox();
    const body = await page.locator("#el-body").boundingBox();
    const apply = await page.locator("#el-apply").boundingBox();
    expect(title!.y).toBeGreaterThanOrEqual(header.top);
    expect(title!.y + title!.height).toBeLessThanOrEqual(
      header.top + header.height + 0.5,
    );
    expect(body!.y).toBeGreaterThanOrEqual(content.top);
    expect(apply!.y).toBeGreaterThanOrEqual(footer.top);
    expect(footer.top).toBeGreaterThan(content.top);
  });

  test("an empty header and footer take no room", async ({ page }) => {
    await mountEl(page, markup());
    expect(await partStyle(page, "header", "display")).toBe("none");
    expect(await partStyle(page, "footer", "display")).toBe("none");
  });

  test("the element dispatches the engine's events in order", async ({
    page,
  }) => {
    await mountEl(page, markup().replace('initial="peek"', 'initial="closed"'));
    await page.evaluate(() => void window.elementLab.el().open());
    await elSettled(page);
    expect(await elEvents(page)).toEqual([
      "before-snap:peek",
      "open:peek",
      "snap:peek",
      "opened:peek",
    ]);

    await page.evaluate(() => {
      window.elementLab.clear();
      void window.elementLab.el().close();
    });
    await elSettled(page);
    expect(await elEvents(page)).toEqual([
      "before-close:programmatic",
      "before-snap:closed",
      "close",
      "snap:closed",
      "closed",
    ]);
  });

  test("preventDefault on before-snap and before-close vetoes the move", async ({
    page,
  }) => {
    await mountEl(page, markup(), { snap: "full", close: true });
    await page.evaluate(() => void window.elementLab.el().snapTo("full"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const state = await elState(page);
    expect(state?.activeId).toBe("peek");
    expect(state?.phase).toBe("open");
    const log = await elEvents(page);
    expect(log).toContain("before-snap:full");
    expect(log).toContain("before-close:escape");
    expect(log).not.toContain("snap:full");
    expect(log).not.toContain("close");
  });

  test("the imperative methods mirror the engine", async ({ page }) => {
    await mountEl(page, markup());
    await page.evaluate(() => void window.elementLab.el().expand());
    expect((await elSettled(page)).activeId).toBe("full");
    await page.evaluate(() => void window.elementLab.el().collapse());
    expect((await elSettled(page)).activeId).toBe("peek");

    await page.evaluate(() =>
      window.elementLab.el().setAllowed(["closed", "half"], "half"),
    );
    expect((await elSettled(page)).activeId).toBe("half");

    await page.evaluate(() => window.elementLab.el().setRadius(30));
    expect(await partStyle(page, "sheet", "border-top-left-radius")).toBe(
      "30px",
    );
    await page.evaluate(() => window.elementLab.el().setMaxHeight(200));
    expect((await elSettled(page)).size).toBe(200);

    expect(
      await page.evaluate(() => ({
        top: window.elementLab.el().isTop(),
        depth: window.elementLab.el().depth(),
        dismiss: window.elementLab.el().canDismiss(),
      })),
    ).toEqual({ top: true, depth: 0, dismiss: true });

    await page.evaluate(() => void window.elementLab.el().close());
    expect((await elSettled(page)).phase).toBe("closed");
    await page.evaluate(() => void window.elementLab.el().open());
    expect((await elSettled(page)).phase).toBe("open");
  });

  test("the handle inside the shadow root takes the keyboard and the pointer", async ({
    page,
  }) => {
    await mountEl(page, markup());
    await page.evaluate(() => window.elementLab.part("handle").focus());
    await page.keyboard.press("ArrowUp");
    expect((await elSettled(page)).activeId).toBe("half");
    await page.keyboard.press("End");
    expect((await elSettled(page)).activeId).toBe("full");

    const handle = await partBox(page, "handle");
    const from = {
      x: handle.left + handle.width / 2,
      y: handle.top + handle.height / 2,
    };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await move(page, from, { dy: 190, ...SLOW });
    await page.mouse.up();
    expect((await elSettled(page)).activeId).toBe("half");
    const log = await elEvents(page);
    expect(log).toContain("drag-start");
    expect(log).toContain("drag-end");
  });

  test("a backdrop tap closes the sheet unless it is persistent", async ({
    page,
  }) => {
    const { width } = await viewport(page);
    await mountEl(page, markup().replace('initial="peek"', 'initial="half"'));
    await page.mouse.click(width / 2, 24);
    expect((await elSettled(page)).phase).toBe("closed");
    expect(await elEvents(page)).toContain("before-close:backdrop");

    await mountEl(
      page,
      markup('persistent="true"').replace('initial="peek"', 'initial="half"'),
    );
    await page.mouse.click(width / 2, 24);
    await page.waitForTimeout(250);
    expect((await elState(page))?.phase).toBe("open");
  });

  test("a child with slot=anchor rides the sheet", async ({ page }) => {
    await mountEl(
      page,
      markup(
        "",
        '<button slot="anchor" id="el-anchor" type="button" data-position="sheet-top-right" data-show-on="half,full" data-animation="none" data-inset="14px">x</button><p>content</p>',
      ),
    );
    const anchor = page.locator("#el-anchor");
    await expect(anchor).toBeHidden();

    await elSnap(page, "half");
    await expect(anchor).toBeVisible();
    const { width, height } = await viewport(page);
    const box = await anchor.boundingBox();
    expect(box!.x + box!.width).toBeCloseTo(width - 14, 0);
    expect(box!.y + box!.height).toBeCloseTo(height - 300 - 14, 0);
  });

  test("defineBottomSheet registers the element under another name", async ({
    page,
  }) => {
    const size = await page.evaluate(() => {
      window.elementLab.define("lab-sheet");
      const node = document.createElement("lab-sheet") as HTMLElement & {
        sheetState: { size: number } | null;
      };
      node.setAttribute("snap-points", "closed:0,open:220");
      node.setAttribute("initial", "open");
      document.getElementById("element-mount")!.append(node);
      const result = node.sheetState?.size ?? -1;
      node.remove();
      return result;
    });
    expect(size).toBe(220);
  });
});
