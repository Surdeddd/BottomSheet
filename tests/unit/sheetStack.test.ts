import { describe, expect, it, beforeEach } from "vitest";
import { sheetStack, __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";

beforeEach(() => __resetSheetStackForTests());

const makeEntry = (id: string) => {
  const calls: { z: number[]; isTop: boolean[] } = { z: [], isTop: [] };
  return {
    id,
    setZIndex: (z: number) => calls.z.push(z),
    setIsTop: (isTop: boolean) => calls.isTop.push(isTop),
    calls,
  };
};

describe("sheetStack", () => {
  it("assigns ascending z-indices and marks the topmost", () => {
    const a = makeEntry("a");
    const b = makeEntry("b");
    const releaseA = sheetStack.push(a);
    const releaseB = sheetStack.push(b);
    expect(a.calls.z.at(-1)).toBe(100);
    expect(b.calls.z.at(-1)).toBe(110);
    expect(a.calls.isTop.at(-1)).toBe(false);
    expect(b.calls.isTop.at(-1)).toBe(true);
    releaseB();
    // a is now topmost
    expect(a.calls.isTop.at(-1)).toBe(true);
    releaseA();
  });

  it("recomputes after a non-top removal", () => {
    const a = makeEntry("a");
    const b = makeEntry("b");
    const c = makeEntry("c");
    const releaseA = sheetStack.push(a);
    const releaseB = sheetStack.push(b);
    const releaseC = sheetStack.push(c);
    expect(c.calls.z.at(-1)).toBe(120);
    releaseB(); // remove the middle entry
    // c should now be at z=110 (second of two)
    expect(c.calls.z.at(-1)).toBe(110);
    releaseA();
    releaseC();
  });
});
