export type ContentDragDeps = {
  container: HTMLElement;
  attachDragSurface: (
    surface: HTMLElement,
    kind: "content",
  ) => (() => void) | void;
};

/**
 * Hands the scroll container to the engine as a drag surface — the physics,
 * gating and drag-vs-scroll arbitration all live in the core.
 */
export function installContentDrag(deps: ContentDragDeps): () => void {
  const detach = deps.attachDragSurface(deps.container, "content");
  return () => detach?.();
}
