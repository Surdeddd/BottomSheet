<script lang="ts" generics="TId extends string = string">
  import { onMount, onDestroy, untrack, type Snippet } from "svelte";
  import { BottomSheetEngine } from "../core/BottomSheetEngine";
  import {
    resolveTeleportTarget,
    teleportElements,
    type TeleportTarget,
  } from "../core/features/teleport";
  import { guessPhysicalMode } from "../core/primitives/logical-mode";
  import { startsClosed } from "../core/primitives/snap-points";
  import { closedSnapId } from "../core/primitives/open-state";
  import type { AnchorOptions } from "../core/features/sheet-anchors";
  import type { ScrimStagesOptions } from "../core/features/scrim-stages";
  import type {
    CloseReason,
    EngineState,
    PhysicalSheetMode,
    SnapPointDef,
    ScrimUpdate,
    ScrimOverlayOptions,
    EngineOptions,
    SheetEventMap,
  } from "../core/types";

  type Props = Omit<
    Partial<EngineOptions>,
    | "element"
    | "handle"
    | "scrollContainer"
    | "backdrop"
    | "scrim"
    | "screenComponent"
    | "snapPoints"
    | "allowed"
    | "initial"
  > & {
    snapPoints: SnapPointDef<TId>[];
    allowed?: TId[];
    initial?: TId;
    backdrop?: boolean;
    closeOnBackdrop?: boolean;
    teleport?: boolean;
    teleportTo?: TeleportTarget;
    backdropColor?: string;
    backdropOpacity?: number;
    open?: boolean;
    snap?: TId;
    ariaLabel?: string;
    handleLabel?: string;
    contentLabel?: string;
    header?: Snippet<[EngineState & { activeId: TId }]>;
    footer?: Snippet<[EngineState & { activeId: TId }]>;
    leftButton?: Snippet;
    rightButton?: Snippet;
    screen?: Snippet;
    children?: Snippet;
    onsnap?: (id: TId) => void;
    onbeforesnap?: (payload: SheetEventMap["before-snap"]) => void;
    onopen?: (id: TId) => void;
    onclose?: () => void;
    onbeforeclose?: (payload: SheetEventMap["before-close"]) => void;
    onopened?: (id: TId) => void;
    onclosed?: () => void;
    ondragstart?: (payload: SheetEventMap["dragstart"]) => void;
    ondragend?: (payload: SheetEventMap["dragend"]) => void;
    ondrag?: (payload: SheetEventMap["drag"]) => void;
    onprogress?: (payload: SheetEventMap["progress"]) => void;
    onchange?: (state: EngineState & { activeId: TId }) => void;
  };

  let {
    snapPoints,
    allowed,
    initial,
    mode = "bottom",
    animation = "spring",
    spring,
    focusTrap = false,
    closeOnEscape = true,
    closeOnBack = false,
    lockBodyScroll = true,
    rubberBand = true,
    backdropRange,
    backdrop = true,
    closeOnBackdrop = true,
    persistent = false,
    disableClose = false,
    disableDrag = false,
    dragFrom,
    dragFromContent,
    fitContentToSnap,
    closeOnRouteChange = false,
    stackEffect = false,
    teleport = false,
    teleportTo,
    radius,
    maxHeight,
    backdropColor,
    backdropOpacity,
    open: openProp = $bindable(),
    snap = $bindable(),
    returnFocusTo,
    ariaLabel = "Bottom sheet",
    handleLabel = "Resize sheet",
    contentLabel = "Sheet content",
    header,
    footer,
    leftButton,
    rightButton,
    screen,
    children,
    onsnap,
    onbeforesnap,
    onopen,
    onclose,
    onbeforeclose,
    onopened,
    onclosed,
    ondragstart,
    ondragend,
    ondrag,
    onprogress,
    onchange,
    ...engineRest
  }: Props = $props();

  let sheetEl: HTMLElement | undefined = $state();
  let handleEl: HTMLElement | undefined = $state();
  let contentEl: HTMLElement | undefined = $state();
  let backdropEl: HTMLElement | undefined = $state();
  let screenEl: HTMLElement | undefined = $state();

  const startAt = untrack(
    () =>
      initial ??
      (openProp === false
        ? (closedSnapId(snapPoints) as TId | undefined)
        : undefined) ??
      snap,
  );

  let viewState: EngineState & { activeId: TId } = $state({
    size: 0,
    activeId: untrack(
      () => (startAt ?? snapPoints[0]?.id ?? "default") as TId,
    ),
    phase: "closed",
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });

  let engine: BottomSheetEngine | null = null;
  let restoreTeleport: (() => void) | null = null;
  let physicalMode: PhysicalSheetMode = $state(
    untrack(() => guessPhysicalMode(mode)),
  );
  const restAtStart = untrack(() =>
    startsClosed(snapPoints, startAt, allowed) ? "closed" : undefined,
  );

  onMount(() => {
    if (!sheetEl) return;
    const teleportTarget =
      teleport === false ? null : resolveTeleportTarget(teleportTo);
    if (teleportTarget) {
      restoreTeleport = teleportElements(
        [backdropEl, screenEl, sheetEl],
        teleportTarget,
      );
    }
    engine = new BottomSheetEngine({
      ...engineRest,
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
      scrim: screenEl,
      mode,
      snapPoints,
      allowed,
      initial: startAt,
      animation,
      spring,
      focusTrap,
      closeOnEscape,
      closeOnBack,
      lockBodyScroll,
      rubberBand,
      backdropRange,
      persistent,
      disableClose,
      disableDrag,
      dragFrom,
      dragFromContent,
      fitContentToSnap,
      closeOnRouteChange,
      stackEffect,
      radius,
      maxHeight,
      returnFocusTo,
      backdropColor,
      backdropOpacity,
    });
    const sync = () => {
      if (!engine) return;
      viewState = { ...engine.state } as EngineState & { activeId: TId };
      onchange?.(viewState);
    };
    physicalMode = engine.getMode();
    sync();
    if (snap !== undefined && snap !== engine.state.activeId) {
      snap = engine.state.activeId as TId;
    }
    engine.on("snap", payload => {
      sync();
      snap = payload.id as TId;
      onsnap?.(payload.id as TId);
    });
    engine.on("open", payload => {
      sync();
      openProp = true;
      onopen?.(payload.id as TId);
    });
    engine.on("close", () => {
      sync();
      openProp = false;
      onclose?.();
    });
    engine.on("before-close", payload => onbeforeclose?.(payload));
    engine.on("before-snap", payload => onbeforesnap?.(payload));
    engine.on("opened", payload => {
      sync();
      onopened?.(payload.id as TId);
    });
    engine.on("closed", () => {
      sync();
      onclosed?.();
    });
    engine.on("dragstart", payload => {
      sync();
      ondragstart?.(payload);
    });
    engine.on("dragend", payload => {
      sync();
      ondragend?.(payload);
    });
    if (ondrag) engine.on("drag", payload => ondrag(payload));
    if (onprogress) engine.on("progress", payload => onprogress(payload));
  });

  onDestroy(() => {
    restoreTeleport?.();
    restoreTeleport = null;
    engine?.destroy();
    engine = null;
  });

  export const snapTo = (id: TId) =>
    engine?.snapTo(id) ?? Promise.resolve();
  export const open = (id?: TId) =>
    engine?.open(id) ?? Promise.resolve();
  export const close = (reason?: CloseReason) =>
    engine?.close(reason) ?? Promise.resolve();
  export const expand = () => engine?.expand() ?? Promise.resolve();
  export const collapse = () => engine?.collapse() ?? Promise.resolve();
  export const isTop = (): boolean => engine?.isTop() ?? false;
  export const depth = (): number => engine?.depth() ?? 0;
  export const setAllowed = (ids: TId[], snap?: TId) =>
    engine?.setAllowed(ids as unknown as string[], snap);
  export const setSnapPoints = (
    points: EngineOptions["snapPoints"],
    nextAllowed?: string[],
  ) => engine?.setSnapPoints(points, nextAllowed);
  export const setScrim = (opts: ScrimUpdate) => engine?.setScrim(opts);
  export const setScrimOverlay = (opts: ScrimOverlayOptions): (() => void) =>
    engine?.setScrimOverlay(opts) ?? (() => {});
  export const addAnchor = (opts: AnchorOptions): (() => void) =>
    engine?.addAnchor(opts) ?? (() => {});
  export const setScrimStages = (
    opts: ScrimStagesOptions | null,
  ): (() => void) => engine?.setScrimStages(opts) ?? (() => {});
  export const recompute = () => engine?.recompute();
  export const setRadius = (r: string | number) => engine?.setRadius(r);
  export const setMaxHeight = (h: string | number) => engine?.setMaxHeight(h);
  export const canDismiss = (): boolean => engine?.canDismiss() ?? false;
  export const getState = (): EngineState & { activeId: TId } =>
    (engine?.state ?? viewState) as EngineState & { activeId: TId };
  export const getEngine = (): BottomSheetEngine | null => engine;

  let snapDefApplied = false;
  $effect(() => {
    const points = snapPoints;
    if (!snapDefApplied) {
      snapDefApplied = true;
      return;
    }
    engine?.setSnapPoints(
      points as unknown as EngineOptions["snapPoints"],
      untrack(() => allowed) as unknown as string[] | undefined,
    );
  });
  let allowedApplied = false;
  $effect(() => {
    const ids = allowed;
    if (!allowedApplied) {
      allowedApplied = true;
      return;
    }
    if (ids) engine?.setAllowed(ids as unknown as string[]);
  });
  $effect(() => {
    engine?.setPersistent(persistent);
  });
  $effect(() => {
    engine?.setDisableClose(disableClose);
  });
  $effect(() => {
    engine?.setDisableDrag(disableDrag);
  });
  $effect(() => {
    if (dragFromContent !== undefined) {
      engine?.setDragFromContent(dragFromContent);
    }
  });
  $effect(() => {
    if (dragFrom !== undefined) engine?.setDragFrom(dragFrom);
  });
  $effect(() => {
    const next = mode;
    if (next !== undefined) engine?.setMode(next);
    physicalMode = engine ? engine.getMode() : guessPhysicalMode(next);
  });
  $effect(() => {
    if (radius !== undefined) engine?.setRadius(radius);
  });
  $effect(() => {
    if (maxHeight !== undefined) engine?.setMaxHeight(maxHeight);
  });
  $effect(() => {
    if (backdropColor !== undefined) engine?.setBackdropColor(backdropColor);
  });
  $effect(() => {
    if (backdropOpacity !== undefined)
      engine?.setBackdropOpacity(backdropOpacity);
  });
  $effect(() => {
    if (snap === undefined) return;
    const next = snap;
    if (!engine || engine.state.activeId === next) return;
    void engine.snapTo(next);
  });
  $effect(() => {
    if (openProp === undefined) return;
    const next = openProp;
    if (!engine) return;
    const phase = engine.state.phase;
    const opening = phase === "open" || phase === "opening";
    if (next && !opening) void engine.open();
    else if (!next && opening) void engine.close();
  });

  let isVerticalAxis = $derived(
    physicalMode === "bottom" || physicalMode === "top",
  );
