# Svelte 5

`@surdeddd/bottom-sheet/svelte` has a `<BottomSheet>` component and a
`createBottomSheet()` controller for when you want to write the markup
yourself. Svelte 5, with runes.

```bash
npm i @surdeddd/bottom-sheet
```

## A modal sheet

```svelte
<script lang="ts">
  import { BottomSheet } from "@surdeddd/bottom-sheet/svelte";
  import "@surdeddd/bottom-sheet/styles";

  let open = $state(false);
</script>

<button onclick={() => (open = true)}>Filters</button>

<BottomSheet
  bind:open
  snapPoints={[
    { id: "closed", size: 0 },
    { id: "open", size: "fit" },
  ]}
  focusTrap
>
  {#snippet header()}<h2>Filters</h2>{/snippet}
  {#snippet children()}<FilterForm />{/snippet}
  {#snippet footer()}<button onclick={() => (open = false)}>Apply</button>{/snippet}
</BottomSheet>
```

`bind:open` needs a snap point of size `0`; that point is the closed state.
When `open` starts `false` the sheet starts there, and is hidden in the server
markup. A backdrop tap, Escape, the Back button and a drag down all set `open`
to `false`.

## A sheet that stays on screen

```svelte
<script lang="ts">
  import { BottomSheet } from "@surdeddd/bottom-sheet/svelte";

  let snap = $state("peek");
</script>

<BottomSheet
  bind:snap
  snapPoints={[
    { id: "peek", size: 96 },
    { id: "half", size: "45dvh" },
    { id: "full", size: "90%" },
  ]}
>
  {#snippet header()}<h2>Nearby</h2>{/snippet}
  {#snippet children()}<PlaceList onpick={() => (snap = "full")} />{/snippet}
</BottomSheet>
```

`bind:snap` is the point the sheet rests at. Set it to move the sheet; it is
updated when the sheet settles somewhere else. Without `initial`, the sheet
starts at `snap`.

## Props

Every [engine option](../README.md#options) is a prop. The component adds:

| Prop | Default | What it does |
| --- | --- | --- |
| `open` | uncontrolled | Whether the sheet is showing. Bindable |
| `snap` | uncontrolled | The active snap point. Bindable |
| `backdrop` | `true` | Render the backdrop |
| `closeOnBackdrop` | `true` | A tap on the backdrop closes the sheet |
| `teleportTo` | none | Element, selector or `"body"` to move the sheet's DOM to, out of a clipping or transformed ancestor. `teleport={false}` switches it off |
| `ariaLabel` | `"Bottom sheet"` | Accessible name |
| `handleLabel`, `contentLabel` | English | Accessible names of the handle and the scroll area |

### Snippets

| Snippet | What goes in it |
| --- | --- |
| `children` | The scroll area |
| `header`, `footer` | Regions above and below the scroll area. Both receive the state |
| `leftButton`, `rightButton` | Buttons that float above the sheet's leading edge |
| `screen` | Content of the scrim layer; fades in with `progress` |

### Callbacks

| Prop | Receives | When |
| --- | --- | --- |
| `onsnap` | `id` | The sheet settled on a point |
| `onopen`, `onopened` | `id` | It starts to appear; it has landed |
| `onclose`, `onclosed` | nothing | It starts to leave; it is gone. Unmount in `onclosed` |
| `onbeforesnap` | `{ id, size, previousId, cancel }` | Before a move. `cancel()` stops it |
| `onbeforeclose` | `{ reason, cancel }` | Before a close. `reason` is `programmatic`, `backdrop`, `escape` or `back` |
| `ondragstart`, `ondragend` | `{ size }`, `{ size, velocity }` | A drag begins and ends |
| `ondrag`, `onprogress` | `{ size, delta }`, `{ value, size }` | Every frame of a drag; every frame of any motion |
| `onchange` | `EngineState` | The state changed |

`cancel()` must be called synchronously, inside the callback. `ondrag` and
`onprogress` are subscribed only if they are present when the component
mounts.

### Props you can change after mount

`open`, `snap`, `snapPoints`, `allowed`, `mode`, `radius`, `maxHeight`,
`persistent`, `disableClose`, `disableDrag`, `dragFrom`, `dragFromContent`,
`backdropColor` and `backdropOpacity` are applied to the running sheet.

The remaining options, such as `animation` or `focusTrap`, are read once. To
change one of them, wrap the component in a `{#key}` block.

## Methods

```svelte
<script lang="ts">
  let sheet: ReturnType<typeof BottomSheet>;
</script>

<BottomSheet bind:this={sheet} {snapPoints} />
<button onclick={() => sheet.expand()}>Expand</button>
```

The instance has `snapTo`, `open`, `close`, `expand`, `collapse`,
`setAllowed`, `setSnapPoints`, `recompute`, `isTop`, `depth`, `canDismiss`,
`setRadius`, `setMaxHeight`, `setScrim`, `setScrimOverlay`, `addAnchor`,
`setScrimStages`, `getState` and `getEngine`.

## The controller

`createBottomSheet()` gives you the methods and leaves the markup to you. It
does not touch the DOM until you call `attach()`:

```svelte
<script lang="ts">
  import { createBottomSheet } from "@surdeddd/bottom-sheet/svelte";
  import "@surdeddd/bottom-sheet/styles";

  let sheetEl: HTMLElement | undefined = $state();
  let handleEl: HTMLElement | undefined = $state();
  let contentEl: HTMLElement | undefined = $state();
  let backdropEl: HTMLElement | undefined = $state();

  const sheet = createBottomSheet({
    snapPoints: [
      { id: "peek", size: 96 },
      { id: "full", size: "90%" },
    ],
    initial: "peek",
  });

  $effect(() => {
    if (!sheetEl) return;
    return sheet.attach({
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
    });
  });

  let active = $state("peek");
  $effect(() => sheet.on("snap", ({ id }) => (active = id)));
</script>

<div class="bs-root">
  <div class="bs-backdrop" bind:this={backdropEl}></div>
  <section class="bs-sheet" data-mode="bottom" aria-label="Places" bind:this={sheetEl}>
    <div class="bs-handle" role="slider" tabindex="0" aria-label="Resize sheet" bind:this={handleEl}></div>
    <div class="bs-content" bind:this={contentEl}>…</div>
  </section>
</div>
```

`attach()` returns the teardown, which is why the effect returns it. The
controller has the same methods as the component, plus `state()`, `on()` and
`destroy()`.

The controller keeps the options it was created with. To change the sheet
afterwards, call its methods: `setAllowed()`, `setSnapPoints()`, or anything
on `getEngine()`.

## SvelteKit and server rendering

The adapter can be imported and rendered on the server. The engine attaches in
`onMount`. A sheet that starts closed is rendered with `data-bs-rest="closed"`,
which hides it until then.

## Things to know

- **Do not set `z-index` on `.bs-sheet`, `.bs-backdrop` or anchors.** The
  engine writes it on every change of the stack. See
  [Theming → stacking](theming.md#stacking).
- **Anchors and scrim stages** have no props on this component. Add them
  through `addAnchor()` and `setScrimStages()`; see
  [Anchors and scrim stages](anchors.md).
