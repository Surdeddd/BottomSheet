import { sheetStack } from "./lifecycle/sheetStack";
import {
  buildTransformTemplate,
  layoutAxis,
  type TransformAxis,
} from "./primitives/transform";
import { nextInstanceId } from "./primitives/instance-id";
import { createEventBus, type EventBus } from "./primitives/event-bus";
import { auditVhUsage } from "./primitives/snap-points";
import { SnapResolver } from "./primitives/snap-resolver";
import { installPersist } from "./features/persist";
import { installAutoCollapse } from "./features/auto-collapse";
import { notifyLinkedSheets } from "./features/linked-sheets";
import { installRoute } from "./features/route";
import { installContentSwipe } from "./features/content-swipe";
import { installVisualViewport } from "./features/visual-viewport";
import { installResizeObserver } from "./features/resize-observer";
import { installSliderKeyboard } from "./features/slider-keyboard";
import { ScrimController } from "./controllers/scrim-controller";
import { AnimationRunner } from "./controllers/animation-runner";
import { LifecycleController } from "./controllers/lifecycle-controller";
import { GestureController } from "./controllers/gesture-controller";
import { AriaSliderWriter } from "./primitives/aria-slider-writer";
import {
  OPACITY_WRITE_EPSILON,
  SIZE_WRITE_EPSILON,
} from "./primitives/hot-path-thresholds";
import { createScrollCache, type ScrollCache } from "./features/scroll-cache";
import {
  attachAnchor,
  type AnchorHandle,
  type AnchorOptions,
} from "./features/sheet-anchors";
import {
  installScrimStages,
  type ScrimStagesOptions,
} from "./features/scrim-stages";
import { resolveEngineOptions } from "./primitives/engine-options";
import { WriteSentinel } from "./primitives/opacity-dedup";
import type {
  EngineOptions,
  EngineState,
  Plugin,
  ScrimOverlayOptions,
  ScrimUpdate,
  SheetEventMap,
  SheetMode,
  TeardownScope,
} from "./types";

type Listener<K extends keyof SheetEventMap> = (
  payload: SheetEventMap[K],
) => void;

const HAPTIC_DURATION_MS = 8;

class TeardownStack {
  private fns: Array<() => void> = [];
  add(fn: (() => void) | null | undefined): void {
    if (fn) this.fns.push(fn);
  }
  drain(): void {
    while (this.fns.length) {
      try {
        this.fns.pop()!();
      } catch (err) {
        queueMicrotask(() => {
          throw err;
        });
      }
    }
  }
}

export class BottomSheetEngine {
  private id = nextInstanceId("bs");
  private element: HTMLElement;
  private handle: HTMLElement;
  private scrollContainer?: HTMLElement;
  private backdrop?: HTMLElement;
  private screenComponent?: HTMLElement;
  private scrimParent: HTMLElement | null = null;
  private mode: SheetMode;
  private flickVelocity: number;
  private dragThreshold: number;
  private rubberBandEnabled: boolean;
  private scrim!: ScrimController;
  private aria!: AriaSliderWriter;
  private animation!: AnimationRunner;
  private lifecycle!: LifecycleController;
  private closeOnBack: boolean;
  private routedTo: string | undefined;

  private snapPointsRaw: EngineOptions["snapPoints"];
  private snaps!: SnapResolver;
  private activeId: string;

  private size = 0;
  private gesture: GestureController | undefined;
  private rootEl: HTMLElement | null = null;
  private destroyed = false;
  private currentViewTransition: {
    finished: Promise<void>;
    skipTransition?: () => void;
  } | null = null;
  private currentAbort = new AbortController();
  private sizeWriteSentinel = new WriteSentinel();
  private progressWriteSentinel = new WriteSentinel();
  private isTopSheet = true;
  private progressPayload: { value: number; size: number } = {
    value: 0,
    size: 0,
  };
  private dragContextBuf: {
    size: number;
    maxAxisSize: number;
    range: { min: number; max: number };
    rubberBandEnabled: boolean;
  } = {
    size: 0,
    maxAxisSize: 0,
    range: { min: 0, max: 0 },
    rubberBandEnabled: false,
  };

