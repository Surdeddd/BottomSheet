import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string): string =>
  readFileSync(resolve(here, "../../src", rel), "utf8");

const BY_TRAP = /role=["{][^"}]*\?\s*['"]dialog['"]\s*:\s*['"]region['"]/;

describe("a sheet that does not trap focus is a region in every adapter", () => {
  it.each([
    ["react", "react/BottomSheet.tsx"],
    ["vue", "vue/BottomSheet.vue"],
    ["svelte", "svelte/BottomSheet.svelte"],
    ["solid", "solid/index.tsx"],
    ["qwik", "qwik/index.tsx"],
  ])("%s picks the role by the focus trap", (_name, file) => {
    expect(src(file)).toMatch(BY_TRAP);
    expect(src(file)).not.toMatch(/class(Name)?="bs-sheet"[^>]*role="dialog"/s);
  });

  it("the custom element starts as a region and becomes a dialog with focus-trap", () => {
    expect(src("web-component/shadow-tree.ts")).toContain(
      'sheet.setAttribute("role", "region")',
    );
    expect(src("web-component/BottomSheetElement.ts")).toContain(
      'sheet.setAttribute("role", "dialog")',
    );
  });
});
