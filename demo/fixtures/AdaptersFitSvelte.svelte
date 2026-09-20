<script lang="ts">
  import BottomSheet from "../../src/svelte/BottomSheet.svelte";
  import { POINTS, ROWS } from "./adapters-fit-shared";

  let sheet: { open: (id: string) => Promise<void>; close: () => Promise<void> };

  export const open = (id: string): Promise<void> => sheet.open(id);
  export const close = (): Promise<void> => sheet.close();
</script>

<BottomSheet
  bind:this={sheet}
  snapPoints={POINTS}
  initial="closed"
  animation="tween"
  lockBodyScroll={false}
  fitContentToSnap
>
  {#snippet footer()}
    <button type="button" data-action="svelte">action</button>
  {/snippet}
  {#each ROWS as i (i)}
    <div class="row" data-row={i} data-owner="svelte">row {i}</div>
  {/each}
</BottomSheet>
