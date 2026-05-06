<script lang="ts" generics="TId extends string = string">
  import { onMount, onDestroy, type Snippet } from "svelte";
  import { BottomSheetEngine } from "../core/BottomSheetEngine";
  import type {
    EngineState,
    SnapPointDef,
    SheetMode,
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
    /**
     * Header snippet. Receives the live `EngineState` so consumers can
     * render different markup per snap (e.g. minimized vs full):
     *
     *   {#snippet header(state)}
     *     {#if state.activeId === "min"}<span>title</span>{:else}<h2>full</h2>{/if}
     *   {/snippet}
     *
     * Snippets that ignore the argument keep working unchanged.
     */
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

  // svelte-ignore state_referenced_locally
  // initial seed only; engine owns activeId after onMount.
  let viewState: EngineState & { activeId: TId } = $state({
    size: 0,
    activeId: (initial ?? snapPoints[0]?.id ?? "default") as TId,
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
      screenComponent: screenEl,
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
  export const getState = (): EngineState & { activeId: TId } =>
    (engine?.state ?? viewState) as EngineState & { activeId: TId };
</script>

<div class="bs-root">
  {#if backdrop}
    <!-- The backdrop is a pointer-only target; keyboard users dismiss the
         sheet via Escape (handled by the engine's `closeOnEscape`). Marking
         it `aria-hidden` keeps SR users from hearing a stray "button". -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bs-backdrop"
      bind:this={backdropEl}
      aria-hidden="true"
      onclick={closeOnBackdrop ? () => engine?.close() : undefined}
    ></div>
  {/if}
  {#if screen}
    <div class="bs-screen" bind:this={screenEl}>
      {@render screen()}
    </div>
  {/if}
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
      aria-valuemin="0"
      aria-valuemax="0"
      aria-valuenow="0"
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
