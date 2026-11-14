<script setup lang="ts" generic="TId extends string = string">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  shallowRef,
  watch,
  type TeleportProps,
} from "vue";
import {
  closedSnapId,
  useBottomSheet,
  type UseBottomSheetVueOptions,
} from "./useBottomSheet";
import type { CloseReason, EngineState } from "../core/types";
import type { AnchorOptions } from "../core/features/sheet-anchors";
import type { ScrimStagesOptions } from "../core/features/scrim-stages";

type VueAnchor = Omit<AnchorOptions, "element"> & { id: string };

type Props = Omit<UseBottomSheetVueOptions<TId>, "onSnap"> & {
  backdrop?: boolean;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
  handleLabel?: string;
  contentLabel?: string;
  open?: boolean;
  snap?: TId;
  teleport?: boolean;
  teleportTo?: TeleportProps["to"];
  anchors?: VueAnchor[];
  scrimStages?: ScrimStagesOptions | null;
  backdropColor?: string;
  backdropOpacity?: number;
};

const props = withDefaults(defineProps<Props>(), {
  backdrop: true,
  closeOnBackdrop: true,
  ariaLabel: "Bottom sheet",
  handleLabel: "Resize sheet",
  contentLabel: "Sheet content",
  teleport: true,
  teleportTo: "body",
  open: undefined,
  respectReducedMotion: undefined,
  dragFromContent: undefined,
  fitContentToSnap: undefined,
  rubberBand: undefined,
  scrimInteractive: undefined,
  scrimTapToClose: undefined,
  focusTrap: undefined,
  initialFocus: undefined,
  closeOnEscape: undefined,
  lockBodyScroll: undefined,
  closeOnBack: undefined,
  inertSiblings: undefined,
  persistent: undefined,
  disableClose: undefined,
  disableDrag: undefined,
  closeOnRouteChange: undefined,
  viewTransitions: undefined,
  stackEffect: undefined,
});

const emit = defineEmits<{
  change: [state: EngineState & { activeId: TId }];
  snap: [id: TId];
  open: [id: TId];
  close: [];
  opened: [id: TId];
  closed: [];
  "before-close": [payload: { reason: CloseReason; cancel: () => void }];
  "before-snap": [
    payload: {
      id: TId;
      size: number;
      previousId: string;
      cancel: () => void;
    },
  ];
  "drag-start": [payload: { size: number }];
  "drag-end": [payload: { size: number; velocity: number }];
  drag: [payload: { size: number; delta: number }];
  progress: [payload: { value: number; size: number }];
  "update:open": [open: boolean];
  "update:snap": [id: TId];
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
  setScrim,
  setScrimOverlay,
  addAnchor,
  setScrimStages,
  recompute,
  setScrimColor,
  setBackdropRange,
  setBackdropOpacity,
  setBackdropColor,
  setRadius,
  setMaxHeight,
  expand,
  collapse,
  isTop,
  depth,
  canDismiss,
  on,
  getEngine,
  physicalMode,
  restAtStart,
  setMode,
} = useBottomSheet<TId>({
  ...props,
  initial:
    props.initial ??
    (props.open === false
      ? (closedSnapId(props.snapPoints) as TId | undefined)
      : undefined) ??
    props.snap,
  teleport: false,
});

watch(
  () => ({ ...state }),
  next => emit("change", next as EngineState & { activeId: TId }),
  { deep: false },
);

on("snap", payload => {
  emit("snap", payload.id as TId);
  emit("update:snap", payload.id as TId);
});
on("open", payload => {
  emit("open", payload.id as TId);
  emit("update:open", true);
});
on("close", () => {
  emit("close");
  emit("update:open", false);
});
on("opened", payload => emit("opened", payload.id as TId));
on("closed", () => emit("closed"));
on("before-close", payload => emit("before-close", payload));
on("before-snap", payload =>
  emit("before-snap", {
    id: payload.id as TId,
    size: payload.size,
    previousId: payload.previousId,
    cancel: payload.cancel,
  }),
);
on("dragstart", payload => emit("drag-start", payload));
on("dragend", payload => emit("drag-end", payload));
on("drag", payload => emit("drag", payload));
on("progress", payload => emit("progress", payload));

const isOpening = (): boolean => {
  const phase = getEngine()?.state.phase ?? "closed";
  return phase === "open" || phase === "opening";
};

watch(
  () => props.open,
  next => {
    if (next === undefined) return;
    if (next && !isOpening()) void open();
    else if (!next && isOpening()) void close();
  },
);

watch(
  () => props.snap,
  next => {
    if (next === undefined) return;
    if (next === (getEngine()?.state.activeId ?? state.activeId)) return;
    void snapTo(next);
  },
);

watch(
  () => JSON.stringify(props.snapPoints),
  () => {
    setSnapPoints(
      props.snapPoints as unknown as Parameters<typeof setSnapPoints>[0],
      props.allowed as unknown as string[] | undefined,
    );
  },
);

watch(
  () => props.allowed,
  next => {
    if (!next) return;
    setAllowed(Array.from(next) as Parameters<typeof setAllowed>[0]);
  },
);

watch(
  () => props.backdropColor,
  next => {
    if (next === undefined) return;
    setBackdropColor(next);
  },
);

watch(
  () => props.backdropOpacity,
  next => {
    if (next === undefined) return;
    setBackdropOpacity(next);
  },
);

watch(
  () => props.radius,
  next => {
    if (next === undefined) return;
    setRadius(next);
  },
);

watch(
  () => props.maxHeight,
  next => {
    if (next === undefined) return;
    setMaxHeight(next);
  },
);

