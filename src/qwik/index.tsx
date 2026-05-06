/** @jsxImportSource @builder.io/qwik */
//
// The engine owns mutable state (DOM refs, RAF handles, gesture closures)
// that is intentionally not serialised by Qwik — it boots lazily inside
// useVisibleTask$ and dies with the component. The sheet renders its static
// shell on the server; gestures activate post-hydration.

import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  Slot,
  type QRL,
} from "@builder.io/qwik";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  SnapPointDef,
  SheetMode,
} from "../core/types";

/**
 * Props for the Qwik `BottomSheet` component. Optionally narrows to a
 * literal-id union `TId` when the consumer pins `snapPoints` with `as const`
 * and explicitly types the call site:
 *
 * ```tsx
 * const points = [
 *   { id: "min", size: 96 },
 *   { id: "full", size: "85%" },
 * ] as const;
 * <BottomSheet<"min" | "full"> snapPoints={points} onSnap$={$((id) => ...)} />
 * ```
 *
 * Without an explicit type argument `TId` defaults to `string` so existing
 * call sites compile unchanged. The underlying engine stays `string`-typed;
 * the literal narrowing is a TS-only convenience layered on top of the
 * runtime. Note: Qwik wraps event handlers in `QRL<...>` because component
 * boundaries are serialised — that wrapper preserves the inner `TId`.
 */
export type BottomSheetProps<TId extends string = string> = {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  mode?: SheetMode;
  animation?: "spring" | "tween";
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
  onSnap$?: QRL<(id: TId) => void>;
  /** Fires on every state-affecting engine event (snap/dragstart/dragend). */
  onChange$?: QRL<(state: EngineState & { activeId: TId }) => void>;
};

export const BottomSheet = component$<BottomSheetProps>(props => {
  const sheetRef = useSignal<HTMLElement>();
  const handleRef = useSignal<HTMLElement>();
  const contentRef = useSignal<HTMLElement>();
  const backdropRef = useSignal<HTMLElement>();

  const initialActive =
    props.initial ?? props.snapPoints[0]?.id ?? "default";

  const state = useStore<EngineState>({
    size: 0,
    activeId: initialActive,
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!sheetRef.value) return;
    // Engine falls back (handle defaults to element, content/backdrop skipped)
    // — warn so consumers know which features are disabled.
    if (!handleRef.value || !contentRef.value) {
      console.warn(
        "[BottomSheet/qwik] handle or content ref missing at attach time — drag and content-swipe disabled. Make sure ref bindings render before useVisibleTask$ fires.",
      );
    }

    const engineOpts: EngineOptions = {
      element: sheetRef.value,
      handle: handleRef.value,
      scrollContainer: contentRef.value,
      backdrop: props.backdrop !== false ? backdropRef.value : undefined,
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

    const engine = new BottomSheetEngine(engineOpts);

    const sync = () => {
      const s = engine.state;
      state.size = s.size;
      state.activeId = s.activeId;
      state.isDragging = s.isDragging;
      state.isAnimating = s.isAnimating;
      state.progress = s.progress;
      props.onChange$?.(s);
    };

    sync();
    engine.on("snap", payload => {
      sync();
      props.onSnap$?.(payload.id);
    });
    engine.on("dragstart", sync);
    engine.on("dragend", sync);
    // Intentionally NOT subscribing to "progress": Qwik's reactivity
    // serialises lazy components on store mutation, so per-frame writes at
    // 60-120 Hz would force a serialisation pass per tick. This adapter is
    // settled-state only — there's no API to subscribe to per-frame progress
    // from this component. The engine instance is intentionally not exposed:
    // it owns DOM refs / RAF handles / gesture closures that Qwik cannot
    // serialise (see top-of-file note). Consumers needing per-frame progress
    // must either fork this adapter and add the listener inline, or instantiate
    // `BottomSheetEngine` directly in a `useVisibleTask$` and render their own
    // shell — the React/Vue/Svelte adapters expose engine handles for that
    // use case if a Qwik island is undesirable.

    cleanup(() => engine.destroy());
  });

  const showBackdrop = props.backdrop !== false;
  const mode = props.mode ?? "bottom";
  const ariaLabel = props.ariaLabel ?? "Bottom sheet";

  return (
    <div class="bs-root">
      {showBackdrop ? (
        <div class="bs-backdrop" ref={backdropRef}></div>
      ) : null}
      <section
        class="bs-sheet"
        ref={sheetRef}
        data-mode={mode}
        data-active={state.activeId}
        role="dialog"
        aria-modal={props.focusTrap ? "true" : undefined}
        aria-label={ariaLabel}
      >
        <div
          class="bs-handle"
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label="Resize sheet"
        >
          <Slot name="header" />
        </div>
        <div class="bs-content" ref={contentRef}>
          <Slot />
        </div>
        <span class="bs-sr-only" role="status" aria-live="polite">
          {state.activeId}
        </span>
      </section>
    </div>
  );
});

export type {
  SnapPoint,
  SnapPointDef,
  SheetMode,
  EngineState,
  EngineOptions,
} from "../core/types";
