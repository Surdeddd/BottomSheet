/**
 * Body-scroll lock that survives multiple sheets opening at once.
 *
 * The first call snapshots `document.body` overflow + position + top, sets
 * `position: fixed; top: -<scrollY>` to freeze the page in place (iOS-safe),
 * and returns a release function. The Nth call only increments the lock
 * counter; the page is restored when the counter drops back to 0.
 */
let lockCount = 0;
let savedStyles: {
  overflow: string;
  position: string;
  top: string;
  width: string;
  scrollY: number;
} | null = null;

export const lockBodyScroll = (): (() => void) => {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) {
    const body = document.body;
    savedStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      scrollY: window.scrollY,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedStyles.scrollY}px`;
    body.style.width = "100%";
  }
  lockCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0 && savedStyles) {
      const body = document.body;
      body.style.overflow = savedStyles.overflow;
      body.style.position = savedStyles.position;
      body.style.top = savedStyles.top;
      body.style.width = savedStyles.width;
      window.scrollTo(0, savedStyles.scrollY);
      savedStyles = null;
    }
  };
};

export const __resetScrollLockForTests = (): void => {
  lockCount = 0;
  savedStyles = null;
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
  }
};
