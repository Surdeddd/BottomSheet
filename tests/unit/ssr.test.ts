// @vitest-environment node
//
// SSR safety tests for @surdeddd/bottom-sheet.
//
// Validates two pillars of the library's SSR-safe claim:
//   1. "Zero `window` at import" — none of the public entry points may touch
//      `window`, `document`, `customElements`, or any other browser global at
//      module top-level. We assert this by dynamically importing every public
//      entry from `dist/` inside a Node environment (no jsdom / happy-dom)
//      and checking that no global was touched and no error was thrown.
//   2. "useSyncExternalStore with cached snapshot, optional `noSSR` prop kills
//      hydration mismatches in Next.js" — we exercise this by calling
//      `react-dom/server`'s `renderToString` on the React `<BottomSheet/>`
//      and asserting the markup is well-formed and deterministic across two
//      independent renders (a hydration-mismatch sentinel).
//
// We deliberately import the BUILT dist artifacts here rather than the raw
// `src/` so we exercise exactly what consumers ship in their server bundles.
// Run `npm run build` before this test in CI; `npm test` does not auto-build.

import { describe, expect, it, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, "..", "..", "dist");

// Pre-flight: bail loudly if dist is missing rather than producing confusing
// "Cannot find module" errors deep in the dynamic-import paths below.
beforeAll(() => {
  if (!existsSync(distDir)) {
    throw new Error(
      `dist/ is missing — run \`npm run build\` before running SSR tests. Looked at: ${distDir}`,
    );
  }
});

