import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useBottomSheet } from "./useBottomSheet";
import type { EngineOptions, EngineState } from "../core/types";

const useHasMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};

type EngineOptionsForProps = Omit<
  EngineOptions,
  "element" | "handle" | "scrollContainer" | "backdrop" | "screenComponent"
>;

/**
 * Header content for the sheet. Two forms are supported:
 *   - **Static node**: `header={<h2>Title</h2>}` — rendered once and never
 *     updated when the active snap changes.
 *   - **Render function**: `header={state => <h2>{state.activeId}</h2>}` —
 *     called on every settled snap change with the current `EngineState`,
 *     so the header can morph per snap (e.g. minimized header vs full
 *     header). The function fires from the same `useSyncExternalStore`
 *     subscription that drives the rest of the component, so identity is
 *     stable between snaps and only re-renders on transitions.
 */
export type HeaderProp = ReactNode | ((state: EngineState) => ReactNode);

export type BottomSheetProps = EngineOptionsForProps & {
  /** Render the dimmed overlay behind the sheet. Default: true. */
  backdrop?: boolean;
  /** Close when the backdrop is clicked. Default: true. */
  closeOnBackdrop?: boolean;
  /** Optional className appended to the root sheet element. */
  className?: string;
  style?: CSSProperties;
  /**
   * Header content (above the scrollable content; doubles as drag handle
   * area). Accepts either a static `ReactNode` or a function
   * `(state: EngineState) => ReactNode` that re-renders on every snap
   * transition — letting consumers show different markup per snap state
   * (e.g. minimized vs half vs full).
   */
  header?: HeaderProp;
  /** Children become the scrollable content area. */
  children?: ReactNode;
  /** Slot above the sheet, anchored to the left. */
  leftButton?: ReactNode;
  /** Slot above the sheet, anchored to the right. */
  rightButton?: ReactNode;
  /** Element rendered behind the sheet, fading in with progress. */
  screen?: ReactNode;
  /** Fired whenever active snap changes. */
  onChange?: (state: EngineState) => void;
  /** Visually hidden label for screen readers. */
  ariaLabel?: string;
  /** ID of an existing heading element inside the sheet (preferred over ariaLabel). */
  ariaLabelledBy?: string;
  /** Skip rendering on the server to avoid hydration mismatches. Default: false. */
  noSSR?: boolean;
};

/**
 * Imperative handle returned by `<BottomSheet ref={…}>`.
 *
 * Opt-in literal-id typing — pass a string-literal union as `TId` to get
 * compile-time errors on typos:
 *
 * ```ts
 * // Default (back-compat): TId = string, anything goes
 * const ref = useRef<BottomSheetHandle>(null);
 * ref.current?.snapTo("anything"); // ✓ compiles, fails silently at runtime
 *
 * // Opt-in: typo-safe
 * const ref = useRef<BottomSheetHandle<"min" | "half" | "full">>(null);
 * ref.current?.snapTo("haf");   // ❌ TS2345
 * ref.current?.snapTo("half");  // ✓
 * ```
 *
 * `TId` defaults to `string` so existing call sites compile unchanged.
 * The underlying engine stays `string`-typed; the literal narrowing is a
 * TS-only convenience layered on top of the runtime.
 */
export type BottomSheetHandle<TId extends string = string> = {
  snapTo: (id: TId) => Promise<void>;
  open: (id?: TId) => Promise<void>;
  close: () => Promise<void>;
  setAllowed: (ids: TId[], snap?: TId) => void;
  state: EngineState & { activeId: TId };
};

/**
 * React component built on the headless engine. For full control, use
 * `useBottomSheet` directly and assemble your own JSX.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(props, ref) {
    const {
      backdrop = true,
      closeOnBackdrop = true,
      className = "",
      style,
      header,
      children,
      leftButton,
      rightButton,
      screen,
      onChange,
      ariaLabel = "Bottom sheet",
      ariaLabelledBy,
      noSSR = false,
      ...engineOpts
    } = props;
    const mounted = useHasMounted();

    const {
      sheetRef,
      handleRef,
      contentRef,
      backdropRef,
      screenRef,
      state,
      snapTo,
      open,
      close,
      setAllowed,
      getEngine,
    } = useBottomSheet(engineOpts);

    const isVerticalAxis =
      (engineOpts.mode ?? "bottom") === "bottom" ||
      (engineOpts.mode ?? "bottom") === "top";
    const ariaModal = engineOpts.focusTrap === true;
    const allowedIds =
      engineOpts.allowed ?? engineOpts.snapPoints.map(p => p.id);
    const activeIdx = allowedIds.indexOf(state.activeId);

    // Announce only on actual snap changes, not on every state-object
    // identity flip from the engine subscription.
    const lastAnnouncedRef = useRef<string>("");
    const [announce, setAnnounce] = useState("");
    useEffect(() => {
      if (state.activeId !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = state.activeId;
        setAnnounce(state.activeId);
      }
    }, [state.activeId]);

    // `state` getter reads the live engine on every access so imperative
    // consumers stay in sync after external mutations (setSnapPoints, resize).
    // The render path still uses the throttled snapshot for performance.
    useImperativeHandle(
      ref,
      () => ({
        snapTo,
        open,
        close,
        setAllowed,
        get state() {
          return getEngine()?.state ?? state;
        },
      }),
      [snapTo, open, close, setAllowed, getEngine, state],
    );

    // After commit, so parents that capture into their own setState don't
    // violate the "no setState during render" rule.
    useEffect(() => {
      onChange?.(state);
    }, [state, onChange]);

    if (noSSR && !mounted) return null;

    return (
      <div className="bs-root">
        {backdrop && (
          <div
            ref={backdropRef as React.RefObject<HTMLDivElement>}
            className="bs-backdrop"
            onClick={closeOnBackdrop ? () => void close() : undefined}
          />
        )}
        {screen && (
          <div
            ref={screenRef as React.RefObject<HTMLDivElement>}
            className="bs-screen"
          >
            {screen}
          </div>
        )}
        <section
          ref={sheetRef as React.RefObject<HTMLElement>}
          className={`bs-sheet ${className}`.trim()}
          style={style}
          data-mode={engineOpts.mode ?? "bottom"}
          data-active={state.activeId}
          role={ariaModal ? "dialog" : "region"}
          aria-modal={ariaModal ? "true" : undefined}
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          {leftButton && (
            <div className="bs-button-slot" data-side="left">
              {leftButton}
            </div>
          )}
          {rightButton && (
            <div className="bs-button-slot" data-side="right">
              {rightButton}
            </div>
          )}
          <div
            ref={handleRef as React.RefObject<HTMLDivElement>}
            className="bs-handle"
            role="slider"
            tabIndex={0}
            aria-orientation={isVerticalAxis ? "vertical" : "horizontal"}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, allowedIds.length - 1)}
            aria-valuenow={Math.max(0, activeIdx)}
            aria-valuetext={state.activeId}
            aria-label="Resize sheet"
          >
            {typeof header === "function" ? header(state) : header}
          </div>
          <div
            ref={contentRef as React.RefObject<HTMLDivElement>}
            className="bs-content"
            tabIndex={0}
            role="region"
            aria-label="Sheet content"
          >
            {children}
          </div>
          {/* aria-live announcer for snap state changes (WCAG 4.1.3) */}
          <span className="bs-sr-only" role="status" aria-live="polite">
            {announce}
          </span>
        </section>
      </div>
    );
  },
);
