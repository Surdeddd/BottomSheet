import type { DemoSettings } from "../../apps/shared";

const jsxFlag = (name: string, on: boolean): string =>
  on ? `  ${name}\n` : `  ${name}={false}\n`;

export function genOverlayReact(settings: DemoSettings): string {
  return `// React
import { Overlay } from "@surdeddd/bottom-sheet/react";
import "@surdeddd/bottom-sheet/styles";

const [open, setOpen] = useState(false);
<Overlay
  open={open}
  onClose={() => setOpen(false)}
  edge="bottom"
${jsxFlag("focusTrap", settings.focusTrap)}${jsxFlag("closeOnEscape", settings.closeOnEscape)}>
  <AccountMenu />
</Overlay>`;
}

export function genOverlayEngine(settings: DemoSettings): string {
  return `// Overlay: one engine for every framework
import { OverlayEngine } from "@surdeddd/bottom-sheet/overlay";
import "@surdeddd/bottom-sheet/styles";

const overlay = new OverlayEngine({
  element: document.querySelector(".ovl-panel"),
  backdrop: document.querySelector(".ovl-backdrop"),
  edge: "bottom",
  focusTrap: ${settings.focusTrap},
  closeOnEscape: ${settings.closeOnEscape},
});
overlay.open();`;
}
