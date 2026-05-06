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

const VELOCITY_PX_PER_S = 1000;
const HAPTIC_DURATION_MS = 8;


/**
 * LIFO drain of teardown callbacks with per-fn error isolation.
 * @internal
 */
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
        // Rethrow via microtask so siblings still drain.
        queueMicrotask(() => {
          throw err;
        });
      }
    }
  }
}

/**
 * Framework-agnostic bottom-sheet engine.
 *
 * Owns the size value, snap-point math, gesture handling, and animation.
 * Renders nothing on its own — applies size to a host element via the chosen
 * `mode` axis. Adapters subscribe to `on(...)` events to mirror the state
 * back into their reactive system.
 */
export class BottomSheetEngine {
  private id = nextInstanceId("bs");
  private element: HTMLElement;
  private handle: HTMLElement;
  private scrollContainer?: HTMLElement;
  private backdrop?: HTMLElement;
  private screenComponent?: HTMLElement;
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

  // Engine retains `snapPointsRaw` for the "find a closed-id" query in
  // close() (raw input, not resolved geometry). Resolver owns geometry.
  private snapPointsRaw: EngineOptions["snapPoints"];
  private snaps!: SnapResolver;
  private activeId: string;

  private size = 0;
  // Constructed in attach(); a plugin's install() could read `state` before
  // attach completes if the constructor throws partway through. State getter
  // null-guards via `this.gesture?.isDragging ?? false`.
  private gesture: GestureController | undefined;
  private rootEl: HTMLElement | null = null;
  private destroyed = false;
  // In-flight ViewTransition handle. A second snapTo while a VT is in flight
  // would otherwise let Chromium reject the second's promise and flicker —
  // newCycle() calls skipTransition() to abort cleanly.
  private currentViewTransition: {
    finished: Promise<void>;
    skipTransition?: () => void;
  } | null = null;
  // Each cycle captures the signal at entry; when a newer cycle aborts the
  // controller, the captured signal flips to `aborted=true` and post-await
  // guards short-circuit (prevents stale snap/open/close emits).
  private currentAbort = new AbortController();
  // Sub-pixel `--bs-size` deltas and <1% `--bs-progress` deltas are not
  // visually distinguishable; gating CSSOM writes drops 30-50% of writes
  // during the spring's settle tail.
  private sizeWriteSentinel = new WriteSentinel();
  private progressWriteSentinel = new WriteSentinel();
  private isTopSheet = true;
  // Pooled payload — identity documented in SheetEventMap.progress JSDoc;
  // consumers must not retain across frames.
  private progressPayload: { value: number; size: number } = {
    value: 0,
    size: 0,
  };
  // Pooled buffer for `getDragContext()` — onMove calls this 60-120×/s.
  // Inner `range` object identity is also stable (mutated in place).
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
  // Single LIFO stack for ALL destroy-only teardowns. Plugins (added last)
  // tear down first before the infrastructure they depend on. Toggle-semantic
  // listeners (focus-trap / scroll-lock / scrim tap-to-close) stay as named
  // fields on their controllers.
  private teardowns = new TeardownStack();

  // Pre-computed transform template — built once per engine since `mode` is
  // fixed for its lifetime. Avoids the 4-arm switch at 60-120 Hz.
  private transformTemplate!: (offset: number) => string;

