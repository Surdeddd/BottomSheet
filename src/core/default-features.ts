import type { EngineFeature } from "./types";
import {
  contentSwipeFeature,
  visualViewportFeature,
  persistFeature,
  autoCollapseFeature,
  routeFeature,
} from "./features/engine-features";

export function defaultEngineFeatures(): EngineFeature[] {
  return [
    contentSwipeFeature(),
    visualViewportFeature(),
    persistFeature(),
    autoCollapseFeature(),
    routeFeature(),
  ];
}
