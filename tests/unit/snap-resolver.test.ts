import { describe, expect, it, vi } from "vitest";
import { SnapResolver } from "../../src/core/primitives/snap-resolver";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";
import type { SnapPointDef } from "../../src/core/types";

const flush = (): void => __resetCssLengthProbeForTests();

const numericSnaps: SnapPointDef[] = [
  { id: "min", size: 100 },
  { id: "half", size: 400 },
  { id: "full", size: 800 },
];

describe("SnapResolver", () => {
  describe("constructor + recompute", () => {
    it("fires onMaxAxisSizeChange exactly once during construction with the largest resolved size", () => {
      flush();
      const cb = vi.fn();
      new SnapResolver(numericSnaps, undefined, "bottom", undefined, cb);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(800);
    });

    it("uses raw snap ids as default allow-list when caller passes undefined", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      expect(r.getAllowedIds()).toEqual(["min", "half", "full"]);
    });

    it("preserves explicit allow-list", () => {
      flush();
      const r = new SnapResolver(
        numericSnaps,
        ["half", "full"],
        "bottom",
      );
      expect(r.getAllowedIds()).toEqual(["half", "full"]);
    });
  });

  describe("setMaxAxisSize → onMaxAxisSizeChange callback (m9 regression)", () => {
    it("fires the callback with the new value", () => {
      flush();
      const cb = vi.fn();
      const r = new SnapResolver(numericSnaps, undefined, "bottom", undefined, cb);
      cb.mockClear();
      r.setMaxAxisSize(500);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(500);
      expect(r.getMaxAxisSize()).toBe(500);
    });

    it("does NOT invalidate the range cache (viewport clamp doesn't shift range)", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      const before = r.getAllowedRange();
      r.setMaxAxisSize(500);
      const after = r.getAllowedRange();
      expect(after).toBe(before);
    });

    it("does not fire callback when no callback was provided at construction", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      expect(() => r.setMaxAxisSize(500)).not.toThrow();
      expect(r.getMaxAxisSize()).toBe(500);
    });
  });

  describe("setRaw", () => {
    it("re-resolves and fires callback with the NEW maxAxisSize", () => {
      flush();
      const cb = vi.fn();
      const r = new SnapResolver(numericSnaps, undefined, "bottom", undefined, cb);
      cb.mockClear();
      r.setRaw([
        { id: "tiny", size: 50 },
        { id: "medium", size: 250 },
      ]);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(250);
      expect(r.getMaxAxisSize()).toBe(250);
    });

    it("invalidates the range cache (full recompute)", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      const before = r.getAllowedRange();
      r.setRaw([
        { id: "min", size: 100 },
        { id: "max", size: 200 },
      ]);
      const after = r.getAllowedRange();
      expect(after).not.toBe(before);
    });
  });

  describe("setAllowedIds", () => {
    it("invalidates the range cache without firing the callback", () => {
      flush();
      const cb = vi.fn();
      const r = new SnapResolver(numericSnaps, undefined, "bottom", undefined, cb);
      cb.mockClear();
      const before = r.getAllowedRange();
      r.setAllowedIds(["min", "half"]);
      expect(cb).not.toHaveBeenCalled();
      const after = r.getAllowedRange();
      expect(after).not.toBe(before);
      expect(after.max).toBe(400);
    });
  });

  describe("findById", () => {
    it("returns the resolved snap for a known id", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      expect(r.findById("half")).toEqual({ id: "half", size: 400 });
    });

    it("returns null for an unknown id", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      expect(r.findById("ghost")).toBeNull();
    });
  });

  describe("getAllowedRange (memoization)", () => {
    it("returns the same object identity across repeated calls until invalidated", () => {
      flush();
      const r = new SnapResolver(numericSnaps, undefined, "bottom");
      const a = r.getAllowedRange();
      const b = r.getAllowedRange();
      expect(a).toBe(b);
    });

    it("computes min/max from the allowed subset, not the full resolved list", () => {
      flush();
      const r = new SnapResolver(numericSnaps, ["half"], "bottom");
      const range = r.getAllowedRange();
      expect(range).toEqual({ min: 400, max: 400 });
    });
  });
});
