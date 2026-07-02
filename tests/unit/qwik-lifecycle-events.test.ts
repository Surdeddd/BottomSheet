// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { BottomSheetProps } from "../../src/qwik/index";

type Keys = keyof BottomSheetProps;

type Assert<T extends true> = T;
type Has<K extends string> = K extends Keys ? true : false;
type Missing<K extends string> = K extends Keys ? false : true;

describe("@surdeddd/bottom-sheet/qwik — QRL lifecycle props (compile-time contract)", () => {
  it("declares the added fire-and-forget QRL props", () => {
    type _added = Assert<
      Has<"onOpen$"> &
        Has<"onClose$"> &
        Has<"onOpened$"> &
        Has<"onClosed$"> &
        Has<"onDragStart$"> &
        Has<"onDragEnd$">
    >;
    const marker: _added = true;
    expect(marker).toBe(true);
  });

  it("does NOT declare onDrag$/onProgress$ (per-frame QRL) or before-snap$/before-close$ (async QRL vs sync cancel)", () => {
    type _excluded = Assert<
      Missing<"onDrag$"> &
        Missing<"onProgress$"> &
        Missing<"onBeforeSnap$"> &
        Missing<"onBeforeClose$">
    >;
    const marker: _excluded = true;
    expect(marker).toBe(true);
  });
});
