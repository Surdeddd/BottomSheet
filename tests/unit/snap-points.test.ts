import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  auditVhUsage,
  resolveSnap,
  resolveSnapList,
  findNearest,
  allowedRange,
  findById,
} from "../../src/core/primitives/snap-points";

describe("resolveSnap", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
  });

  it("returns pixels for number input", () => {
    expect(resolveSnap(120, "bottom")).toBe(120);
  });

  it("clamps negative pixels to zero", () => {
    expect(resolveSnap(-50, "bottom")).toBe(0);
  });

  it("returns viewport height for full on bottom mode", () => {
    expect(resolveSnap("full", "bottom")).toBe(1000);
  });

  it("returns viewport width for full on left/right modes", () => {
    expect(resolveSnap("full", "left")).toBe(800);
    expect(resolveSnap("full", "right")).toBe(800);
  });

  it("resolves percentages against vertical axis for bottom/top", () => {
    expect(resolveSnap("50%", "bottom")).toBe(500);
    expect(resolveSnap("80%", "top")).toBe(800);
  });

  it("resolves percentages against horizontal axis for left/right", () => {
    expect(resolveSnap("50%", "left")).toBe(400);
    expect(resolveSnap("25%", "right")).toBe(200);
  });

  it("returns 0 for fit when no measurer provided", () => {
    expect(resolveSnap("fit", "bottom")).toBe(0);
  });

  it("calls measurer for fit", () => {
    expect(resolveSnap("fit", "bottom", () => 88)).toBe(88);
  });

  it("resolves 'fit' to the probe element's offsetHeight", () => {
    const probe = () => 88;
    expect(resolveSnap("fit", "bottom", probe)).toBe(88);
    expect(resolveSnap("fit", "top", probe)).toBe(88);
    expect(resolveSnap("fit", "left", probe)).toBe(88);
    expect(resolveSnap("fit", "right", probe)).toBe(88);
  });
});

describe("resolveSnapList", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
  });

  it("resolves and sorts smallest → largest", () => {
    const list = resolveSnapList(
      [
        { id: "full", size: "80%" },
        { id: "min", size: 100 },
        { id: "half", size: "50%" },
      ],
      "bottom",
    );
    expect(list).toEqual([
      { id: "min", size: 100 },
      { id: "half", size: 500 },
      { id: "full", size: 800 },
    ]);
  });
});

describe("findNearest", () => {
  const list = [
    { id: "a", size: 0 },
    { id: "b", size: 100 },
    { id: "c", size: 500 },
    { id: "d", size: 900 },
  ];

  it("finds the closest snap when no direction", () => {
    expect(findNearest(120, list, ["a", "b", "c", "d"], 0)?.id).toBe("b");
    expect(findNearest(750, list, ["a", "b", "c", "d"], 0)?.id).toBe("d");
  });

  it("filters by allowed list", () => {
    expect(findNearest(120, list, ["a", "c"], 0)?.id).toBe("a");
  });

  it("biases toward direction × velocity", () => {
    expect(findNearest(110, list, ["a", "b", "c", "d"], 1, 400)?.id).toBe("c");
  });

  it("returns null for empty allowed pool", () => {
    expect(findNearest(120, list, [], 0)).toBeNull();
  });
});

describe("allowedRange", () => {
  it("returns min and max sizes from allowed pool", () => {
    const list = [
      { id: "a", size: 0 },
      { id: "b", size: 100 },
      { id: "c", size: 500 },
    ];
    expect(allowedRange(list, ["a", "b", "c"])).toEqual({ min: 0, max: 500 });
    expect(allowedRange(list, ["b", "c"])).toEqual({ min: 100, max: 500 });
  });

  it("returns 0,0 when allowed pool is empty", () => {
    expect(allowedRange([], [])).toEqual({ min: 0, max: 0 });
  });
});

describe("findById", () => {
  it("finds by exact id", () => {
    const list = [{ id: "x", size: 1 }, { id: "y", size: 2 }];
    expect(findById("y", list)?.size).toBe(2);
    expect(findById("z", list)).toBeNull();
  });
});

describe("auditVhUsage", () => {
  it("warns when snap size uses vh instead of dvh", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditVhUsage([{ id: "minimized", size: "50vh" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]![0]);
    expect(msg).toContain("vh");
    expect(msg).toContain("dvh");
    expect(msg).toContain("minimized");
    warn.mockRestore();
  });

  it("warns for vh nested inside clamp() / min() / max()", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditVhUsage([
      { id: "a", size: "clamp(200px, 60vh, 800px)" },
      { id: "b", size: "min(80vh, 600px)" },
      { id: "c", size: "max(40vh, 320px)" },
    ]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("does NOT warn for dvh / lvh / svh", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditVhUsage([
      { id: "dynamic", size: "50dvh" },
      { id: "large", size: "50lvh" },
      { id: "small", size: "50svh" },
      { id: "nested", size: "clamp(200px, 50dvh, 800px)" },
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does NOT warn for non-string sizes or px / % values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditVhUsage([
      { id: "px", size: 320 },
      { id: "pct", size: "50%" },
      { id: "fit", size: "fit" },
      { id: "full", size: "full" },
      { id: "env", size: "env(safe-area-inset-bottom)" },
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does NOT warn for unrelated tokens like vhf or xvh", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditVhUsage([
      { id: "fake1", size: "10vhf" },
      { id: "fake2", size: "10xvh" },
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("matches uppercase VH (case-insensitive)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditVhUsage([{ id: "upper", size: "50VH" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
