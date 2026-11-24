import { captureContent, hideCapturedText } from "./content-texture";
import type { ContentLift } from "./types";

export type Lifter = {
  capture: typeof captureContent;
  hide: typeof hideCapturedText;
};

export const contentLift = (): ContentLift =>
  ({
    capture: captureContent,
    hide: hideCapturedText,
  }) as unknown as ContentLift;