</script>

<div class="bs-root">
  {#if backdrop}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bs-backdrop"
      bind:this={backdropEl}
      aria-hidden="true"
      onclick={closeOnBackdrop
        ? () => {
            if (engine?.canDismiss()) void engine.close("backdrop");
          }
        : undefined}
    ></div>
  {/if}
  <div class="bs-screen" bind:this={screenEl}>
    {#if screen}{@render screen()}{/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    class="bs-sheet"
    bind:this={sheetEl}
    data-mode={physicalMode}
    data-bs-rest={restAtStart}
    data-active={viewState.activeId}
    role="dialog"
    aria-modal={focusTrap ? "true" : undefined}
    aria-label={ariaLabel}
  >
    <div
      class="bs-handle"
      bind:this={handleEl}
      role="slider"
      tabindex="0"
      aria-label={handleLabel}
      aria-orientation={isVerticalAxis ? "vertical" : "horizontal"}
      aria-valuemin="0"
      aria-valuemax="0"
      aria-valuenow="0"
    ></div>
    {#if header}<div class="bs-header">{@render header(viewState)}</div>{/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="bs-content" bind:this={contentEl} tabindex="0" role="region" aria-label={contentLabel}>
      {#if children}{@render children()}{/if}
    </div>
    {#if footer}<div class="bs-footer">{@render footer(viewState)}</div>{/if}
    <span class="bs-sr-only" role="status" aria-live="polite">
      {viewState.activeId}
    </span>
  </section>
  {#if leftButton}
    <div class="bs-button-slot" data-side="left" data-mode={physicalMode}>
      {@render leftButton()}
    </div>
  {/if}
  {#if rightButton}
    <div class="bs-button-slot" data-side="right" data-mode={physicalMode}>
      {@render rightButton()}
    </div>
  {/if}
</div>
