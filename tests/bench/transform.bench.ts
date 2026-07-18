import { bench, describe } from "vitest";
import { BENCH_OPTS } from "./_bench-opts";
import {
  buildTransformTemplate,
  type TransformAxis,
} from "../../src/core/primitives/transform";

describe("transform", () => {
  for (const axis of ["bottom", "top", "left", "right"] as const satisfies readonly TransformAxis[]) {
    const tmpl = buildTransformTemplate(axis);
    bench(
      `transformTemplate(${axis}) call`,
      () => {
        tmpl(123.456);
      },
      BENCH_OPTS,
    );
  }
});
