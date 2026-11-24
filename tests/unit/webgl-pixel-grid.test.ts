import { describe, expect, it } from "vitest";
import { onGrid, snapTo } from "../../src/webgl/pixel-grid";

describe("the device pixel grid of a lifted layer", () => {
  it("counts rows from the sheet's own corner when the engine snaps inside the layer", () => {
    const row = snapTo({ start: 145.40625, first: 0, scale: 1, screen: false });

    expect(row(277.5)).toBe(132);
    expect(row(263.40625)).toBe(118);
  });

  it("counts rows from the screen when the engine snaps there", () => {
    const row = snapTo({ start: 145.40625, first: 0, scale: 1, screen: true });

    expect(row(277.5)).toBe(133);
  });

  it("returns canvas units, measured from the first row of the layer", () => {
    const row = snapTo({ start: 100, first: 10, scale: 2, screen: false });

    expect(row(112.3)).toBe((25 - 10) / 2);
  });

  it("lands on a whole device row at any scale", () => {
    for (const scale of [1, 1.5, 2, 2.75, 3]) {
      const row = snapTo({ start: 145.40625, first: 3, scale, screen: false });
      for (const value of [150, 192.40625, 231.7, 404.53125]) {
        const device = row(value) * scale;
        expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-9);
      }
    }
  });

  it("rounds a half up even when the product falls a hair short of it", () => {
    const row = snapTo({ start: 0, first: 0, scale: 2, screen: false });

    expect(row(10.25 - 1e-7)).toBe(21 / 2);
  });

  it("undoes the truncation of an engine that reports layout a sixty-fourth short", () => {
    const row = snapTo({ start: 132.8125, first: 0, scale: 1, screen: true });
    const sheet = Math.round(132.8125);

    expect(row(227.75 + 13.7405)).toBe(242 - sheet);
    expect(row(241.5)).toBe(242 - sheet);
    expect(row(241.5 - 1 / 64)).toBe(241 - sheet);
  });

  it("keeps the layout grid attached to the sheet, wherever a transform has put it", () => {
    const row = snapTo({ start: 100.3, first: 0, scale: 2, screen: true });
    const sheet = Math.round(100.3 * 2);

    expect(row(100.3 + 20.25 - 0.01)).toBe((Math.round(120.55 * 2) - sheet) / 2);
  });

  it("puts a layer on whole pixels wherever the sheet has stopped", () => {
    expect(400.6 + onGrid(400.6, 123.4)).toBeCloseTo(524, 9);
    expect(399.2 + onGrid(399.2, 0)).toBeCloseTo(399, 9);
  });
});