  private bus: EventBus<SheetEventMap> = createEventBus<SheetEventMap>();
  private persistKey: string | undefined;
  private linkedSheets: BottomSheetEngine[] = [];
  private scrollCache!: ScrollCache;
  private teardowns = new TeardownStack();
  private anchors: AnchorHandle[] = [];
  private anchorHost: HTMLElement | null = null;
  private stackZ = 100;
  private detachScrimStages: (() => void) | null = null;
  private stackEffectEnabled = false;
  private stackEffectPrimed = false;

  private transformTemplate!: (offset: number) => string;

  constructor(opts: EngineOptions) {
    const resolved = resolveEngineOptions(opts, {
      shouldApplyInertSiblings: () => {
        if (typeof document === "undefined") return false;
        const bodyChildren = Array.from(document.body.children) as HTMLElement[];
        return bodyChildren.some(
          c => c === opts.element || c.contains(opts.element),
        );
      },
    });

    this.element = opts.element;
    this.handle = opts.handle ?? opts.element;
    this.scrollContainer = opts.scrollContainer;
    this.backdrop = opts.backdrop;
    this.screenComponent = opts.scrim ?? opts.screenComponent;
    this.scrimParent = this.screenComponent?.parentElement ?? null;
    this.mode = resolved.mode;
    this.transformTemplate = buildTransformTemplate(this.mode as TransformAxis);
    this.aria = new AriaSliderWriter(this.handle, this.mode);
    this.flickVelocity = resolved.flickVelocity;
    this.dragThreshold = resolved.dragThreshold;
    this.rubberBandEnabled = resolved.rubberBandEnabled;
    this.scrim = new ScrimController(
      {
        mode: this.mode,
        screenComponent: this.screenComponent,
        backdrop: this.backdrop,
        isDestroyed: () => this.destroyed,
        isTopSheet: () => this.isTopSheet,
        getAllowedIds: () => this.snaps.getAllowedIds().slice(),
        getResolvedSnaps: () => this.snaps.getResolvedSnaps().slice(),
        snapTo: (id: string) => {
          void this.snapTo(id);
        },
        close: () => {
          void this.close();
        },
      },
      resolved.scrim,
    );
    this.animation = new AnimationRunner(
      {
        element: this.element,
        getRootEl: () => this.rootEl,
        applySize: (size: number) => this.applySize(size),
        getSize: () => this.size,
        isDragging: () => this.gesture?.isDragging ?? false,
      },
      resolved.animation,
    );
    this.lifecycle = new LifecycleController(
      {
        element: this.element,
        close: () => this.close(),
      },
      resolved.lifecycle,
    );
    this.closeOnBack = resolved.closeOnBack;
    this.routedTo = opts.routedTo;
    this.stackEffectEnabled = opts.stackEffect ?? false;

    this.snapPointsRaw = opts.snapPoints;
    this.persistKey = opts.persistKey;
    if (opts.linkedSheets) {
      this.linkedSheets = opts.linkedSheets as unknown as BottomSheetEngine[];
    }

    this.activeId = resolved.initialId;

    auditVhUsage(this.snapPointsRaw);

    this.rootEl = this.element.closest<HTMLElement>(".bs-root");
    this.snaps = new SnapResolver(
      this.snapPointsRaw,
      resolved.initialAllowed,
      this.mode,
      () =>
        layoutAxis(this.mode as TransformAxis) === "width"
          ? this.handle.offsetWidth
          : this.handle.offsetHeight,
      maxAxisSize => {
        this.element.style[layoutAxis(this.mode as TransformAxis)] =
          `${maxAxisSize}px`;
      },
    );
    const initial = this.snaps.findById(this.activeId);
    if (initial) this.size = initial.size;
    this.applySize(this.size);
    this.updateAriaSlider();

    this.scrollCache = createScrollCache({
      scrollContainer: this.scrollContainer,
      getMaxAxisSize: () => this.snaps.getMaxAxisSize(),
    });

    this.attach();
    this.registerInStack();

    if (
      this.snaps.getMaxAxisSize() === 0 &&
      typeof IntersectionObserver !== "undefined" &&
      typeof document !== "undefined"
    ) {
      const io = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (this.destroyed) return;
          this.snaps.recompute();
          const current = this.snaps.findById(this.activeId);
          if (current) {
            this.size = current.size;
            this.applySize(this.size);
            this.updateAriaSlider();
          }
          io.disconnect();
          return;
        }
      });
      io.observe(this.element);
      this.teardowns.add(() => io.disconnect());
    }

    if (this.persistKey) {
      this.teardowns.add(installPersist(this, this.persistKey));
    }

    this.teardowns.add(
      installAutoCollapse({
        ms: opts.autoCollapseAfter,
        isDestroyed: () => this.destroyed,
        isDragging: () => this.gesture?.isDragging ?? false,
        getAllowedIds: () => this.snaps.getAllowedIds().slice(),
        getActiveId: () => this.activeId,
        resolveSnap: id => this.snaps.findById(id),
        snapTo: id => {
          void this.snapTo(id);
        },
        on: (event, fn) => this.on(event, fn),
      }),
    );

    this.teardowns.add(
      installRoute({
        routedTo: this.routedTo,
        closeOnBack: this.closeOnBack,
        isTopSheet: () => this.isTopSheet,
        getSize: () => this.size,
        isDestroyed: () => this.destroyed,
        close: () => this.close(),
        on: (event, fn) => this.on(event, fn),
        sheetId: this.id,
      }),
    );

    if (this.size > 0) {
      this.handleOpen();
    }
  }

  get state(): EngineState {
    return {
      size: this.size,
      activeId: this.activeId,
      isDragging: this.gesture?.isDragging ?? false,
      isAnimating: this.animation.isAnimating,
      progress: this.computeProgress(this.size),
    };
  }

  on<K extends keyof SheetEventMap>(event: K, fn: Listener<K>): () => void {
    return this.bus.on(event, fn);
  }

  use(plugin: Plugin): this {
    if (this.destroyed) {
      console.warn(
        `[BottomSheet] use("${plugin.name}") called on destroyed engine — ignored.`,
      );
      return this;
    }
    const scoped: Array<() => void> = [];
    const scope: TeardownScope = {
      add: fn => {
        if (typeof fn === "function") scoped.push(fn);
      },
    };
    let teardown: ReturnType<Plugin["install"]>;
    try {
      teardown = plugin.install(this, scope);
    } catch (err) {
      for (let i = scoped.length - 1; i >= 0; i--) {
        try {
          scoped[i]!();
        } catch (cleanupErr) {
          queueMicrotask(() => {
            throw cleanupErr;
          });
        }
      }
      queueMicrotask(() => {
        throw err;
      });
      return this;
    }
    for (const fn of scoped) this.teardowns.add(fn);
    if (typeof teardown === "function") {
      this.teardowns.add(teardown);
    }
    return this;
  }

  setLinkedSheets(sheets: BottomSheetEngine[]): void {
    if (this.destroyed) return;
    this.linkedSheets = sheets;
  }

  getAllowedIds(): string[] {
    return this.snaps.getAllowedIds().slice();
  }

  async snapTo(
    id: string,
    velocityOrOpts:
      | number
      | { velocity?: number; signal?: AbortSignal } = 0,
    _skipBeforeSnap = false,
  ): Promise<void> {
    if (this.destroyed) return;
    const opts =
      typeof velocityOrOpts === "object"
        ? velocityOrOpts
        : { velocity: velocityOrOpts };
    const velocityPxPerMs = opts.velocity ?? 0;
    const externalSignal = opts.signal;
    if (externalSignal?.aborted) return;
    const target = this.snaps.findById(id);
    if (!target) {
      console.warn(`[BottomSheet] unknown snap id: ${id}`);
      return;
    }
    if (!this.snaps.getAllowedIds().includes(id)) {
      console.warn(`[BottomSheet] snap "${id}" is not in allowed list`);
      return;
    }
    if (!_skipBeforeSnap && this.emitBeforeSnap(target, this.activeId)) {
      return;
    }
    const signal = this.newCycle();
    const onExternalAbort = (): void => {
      this.animation.cancel();
      this.newCycle();
    };
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    const wasClosed = this.size === 0;
    const previousId = this.activeId;
    const previousSize = this.size;
    this.scrollCache.cache(previousId, previousSize, target.size);
    this.activeId = id;
    if (this.animation.viewTransitionsAvailable) {
      this.currentViewTransition?.skipTransition?.();
      const vt = (
        document as unknown as {
          startViewTransition: (cb: () => void) => {
            finished: Promise<void>;
            skipTransition?: () => void;
          };
        }
      ).startViewTransition(() => {
        this.applySize(target.size);
      });
      this.currentViewTransition = vt;
      try {
        await vt.finished;
      } catch {
      }
      if (this.currentViewTransition === vt) this.currentViewTransition = null;
    } else {
      await this.animation.animateTo(target.size, velocityPxPerMs);
    }
    externalSignal?.removeEventListener("abort", onExternalAbort);
    if (signal.aborted) return;
    this.scrollCache.restore(id, previousSize, target.size);
    this.updateAriaSlider();
    this.emit("snap", { id, size: target.size });
    if (wasClosed && target.size > 0) {
      this.emit("open", { id });
      this.handleOpen();
      notifyLinkedSheets(this.linkedSheets, this);
    }
    if (target.size === 0) {
      this.emit("close", undefined);
      this.handleClose();
    }
  }

  async dragTo(
    targetSize: number,
    velocityOrOpts:
      | number
      | { velocity?: number; signal?: AbortSignal } = 0,
  ): Promise<void> {
    if (this.destroyed) return;
    const opts =
      typeof velocityOrOpts === "object"
        ? velocityOrOpts
        : { velocity: velocityOrOpts };
    const velocityPxPerMs = opts.velocity ?? 0;
    const externalSignal = opts.signal;
    if (externalSignal?.aborted) return;
    this.newCycle();
    const onExternalAbort = (): void => {
      this.animation.cancel();
      this.newCycle();
    };
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    const clamped = Math.max(0, Math.min(targetSize, this.snaps.getMaxAxisSize()));
    await this.animation.animateTo(clamped, velocityPxPerMs);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    if (this.destroyed || externalSignal?.aborted) return;
  }

  open(id?: string): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const target =
      id ?? this.snaps.getAllowedIds().find(a => a !== "closed") ?? this.activeId;
    return this.snapTo(target);
  }

  close(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const closedId =
      this.snapPointsRaw.find(p => p.id === "closed")?.id ??
      this.snaps.getAllowedIds()[0];
    return this.snapTo(closedId ?? this.activeId);
  }

  setAllowed(ids: string[], snap?: string): void {
    if (this.destroyed) return;
    this.snaps.setAllowedIds(ids);
    this.updateAriaSlider();
    if (snap && ids.includes(snap)) {
      void this.snapTo(snap, 0, true);
    } else if (!ids.includes(this.activeId)) {
      const fallback = ids[0];
      if (fallback) void this.snapTo(fallback, 0, true);
    }
  }

  setBackdropRange(range: [number, number]): void {
    this.scrim.setBackdropRange(range, () => this.applySize(this.size));
  }

  setScreenRange(range: [number, number]): void {
    this.scrim.setScreenRange(range, () => this.applySize(this.size));
  }

  setScrimColor(color: string | undefined | null): void {
    this.scrim.setScrimColor(color);
  }

  setScrimBlur(blur: string | undefined | null): void {
    this.scrim.setScrimBlur(blur);
  }

  setScrimInteractive(interactive: boolean): void {
    this.scrim.setScrimInteractive(interactive);
  }

  setScrim(opts: ScrimUpdate): void {
    this.scrim.setScrim(opts, () => this.applySize(this.size));
  }

  setScrimMode(mode: "full" | "above-sheet" | "off"): void {
    this.scrim.setScrimMode(mode, () => this.applySize(this.size));
  }

  setScrimTapToClose(enabled: boolean): void {
    this.scrim.setScrimTapToClose(enabled);
  }

  setScrimEnabled(enabled: boolean): void {
    this.scrim.setScrimEnabled(enabled, () => this.applySize(this.size));
  }

  setScrimOverlay(opts: ScrimOverlayOptions): () => void {
    return this.scrim.setScrimOverlay(opts);
  }

  addAnchor(opts: AnchorOptions): () => void {
    if (this.destroyed || typeof document === "undefined") return () => {};
    if (!this.anchorHost) {
      this.anchorHost =
        this.rootEl ?? this.element.parentElement ?? document.body;
      this.anchorHost.style.setProperty("--bs-size", `${this.size}px`);
      this.anchorHost.style.setProperty(
        "--bs-progress",
        String(this.computeProgress(this.size)),
      );
    }
    const handle = attachAnchor(
      {
        mode: this.mode,
        host: this.anchorHost,
        getState: () => ({
          activeId: this.activeId,
          size: this.size,
          progress: this.computeProgress(this.size),
        }),
        on: (event, fn) => this.on(event, fn),
        isDestroyed: () => this.destroyed,
      },
      opts,
    );
    handle.syncZ(this.stackZ + 1);
    this.anchors.push(handle);
    const detach = (): void => {
      const idx = this.anchors.indexOf(handle);
      if (idx === -1) return;
      this.anchors.splice(idx, 1);
      handle.detach();
    };
    this.teardowns.add(detach);
    return detach;
  }

  setScrimStages(opts: ScrimStagesOptions | null): () => void {
    if (this.destroyed || typeof document === "undefined") return () => {};
    this.detachScrimStages?.();
    this.detachScrimStages = null;
    if (!opts) return () => {};
    const host = this.screenComponent?.parentElement;
    if (!host) {
      console.warn(
        "[BottomSheet] setScrimStages: no scrim element mounted — pass `scrim` to the engine first.",
      );
      return () => {};
    }
    const detachInstalled = installScrimStages(
      {
        mode: this.mode,
        host,
        getState: () => ({
          activeId: this.activeId,
          size: this.size,
          progress: this.computeProgress(this.size),
        }),
        on: (event, fn) => this.on(event, fn),
        isDestroyed: () => this.destroyed,
      },
      opts,
    );
    const detach = (): void => {
      if (this.detachScrimStages === detach) this.detachScrimStages = null;
      detachInstalled();
    };
    this.detachScrimStages = detach;
    this.teardowns.add(() => this.detachScrimStages?.());
    return detach;
  }

  getScrimState(): {
    mode: "full" | "above-sheet" | "off";
    enabled: boolean;
  } {
    return { mode: this.scrim.scrimMode, enabled: this.scrim.scrimEnabled };
  }

  setSnapPoints(points: EngineOptions["snapPoints"], allowed?: string[]): void {
    if (this.destroyed) return;
    this.animation.cancel();
    this.newCycle();
    this.snapPointsRaw = points;
    auditVhUsage(points);
    this.snaps.setRaw(points);
    if (allowed) this.snaps.setAllowedIds(allowed);
    this.scrollCache.clear();
    this.scrim.invalidateOpacityCache();
    const current = this.snaps.findById(this.activeId);
    if (current) {
      this.applySize(current.size);
    }
    this.updateAriaSlider();
  }

  destroy(): void {
    this.destroyed = true;
    this.currentAbort.abort();
    this.currentViewTransition?.skipTransition?.();
    this.currentViewTransition = null;
    this.bus.clear();
    this.animation.cancel();
    this.gesture?.forceClearDragState();
    this.teardowns.drain();
    this.scrim.destroy();
    this.animation.destroy();
    this.lifecycle.destroy();
    if (this.backdrop) {
      this.backdrop.style.opacity = "";
      this.backdrop.style.pointerEvents = "";
    }
    if (this.screenComponent) {
      this.screenComponent.style.opacity = "";
      this.screenComponent.style.display = "";
    }
    this.sizeWriteSentinel.invalidate();
    this.progressWriteSentinel.invalidate();
  }

  private emit<K extends keyof SheetEventMap>(
    event: K,
    payload: SheetEventMap[K],
  ): void {
    this.bus.emit(event, payload);
  }

  private newCycle(): AbortSignal {
    this.currentAbort.abort();
    this.currentAbort = new AbortController();
    return this.currentAbort.signal;
  }

  private emitBeforeSnap(
    target: { id: string; size: number },
    previousId: string,
  ): boolean {
    let cancelled = false;
    let frozen = false;
    this.emit("before-snap", {
      id: target.id,
      size: target.size,
      previousId,
      cancel: () => {
        if (frozen) {
          console.warn(
            "[BottomSheet] before-snap.cancel() called asynchronously — ignored. cancel() must be invoked synchronously inside the listener.",
          );
          return;
        }
        cancelled = true;
      },
    });
    frozen = true;
    return cancelled;
  }

  private recomputeSnaps(): void {
    const seen = new Set<string>();
    for (const p of this.snapPointsRaw) {
      if (seen.has(p.id)) {
        console.warn(
          `[BottomSheet] duplicate snap id "${p.id}" — only the first occurrence is reachable.`,
        );
      }
      seen.add(p.id);
    }
    this.snaps.setRaw(this.snapPointsRaw);
    this.scrim.invalidateOpacityCache();
  }

  private getAllowedRange(): { min: number; max: number } {
    return this.snaps.getAllowedRange();
  }

  private allowedIdsBySize(): string[] {
    return this.snaps
      .getAllowedIds()
      .slice()
      .sort(
        (a, b) =>
          (this.snaps.findById(a)?.size ?? 0) -
          (this.snaps.findById(b)?.size ?? 0),
      );
  }

  private updateAriaSlider(): void {
    this.aria.setValue(this.allowedIdsBySize(), this.activeId);
  }

  private registerInStack(): void {
    this.teardowns.add(sheetStack.push({
      id: this.id,
      setZIndex: z => {
        this.stackZ = z;
        this.element.style.zIndex = String(z);
        if (this.backdrop) this.backdrop.style.zIndex = String(z - 1);
        for (const anchor of this.anchors) anchor.syncZ(z + 1);
      },
      setIsTop: isTop => {
        this.isTopSheet = isTop;
        if (this.backdrop) {
          this.backdrop.style.display = isTop ? "" : "none";
        }
      },
      isOpen: () => this.size > 0,
      setDepth: depth => this.applyStackDepth(depth),
    }));
  }

  private applyStackDepth(depth: number): void {
    if (!this.stackEffectEnabled) return;
    this.element.setAttribute("data-stack-depth", String(depth));
    if (!this.stackEffectPrimed) {
      this.stackEffectPrimed = true;
      const isVertical = this.mode === "bottom" || this.mode === "top";
      this.element.style.transformOrigin = isVertical
        ? "50% 100%"
        : "0% 50%";
      this.element.style.transition =
        "scale 320ms cubic-bezier(0.29, 1.04, 0.84, 0.99)";
    }
    const scale = Math.max(1 - depth * 0.04, 0.86);
    this.element.style.scale = scale === 1 ? "" : String(scale);
  }

  private attach(): void {
    this.gesture = new GestureController({
      handle: this.handle,
      element: this.element,
      mode: this.mode,
      getRoot: () => this.rootEl,
      getDragContext: () => {
        const buf = this.dragContextBuf;
        const r = this.getAllowedRange();
        buf.size = this.size;
        buf.maxAxisSize = this.snaps.getMaxAxisSize();
        buf.range.min = r.min;
        buf.range.max = r.max;
        buf.rubberBandEnabled = this.rubberBandEnabled;
        return buf;
      },
      cancelAnimation: () => this.animation.cancel(),
      applySize: size => this.applySize(size),
      animateTo: (size, velocity) => this.animation.animateTo(size, velocity),
      settleAfterDrag: (delta, velocity, kind) =>
        this.settleAfterDrag(delta, velocity, kind),
      emit: (event, payload) => this.emit(event, payload),
      listenerCount: event => this.bus.listenerCount(event),
    });
    this.teardowns.add(this.gesture!.install());

    try {
      this.attachFeatures();
    } catch (err) {
      this.teardowns.drain();
      try {
        this.scrim.destroy();
      } catch (destroyErr) {
        queueMicrotask(() => {
          throw destroyErr;
        });
      }
      try {
        this.animation.destroy();
      } catch (destroyErr) {
        queueMicrotask(() => {
          throw destroyErr;
        });
      }
      try {
        this.lifecycle.destroy();
      } catch (destroyErr) {
        queueMicrotask(() => {
          throw destroyErr;
        });
      }
      this.destroyed = true;
      throw err;
    }
  }

  private attachFeatures(): void {
    if (this.scrollContainer) {
      this.teardowns.add(installContentSwipe({
        container: this.scrollContainer,
        isDragging: () => this.gesture?.isDragging ?? false,
        isAnimating: () => this.animation.isAnimating,
        getAllowedIds: () => this.allowedIdsBySize(),
        getActiveId: () => this.activeId,
        snapTo: id => {
          void this.snapTo(id);
        },
      }));
    }

    if (typeof window !== "undefined") {
      this.teardowns.add(installResizeObserver({
        element: this.element,
        getMode: () => this.mode as TransformAxis,
        isDestroyed: () => this.destroyed,
        isDragging: () => this.gesture?.isDragging ?? false,
        resolveActiveSnap: () => this.snaps.findById(this.activeId),
        getMaxAxisSize: () => this.snaps.getMaxAxisSize(),
        getSize: () => this.size,
        setMaxAxisSize: size => {
          this.snaps.setMaxAxisSize(size);
        },
        setSize: size => {
          this.size = size;
        },
        recomputeSnaps: () => this.recomputeSnaps(),
        applySize: size => this.applySize(size),
        cancelInFlight: () => {
          this.animation.cancel();
        },
        newCycle: () => {
          this.newCycle();
        },
        isAnimating: () => this.animation.isAnimating,
        resyncAfterCancel: () => this.resyncAfterResize(),
      }));

      if (this.lifecycle.closeOnEscape) {
        const onKey = (e: KeyboardEvent) => {
          if (this.destroyed || e.defaultPrevented) return;
          if (e.key === "Escape" && this.isTopSheet && this.size > 0) {
            void this.close();
          }
        };
        document.addEventListener("keydown", onKey);
        this.teardowns.add(() =>
          document.removeEventListener("keydown", onKey),
        );
      }

      this.teardowns.add(installVisualViewport({
        element: this.element,
        isVerticalAxis: () =>
          this.mode === "bottom" || this.mode === "top",
        isDestroyed: () => this.destroyed,
        isDragging: () => this.gesture?.isDragging ?? false,
        recomputeSnaps: () => this.recomputeSnaps(),
        resolveActiveSnap: () => this.snaps.findById(this.activeId),
        getMaxAxisSize: () => this.snaps.getMaxAxisSize(),
        getSize: () => this.size,
        setMaxAxisSize: size => {
          this.snaps.setMaxAxisSize(size);
        },
        setSize: size => {
          this.size = size;
        },
        applySize: size => this.applySize(size),
      }));
    }

    this.teardowns.add(installSliderKeyboard({
      handle: this.handle,
      mode: this.mode as TransformAxis,
      isDestroyed: () => this.destroyed,
      getAllowedIds: () => this.allowedIdsBySize(),
      getActiveId: () => this.activeId,
      snapTo: id => {
        void this.snapTo(id);
      },
    }));

    this.scrim.attach();
  }

  private settleAfterDrag(
    delta: number,
    velocity: number,
    kind: "touch" | "mouse" | "pen" = "touch",
  ): void {
    const signal = this.newCycle();
    const target = this.snaps.findDragSettleTarget({
      delta,
      velocity,
      pointerKind: kind,
      size: this.size,
      activeId: this.activeId,
      flickVelocity: this.flickVelocity,
      dragThreshold: this.dragThreshold,
    });
    if (!target) return;

    const previousId = this.activeId;
    if (target.id === previousId && target.size === this.size) return;
    if (this.emitBeforeSnap(target, previousId)) {
      const restore = this.snaps.findById(previousId);
      if (restore) {
        void this.animation.animateTo(restore.size, 0);
      }
      return;
    }
    const previousSize = this.size;
    const previousSnapSize = this.snaps.findById(previousId)?.size;
    this.scrollCache.cache(previousId, previousSize, target.size);
    this.activeId = target.id;
    void this.animation.animateTo(target.size, velocity).then(() => {
      if (signal.aborted) return;
      this.scrollCache.restore(target!.id, previousSize, target!.size);
      this.updateAriaSlider();
      this.emit("snap", { id: target!.id, size: target!.size });
      this.haptic();
      if (previousSnapSize === 0 && target!.size > 0) {
        this.emit("open", { id: target!.id });
        this.handleOpen();
        notifyLinkedSheets(this.linkedSheets, this);
      }
      if (target!.size === 0) {
        this.emit("close", undefined);
        this.handleClose();
      }
    });
  }

  private haptic(): void {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(HAPTIC_DURATION_MS);
      } catch {
      }
    }
  }


  private applySize(size: number): void {
    this.size = size;
    const offset = this.snaps.getMaxAxisSize() - size;
    const style = this.element.style;
    style.transform = this.transformTemplate(offset);
    if (this.sizeWriteSentinel.shouldWrite(size, SIZE_WRITE_EPSILON)) {
      style.setProperty("--bs-size", `${size}px`);
      if (this.scrimParent) {
        this.scrimParent.style.setProperty("--bs-size", `${size}px`);
      }
      if (this.anchorHost && this.anchorHost !== this.scrimParent) {
        this.anchorHost.style.setProperty("--bs-size", `${size}px`);
      }
    }
    const progress = this.computeProgress(size);
    const progressChanged = this.progressWriteSentinel.shouldWrite(
      progress,
      OPACITY_WRITE_EPSILON,
    );
    if (progressChanged) {
      style.setProperty("--bs-progress", String(progress));
      if (this.anchorHost) {
        this.anchorHost.style.setProperty("--bs-progress", String(progress));
      }
    }

    this.scrim.applyOpacity(progress, progressChanged);
    if (progressChanged && this.bus.listenerCount("progress") > 0) {
      this.progressPayload.value = progress;
      this.progressPayload.size = size;
      this.emit("progress", this.progressPayload);
    }
  }

  private computeProgress(size: number): number {
    const { min, max } = this.getAllowedRange();
    if (max <= min) return 0;
    return Math.min(Math.max((size - min) / (max - min), 0), 1);
  }

  private handleOpen(): void {
    sheetStack.promote(this.id);
    try {
      this.lifecycle.install();
    } catch (err) {
      if (!this.destroyed) this.newCycle();
      this.handleClose();
      this.applySize(0);
      this.activeId =
        this.snapPointsRaw.find(p => p.id === "closed")?.id ?? this.activeId;
      this.size = 0;
      queueMicrotask(() => {
        throw err;
      });
    }
  }

  private resyncAfterResize(): void {
    if (this.destroyed) return;
    const target = this.snaps.findById(this.activeId);
    if (!target) return;
    this.updateAriaSlider();
    this.emit("snap", { id: target.id, size: target.size });
    if (target.size > 0 && !this.lifecycle.isInstalled) {
      this.emit("open", { id: target.id });
      this.handleOpen();
      notifyLinkedSheets(this.linkedSheets, this);
    } else if (target.size === 0 && this.lifecycle.isInstalled) {
      this.emit("close", undefined);
      this.handleClose();
    }
  }

  private handleClose(): void {
    this.lifecycle.release();
    sheetStack.update();
  }
}
