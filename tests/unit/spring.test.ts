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
    // First sample should be moving in the right direction
    expect(samples[1]!).toBeGreaterThan(samples[0]!);
  });

  it("respects initial velocity by overshooting in that direction", async () => {
    const samples: number[] = [];
    const handle = runSpring({
      from: 100,
      to: 100, // already at target
      velocity: 500, // but moving fast
      onUpdate: v => samples.push(v),
    });
    await handle.promise;
    // With velocity > 0, the spring departs the target before returning.
    const peak = Math.max(...samples);
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
    // No further updates after cancel
    expect(updates).toBe(updatesAtCancel);
  });

  it("uses overdamped config without overshoot", async () => {
    const samples: number[] = [];
    const handle = runSpring({
      from: 0,
      to: 100,
      config: { stiffness: 100, damping: 50, mass: 1 }, // way overdamped
      onUpdate: v => samples.push(v),
    });
    await handle.promise;
    const peak = Math.max(...samples);
    expect(peak).toBeLessThanOrEqual(100.5); // tiny tolerance for floating point
  });
});
