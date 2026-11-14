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
import { devWarn } from "../core/primitives/dev-warn";
import {
  resolveTeleportTarget,
  teleportElements,
  type TeleportTarget,
} from "../core/features/teleport";
import { guessPhysicalMode } from "../core/primitives/logical-mode";
import {
  pickEngineOptions,
  type EngineConfig,
} from "../core/primitives/option-keys";
import { startsClosed } from "../core/primitives/snap-points";
import type {
  EngineOptions,
  EngineState,
  PhysicalSheetMode,
  SheetEventMap,
  SnapPointDef,
  SheetMode,
} from "../core/types";

type Serialisable = Omit<
  Partial<EngineConfig>,
  "snapPoints" | "allowed" | "initial" | "easing" | "linkedSheets" | "features"
>;

export type BottomSheetProps<TId extends string = string> = Serialisable & {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  teleport?: boolean;
  teleportTo?: TeleportTarget;
  ariaLabel?: string;
  handleLabel?: string;
  contentLabel?: string;

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
    phase: "closed",
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });
  const engineStore = useStore<{
    engine: NoSerialize<BottomSheetEngine>;
  }>({ engine: undefined });
  const physicalMode = useSignal<PhysicalSheetMode>(
    guessPhysicalMode(props.mode),
  );
  const restAtStart = startsClosed(
    props.snapPoints,
    props.initial,
    props.allowed,
  )
    ? "closed"
    : undefined;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!sheetRef.value) return;

    if (!handleRef.value || !contentRef.value) {
      devWarn(
        "[BottomSheet/qwik] handle or content ref missing at attach time — drag and content-swipe disabled. Make sure ref bindings render before useVisibleTask$ fires.",
      );
    }

    const engineOpts: EngineOptions = {
      ...pickEngineOptions(props as unknown as Record<string, unknown>),
      element: sheetRef.value,
      handle: handleRef.value,
      scrollContainer: contentRef.value,
      backdrop: props.backdrop !== false ? backdropRef.value : undefined,
      scrim: scrimRef.value,
      mode: props.mode ?? "bottom",
      snapPoints: props.snapPoints as unknown as SnapPointDef[],
    };

    const teleportTarget =
      props.teleport === false ? null : resolveTeleportTarget(props.teleportTo);
    const restoreTeleport = teleportTarget
      ? teleportElements(
          [backdropRef.value, scrimRef.value, sheetRef.value],
          teleportTarget,
        )
      : null;

    const engine = new BottomSheetEngine(engineOpts);
    engineStore.engine = noSerialize(engine);
    physicalMode.value = engine.getMode();

    const sync = () => {
      const s = engine.state;
      state.size = s.size;
      state.activeId = s.activeId;
      state.isDragging = s.isDragging;
      state.phase = s.phase;
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
  }, { strategy: "document-ready" });

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

  useTask$(({ track }) => {
    const nextMode = track(() => props.mode);
    const engine = engineStore.engine;
    if (!engine || nextMode === undefined) return;
    engine.setMode(nextMode);
    physicalMode.value = engine.getMode();
  });

  const showBackdrop = props.backdrop !== false;
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
        data-mode={physicalMode.value}
        data-bs-rest={restAtStart}
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
          aria-label={props.handleLabel ?? "Resize sheet"}
        />
        <div class="bs-header" ref={headerRef}>
          <Slot name="header" />
        </div>
        <div
          class="bs-content"
          ref={contentRef}
          tabIndex={0}
          role="region"
          aria-label={props.contentLabel ?? "Sheet content"}
        >
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
        data-mode={physicalMode.value}
        ref={leftBtnRef}
      >
        <Slot name="leftButton" />
      </div>
      <div
        class="bs-button-slot"
        data-side="right"
        data-mode={physicalMode.value}
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
