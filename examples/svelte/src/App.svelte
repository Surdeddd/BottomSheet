<script lang="ts">
  import { BottomSheet } from "@surdeddd/bottom-sheet/svelte";
  import "@surdeddd/bottom-sheet/styles";

  // Three snap points: peek (96px), half-screen, near-full.
  const snapPoints = [
    { id: "minimized", size: 96 },
    { id: "half", size: "45dvh" },
    { id: "full", size: "85%" },
  ];

  const rows = Array.from({ length: 12 }, (_, i) => i + 1);
</script>

<div class="page">
  <h1>Svelte 5 example</h1>
  <p>Drag the handle to expand the sheet.</p>

  <BottomSheet
    {snapPoints}
    initial="minimized"
    animation="spring"
    spring={{ stiffness: 260, damping: 28 }}
    focusTrap
    closeOnEscape
  >
    {#snippet header()}
      <h2 style="margin: 0; padding: 12px 20px">Search vehicles</h2>
    {/snippet}
    <ul class="sheet-list">
      {#each rows as i}
        <li>Item #{i}</li>
      {/each}
    </ul>
  </BottomSheet>
</div>
