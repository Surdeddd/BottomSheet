import { describe, expect, it } from "vitest";
import { runSpring } from "../../src/core/animation/spring";

describe("runSpring", () => {
  it("settles at target value", async () => {
    let last = 0;
    const handle = runSpring({
      from: 0,
      to: 200,
      onUpdate: v => (last = v),
    });
    await handle.promise;
    expect(last).toBe(200);
  });

  it("monotonically approaches target without velocity", async () => {
    const samples: number[] = [];
    const handle = runSpring({
      from: 0,
      to: 100,
      onUpdate: v => samples.push(v),
    });
    await handle.promise;
    expect(samples.length).toBeGreaterThan(2);
    expect(samples[samples.length - 1]).toBe(100);
    expect(samples[1]!).toBeGreaterThan(samples[0]!);
  });

  it("respects initial velocity by overshooting in that direction", async () => {
    const samples: number[] = [];
    const handle = runSpring({
      from: 100,
      to: 100,
      velocity: 500,
      onUpdate: v => samples.push(v),
    });
    await handle.promise;
    const peak = samples.reduce((a, b) => (b > a ? b : a), -Infinity);
    expect(peak).toBeGreaterThan(100);
    expect(samples[samples.length - 1]).toBe(100);
  });

  it("can be cancelled mid-flight", async () => {
    let updates = 0;
    const handle = runSpring({
      from: 0,
      to: 1000,
      onUpdate: () => updates++,
    });
    await new Promise(r => setTimeout(r, 30));
    handle.cancel();
    const updatesAtCancel = updates;
    await new Promise(r => setTimeout(r, 100));
    expect(updates).toBe(updatesAtCancel);
  });

  it("settles instead of hanging when the config diverges to NaN", async () => {
    let last = -1;
    const handle = runSpring({
      from: 0,
      to: 100,
      config: { mass: 0 },
      onUpdate: v => (last = v),
    });
    await handle.promise;
    expect(last).toBe(100);
  });

  it("uses overdamped config without overshoot", async () => {
    const samples: number[] = [];
    const handle = runSpring({
      from: 0,
      to: 100,
      config: { stiffness: 100, damping: 50, mass: 1 },
      onUpdate: v => samples.push(v),
    });
    await handle.promise;
    const peak = samples.reduce((a, b) => (b > a ? b : a), -Infinity);
    expect(peak).toBeLessThanOrEqual(100.5);
  });
});
