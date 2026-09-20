import { expect, test, type Page } from "@playwright/test";

type Sheets = Record<
  string,
  {
    open: (id: string) => Promise<void>;
    snapTo: (id: string) => Promise<void>;
    close: () => Promise<void>;
    state: { size: number };
  }
>;

const openAt = (page: Page, name: string, id: string): Promise<void> =>
  page.evaluate(
    async ([n, snap]) => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      await sheets[n as string]!.open(snap as string);
      await new Promise(r => setTimeout(r, 60));
    },
    [name, id],
  );

const endOfList = (page: Page, name: string) =>
  page.evaluate(n => {
    const content = document.querySelector(
      `.bs-content[data-case="${n}"]`,
    ) as HTMLElement;
    content.scrollTop = content.scrollHeight;
    const last = content.querySelector('[data-row="100"]') as HTMLElement;
    const rect = last.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    return {
      viewport: window.innerHeight,
      lastRowTop: rect.top,
      lastRowBottom: rect.bottom,
      boxBelowViewport: Math.max(0, box.bottom - window.innerHeight),
      inset: parseFloat(
        getComputedStyle(content, "::after").height.replace("px", ""),
      ),
    };
  }, name);

const footerAt = (page: Page, name: string) =>
  page.evaluate(n => {
    const sheet = document.querySelector(
      `.bs-sheet[data-case="${n}"]`,
    ) as HTMLElement;
    const footer = sheet.querySelector(".bs-footer") as HTMLElement;
    const handle = sheet.querySelector(".bs-handle") as HTMLElement;
    const rect = footer.getBoundingClientRect();
    return {
      viewport: window.innerHeight,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      handleBottom: handle.getBoundingClientRect().bottom,
      transform: getComputedStyle(footer).transform,
    };
  }, name);

const trackFooter = (
  page: Page,
  name: string,
  action: "snapTo" | "close",
  id: string,
) =>
  page.evaluate(
    async ([n, act, snap]) => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const sheet = document.querySelector(
        `.bs-sheet[data-case="${n}"]`,
      ) as HTMLElement;
      const footer = sheet.querySelector(".bs-footer") as HTMLElement;
      const handle = sheet.querySelector(".bs-handle") as HTMLElement;
      const vh = window.innerHeight;
      const edge: number[] = [];
      const overHandle: number[] = [];
      const sample = (): void => {
        const rect = footer.getBoundingClientRect();
        edge.push(rect.bottom - vh);
        overHandle.push(handle.getBoundingClientRect().bottom - rect.top);
      };
      const painted = (): Promise<void> =>
        new Promise(resolve =>
          requestAnimationFrame(() => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => resolve();
            channel.port2.postMessage(0);
          }),
        );
      let done = false;
      const engine = sheets[n as string]!;
      const run = act === "close" ? engine.close() : engine.snapTo(snap as string);
      void run.then(() => {
        done = true;
      });
      while (!done) {
        sample();
        await painted();
      }
      for (let i = 0; i < 6; i++) {
        sample();
        await painted();
      }
      return { edge, overHandle };
    },
    [name, action, id],
  );

