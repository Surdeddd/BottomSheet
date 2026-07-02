import { describe, expect, it, vi, afterEach } from "vitest";
import { emitCancelable } from "../../src/core/primitives/cancelable-emit";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("emitCancelable", () => {
  it("returns true when cancel() is called synchronously inside the listener", () => {
    const result = emitCancelable(
      payload => payload.cancel(),
      { id: "open" },
      "before-snap",
    );
    expect(result).toBe(true);
  });

  it("returns false when the listener does not cancel", () => {
    const result = emitCancelable(() => {}, { id: "open" }, "before-snap");
    expect(result).toBe(false);
  });

  it("ignores a post-freeze async cancel and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let deferredCancel: () => void = () => {};
    const result = emitCancelable(
      payload => {
        deferredCancel = payload.cancel;
      },
      { reason: "programmatic" },
      "before-close",
    );
    expect(result).toBe(false);
    deferredCancel();
    expect(warn).toHaveBeenCalledWith(
      "[BottomSheet] before-close.cancel() called asynchronously — ignored. cancel() must be invoked synchronously inside the listener.",
    );
  });

  it("passes the base payload fields through to the listener", () => {
    const seen: Array<{ id: string; size: number }> = [];
    emitCancelable(
      payload => {
        seen.push({ id: payload.id, size: payload.size });
      },
      { id: "half", size: 300 },
      "before-snap",
    );
    expect(seen).toEqual([{ id: "half", size: 300 }]);
  });
});
