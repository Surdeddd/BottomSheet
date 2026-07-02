# @surdeddd/bottom-sheet · SolidJS adapter

Solid ships as a first-class subpath: `@surdeddd/bottom-sheet/solid`. The
adapter wraps the same headless `BottomSheetEngine` the rest of the framework
adapters use, but funnels engine events through a single `createSignal` so
Solid's compiled JSX patches DOM attributes surgically — no virtual DOM diff,
no full-subtree re-render.

## Install

```bash
npm i @surdeddd/bottom-sheet solid-js
```

## Quick start

```tsx
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import "@surdeddd/bottom-sheet/styles";

export const Search = () => (
  <BottomSheet
    snapPoints={[
      { id: "min",  size: 96 },
      { id: "half", size: "45%" },
      { id: "full", size: "85%" },
    ]}
    initial="min"
    animation="ios-spring"
    header={<h2>Search</h2>}
    onSnap={id => console.log("settled at", id)}
  >
    <ul class="results">{/* ... */}</ul>
  </BottomSheet>
);
```

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `snapPoints` | `SnapPointDef[]` | Required. `{ id, size }` — size is px or `"NN%"`. |
| `allowed` | `string[]` | Whitelist of snap ids the gesture can settle to. |
| `initial` | `string` | Initial snap id (defaults to first snap point). |
| `mode` | `"bottom" \| "top" \| "left" \| "right"` | Pull direction (default `"bottom"`). |
| `animation` | `"spring" \| "tween" \| "ios-spring" \| "material-bounce" \| "linear" \| "snappy"` | Preset (default `"spring"`). |
| `spring` | `{ stiffness?, damping?, mass? }` | Override the spring physics. |
| `focusTrap` | `boolean` | Trap focus when the sheet is open. |
| `closeOnEscape` | `boolean` | ESC closes the sheet. |
| `closeOnBack` | `boolean` | Browser back-button closes the sheet. |
| `lockBodyScroll` | `boolean` | Lock `<body>` scroll while interactive. |
| `rubberBand` | `boolean` | Engine spring overshoot at the edges. |
| `backdrop` | `boolean` | Render the dimming backdrop (default `true`). |
| `closeOnBackdrop` | `boolean` | Tap backdrop to close (default `true`). |
| `backdropRange` | `[number, number]` | `[minOpacity, maxOpacity]` for the backdrop. |
| `radius` | `string \| number` | Corner radius. Reactive. |
| `maxHeight` | `string \| number` | Height cap; a string is re-resolved on viewport changes. |
| `persistent` | `boolean` | Block dismissal (backdrop / Escape / back). Reactive. |
| `disableClose` | `boolean` | Block all closing. Reactive. |
| `disableDrag` | `boolean` | Suppress the drag gesture. Reactive. |
| `closeOnRouteChange` | `boolean` | Close when the URL changes. |
| `stackEffect` | `boolean` | iOS card-stack scaling of back sheets. |
| `teleport` / `teleportTo` | `boolean` / `HTMLElement \| string \| null` | Relocate the sheet DOM. Opt-in — **off by default** (`teleportTo` unset). |
| `returnFocusTo` | `HTMLElement \| string \| (() => HTMLElement \| null)` | Focus target on dismiss. |
| `ariaLabel` | `string` | Accessible name (default `"Bottom sheet"`). |
| `header` / `footer` | `JSX.Element` | Header / footer content. |
| `leftButton` / `rightButton` | `JSX.Element` | Buttons docked above the sheet. |
| `screen` | `JSX.Element` | Background that fades in by progress. |
| `engineRef` | `(engine) => void` | Receives the `BottomSheetEngine` (or `null` on cleanup). |

### Event callbacks

