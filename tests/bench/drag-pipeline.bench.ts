import { bench, describe } from "vitest";
import { createEventBus } from "../../src/core/primitives/event-bus";
import { rubberBand } from "../../src/core/primitives/rubber-band";

/**
 * Drag-pipeline micro-benchmarks. Lock in baseline ops/sec for `onMove`'s
 * hot path so a future refactor that adds an allocation or a branch is
 * visible as a perf regression.
 *
 * **Note on the pool comparison**: the FRESH-vs-POOLED variants show
 * comparable throughput (~21M ops/sec each). V8's young-generation GC
 * amortizes short-lived `{size, delta}` allocations efficiently — the pool's
 * win is NOT in throughput on a steady-state CPU but in:
 *   1. GC pressure during long sustained drags (no scavenge collections from
 *      the drag emitter at all once the JIT warms up),
 *   2. predictability on low-end mobile where minor-GC stalls are visible
 *      as frame-time spikes,
 *   3. memory footprint when many sheets drag concurrently.
 * Throughput parity is the EXPECTED outcome — if the pool variant was
 * meaningfully slower, that would be a regression in the EventBus.
 *
 * Run with: `npm run bench` (or `npx vitest bench`)
 */

type DragPayload = { size: number; delta: number };
type DragMap = { drag: DragPayload };

describe("drag pipeline — emit allocation cost", () => {
  // No-op listener — measures the cost of the emit dispatch path itself,
  // including the payload allocation/mutation, not user handler work.
  const bus = createEventBus<DragMap>();
  bus.on("drag", () => {});
  const pooledPayload: DragPayload = { size: 0, delta: 0 };

  bench("emit drag with FRESH payload alloc per frame (pre-pool baseline)", () => {
    bus.emit("drag", { size: 500, delta: 1.5 });
  });

  bench("emit drag with POOLED payload (current impl)", () => {
    pooledPayload.size = 500;
    pooledPayload.delta = 1.5;
    bus.emit("drag", pooledPayload);
  });
});

describe("drag pipeline — rubber-band clamping branches", () => {
  const min = 100;
  const max = 800;
  const maxAxis = 900;
  const dragStart = 500;

  bench("onMove math: in-range delta (no clamp)", () => {
    const delta = 50;
    const next = dragStart + delta;
    // In range: 550 ∈ [100, 800], no rubber-band
    if (next > max) {
      // never taken
    } else if (next < min) {
      // never taken
    }
  });

  bench("onMove math: past max → rubber-band clamp", () => {
    const delta = 400;
    let next = dragStart + delta; // 900 > 800 → clamp
    if (next > max) {
      next = max + rubberBand(next - max, maxAxis);
    }
  });

  bench("onMove math: below min → rubber-band clamp", () => {
    const delta = -500;
    let next = dragStart + delta; // 0 < 100 → clamp
    if (next < min) {
      next = min - rubberBand(min - next, maxAxis);
    }
  });
});

describe("drag pipeline — listenerCount gate skip", () => {
  // GestureController gates payload mutation + emit behind
  // `if (listenerCount("drag") > 0)` so consumers without a "drag" listener
  // pay zero on the hot path. Measure both branches.
  const busWith = createEventBus<DragMap>();
  busWith.on("drag", () => {});
  const busWithout = createEventBus<DragMap>();
  const payload: DragPayload = { size: 0, delta: 0 };

  bench("hot path with NO drag listener — gate skips emit", () => {
    if (busWithout.listenerCount("drag") > 0) {
      payload.size = 500;
      payload.delta = 1.5;
      busWithout.emit("drag", payload);
    }
  });

  bench("hot path WITH drag listener — gate passes, emit runs", () => {
    if (busWith.listenerCount("drag") > 0) {
      payload.size = 500;
      payload.delta = 1.5;
      busWith.emit("drag", payload);
    }
  });
});
