/**
 * Tiny stand-in for `@testing-library/react`'s `renderHook` so the form-
 * integration tests don't need to add a dev dependency. Spins up a React
 * 18 root, renders a no-op component that calls the hook, and exposes
 * `unmount`. Effects flush synchronously inside `act()`.
 */
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { jsx } from "react/jsx-runtime";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type RenderHookResult = {
  unmount: () => void;
  /** Re-render the hook with a new callback. Useful for testing remount-
   *  triggered staleness — e.g. parent passes a fresh `useForm()` return. */
  rerender: (nextHook: () => void) => void;
};

export function renderHook(useHook: () => void): RenderHookResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  // Hold the current hook in a ref-like closure so rerender can swap it
  // without re-mounting React's internal tree (which would lose effects).
  let current = useHook;
  const Component = () => {
    current();
    return null;
  };

  act(() => {
    root.render(jsx(Component, {}));
  });

  return {
    rerender: nextHook => {
      current = nextHook;
      act(() => {
        root.render(jsx(Component, {}));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}
