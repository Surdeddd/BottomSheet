import { describe, expect, it, beforeEach } from "vitest";
import { act, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { BottomSheet, type BottomSheetHandle } from "../../src/react/BottomSheet";
import { Overlay } from "../../src/react/Overlay";
import type { OverlayState } from "../../src/core/overlay";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheet-stack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scroll-lock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/css-length";
import { __resetRouteCoordinatorForTests } from "../../src/core/features/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const points = [
  { id: "closed", size: 0 },
  { id: "half", size: 300 },
  { id: "full", size: 600 },
];

describe("React <BottomSheet> fixes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    __resetRouteCoordinatorForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    document.body.removeAttribute("style");
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("creates the engine when noSSR delays the markup by a render", async () => {
    const ref = createRef<BottomSheetHandle>();
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          ref,
          noSSR: true,
          snapPoints: points,
          initial: "half",
          animation: "tween",
          duration: 0,
        }),
      );
    });
    await act(async () => {
      await wait(20);
    });
    const sheet = container.querySelector<HTMLElement>(".bs-sheet");
    expect(sheet).not.toBeNull();
    expect(ref.current?.getEngine()).not.toBeNull();
    expect(sheet!.style.transform).not.toBe("");
    await act(async () => root.unmount());
  });

  it("follows a controlled open prop", async () => {
    const ref = createRef<BottomSheetHandle>();
    const render = (open: boolean) =>
      act(async () => {
        root.render(
          jsx(BottomSheet, {
            ref,
            open,
            snapPoints: points,
            animation: "tween",
            duration: 0,
          }),
        );
      });

    await render(false);
    expect(ref.current!.state.size).toBe(0);
    expect(
      document.querySelector(".bs-sheet")!.getAttribute("data-bs-rest"),
    ).toBe("closed");

    await render(true);
    await act(async () => wait(40));
    expect(ref.current!.state.activeId).toBe("half");

    await render(false);
    await act(async () => wait(40));
    expect(ref.current!.state.size).toBe(0);
    await act(async () => root.unmount());
  });

  it("opens at mount when open starts true", async () => {
    const ref = createRef<BottomSheetHandle>();
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          ref,
          open: true,
          snapPoints: points,
          animation: "tween",
          duration: 0,
        }),
      );
    });
    await act(async () => wait(40));
    expect(ref.current!.state.activeId).toBe("half");
    await act(async () => root.unmount());
  });

  it("reports a dismissal and an opening through onOpenChange", async () => {
    const changes: boolean[] = [];
    const ref = createRef<BottomSheetHandle>();
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          ref,
          open: true,
          onOpenChange: (next: boolean) => changes.push(next),
          snapPoints: points,
          animation: "tween",
          duration: 0,
        }),
      );
    });
    await act(async () => wait(40));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await wait(40);
    });
    expect(changes).toEqual([true, false]);
    expect(ref.current!.state.size).toBe(0);
    await act(async () => root.unmount());
  });

  it("names the handle and the content from props", async () => {
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          snapPoints: points,
          initial: "half",
          animation: "tween",
          duration: 0,
          handleLabel: "Изменить размер",
          contentLabel: "Содержимое",
        }),
      );
    });
    expect(
      document.querySelector(".bs-handle")!.getAttribute("aria-label"),
    ).toBe("Изменить размер");
    expect(
      document.querySelector(".bs-content")!.getAttribute("aria-label"),
    ).toBe("Содержимое");
    await act(async () => root.unmount());
  });

  it("passes a changed dragFromContent on to the engine", async () => {
    const ref = createRef<BottomSheetHandle>();
    const render = (dragFromContent: boolean) =>
      jsx(BottomSheet, {
        ref,
        snapPoints: points,
        initial: "half",
        dragFromContent,
      });
    await act(async () => root.render(render(true)));
    await act(async () => root.render(render(false)));
    const engine = ref.current!.getEngine() as unknown as {
      dragFromContentDefault: boolean;
    };
    expect(engine.dragFromContentDefault).toBe(false);
    await act(async () => root.unmount());
  });

  it("keeps the physical edge in data-mode when a physical mode becomes its logical twin", async () => {
    const render = (mode: "right" | "end") =>
      jsx(BottomSheet, {
        snapPoints: points,
        initial: "half",
        mode,
        leftButton: jsx("button", { children: "left" }),
      });
    await act(async () => root.render(render("right")));
    await act(async () => root.render(render("end")));
    const sheet = container.querySelector<HTMLElement>(".bs-sheet")!;
    const slot = container.querySelector<HTMLElement>(".bs-button-slot")!;
    expect(sheet.dataset.mode).toBe("right");
    expect(slot.dataset.mode).toBe("right");
    await act(async () => root.unmount());
  });

  it("gives the imperative handle a way to subscribe to engine events", async () => {
    const ref = createRef<BottomSheetHandle>();
    await act(async () => {
      root.render(
        jsx(BottomSheet, {
          ref,
          snapPoints: points,
          initial: "half",
          animation: "tween",
          duration: 0,
        }),
      );
    });
    const seen: string[] = [];
    const off = ref.current!.on("snap", payload => seen.push(payload.id));
    await act(async () => {
      await ref.current!.snapTo("full");
    });
    off();
    await act(async () => {
      await ref.current!.snapTo("half");
    });
    expect(seen).toEqual(["full"]);
    await act(async () => root.unmount());
  });
});

describe("React server markup", () => {
  it("marks a sheet that starts closed as resting closed", () => {
    const html = renderToString(
      jsx(BottomSheet, { snapPoints: points, initial: "closed" }),
    );
    expect(html).toContain('data-bs-rest="closed"');
  });

  it("does not mark a sheet that starts open", () => {
    const html = renderToString(
      jsx(BottomSheet, { snapPoints: points, initial: "half" }),
    );
    expect(html).not.toContain("data-bs-rest");
  });
});

describe("React <Overlay> controlled by open", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetRouteCoordinatorForTests();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("opens once when the parent mirrors onChange back into open", async () => {
    const events: string[] = [];
    let setOpen: (value: boolean) => void = () => {};
    const Parent = () => {
      const [open, set] = useState(false);
      setOpen = set;
      return jsx(Overlay, {
        open,
        duration: 0,
        onOpen: () => events.push("open"),
        onClose: () => events.push("close"),
        onChange: (state: OverlayState) => set(state.isOpen),
        children: "panel",
      });
    };
    await act(async () => root.render(jsx(Parent, {})));
    await act(async () => {
      setOpen(true);
      await wait(60);
    });
    await act(async () => {
      await wait(120);
    });
    expect(events).toEqual(["open"]);
    expect(container.querySelector(".ovl-panel")?.getAttribute("data-state")).toBe(
      "open",
    );
    await act(async () => root.unmount());
  });
});
