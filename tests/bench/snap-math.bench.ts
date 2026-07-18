import { bench, describe } from "vitest";
import { BENCH_OPTS } from "./_bench-opts";
import {
  findNearest,
  allowedRange,
  findDragSettleTarget,
  type ResolvedSnap,
} from "../../src/core/primitives/snap-points";

const snaps: ResolvedSnap[] = [
  { id: "closed", size: 0 },
  { id: "min", size: 100 },
  { id: "half", size: 320 },
  { id: "full", size: 720 },
];

const allowedIds = ["min", "half", "full"];
const allAllowedIds = ["closed", "min", "half", "full"];

describe("snap-math", () => {
  bench(
    "findNearest 4 snaps",
    () => {
      findNearest(280, snaps, allAllowedIds);
    },
    BENCH_OPTS,
  );

  bench(
    "findNearest 4 snaps with direction+bias",
    () => {
      findNearest(280, snaps, allAllowedIds, 1, 60);
    },
    BENCH_OPTS,
  );

  bench(
    "allowedRange 4 snaps",
    () => {
      allowedRange(snaps, allowedIds);
    },
    BENCH_OPTS,
  );

  bench(
    "findDragSettleTarget — flick up",
    () => {
      findDragSettleTarget({
        delta: -50,
        velocity: 1.2,
        pointerKind: "touch",
        size: 200,
        activeId: "min",
        allowed: allAllowedIds,
        resolved: snaps,
        maxAxisSize: 720,
        flickVelocity: 0.65,
        dragThreshold: 18,
      });
    },
    BENCH_OPTS,
  );

  bench(
    "findDragSettleTarget — sub-threshold (no-op)",
    () => {
      findDragSettleTarget({
        delta: 4,
        velocity: 0.05,
        pointerKind: "touch",
        size: 100,
        activeId: "min",
        allowed: allAllowedIds,
        resolved: snaps,
        maxAxisSize: 720,
        flickVelocity: 0.65,
        dragThreshold: 18,
      });
    },
    BENCH_OPTS,
  );
});
