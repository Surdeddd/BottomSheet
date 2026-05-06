// Shared DOM scaffold for engine + features + gesture tests.
//
// Why: four test files were duplicating the same 15-line factory that wires
// a sheet, handle, content, and backdrop into document.body and stubs Pointer
// Capture (which happy-dom doesn't implement). Centralizing the factory keeps
// the contract for "what the engine expects in the DOM" in one place — when
// the engine's required surface changes (e.g. it starts asking handle for a
// new method), there's exactly one helper to update.
//
// `scrollContainer` is exposed under both names so tests that want a scroll
// surface separate from `content` (overlay tests, future scroll-lock tests)
// can read either alias. By default they point at the same node — `content`
// IS the scroll surface in the existing test pattern.

export type DomNodes = {
  root: HTMLElement;
  sheet: HTMLElement;
  handle: HTMLElement;
  content: HTMLElement;
  backdrop: HTMLElement;
  scrollContainer: HTMLElement;
};

export const makeDom = (): DomNodes => {
  // Reset between tests — happy-dom keeps document.body across `it()` calls
  // unless explicitly torn down. Without this, prior nodes leak into the next
  // engine's queries (e.g. body.firstChild lookups).
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
  // happy-dom doesn't implement Pointer Capture — stub to avoid TypeError
  // when the engine calls setPointerCapture during pointerdown.
  Object.assign(handle, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  return { root, sheet, handle, content, backdrop, scrollContainer: content };
};
