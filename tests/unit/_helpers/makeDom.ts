
export type DomNodes = {
  root: HTMLElement;
  sheet: HTMLElement;
  handle: HTMLElement;
  content: HTMLElement;
  backdrop: HTMLElement;
  scrollContainer: HTMLElement;
};

export const makeDom = (): DomNodes => {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
  const root = document.body;
  const sheet = document.createElement("section");
  const handle = document.createElement("div");
  const content = document.createElement("div");
  const backdrop = document.createElement("div");
  sheet.appendChild(handle);
  sheet.appendChild(content);
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { root, sheet, handle, content, backdrop, scrollContainer: content };
};