| Prop | Payload | Fires |
| --- | --- | --- |
| `onSnap` | `id: string` | Settled on a new snap. |
| `onBeforeSnap` | `{ id, size, previousId, cancel }` | Before a snap — call `cancel()` **synchronously** to veto. |
| `onBeforeClose` | `{ reason, cancel }` | Before a dismissal — call `cancel()` synchronously to veto. |
| `onOpen` / `onOpened` | `id: string` | Enter starts / enter settled. |
| `onClose` / `onClosed` | — | Exit starts / exit settled. |
| `onDragStart` / `onDragEnd` | `{ size }` / `{ size, velocity }` | Pointer drag boundaries. |
| `onDrag` / `onProgress` | `{ size, delta }` / `{ value, size }` | ~60 fps — **provide at mount**; the engine only subscribes when the handler is present, so adding them later has no effect. Don't push these through signals. |
| `onChange` | `EngineState` | On `snap` / `dragstart` / `dragend`. |

`onBeforeSnap` / `onBeforeClose` cancel synchronously — Solid callbacks run
inline, so vetoing works (unlike Qwik's async QRLs).

## Recipe (engine-direct)

If you need full control — multiple sheets sharing one engine, custom DOM
shape, embedding the engine in a Solid `<Show>` boundary that mounts
asynchronously — drop the adapter and wire `BottomSheetEngine` directly:

```tsx
import { createSignal, onMount, onCleanup, For } from "solid-js";
import { BottomSheetEngine, type EngineState } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

export const BottomSheet = (props: { items: { title: string; sub: string }[] }) => {
  let sheetEl!: HTMLElement;
  let handleEl!: HTMLElement;
  let contentEl!: HTMLElement;
  let backdropEl!: HTMLElement;

  const [state, setState] = createSignal<EngineState>({
    size: 0, activeId: "", isDragging: false, isAnimating: false, progress: 0,
  });
  let engine: BottomSheetEngine | null = null;

  onMount(() => {
    engine = new BottomSheetEngine({
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
      snapPoints: [
        { id: "min", size: 96 },
        { id: "half", size: "45%" },
        { id: "full", size: "85%" },
      ],
      initial: "min",
      animation: "spring",
    });
    const sync = () => setState({ ...engine!.state });
    engine.on("snap", sync);
    engine.on("dragstart", sync);
    engine.on("dragend", sync);
    sync();
  });

  onCleanup(() => engine?.destroy());

  return (
    <div class="bs-root">
      <div class="bs-backdrop" ref={backdropEl} />
      <section class="bs-sheet" ref={sheetEl} data-mode="bottom" role="dialog">
        <div class="bs-handle" ref={handleEl} role="slider" tabIndex={0}>
          <h2>Search</h2>
        </div>
        <div class="bs-content" ref={contentEl}>
          <For each={props.items}>
            {item => (
              <div class="sheet-item">
                <strong>{item.title}</strong>
                <span>{item.sub}</span>
              </div>
            )}
          </For>
        </div>
      </section>
      <p>active: {state().activeId} ({(state().progress * 100).toFixed(0)}%)</p>
    </div>
  );
};
```

## One-shot construction

The engine is constructed once inside `onMount` from the props read at that
moment. Subsequent changes to `snapPoints` / `allowed` / `mode` props after
mount do **not** auto-recreate the engine — Solid signals don't propagate
through to the imperative engine state. For runtime updates, drive the
engine via the imperative `engine` field on the rendered component:

```tsx
let sheetRef: { engine: BottomSheetEngine | null } | undefined;

createEffect(() => {
  sheetRef?.engine?.setAllowed(formDirty() ? ["full"] : ["min", "full"]);
});

// Subscribe to events:
onMount(() => {
  const off = sheetRef?.engine?.on("before-snap", e => {
    if (formDirty() && e.id === "closed") e.cancel();
  });
  onCleanup(() => off?.());
});
```

Engine recreation (changing `mode`, `animation`, `focusTrap`) requires a
`<Show>`-gated remount with a fresh component instance.

## Notes

- Solid's `createSignal` already gives you fine-grained reactivity — equivalent
  to React's `useSyncExternalStore` settled-snapshot pattern.
- Subscribe only to `snap` / `dragstart` / `dragend` for reactive state. Use
  `engine.on("progress", ...)` imperatively if you need 60 fps progress —
  update the DOM directly, don't push through signals.
- The bundled adapter is `dist/solid.js` ≈ 9 KB gzip (engine + adapter + types).
