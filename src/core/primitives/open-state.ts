import type { BottomSheetCore } from "../BottomSheetCore";

export const closedSnapId = (
  points: ReadonlyArray<{ id: string; size: number | string }>,
): string | undefined => points.find(point => point.size === 0)?.id;

export const syncOpen = (engine: BottomSheetCore, open: boolean): void => {
  const phase = engine.state.phase;
  const showing = phase === "open" || phase === "opening";
  if (open && !showing) void engine.open();
  else if (!open && showing) void engine.close();
};
