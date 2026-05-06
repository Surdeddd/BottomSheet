<script setup lang="ts">
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";
import "@surdeddd/bottom-sheet/styles";

// Three snap points: peek (96px), half-screen, near-full.
const snapPoints = [
  { id: "minimized", size: 96 },
  { id: "half", size: "45dvh" },
  { id: "full", size: "85%" },
];
</script>

<template>
  <div class="page">
    <h1>Vue 3 example</h1>
    <p>Drag the handle to expand the sheet.</p>

    <BottomSheet
      :snap-points="snapPoints"
      initial="minimized"
      animation="spring"
      :spring="{ stiffness: 260, damping: 28 }"
      focus-trap
      close-on-escape
    >
      <template #header>
        <h2 style="margin: 0; padding: 12px 20px">Search vehicles</h2>
      </template>
      <ul class="sheet-list">
        <li v-for="i in 12" :key="i">Item #{{ i }}</li>
      </ul>
    </BottomSheet>
  </div>
</template>
