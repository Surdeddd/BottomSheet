import { describe, expect, it } from "vitest";
import {
  buildTransformTemplate,
  offsetFromMatrix,
  type TransformAxis,
} from "../../src/core/primitives/transform";

const translation = (css: string): { m41: number; m42: number } => {
  const [x, y] = /translate3d\((-?[\d.]+)(?:px)?, (-?[\d.]+)(?:px)?/
    .exec(css)!
    .slice(1)
    .map(Number);
  return { m41: x!, m42: y! };
};

describe("offsetFromMatrix", () => {
  for (const axis of ["bottom", "top", "left", "right"] as TransformAxis[]) {
    it(`reads back the offset a ${axis} sheet is written with`, () => {
      for (const offset of [0, 12.5, 240]) {
        const written = buildTransformTemplate(axis)(offset);
        expect(offsetFromMatrix(axis, translation(written))).toBeCloseTo(
          offset,
          10,
        );
      }
    });
  }
});