watch(
  () => props.persistent,
  next => {
    if (next === undefined) return;
    getEngine()?.setPersistent(next);
  },
);

watch(
  () => props.disableClose,
  next => {
    if (next === undefined) return;
    getEngine()?.setDisableClose(next);
  },
);

watch(
  () => props.disableDrag,
  next => {
    if (next === undefined) return;
    getEngine()?.setDisableDrag(next);
  },
);

watch(
  () => props.dragFromContent,
  next => {
    if (next === undefined) return;
    getEngine()?.setDragFromContent(next);
  },
);

watch(
  () => props.dragFrom,
  next => {
    if (next === undefined) return;
    getEngine()?.setDragFrom(next);
  },
);

watch(
  () => props.mode,
  next => {
    if (next !== undefined) setMode(next);
  },
);

const mounted = ref(false);
const anchorHosts = shallowRef<Record<string, HTMLElement>>({});
const anchorDetachers = ref<Array<() => void>>([]);
let stagesDetach: (() => void) | null = null;

const teardownAnchors = (): void => {
  anchorDetachers.value.forEach(d => d());
  anchorDetachers.value = [];
  anchorHosts.value = {};
};

const buildAnchors = (): void => {
  teardownAnchors();
  const engine = getEngine();
  if (!engine || !props.anchors?.length) return;
  const hosts: Record<string, HTMLElement> = {};
  const detachers: Array<() => void> = [];
  for (const a of props.anchors) {
    const host = document.createElement("div");
    hosts[a.id] = host;
    const { id: _id, ...rest } = a;
    detachers.push(engine.addAnchor({ ...rest, element: host }));
  }
  anchorHosts.value = hosts;
  anchorDetachers.value = detachers;
};

const anchorsKey = computed(() =>
  JSON.stringify(
    (props.anchors ?? []).map(a => [
      a.id,
      a.position,
      a.inset,
      Array.isArray(a.showOn) ? a.showOn : a.showOn ? "fn" : null,
      a.fadeRange,
      a.interactive,
      typeof a.animation === "string" ? a.animation : a.animation ? "x" : null,
    ]),
  ),
);

const applyStages = (): void => {
  stagesDetach?.();
  stagesDetach = null;
  const engine = getEngine();
  if (!engine || !props.scrimStages) return;
  stagesDetach = engine.setScrimStages(props.scrimStages);
};

onMounted(() => {
  mounted.value = true;
  buildAnchors();
  applyStages();
  watch(anchorsKey, buildAnchors);
  watch(() => props.scrimStages, applyStages, { deep: true });
  if (props.open && !isOpening()) void open();
  const active = getEngine()?.state.activeId;
  if (props.snap !== undefined && active && active !== props.snap) {
    emit("update:snap", active as TId);
  }
});

onBeforeUnmount(() => {
  teardownAnchors();
  stagesDetach?.();
  stagesDetach = null;
});

const isVerticalAxis = computed(
  () => physicalMode.value === "bottom" || physicalMode.value === "top",
);
const ariaModal = computed(() => props.focusTrap === true);

defineExpose({
  snapTo,
  open,
  close,
  setAllowed,
  setSnapPoints,
  setScrim,
  setScrimOverlay,
  addAnchor,
  setScrimStages,
  recompute,
  setScrimColor,
  setBackdropRange,
  setBackdropOpacity,
  setBackdropColor,
  setRadius,
  setMaxHeight,
  expand,
  collapse,
  isTop,
  depth,
  canDismiss,
  on,
  getEngine,
  state: readonly(state),
});
</script>

<template>
  <Teleport :to="teleportTo" :disabled="!teleport || !mounted">
    <div class="bs-root">
      <div
        v-if="backdrop"
        ref="backdropRef"
        class="bs-backdrop"
        aria-hidden="true"
        @click="closeOnBackdrop && canDismiss() ? close('backdrop') : undefined"
      />
      <div ref="screenRef" class="bs-screen">
        <slot name="screen" />
      </div>
      <section
        ref="sheetRef"
        :class="['bs-sheet']"
        :data-mode="physicalMode"
        :data-bs-rest="restAtStart"
        :data-active="state.activeId"
        :role="ariaModal ? 'dialog' : 'region'"
        :aria-modal="ariaModal ? 'true' : undefined"
        :aria-label="ariaLabel"
      >
        <div
          ref="handleRef"
          class="bs-handle"
          role="slider"
          tabindex="0"
          :aria-orientation="isVerticalAxis ? 'vertical' : 'horizontal'"
          :aria-label="handleLabel"
        />
        <div v-if="$slots.header" class="bs-header">
          <slot name="header" :state="state" />
        </div>
        <div
          ref="contentRef"
          class="bs-content"
          tabindex="0"
          role="region"
          :aria-label="contentLabel"
        >
          <slot />
        </div>
        <div v-if="$slots.footer" class="bs-footer">
          <slot name="footer" :state="state" />
        </div>
        <span class="bs-sr-only" role="status" aria-live="polite">
          {{ state.activeId }}
        </span>
      </section>
      <div
        v-if="$slots['button-left']"
        class="bs-button-slot"
        data-side="left"
        :data-mode="physicalMode"
      >
        <slot name="button-left" />
      </div>
      <div
        v-if="$slots['button-right']"
        class="bs-button-slot"
        data-side="right"
        :data-mode="physicalMode"
      >
        <slot name="button-right" />
      </div>
    </div>
    <Teleport
      v-for="a in props.anchors ?? []"
      :key="a.id"
      :to="anchorHosts[a.id]"
      :disabled="!anchorHosts[a.id]"
    >
      <slot :name="`anchor-${a.id}`" :state="state" />
    </Teleport>
  </Teleport>
</template>
