import { shared } from "../primitives/shared";

type SavedStyles = {
  overflow: string;
  position: string;
  top: string;
  width: string;
  paddingRight: string;
  scrollY: number;
};

const state = shared("scrollLock", () => ({
  count: 0,
  saved: null as SavedStyles | null,
}));

export const lockBodyScroll = (): (() => void) => {
  if (typeof document === "undefined") return () => {};
  if (state.count === 0) {
    const body = document.body;
    const saved: SavedStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
      scrollY: window.scrollY,
    };
    state.saved = saved;
    const scrollbarGap =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarGap > 0) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarGap}px`;
    }
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${saved.scrollY}px`;
    body.style.width = "100%";
  }
  state.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count = Math.max(0, state.count - 1);
    if (state.count === 0 && state.saved) {
      const body = document.body;
      const saved = state.saved;
      body.style.overflow = saved.overflow;
      body.style.position = saved.position;
      body.style.top = saved.top;
      body.style.width = saved.width;
      body.style.paddingRight = saved.paddingRight;
      window.scrollTo(0, saved.scrollY);
      state.saved = null;
    }
  };
};

export const __resetScrollLockForTests = (): void => {
  state.count = 0;
  state.saved = null;
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";
  }
};