test.describe("fitContentToSnap keeps the whole list reachable", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/content-fit.html");
    await page.waitForSelector('.bs-sheet[data-case="fit"]', {
      state: "attached",
    });
    await page.waitForTimeout(150);
  });

  test("without the option the end of the list is below the screen at half", async ({
    page,
  }) => {
    await openAt(page, "plain", "half");
    const r = await endOfList(page, "plain");

    expect(r.boxBelowViewport).toBeGreaterThan(100);
    expect(r.lastRowBottom).toBeGreaterThan(r.viewport + 50);
  });

  test("with the option the last row scrolls into view at half", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    const r = await endOfList(page, "fit");

    expect(r.lastRowBottom).toBeLessThanOrEqual(r.viewport + 1);
    expect(r.lastRowTop).toBeGreaterThan(r.viewport * 0.5);
  });

  test("the spacer is exactly the part of the sheet that is off screen", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    const half = await endOfList(page, "fit");
    expect(Math.abs(half.inset - half.boxBelowViewport)).toBeLessThan(2);

    await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      await sheets.fit!.snapTo("full");
      await new Promise(r => setTimeout(r, 60));
    });
    const full = await endOfList(page, "fit");
    expect(full.inset).toBeLessThan(1);
    expect(full.lastRowBottom).toBeLessThanOrEqual(full.viewport + 1);
  });

  test("a list pinned to its end stays put on screen while the sheet expands", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    await endOfList(page, "fit");

    const track = await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const last = document.querySelector(
        '.bs-content[data-case="fit"] [data-row="100"]',
      ) as HTMLElement;
      const vh = window.innerHeight;
      const gaps: number[] = [];
      let done = false;
      void sheets.fit!.snapTo("full").then(() => {
        done = true;
      });
      while (!done) {
        gaps.push(vh - last.getBoundingClientRect().bottom);
        await new Promise(r => requestAnimationFrame(r));
      }
      for (let i = 0; i < 6; i++) {
        gaps.push(vh - last.getBoundingClientRect().bottom);
        await new Promise(r => requestAnimationFrame(r));
      }
      return { gaps, worst: Math.max(...gaps.map(Math.abs)) };
    });

    expect(track.gaps.length).toBeGreaterThan(4);
    expect(track.worst).toBeLessThan(48);
  });

  test("a list scrolled to the middle keeps its scroll position across an expand", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    const moved = await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const content = document.querySelector(
        '.bs-content[data-case="fit"]',
      ) as HTMLElement;
      content.scrollTop = 600;
      const before = content.scrollTop;
      await sheets.fit!.snapTo("full");
      await new Promise(r => setTimeout(r, 60));
      return { before, after: content.scrollTop };
    });

    expect(moved.after).toBe(moved.before);
  });

  test("dragging the handle up keeps a pinned list on screen the whole way", async ({
    page,
  }) => {
    await openAt(page, "fit", "half");
    await endOfList(page, "fit");

    const handle = page.locator('.bs-sheet[data-case="fit"] .bs-handle');
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    const gapNow = (): Promise<number> =>
      page.evaluate(() => {
        const last = document.querySelector(
          '.bs-content[data-case="fit"] [data-row="100"]',
        ) as HTMLElement;
        return window.innerHeight - last.getBoundingClientRect().bottom;
      });

    await page.mouse.move(x, startY);
    await page.mouse.down();
    const gaps: number[] = [];
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(x, startY - step * 18);
      await page.waitForTimeout(24);
      gaps.push(await gapNow());
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    gaps.push(await gapNow());

    const size = await page.evaluate(
      () =>
        (window as unknown as { bsSheets: Sheets }).bsSheets.fit!.state.size,
    );
    expect(size).toBeGreaterThan(0);
    expect(Math.max(...gaps.map(Math.abs))).toBeLessThan(48);
  });

  test("a sheet without the option is left exactly as it was", async ({
    page,
  }) => {
    await openAt(page, "plain", "half");
    const plain = await page.evaluate(() => {
      const sheet = document.querySelector(
        '.bs-sheet[data-case="plain"]',
      ) as HTMLElement;
      const content = sheet.querySelector(".bs-content") as HTMLElement;
      return {
        marked: sheet.hasAttribute("data-bs-fit-content"),
        insetVar: sheet.style.getPropertyValue("--bs-content-inset"),
        spacer: getComputedStyle(content, "::after").content,
        scrollPadding: getComputedStyle(content).scrollPaddingBottom,
      };
    });

    expect(plain.marked).toBe(false);
    expect(plain.insetVar).toBe("");
    expect(plain.spacer).toBe("none");
    expect(["auto", "0px"]).toContain(plain.scrollPadding);
  });

  test("collapsing back to half makes the end reachable again", async ({
    page,
  }) => {
    await openAt(page, "fit", "full");
    await page.evaluate(async () => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      await sheets.fit!.snapTo("half");
      await new Promise(r => setTimeout(r, 60));
    });
    const r = await endOfList(page, "fit");

    expect(r.lastRowBottom).toBeLessThanOrEqual(r.viewport + 1);
  });
});

