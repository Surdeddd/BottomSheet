import { LitElement, html } from "lit";
import "@surdeddd/bottom-sheet/element"; // registers <bottom-sheet>
import "@surdeddd/bottom-sheet/styles";

const snapPoints = [
  { id: "minimized", size: 96 },
  { id: "half", size: "45dvh" },
  { id: "full", size: "85%" },
];

class DemoSheet extends LitElement {
  // Disable shadow DOM so the inner <bottom-sheet> light-DOM children inherit
  // page styles (the global styles.css selectors target light DOM).
  protected createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <bottom-sheet
        snap-points=${JSON.stringify(snapPoints)}
        initial="minimized"
        animation="spring"
        focus-trap="true"
        close-on-escape="true"
      >
        <h2 slot="header" style="margin: 0; padding: 12px 20px">Search vehicles</h2>
        <ul class="sheet-list">
          ${Array.from({ length: 12 }, (_, i) => html`<li>Item #${i + 1}</li>`)}
        </ul>
      </bottom-sheet>
    `;
  }
}

customElements.define("demo-sheet", DemoSheet);
