import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installPersist,
  readPersistedId,
  type PersistEngine,
} from "../../src/core/features/persist";

type SnapListener = (payload: { id: string }) => void;

const fakeEngine = () => {
  const listeners = new Set<SnapListener>();
  const engine = {
    on: (_event: string, fn: SnapListener) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  } as unknown as PersistEngine;
  return {
    engine,
    snap: (id: string) => listeners.forEach(fn => fn({ id })),
    count: () => listeners.size,
  };
};

describe("persist", () => {
  let store: Record<string, string>;
  let broken: boolean;
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    store = {};
    broken = false;
    original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => {
          if (broken) throw new Error("blocked");
          return key in store ? store[key] : null;
        },
        setItem: (key: string, value: string) => {
          if (broken) throw new Error("quota");
          store[key] = String(value);
        },
      },
    });
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
    else delete (window as { localStorage?: unknown }).localStorage;
  });

  it("stores the id of every snap under the key", () => {
    const { engine, snap } = fakeEngine();
    installPersist(engine, "sheet");
    snap("half");
    expect(store.sheet).toBe("half");
    snap("full");
    expect(store.sheet).toBe("full");
  });

  it("stops storing once it is torn down", () => {
    const { engine, snap, count } = fakeEngine();
    const detach = installPersist(engine, "sheet");
    detach();
    expect(count()).toBe(0);
    snap("half");
    expect(store.sheet).toBeUndefined();
  });

  it("reads back what was stored", () => {
    store.sheet = "half";
    expect(readPersistedId("sheet")).toBe("half");
    expect(readPersistedId("other")).toBeNull();
  });

  it("reads nothing without a key", () => {
    store[""] = "half";
    expect(readPersistedId(undefined)).toBeNull();
    expect(readPersistedId("")).toBeNull();
  });

  it("survives a storage that refuses to be read or written", () => {
    broken = true;
    expect(readPersistedId("sheet")).toBeNull();

    const { engine, snap } = fakeEngine();
    installPersist(engine, "sheet");
    expect(() => snap("half")).not.toThrow();
  });
});
