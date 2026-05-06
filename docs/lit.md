# @surdeddd/bottom-sheet · Lit (recipe)

The library already ships a Web Component (`<bottom-sheet>`) — Lit users
can drop it directly into templates without a wrapper.

```ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "@surdeddd/bottom-sheet/element";
import styles from "@surdeddd/bottom-sheet/styles?inline";

@customElement("my-app")
export class MyApp extends LitElement {
  render() {
    return html`
      <link rel="stylesheet" href="@surdeddd/bottom-sheet/styles" />
      <bottom-sheet
        snap-points='[{"id":"min","size":96},{"id":"half","size":"45%"},{"id":"full","size":"85%"}]'
        initial="min"
        animation="spring"
        focus-trap="true"
        @snap=${(e: CustomEvent) => console.log("snap", e.detail.id)}
      >
        <h2 slot="header">Search</h2>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </bottom-sheet>
    `;
  }
}
```

## Notes

- The `<bottom-sheet>` element auto-registers on import. To use a custom tag
  name, import `defineBottomSheet` directly:

  ```ts
  import { defineBottomSheet } from "@surdeddd/bottom-sheet/element";
  defineBottomSheet("my-sheet");
  ```

- Lit's `@event` syntax binds directly to the element's `CustomEvent`s
  (`snap`, `open`, `close`, `progress`, `drag`, `dragstart`, `dragend`).
- The component uses Shadow DOM. Style via `::part(sheet)`, `::part(handle)`,
  etc. Or pass `stylesheet="…"` for full control.
