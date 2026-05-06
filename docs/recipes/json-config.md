# JSON config

> Render a sheet from a structured config object — a CMS field, A/B variant,
> plugin manifest, or server-driven loader — without wiring props by hand.

## Why

When the source of truth lives outside the code (CMS, feature flag, plugin,
RSC loader), passing a single JSON-serializable config is cleaner than
spreading props. `<BottomSheetFromConfig>` is a thin wrapper that does it.

## Config shape

```json
{
  "version": 1,
  "snapPoints": [
    { "id": "min", "size": 96 },
    { "id": "full", "size": "85%" }
  ],
  "initial": "min",
  "animation": "spring",
  "behavior": {
    "focusTrap": true,
    "closeOnEscape": true,
    "closeOnBackdrop": true,
    "lockBodyScroll": true,
    "rubberBand": true
  },
  "events": { "onSnap": "log" }
}
```

`version` is required for forward compat. Functions can't live in JSON, so
`events.onSnap` stores a **handler key** — the actual callback is supplied
via the sibling `eventHandlers` prop.

## Render

```tsx
import {
  BottomSheetFromConfig,
  type SheetConfig,
} from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

const config: SheetConfig = await fetch("/api/cms/sheet").then(r => r.json());

export function CmsSheet() {
  return (
    <BottomSheetFromConfig
      config={config}
      eventHandlers={{ log: id => console.log("snap:", id) }}
      slotContent={{
        header: <h2>Filters</h2>,
        body: <div style={{ padding: 16 }}>Content from your app.</div>,
      }}
    />
  );
}
```

## Use cases

- **Headless CMS** — content team edits sheet geometry/behavior in a CMS
  field; app re-fetches and re-renders without a redeploy.
- **A/B testing** — feature-flag service returns variant-specific config
  (e.g. `peek` snap height); component code stays identical.
- **Plugin systems** — third-party extension ships a JSON manifest
  describing its sheet; host renders it without the plugin bundling React.
- **Server-driven UI** — Next.js loader / RSC route returns sheet config
  alongside page data; `<BottomSheetFromConfig config={data.sheet} />`.

## Validation

The wrapper validates `version === 1` and the presence of `snapPoints` at
runtime. On mismatch it `console.warn`s and falls back to a safe single-snap
default — bad CMS data degrades visibly, never crashes the page.

See also: [`docs/react.md`](../react.md) · [main README](../../README.md).
