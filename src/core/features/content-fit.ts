import type { EngineFeature } from "../types";

const INSET_VAR = "--bs-content-inset";
const FIT_ATTR = "data-bs-fit-content";

export function contentFitFeature(): EngineFeature {
  return {
    name: "content-fit",
    install: ctx => {
      const scroller = ctx.scrollContainer;
      if (
        !ctx.options.fitContentToSnap ||
        !scroller ||
        typeof window === "undefined"
      ) {
        return;
      }
      const sheet = ctx.element;
      let inset = 0;
      let unpaddedMax = -1;
      let top = 0;

      const hiddenAt = (size: number): number =>
        sheet.dataset.mode === "bottom"
          ? Math.max(0, ctx.getMaxAxisSize() - size)
          : 0;

      const follow = (size: number): void => {
        if (unpaddedMax < 0) {
          unpaddedMax = scroller.scrollHeight - scroller.clientHeight - inset;
          top = scroller.scrollTop;
        }
        const limit = Math.max(0, unpaddedMax + hiddenAt(size));
        if (top > limit) {
          if (scroller.scrollTop > limit) scroller.scrollTop = limit;
          top = limit;
        }
      };

      const settle = (): void => {
        if (ctx.isDestroyed()) return;
        const size = ctx.getSize();
        unpaddedMax = -1;
        follow(size);
        inset = hiddenAt(size);
        sheet.style.setProperty(INSET_VAR, `${inset}px`);
        unpaddedMax = -1;
      };

      const moving = (): boolean => ctx.isAnimating() || ctx.isDragging();

      const whenIdle = (): void => {
        if (!moving()) settle();
      };

      sheet.setAttribute(FIT_ATTR, "");
      settle();
      const offProgress = ctx.on("progress", p =>
        moving() ? follow(p.size) : settle(),
      );
      const offSnap = ctx.on("snap", settle);
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(whenIdle);
      observer?.observe(document.documentElement);
      window.addEventListener("orientationchange", whenIdle);

      return () => {
        offProgress();
        offSnap();
        observer?.disconnect();
        window.removeEventListener("orientationchange", whenIdle);
        sheet.removeAttribute(FIT_ATTR);
        sheet.style.removeProperty(INSET_VAR);
      };
    },
  };
}
