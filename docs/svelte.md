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
    scrim?: HTMLElement;
  }): () => void;                                            // returns teardown

  state(): EngineState;                                      // snapshot
  on(event, fn): () => void;                                 // unsubscribe — full SheetEventMap

  snapTo(id: string): Promise<void>;
  open(id?: string): Promise<void>;
  close(): Promise<void>;
  expand(): Promise<void>;                                   // largest allowed snap
  collapse(): Promise<void>;                                 // smallest allowed snap > 0
  isTop(): boolean;
  depth(): number;
  setAllowed(ids: string[], snap?: string): void;
  setSnapPoints(points: EngineOptions["snapPoints"], allowed?: string[]): void;
  setScrim(opts: ScrimUpdate): void;
  setScrimOverlay(opts: ScrimOverlayOptions): () => void;
  addAnchor(opts: AnchorOptions): () => void;
  setScrimStages(opts: ScrimStagesOptions | null): () => void;
  recompute(): void;                                         // re-measure a 'fit' / 'content' snap
  getEngine(): BottomSheetEngine | null;
  destroy(): void;
};
```

The controller's `on()` exposes the full engine event set (`snap`,
`before-snap`, `open`, `opened`, `close`, `closed`, `before-close`,
`dragstart`, `dragend`, `drag`, `progress`) — `before-snap` / `before-close`
carry a synchronous `cancel()`.

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

## `<BottomSheet>` component

A ready-made `<BottomSheet>` SFC is also exported for the common case — it
renders the full DOM (backdrop, scrim, handle, header/footer, button slots)
and wires the engine for you. Snippets fill the regions; callback props and
`bind:` surface the engine events and state.

```svelte
<script lang="ts">
  import { BottomSheet } from "@surdeddd/bottom-sheet/svelte";
  import "@surdeddd/bottom-sheet/styles";

  let open = $state(false);
  let snap = $state("min");
</script>

<BottomSheet
  snapPoints={[{ id: "min", size: 96 }, { id: "full", size: "85%" }]}
  bind:open
  bind:snap
  focusTrap
  onsnap={(id) => console.log("settled", id)}
  onbeforeclose={(e) => { if (formDirty) e.cancel(); }}
>
  {#snippet header()}<h2>Search</h2>{/snippet}
  {#snippet children()}<YourList />{/snippet}
  {#snippet footer()}<button>Done</button>{/snippet}
</BottomSheet>
```

Snippet props: `header` / `footer` (receive the state), `children`,
`leftButton` / `rightButton`, `screen`. Callback props:
`onsnap`, `onbeforesnap`, `onopen`, `onopened`, `onclose`, `onclosed`,
`onbeforeclose`, `ondragstart`, `ondragend`, `ondrag`, `onprogress`,
`onchange`. `bind:open` and `bind:snap` are two-way; `persistent`,
`disableClose`, `disableDrag`, `radius`, `maxHeight`, `backdropColor`,
`backdropOpacity`, `snapPoints` and `allowed` are reactive. `onbeforesnap` /
`onbeforeclose` cancel synchronously; `ondrag` / `onprogress` only subscribe
when the handler is supplied at mount.

Teleport is **opt-in** (`teleport` defaults to `false`) — set `teleport` and
optionally `teleportTo` to relocate the sheet DOM via the engine.

## Controller vs. component

The controller (`createBottomSheet`) is for full DOM control — you own the
markup and wire refs via `$effect` + `bind:this`. The `<BottomSheet>`
component is the batteries-included path. Both share the same engine; pick the
controller when you need a custom DOM shape or to embed the sheet in an
existing layout, the component otherwise.
