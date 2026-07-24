import { sheetStack } from "./lifecycle/sheetStack";
import {
  buildTransformTemplate,
  layoutAxis,
  type TransformAxis,
} from "./primitives/transform";
import { nextInstanceId } from "./primitives/instance-id";
import { createEventBus, type EventBus } from "./primitives/event-bus";
import { auditVhUsage } from "./primitives/snap-points";
import { emitCancelable } from "./primitives/cancelable-emit";
import { devWarn } from "./primitives/devWarn";
import { SnapResolver } from "./primitives/snap-resolver";
import { notifyLinkedSheets } from "./features/linked-sheets";
import { installResizeObserver } from "./features/resize-observer";
import { installFitObserver } from "./features/fit-observer";
import {
  createMaxHeightController,
  type MaxHeightController,
} from "./features/max-height-controller";
import {
  measureFitSize,
  type FitMeasurementDeps,
} from "./features/fit-measurement";
import { installSliderKeyboard } from "./features/slider-keyboard";
import { ScrimController } from "./controllers/scrim-controller";
import { AnimationRunner } from "./controllers/animation-runner";
import { LifecycleController } from "./controllers/lifecycle-controller";
import {
  GestureController,
  type GestureControllerDeps,
} from "./controllers/gesture-controller";
import type { GestureOptions } from "./gestures";
import {
  isDragAllowedFrom,
  DRAG_ZONE_SELECTOR,
  NO_DRAG_SELECTOR,
  type DragFrom,
} from "./primitives/drag-zones";
import { decideContentGesture } from "./primitives/content-gesture";
import { installTouchScrollGuard } from "./primitives/touch-scroll-guard";
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
import { TeardownStack } from "./primitives/teardown-stack";
import { WriteSentinel } from "./primitives/opacity-dedup";
import type {
  CloseReason,
  DragSurfaceKind,
  EngineFeature,
  EngineFeatureContext,
  EngineFeatureStage,
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

export class BottomSheetCore {
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
  private dragFromMode: DragFrom;
  private dragFromContentDefault: boolean;
  private rubberBandEnabled: boolean;
  private scrim!: ScrimController;
  private aria!: AriaSliderWriter;
  private animation!: AnimationRunner;
  private lifecycle!: LifecycleController;
  private closeOnBack: boolean;
  private routedTo: string | undefined;
  private persistent: boolean;
  private disableCloseFlag: boolean;
  private disableDragFlag: boolean;
  private closeOnRouteChange: boolean;
  private maxHeight!: MaxHeightController;

  private snapPointsRaw: EngineOptions["snapPoints"];
  private snaps!: SnapResolver;
  private activeId: string;

  private size = 0;
  private gesture: GestureController | undefined;
  private contentGesture: GestureController | undefined;
  private rootEl: HTMLElement | null = null;
  private destroyed = false;
  private restClosed = false;
  private currentViewTransition: {
    finished: Promise<void>;
    skipTransition?: () => void;
  } | null = null;
  private currentAbort = new AbortController();
  private sizeWriteSentinel = new WriteSentinel();
  private progressWriteSentinel = new WriteSentinel();
  private isTopSheet = true;
  private opening = false;
  private allowOvershoot = false;
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
  private linkedSheets: BottomSheetCore[] = [];
  private scrollCache!: ScrollCache;
  private teardowns = new TeardownStack();
  private anchors: AnchorHandle[] = [];
  private anchorHost: HTMLElement | null = null;
  private stackZ = 100;
  private detachScrimStages: (() => void) | null = null;
  private stackEffectEnabled = false;
  private stackEffectPrimed = false;
  private fitDeps!: FitMeasurementDeps;

  private transformTemplate!: (offset: number) => string;
  private featureList: EngineFeature[] = [];
  private featureCtx!: EngineFeatureContext;

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
    this.dragFromMode = resolved.dragFrom;
    this.dragFromContentDefault = resolved.dragFromContent;
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
          if (!this.canDismiss()) return;
          void this.close("backdrop");
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
        isDragging: () => this.isDraggingAny(),
        applyAux: (size: number) => this.applySize(size, true),
        getTransformFor: (size: number) =>
          this.transformTemplate(this.snaps.getMaxAxisSize() - size),
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
    this.persistent = resolved.persistent;
    this.disableCloseFlag = resolved.disableClose;
    this.disableDragFlag = resolved.disableDrag;
    this.closeOnRouteChange = resolved.closeOnRouteChange;
    this.stackEffectEnabled = opts.stackEffect ?? false;

    this.snapPointsRaw = opts.snapPoints;
    this.persistKey = opts.persistKey;
    if (opts.linkedSheets) {
      this.linkedSheets = opts.linkedSheets as unknown as BottomSheetCore[];
    }
    const byName = new Map<string, EngineFeature>();
    for (const feature of opts.features ?? []) {
      byName.set(feature.name, feature);
    }
    this.featureList = Array.from(byName.values());

    this.activeId = resolved.initialId;

    auditVhUsage(this.snapPointsRaw);
    this.auditDuplicateSnapIds(this.snapPointsRaw);

    this.rootEl = this.element.closest<HTMLElement>(".bs-root");
    this.maxHeight = createMaxHeightController({
      element: this.element,
      mode: this.mode,
      getMaxAxisSize: () => this.snaps.getMaxAxisSize(),
      setMaxAxisSize: size => {
        this.snaps.setMaxAxisSize(size);
      },
      recompute: () => this.recompute(),
    });
    this.fitDeps = {
      element: this.element,
      scrollContainer: this.scrollContainer,
      mode: this.mode,
      getMaxHeightCap: () => this.maxHeight.getCap(),
    };
    this.snaps = new SnapResolver(
      this.snapPointsRaw,
      resolved.initialAllowed,
      this.mode,
      () => measureFitSize(this.fitDeps),
      maxAxisSize => {
        this.element.style[layoutAxis(this.mode as TransformAxis)] =
          `${maxAxisSize}px`;
      },
    );
    const initial = this.snaps.findById(this.activeId);
    if (initial) this.size = initial.size;
    this.applySize(this.size);
    this.setRestClosed(this.size === 0);
    this.updateAriaSlider();

    this.scrollCache = createScrollCache({
      scrollContainer: this.scrollContainer,
      getMaxAxisSize: () => this.snaps.getMaxAxisSize(),
    });

    this.featureCtx = this.buildFeatureContext(opts.autoCollapseAfter);
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
          this.healActiveSnap();
          io.disconnect();
          return;
        }
      });
      io.observe(this.element);
      this.teardowns.add(() => io.disconnect());
    }

    this.teardowns.add(
      installFitObserver({
        handle: this.handle,
        scrollContainer: this.scrollContainer,
        hasFitSnap: () =>
          this.snapPointsRaw.some(
            p => p.size === "fit" || p.size === "content",
          ),
        isDestroyed: () => this.destroyed,
        isDragging: () => this.isDraggingAny(),
        recompute: () => this.recompute(),
      }),
    );

    if (resolved.radius !== undefined) this.setRadius(resolved.radius);
    if (resolved.maxHeight !== undefined) this.setMaxHeight(resolved.maxHeight);
    this.applyAutoAriaLabelledBy();

    this.runFeatureStage("post");
    this.warnOrphanFeatureOptions();

    if (this.size > 0) {
      this.handleOpen();
    }
  }

  private buildFeatureContext(
    autoCollapseAfter: number | undefined,
  ): EngineFeatureContext {
    return {
      element: this.element,
      scrollContainer: this.scrollContainer,
      sheetId: this.id,
      options: {
        routedTo: this.routedTo,
        closeOnBack: this.closeOnBack,
        closeOnRouteChange: this.closeOnRouteChange,
        persistKey: this.persistKey,
        autoCollapseAfter,
      },
      isDestroyed: () => this.destroyed,
      isDragging: () => this.isDraggingAny(),
      isAnimating: () => this.animation.isAnimating,
      isTopSheet: () => this.isTopSheet,
      isVerticalAxis: () => this.mode === "bottom" || this.mode === "top",
      getSize: () => this.size,
      getActiveId: () => this.activeId,
      getAllowedIds: () => this.snaps.getAllowedIds().slice(),
      allowedIdsBySize: () => this.allowedIdsBySize(),
      getMaxAxisSize: () => this.snaps.getMaxAxisSize(),
      resolveSnap: id => this.snaps.findById(id),
      resolveActiveSnap: () => this.snaps.findById(this.activeId),
      setSize: size => {
        this.size = size;
      },
      setMaxAxisSize: size => {
        this.snaps.setMaxAxisSize(size);
      },
      applySize: size => this.applySize(size),
      recomputeSnaps: () => this.recomputeSnaps(),
      newCycle: () => {
        this.newCycle();
      },
      cancelInFlight: () => {
        this.animation.cancel();
      },
      resyncAfterResize: () => this.resyncAfterResize(),
      snapTo: id => {
        void this.snapTo(id);
      },
      close: reason => this.close(reason),
      attachDragSurface: (surface, kind) =>
        this.attachDragSurface(surface, kind),
      on: (event, fn) => this.on(event, fn),
      addTeardown: fn => this.teardowns.add(fn),
    };
  }

  private runFeatureStage(stage: EngineFeatureStage): void {
    for (const feature of this.featureList) {
      if ((feature.stage ?? "post") !== stage) continue;
      const teardown = feature.install(this.featureCtx);
      if (teardown) this.teardowns.add(teardown);
    }
  }

  private warnOrphanFeatureOptions(): void {
    const names = new Set(this.featureList.map(f => f.name));
    if (
      (this.closeOnBack || this.routedTo !== undefined || this.closeOnRouteChange) &&
      !names.has("route")
    ) {
      devWarn(
        "[BottomSheet] closeOnBack/routedTo/closeOnRouteChange need routeFeature() — option ignored",
      );
    }
    if (this.persistKey && !names.has("persist")) {
      devWarn(
        "[BottomSheet] persistKey needs persistFeature() — snaps will not be saved",
      );
    }
  }

  get state(): EngineState {
    return {
      size: this.size,
      activeId: this.activeId,
      isDragging: this.isDraggingAny(),
      isAnimating: this.animation.isAnimating,
      progress: this.computeProgress(this.size),
    };
  }

  on<K extends keyof SheetEventMap>(event: K, fn: Listener<K>): () => void {
    return this.bus.on(event, fn);
  }

  use(plugin: Plugin): this {
    if (this.destroyed) {
      devWarn(
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

  setLinkedSheets(sheets: BottomSheetCore[]): void {
    if (this.destroyed) return;
    this.linkedSheets = sheets;
  }

  getAllowedIds(): string[] {
    return this.snaps.getAllowedIds().slice();
  }

  getResolvedSnaps(): readonly { id: string; size: number }[] {
    return this.snaps.getResolvedSnaps();
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
      devWarn(`[BottomSheet] unknown snap id: ${id}`);
      return;
    }
    if (!this.snaps.getAllowedIds().includes(id)) {
      devWarn(`[BottomSheet] snap "${id}" is not in allowed list`);
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
    const rawTargetSize = this.snapPointsRaw.find(p => p.id === id)?.size;
    const opensToRest = id === "closed" || rawTargetSize === 0;
    if (wasClosed && !opensToRest) {
      this.opening = true;
      sheetStack.promote(this.id);
    }
    if (this.animation.viewTransitionsAvailable) {
      this.currentViewTransition?.skipTransition?.();
      const vt = (
        document as unknown as {
          startViewTransition: (cb: () => void) => {
            finished: Promise<void>;
            ready?: Promise<void>;
            skipTransition?: () => void;
          };
        }
      ).startViewTransition(() => {
        this.applySize(target.size);
      });
      vt.ready?.catch(() => {});
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
    this.opening = false;
    this.completeSnap(id, target.size, previousSize, wasClosed, false);
  }

  private completeSnap(
    id: string,
    targetSize: number,
    previousSize: number,
    wasClosed: boolean,
    withHaptic: boolean,
  ): void {
    this.scrollCache.restore(id, previousSize, targetSize);
    this.updateAriaSlider();
    this.emit("snap", {
      id,
      size: this.size,
      progress: this.computeProgress(this.size),
    });
    if (withHaptic) this.haptic();
    this.setRestClosed(targetSize === 0);
    if (wasClosed && targetSize > 0) this.emitOpenSequence(id);
    if (targetSize === 0) this.emitCloseSequence();
  }

  /** Fully-closed sheets stay mounted; the flag lets CSS drop their shadow and hit-testing. */
  private setRestClosed(closed: boolean): void {
    if (closed === this.restClosed) return;
    this.restClosed = closed;
    if (closed) this.element.setAttribute("data-bs-rest", "closed");
    else this.element.removeAttribute("data-bs-rest");
  }

  private emitOpenSequence(id: string): void {
    this.emit("open", { id });
    this.handleOpen();
    notifyLinkedSheets(this.linkedSheets, this);
    this.emit("opened", { id });
  }

  private emitCloseSequence(): void {
    this.emit("close", undefined);
    this.handleClose();
    this.emit("closed", undefined);
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
      id ??
      this.snaps
        .getAllowedIds()
        .find(a => (this.snaps.findById(a)?.size ?? 0) > 0) ??
      this.activeId;
    return this.snapTo(target);
  }

  close(reason: CloseReason = "programmatic"): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    if (this.disableCloseFlag) return Promise.resolve();
    if (this.size > 0 && this.emitBeforeClose(reason)) return Promise.resolve();
    const closedId =
      this.snapPointsRaw.find(p => p.id === "closed")?.id ??
      this.snaps
        .getAllowedIds()
        .find(a => this.snaps.findById(a)?.size === 0) ??
      this.snaps.getAllowedIds()[0];
    return this.snapTo(closedId ?? this.activeId);
  }

  canDismiss(): boolean {
    return !this.persistent && !this.disableCloseFlag && !this.destroyed;
  }

  setPersistent(value: boolean): void {
    if (this.destroyed) return;
    this.persistent = value;
  }

  setDisableClose(value: boolean): void {
    if (this.destroyed) return;
    this.disableCloseFlag = value;
  }

  setDisableDrag(value: boolean): void {
    if (this.destroyed) return;
    this.disableDragFlag = value;
  }

  setDragFromContent(value: boolean): void {
    if (this.destroyed) return;
    this.dragFromContentDefault = value;
  }

  isTop(): boolean {
    return this.isTopSheet;
  }

  depth(): number {
    return sheetStack.depthOf(this.id);
  }

  expand(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const ids = this.allowedIdsBySize();
    const target = ids[ids.length - 1];
    if (!target) return Promise.resolve();
    return this.snapTo(target);
  }

  collapse(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const ids = this.allowedIdsBySize();
    const nonZero = ids.find(id => (this.snaps.findById(id)?.size ?? 0) > 0);
    const target = nonZero ?? ids[0];
    if (!target) return Promise.resolve();
    return this.snapTo(target);
  }

  setRadius(r: string | number): void {
    if (this.destroyed) return;
    this.maxHeight.setRadius(r);
  }

  setMaxHeight(h: string | number): void {
    if (this.destroyed) return;
    this.maxHeight.setMaxHeight(h);
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
      devWarn(
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
    this.auditDuplicateSnapIds(points);
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

  recompute(): void {
    if (this.destroyed) return;
    this.maxHeight.resolveCap();
    this.snaps.recompute();
    this.maxHeight.clampTo();
    this.scrim.invalidateOpacityCache();
    if (this.isDraggingAny()) return;
    this.healActiveSnap();
  }

  private healActiveSnap(): void {
    const current = this.snaps.findById(this.activeId);
    if (!current) return;
    this.size = current.size;
    this.applySize(this.size);
    this.updateAriaSlider();
    if (
      this.size > 0 &&
      !this.lifecycle.isInstalled &&
      !this.opening &&
      !this.animation.isAnimating
    ) {
      this.emitOpenSequence(this.activeId);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.opening = false;
    this.currentAbort.abort();
    this.currentViewTransition?.skipTransition?.();
    this.currentViewTransition = null;
    this.bus.clear();
    this.animation.cancel();
    this.gesture?.forceClearDragState();
    this.contentGesture?.forceClearDragState();
    this.setRestClosed(false);
    this.teardowns.drain();
    this.scrim.destroy();
    this.animation.destroy();
    this.lifecycle.destroy();
    if (this.backdrop) {
      this.backdrop.style.opacity = "";
      this.backdrop.style.pointerEvents = "";
    }
    for (const host of [this.anchorHost, this.scrimParent, this.rootEl]) {
      if (!host) continue;
      host.style.removeProperty("--bs-size");
      host.style.removeProperty("--bs-progress");
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
    this.allowOvershoot = false;
    this.opening = false;
    this.currentAbort.abort();
    this.currentAbort = new AbortController();
    return this.currentAbort.signal;
  }

  private emitBeforeSnap(
    target: { id: string; size: number },
    previousId: string,
  ): boolean {
    return emitCancelable(
      payload => this.emit("before-snap", payload),
      { id: target.id, size: target.size, previousId },
      "before-snap",
    );
  }

  private emitBeforeClose(reason: CloseReason): boolean {
    return emitCancelable(
      payload => this.emit("before-close", payload),
      { reason },
      "before-close",
    );
  }

  private applyAutoAriaLabelledBy(): void {
    if (typeof document === "undefined") return;
    if (!this.lifecycle.focusTrapEnabled) return;
    if (this.element.getAttribute("aria-labelledby")) return;
    const scope = this.handle ?? this.element;
    const titled =
      scope.querySelector<HTMLElement>("[data-bs-title]") ??
      scope.querySelector<HTMLElement>("h1,h2,h3,h4,h5,h6");
    if (!titled) return;
    if (!titled.id) {
      titled.id = nextInstanceId("bs-title");
    }
    this.element.setAttribute("aria-labelledby", titled.id);
  }

  private recomputeSnaps(): void {
    this.maxHeight.resolveCap();
    this.snaps.setRaw(this.snapPointsRaw);
    this.maxHeight.clampTo();
    this.scrim.invalidateOpacityCache();
  }

  private auditDuplicateSnapIds(points: EngineOptions["snapPoints"]): void {
    const seen = new Set<string>();
    for (const p of points) {
      if (seen.has(p.id)) {
        devWarn(
          `[BottomSheet] duplicate snap id "${p.id}" — only the first occurrence is reachable.`,
        );
      }
      seen.add(p.id);
    }
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
      },
      isOpen: () => this.size > 0 || this.opening,
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

  private buildGestureDeps(
    surface: HTMLElement,
    gestureOptions: GestureOptions,
  ): GestureControllerDeps {
    return {
      handle: surface,
      element: this.element,
      mode: this.mode,
      gestureOptions,
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
      getDisableDrag: () => this.disableDragFlag,
      cancelAnimation: () => this.animation.cancel(),
      applySize: size => this.applySize(size),
      animateTo: (size, velocity) => this.animation.animateTo(size, velocity),
      settleAfterDrag: (delta, velocity, kind) =>
        this.settleAfterDrag(delta, velocity, kind),
      emit: (event, payload) => this.emit(event, payload),
      listenerCount: event => this.bus.listenerCount(event),
    };
  }

  /** Whether the active snap point lets a content gesture move the sheet. */
  private isContentDragAllowed(): boolean {
    if (this.disableDragFlag) return false;
    const point = this.snapPointsRaw.find(p => p.id === this.activeId);
    return point?.dragFromContent ?? this.dragFromContentDefault;
  }

  private decideContentDrag(
    surface: HTMLElement,
    e: PointerEvent,
    delta: number,
  ): boolean | null {
    if (this.destroyed) return false;
    if (e.pointerType === "mouse") return false;
    if (this.gesture?.isDragging) return false;
    if (!this.isContentDragAllowed()) return false;
    if (!isDragAllowedFrom(e.target, "sheet")) return false;
    const decision = decideContentGesture({
      delta,
      scrollTop: surface.scrollTop,
      atMaxSnap: this.size >= this.getAllowedRange().max - 0.5,
    });
    if (decision === "pending") return null;
    return decision === "drag";
  }

  private attachDragSurface(
    surface: HTMLElement,
    kind: DragSurfaceKind,
  ): (() => void) | void {
    if (this.destroyed || kind !== "content") return;
    if (this.contentGesture) return;
    const controller = new GestureController(
      this.buildGestureDeps(surface, {
        manageTouchAction: false,
        deferStart: (e, delta) => this.decideContentDrag(surface, e, delta),
      }),
    );
    this.contentGesture = controller;
    const detachGestures = controller.install();
    const detachGuard = installTouchScrollGuard(
      surface,
      () => controller.isDragging,
    );
    return () => {
      detachGuard();
      detachGestures();
      if (this.contentGesture === controller) this.contentGesture = undefined;
    };
  }

  /** The handle gesture covers the handle only; wider modes move to the sheet element. */
  private sheetDragSurface(): HTMLElement {
    return this.dragFromMode === "handle" ? this.handle : this.element;
  }

  private canStartSheetDrag(e: PointerEvent): boolean {
    if (this.contentGesture?.isDragging) return false;
    const target = e.target as Element | null;
    const scoped = typeof target?.closest === "function";
    if (scoped && target.closest(NO_DRAG_SELECTOR)) return false;
    // The handle drags in every mode, zones or not.
    if (this.handle !== this.element && scoped && this.handle.contains(target)) {
      return true;
    }
    if (!isDragAllowedFrom(e.target, this.dragFromMode)) return false;
    if (this.dragFromMode === "handle") return true;
    // The scroll container runs its own gesture; only an explicit zone overrides it.
    if (
      this.scrollContainer &&
      scoped &&
      this.scrollContainer.contains(target) &&
      !target.closest(DRAG_ZONE_SELECTOR)
    ) {
      return false;
    }
    return true;
  }

  private attach(): void {
    const surface = this.sheetDragSurface();
    this.gesture = new GestureController(
      this.buildGestureDeps(surface, {
        shouldStart: e => this.canStartSheetDrag(e),
        manageTouchAction: this.dragFromMode === "handle",
      }),
    );
    this.teardowns.add(this.gesture!.install());
    if (this.dragFromMode !== "handle") {
      this.teardowns.add(
        installTouchScrollGuard(surface, () => this.gesture?.isDragging ?? false),
      );
    }

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
    this.runFeatureStage("attach");

    if (typeof window !== "undefined") {
      this.teardowns.add(installResizeObserver({
        element: this.element,
        getMode: () => this.mode as TransformAxis,
        isDestroyed: () => this.destroyed,
        isDragging: () => this.isDraggingAny(),
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
          if (!this.canDismiss()) return;
          if (e.key === "Escape" && this.isTopSheet && this.size > 0) {
            void this.close("escape");
          }
        };
        document.addEventListener("keydown", onKey);
        this.teardowns.add(() =>
          document.removeEventListener("keydown", onKey),
        );
      }

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
    if (!target) {
      this.clearWillChangeIfIdle();
      return;
    }

    const previousId = this.activeId;
    if (target.id === previousId && target.size === this.size) {
      this.clearWillChangeIfIdle();
      return;
    }
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
    if (previousSnapSize === 0 && target.size > 0) {
      this.opening = true;
      sheetStack.promote(this.id);
    }
    const settleCap = this.snaps.getMaxAxisSize();
    const settleSize =
      settleCap > 0 ? Math.min(target.size, settleCap) : target.size;
    this.allowOvershoot = true;
    void this.animation.animateTo(settleSize, velocity).then(() => {
      if (signal.aborted) return;
      this.allowOvershoot = false;
      this.opening = false;
      this.completeSnap(
        target!.id,
        target!.size,
        previousSize,
        previousSnapSize === 0,
        true,
      );
    });
  }

  private isDraggingAny(): boolean {
    return (
      (this.gesture?.isDragging ?? false) ||
      (this.contentGesture?.isDragging ?? false)
    );
  }

  private clearWillChangeIfIdle(): void {
    if (this.animation.isAnimating || this.isDraggingAny()) return;
    this.element.style.willChange = "";
  }

  private haptic(): void {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(HAPTIC_DURATION_MS);
      } catch {
      }
    }
  }


  private applySize(size: number, skipTransform = false): void {
    const cap = this.snaps.getMaxAxisSize();
    const clamped =
      cap > 0 && size > cap && !this.isDraggingAny() && !this.allowOvershoot
        ? cap
        : size;
    this.size = clamped;
    if (clamped > 0) this.setRestClosed(false);
    const offset = cap - clamped;
    const style = this.element.style;
    if (!skipTransform) style.transform = this.transformTemplate(offset);
    if (this.sizeWriteSentinel.shouldWrite(clamped, SIZE_WRITE_EPSILON)) {
      style.setProperty("--bs-size", `${clamped}px`);
      if (this.scrimParent) {
        this.scrimParent.style.setProperty("--bs-size", `${clamped}px`);
      }
      if (this.anchorHost && this.anchorHost !== this.scrimParent) {
        this.anchorHost.style.setProperty("--bs-size", `${clamped}px`);
      }
      if (
        this.rootEl &&
        this.rootEl !== this.scrimParent &&
        this.rootEl !== this.anchorHost
      ) {
        this.rootEl.style.setProperty("--bs-size", `${clamped}px`);
      }
    }
    const progress = this.computeProgress(clamped);
    const progressChanged = this.progressWriteSentinel.shouldWrite(
      progress,
      OPACITY_WRITE_EPSILON,
    );
    if (progressChanged) {
      style.setProperty("--bs-progress", String(progress));
      if (this.anchorHost) {
        this.anchorHost.style.setProperty("--bs-progress", String(progress));
      }
      if (this.rootEl && this.rootEl !== this.anchorHost) {
        this.rootEl.style.setProperty("--bs-progress", String(progress));
      }
    }

    this.scrim.applyOpacity(progress, progressChanged);
    if (progressChanged && this.bus.listenerCount("progress") > 0) {
      this.progressPayload.value = progress;
      this.progressPayload.size = clamped;
      this.emit("progress", this.progressPayload);
    }
  }

  private computeProgress(size: number): number {
    const { min, max } = this.getAllowedRange();
    const reachableMax = Math.min(max, this.snaps.getMaxAxisSize());
    if (reachableMax <= min) return 0;
    return Math.min(Math.max((size - min) / (reachableMax - min), 0), 1);
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
    this.emit("snap", {
      id: target.id,
      size: this.size,
      progress: this.computeProgress(this.size),
    });
    if (target.size > 0 && !this.lifecycle.isInstalled) {
      this.emitOpenSequence(target.id);
    } else if (target.size === 0 && this.lifecycle.isInstalled) {
      this.emitCloseSequence();
    }
  }

  private handleClose(): void {
    this.opening = false;
    this.lifecycle.release();
    sheetStack.update();
  }
}
