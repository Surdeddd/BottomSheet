import type { EngineFeature } from "./types";
import {
  contentSwipeFeature,
  visualViewportFeature,
  persistFeature,
  autoCollapseFeature,
  routeFeature,
} from "./features/engine-features";
import { contentFitFeature } from "./features/content-fit";

export function defaultEngineFeatures(): EngineFeature[] {
  return [
    contentSwipeFeature(),
    visualViewportFeature(),
    persistFeature(),
    autoCollapseFeature(),
    routeFeature(),
    contentFitFeature(),
  ];
}