describe("SSR — no browser globals at module import", () => {
  // Sanity: in this file we run with `@vitest-environment node`, so no
  // happy-dom/jsdom is installed. `globalThis.window` should be undefined.
  it("runs in a true Node environment (no DOM globals installed)", () => {
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect((globalThis as { document?: unknown }).document).toBeUndefined();
    expect(
      (globalThis as { customElements?: unknown }).customElements,
    ).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet` (core) without throwing", async () => {
    const mod = await import(resolve(distDir, "index.js"));
    // Smoke: the engine class should be exported.
    expect(mod.BottomSheetEngine).toBeTypeOf("function");
    // No global pollution from the import itself.
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet/react` without throwing", async () => {
    const mod = await import(resolve(distDir, "react.js"));
    expect(mod.BottomSheet).toBeTypeOf("object"); // forwardRef → object
    expect(mod.useBottomSheet).toBeTypeOf("function");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet/vue` without throwing", async () => {
    const mod = await import(resolve(distDir, "vue.js"));
    // Vue SFC default export becomes `BottomSheet` named export.
    expect(mod.BottomSheet).toBeDefined();
    expect(mod.useBottomSheet).toBeTypeOf("function");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet/svelte` without throwing", async () => {
    const mod = await import(resolve(distDir, "svelte.js"));
    expect(mod.createBottomSheet).toBeTypeOf("function");
    expect(mod.BottomSheet).toBeDefined();
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet/solid` without throwing", async () => {
    // Solid's adapter dist is pure ES module — no compile-time macros needed.
    const mod = await import(resolve(distDir, "solid.js"));
    expect(mod.BottomSheet).toBeTypeOf("function");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  // KNOWN GAP — same shape as the `/element` skip below:
  //
  // `@surdeddd/bottom-sheet/qwik` ships with un-optimized `component$()`
  // calls because tsup is not Qwik-aware (the Qwik optimizer is a separate
  // tool that runs in consumer apps via qwik-vite). Importing the dist into
  // raw Node throws "Optimizer should replace all usages of $() with some
  // special syntax". This is by design — the dist is meant to be picked up
  // by a Qwik-aware bundler downstream. The unit-level smoke for this
  // adapter lives in `tests/unit/qwik-export.test.ts` (uses vi.mock to stub
  // the runtime); end-to-end behavior is verified in the e2e suite.
  it.skip(
    "imports `@surdeddd/bottom-sheet/qwik` without throwing [GAP: needs Qwik optimizer]",
    async () => {
      const mod = await import(resolve(distDir, "qwik.js"));
      expect(mod.BottomSheet).toBeDefined();
      expect((globalThis as { window?: unknown }).window).toBeUndefined();
    },
  );

  // KNOWN GAP — documented for visibility:
  //
  // `@surdeddd/bottom-sheet/element` is NOT SSR-safe in pure Node because
  // `class BottomSheetElement extends HTMLElement` is evaluated at module
  // load time, and `HTMLElement` is not a Node global. The auto-register
  // side effect is correctly guarded by `typeof window !== 'undefined'`,
  // but the class declaration itself runs unconditionally and throws
  // `ReferenceError: HTMLElement is not defined`.
  //
  // The current README's SSR-safety claim is technically about `window`
  // (which IS guarded) — but consumers running Next.js / Astro / Remix
  // who add this entry to a server bundle WILL crash. To make this entry
  // SSR-safe the class definition needs to be lazy (e.g. inside a function
  // returning the class only on first call) or wrapped in an
  // `if (typeof HTMLElement !== 'undefined')` guard.
  //
  // The skipped assertion below shows what we WOULD test once that fix
  // lands. Until then this skip is the SSR-claim audit trail.
  it.skip(
    "imports `@surdeddd/bottom-sheet/element` without throwing [GAP: extends HTMLElement at top level]",
    async () => {
      const mod = await import(resolve(distDir, "element.js"));
      expect(mod.BottomSheetElement).toBeTypeOf("function");
      expect(mod.defineBottomSheet).toBeTypeOf("function");
      expect((globalThis as { window?: unknown }).window).toBeUndefined();
      expect(
        (globalThis as { customElements?: unknown }).customElements,
      ).toBeUndefined();
    },
  );

  it("does not pollute `globalThis` with DOM-ish keys after all imports", () => {
    // Only check globals that the BROWSER provides and that the library is
    // claimed to never auto-install. We deliberately don't check `navigator`
    // here because Node 20+ exposes a stub `globalThis.navigator` of its own.
    const forbidden = ["window", "document", "customElements", "HTMLElement"];
    for (const key of forbidden) {
      expect(
        (globalThis as Record<string, unknown>)[key],
        `globalThis.${key} should remain undefined after SSR-import`,
      ).toBeUndefined();
    }
  });
});

describe("SSR — React renderToString smoke", () => {
  // A heavyweight test that exercises `react-dom/server` in pure Node.
  // We use the built `dist/react.js` (matches what consumers ship) and
  // `react/jsx-runtime` for JSX, both of which must work without any DOM.
  it("renders <BottomSheet> to a string with expected markup", async () => {
    const { renderToString } = await import("react-dom/server");
    const { jsx, jsxs } = await import("react/jsx-runtime");
    const { BottomSheet } = (await import(resolve(distDir, "react.js"))) as {
      BottomSheet: import("react").ComponentType<Record<string, unknown>>;
    };

    const tree = jsx(BottomSheet, {
      snapPoints: [
        { id: "min", size: 96 },
        { id: "full", size: "85%" },
      ],
      initial: "min",
      mode: "bottom",
      ariaLabel: "Test sheet",
      children: jsxs("div", { children: ["hello", " ", "ssr"] }),
    });

    const html = renderToString(tree);

    // Server output must include the canonical sheet markup advertised in
    // README ("section.bs-sheet"). If this disappears, consumers who rely on
    // CSS targeting `section.bs-sheet` will silently break in SSR.
    expect(html).toContain("bs-sheet");
    expect(html).toContain('data-mode="bottom"');
    expect(html).toContain("hello");
    // Backdrop is rendered by default, before the sheet.
    expect(html).toContain("bs-backdrop");
    // No DOM was needed — confirm we're still in pure Node.
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("renderToString does not throw with `noSSR` prop set (returns empty)", async () => {
    const { renderToString } = await import("react-dom/server");
    const { jsx } = await import("react/jsx-runtime");
    const { BottomSheet } = (await import(resolve(distDir, "react.js"))) as {
      BottomSheet: import("react").ComponentType<Record<string, unknown>>;
    };

    const html = renderToString(
      jsx(BottomSheet, {
        snapPoints: [{ id: "full", size: "full" }],
        noSSR: true,
        children: jsx("div", { children: "hidden on server" }),
      }),
    );

    // With noSSR: true the component must return null on the server. The
    // rendered string is allowed to be empty, or to contain only HTML
    // comments / whitespace — but it must NOT contain the sheet markup.
    expect(html).not.toContain("bs-sheet");
    expect(html).not.toContain("hidden on server");
  });
});

describe("SSR — hydration determinism (no markup mismatch)", () => {
  // The hydration-mismatch failure mode in Next.js is: server renders one
  // markup, client renders a different one on first pass. We can't run a
  // real Next.js stack here, but we can assert the cheaper invariant:
  //   "two independent server renders of the same component produce
  //    identical markup" — which is necessary (though not sufficient) for
  //    hydration determinism. If the engine accidentally read `Date.now()`,
  //    `Math.random()`, or some module-level mutable state at render time,
  //    this test would catch it.
  it("renders identical markup across two independent server renders", async () => {
    const { renderToString } = await import("react-dom/server");
    const { jsx } = await import("react/jsx-runtime");
    const { BottomSheet } = (await import(resolve(distDir, "react.js"))) as {
      BottomSheet: import("react").ComponentType<Record<string, unknown>>;
    };

    const props = {
      snapPoints: [
        { id: "min", size: 96 },
        { id: "full", size: "85%" },
      ],
      initial: "min",
      mode: "bottom" as const,
      children: jsx("div", { children: "deterministic" }),
    };

    const a = renderToString(jsx(BottomSheet, props));
    const b = renderToString(jsx(BottomSheet, props));

    expect(a).toEqual(b);
    // And both must have the data-mode attribute the client will assert on.
    expect(a).toContain('data-mode="bottom"');
  });

  it("server snapshot of activeId is the empty initial id (deterministic)", async () => {
    // The hook's getServerSnapshot returns SSR_STATE with activeId = "".
    // We assert the rendered SSR markup reflects that — `data-active=""`
    // — so the client can hydrate without seeing a different attribute on
    // first pass before its layout effect runs and snaps to `initial`.
    const { renderToString } = await import("react-dom/server");
    const { jsx } = await import("react/jsx-runtime");
    const { BottomSheet } = (await import(resolve(distDir, "react.js"))) as {
      BottomSheet: import("react").ComponentType<Record<string, unknown>>;
    };

    const html = renderToString(
      jsx(BottomSheet, {
        snapPoints: [
          { id: "min", size: 96 },
          { id: "full", size: "85%" },
        ],
        initial: "min",
      }),
    );

    expect(html).toContain('data-active=""');
  });
});

describe("SSR — Vue renderToString smoke", () => {
  it("renders <BottomSheet> to a string via vue/server-renderer", async () => {
    const { createSSRApp, h } = await import("vue");
    const { renderToString } = await import("vue/server-renderer");
    const mod = (await import(resolve(distDir, "vue.js"))) as {
      BottomSheet: import("vue").Component;
    };

    const app = createSSRApp({
      render: () =>
        h(
          mod.BottomSheet,
          {
            snapPoints: [
              { id: "min", size: 96 },
              { id: "full", size: "85%" },
            ],
            initial: "min",
            mode: "bottom",
          },
          { default: () => h("div", "vue ssr") },
        ),
    });

    const html = await renderToString(app);

    expect(html).toContain("bs-sheet");
    expect(html).toContain("vue ssr");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });
});

describe("SSR — Svelte renderToString", () => {
  // Svelte 5 SSR via `svelte/server` requires the component to be compiled
  // with the `server: true` flag, which `tsup` does NOT do by default — the
  // dist `svelte.js` contains the client-mode compiled component. Running
  // `render(BottomSheet, ...)` from `svelte/server` against a client-mode
  // component throws at runtime ("$.template_effect is not a function" or
  // similar), which is a build-pipeline gap, not an SSR-safety bug in the
  // engine. We document it here so the gap is visible in CI.
  it.skip(
    "renders <BottomSheet> via svelte/server [GAP: needs server-mode Svelte build]",
    () => {
      // Intentionally empty — see the describe-block comment above.
    },
  );
});
