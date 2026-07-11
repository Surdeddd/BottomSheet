import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { jsx } from "react/jsx-runtime";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type RenderHookResult = {
  unmount: () => void;
  rerender: (nextHook: () => void) => void;
};

export function renderHook(useHook: () => void): RenderHookResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

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
