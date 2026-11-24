import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tween } from "../../src/core/animation/animation";
import { runSpring } from "../../src/core/animation/spring";
import { AnimationRunner } from "../../src/core/controllers/animation-runner";

const wait = (ms: number): Promise<unknown> => vi.advanceTimersByTimeAsync(ms);
const settled = async <T>(running: Promise<T>): Promise<T> => {
  await vi.runAllTimersAsync();
  return running;
};
const linear = (t: number): number => t;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "setTimeout",
      "clearTimeout",
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tween retarget", () => {
  it("continues from where it is and lands on the new target", async () => {
    const values: number[] = [];
    const tw = tween({
      from: 0,
      to: 100,
      duration: 200,
      easing: linear,
      onUpdate: v => values.push(v),
    });
    await wait(80);
    const before = values[values.length - 1]!;
    const seen = values.length;
    tw.retarget(300);
    await settled(tw.promise);
    const firstAfter = values[seen]!;
    expect(before).toBeCloseTo(40, 5);
    expect(firstAfter - before).toBeCloseTo(((300 - before) * 16) / 120, 5);
    expect(values[values.length - 1]).toBe(300);
    for (let i = seen + 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it("ignores a retarget after it has finished", async () => {
    const values: number[] = [];
    const tw = tween({
      from: 0,
      to: 50,
      duration: 20,
      easing: linear,
      onUpdate: v => values.push(v),
    });
    await settled(tw.promise);
    const seen = values.length;
    tw.retarget(400);
    await wait(60);
    expect(values.length).toBe(seen);
    expect(values[values.length - 1]).toBe(50);
  });
});

describe("spring retarget", () => {
  it("swaps the target without a jump and settles on it", async () => {
    const values: number[] = [];
    const spring = runSpring({
      from: 0,
      to: 100,
      onUpdate: v => values.push(v),
    });
    await wait(60);
    const before = values[values.length - 1]!;
    const seen = values.length;
    spring.retarget(300);
    await settled(spring.promise);
    expect(Math.abs(values[seen]! - before)).toBeLessThan(25);
    expect(values[values.length - 1]).toBe(300);
  });

  it("gives up on a spring that never rests and lands on the target", async () => {
    const values: number[] = [];
    const spring = runSpring({
      from: 0,
      to: 100,
      config: { damping: 0 },
      maxDuration: 150,
      onUpdate: v => values.push(v),
    });
    await settled(spring.promise);
    expect(values[values.length - 1]).toBe(100);
  });
});

const makeRunner = (opts: { settleAnimation?: "waapi"; duration?: number } = {}) => {
  const element = document.createElement("section");
  const state = { size: 0, applied: [] as number[] };
  const runner = new AnimationRunner(
    {
      element,
      getRootEl: () => null,
      applySize: size => {
        state.size = size;
        state.applied.push(size);
      },
      getSize: () => state.size,
      isDragging: () => false,
      applyAux: size => {
        state.size = size;
      },
      getTransformFor: size => `size(${size})`,
    },
    {
      animation: "tween",
      duration: opts.duration ?? 200,
      easing: linear,
      respectReducedMotion: false,
      settleAnimation: opts.settleAnimation,
    },
  );
  return { runner, element, state };
};

describe("AnimationRunner", () => {
  it("cancels a running animation when asked to go where it already is", async () => {
    const { runner, state } = makeRunner();
    void runner.animateTo(100, 0);
    await settled(runner.animateTo(0, 0));
    await wait(300);
    expect(state.size).toBe(0);
    expect(runner.isAnimating).toBe(false);
  });

  it("retargets the running animation and reports false at rest", async () => {
    const { runner, state } = makeRunner();
    expect(runner.retarget(50)).toBe(false);
    const done = runner.animateTo(100, 0);
    await wait(60);
    expect(runner.retarget(250)).toBe(true);
    await settled(done);
    expect(state.size).toBe(250);
    expect(runner.isAnimating).toBe(false);
  });

  it("re-samples a compositor settle from the shown position on retarget", async () => {
    const { runner, element, state } = makeRunner({ settleAnimation: "waapi" });
    type Fake = {
      id: string;
      playState: string;
      currentTime: number;
      finished: Promise<void>;
      cancel: () => void;
      finish: () => void;
      frames: { transform: string }[];
    };
    const created: Fake[] = [];
    (element as unknown as { animate: unknown }).animate = (
      frames: { transform: string }[],
    ): Fake => {
      let resolve!: () => void;
      let reject!: (reason: unknown) => void;
      const finished = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      finished.catch(() => {});
      const anim: Fake = {
        id: "",
        playState: "running",
        currentTime: 0,
        finished,
        frames,
        cancel: () => {
          if (anim.playState !== "running") return;
          anim.playState = "idle";
          reject(new Error("cancelled"));
        },
        finish: () => {
          anim.playState = "finished";
          resolve();
        },
      };
      created.push(anim);
      return anim;
    };

    const done = runner.animateTo(300, 0);
    await wait(10);
    expect(created).toHaveLength(1);
    expect(created[0]!.frames.at(-1)!.transform).toBe("size(300)");

    created[0]!.currentTime = 100;
    expect(runner.retarget(500)).toBe(true);
    await wait(10);
    expect(created).toHaveLength(2);
    expect(created[0]!.playState).toBe("idle");
    expect(created[1]!.frames.at(-1)!.transform).toBe("size(500)");
    expect(created[1]!.frames[0]!.transform).toBe(`size(${state.size})`);
    expect(runner.isAnimating).toBe(true);

    created[1]!.finish();
    await settled(done);
    expect(state.size).toBe(500);
    expect(runner.isAnimating).toBe(false);
  });
});
