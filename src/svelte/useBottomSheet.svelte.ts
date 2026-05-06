/**
 * Svelte 5 helper for `@surdeddd/bottom-sheet`.
 *
 * Designed to be invoked from a Svelte 5 `.svelte` component or `.svelte.ts`
 * module. Returns a controller you wire up via `$effect` / `bind:this` —
 * keeping the helper itself rune-free means it compiles cleanly under plain
 * TypeScript and works with any Svelte 5 build pipeline (Vite, SvelteKit,
 * Astro) without extra configuration.
 *
 * Optionally narrows to a literal-id union `TId` when the consumer pins the
 * call site:
 *
 * ```ts
 * createBottomSheet<"min" | "full">({ snapPoints: [...] });
 * ```
 *
 * Without an explicit type argument `TId` defaults to `string` so existing
 * call sites compile unchanged.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createBottomSheet } from "@surdeddd/bottom-sheet/svelte";
 *   import "@surdeddd/bottom-sheet/styles";
 *
 *   let sheetEl: HTMLElement | undefined = $state();
 *   let handleEl: HTMLElement | undefined = $state();
 *   let contentEl: HTMLElement | undefined = $state();
 *
 *   const ctrl = createBottomSheet({
 *     snapPoints: [{ id: "min", size: 96 }, { id: "full", size: "85%" }],
 *     initial: "min",
 *   });
 *
 *   $effect(() => {
 *     if (!sheetEl) return;
 *     ctrl.attach({ element: sheetEl, handle: handleEl, scrollContainer: contentEl });
 *     return () => ctrl.destroy();
 *   });
 * </script>
 *
 * <section class="bs-sheet" bind:this={sheetEl} data-mode="bottom">
 *   <div class="bs-handle" bind:this={handleEl}>{@render header?.()}</div>
 *   <div class="bs-content" bind:this={contentEl}>{@render children?.()}</div>
 * </section>
 * ```
 */
import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  EngineOptions,
  EngineState,
  SheetEventMap,
  SnapPointDef,
} from "../core/types";

export type SvelteBottomSheetOpts<TId extends string = string> = Omit<
  EngineOptions,
  | "element"
  | "handle"
  | "scrollContainer"
  | "backdrop"
  | "screenComponent"
  | "snapPoints"
  | "allowed"
  | "initial"
> & {
  snapPoints: SnapPointDef<TId>[] | ReadonlyArray<SnapPointDef<TId>>;
  allowed?: TId[] | ReadonlyArray<TId>;
  initial?: TId;
  /** Called after a snap commit settles. Mirrors the engine's `snap` event. */
  onSnap?: (id: TId) => void;
};

export type SvelteAttachRefs = {
  element: HTMLElement;
  handle?: HTMLElement;
  scrollContainer?: HTMLElement;
  backdrop?: HTMLElement;
  screenComponent?: HTMLElement;
};

export type SvelteBottomSheetController<TId extends string = string> = {
  /** Attach to DOM refs and start the engine. Returns a teardown helper. */
  attach: (refs: SvelteAttachRefs) => () => void;
  /** Snapshot of engine state — read inside `$effect` for reactivity. */
  state: () => EngineState & { activeId: TId };
  /** Subscribe to an engine event. Returns an unsubscribe fn. */
  on: <K extends keyof SheetEventMap>(
    event: K,
    fn: (payload: SheetEventMap[K]) => void,
  ) => () => void;
  snapTo: (id: TId) => Promise<void>;
  open: (id?: TId) => Promise<void>;
  close: () => Promise<void>;
  setAllowed: (ids: TId[], snap?: TId) => void;
  destroy: () => void;
};

const SSR_STATE: EngineState = Object.freeze({
  size: 0,
  activeId: "",
  isDragging: false,
  isAnimating: false,
  progress: 0,
});

export function createBottomSheet<TId extends string = string>(
  opts: SvelteBottomSheetOpts<TId>,
): SvelteBottomSheetController<TId> {
  let engine: BottomSheetEngine | null = null;
  // Track engine-side unsub on each pending entry so post-drain `unsub()`
  // closures can correctly remove from the engine, not just from the
  // (now-empty) pending array.
  type PendingEntry = {
    event: keyof SheetEventMap;
    fn: (p: any) => void;
    engineUnsub: (() => void) | null;
  };
  const pending: PendingEntry[] = [];

  const attach = (refs: SvelteAttachRefs) => {
    // Tear down any prior engine first — Svelte $effect can re-fire on ref
    // reassignment (HMR, conditional mount toggling, parent re-render); without
    // this guard, attaching twice without an intervening teardown would orphan
    // the previous engine's listeners + RAF handles + gesture closures.
    if (engine) engine.destroy();
    // Strip onSnap before forwarding — engine doesn't recognise the field.
    const { onSnap, ...engineOpts } = opts;
    engine = new BottomSheetEngine({
      ...(engineOpts as Omit<
        EngineOptions,
        "element" | "handle" | "scrollContainer" | "backdrop" | "screenComponent"
      >),
      ...refs,
    });
    // Adapter-owned snap listener. Lives outside `pending` so consumer
    // `on("snap", ...)` subscriptions through the public API don't share
    // its lifecycle (their unsub closures must not remove this one).
    if (onSnap) {
      engine.on("snap", payload => onSnap(payload.id as TId));
    }
    // Drain queued listeners. Entry refs survive `pending.length = 0` via
    // the closures returned from on() — those closures read
    // `entry.engineUnsub` to perform the real removal post-drain.
    for (const entry of pending) {
      entry.engineUnsub = engine.on(entry.event, entry.fn);
    }
    pending.length = 0;
    return () => {
      engine?.destroy();
      engine = null;
    };
  };

  return {
    attach,
    state: () =>
      (engine?.state ?? SSR_STATE) as EngineState & { activeId: TId },
    on: <K extends keyof SheetEventMap>(
      event: K,
      fn: (payload: SheetEventMap[K]) => void,
    ): (() => void) => {
      if (engine) return engine.on(event, fn);
      const entry: PendingEntry = {
        event,
        fn: fn as (p: any) => void,
        engineUnsub: null,
      };
      pending.push(entry);
      return () => {
        if (entry.engineUnsub) {
          entry.engineUnsub();
          entry.engineUnsub = null;
        } else {
          const idx = pending.indexOf(entry);
          if (idx !== -1) pending.splice(idx, 1);
        }
      };
    },
    snapTo: (id: TId) => engine?.snapTo(id) ?? Promise.resolve(),
    open: (id?: TId) => engine?.open(id) ?? Promise.resolve(),
    close: () => engine?.close() ?? Promise.resolve(),
    setAllowed: (ids: TId[], snap?: TId) =>
      engine?.setAllowed(ids as unknown as string[], snap),
    destroy: () => {
      engine?.destroy();
      engine = null;
    },
  };
}
