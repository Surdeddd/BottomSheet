import { BottomSheetCore } from "./BottomSheetCore";
import { defaultEngineFeatures } from "./default-features";
import type { EngineOptions } from "./types";

export class BottomSheetEngine extends BottomSheetCore {
  constructor(opts: EngineOptions) {
    super({
      ...opts,
      features: [...defaultEngineFeatures(), ...(opts.features ?? [])],
    });
  }
}
