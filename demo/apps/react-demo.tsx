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

export type { DemoController } from "./shared";

const ReactOverlay: FC<{
  registerSnap: (fn: (id: string) => void) => void;
  registerPoll: (read: () => any) => void;
}> = ({ registerSnap, registerPoll }) => {
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

  // Auto-open once on mount, then auto-close after 3.5s — but cancel the
  // auto-close as soon as the user interacts (clicks chip / cancel / Esc /
  // backdrop). After interaction, the overlay is fully manual.
  const userInteracted = useRef(false);
  useEffect(() => {
    let tClose: ReturnType<typeof setTimeout> | null = null;
    const tOpen = setTimeout(() => setOpen(true), 400);
    tClose = setTimeout(() => {
      if (!userInteracted.current) setOpen(false);
    }, 3900);
    return () => {
      clearTimeout(tOpen);
      if (tClose) clearTimeout(tClose);
    };
  }, []);

  // Wrap snap callback to mark interaction.
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
      focusTrap
      closeOnEscape
      lockBodyScroll={false}
    >
      <div style={{ padding: "24px 20px" }}>
        <h2
          style={{
            fontFamily: "Fraunces, serif",
            fontSize: 22,
            fontWeight: 400,
            margin: 0,
            color: "#1a1614",
          }}
        >
          Account
        </h2>
        <p
          style={{
            fontFamily: "Fraunces, serif",
            fontStyle: "italic",
            fontSize: 13,
            margin: "4px 0 16px",
            color: "#8b827a",
          }}
        >
          marina@studio.ru · freelance
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[
            "Profile settings",
            "Notifications",
            { label: "Sign out", danger: true },
          ].map((item, i) => {
            const isObj = typeof item === "object";
            const label = isObj ? item.label : item;
            return (
              <li
                key={i}
                style={{
                  padding: "12px 14px",
                  background: "#ece2d0",
                  borderRadius: 10,
                  fontFamily: "Hanken Grotesk, sans-serif",
                  fontSize: 14,
                  color: isObj ? "#dc3522" : "#1a1614",
                  cursor: "pointer",
                }}
              >
                {label}
              </li>
            );
          })}
        </ul>
        <button
          onClick={() => setOpen(false)}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "10px 12px",
            fontFamily: "Hanken Grotesk, sans-serif",
            fontSize: 13,
            background: "transparent",
            border: "1px solid rgba(26, 22, 20, 0.32)",
            borderRadius: 8,
            cursor: "pointer",
            color: "#1a1614",
          }}
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
}> = ({ settings, registerSnap, registerPoll }) => {
  const ref = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    registerSnap((id: string) => {
      void ref.current?.snapTo(id);
    });
    registerPoll(() => ref.current?.state ?? null);
  }, [registerSnap, registerPoll]);

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
  let updateCb: ((s: any) => void) | null = null;
  let velocityCb: ((v: number) => void) | null = null;
  let interval: number | null = null;
  let lastSize = 0;
  let lastTs = performance.now();

  // Overlay mode renders an entirely different component — non-draggable
  // bottom-anchored slide-up panel matching the monitoring app pattern.
  const isOverlay = (settings.mode as string) === "overlay";
  root.render(
    isOverlay ? (
      <ReactOverlay
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
      />
    ),
  );

  // Single page-level polling loop — always reads via the latest registered fn.
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
  };
};