  constructor(opts: EngineOptions) {
    const resolved = resolveEngineOptions(opts, {
      shouldApplyInertSiblings: () => {
        // Body-descendant guard — skip inert apply when sheet is mounted
        // inside a shadow root or portal'd outside body, so unrelated body
        // siblings don't get marked inert.
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
    this.screenComponent = opts.screenComponent;
    this.mode = resolved.mode;
    this.transformTemplate = buildTransformTemplate(this.mode as TransformAxis);
    this.aria = new AriaSliderWriter(this.handle, this.mode);
    this.flickVelocity = resolved.flickVelocity;
    this.dragThreshold = resolved.dragThreshold;
    this.rubberBandEnabled = resolved.rubberBandEnabled;
    // tap-to-close install is deferred to attach() because listener teardowns
    // drain into `this.teardowns`.
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
      },
      resolved.scrim,
    );
    this.animation = new AnimationRunner(
      {
        element: this.element,
        getRootEl: () => this.rootEl,
        applySize: (size: number) => this.applySize(size),
        getSize: () => this.size,
        // Optional chain protects synthetic test paths that drive animateTo
        // before attach() (gesture is constructed there).
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

    this.snapPointsRaw = opts.snapPoints;
    this.persistKey = opts.persistKey;
    if (opts.linkedSheets) {
      // BottomSheetEngineLike (structural) avoids a types.ts import cycle.
      this.linkedSheets = opts.linkedSheets as unknown as BottomSheetEngine[];
    }

    this.activeId = resolved.initialId;

    // Once per init — recompute() would otherwise spam on every resize.
    auditVhUsage(this.snapPointsRaw);

    this.rootEl = this.element.closest<HTMLElement>(".bs-root");
    this.snaps = new SnapResolver(
      this.snapPointsRaw,
      resolved.initialAllowed,
      this.mode,
      () => this.handle.offsetHeight,
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

    // Hidden-parent recovery: when constructed inside `display:none`, all
    // `dvh`/`vh`/`%` resolve to 0 → maxAxisSize=0 → sheet permanently
    // collapsed. ResizeObserver doesn't fire on display:none reveals, so
    // IntersectionObserver fires on first visibility — recompute then
    // disconnect.
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

    // The "open" event only fires on closed→open transitions, so a sheet
    // mounted already-open needs scroll-lock + focus-trap installed here.
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

  /**
   * Register a plugin. `install` runs synchronously; if it returns a function,
   * it's captured for teardown during `destroy()`. No-op if already destroyed
   * — installing into a torn-down engine would leak listeners.
   *
   * Throws from `plugin.install` are caught and rethrown via `queueMicrotask`
   * so a buggy plugin can't take the engine down with it: the engine stays
   * usable, sibling plugins still install, and the error surfaces in dev tools
   * on the next tick instead of being swallowed. Mirrors the per-fn isolation
   * model used for teardowns.
   *
   * Plugins that accept the second `scope` argument get transactional cleanup:
   * push partial-install cleanups via `scope.add(fn)` and the engine drains
   * them on throw, OR merges them into destroy-time teardowns on success.
   */
  use(plugin: Plugin): this {
    if (this.destroyed) {
      console.warn(
        `[BottomSheet] use("${plugin.name}") called on destroyed engine — ignored.`,
      );
      return this;
    }
    const scoped: Array<() => void> = [];
    const scope: TeardownScope = {
      // typeof check — not just truthiness — so a JS-only plugin pushing a
      // bogus value is silently rejected instead of queueing a confusing
      // TypeError on destroy() drain.
      add: fn => {
        if (typeof fn === "function") scoped.push(fn);
      },
    };
    let teardown: ReturnType<Plugin["install"]>;
    try {
      teardown = plugin.install(this, scope);
    } catch (err) {
      // LIFO rollback of partial-install cleanups.
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
    // Fold scope into destroy-time stack (LIFO order preserved).
    for (const fn of scoped) this.teardowns.add(fn);
    if (typeof teardown === "function") {
      this.teardowns.add(teardown);
    }
    return this;
  }

  /**
   * Replace the linked-sheets list at runtime. Use when peer engines aren't
   * available at construction time (mounted later in the tree). The wiring
   * to the `open` event is independent of this list — it reads `linkedSheets`
   * lazily on emit, so this setter is a simple field swap.
   */
  setLinkedSheets(sheets: BottomSheetEngine[]): void {
    if (this.destroyed) return;
    this.linkedSheets = sheets;
  }

  /** Read-only view of the current allow-list, for cross-sheet target negotiation. */
  getAllowedIds(): string[] {
    return this.snaps.getAllowedIds().slice();
  }

  /**
   * Animate to a snap point by id. Resolves when the animation completes.
   *
   * Two call shapes:
   * ```ts
   * engine.snapTo("full");                           // default velocity
   * engine.snapTo("full", 0.5);                      // px/ms initial velocity
   * engine.snapTo("full", { velocity: 0.5, signal }); // abortable
   * ```
   *
   * When `opts.signal` is provided, calling `controller.abort()` cancels the
   * in-flight tween/spring and the returned promise resolves without firing
   * `snap`. The captured `AbortSignal` is checked after each await so external
   * aborts ride the same cycle invariant as internal ones (resize, destroy,
   * concurrent snapTo).
   */
  async snapTo(
    id: string,
    velocityOrOpts:
      | number
      | { velocity?: number; signal?: AbortSignal } = 0,
    /** Internal: skip the before-snap user gate. Used by setAllowed/setSnapPoints
     *  for self-repair so a listener can't cancel our state-consistency moves. */
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
    // Emit BEFORE bumping cycle so a synchronous cancel doesn't perturb
    // in-flight state. Freeze cancel() after the listener returns.
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
    // Capture BEFORE activeId flips — once flipped, the FROM id is gone.
    this.scrollCache.cache(previousId, previousSize, target.size);
    this.activeId = id;
    // VT path is for programmatic snaps only — wrapping per-frame onUpdate
    // would re-snapshot every frame.
    if (this.animation.viewTransitionsAvailable) {
      // Skip the prior in-flight VT cleanly so Chromium doesn't reject the
      // next start with a visual flicker. newCycle() above handled the abort
      // signal but the prior VT's `finished` promise stays unresolved until
      // skipTransition().
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
        /* aborted (rare; e.g. competing transition) — fall through */
      }
      // Identity check: a newer cycle may have replaced this with its own
      // VT handle. Only clear when we still own the slot.
      if (this.currentViewTransition === vt) this.currentViewTransition = null;
    } else {
      await this.animation.animateTo(target.size, velocityPxPerMs);
    }
    externalSignal?.removeEventListener("abort", onExternalAbort);
    if (signal.aborted) return;
    // Restore AFTER the spring settles — restoring earlier means the cached
    // scrollTop applies against a still-shrunken container and overflows clip
    // incorrectly during the grow animation.
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

  /**
   * Drive the sheet to an arbitrary px size, bypassing snap matching.
   * Useful for preview scrubs, animation chaining, or programmatic gestures.
   * Animates with the configured spring/tween. Resolves when the animation
   * completes. Does NOT update `activeId` — call `snapTo(id)` after to commit.
   *
   * Unlike `snapTo`, this does not fire `before-snap` (it isn't a snap commit)
   * nor `snap` (the sheet isn't settling to a known snap). `progress` events
   * still fire via applySize. Target is clamped to `[0, maxAxisSize]`.
   */
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
    // Defensive post-await guard — mirrors snapTo's. Future side-effects
    // would otherwise fire on a torn-down engine.
    if (this.destroyed || externalSignal?.aborted) return;
    // Intentionally do NOT emit "snap", update activeId, persist, or trigger
    // open/close lifecycle — dragTo is "raw drag", commit via snapTo after.
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
    // When an internal snapTo will run, it owns the cycle bump + tween cancel.
    // Pre-empting here doubles the abort-controller churn.
    const willSnap =
      (snap !== undefined && ids.includes(snap)) ||
      (!ids.includes(this.activeId) && ids.length > 0);
    if (!willSnap) {
      this.animation.cancel();
      this.newCycle();
    }
    this.snaps.setAllowedIds(ids);
    // Reflect now — a no-op repair path would otherwise leave stale ARIA.
    this.updateAriaSlider();
    // Internal repair bypasses the user before-snap gate so a listener can't
    // leave activeId outside the new allowedIds.
    if (snap && ids.includes(snap)) {
      void this.snapTo(snap, 0, /* internal */ true);
    } else if (!ids.includes(this.activeId)) {
      const fallback = ids[0];
      if (fallback) void this.snapTo(fallback, 0, /* internal */ true);
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

  /**
   * Batch-update multiple scrim fields in one call. Apply order is:
   *   1. `preset` — fills baseline color/blur/range/interactive.
   *   2. `mode` — re-positions the scrim (fixed inset / clear / hide).
   *   3. `enabled` — flips the opacity contribution on/off.
   *   4. `tapToClose` — installs/tears the click listener.
   *   5. `color` / `blur` / `interactive` / `range` — explicit overrides.
   *   6. ONE `applySize` so the per-frame opacity stays consistent.
   *
   * Performance: collecting changes here (vs calling individual setters)
   * avoids repeated `applySize` calls during a multi-field swap. Setters
   * called here suppress their own internal `applySize` either by passing
   * through fast-paths (mode/enabled no-op when value unchanged) or by
   * being visual-only (color/blur/interactive don't influence opacity).
   */
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

  /**
   * Read-only snapshot of scrim state. Use the `setScrim*` setters to mutate.
   * Stable public API — internals (e.g. cached opacity sentinels) are NOT
   * exposed so consumers can't accidentally couple to ScrimController shape.
   */
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
    // Cached scrollTop values were captured against the old maxAxisSize
    // threshold — they're stale relative to the new geometry.
    this.scrollCache.clear();
    // Geometry change shifts (progress → opacity) under the scrim's dedup
    // cache. Without invalidation, the next static-sheet applySize would
    // short-circuit and leave scrim opacity stale.
    this.scrim.invalidateOpacityCache();
    const current = this.snaps.findById(this.activeId);
    if (current) {
      this.applySize(current.size);
    }
    this.updateAriaSlider();
  }

  destroy(): void {
    this.destroyed = true;
    // Terminal abort — no fresh controller. Any in-flight async path that
    // captured a signal sees aborted on its post-await guard and bails.
    this.currentAbort.abort();
    // Skip in-flight VT so its `finished` promise + DOM snapshot don't get
    // retained until next GC. skipTransition is optional API.
    this.currentViewTransition?.skipTransition?.();
    this.currentViewTransition = null;
    this.bus.clear();
    this.animation.cancel();
    // Gesture detach won't fire onCancel synthetically when destroyed
    // mid-drag, so the controller clears its own data-attribute + will-change.
    this.gesture?.forceClearDragState();
    // Single LIFO drain — plugins (added last, in order) tear down first
    // before the infrastructure they depend on (gestures, content-swipe,
    // resize, escape, keyboard, visual-viewport, reducedMotion mq, stack
    // entry). bus.clear() above already silenced events so plugin teardowns
    // can't observe partial state.
    this.teardowns.drain();
    // ScrimController owns its own teardowns (detachScrimTap +
    // scrimOverlayTeardown + inline style clears on screen / backdrop).
    this.scrim.destroy();
    // Drains the matchMedia listener + clears in-flight tween/spring refs.
    this.animation.destroy();
    // Releases focus-trap + scroll-lock + inert-siblings if still installed.
    this.lifecycle.destroy();
    // Clear inline writes on the host element + backdrop + screen so a
    // consumer reusing those DOM nodes (HMR, portal-based modal stack,
    // detach-then-reattach scenarios) doesn't inherit stale opacity /
    // pointer-events / display from the prior engine instance. We only
    // null fields we wrote — `transform` / size styles intentionally
    // stay so the visual state matches the engine's last applied size
    // until the consumer overwrites them.
    if (this.backdrop) {
      this.backdrop.style.opacity = "";
      this.backdrop.style.pointerEvents = "";
    }
    if (this.screenComponent) {
      this.screenComponent.style.opacity = "";
      this.screenComponent.style.display = "";
    }
    // Reset write-dedup sentinels — keeps a reused-DOM scenario (HMR,
    // portal-based modal stack) from skipping the first frame's CSSOM write.
    this.sizeWriteSentinel.invalidate();
    this.progressWriteSentinel.invalidate();
  }

  private emit<K extends keyof SheetEventMap>(
    event: K,
    payload: SheetEventMap[K],
  ): void {
    this.bus.emit(event, payload);
  }

  /**
   * Abort the current cycle's signal and replace the controller. Returns the
   * fresh signal so the caller can capture it locally before any await — when
   * a future newCycle() / destroy aborts our controller, the captured signal
   * flips to aborted and post-await guards short-circuit.
   */
  private newCycle(): AbortSignal {
    this.currentAbort.abort();
    this.currentAbort = new AbortController();
    return this.currentAbort.signal;
  }

  /**
   * Fire `before-snap` and report whether a listener cancelled it. The
   * `cancel()` callback exposed to listeners is frozen after the synchronous
   * emit phase so async callers can't silently miss — they get a console
   * warning. Returns `true` when cancelled so callers can early-return /
   * spring-back without re-implementing the cancel/frozen pattern.
   */
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
    // Resolver's `onMaxAxisSizeChange` callback writes element.style[layoutAxis]
    // — engine no longer duplicates the write here (m6: was a double CSSOM write
    // per resize tick). Constructor wired the callback at SnapResolver init
    // time; setRaw → recompute → callback chain handles the style.
    this.snaps.setRaw(this.snapPointsRaw);
    // Geometry change shifts the (progress → opacity) mapping under the
    // scrim cache; invalidate so the next applyOpacity recomputes math
    // even when progress itself didn't move (resize while at rest).
    this.scrim.invalidateOpacityCache();
  }

  /**
   * Memoised `allowedRange()` — delegates to SnapResolver which owns the cache.
   * Engine wrapper kept so existing call sites don't all need updating;
   * resolver-level memoization survives across method invocations.
   */
  private getAllowedRange(): { min: number; max: number } {
    return this.snaps.getAllowedRange();
  }

  /**
   * Write ARIA slider value attributes onto the handle so the engine itself
   * is the source of truth for screen-reader announcements. Called from the
   * constructor and from every code path that mutates `activeId` /
   * `allowedIds`. WAI-ARIA 1.2 requires `aria-valuenow` for `role="slider"` —
   * without it screen readers can't announce drag/snap progress to keyboard
   * + AT users (WCAG 4.1.2 Name, Role, Value).
   *
   * Engine does NOT set `role="slider"` itself — that's the adapter's or
   * consumer markup's responsibility. We only decorate with dynamic values.
   *
   * Empty allowed-list is malformed input (settable via `setAllowed([])`);
   * short-circuit to remove ARIA value attributes so screen readers see a
   * no-value slider rather than a degenerate `min=max=now=0` (WAI-ARIA 1.2
   * requires `valuemax > valuemin` for `role="slider"`).
   */
  private updateAriaSlider(): void {
    this.aria.setValue(this.snaps.getAllowedIds(), this.activeId);
  }

  private registerInStack(): void {
    this.teardowns.add(sheetStack.push({
      id: this.id,
      setZIndex: z => {
        this.element.style.zIndex = String(z);
        if (this.backdrop) this.backdrop.style.zIndex = String(z - 1);
      },
      setIsTop: isTop => {
        this.isTopSheet = isTop;
        if (this.backdrop) {
          this.backdrop.style.display = isTop ? "" : "none";
        }
      },
    }));
  }

  private attach(): void {
    this.gesture = new GestureController({
      handle: this.handle,
      element: this.element,
      mode: this.mode,
      getRoot: () => this.rootEl,
      // Single coalesced reader — narrows the DI surface and removes 3 getter
      // dispatches per onMove frame at 60-120Hz. Returns a SHARED buffer
      // (this.dragContextBuf) — see field JSDoc for the retention contract.
      // Inner `range` object is mutated in place too so callers caching its
      // identity between frames stay valid.
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

    // Wrap feature installs so a partial throw (detached DOM, shadow-DOM,
    // missing globals under HMR) doesn't leak the gesture listener or
    // feature-listeners installed before the throw. Drain on catch +
    // controller destroys; rethrow so the consumer sees the failure.
    try {
      this.attachFeatures();
    } catch (err) {
      // Drain destroy-only teardowns first (gesture, plugins, observers).
      this.teardowns.drain();
      // Controllers register their own listeners OUTSIDE the teardowns stack:
      //   - AnimationRunner: prefers-reduced-motion matchMedia listener (added
      //     in its constructor, not via teardowns.add).
      //   - ScrimController: tap-to-close click listener installed inside
      //     `scrim.attach()` — may or may not be registered depending on
      //     where attachFeatures threw, but destroy() is idempotent.
      //   - LifecycleController: focus-trap / scroll-lock fire only on open(),
      //     so generally not active mid-attach, but destroy() seals it.
      // Without these calls, partial-attach failure leaks the matchMedia
      // listener for the lifetime of the page.
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
        getAllowedIds: () => this.snaps.getAllowedIds() as string[],
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
      }));

      if (this.lifecycle.closeOnEscape) {
        const onKey = (e: KeyboardEvent) => {
          if (this.destroyed) return;
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
      getAllowedIds: () => this.snaps.getAllowedIds() as string[],
      getActiveId: () => this.activeId,
      snapTo: id => {
        void this.snapTo(id);
      },
    }));

    // Delegate to the runtime setter to collapse install logic into one path.
    // ScrimController buffers the construction-time `scrimTapToClose` flag
    // and installs the click listener now that DOM is wired. Idempotent
    // because controller's setScrimTapToClose checks the install state.
    this.scrim.attach();

    // Note on SPA route-change leaks: consumer is responsible for calling
    // `engine.destroy()` in their unmount hook (useEffect cleanup, etc.).
    // We deliberately do NOT auto-destroy via MutationObserver — the observer
    // surface is too broad (childList:true on documentElement fires on every
    // unrelated subtree mutation) and tightening it to the parent only
    // breaks under reparenting (portals, view-transitions). If you forget
    // destroy() in React/Next, document-level listeners leak across route
    // changes; framework adapters' `useBottomSheet`/`onBeforeUnmount` already
    // handle this correctly.
  }

  private settleAfterDrag(
    delta: number,
    velocity: number,
    kind: "touch" | "mouse" | "pen" = "touch",
  ): void {
    const signal = this.newCycle();
    // Pure target-resolution policy lives in snapPoints.ts — engine just
    // owns the side-effectful follow-up (before-snap emit, scrollCache,
    // animateTo, snap event, haptic, open/close lifecycle).
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
    // On cancel, spring back to the current active snap instead of advancing
    // to the gesture target.
    if (this.emitBeforeSnap(target, previousId)) {
      const restore = this.snaps.findById(previousId);
      if (restore) {
        void this.animation.animateTo(restore.size, 0);
      }
      return;
    }
    const previousSize = this.size;
    this.scrollCache.cache(previousId, previousSize, target.size);
    this.activeId = target.id;
    void this.animation.animateTo(target.size, velocity).then(() => {
      if (signal.aborted) return;
      this.scrollCache.restore(target!.id, previousSize, target!.size);
      this.updateAriaSlider();
      this.emit("snap", { id: target!.id, size: target!.size });
      this.haptic();
      if (previousId === "closed" && target!.size > 0) {
        this.emit("open", { id: target!.id });
        this.handleOpen();
      }
      if (target!.size === 0) {
        this.emit("close", undefined);
        this.handleClose();
      }
    });
  }

  /** Trigger a brief haptic tick (iOS Safari + Android Chrome support). */
  private haptic(): void {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(HAPTIC_DURATION_MS);
      } catch {
        /* permission denied or unsupported — ignore */
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
    }
    const progress = this.computeProgress(size);
    const progressChanged = this.progressWriteSentinel.shouldWrite(
      progress,
      OPACITY_WRITE_EPSILON,
    );
    if (progressChanged) {
      style.setProperty("--bs-progress", String(progress));
    }

    // Scrim opacity (backdrop + screen) is owned by ScrimController. Its
    // applyOpacity bears the same sub-pixel dedup gates as the prior inline
    // branches; tests verify per-frame writes are still elided in steady-state.
    this.scrim.applyOpacity(progress, progressChanged);
    if (progressChanged && this.bus.listenerCount("progress") > 0) {
      // Pool the payload — mirrors GestureController's `dragPayload` pattern.
      // Identity is documented in SheetEventMap.progress JSDoc.
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
    // Install steps can throw on detached/shadow-DOM targets; without the
    // catch the user gets trapped in a half-open sheet (scroll locked, no
    // focus trap). Revert visuals + state and surface the error async.
    try {
      this.lifecycle.install();
    } catch (err) {
      // Start a new cycle so any pending .then() from the failed open's
      // animateTo bails before emitting a stale snap/open against the
      // rolled-back state. Skip when destroyed — destroy() already aborted
      // terminally, and a fresh AbortController would resurrect a non-
      // aborted signal on a torn-down engine, breaking that invariant.
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

  private handleClose(): void {
    this.lifecycle.release();
  }
}
