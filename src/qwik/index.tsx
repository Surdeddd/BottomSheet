/** @jsxImportSource @builder.io/qwik */
import {
  component$,
  noSerialize,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  Slot,
  type NoSerialize,
  type QRL,
} from "@builder.io/qwik";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import { devWarn } from "../core/primitives/devWarn";
import {
  resolveTeleportTarget,
  teleportElements,
  type TeleportTarget,
} from "../core/features/teleport";
import type {
  EngineOptions,
  EngineState,
  SheetEventMap,
  SnapPointDef,
  SheetMode,
} from "../core/types";

export type BottomSheetProps<TId extends string = string> = {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  mode?: SheetMode;
  animation?: EngineOptions["animation"];
  spring?: { stiffness?: number; damping?: number; mass?: number };
  focusTrap?: boolean;
  closeOnEscape?: boolean;
  closeOnBack?: boolean;
  lockBodyScroll?: boolean;
  rubberBand?: boolean;
  backdropRange?: [number, number];
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  persistent?: boolean;
  disableClose?: boolean;
  disableDrag?: boolean;
  dragFrom?: EngineOptions["dragFrom"];
  dragFromContent?: boolean;
  closeOnRouteChange?: boolean;
  stackEffect?: boolean;
  teleport?: boolean;
  teleportTo?: TeleportTarget;
  returnFocusTo?: EngineOptions["returnFocusTo"];
  ariaLabel?: string;
  radius?: string | number;
  maxHeight?: string | number;

  onSnap$?: QRL<(id: TId) => void>;
  onOpen$?: QRL<(id: TId) => void>;
  onClose$?: QRL<() => void>;
  onOpened$?: QRL<(id: TId) => void>;
  onClosed$?: QRL<() => void>;
  onDragStart$?: QRL<(payload: SheetEventMap["dragstart"]) => void>;
  onDragEnd$?: QRL<(payload: SheetEventMap["dragend"]) => void>;

  onChange$?: QRL<(state: EngineState & { activeId: TId }) => void>;
};

