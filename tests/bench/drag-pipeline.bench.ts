import { bench, describe } from "vitest";
import { BENCH_OPTS } from "./_bench-opts";
import { createEventBus } from "../../src/core/primitives/event-bus";
import { rubberBand } from "../../src/core/primitives/rubber-band";

type DragPayload = { size: number; delta: number };
type DragMap = { drag: DragPayload };

describe("drag pipeline — emit allocation cost", () => {
  const bus = createEventBus<DragMap>();
  bus.on("drag", () => {});
  const pooledPayload: DragPayload = { size: 0, delta: 0 };

  bench(
    "emit drag with FRESH payload alloc per frame (pre-pool baseline)",
    () => {
      bus.emit("drag", { size: 500, delta: 1.5 });
    },
    BENCH_OPTS,
  );

  bench(
    "emit drag with POOLED payload (current impl)",
    () => {
      pooledPayload.size = 500;
      pooledPayload.delta = 1.5;
      bus.emit("drag", pooledPayload);
    },
    BENCH_OPTS,
  );
});

describe("drag pipeline — rubber-band clamping branches", () => {
  const min = 100;
  const max = 800;
  const maxAxis = 900;
  const dragStart = 500;

  bench(
    "onMove math: in-range delta (no clamp)",
    () => {
      const delta = 50;
      const next = dragStart + delta;
      if (next > max) {
      } else if (next < min) {
      }
    },
    BENCH_OPTS,
  );

  bench(
    "onMove math: past max → rubber-band clamp",
    () => {
      const delta = 400;
      let next = dragStart + delta;
      if (next > max) {
        next = max + rubberBand(next - max, maxAxis);
      }
    },
    BENCH_OPTS,
  );

  bench(
    "onMove math: below min → rubber-band clamp",
    () => {
      const delta = -500;
      let next = dragStart + delta;
      if (next < min) {
        next = min - rubberBand(min - next, maxAxis);
      }
    },
    BENCH_OPTS,
  );
});

describe("drag pipeline — listenerCount gate skip", () => {
  const busWith = createEventBus<DragMap>();
  busWith.on("drag", () => {});
  const busWithout = createEventBus<DragMap>();
  const payload: DragPayload = { size: 0, delta: 0 };

  bench(
    "hot path with NO drag listener — gate skips emit",
    () => {
      if (busWithout.listenerCount("drag") > 0) {
        payload.size = 500;
        payload.delta = 1.5;
        busWithout.emit("drag", payload);
      }
    },
    BENCH_OPTS,
  );

  bench(
    "hot path WITH drag listener — gate passes, emit runs",
    () => {
      if (busWith.listenerCount("drag") > 0) {
        payload.size = 500;
        payload.delta = 1.5;
        busWith.emit("drag", payload);
      }
    },
    BENCH_OPTS,
  );
});
