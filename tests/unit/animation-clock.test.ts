import { afterEach, describe, expect, it, vi } from "vitest";
import { easeOutBack, tween } from "../../src/core/animation/animation";
import { runSpring } from "../../src/core/animation/spring";

const frameClock = (firstOffsetMs: number, frameMs = 16) => {
  let now = performance.now() + firstOffsetMs;
  let queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    run(frames: number): void {
      for (let i = 0; i < frames; i++) {
        const batch = queue;
        queue = [];
        for (const cb of batch) cb(now);
        now += frameMs;
      }
    },
  };
};

describe("animation clocks when the first frame began before the animation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a tween never starts by moving away from its target", () => {
    const clock = frameClock(-5);
    const seen: number[] = [];
    tween({
      from: 300,
      to: 0,
      duration: 220,
      easing: easeOutBack,
      onUpdate: v => seen.push(v),
    });
    clock.run(3);

    expect(seen.length).toBeGreaterThan(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(300);
  });

  it("an opening tween never starts below where it began", () => {
    const clock = frameClock(-8);
    const seen: number[] = [];
    tween({
      from: 0,
      to: 400,
      duration: 220,
      easing: easeOutBack,
      onUpdate: v => seen.push(v),
    });
    clock.run(3);

    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
  });

  it("a spring's first step heads for the target, not away from it", () => {
    const clock = frameClock(-6);
    const seen: { value: number; velocity: number }[] = [];
    runSpring({
      from: 300,
      to: 0,
      onUpdate: (value, velocity) => seen.push({ value, velocity }),
    });
    clock.run(3);

    expect(seen.length).toBeGreaterThan(1);
    expect(seen[0]!.velocity).toBeLessThanOrEqual(0);
    expect(Math.max(...seen.map(s => s.value))).toBeLessThanOrEqual(300);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!.value).toBeLessThanOrEqual(seen[i - 1]!.value);
    }
  });
});
