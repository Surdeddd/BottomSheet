type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
};

type DocVT = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

/**
 * Run a DOM update optionally wrapped in View Transitions.
 * Falls back to a sync callback when VT is missing, reduced-motion is on,
 * or the API throws (headless Chromium flakes).
 */
export const startViewTransition = (cb: () => void): void => {
  const prefersReduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    cb();
    return;
  }

  const vt = (document as DocVT).startViewTransition;
  if (typeof vt === "function") {
    try {
      const transition = vt.call(document, cb);
      transition.finished.catch(() => {});
      return;
    } catch {
      // fall through to sync
    }
  }
  cb();
};
