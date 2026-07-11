# Plugins

`engine.use(plugin)` lets you extend a `BottomSheetEngine` instance without
modifying the engine itself. A plugin is just an object with a `name` and
an `install` function:

```ts
import type { Plugin } from "@surdeddd/bottom-sheet";

const myPlugin: Plugin = {
  name: "my-plugin",
  install(engine) {
    // run setup; optionally return a teardown function
  },
};

engine.use(myPlugin);
```

## Contract

| Guarantee | Detail |
|---|---|
| **Install timing** | `install` runs once, synchronously, after the engine constructor finishes. The engine is fully initialised. |
| **Engine state** | All public methods are safe to call from `install` — `engine.snapTo`, `engine.on`, `engine.state`, etc. |
| **Teardown** | If `install` returns a `() => void`, the engine captures it. `destroy()` drains all teardowns in LIFO order. |
| **Error isolation** | A throwing teardown is wrapped in `queueMicrotask(() => { throw err })` so it surfaces async without taking down siblings. |
| **Multiple plugins** | Order matters for teardown only (LIFO). Install order is FIFO based on `engine.use()` calls. |

### Don'ts

- **Don't** call `engine.destroy()` from within `install` — it'll race with
  the constructor's tail.
- **Don't** mutate engine private state by reaching through `as any`. The
  public API is stable; private fields are not.
- **Don't** assume your `install` runs before the engine emits its first
  `snap` event. If the engine was constructed already-open, `snap` may
  fire before any plugin gets a chance to subscribe.

## Worked example: analytics tracker

A plugin that logs every snap transition to your analytics provider, plus
the time the sheet stays at each snap before the next one.

```ts
import type { Plugin } from "@surdeddd/bottom-sheet";

type AnalyticsClient = {
  track: (event: string, props?: Record<string, unknown>) => void;
};

export function createAnalyticsPlugin(client: AnalyticsClient): Plugin {
  return {
    name: "analytics",
    install(engine) {
      let lastSnapAt = performance.now();
      let lastSnapId = engine.state.activeId;

      const offSnap = engine.on("snap", ({ id, size }) => {
        const now = performance.now();
        client.track("bottom_sheet_snap", {
          fromId: lastSnapId,
          toId: id,
          size,
          dwellMs: Math.round(now - lastSnapAt),
        });
        lastSnapAt = now;
        lastSnapId = id;
      });

      const offOpen = engine.on("open", ({ id }) => {
        client.track("bottom_sheet_open", { id });
      });

      const offClose = engine.on("close", () => {
        client.track("bottom_sheet_close", {
          finalDwellMs: Math.round(performance.now() - lastSnapAt),
        });
      });

      return () => {
        offSnap();
        offOpen();
        offClose();
      };
    },
  };
}

// Usage:
engine.use(createAnalyticsPlugin(myAnalyticsClient));
```

## Worked example: form-dirty guard

A plugin that prevents the sheet from closing when an internal form is
dirty. Demonstrates the `before-snap` cancel pattern — the synchronous
window where listeners can veto a transition.

```ts
import type { Plugin } from "@surdeddd/bottom-sheet";

export function createDirtyGuard(getDirty: () => boolean): Plugin {
  return {
    name: "dirty-guard",
    install(engine) {
      return engine.on("before-snap", e => {
        // Only block transitions that close the sheet (size === 0).
        if (e.size === 0 && getDirty()) {
          if (confirm("You have unsaved changes. Discard?")) return;
          e.cancel();
        }
      });
    },
  };
}

// Usage with React — install once. `engine.use()` returns the engine (not a
// per-plugin teardown), and a plugin lives for the engine's lifetime, so read
// the latest `dirty` through a ref instead of re-installing on every change.
const [dirty, setDirty] = useState(false);
const dirtyRef = useRef(dirty);
dirtyRef.current = dirty;

const sheet = useBottomSheet({ snapPoints });
useEffect(() => {
  const engine = sheet.getEngine();
  if (!engine) return;
  engine.use(createDirtyGuard(() => dirtyRef.current));
}, [sheet]);
```

> **Important:** `cancel()` MUST be called synchronously inside the listener.
> Async cancels (captured into a microtask, promise, or `setTimeout`) are
> ignored and emit a console warning — see `emitBeforeSnap` in the engine
> source for the freeze mechanism.

## Worked example: state persistence to a custom backend

The engine ships `persistKey` for `localStorage` persistence. If you need
sessionStorage, IndexedDB, or a remote sync, write a plugin instead.

```ts
import type { Plugin } from "@surdeddd/bottom-sheet";

export function createRemotePersist(
  key: string,
  backend: { read: () => Promise<string | null>; write: (id: string) => void },
): Plugin {
  return {
    name: "remote-persist",
    install(engine) {
      // Hydrate from backend on next microtask (engine state already
      // initialised — we only override if there's a remote value).
      backend.read().then(savedId => {
        if (savedId && engine.state.activeId !== savedId) {
          engine.snapTo(savedId);
        }
      });

      // Persist on every settle.
      return engine.on("snap", ({ id }) => {
        try {
          backend.write(id);
        } catch (err) {
          console.warn(`[bs/${key}] persist failed`, err);
        }
      });
    },
  };
}
```

## Plugins vs features

The engine's built-in **features** (`src/core/features/*`) follow the same
shape as a plugin (`Deps` interface + teardown), but they're wired by the
constructor and respond to engine config (`opts.persistKey`, `opts.routedTo`,
etc.). Use a feature when the behaviour belongs to the engine's contract
and is gated by a config option. Use a plugin when the behaviour is
external integration (analytics, telemetry, custom storage, app-specific
guards).

If you're authoring a feature, see `docs/ARCHITECTURE.md` § "Feature
factories" for the naming and pattern conventions.
