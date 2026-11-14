import { createRoot, type Root } from "react-dom/client";
import { useEffect, useRef, useState, type FC } from "react";
import {
  BottomSheet,
  Overlay,
  type BottomSheetHandle,
  type OverlayHandle,
} from "@surdeddd/bottom-sheet/react";
import {
  allowedFromSnaps,
  buildShell,
  demoRows,
  snapPoints,
  type DemoController,
  type DemoSettings,
} from "./shared";
import {
  OVERLAY_AUTO_CLOSE_MS,
  OVERLAY_ITEMS,
  OVERLAY_OPEN_DELAY_MS,
} from "./overlay-demo";

export type { DemoController } from "./shared";

const ReactOverlay: FC<{
  settings: DemoSettings;
  registerSnap: (fn: (id: string) => void) => void;
  registerPoll: (read: () => any) => void;
}> = ({ settings, registerSnap, registerPoll }) => {
  const ref = useRef<OverlayHandle>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    registerPoll(() => ({
      activeId: open ? "open" : "closed",
      progress: open ? 1 : 0,
      size: 0,
      isDragging: false,
      isAnimating: ref.current?.state.isAnimating ?? false,
    }));
  }, [registerPoll, open]);

  const userInteracted = useRef(false);
  useEffect(() => {
    let tClose: ReturnType<typeof setTimeout> | null = null;
    const tOpen = setTimeout(() => setOpen(true), OVERLAY_OPEN_DELAY_MS);
    tClose = setTimeout(() => {
      if (!userInteracted.current) setOpen(false);
    }, OVERLAY_AUTO_CLOSE_MS);
    return () => {
      clearTimeout(tOpen);
      if (tClose) clearTimeout(tClose);
    };
  }, []);

  useEffect(() => {
    registerSnap((cmd: string) => {
      userInteracted.current = true;
      if (cmd === "open") setOpen(true);
      else setOpen(false);
    });
  }, [registerSnap]);

  return (
    <Overlay
      ref={ref}
      open={open}
      onClose={() => {
        userInteracted.current = true;
        setOpen(false);
      }}
      edge="bottom"
      duration={320}
      focusTrap={settings.focusTrap}
      closeOnEscape={settings.closeOnEscape}
      lockBodyScroll={false}
      ariaLabelledBy="ovl-demo-title"
    >
      <div className="ovl-demo">
        <h2 id="ovl-demo-title">Account</h2>
        <p className="ovl-demo-sub">marina@studio.ru · freelance</p>
        <ul className="ovl-demo-list">
          {OVERLAY_ITEMS.map(item => (
            <li key={item.label}>
              <button
                type="button"
                className={item.danger ? "is-danger" : undefined}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ovl-demo-cancel"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </Overlay>
  );
};

const ReactSheet: FC<{
  settings: DemoSettings;
  registerSnap: (fn: (id: string) => void) => void;
  registerPoll: (read: () => any) => void;
  registerEngine: (getter: () => any) => void;
}> = ({ settings, registerSnap, registerPoll, registerEngine }) => {
  const ref = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    registerSnap((id: string) => {
      void ref.current?.snapTo(id);
    });
    registerPoll(() => ref.current?.state ?? null);
    registerEngine(() => ref.current?.getEngine?.() ?? null);
  }, [registerSnap, registerPoll, registerEngine]);

  const remountKey = `${settings.mode}-${settings.stiffness}-${settings.damping}-${settings.focusTrap}-${settings.closeOnEscape}-${settings.rubberBand}`;

  return (
    <BottomSheet
      ref={ref}
      key={remountKey}
      mode={settings.mode as "bottom" | "top" | "left" | "right"}
      snapPoints={snapPoints(settings.mode)}
      allowed={allowedFromSnaps(settings.mode)}
      initial={settings.initial}
      animation="spring"
      spring={{ stiffness: settings.stiffness, damping: settings.damping }}
      focusTrap={settings.focusTrap}
      closeOnEscape={settings.closeOnEscape}
      rubberBand={settings.rubberBand}
      backdropRange={[0.4, 1]}
      lockBodyScroll={false}
      header={
        <div className="sheet-header">
          <h2>Active routes</h2>
          <span className="hint">REACT · USEBOTTOMSHEET</span>
        </div>
      }
    >
      <div className="sheet-list">
        {demoRows.map(([title, sub], i) => (
          <div className="sheet-item" key={i}>
            <div className="sheet-item-dot" />
            <div className="sheet-item-text">
              <strong>{title}</strong>
              <span>{sub}</span>
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
};

export const mountReactDemo = (
  host: HTMLElement,
  settings: DemoSettings,
): DemoController => {
  buildShell(host, "Issue 01 · React");
  const mountPoint = document.createElement("div");
  host.firstElementChild!.appendChild(mountPoint);
  const root: Root = createRoot(mountPoint);

  let snapFn: (id: string) => void = () => {};
  let pollFn: () => any = () => null;
  let engineGetter: () => any = () => null;
  let updateCb: ((s: any) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let interval: number | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  const isOverlay = (settings.mode as string) === "overlay";
  root.render(
    isOverlay ? (
      <ReactOverlay
        settings={settings}
        registerSnap={fn => {
          snapFn = fn;
        }}
        registerPoll={fn => {
          pollFn = fn;
        }}
      />
    ) : (
      <ReactSheet
        settings={settings}
        registerSnap={fn => {
          snapFn = fn;
        }}
        registerPoll={fn => {
          pollFn = fn;
        }}
        registerEngine={getter => {
          engineGetter = getter;
        }}
      />
    ),
  );

  interval = window.setInterval(() => {
    const state = pollFn();
    if (!state) return;
    updateCb?.(state);
    const now = performance.now();
    const dt = now - lastTs;
    if (dt > 0) velocityCb?.((state.size - lastSize) / dt);
    lastSize = state.size;
    lastTs = now;
  }, 33);

  return {
    destroy: () => {
      if (interval) clearInterval(interval);
      root.unmount();
    },
    snapTo: (id: string) => snapFn(id),
    onUpdate: fn => {
      updateCb = fn;
    },
    onVelocity: fn => {
      velocityCb = fn;
    },
    getEngine: () => engineGetter() ?? null,
  };
};
