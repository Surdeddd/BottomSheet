// @vitest-environment node
import { describe, expect, it } from "vitest";
import { genCode } from "../../demo/lib/codegen";
import type { DemoSettings } from "../../demo/apps/shared";

const base: DemoSettings = {
  mode: "bottom",
  initial: "minimized",
  stiffness: 260,
  damping: 28,
  focusTrap: true,
  closeOnEscape: true,
  haptic: true,
  rubberBand: true,
  scrimPreset: "monitoring",
  scrimAboveSheet: true,
  scrimTapToClose: false,
  scrimFloatingAction: false,
  webgl: false,
  webglOnCpu: false,
  webglLift: false,
};

const snaps = [
  { id: "minimized", size: 136 },
  { id: "full", size: 520 },
];

const IMPORT = 'import { webglRenderer } from "@surdeddd/bottom-sheet/webgl";';

describe("the snippet and the renderer", () => {
  it("does not mention WebGL while the DOM renderer draws", () => {
    for (const adapter of ["react", "vue", "svelte", "solid", "lit", "element", "vanilla"] as const) {
      expect(genCode(adapter, base, snaps)).not.toMatch(/webgl/i);
    }
  });

  it("shows the import and where the feature goes, adapter by adapter", () => {
    const on = { ...base, webgl: true };
    const expected = {
      react: "<BottomSheet features={[webglRenderer()]} />",
      solid: "<BottomSheet features={[webglRenderer()]} />",
      svelte: "<BottomSheet features={[webglRenderer()]} />",
      vue: '<BottomSheet :features="[webglRenderer()]" />',
      lit: "html`<bottom-sheet .options=${{ features: [webglRenderer()] }}></bottom-sheet>`",
      element:
        'document.querySelector("bottom-sheet").options = { features: [webglRenderer()] };',
      vanilla: "new BottomSheetEngine({ features: [webglRenderer()] });",
    } as const;
    for (const [adapter, line] of Object.entries(expected)) {
      const code = genCode(adapter as keyof typeof expected, on, snaps);
      expect(code, adapter).toContain(IMPORT);
      expect(code, adapter).toContain(line);
    }
  });

  it("spells out the permission to draw on the CPU only when it was given", () => {
    expect(genCode("react", { ...base, webgl: true }, snaps)).not.toContain(
      "allowSoftware",
    );
    expect(
      genCode("react", { ...base, webgl: true, webglOnCpu: true }, snaps),
    ).toContain("webglRenderer({ allowSoftware: true })");
  });

  it("imports the content lift and passes it only when the content is lifted", () => {
    const plain = genCode("react", { ...base, webgl: true }, snaps);
    expect(plain).not.toContain("contentLift");

    const lifted = genCode("react", { ...base, webgl: true, webglLift: true }, snaps);
    expect(lifted).toContain(
      'import { contentLift, webglRenderer } from "@surdeddd/bottom-sheet/webgl";',
    );
    expect(lifted).toContain("webglRenderer({ lift: contentLift() })");
  });

  it("puts the lift and the CPU permission into one call", () => {
    const code = genCode(
      "vanilla",
      { ...base, webgl: true, webglLift: true, webglOnCpu: true },
      snaps,
    );
    expect(code).toContain(
      "webglRenderer({ lift: contentLift(), allowSoftware: true })",
    );
  });

  it("keeps WebGL out of the overlay snippet, which has no such renderer", () => {
    const code = genCode("react", { ...base, mode: "overlay", webgl: true }, snaps);
    expect(code).not.toMatch(/webgl/i);
  });
});
