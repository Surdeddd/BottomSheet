type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
};

type DocVT = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

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

    }
  }
  cb();
};
