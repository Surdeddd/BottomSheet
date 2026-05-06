/** @jsxImportSource solid-js */
import {
  createSignal,
  createMemo,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  SnapPointDef,
  SheetMode,
} from "../core/types";

/**
 * Props for the Solid `BottomSheet` component. Optionally narrows to a
 * literal-id union `TId` when the consumer pins `snapPoints` with `as const`
 * and explicitly types the call site:
 *
 * ```tsx
 * const points = [
 *   { id: "min", size: 96 },
 *   { id: "full", size: "85%" },
 * ] as const;
 * <BottomSheet<"min" | "full"> snapPoints={points} onSnap={id => ...} />
 * ```
 *
 * Without an explicit type argument `TId` defaults to `string` so existing
 * call sites compile unchanged. The underlying engine stays `string`-typed;
 * the literal narrowing is a TS-only convenience layered on top of the
 * runtime.
 */
export type BottomSheetProps<TId extends string = string> = {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  mode?: SheetMode;
  animation?:
    | "spring"
    | "tween"
    | "ios-spring"
    | "material-bounce"
    | "linear"
    | "snappy";
  spring?: { stiffness?: number; damping?: number; mass?: number };
  focusTrap?: boolean;
  closeOnEscape?: boolean;
  closeOnBack?: boolean;
  lockBodyScroll?: boolean;
  rubberBand?: boolean;
  backdropRange?: [number, number];
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
  /** Fires when the active snap settles. */
  onSnap?: (id: TId) => void;
  /** Fires on every state-affecting engine event (snap/dragstart/dragend). */
  onChange?: (state: EngineState & { activeId: TId }) => void;
  /**
   * Imperative escape hatch. Invoked once after the engine is constructed
   * inside `onMount` (and once with `null` on cleanup). Use this to subscribe
   * to per-frame events the adapter intentionally skips, e.g.
   * `engineRef={(e) => e?.on("progress", ...)}`. Mirrors React's
   * `useBottomSheet` engine handle.
   */
  engineRef?: (engine: BottomSheetEngine | null) => void;
  /** Header content rendered inside the drag handle. */
  header?: JSX.Element;
  children?: JSX.Element;
};

export const BottomSheet = <TId extends string = string>(
  props: BottomSheetProps<TId>,
): JSX.Element => {
  // Ref callbacks run synchronously during render; populated by onMount.
  let sheetEl: HTMLElement | undefined;
  let handleEl: HTMLElement | undefined;
  let contentEl: HTMLElement | undefined;
  let backdropEl: HTMLElement | undefined;

  const initialActive = (): TId =>
    (props.initial ?? props.snapPoints[0]?.id ?? "default") as TId;

  const [state, setState] = createSignal<EngineState & { activeId: TId }>({
    size: 0,
    activeId: initialActive(),
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });

  let engine: BottomSheetEngine | null = null;

  onMount(() => {
    if (!sheetEl) return;

    const engineOpts: EngineOptions = {
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: props.backdrop !== false ? backdropEl : undefined,
      mode: props.mode ?? "bottom",
      // Widen literal-id back to string at the engine boundary — the engine
      // is string-typed at runtime, the TId narrowing is a TS-only veneer.
      snapPoints: props.snapPoints as unknown as SnapPointDef[],
      allowed: props.allowed as unknown as string[] | undefined,
      initial: props.initial,
      animation: props.animation,
      spring: props.spring,
      focusTrap: props.focusTrap,
      closeOnEscape: props.closeOnEscape,
      closeOnBack: props.closeOnBack,
      lockBodyScroll: props.lockBodyScroll,
      rubberBand: props.rubberBand,
      backdropRange: props.backdropRange,
    };

    engine = new BottomSheetEngine(engineOpts);
    // Expose engine to consumer once: lets them subscribe to per-frame events
    // (e.g. "progress") that the adapter omits, without forking.
    props.engineRef?.(engine);

    const sync = (): void => {
      if (!engine) return;
      const s = engine.state;
      // New object identity ensures Solid signal subscribers re-run.
      setState({ ...s } as EngineState & { activeId: TId });
      props.onChange?.(s as EngineState & { activeId: TId });
    };

    sync();
    engine.on("snap", payload => {
      sync();
      props.onSnap?.(payload.id as TId);
    });
    engine.on("dragstart", sync);
    engine.on("dragend", sync);
    // Intentionally NOT subscribing to "progress": that event fires every
    // animation frame (60-120 Hz) and a `setState({ ...engine.state })` per
    // tick busts memoisation across the Solid component tree. Consumers who
    // need per-frame progress should subscribe via the `engineRef` prop
    // (`engineRef={(e) => e?.on("progress", ...)}`). This matches the
    // React/Vue/Svelte adapters' explicit "settled-state only" contract.

    if (
      props.backdrop !== false &&
      props.closeOnBackdrop !== false &&
      backdropEl
    ) {
      const onBackdropClick = (): void => {
        void engine?.close();
      };
      backdropEl.addEventListener("click", onBackdropClick);
      onCleanup(() => {
        backdropEl?.removeEventListener("click", onBackdropClick);
      });
    }
  });

  onCleanup(() => {
    engine?.destroy();
    engine = null;
    // Notify consumer the engine is gone so they can drop their reference.
    props.engineRef?.(null);
  });

  const showBackdrop = createMemo(() => props.backdrop !== false);
  const mode = createMemo<SheetMode>(() => props.mode ?? "bottom");
  const ariaLabel = createMemo(() => props.ariaLabel ?? "Bottom sheet");

  return (
    <div class="bs-root">
      {showBackdrop() ? (
        <div class="bs-backdrop" ref={el => (backdropEl = el)} />
      ) : null}
      <section
        class="bs-sheet"
        ref={el => (sheetEl = el)}
        data-mode={mode()}
        data-active={state().activeId}
        role="dialog"
        aria-modal={props.focusTrap ? "true" : undefined}
        aria-label={ariaLabel()}
      >
        <div
          class="bs-handle"
          ref={el => (handleEl = el)}
          role="slider"
          tabIndex={0}
          aria-label="Resize sheet"
        >
          {props.header}
        </div>
        <div
          class="bs-content"
          ref={el => (contentEl = el)}
          tabIndex={0}
          role="region"
          aria-label="Sheet content"
        >
          {props.children}
        </div>
        <span class="bs-sr-only" role="status" aria-live="polite">
          {state().activeId}
        </span>
      </section>
    </div>
  );
};

export type {
  SnapPoint,
  SnapPointDef,
  SheetMode,
  EngineState,
  EngineOptions,
} from "../core/types";
