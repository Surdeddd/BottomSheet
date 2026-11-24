# Lit

Lit needs no adapter. The package's [custom element](web-component.md) goes
straight into a template, and Lit's bindings cover its attributes, properties
and events.

```ts
import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "@surdeddd/bottom-sheet/element";

@customElement("filter-panel")
export class FilterPanel extends LitElement {
  @state() private active = "closed";
  @query("bottom-sheet") private sheet!: HTMLElement & { open(): Promise<unknown> };

  render() {
    return html`
      <button @click=${() => this.sheet.open()}>Filters (${this.active})</button>

      <bottom-sheet
        snap-points="closed:0,open:fit"
        focus-trap="true"
        .options=${{ closeOnBack: true }}
        @snap=${(event: CustomEvent<{ id: string }>) => (this.active = event.detail.id)}
      >
        <h2 slot="header">Filters</h2>
        <slot></slot>
      </bottom-sheet>
    `;
  }
}
```

- **No stylesheet.** The element carries its styles in its own shadow root.
  Theme it with the `--bs-*` custom properties, which cross shadow boundaries,
  or with `::part()`. See [Theming](theming.md).
- **Attributes, properties, events.** `snap-points="…"` sets an attribute,
  `.options=${…}` sets a property (the way to pass options that are not
  strings), `@snap=${…}` listens to an event. The
  [element guide](web-component.md) lists all three.
- **Cancelable events.** `before-snap` and `before-close` are stopped with
  `event.preventDefault()`.
- **Another tag name.** `defineBottomSheet("app-sheet")` registers the element
  under a name of your choice.
