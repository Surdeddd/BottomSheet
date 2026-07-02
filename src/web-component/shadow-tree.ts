export type ShadowRefs = {
  sheet: HTMLElement;
  handle: HTMLElement;
  header: HTMLElement;
  content: HTMLElement;
  footer: HTMLElement;
  backdrop: HTMLElement;
  screen: HTMLElement;
  leftButton: HTMLElement;
  rightButton: HTMLElement;
  announcer: HTMLElement;
};

const buildSlot = (name: string): HTMLSlotElement => {
  const slot = document.createElement("slot");
  slot.name = name;
  return slot;
};

const buildSlotRegion = (name: string, className: string): HTMLElement => {
  const region = document.createElement("div");
  region.className = className;
  region.setAttribute("part", name);
  const slot = buildSlot(name);
  region.appendChild(slot);
  const sync = (): void => {
    region.hidden = slot.assignedNodes({ flatten: true }).length === 0;
  };
  slot.addEventListener("slotchange", sync);
  sync();
  return region;
};

export const buildShadowTree = (): {
  fragment: DocumentFragment;
  refs: ShadowRefs;
} => {
  const root = document.createElement("div");
  root.className = "bs-root";

  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";
  backdrop.setAttribute("part", "backdrop");

  const screen = document.createElement("div");
  screen.className = "bs-screen";
  screen.setAttribute("part", "screen");
  screen.appendChild(buildSlot("screen"));

  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.setAttribute("part", "sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "false");

  const leftButton = document.createElement("div");
  leftButton.className = "bs-button-slot";
  leftButton.setAttribute("data-side", "left");
  leftButton.setAttribute("part", "left-button");
  leftButton.appendChild(buildSlot("leftButton"));

  const rightButton = document.createElement("div");
  rightButton.className = "bs-button-slot";
  rightButton.setAttribute("data-side", "right");
  rightButton.setAttribute("part", "right-button");
  rightButton.appendChild(buildSlot("rightButton"));

  const handle = document.createElement("div");
  handle.className = "bs-handle";
  handle.setAttribute("part", "handle");
  handle.setAttribute("role", "slider");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("aria-label", "Resize sheet");

  const header = buildSlotRegion("header", "bs-header");

  const content = document.createElement("div");
  content.className = "bs-content";
  content.setAttribute("part", "content");

  content.setAttribute("tabindex", "0");
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "Sheet content");
  const defaultSlot = document.createElement("slot");
  content.appendChild(defaultSlot);

  const footer = buildSlotRegion("footer", "bs-footer");

  const announcer = document.createElement("span");
  announcer.className = "bs-sr-announce";
  announcer.setAttribute("role", "status");
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  announcer.style.cssText =
    "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);";

  sheet.append(handle, header, content, footer);
  root.append(backdrop, screen, sheet, leftButton, rightButton, announcer);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(root);

  return {
    fragment,
    refs: {
      sheet,
      handle,
      header,
      content,
      footer,
      backdrop,
      screen,
      leftButton,
      rightButton,
      announcer,
    },
  };
};
