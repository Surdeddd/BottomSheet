import type { EngineFeature } from "../types";
import { installRoute, installRouteChange } from "./route";
import { installPersist } from "./persist";
import { installAutoCollapse } from "./auto-collapse";
import { installContentDrag } from "./content-drag";
import { installVisualViewport } from "./visual-viewport";
import { TeardownStack } from "../primitives/teardown-stack";

export function routeFeature(): EngineFeature {
  return {
    name: "route",
    install: ctx => {
      const teardowns = new TeardownStack();
      if (ctx.options.closeOnRouteChange) {
        teardowns.add(
          installRouteChange({
            isDestroyed: ctx.isDestroyed,
            getSize: ctx.getSize,
            close: () => ctx.close(),
          }),
        );
      }
      teardowns.add(
        installRoute({
          routedTo: ctx.options.routedTo,
          closeOnBack: ctx.options.closeOnBack,
          isTopSheet: ctx.isTopSheet,
          getSize: ctx.getSize,
          isDestroyed: ctx.isDestroyed,
          close: () => ctx.close("back"),
          on: ctx.on,
          sheetId: ctx.sheetId,
        }),
      );
      return () => teardowns.drain();
    },
  };
}

export function persistFeature(): EngineFeature {
  return {
    name: "persist",
    install: ctx => {
      const key = ctx.options.persistKey;
      if (!key) return;
      return installPersist({ on: ctx.on }, key);
    },
  };
}

export function autoCollapseFeature(): EngineFeature {
  return {
    name: "auto-collapse",
    install: ctx =>
      installAutoCollapse({
        ms: ctx.options.autoCollapseAfter,
        isDestroyed: ctx.isDestroyed,
        isDragging: ctx.isDragging,
        getAllowedIds: ctx.getAllowedIds,
        getActiveId: ctx.getActiveId,
        resolveSnap: ctx.resolveSnap,
        snapTo: ctx.snapTo,
        on: ctx.on,
      }),
  };
}

export function contentSwipeFeature(): EngineFeature {
  return {
    name: "content-swipe",
    stage: "attach",
    install: ctx => {
      if (!ctx.scrollContainer) return;
      return installContentDrag({
        container: ctx.scrollContainer,
        attachDragSurface: ctx.attachDragSurface,
      });
    },
  };
}

export function visualViewportFeature(): EngineFeature {
  return {
    name: "visual-viewport",
    install: ctx => {
      if (typeof window === "undefined") return;
      return installVisualViewport({
        element: ctx.element,
        isVerticalAxis: ctx.isVerticalAxis,
        isDestroyed: ctx.isDestroyed,
        isDragging: ctx.isDragging,
        recomputeSnaps: ctx.recomputeSnaps,
        resolveActiveSnap: ctx.resolveActiveSnap,
        getMaxAxisSize: ctx.getMaxAxisSize,
        getSize: ctx.getSize,
        setMaxAxisSize: ctx.setMaxAxisSize,
        setSize: ctx.setSize,
        applySize: ctx.applySize,
        cancelInFlight: ctx.cancelInFlight,
        newCycle: ctx.newCycle,
        isAnimating: ctx.isAnimating,
        resyncAfterCancel: ctx.resyncAfterResize,
      });
    },
  };
}
