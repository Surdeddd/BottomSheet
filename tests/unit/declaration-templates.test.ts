// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

const ownProps = (source: string): string[] => {
  const start = source.indexOf("type Props = ");
  const open = source.indexOf("> & {", start);
  const close = source.indexOf("\n  };", open) === -1
    ? source.indexOf("\n};", open)
    : Math.min(
        ...[source.indexOf("\n  };", open), source.indexOf("\n};", open)].filter(
          index => index !== -1,
        ),
      );
  const body = source.slice(open, close);
  return [...body.matchAll(/^\s+([A-Za-z$]+)\??:/gm)].map(m => m[1]!);
};

const declares = (declarations: string, name: string): boolean =>
  new RegExp(`(^|[\\s{;])${name.replace("$", "\\$")}\\??\\s*[:(]`, "m").test(
    declarations,
  );

describe("hand-written declarations", () => {
  it("name every prop of the Vue component", () => {
    const declarations = read("src/vue/index.d.ts.template");
    const missing = ownProps(read("src/vue/BottomSheet.vue")).filter(
      name => !declares(declarations, name),
    );
    expect(missing).toEqual([]);
  });

  it("name every method the Vue component exposes", () => {
    const source = read("src/vue/BottomSheet.vue");
    const exposed = source.slice(
      source.indexOf("defineExpose({"),
      source.indexOf("});", source.indexOf("defineExpose({")),
    );
    const names = [...exposed.matchAll(/^\s+([A-Za-z]+),$/gm)].map(m => m[1]!);
    expect(names.length).toBeGreaterThan(10);
    const declarations = read("src/vue/index.d.ts.template");
    expect(names.filter(name => !declares(declarations, name))).toEqual([]);
  });

  it("name every prop of the Svelte component", () => {
    const declarations = read("src/svelte/index.d.ts.template");
    const missing = ownProps(read("src/svelte/BottomSheet.svelte")).filter(
      name => !declares(declarations, name),
    );
    expect(missing).toEqual([]);
  });

  it("name every method the Svelte component exports", () => {
    const source = read("src/svelte/BottomSheet.svelte");
    const names = [...source.matchAll(/^\s+export const ([A-Za-z]+) =/gm)].map(
      m => m[1]!,
    );
    expect(names.length).toBeGreaterThan(10);
    const declarations = read("src/svelte/index.d.ts.template");
    expect(names.filter(name => !declares(declarations, name))).toEqual([]);
  });
});
