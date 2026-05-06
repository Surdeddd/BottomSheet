# @surdeddd/bottom-sheet · Svelte 5

Svelte 5 adapter. Ships `createBottomSheet()` — a rune-friendly controller
factory you wire up via `$effect` and `bind:this`. The helper itself is plain
TypeScript so it works under any Svelte 5 toolchain (Vite, SvelteKit, Astro)
without extra build configuration.

## Install

```bash
npm i @surdeddd/bottom-sheet svelte
```

## Usage

```svelte
<script lang="ts">
  import { createBottomSheet } from "@surdeddd/bottom-sheet/svelte";
  import "@surdeddd/bottom-sheet/styles";

  let sheetEl: HTMLElement | undefined = $state();
  let handleEl: HTMLElement | undefined = $state();
  let contentEl: HTMLElement | undefined = $state();
  let backdropEl: HTMLElement | undefined = $state();

  const ctrl = createBottomSheet({
    snapPoints: [
      { id: "min",  size: 96 },
      { id: "half", size: "45%" },
      { id: "full", size: "85%" },
    ],
    initial: "min",
    animation: "spring",
    focusTrap: true,
  });

  $effect(() => {
    if (!sheetEl) return;
    return ctrl.attach({
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
    });
  });

  // React to settled snaps
  let activeId = $state(ctrl.state().activeId);
  $effect(() => {
    return ctrl.on("snap", ({ id }) => (activeId = id));
  });
</script>

<div class="bs-root">
  <div class="bs-backdrop" bind:this={backdropEl}></div>
  <section class="bs-sheet" bind:this={sheetEl} data-mode="bottom">
    <div class="bs-handle" bind:this={handleEl}>
      <h2>Search</h2>
    </div>
    <div class="bs-content" bind:this={contentEl}>
      <YourList />
    </div>
  </section>
</div>

<button onclick={() => ctrl.snapTo("full")}>Open</button>
<p>Active: {activeId}</p>
```

## Controller API

```ts
type SvelteBottomSheetController = {
  attach(refs: {
    element: HTMLElement;
    handle?: HTMLElement;
    scrollContainer?: HTMLElement;
    backdrop?: HTMLElement;
    screenComponent?: HTMLElement;
  }): () => void;                                            // returns teardown

  state(): EngineState;                                      // snapshot
  on(event, fn): () => void;                                 // unsubscribe

  snapTo(id: string): Promise<void>;
  open(id?: string): Promise<void>;
  close(): Promise<void>;
  setAllowed(ids: string[], snap?: string): void;
  destroy(): void;
};
```

## SvelteKit / SSR

`createBottomSheet()` does not touch the DOM. The engine attaches only when
you call `ctrl.attach()` from inside `$effect` (which never runs on the
server). SSR pages render the static HTML shell; gestures activate on the
client after hydration.

## One-shot construction

`createBottomSheet(opts)` snapshots `opts` at construction time. Reactive
changes to `opts.snapPoints` / `opts.allowed` / `opts.mode` from the calling
component DO NOT propagate to the engine — by design, to avoid silent
reactivity bugs when callers pass non-reactive object literals.

For runtime updates, use the controller methods:

```svelte
<script lang="ts">
  let formDirty = $state(false);
  const ctrl = createBottomSheet({ snapPoints, initial: "min" });

  // Apply runtime allow-list changes:
  $effect(() => {
    ctrl.setAllowed(formDirty ? ["full"] : ["min", "full"]);
  });

  // Subscribe to engine events:
  $effect(() => {
    const off = ctrl.on("before-snap", e => {
      if (formDirty && e.id === "closed") e.cancel();
    });
    return off;
  });
</script>
```

Engine recreation (changing `mode`, `animation`, `focusTrap`) requires
calling `ctrl.destroy()` and constructing a fresh controller — the
controller's `attach()` re-uses the constructor-time `opts` snapshot.

## Why a controller, not a `<BottomSheet>` component?

Distributing a `.svelte` component would require shipping precompiled Svelte
artifacts and a separate build pipeline. The controller pattern keeps the
adapter framework-version-agnostic — it works under Svelte 5 today and stays
forward-compatible as Svelte evolves runes API.
