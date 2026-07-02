import { describe, expect, it, beforeEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { jsxs, jsx } from "react/jsx-runtime";
import { useBottomSheet } from "../../src/react/useBottomSheet";
import type {
  UseBottomSheetReturn,
} from "../../src/react/useBottomSheet";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Handlers = {
  onOpen?: (id: string) => void;
  onClose?: () => void;
  onProgress?: (payload: { value: number; size: number }) => void;
};

let apiRef: UseBottomSheetReturn<"closed" | "full"> | null = null;

function Sheet(props: Handlers) {
  const bs = useBottomSheet({
    snapPoints: [
      { id: "closed", size: 0 },
      { id: "full", size: 400 },
    ],
    initial: "closed",
    animation: "tween",
    duration: 0,
    respectReducedMotion: false,
    onOpen: props.onOpen,
    onClose: props.onClose,
    onProgress: props.onProgress,
  });
  apiRef = bs;
  return jsxs("div", {
    className: "bs-root",
    children: [
      jsx("div", { ref: bs.backdropRef, className: "bs-backdrop" }),
      jsx("div", { ref: bs.screenRef, className: "bs-screen" }),
      jsxs("section", {
        ref: bs.sheetRef,
        className: "bs-sheet",
        children: [
          jsx("div", { ref: bs.handleRef, className: "bs-handle" }),
          jsx("div", { ref: bs.contentRef, className: "bs-content" }),
        ],
      }),
    ],
  });
}

describe("React useBottomSheet — onOpen/onClose/onProgress wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    apiRef = null;
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("fires onOpen(id), onProgress, then onClose across an open/close cycle", async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const onProgress = vi.fn();

    await act(async () => {
      root.render(jsx(Sheet, { onOpen, onClose, onProgress }));
    });

    await act(async () => {
      await apiRef!.open("full");
    });

    expect(onOpen).toHaveBeenCalledWith("full");
    expect(onProgress).toHaveBeenCalled();
    const lastProgress = onProgress.mock.calls.at(-1)![0];
    expect(lastProgress.value).toBeCloseTo(1, 5);
    expect(lastProgress.size).toBe(400);
    expect(onClose).not.toHaveBeenCalled();

    onProgress.mockClear();

    await act(async () => {
      await apiRef!.close();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress.mock.calls.at(-1)![0].value).toBeCloseTo(0, 5);

    await act(async () => {
      root.unmount();
    });
  });

  it("does not subscribe to progress when no onProgress handler is passed", async () => {
    const onOpen = vi.fn();

    await act(async () => {
      root.render(jsx(Sheet, { onOpen }));
    });

    const engine = apiRef!.getEngine()!;
    const count = (
      engine as unknown as {
        bus: { listenerCount: (e: string) => number };
      }
    ).bus.listenerCount("progress");
    expect(count).toBe(0);

    await act(async () => {
      await apiRef!.open("full");
    });
    expect(onOpen).toHaveBeenCalledWith("full");

    await act(async () => {
      root.unmount();
    });
  });
});
