import type { MoveOutcome } from "../types";

export const notMounted = (): Promise<MoveOutcome> =>
  Promise.resolve("vetoed");
