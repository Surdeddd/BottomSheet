import type { EngineFeature } from "../types";

const INSET_VAR = "--bs-content-inset";
const SIZE_VAR = "--bs-size";
const CAP_VAR = "--bs-max-size";
const LIFT_VAR = "--bs-footer-lift-max";
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

      const put = (name: string, px: number): void =>
        sheet.style.setProperty(name, `${px}px`);

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
        put(LIFT_VAR, scroller.offsetHeight);
        put(INSET_VAR, inset);
        put(SIZE_VAR, size);
        put(CAP_VAR, ctx.getMaxAxisSize());
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
        for (const name of [INSET_VAR, CAP_VAR, LIFT_VAR]) {
          sheet.style.removeProperty(name);
        }
      };
    },
  };
}
