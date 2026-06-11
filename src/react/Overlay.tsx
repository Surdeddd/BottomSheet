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
  open?: boolean;
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

  useEffect(() => {
    if (openProp === undefined) return;
    if (openProp && !state.isOpen) void open();
    else if (!openProp && state.isOpen) void close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProp, state.isOpen]);

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
