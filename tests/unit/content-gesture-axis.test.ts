import { describe, expect, it } from "vitest";
import {
  decideContentGesture,
  CONTENT_DRAG_SLOP,
} from "../../src/core/primitives/content-gesture";

const past = CONTENT_DRAG_SLOP + 4;

describe("content gesture — shared axis (bottom / top)", () => {
  it("waits until the finger clears the slop", () => {
    expect(
      decideContentGesture({ delta: 2, scrollTop: 0, atMaxSnap: false }),
    ).toBe("pending");
  });

  it("gives the gesture to the scroller when it is not at its top", () => {
    expect(
      decideContentGesture({ delta: -past, scrollTop: 40, atMaxSnap: false }),
    ).toBe("scroll");
  });

  it("drags the sheet when the scroller sits at its top", () => {
    expect(
      decideContentGesture({ delta: -past, scrollTop: 0, atMaxSnap: false }),
    ).toBe("drag");
  });

  it("lets the content scroll when growing past the largest snap", () => {
    expect(
      decideContentGesture({ delta: past, scrollTop: 0, atMaxSnap: true }),
    ).toBe("scroll");
  });
});

describe("content gesture — independent axes (left / right)", () => {
  const base = { scrollTop: 0, atMaxSnap: false, sharesScrollAxis: false };

  it("drags the sheet on a mostly-sideways gesture", () => {
    expect(
      decideContentGesture({ ...base, delta: past, crossDelta: 3 }),
    ).toBe("drag");
  });

  it("scrolls the content on a mostly-vertical gesture", () => {
    expect(
      decideContentGesture({ ...base, delta: 3, crossDelta: past }),
    ).toBe("scroll");
  });

  it("still drags sideways when the content is scrolled away from its top", () => {

    expect(
      decideContentGesture({
        ...base,
        scrollTop: 250,
        delta: past,
        crossDelta: 2,
      }),
    ).toBe("drag");
  });

  it("ignores atMaxSnap, which is a same-axis notion", () => {
    expect(
      decideContentGesture({
        ...base,
        atMaxSnap: true,
        delta: past,
        crossDelta: 1,
      }),
    ).toBe("drag");
  });

  it("waits while neither axis has cleared the slop", () => {
    expect(
      decideContentGesture({ ...base, delta: 2, crossDelta: 2 }),
    ).toBe("pending");
  });

  it("hands a diagonal tie to the scroller", () => {
    expect(
      decideContentGesture({ ...base, delta: past, crossDelta: past }),
    ).toBe("scroll");
  });

  it("scrolls when only the cross axis has moved", () => {
    expect(
      decideContentGesture({ ...base, delta: 0, crossDelta: past }),
    ).toBe("scroll");
  });
});