export const BottomSheet = component$<BottomSheetProps>(props => {
  const sheetRef = useSignal<HTMLElement>();
  const handleRef = useSignal<HTMLElement>();
  const contentRef = useSignal<HTMLElement>();
  const backdropRef = useSignal<HTMLElement>();
  const scrimRef = useSignal<HTMLElement>();
  const headerRef = useSignal<HTMLElement>();
  const footerRef = useSignal<HTMLElement>();
  const leftBtnRef = useSignal<HTMLElement>();
  const rightBtnRef = useSignal<HTMLElement>();

  const initialActive =
    props.initial ?? props.snapPoints[0]?.id ?? "default";

  const state = useStore<EngineState>({
    size: 0,
    activeId: initialActive,
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });
  const engineStore = useStore<{
    engine: NoSerialize<BottomSheetEngine>;
  }>({ engine: undefined });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!sheetRef.value) return;

    if (!handleRef.value || !contentRef.value) {
      devWarn(
        "[BottomSheet/qwik] handle or content ref missing at attach time — drag and content-swipe disabled. Make sure ref bindings render before useVisibleTask$ fires.",
      );
    }

    const engineOpts: EngineOptions = {
      element: sheetRef.value,
      handle: handleRef.value,
      scrollContainer: contentRef.value,
      backdrop: props.backdrop !== false ? backdropRef.value : undefined,
      scrim: scrimRef.value,
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
      persistent: props.persistent,
      disableClose: props.disableClose,
      disableDrag: props.disableDrag,
      dragFrom: props.dragFrom,
      dragFromContent: props.dragFromContent,
      closeOnRouteChange: props.closeOnRouteChange,
      stackEffect: props.stackEffect,
      returnFocusTo: props.returnFocusTo,
      radius: props.radius,
      maxHeight: props.maxHeight,
    };

    const engine = new BottomSheetEngine(engineOpts);
    engineStore.engine = noSerialize(engine);

    const teleportTarget =
      props.teleport === false ? null : resolveTeleportTarget(props.teleportTo);
    const restoreTeleport = teleportTarget
      ? teleportElements(
          [backdropRef.value, scrimRef.value, sheetRef.value],
          teleportTarget,
        )
      : null;

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
    engine.on("open", payload => props.onOpen$?.(payload.id));
    engine.on("close", () => props.onClose$?.());
    engine.on("opened", payload => props.onOpened$?.(payload.id));
    engine.on("closed", () => props.onClosed$?.());
    engine.on("dragstart", payload => {
      sync();
      props.onDragStart$?.(payload);
    });
    engine.on("dragend", payload => {
      sync();
      props.onDragEnd$?.(payload);
    });

    let onBackdropClick: (() => void) | undefined;
    if (
      props.backdrop !== false &&
      props.closeOnBackdrop !== false &&
      backdropRef.value
    ) {
      onBackdropClick = () => {
        if (engine.canDismiss()) void engine.close("backdrop");
      };
      backdropRef.value.addEventListener("click", onBackdropClick);
    }

    const collapseEmpty = (el: HTMLElement | undefined) => {
      if (!el) return;
      const empty = el.children.length === 0 && el.textContent?.trim() === "";
      if (empty) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    };
    const collapseBoth = () => {
      collapseEmpty(headerRef.value);
      collapseEmpty(footerRef.value);
      collapseEmpty(leftBtnRef.value);
      collapseEmpty(rightBtnRef.value);
    };
    collapseBoth();
    let slotObserver: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      slotObserver = new MutationObserver(collapseBoth);
      for (const el of [
        headerRef.value,
        footerRef.value,
        leftBtnRef.value,
        rightBtnRef.value,
      ]) {
        if (el) {
          slotObserver.observe(el, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      }
    }

    cleanup(() => {
      slotObserver?.disconnect();
      if (onBackdropClick && backdropRef.value) {
        backdropRef.value.removeEventListener("click", onBackdropClick);
      }
      restoreTeleport?.();
      engineStore.engine = undefined;
      engine.destroy();
    });
  });

  useTask$(({ track }) => {
    const points = track(() => props.snapPoints);
    const allowed = track(() => props.allowed);
    const engine = engineStore.engine;
    if (!engine) return;
    engine.setSnapPoints(
      points as unknown as EngineOptions["snapPoints"],
      allowed as unknown as string[] | undefined,
    );
  });

  useTask$(({ track }) => {
    const radius = track(() => props.radius);
    const maxHeight = track(() => props.maxHeight);
    const engine = engineStore.engine;
    if (!engine) return;
    if (radius !== undefined) engine.setRadius(radius);
    if (maxHeight !== undefined) engine.setMaxHeight(maxHeight);
  });

  useTask$(({ track }) => {
    const persistent = track(() => props.persistent);
    const disableClose = track(() => props.disableClose);
    const disableDrag = track(() => props.disableDrag);
    const dragFromContent = track(() => props.dragFromContent);
    const dragFrom = track(() => props.dragFrom);
    const engine = engineStore.engine;
    if (!engine) return;
    if (persistent !== undefined) engine.setPersistent(persistent);
    if (disableClose !== undefined) engine.setDisableClose(disableClose);
    if (disableDrag !== undefined) engine.setDisableDrag(disableDrag);
    if (dragFromContent !== undefined) {
      engine.setDragFromContent(dragFromContent);
    }
    if (dragFrom !== undefined) engine.setDragFrom(dragFrom);
  });

  const showBackdrop = props.backdrop !== false;
  const mode = props.mode ?? "bottom";
  const ariaLabel = props.ariaLabel ?? "Bottom sheet";

  return (
    <div class="bs-root">
      {showBackdrop ? (
        <div class="bs-backdrop" ref={backdropRef}></div>
      ) : null}
      <div class="bs-screen" ref={scrimRef}>
        <Slot name="screen" />
      </div>
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
        />
        <div class="bs-header" ref={headerRef}>
          <Slot name="header" />
        </div>
        <div class="bs-content" ref={contentRef}>
          <Slot />
        </div>
        <div class="bs-footer" ref={footerRef}>
          <Slot name="footer" />
        </div>
        <span class="bs-sr-only" role="status" aria-live="polite">
          {state.activeId}
        </span>
      </section>
      <div
        class="bs-button-slot"
        data-side="left"
        data-mode={mode}
        ref={leftBtnRef}
      >
        <Slot name="leftButton" />
      </div>
      <div
        class="bs-button-slot"
        data-side="right"
        data-mode={mode}
        ref={rightBtnRef}
      >
        <Slot name="rightButton" />
      </div>
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
