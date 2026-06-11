<script lang="ts" generics="TId extends string = string">
  import { onMount, onDestroy, untrack, type Snippet } from "svelte";
  import { BottomSheetEngine } from "../core/BottomSheetEngine";
  import type {
    EngineState,
    SnapPointDef,
    SheetMode,
    ScrimUpdate,
    ScrimOverlayOptions,
    EngineOptions,
  } from "../core/types";

  type Props = {
    snapPoints: SnapPointDef<TId>[];
    allowed?: TId[];
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
    header?: Snippet<[EngineState & { activeId: TId }]>;
    leftButton?: Snippet;
    rightButton?: Snippet;
    screen?: Snippet;
    children?: Snippet;
    onsnap?: (id: TId) => void;
    onopen?: (id: TId) => void;
    onclose?: () => void;
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
    ariaLabel = "Bottom sheet",
    header,
    leftButton,
    rightButton,
    screen,
    children,
    onsnap,
    onopen,
    onclose,
    onchange,
  }: Props = $props();

  let sheetEl: HTMLElement | undefined = $state();
  let handleEl: HTMLElement | undefined = $state();
  let contentEl: HTMLElement | undefined = $state();
  let backdropEl: HTMLElement | undefined = $state();
  let screenEl: HTMLElement | undefined = $state();

  let viewState: EngineState & { activeId: TId } = $state({
    size: 0,
    activeId: untrack(
      () => (initial ?? snapPoints[0]?.id ?? "default") as TId,
    ),
    isDragging: false,
    isAnimating: false,
    progress: 0,
  });

  let engine: BottomSheetEngine | null = null;

  onMount(() => {
    if (!sheetEl) return;
    engine = new BottomSheetEngine({
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
      scrim: screenEl,
      mode,
      snapPoints,
      allowed,
      initial,
      animation,
      spring,
      focusTrap,
      closeOnEscape,
      closeOnBack,
      lockBodyScroll,
      rubberBand,
      backdropRange,
    });
    const sync = () => {
      if (!engine) return;
      viewState = { ...engine.state } as EngineState & { activeId: TId };
      onchange?.(viewState);
    };
    sync();
    engine.on("snap", payload => {
      sync();
      onsnap?.(payload.id as TId);
    });
    engine.on("open", payload => onopen?.(payload.id as TId));
    engine.on("close", () => onclose?.());
    engine.on("dragstart", sync);
    engine.on("dragend", sync);
  });

  onDestroy(() => {
    engine?.destroy();
    engine = null;
  });

  export const snapTo = (id: TId) =>
    engine?.snapTo(id) ?? Promise.resolve();
  export const open = (id?: TId) =>
    engine?.open(id) ?? Promise.resolve();
  export const close = () => engine?.close() ?? Promise.resolve();
  export const setAllowed = (ids: TId[], snap?: TId) =>
    engine?.setAllowed(ids as unknown as string[], snap);
  export const setSnapPoints = (
    points: EngineOptions["snapPoints"],
    nextAllowed?: string[],
  ) => engine?.setSnapPoints(points, nextAllowed);
  export const setScrim = (opts: ScrimUpdate) => engine?.setScrim(opts);
  export const setScrimOverlay = (opts: ScrimOverlayOptions): (() => void) =>
    engine?.setScrimOverlay(opts) ?? (() => {});
  export const getState = (): EngineState & { activeId: TId } =>
    (engine?.state ?? viewState) as EngineState & { activeId: TId };
  export const getEngine = (): BottomSheetEngine | null => engine;

  let allowedIds = $derived(
    allowed && allowed.length > 0
      ? allowed
      : snapPoints.map(s => s.id),
  );
  let activeIdx = $derived(allowedIds.indexOf(viewState.activeId));
  let isVerticalAxis = $derived(mode === "bottom" || mode === "top");
</script>

<div class="bs-root">
  {#if backdrop}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bs-backdrop"
      bind:this={backdropEl}
      aria-hidden="true"
      onclick={closeOnBackdrop ? () => engine?.close() : undefined}
    ></div>
  {/if}
  <div class="bs-screen" bind:this={screenEl}>
    {#if screen}{@render screen()}{/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    class="bs-sheet"
    bind:this={sheetEl}
    data-mode={mode}
    data-active={viewState.activeId}
    role="dialog"
    aria-modal={focusTrap ? "true" : undefined}
    aria-label={ariaLabel}
  >
    {#if leftButton}
      <div class="bs-button-slot" data-side="left">
        {@render leftButton()}
      </div>
    {/if}
    {#if rightButton}
      <div class="bs-button-slot" data-side="right">
        {@render rightButton()}
      </div>
    {/if}
    <div
      class="bs-handle"
      bind:this={handleEl}
      role="slider"
      tabindex="0"
      aria-label="Resize sheet"
      aria-orientation={isVerticalAxis ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, allowedIds.length - 1)}
      aria-valuenow={Math.max(0, activeIdx)}
      aria-valuetext={viewState.activeId}
    >
      {#if header}{@render header(viewState)}{/if}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="bs-content" bind:this={contentEl} tabindex="0" role="region" aria-label="Sheet content">
      {#if children}{@render children()}{/if}
    </div>
    <span class="bs-sr-only" role="status" aria-live="polite">
      {viewState.activeId}
    </span>
  </section>
</div>
