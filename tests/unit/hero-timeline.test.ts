import { describe, expect, it } from "vitest";
import {
  LAYER_COUNT,
  buildAt,
  focusOf,
  layerLift,
  litCount,
  sheetFraction,
  travelAt,
} from "../../demo/lib/hero-3d/timeline";

const span = { stickStart: 700, stickEnd: 2700 };
const layers = Array.from({ length: LAYER_COUNT }, (_, i) => i);
const steps = Array.from({ length: 101 }, (_, i) => i / 100);

describe("hero stage timeline", () => {
  it("travels from the hero to the pin over the scroll before the pin", () => {
    expect(travelAt(0, span)).toBe(0);
    expect(travelAt(350, span)).toBeCloseTo(0.5, 5);
    expect(travelAt(700, span)).toBe(1);
    expect(travelAt(5000, span)).toBe(1);
    expect(travelAt(-40, span)).toBe(0);
  });

  it("builds across the pinned range and nowhere else", () => {
    expect(buildAt(0, span)).toBe(0);
    expect(buildAt(700, span)).toBe(0);
    expect(buildAt(1700, span)).toBeCloseTo(0.5, 5);
    expect(buildAt(2700, span)).toBe(1);
    expect(buildAt(9000, span)).toBe(1);
  });

  it("survives a layout with no pinned range", () => {
    const flat = { stickStart: 0, stickEnd: 0 };
    expect(travelAt(120, flat)).toBe(1);
    expect(buildAt(120, flat)).toBe(0);
  });

  it("keeps the phone whole in the hero", () => {
    for (const i of layers) expect(layerLift(0, 0, i)).toBe(0);
  });

  it("has every layer lifted when the stage arrives at the pin", () => {
    for (const i of layers) expect(layerLift(1, 0, i)).toBe(1);
  });

  it("lifts the upper layers first on the way to the pin", () => {
    for (const t of steps) {
      for (let i = 1; i < LAYER_COUNT; i++) {
        expect(layerLift(t, 0, i)).toBeGreaterThanOrEqual(
          layerLift(t, 0, i - 1),
        );
      }
    }
  });

  it("docks the layers back to front and never lifts one again", () => {
    for (const i of layers) {
      let previous = 1;
      for (const b of steps) {
        const lift = layerLift(1, b, i);
        expect(lift).toBeLessThanOrEqual(previous + 1e-9);
        previous = lift;
      }
    }
    for (const b of steps) {
      for (let i = 1; i < LAYER_COUNT; i++) {
        expect(layerLift(1, b, i)).toBeGreaterThanOrEqual(
          layerLift(1, b, i - 1) - 1e-9,
        );
      }
    }
  });

  it("is fully assembled before the pinned range ends", () => {
    for (const i of layers) expect(layerLift(1, 0.88, i)).toBe(0);
  });

  it("lights the legend one row at a time, in order", () => {
    expect(litCount(0)).toBe(0);
    let previous = 0;
    for (const b of steps) {
      const lit = litCount(b);
      expect(lit).toBeGreaterThanOrEqual(previous);
      expect(lit - previous).toBeLessThanOrEqual(1);
      previous = lit;
    }
    expect(litCount(1)).toBe(LAYER_COUNT);
  });

  it("highlights only the layer that is on its way", () => {
    for (const b of steps) {
      const strong = layers.filter(i => focusOf(b, i) > 0.5);
      expect(strong.length).toBeLessThanOrEqual(1);
    }
    expect(focusOf(0, 0)).toBe(0);
    expect(focusOf(1, LAYER_COUNT - 1)).toBe(0);
  });

  it("holds the sheet half open while it is taken apart and opens it at the end", () => {
    expect(sheetFraction(0, 0, 0.16)).toBe(0.16);
    expect(sheetFraction(1, 0.4, 0.16)).toBe(0.46);
    expect(sheetFraction(1, 0.95, 0.16)).toBe(0.88);
  });
});
