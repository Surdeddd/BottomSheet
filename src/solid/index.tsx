/** @jsxImportSource solid-js */
import {
  createSignal,
  createMemo,
  createEffect,
  on,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  SnapPointDef,
  SheetMode,
} from "../core/types";

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
  radius?: string | number;
  maxHeight?: string | number;
  persistent?: boolean;
  disableClose?: boolean;
  disableDrag?: boolean;
  closeOnRouteChange?: boolean;
  returnFocusTo?: string;
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
  onSnap?: (id: TId) => void;
  onChange?: (state: EngineState & { activeId: TId }) => void;
  engineRef?: (engine: BottomSheetEngine | null) => void;
  header?: JSX.Element;
  footer?: JSX.Element;
  screen?: JSX.Element;
  children?: JSX.Element;
};

export const BottomSheet = <TId extends string = string>(
  props: BottomSheetProps<TId>,
): JSX.Element => {
  let sheetEl: HTMLElement | undefined;
  let handleEl: HTMLElement | undefined;
  let contentEl: HTMLElement | undefined;
  let backdropEl: HTMLElement | undefined;
  let scrimEl: HTMLElement | undefined;

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
      scrim: scrimEl,
      mode: props.mode ?? "bottom",
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
      radius: props.radius,
      maxHeight: props.maxHeight,
      persistent: props.persistent,
      disableClose: props.disableClose,
      disableDrag: props.disableDrag,
      closeOnRouteChange: props.closeOnRouteChange,
      returnFocusTo: props.returnFocusTo,
    };

    engine = new BottomSheetEngine(engineOpts);
    props.engineRef?.(engine);

    const sync = (): void => {
      if (!engine) return;
      const s = engine.state;
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

    if (
      props.backdrop !== false &&
      props.closeOnBackdrop !== false &&
      backdropEl
    ) {
      const onBackdropClick = (): void => {
        if (engine?.canDismiss()) void engine.close("backdrop");
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
    props.engineRef?.(null);
  });

  createEffect(
    on(
      () => props.snapPoints,
      (points, prev) => {
        if (!engine || prev === undefined) return;
        engine.setSnapPoints(
          points as unknown as EngineOptions["snapPoints"],
          props.allowed as unknown as string[] | undefined,
        );
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.allowed,
      (allowed, prev) => {
        if (!engine || prev === undefined) return;
        if (allowed) engine.setAllowed(allowed as unknown as string[]);
      },
      { defer: true },
    ),
  );

  const showBackdrop = createMemo(() => props.backdrop !== false);
  const mode = createMemo<SheetMode>(() => props.mode ?? "bottom");
  const ariaLabel = createMemo(() => props.ariaLabel ?? "Bottom sheet");

  return (
    <div class="bs-root">
      {showBackdrop() ? (
        <div class="bs-backdrop" ref={el => (backdropEl = el)} />
      ) : null}
      <div class="bs-screen" ref={el => (scrimEl = el)}>
        {props.screen}
      </div>
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
        />
        <Show when={props.header}>
          <div class="bs-header">{props.header}</div>
        </Show>
        <div
          class="bs-content"
          ref={el => (contentEl = el)}
          tabIndex={0}
          role="region"
          aria-label="Sheet content"
        >
          {props.children}
        </div>
        <Show when={props.footer}>
          <div class="bs-footer">{props.footer}</div>
        </Show>
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
