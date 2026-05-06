import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useOverlay } from "./useOverlay";
import type { OverlayOptions, OverlayState, OverlayEdge } from "../core/overlay";

export type OverlayProps = Omit<
  OverlayOptions,
  "element" | "backdrop"
> & {
  /** Controlled open state. If omitted, the overlay is uncontrolled. */
  open?: boolean;
  /** Render the backdrop. Default: true. */
  backdrop?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onChange?: (state: OverlayState) => void;
};

export type OverlayHandle = {
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  state: OverlayState;
};

/**
 * Bottom-anchored slide-up overlay panel. Distinct from `<BottomSheet>`:
 * no drag, no snap points, single binary state. CSS-transition animated
 * (no spring) — lighter weight, predictable timing.
 */
export const Overlay = forwardRef<OverlayHandle, OverlayProps>(function Overlay(
  props,
  ref,
) {
  const {
    open: openProp,
    backdrop = true,
    className = "",
    style,
    children,
    ariaLabel = "Overlay",
    ariaLabelledBy,
    onChange,
    edge = "bottom",
    ...engineOpts
  } = props;

  const { panelRef, backdropRef, state, open, close, toggle } = useOverlay({
    ...engineOpts,
    edge,
  });

  // Controlled mode — sync prop → engine
  useEffect(() => {
    if (openProp === undefined) return;
    if (openProp && !state.isOpen) void open();
    else if (!openProp && state.isOpen) void close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProp]);

  useEffect(() => {
    onChange?.(state);
  }, [state, onChange]);

  useImperativeHandle(
    ref,
    () => ({ open, close, toggle, state }),
    [open, close, toggle, state],
  );

  return (
    <div className="ovl-root">
      {backdrop && (
        <div
          ref={backdropRef as React.RefObject<HTMLDivElement>}
          className="ovl-backdrop"
          aria-hidden="true"
        />
      )}
      <section
        ref={panelRef as React.RefObject<HTMLElement>}
        className={`ovl-panel ${className}`.trim()}
        data-edge={edge}
        style={style}
        role="dialog"
        aria-modal={engineOpts.focusTrap !== false ? "true" : undefined}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        {children}
      </section>
    </div>
  );
});
