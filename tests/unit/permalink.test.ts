// @vitest-environment node
//
// Round-trip + adversarial-input tests for the demo's permalink encoder.
// Critical because permalink.ts is the only module ingesting user-controlled
// input (URL hash) — every parse path needs a guard that we can pin behavior
// against.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { encode, decode } from "../../demo/lib/permalink";
import type { DemoSettings } from "../../demo/apps/shared";

const sample: DemoSettings = {
  mode: "bottom",
  initial: "minimized",
  stiffness: 260,
  damping: 28,
  focusTrap: true,
  closeOnEscape: true,
  haptic: true,
  rubberBand: true,
};

describe("permalink encode/decode round-trip", () => {
  it("encodes all settings + adapter into a hash string", () => {
    const hash = encode(sample, "react");
    expect(hash.startsWith("#")).toBe(true);
    expect(hash).toContain("adapter=react");
    expect(hash).toContain("mode=bottom");
    expect(hash).toContain("stiff=260");
    expect(hash).toContain("damp=28");
    expect(hash).toContain("trap=1");
    expect(hash).toContain("esc=1");
    expect(hash).toContain("rubber=1");
    expect(hash).toContain("haptic=1");
    expect(hash).toContain("initial=minimized");
  });

  it("decodes back to the same settings + adapter", () => {
    const hash = encode(sample, "svelte");
    const out = decode(hash);
    expect(out.adapter).toBe("svelte");
    expect(out.settings).toMatchObject(sample);
  });

  it("round-trips edge values (low stiffness, zero damping)", () => {
    const edge: DemoSettings = {
      ...sample,
      stiffness: 50,
      damping: 0,
      focusTrap: false,
      closeOnEscape: false,
      rubberBand: false,
      haptic: false,
    };
    const out = decode(encode(edge, "vue"));
    expect(out.adapter).toBe("vue");
    expect(out.settings).toMatchObject(edge);
  });
});

describe("permalink decode — adversarial input is rejected", () => {
  it("returns empty settings for empty / non-hash input", () => {
    expect(decode("")).toEqual({ settings: {} });
    expect(decode("#")).toEqual({ settings: {} });
    expect(decode("not-a-hash")).toEqual({ settings: {} });
  });

  it("drops unknown adapter values silently", () => {
    expect(decode("#adapter=evil-injection").adapter).toBeUndefined();
    expect(decode("#adapter=").adapter).toBeUndefined();
    expect(decode("#adapter=qwik").adapter).toBeUndefined(); // qwik not in demo whitelist
  });

  it("drops unknown mode values silently", () => {
    expect(decode("#mode=diagonal").settings.mode).toBeUndefined();
    expect(decode("#mode=").settings.mode).toBeUndefined();
    expect(decode("#mode=top").settings.mode).toBe("top");
  });

  it("validates `initial` against XSS attribute injection", () => {
    // Only [a-z0-9_-] of length 1–32 allowed.
    expect(decode("#initial=<script>").settings.initial).toBeUndefined();
    expect(decode("#initial=" + "x".repeat(33)).settings.initial).toBeUndefined();
    expect(decode("#initial=name with space").settings.initial).toBeUndefined();
    expect(decode("#initial=valid-id_123").settings.initial).toBe("valid-id_123");
  });

  it("clamps stiffness to [50, 1000]", () => {
    expect(decode("#stiff=49").settings.stiffness).toBeUndefined();
    expect(decode("#stiff=1001").settings.stiffness).toBeUndefined();
    expect(decode("#stiff=NaN").settings.stiffness).toBeUndefined();
    expect(decode("#stiff=420.5").settings.stiffness).toBe(420); // parseInt truncates
    expect(decode("#stiff=420").settings.stiffness).toBe(420);
  });

  it("clamps damping to [0, 100]", () => {
    expect(decode("#damp=-1").settings.damping).toBeUndefined();
    expect(decode("#damp=101").settings.damping).toBeUndefined();
    expect(decode("#damp=0").settings.damping).toBe(0);
    expect(decode("#damp=100").settings.damping).toBe(100);
  });

  it("treats only '0' and '1' as valid flags", () => {
    expect(decode("#trap=true").settings.focusTrap).toBeUndefined();
    expect(decode("#trap=yes").settings.focusTrap).toBeUndefined();
    expect(decode("#trap=1").settings.focusTrap).toBe(true);
    expect(decode("#trap=0").settings.focusTrap).toBe(false);
  });

  it("survives a hash with garbage between valid params", () => {
    const out = decode(
      "#adapter=react&garbage=junk&stiff=380&another=evil&damp=22&trap=1",
    );
    expect(out.adapter).toBe("react");
    expect(out.settings.stiffness).toBe(380);
    expect(out.settings.damping).toBe(22);
    expect(out.settings.focusTrap).toBe(true);
  });
});

describe("permalink encode — output stable for identical input", () => {
  it("produces byte-identical output for identical input twice", () => {
    expect(encode(sample, "react")).toBe(encode(sample, "react"));
  });

  it("changes when adapter changes", () => {
    expect(encode(sample, "react")).not.toBe(encode(sample, "vue"));
  });

  it("changes when stiffness changes", () => {
    const a = encode(sample, "react");
    const b = encode({ ...sample, stiffness: 400 }, "react");
    expect(a).not.toBe(b);
  });
});

// `writeHash` uses setTimeout — the throttle behavior is hard to test in a
// node env without a `window`/`history` shim. We just verify it doesn't throw
// and that consumers can install a stub.
describe("writeHash — throttle delay (250ms)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Install minimal window + history stubs so the throttled write doesn't
    // crash in Node. The real one is exercised by the demo via Playwright.
    (globalThis as { window?: unknown }).window = {
      clearTimeout: globalThis.clearTimeout,
      setTimeout: globalThis.setTimeout,
    };
    (globalThis as { history?: unknown }).history = {
      replaceState: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { history?: unknown }).history;
  });

  it("collapses N rapid writes into one history.replaceState", async () => {
    const { writeHash } = await import("../../demo/lib/permalink");
    writeHash("#a=1");
    writeHash("#a=2");
    writeHash("#a=3");
    const replaceState = (globalThis as unknown as { history: { replaceState: ReturnType<typeof vi.fn> } })
      .history.replaceState;
    expect(replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "#a=3");
  });
});
