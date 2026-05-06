import { describe, expect, it, vi } from "vitest";
import { createSheetManager } from "../../src/core/lifecycle/sheetManager";

describe("createSheetManager", () => {
  it("registers and resolves configs by key", () => {
    const m = createSheetManager<"home" | "marker">({
      home: { snapPoints: [{ id: "min", size: 100 }] },
      marker: { snapPoints: [{ id: "half", size: "50%" }] },
    });
    expect(m.resolve("home")?.snapPoints?.[0]?.id).toBe("min");
    expect(m.resolve("marker")?.snapPoints?.[0]?.id).toBe("half");
  });

  it("returns null for unknown keys", () => {
    const m = createSheetManager();
    expect(m.resolve("ghost" as never)).toBeNull();
  });

  it("register() replaces existing config", () => {
    const m = createSheetManager<"x">();
    m.register("x", { snapPoints: [{ id: "a", size: 1 }] });
    m.register("x", { snapPoints: [{ id: "b", size: 2 }] });
    expect(m.resolve("x")?.snapPoints?.[0]?.id).toBe("b");
  });

  it("unregister() removes a config", () => {
    const m = createSheetManager<"x">({
      x: { snapPoints: [{ id: "a", size: 1 }] },
    });
    m.unregister("x");
    expect(m.resolve("x")).toBeNull();
  });

  it("transition() runs onClose(prev) then onOpen(next)", () => {
    const onCloseHome = vi.fn();
    const onOpenMarker = vi.fn();
    const m = createSheetManager<"home" | "marker">({
      home: { onClose: onCloseHome },
      marker: { onOpen: onOpenMarker },
    });
    m.transition("home", "marker");
    expect(onCloseHome).toHaveBeenCalledWith("home");
    expect(onOpenMarker).toHaveBeenCalledWith("marker");
  });

  it("transition() handles null sides safely", () => {
    const m = createSheetManager();
    expect(() => m.transition(null, null)).not.toThrow();
  });

  it("keys() returns registered keys", () => {
    const m = createSheetManager<"a" | "b">();
    m.register("a", {});
    m.register("b", {});
    expect(m.keys().sort()).toEqual(["a", "b"]);
  });
});