test.describe("fitContentToSnap keeps the footer on the visible edge", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/content-fit.html");
    await page.waitForSelector('.bs-sheet[data-case="fitFooter"]', {
      state: "attached",
    });
    await page.waitForTimeout(150);
  });

  test("without the option the footer is below the screen at half", async ({
    page,
  }) => {
    await openAt(page, "plainFooter", "half");
    const f = await footerAt(page, "plainFooter");

    expect(f.height).toBeGreaterThan(20);
    expect(f.top).toBeGreaterThanOrEqual(f.viewport - 1);
    expect(f.transform).toBe("none");
  });

  test("with the option the footer rests on the bottom of the screen at half", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "half");
    const f = await footerAt(page, "fitFooter");

    expect(f.height).toBeGreaterThan(20);
    expect(Math.abs(f.bottom - f.viewport)).toBeLessThan(1.5);
  });

  test("at the largest snap the footer is exactly where it always was", async ({
    page,
  }) => {
    await openAt(page, "plainFooter", "full");
    const plain = await footerAt(page, "plainFooter");
    await page.evaluate(() =>
      (window as unknown as { bsSheets: Sheets }).bsSheets.plainFooter!.close(),
    );
    await openAt(page, "fitFooter", "full");
    const fit = await footerAt(page, "fitFooter");

    expect(Math.abs(fit.bottom - fit.viewport)).toBeLessThan(1.5);
    expect(Math.abs(fit.top - plain.top)).toBeLessThan(1);
    expect(Math.abs(fit.height - plain.height)).toBeLessThan(0.5);
  });

  test("the last row stops above the footer instead of under it", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "half");
    const r = await page.evaluate(() => {
      const content = document.querySelector(
        '.bs-content[data-case="fitFooter"]',
      ) as HTMLElement;
      content.scrollTop = content.scrollHeight;
      const last = content.querySelector('[data-row="100"]') as HTMLElement;
      const footer = document.querySelector(
        '.bs-footer[data-case="fitFooter"]',
      ) as HTMLElement;
      return {
        lastBottom: last.getBoundingClientRect().bottom,
        footerTop: footer.getBoundingClientRect().top,
      };
    });

    expect(r.lastBottom).toBeLessThanOrEqual(r.footerTop + 1);
    expect(r.footerTop - r.lastBottom).toBeLessThan(40);
  });

  test("the footer rides the visible edge on every frame of an expand", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "half");
    const track = await trackFooter(page, "fitFooter", "snapTo", "full");

    expect(track.edge.length).toBeGreaterThan(4);
    expect(Math.max(...track.edge.map(Math.abs))).toBeLessThan(2);
  });

  test("the footer rides the visible edge on every frame of a collapse", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "full");
    const track = await trackFooter(page, "fitFooter", "snapTo", "half");

    expect(track.edge.length).toBeGreaterThan(4);
    expect(Math.max(...track.edge.map(Math.abs))).toBeLessThan(2);
  });

  test("a settled footer sits on the edge to a tenth of a pixel", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "full");
    const track = await trackFooter(page, "fitFooter", "snapTo", "peek");
    const rest = await page.evaluate(() => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const sheet = document.querySelector(
        '.bs-sheet[data-case="fitFooter"]',
      ) as HTMLElement;
      return {
        written: parseFloat(sheet.style.getPropertyValue("--bs-size")),
        actual: sheets.fitFooter!.state.size,
      };
    });

    expect(Math.abs(rest.written - rest.actual)).toBeLessThan(0.01);
    expect(Math.abs(track.edge.at(-1)!)).toBeLessThan(0.1);
  });

  test("dragging the handle keeps the footer on the visible edge", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "half");
    const handle = page.locator('.bs-sheet[data-case="fitFooter"] .bs-handle');
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    const edge: number[] = [];
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(x, startY - step * 16);
      await page.waitForTimeout(24);
      const f = await footerAt(page, "fitFooter");
      edge.push(f.bottom - f.viewport);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    const rest = await footerAt(page, "fitFooter");
    edge.push(rest.bottom - rest.viewport);

    expect(Math.max(...edge.map(Math.abs))).toBeLessThan(2);
  });

  test("a closing sheet never lets the footer climb over the handle", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "peek");
    const peek = await footerAt(page, "fitFooter");
    expect(Math.abs(peek.bottom - peek.viewport)).toBeLessThan(1.5);

    const track = await trackFooter(page, "fitFooter", "close", "closed");

    expect(track.overHandle.length).toBeGreaterThan(4);
    expect(Math.max(...track.overHandle)).toBeLessThan(1.5);
  });

  test("the footer follows a snap-point change under an idle sheet", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "half");
    const f = await page.evaluate(async () => {
      const sheets = (
        window as unknown as {
          bsSheets: Record<
            string,
            { setSnapPoints: (points: unknown[]) => void }
          >;
        }
      ).bsSheets;
      sheets.fitFooter!.setSnapPoints([
        { id: "closed", size: 0 },
        { id: "peek", size: 128 },
        { id: "half", size: "50%" },
        { id: "full", size: "70%" },
      ]);
      await new Promise(r => setTimeout(r, 400));
      const footer = document.querySelector(
        '.bs-footer[data-case="fitFooter"]',
      ) as HTMLElement;
      return {
        bottom: footer.getBoundingClientRect().bottom,
        viewport: window.innerHeight,
      };
    });

    expect(Math.abs(f.bottom - f.viewport)).toBeLessThan(1.5);
  });

  test("a compositor-driven settle carries the footer along with it", async ({
    page,
    browserName,
  }) => {
    await openAt(page, "fitWaapi", "half");
    const up = await trackFooter(page, "fitWaapi", "snapTo", "full");
    const down = await trackFooter(page, "fitWaapi", "snapTo", "half");
    const worst = Math.max(...[...up.edge, ...down.edge].map(Math.abs));

    expect(up.edge.length).toBeGreaterThan(4);
    expect(worst).toBeLessThan(browserName === "webkit" ? 24 : 6);
    expect(Math.abs(down.edge.at(-1)!)).toBeLessThan(0.1);
  });

  test("the GPU renderer keeps the footer where it was", async ({ page }) => {
    await openAt(page, "fitFooter", "half");
    await page.evaluate(() => {
      document
        .querySelector('.bs-sheet[data-case="fitFooter"]')!
        .setAttribute("data-bs-webgl", "on");
    });
    const f = await footerAt(page, "fitFooter");

    expect(f.transform).toBe("none");
    expect(f.top).toBeGreaterThanOrEqual(f.viewport - 1);
  });

  test("the footer button stays clickable at half", async ({ page }) => {
    await openAt(page, "fitFooter", "half");
    await page.evaluate(() => {
      const button = document.querySelector(
        '[data-action="fitFooter"]',
      ) as HTMLElement;
      button.addEventListener("click", () => {
        button.dataset.clicked = "yes";
      });
    });

    await page.locator('[data-action="fitFooter"]').click();

    expect(
      await page.getAttribute('[data-action="fitFooter"]', "data-clicked"),
    ).toBe("yes");
  });
});

