/** @jsxImportSource solid-js */
import {
  children,
  createSignal,
  createMemo,
  createEffect,
  on,
  onCleanup,
  onMount,
  Show,
  untrack,
  type JSX,
} from "solid-js";
import { BottomSheetEngine } from "../core/BottomSheetEngine";
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
import { closedSnapId, syncOpen } from "../core/primitives/open-state";
import { startsClosed } from "../core/primitives/snap-points";
import type {
  EngineOptions,
  EngineState,
  PhysicalSheetMode,
  SheetEventMap,
  SnapPointDef,
  SheetMode,
} from "../core/types";

export type BottomSheetProps<TId extends string = string> = Omit<
  Partial<EngineConfig>,
  "snapPoints" | "allowed" | "initial"
> & {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  teleport?: boolean;
  teleportTo?: TeleportTarget;
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
  handleLabel?: string;
  contentLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSnap?: (id: TId) => void;
  onBeforeSnap?: (payload: SheetEventMap["before-snap"]) => void;
  onBeforeClose?: (payload: SheetEventMap["before-close"]) => void;
  onOpen?: (id: TId) => void;
  onClose?: () => void;
  onOpened?: (id: TId) => void;
  onClosed?: () => void;
  onDragStart?: (payload: SheetEventMap["dragstart"]) => void;
  onDragEnd?: (payload: SheetEventMap["dragend"]) => void;
  onDrag?: (payload: SheetEventMap["drag"]) => void;
  onProgress?: (payload: SheetEventMap["progress"]) => void;
  onChange?: (state: EngineState & { activeId: TId }) => void;
  engineRef?: (engine: BottomSheetEngine | null) => void;
  header?: JSX.Element;
  footer?: JSX.Element;
  leftButton?: JSX.Element;
  rightButton?: JSX.Element;
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

  const initialSnap = (): TId | undefined =>
    props.initial ??
    (props.open === false
      ? (closedSnapId(props.snapPoints) as TId | undefined)
      : undefined);
  const initialActive = (): TId =>
    (initialSnap() ?? props.snapPoints[0]?.id ?? "default") as TId;

  const [state, setState] = createSignal<EngineState & { activeId: TId }>({
    size: 0,
    activeId: initialActive(),
    phase: "closed",
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });

  let engine: BottomSheetEngine | null = null;
  let restoreTeleport: (() => void) | null = null;
  const [physicalMode, setPhysicalMode] = createSignal<PhysicalSheetMode>(
    guessPhysicalMode(untrack(() => props.mode)),
  );
  const restAtStart = untrack(() =>
    startsClosed(props.snapPoints, initialSnap(), props.allowed)
      ? "closed"
      : undefined,
  );

  onMount(() => {
    if (!sheetEl) return;

    const engineOpts: EngineOptions = {
      ...pickEngineOptions(props as unknown as Record<string, unknown>),
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: props.backdrop !== false ? backdropEl : undefined,
      scrim: scrimEl,
      mode: props.mode ?? "bottom",
      snapPoints: props.snapPoints as unknown as SnapPointDef[],
      initial: initialSnap(),
    };

    const teleportTarget =
      props.teleport === false ? null : resolveTeleportTarget(props.teleportTo);
    if (teleportTarget) {
      restoreTeleport = teleportElements(
        [backdropEl, scrimEl, sheetEl],
        teleportTarget,
      );
    }

    engine = new BottomSheetEngine(engineOpts);
    setPhysicalMode(engine.getMode());
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
    engine.on("before-snap", payload => props.onBeforeSnap?.(payload));
    engine.on("before-close", payload => props.onBeforeClose?.(payload));
    engine.on("open", payload => {
      props.onOpen?.(payload.id as TId);
      props.onOpenChange?.(true);
    });
    engine.on("close", () => {
      props.onClose?.();
      props.onOpenChange?.(false);
    });
    if (props.open !== undefined) syncOpen(engine, props.open);
    engine.on("opened", payload => props.onOpened?.(payload.id as TId));
    engine.on("closed", () => props.onClosed?.());
    engine.on("dragstart", payload => {
      sync();
      props.onDragStart?.(payload);
    });
    engine.on("dragend", payload => {
      sync();
      props.onDragEnd?.(payload);
    });
    if (props.onDrag) engine.on("drag", payload => props.onDrag?.(payload));
    if (props.onProgress) {
      engine.on("progress", payload => props.onProgress?.(payload));
    }

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
    restoreTeleport?.();
    restoreTeleport = null;
    engine?.destroy();
    engine = null;
    props.engineRef?.(null);
  });

  createEffect(
    on(
      () => props.snapPoints,
      points => {
        engine?.setSnapPoints(
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
      allowed => {
        if (allowed) engine?.setAllowed(allowed as unknown as string[]);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.open,
      value => {
        if (value !== undefined && engine) syncOpen(engine, value);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.persistent,
      value => engine?.setPersistent(value ?? false),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.disableClose,
      value => engine?.setDisableClose(value ?? false),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.disableDrag,
      value => engine?.setDisableDrag(value ?? false),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.dragFromContent,
      value => engine?.setDragFromContent(value ?? true),
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.dragFrom,
      value => {
        if (value !== undefined) engine?.setDragFrom(value);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.radius,
      value => {
        if (value !== undefined) engine?.setRadius(value);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.maxHeight,
      value => {
        if (value !== undefined) engine?.setMaxHeight(value);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.mode,
      value => {
        const next = value ?? "bottom";
        engine?.setMode(next);
        setPhysicalMode(engine ? engine.getMode() : guessPhysicalMode(next));
      },
      { defer: true },
    ),
  );

  const showBackdrop = createMemo(() => props.backdrop !== false);
  const ariaLabel = createMemo(() => props.ariaLabel ?? "Bottom sheet");
  const header = children(() => props.header);
  const footer = children(() => props.footer);
  const leftButton = children(() => props.leftButton);
  const rightButton = children(() => props.rightButton);

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
        data-mode={physicalMode()}
        data-bs-rest={restAtStart}
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
          aria-label={props.handleLabel ?? "Resize sheet"}
        />
        <Show when={header()}>
          <div class="bs-header">{header()}</div>
        </Show>
        <div
          class="bs-content"
          ref={el => (contentEl = el)}
          tabIndex={0}
          role="region"
          aria-label={props.contentLabel ?? "Sheet content"}
        >
          {props.children}
        </div>
        <Show when={footer()}>
          <div class="bs-footer">{footer()}</div>
        </Show>
        <span class="bs-sr-only" role="status" aria-live="polite">
          {state().activeId}
        </span>
      </section>
      <Show when={leftButton()}>
        <div class="bs-button-slot" data-side="left" data-mode={physicalMode()}>
          {leftButton()}
        </div>
      </Show>
      <Show when={rightButton()}>
        <div
          class="bs-button-slot"
          data-side="right"
          data-mode={physicalMode()}
        >
          {rightButton()}
        </div>
      </Show>
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
