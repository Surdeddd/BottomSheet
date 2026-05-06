/** @jsxImportSource solid-js */
import { render } from "solid-js/web";
import { onMount, onCleanup, For } from "solid-js";
import { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import {
  allowedFromSnaps,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";

/**
 * Solid demo for the headless BottomSheet engine.
 *
 * The published `@surdeddd/bottom-sheet/solid` adapter wraps this same engine
 * with sensible defaults; this demo wires `BottomSheetEngine` directly so the
 * test harness's controller (snapTo / onUpdate / onVelocity) gets uncomplicated
 * access to the engine instance.
 *
 * The engine instance is handed back to `mountSolidDemo` via the `onReady`
 * callback prop so the page-level polling loop can read `engine.state`
 * without resorting to a `window` side-channel.
 */
const SolidSheet = (props: {
  settings: DemoSettings;
  onReady: (engine: BottomSheetEngine) => void;
  onTeardown: () => void;
}) => {
  let sheetEl!: HTMLDivElement;
  let handleEl!: HTMLDivElement;
  let contentEl!: HTMLDivElement;
  let backdropEl!: HTMLDivElement;
  let engine: BottomSheetEngine | null = null;
  let detachBackdrop: (() => void) | null = null;

  onMount(() => {
    const dataMode =
      props.settings.mode === "overlay" ? "bottom" : props.settings.mode;
    engine = new BottomSheetEngine({
      element: sheetEl,
      handle: handleEl,
      scrollContainer: contentEl,
      backdrop: backdropEl,
      mode: dataMode as "bottom" | "top" | "left" | "right",
      snapPoints: snapPoints(props.settings.mode),
      allowed: allowedFromSnaps(props.settings.mode),
      initial: props.settings.initial,
      animation: "spring",
      spring: {
        stiffness: props.settings.stiffness,
        damping: props.settings.damping,
      },
      focusTrap: props.settings.focusTrap,
      closeOnEscape: props.settings.closeOnEscape,
      rubberBand: props.settings.rubberBand,
      backdropRange: [0.4, 1],
      lockBodyScroll: false,
    });

    const onBackdropClick = () => void engine!.close();
    backdropEl.addEventListener("click", onBackdropClick);
    detachBackdrop = () =>
      backdropEl.removeEventListener("click", onBackdropClick);

    props.onReady(engine);
  });

  onCleanup(() => {
    detachBackdrop?.();
    engine?.destroy();
    engine = null;
    props.onTeardown();
  });

  const dataMode =
    props.settings.mode === "overlay" ? "bottom" : props.settings.mode;

  return (
    <div class="bs-root">
      <div class="bs-backdrop" ref={backdropEl!} />
      <section
        class="bs-sheet"
        data-mode={dataMode}
        role="dialog"
        ref={sheetEl!}
      >
        <div
          class="bs-handle"
          role="slider"
          tabIndex={0}
          aria-label="Resize sheet"
          ref={handleEl!}
        >
          <div class="sheet-header">
            <h2>Active routes</h2>
            <span class="hint">SOLID · SIGNALS</span>
          </div>
        </div>
        <div class="bs-content" ref={contentEl!} tabIndex={0} role="region" aria-label="Sheet content">
          <div class="sheet-list">
            <For each={demoRows}>
              {([title, sub]) => (
                <div class="sheet-item">
                  <div class="sheet-item-dot" />
                  <div class="sheet-item-text">
                    <strong>{title}</strong>
                    <span>{sub}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>
    </div>
  );
};

export const mountSolidDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  const shell = buildShell(host, "Issue 04 · Solid");
  const mountPoint = document.createElement("div");
  shell.append(mountPoint);

  // Engine handle captured via the component's `onReady` callback. Ref-via-props
  // beats a `window.__solidEngine` side-channel — same lifetime, no globals.
  let engineRef: BottomSheetEngine | null = null;

  const dispose = render(
    () => (
      <SolidSheet
        settings={settings}
        onReady={engine => {
          engineRef = engine;
        }}
        onTeardown={() => {
          engineRef = null;
        }}
      />
    ),
    mountPoint,
  );

  let updateCb: ((s: any) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  const interval = window.setInterval(() => {
    if (!engineRef) return;
    const state = engineRef.state;
    updateCb?.(state);
    const now = performance.now();
    const dt = now - lastTs;
    if (dt > 0) velocityCb?.((state.size - lastSize) / dt);
    lastSize = state.size;
    lastTs = now;
  }, 33);

  return {
    destroy: () => {
      clearInterval(interval);
      dispose();
      mountPoint.remove();
    },
    snapTo: (id: string) => {
      void engineRef?.snapTo(id);
    },
    onUpdate: fn => {
      updateCb = fn;
    },
    onVelocity: fn => {
      velocityCb = fn;
    },
  };
};
