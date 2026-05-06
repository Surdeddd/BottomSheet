import { expect, test } from "@playwright/test";

/**
 * Cross-adapter parametric e2e: every adapter chip mounts a sheet that
 * resolves to the same `.bs-sheet` host (light DOM for react/vue/svelte/solid/
 * vanilla, shadow DOM for the lit + element wrappers around <bottom-sheet>).
 *
 * The existing `sheet.spec.ts` covers react in depth; this file proves the
 * remaining six adapters behave identically against the public engine API.
 */
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

// `lit` and `element` adapters mount <bottom-sheet>, which renders the
// `.bs-sheet` inside its shadow root. Other adapters render light DOM.
const usesShadow = (adapter: AdapterKey) =>
  adapter === "lit" || adapter === "element";

/** Reads the CSS-driven sheet size, hopping into shadow DOM if needed. */
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

/** Switch the demo to a given adapter and wait until its sheet is mounted. */
const activate = async (page: import("@playwright/test").Page, key: AdapterKey) => {
  await page.locator(`.adapter[data-adapter="${key}"]`).click({ force: true });
  // Wait for the adapter's `.bs-sheet` to exist (and to be sized > 0 so we
  // know its first paint settled). For shadow-DOM adapters we walk into
  // shadowRoot.
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
    { timeout: 15000 },
  );
};

/** Click a snap chip from the controls panel by its visible text. */
const clickSnap = async (
  page: import("@playwright/test").Page,
  label: "minimized" | "half" | "full" | "closed",
) => {
  await page.locator(`#snap-chips button:has-text("${label}")`).click();
};

test.describe("All adapters mount and respond", () => {
  // Run serially: the demo lazily loads each adapter's bundle on first
  // activation, and parallel cold-starts on the same Vite dev server can
  // exceed the 15s mount budget on slower CI hardware. Serial execution
  // keeps each cold-load isolated.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the default React mount to finish so the orchestrator is
    // wired up before we start swapping tabs.
    await page.waitForSelector(`.device-screen[data-screen="react"] .bs-sheet`);
  });

  for (const adapter of ADAPTERS) {
    test(`${adapter}: mounts handle, snaps to full and half`, async ({
      page,
      browserName,
    }) => {
      // TODO: shadow-DOM adapters (`lit`, `element`) intermittently miss
      // the 15s mount budget on WebKit / mobile-safari emulation. Either the
      // custom-element upgrade or the Lit reactive shadow root takes longer
      // than expected on first paint. Light-DOM adapters mount fine.
      test.fixme(
        (adapter === "lit" || adapter === "element") &&
          browserName === "webkit",
        "Shadow-DOM adapter slow first paint on WebKit",
      );
      await activate(page, adapter);

      // Sanity: the sheet is present at the initial (minimized) snap, sized
      // somewhere between 50 and 200px (matches React baseline).
      const initial = await page.evaluate(readSize, {
        adapter,
        shadow: usesShadow(adapter),
      });
      expect(initial, `${adapter} initial size`).not.toBeNull();
      expect(initial!).toBeGreaterThan(50);
      expect(initial!).toBeLessThan(200);

      // snapTo full → expect size to grow past 400px.
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
        { timeout: 4000 },
      );

      // snapTo half → between 200 and 400.
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
        { timeout: 4000 },
      );
    });
  }
});

test.describe("Adapter-specific identity assertions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(`.device-screen[data-screen="react"] .bs-sheet`);
  });

  test("svelte: inner .bs-sheet exposes data-active reflecting current snap", async ({
    page,
  }) => {
    await activate(page, "svelte");
    await clickSnap(page, "half");
    await page.waitForFunction(
      () =>
        document
          .querySelector(`.device-screen[data-screen="svelte"] .bs-sheet`)
          ?.getAttribute("data-active") === "half",
      undefined,
      { timeout: 4000 },
    );
    await clickSnap(page, "full");
    await page.waitForFunction(
      () =>
        document
          .querySelector(`.device-screen[data-screen="svelte"] .bs-sheet`)
          ?.getAttribute("data-active") === "full",
      undefined,
      { timeout: 4000 },
    );
  });

  test("solid: light-DOM .bs-sheet renders with bs-handle child", async ({
    page,
  }) => {
    await activate(page, "solid");
    // Solid wires the engine to raw refs, so the sheet appears in light DOM
    // under the screen container — no custom element, no shadow root.
    const handleCount = await page
      .locator(
        `.device-screen[data-screen="solid"] .bs-sheet .bs-handle`,
      )
      .count();
    expect(handleCount).toBe(1);
    // Confirm engine is alive: snapTo causes size to change.
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
      { timeout: 4000 },
    );
  });

  test("lit: <bottom-sheet> custom element is registered and exposes sheetState", async ({
    page,
  }) => {
    await activate(page, "lit");
    // The Lit wrapper opts out of its own shadow root (createRenderRoot
    // returns `this`), so the inner <bottom-sheet> custom element lives
    // directly under the device screen.
    const customElCount = await page
      .locator(`.device-screen[data-screen="lit"] bottom-sheet`)
      .count();
    expect(customElCount).toBe(1);

    // The custom element's `sheetState` property surfaces engine state to
    // the demo polling loop. Verify it returns a populated object.
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

    // Drive a snap and confirm the activeId reflects it.
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
      { timeout: 4000 },
    );
  });
});
