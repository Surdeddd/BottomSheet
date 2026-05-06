<script lang="ts">
  import BottomSheet from "../../src/svelte/BottomSheet.svelte";
  import type { EngineState, SheetMode, SnapPointDef } from "../../src/core/types";

  type Props = {
    snapPoints: SnapPointDef[];
    allowed: string[];
    initial: string;
    mode: SheetMode;
    spring: { stiffness: number; damping: number };
    focusTrap: boolean;
    closeOnEscape: boolean;
    rubberBand: boolean;
    rows: Array<[string, string]>;
    onstate?: (s: EngineState) => void;
  };

  let {
    snapPoints: snaps,
    allowed,
    initial,
    mode,
    spring,
    focusTrap,
    closeOnEscape,
    rubberBand,
    rows,
    onstate,
  }: Props = $props();

  // Imperative handle to the underlying BottomSheet SFC.
  let sheet = $state<{
    snapTo: (id: string) => Promise<void>;
    getState: () => EngineState;
  } | undefined>();

  // Re-export the slice the demo orchestrator polls. Returning `undefined`
  // before mount is intentional — the polling loop guards on null.
  export const snapTo = (id: string): Promise<void> =>
    sheet?.snapTo(id) ?? Promise.resolve();
  export const getState = (): EngineState | undefined => sheet?.getState();
</script>

<BottomSheet
  bind:this={sheet}
  snapPoints={snaps}
  {allowed}
  {initial}
  {mode}
  animation="spring"
  {spring}
  {focusTrap}
  {closeOnEscape}
  {rubberBand}
  backdropRange={[0.4, 1]}
  lockBodyScroll={false}
  onchange={onstate}
>
  {#snippet header()}
    <div class="sheet-header">
      <h2>Active routes</h2>
      <span class="hint">SVELTE 5 · RUNES</span>
    </div>
  {/snippet}
  <div class="sheet-list">
    {#each rows as [title, sub]}
      <div class="sheet-item">
        <div class="sheet-item-dot"></div>
        <div class="sheet-item-text">
          <strong>{title}</strong>
          <span>{sub}</span>
        </div>
      </div>
    {/each}
  </div>
</BottomSheet>
