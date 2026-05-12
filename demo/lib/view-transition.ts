type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
};

type DocVT = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

export const startViewTransition = (cb: () => void): void => {
  const vt = (document as DocVT).startViewTransition;
  if (typeof vt === "function") {
    const transition = vt.call(document, cb);
    transition.finished.catch(() => {});
  } else {
    cb();
  }
};
