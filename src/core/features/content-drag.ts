export type ContentDragDeps = {
  container: HTMLElement;
  attachDragSurface: (
    surface: HTMLElement,
    kind: "content",
  ) => (() => void) | void;
};

export function installContentDrag(deps: ContentDragDeps): () => void {
  const detach = deps.attachDragSurface(deps.container, "content");
  return () => detach?.();
}
