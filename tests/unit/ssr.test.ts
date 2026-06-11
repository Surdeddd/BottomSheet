// @vitest-environment node

import { describe, expect, it, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, "..", "..", "dist");

beforeAll(() => {
  if (!existsSync(distDir)) {
    throw new Error(
      `dist/ is missing — run \`npm run build\` before running SSR tests. Looked at: ${distDir}`,
    );
  }
});

describe("SSR — no browser globals at module import", () => {
  it("runs in a true Node environment (no DOM globals installed)", () => {
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect((globalThis as { document?: unknown }).document).toBeUndefined();
    expect(
      (globalThis as { customElements?: unknown }).customElements,
    ).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet` (core) without throwing", async () => {
    const mod = await import(resolve(distDir, "index.js"));
    expect(mod.BottomSheetEngine).toBeTypeOf("function");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet/react` without throwing", async () => {
    const mod = await import(resolve(distDir, "react.js"));
    expect(mod.BottomSheet).toBeTypeOf("object");
    expect(mod.useBottomSheet).toBeTypeOf("function");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
  });

  it("imports `@surdeddd/bottom-sheet/vue` without throwing", async () => {
    const mod = await import(resolve(distDir, "vue.js"));
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

  it("ships a `solid` export condition with preserved-JSX source for SSR consumers", () => {
    const sourcePath = resolve(distDir, "solid.source.jsx");
    expect(existsSync(sourcePath)).toBe(true);
    const pkg = JSON.parse(
      readFileSync(resolve(distDir, "..", "package.json"), "utf8"),
    ) as { exports: Record<string, { solid?: string }> };
    expect(pkg.exports["./solid"]!.solid).toBe("./dist/solid.source.jsx");
    const source = readFileSync(sourcePath, "utf8");
    expect(source).toContain("<section");
  });

  it.skip(
    "imports `@surdeddd/bottom-sheet/qwik` without throwing [GAP: needs Qwik optimizer]",
    async () => {
      const mod = await import(resolve(distDir, "qwik.js"));
      expect(mod.BottomSheet).toBeDefined();
      expect((globalThis as { window?: unknown }).window).toBeUndefined();
    },
  );

  it("imports `@surdeddd/bottom-sheet/element` without throwing", async () => {
    const mod = await import(resolve(distDir, "element.js"));
    expect(mod.BottomSheetElement).toBeTypeOf("function");
    expect(mod.defineBottomSheet).toBeTypeOf("function");
    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect(
      (globalThis as { customElements?: unknown }).customElements,
    ).toBeUndefined();
  });

  it("does not pollute `globalThis` with DOM-ish keys after all imports", () => {
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

    expect(html).toContain("bs-sheet");
    expect(html).toContain('data-mode="bottom"');
    expect(html).toContain("hello");
    expect(html).toContain("bs-backdrop");
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

    expect(html).not.toContain("bs-sheet");
    expect(html).not.toContain("hidden on server");
  });
});

describe("SSR — hydration determinism (no markup mismatch)", () => {
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
    expect(a).toContain('data-mode="bottom"');
  });

  it("server snapshot of activeId is the empty initial id (deterministic)", async () => {
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
  it.skip(
    "renders <BottomSheet> via svelte/server [GAP: needs server-mode Svelte build]",
    () => {
    },
  );
});
