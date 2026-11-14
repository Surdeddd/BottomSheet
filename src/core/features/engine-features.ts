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
            isOpen: () => ctx.getPhase() !== "closed",
            close: () => ctx.close(),
          }),
        );
      }
      teardowns.add(
        installRoute({
          routedTo: ctx.options.routedTo,
          closeOnBack: ctx.options.closeOnBack,
          isOpen: () => ctx.getPhase() !== "closed",
          isDestroyed: ctx.isDestroyed,
          close: () => ctx.close("back"),
          hold: ctx.holdSettle,
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
        isAnimating: ctx.isAnimating,
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
        isVerticalAxis: ctx.isVerticalAxis,
        isDestroyed: ctx.isDestroyed,
        recomputeSnaps: ctx.recomputeSnaps,
        resolveActiveSnap: ctx.resolveActiveSnap,
        getMaxAxisSize: ctx.getMaxAxisSize,
        setMaxAxisSize: ctx.setMaxAxisSize,
        setKeyboardInset: ctx.setKeyboardInset,
        reseat: ctx.reseat,
      });
    },
  };
}