test.describe("fitContentToSnap with content drag turned off", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CDP touch injection is Chromium-only",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/fixtures/content-fit.html");
    await page.waitForSelector('.bs-sheet[data-case="fitScroll"]', {
      state: "attached",
    });
    await page.waitForTimeout(150);
  });

  const swipe = async (
    page: Page,
    selector: string,
    fromY: number,
    toY: number,
    steps = 12,
  ): Promise<void> => {
    const box = await page.locator(selector).boundingBox();
    if (!box) throw new Error(`no box for ${selector}`);
    const x = Math.round(box.x + box.width / 2);
    const client = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
      client.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd" ? [] : [{ x, y: Math.round(y), id: 1 }],
      });

    await send("touchStart", fromY);
    for (let i = 1; i <= steps; i++) {
      await send("touchMove", fromY + ((toY - fromY) * i) / steps);
    }
    await send("touchEnd", toY);
    await client.detach();
  };

  const stateOf = (page: Page, name: string) =>
    page.evaluate(n => {
      const sheets = (window as unknown as { bsSheets: Sheets }).bsSheets;
      const content = document.querySelector(
        `.bs-content[data-case="${n}"]`,
      ) as HTMLElement;
      return { size: sheets[n]!.state.size, scrollTop: content.scrollTop };
    }, name);

  test("by default a finger on the list at half moves the sheet, not the list", async ({
    page,
  }) => {
    await openAt(page, "fitFooter", "half");
    const before = await stateOf(page, "fitFooter");
    const row = '.bs-content[data-case="fitFooter"] [data-row="3"]';
    const box = (await page.locator(row).boundingBox())!;

    await swipe(page, row, box.y + 4, box.y - 180);
    await page.waitForTimeout(600);
    const after = await stateOf(page, "fitFooter");

    expect(after.size).toBeGreaterThan(before.size + 50);
    expect(after.scrollTop).toBe(0);
  });

  test("with dragFromContent off the same finger scrolls the list at half", async ({
    page,
  }) => {
    await openAt(page, "fitScroll", "half");
    const before = await stateOf(page, "fitScroll");
    const row = '.bs-content[data-case="fitScroll"] [data-row="3"]';
    const box = (await page.locator(row).boundingBox())!;

    await swipe(page, row, box.y + 4, box.y - 180);
    await page.waitForTimeout(600);
    const after = await stateOf(page, "fitScroll");

    expect(after.scrollTop).toBeGreaterThan(50);
    expect(after.size).toBe(before.size);
  });

  test("the handle still moves a sheet whose content only scrolls", async ({
    page,
  }) => {
    await openAt(page, "fitScroll", "half");
    const before = await stateOf(page, "fitScroll");
    const handle = '.bs-sheet[data-case="fitScroll"] .bs-handle';
    const box = (await page.locator(handle).boundingBox())!;

    await swipe(page, handle, box.y + box.height / 2, box.y - 220);
    await page.waitForTimeout(700);
    const after = await stateOf(page, "fitScroll");

    expect(after.size).toBeGreaterThan(before.size + 50);
  });
});
