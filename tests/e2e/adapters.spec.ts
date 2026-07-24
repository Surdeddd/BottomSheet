import { expect, test } from "@playwright/test";

type AdapterKey =
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "lit"
  | "element"
  | "vanilla";

const ADAPTERS: AdapterKey[] = [
  "react",
  "vue",
  "svelte",
  "solid",
  "lit",
  "element",
  "vanilla",
];

const usesShadow = (adapter: AdapterKey) =>
  adapter === "lit" || adapter === "element";

const readSize = ({
  adapter,
  shadow,
}: {
  adapter: AdapterKey;
  shadow: boolean;
}): number | null => {
  const screen = document.querySelector(
    `.device-screen[data-screen="${adapter}"]`,
  );
  if (!screen) return null;
  let sheet: HTMLElement | null = null;
  if (shadow) {
    const host = screen.querySelector("bottom-sheet") as HTMLElement | null;
    sheet = (host?.shadowRoot?.querySelector(".bs-sheet") ?? null) as
      | HTMLElement
      | null;
  } else {
    sheet = screen.querySelector(".bs-sheet") as HTMLElement | null;
  }
  if (!sheet) return null;
  const raw = sheet.style.getPropertyValue("--bs-size");
  return raw ? parseFloat(raw) : null;
};

const activate = async (page: import("@playwright/test").Page, key: AdapterKey) => {
  // A plain click, deliberately: it auto-scrolls AND waits for the element to
  // stop moving. force:true skips the stability check, so the demo's reveal and
  // parallax animations could shift the button out from under a synthesized
  // click mid-flight (WebKit lost ~1 switch in 4 that way).
  const adapterBtn = page.locator(`.adapter[data-adapter="${key}"]`);
  await adapterBtn.scrollIntoViewIfNeeded();
  await adapterBtn.click();
  await page.waitForFunction(
    ({ adapter, shadow }) => {
      const screen = document.querySelector(
        `.device-screen[data-screen="${adapter}"]`,
      );
      if (!screen || screen.hasAttribute("hidden")) return false;
      let sheet: HTMLElement | null = null;
      if (shadow) {
        const host = screen.querySelector("bottom-sheet") as HTMLElement | null;
        sheet = (host?.shadowRoot?.querySelector(".bs-sheet") ?? null) as
          | HTMLElement
          | null;
      } else {
        sheet = screen.querySelector(".bs-sheet") as HTMLElement | null;
      }
      if (!sheet) return false;
      const raw = sheet.style.getPropertyValue("--bs-size");
      return raw ? parseFloat(raw) > 0 : false;
    },
    { adapter: key, shadow: usesShadow(key) },
    { timeout: 25000 },
  );
};

const clickSnap = async (
  page: import("@playwright/test").Page,
  label: "minimized" | "half" | "full" | "closed",
) => {
  await page.locator(`#snap-chips button:has-text("${label}")`).click();
};

