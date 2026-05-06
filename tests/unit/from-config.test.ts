import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { jsx } from "react/jsx-runtime";
import { createRef } from "react";
import {
  BottomSheetFromConfig,
  type SheetConfig,
} from "../../src/react/BottomSheetFromConfig";
import type { BottomSheetHandle } from "../../src/react/BottomSheet";
import { __resetSheetStackForTests } from "../../src/core/lifecycle/sheetStack";
import { __resetScrollLockForTests } from "../../src/core/lifecycle/scrollLock";
import { __resetCssLengthProbeForTests } from "../../src/core/primitives/cssLength";

// React 18 concurrent root requires the act env flag.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const flushAsync = async (steps = 4) => {
  // 50ms slack per step (was 5ms) — the prior value raced on slow CI when
  // spring's ~16ms rAF fallback landed between the timeout and the next
  // await. Microtask flush via Promise.resolve() ensures React subscriptions
  // settle before the next macrotask boundary.
  for (let i = 0; i < steps; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await act(async () => {
      await Promise.resolve();
      await new Promise(r => setTimeout(r, 50));
    });
  }
};

describe("BottomSheetFromConfig", () => {
  let container: HTMLDivElement;
  let root: Root;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let warnSpy: any;

  beforeEach(() => {
    __resetSheetStackForTests();
    __resetScrollLockForTests();
    __resetCssLengthProbeForTests();
    Object.defineProperty(window, "innerHeight", {
      value: 1000,
      configurable: true,
    });
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("renders a sheet from a valid config", async () => {
    const config: SheetConfig = {
      version: 1,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      animation: "tween",
      behavior: { focusTrap: false, closeOnEscape: true },
    };

    await act(async () => {
      root.render(
        jsx(BottomSheetFromConfig, {
          config,
          slotContent: {
            header: jsx("h2", { children: "Configured" }),
            body: jsx("div", {
              "data-testid": "body",
              children: "config body",
            }),
          },
        }),
      );
    });

    const sheet = container.querySelector(".bs-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute("data-active")).toBe("min");

    const header = container.querySelector(".bs-handle h2");
    expect(header?.textContent).toBe("Configured");

    const body = container.querySelector('[data-testid="body"]');
    expect(body?.textContent).toBe("config body");

    // No warnings emitted on the happy path.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns and falls back when version is unsupported", async () => {
    const config = {
      // Cast through unknown — TS rightly refuses `version: 2` against
      // the literal-1 schema; the test exercises the runtime guard.
      version: 2,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
    } as unknown as SheetConfig;

    await act(async () => {
      root.render(
        jsx(BottomSheetFromConfig, {
          config,
          slotContent: { body: jsx("div", { children: "x" }) },
        }),
      );
    });

    // Warned about the unsupported version.
    const messages = warnSpy.mock.calls.map((call: unknown[]) =>
      String(call[0]),
    );
    expect(messages.some((m: string) => m.includes("Unsupported config version"))).toBe(
      true,
    );

    // Sheet still renders with the fallback default snap (single "default" full).
    const sheet = container.querySelector(".bs-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute("data-active")).toBe("default");
  });

  it("warns when snapPoints are missing and renders a safe default", async () => {
    const config = {
      version: 1,
      // Intentionally omitted — exercise the missing-required-field branch.
    } as unknown as SheetConfig;

    await act(async () => {
      root.render(
        jsx(BottomSheetFromConfig, {
          config,
          slotContent: { body: jsx("div", { children: "x" }) },
        }),
      );
    });

    const messages = warnSpy.mock.calls.map((call: unknown[]) =>
      String(call[0]),
    );
    expect(
      messages.some((m: string) =>
        m.includes("config.snapPoints is missing or empty"),
      ),
    ).toBe(true);

    const sheet = container.querySelector(".bs-sheet");
    expect(sheet).not.toBeNull();
    // Falls back to the single-default snap geometry.
    expect(sheet?.getAttribute("data-active")).toBe("default");
  });

  it("dispatches snap events to the handler keyed by config.events.onSnap", async () => {
    const ref = createRef<BottomSheetHandle>();
    const logger = vi.fn();
    const config: SheetConfig = {
      version: 1,
      snapPoints: [
        { id: "min", size: 100 },
        { id: "full", size: 800 },
      ],
      initial: "min",
      animation: "tween",
      behavior: { closeOnEscape: false },
      events: { onSnap: "logger" },
    };

    await act(async () => {
      root.render(
        jsx(BottomSheetFromConfig, {
          ref,
          config,
          eventHandlers: { logger },
          slotContent: { body: jsx("div", { children: "x" }) },
        }),
      );
    });

    // Initial mount fires onChange with the initial snap → logger called.
    await flushAsync();
    expect(logger).toHaveBeenCalledWith("min");

    logger.mockClear();

    await act(async () => {
      await ref.current?.snapTo("full");
    });
    await flushAsync();

    expect(logger).toHaveBeenCalledWith("full");
  });
});
