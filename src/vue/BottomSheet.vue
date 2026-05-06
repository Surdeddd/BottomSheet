<script setup lang="ts" generic="TId extends string = string">
import { computed, readonly, watch } from "vue";
import { useBottomSheet, type UseBottomSheetVueOptions } from "./useBottomSheet";
import type { EngineState } from "../core/types";

type Props = UseBottomSheetVueOptions<TId> & {
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
};

const props = withDefaults(defineProps<Props>(), {
  backdrop: true,
  closeOnBackdrop: true,
  ariaLabel: "Bottom sheet",
});

const emit = defineEmits<{
  change: [state: EngineState & { activeId: TId }];
  snap: [id: TId];
  open: [id: TId];
  close: [];
}>();

const {
  sheetRef,
  handleRef,
  contentRef,
  backdropRef,
  screenRef,
  state,
  snapTo,
  open,
  close,
  setAllowed,
  setSnapPoints,
  on,
} = useBottomSheet<TId>(props);

watch(
  () => ({ ...state }),
  next => emit("change", next as EngineState & { activeId: TId }),
  { deep: false },
);

on("snap", payload => emit("snap", payload.id as TId));
on("open", payload => emit("open", payload.id as TId));
on("close", () => emit("close"));

const isVerticalAxis = computed(() => {
  const mode = props.mode ?? "bottom";
  return mode === "bottom" || mode === "top";
});
const allowedIds = computed(
  () => props.allowed ?? props.snapPoints.map(p => p.id),
);
const activeIdx = computed(() => {
  const idx = (allowedIds.value as ReadonlyArray<string>).indexOf(
    state.activeId,
  );
  return idx === -1 ? 0 : idx;
});
const ariaModal = computed(() => props.focusTrap === true);

defineExpose({
  snapTo,
  open,
  close,
  setAllowed,
  setSnapPoints,
  on,
  // readonly() prevents external write-through (e.g. `bsRef.value.state.size = 999`)
  // that would desync the local view-state proxy from the engine's truth.
  // Mirrors React's getter-based exposure and Svelte's getState() snapshot.
  state: readonly(state),
});
</script>

<template>
  <div class="bs-root">
    <div
      v-if="backdrop"
      ref="backdropRef"
      class="bs-backdrop"
      aria-hidden="true"
      @click="closeOnBackdrop ? close() : undefined"
    />
    <div v-if="$slots.screen" ref="screenRef" class="bs-screen">
      <slot name="screen" />
    </div>
    <section
      ref="sheetRef"
      :class="['bs-sheet']"
      :data-mode="props.mode ?? 'bottom'"
      :data-active="state.activeId"
      :role="ariaModal ? 'dialog' : 'region'"
      :aria-modal="ariaModal ? 'true' : undefined"
      :aria-label="ariaLabel"
    >
      <div v-if="$slots['button-left']" class="bs-button-slot" data-side="left">
        <slot name="button-left" />
      </div>
      <div
        v-if="$slots['button-right']"
        class="bs-button-slot"
        data-side="right"
      >
        <slot name="button-right" />
      </div>
      <div
        ref="handleRef"
        class="bs-handle"
        role="slider"
        tabindex="0"
        :aria-orientation="isVerticalAxis ? 'vertical' : 'horizontal'"
        aria-valuemin="0"
        :aria-valuemax="Math.max(0, allowedIds.length - 1)"
        :aria-valuenow="activeIdx"
        :aria-valuetext="state.activeId"
        aria-label="Resize sheet"
      >
        <slot name="header" :state="state" />
      </div>
      <div
        ref="contentRef"
        class="bs-content"
        tabindex="0"
        role="region"
        aria-label="Sheet content"
      >
        <slot />
      </div>
      <span class="bs-sr-only" role="status" aria-live="polite">
        {{ state.activeId }}
      </span>
    </section>
  </div>
</template>