test.describe("All adapters mount and respond", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(`.device-screen[data-screen="react"] .bs-sheet`);
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter}: mounts handle, snaps to full and half`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.fixme(
        (adapter === "lit" || adapter === "element") &&
          browserName === "webkit",
        "Shadow-DOM adapter slow first paint on WebKit",
      );
      await activate(page, adapter);

      const initial = await page.evaluate(readSize, {
        adapter,
        shadow: usesShadow(adapter),
      });
      expect(initial, `${adapter} initial size`).not.toBeNull();
      expect(initial!).toBeGreaterThan(50);
      expect(initial!).toBeLessThan(200);

      await clickSnap(page, "full");
      await page.waitForFunction(
        ({ adapter, shadow }) => {
          const screen = document.querySelector(
            `.device-screen[data-screen="${adapter}"]`,
          );
          if (!screen) return false;
          let sheet: HTMLElement | null = null;
          if (shadow) {
            const host = screen.querySelector("bottom-sheet") as HTMLElement | null;
            sheet = (host?.shadowRoot?.querySelector(".bs-sheet") ?? null) as
              | HTMLElement
              | null;
          } else {
            sheet = screen.querySelector(".bs-sheet") as HTMLElement | null;
          }
          if (!sheet) return false;
          const raw = sheet.style.getPropertyValue("--bs-size");
          return raw ? parseFloat(raw) > 400 : false;
        },
        { adapter, shadow: usesShadow(adapter) },
        { timeout: 8000 },
      );

      await clickSnap(page, "half");
      await page.waitForFunction(
        ({ adapter, shadow }) => {
          const screen = document.querySelector(
            `.device-screen[data-screen="${adapter}"]`,
          );
          if (!screen) return false;
          let sheet: HTMLElement | null = null;
          if (shadow) {
            const host = screen.querySelector("bottom-sheet") as HTMLElement | null;
            sheet = (host?.shadowRoot?.querySelector(".bs-sheet") ?? null) as
              | HTMLElement
              | null;
          } else {
            sheet = screen.querySelector(".bs-sheet") as HTMLElement | null;
          }
          if (!sheet) return false;
          const raw = sheet.style.getPropertyValue("--bs-size");
          if (!raw) return false;
          const v = parseFloat(raw);
          return v > 200 && v < 400;
        },
        { adapter, shadow: usesShadow(adapter) },
        { timeout: 8000 },
      );
    });
  }
});

test.describe("Adapter-specific identity assertions", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(`.device-screen[data-screen="react"] .bs-sheet`);
  });

  test("svelte: inner .bs-sheet exposes data-active reflecting current snap", async ({
    page,
  }, testInfo) => {
    test.fixme(
      testInfo.project.name === "mobile-safari",
      "TODO: WebKit + Svelte runes mount timing — see fb65efa",
    );
    await activate(page, "svelte");
    await clickSnap(page, "half");
    await page.waitForFunction(
      () =>
        document
          .querySelector(`.device-screen[data-screen="svelte"] .bs-sheet`)
          ?.getAttribute("data-active") === "half",
      undefined,
      { timeout: 8000 },
    );
    await clickSnap(page, "full");
    await page.waitForFunction(
      () =>
        document
          .querySelector(`.device-screen[data-screen="svelte"] .bs-sheet`)
          ?.getAttribute("data-active") === "full",
      undefined,
      { timeout: 8000 },
    );
  });

  test("solid: light-DOM .bs-sheet renders with bs-handle child", async ({
    page,
  }, testInfo) => {
    await activate(page, "solid");
    const handleCount = await page
      .locator(
        `.device-screen[data-screen="solid"] .bs-sheet .bs-handle`,
      )
      .count();
    expect(handleCount).toBe(1);
    await clickSnap(page, "full");
    await page.waitForFunction(
      () => {
        const sheet = document.querySelector(
          `.device-screen[data-screen="solid"] .bs-sheet`,
        ) as HTMLElement | null;
        const raw = sheet?.style.getPropertyValue("--bs-size");
        return raw ? parseFloat(raw) > 400 : false;
      },
      undefined,
      { timeout: 8000 },
    );
  });

  test("lit: <bottom-sheet> custom element is registered and exposes sheetState", async ({
    page,
  }, testInfo) => {
    await activate(page, "lit");
    const customElCount = await page
      .locator(`.device-screen[data-screen="lit"] bottom-sheet`)
      .count();
    expect(customElCount).toBe(1);

    const hasState = await page.evaluate(() => {
      const screen = document.querySelector(
        `.device-screen[data-screen="lit"]`,
      );
      const host = screen?.querySelector("bottom-sheet") as
        | (HTMLElement & { sheetState?: { activeId?: string; size?: number } })
        | null;
      const s = host?.sheetState;
      return !!s && typeof s.activeId === "string" && typeof s.size === "number";
    });
    expect(hasState).toBe(true);

    await clickSnap(page, "full");
    await page.waitForFunction(
      () => {
        const screen = document.querySelector(
          `.device-screen[data-screen="lit"]`,
        );
        const host = screen?.querySelector("bottom-sheet") as
          | (HTMLElement & { sheetState?: { activeId?: string } })
          | null;
        return host?.sheetState?.activeId === "full";
      },
      undefined,
      { timeout: 8000 },
    );
  });
});
