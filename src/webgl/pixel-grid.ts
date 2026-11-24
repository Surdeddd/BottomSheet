export type GridLine = {
  start: number;
  first: number;
  scale: number;
  screen: boolean;
};

const HALF_UP = 0.001;
const LAYOUT_UNITS = 64;

export const snapsToScreen = (): boolean =>
  typeof navigator !== "undefined" && /apple/i.test(navigator.vendor || "");

export const snapTo = (line: GridLine): ((value: number) => number) => {
  const { start, first, scale, screen } = line;
  if (!screen) {
    return value =>
      (Math.round((value - start) * scale + HALF_UP) - first) / scale;
  }
  const base = first + Math.round(start * scale + HALF_UP);
  return value => {
    const laid =
      start +
      Math.ceil((value - start) * LAYOUT_UNITS - HALF_UP) / LAYOUT_UNITS;
    return (Math.round(laid * scale + HALF_UP) - base) / scale;
  };
};

export const onGrid = (origin: number, offset: number): number =>
  Math.round(origin) + Math.round(offset) - origin;
