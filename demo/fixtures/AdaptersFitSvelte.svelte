<script lang="ts">
  import BottomSheet from "../../src/svelte/BottomSheet.svelte";
  import { POINTS, ROWS, TRAP } from "./adapters-fit-shared";

  let sheet: { open: (id: string) => Promise<unknown>; close: () => Promise<unknown> };

  export const open = (id: string): Promise<unknown> => sheet.open(id);
  export const close = (): Promise<unknown> => sheet.close();
</script>

<BottomSheet
  bind:this={sheet}
  snapPoints={POINTS}
  initial="closed"
  animation="tween"
  lockBodyScroll={false}
  focusTrap={TRAP}
  fitContentToSnap
>
  {#snippet footer()}
    <button type="button" data-action="svelte">action</button>
  {/snippet}
  {#each ROWS as i (i)}
    <div class="row" data-row={i} data-owner="svelte">row {i}</div>
  {/each}
</BottomSheet>
