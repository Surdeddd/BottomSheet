import type { EngineFeature } from "../types";
import { SETTLE_ANIMATION_ID } from "../animation/waapi-settle";

const INSET_VAR = "--bs-content-inset";
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
      const waapi = ctx.options.settleAnimation === "waapi";
      let inset = 0;
      let unpaddedMax = -1;
      let top = 0;
      let resting = false;
      let liftMax = 0;
      let followed: Animation | null = null;
      let follower: Animation | null = null;

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

      const unfollow = (): void => {
        follower?.cancel();
        follower = null;
        followed = null;
      };

      const followSettle = (): void => {
        if (followed?.playState === "running") return;
        const settleAnim = sheet
          .getAnimations?.()
          .find(a => a.id === SETTLE_ANIMATION_ID);
        const footer = sheet.querySelector<HTMLElement>(".bs-footer");
        if (!settleAnim || !footer) return;
        const effect = settleAnim.effect as KeyframeEffect;
        unfollow();
        const own = footer.animate(
          effect.getKeyframes().map(k => ({
            offset: k.computedOffset,
            transform: `translateY(${-Math.min(
              Math.max(0, parseFloat(String(k.transform).split(",")[1]!) || 0),
              liftMax,
            )}px)`,
          })),
          {
            duration: effect.getTiming().duration,
            easing: "linear",
            fill: "forwards",
          },
        );
        follower = own;
        followed = settleAnim;
        const done = (): void => {
          if (followed === settleAnim) unfollow();
        };
        settleAnim.ready.then(() => {
          if (follower === own) own.startTime = settleAnim.startTime;
        }, done);
        settleAnim.finished.then(done, done);
      };

      const settle = (): void => {
        if (ctx.isDestroyed()) return;
        unfollow();
        const size = ctx.getSize();
        if (!resting) {
          unpaddedMax = -1;
          follow(size);
        }
        inset = hiddenAt(size);
        put(INSET_VAR, inset);
        put(CAP_VAR, ctx.getMaxAxisSize());
        if (!resting) {
          resting = true;
          sheet.setAttribute(FIT_ATTR, "rest");
        }
        unpaddedMax = -1;
      };

      const move = (size: number): void => {
        if (resting) {
          resting = false;
          sheet.setAttribute(FIT_ATTR, "moving");
          liftMax = scroller.offsetHeight;
          put(LIFT_VAR, liftMax);
        }
        follow(size);
        if (waapi && ctx.isAnimating() && sheet.dataset.mode === "bottom") {
          followSettle();
        }
      };

      const moving = (): boolean => ctx.isAnimating() || ctx.isDragging();

      const whenIdle = (): void => {
        if (!moving()) settle();
      };

      settle();
      const offProgress = ctx.on("progress", p =>
        moving() ? move(p.size) : settle(),
      );
      const offSnap = ctx.on("snap", settle);
      const offDragStart = ctx.on("dragstart", () => move(ctx.getSize()));
      const offBeforeSnap = ctx.on("before-snap", () => {
        queueMicrotask(() => {
          if (!ctx.isDestroyed() && ctx.isAnimating()) move(ctx.getSize());
        });
      });
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(whenIdle);
      observer?.observe(document.documentElement);
      window.addEventListener("orientationchange", whenIdle);

      return () => {
        unfollow();
        offProgress();
        offSnap();
        offDragStart();
        offBeforeSnap();
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
