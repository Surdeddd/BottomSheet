/**
 * Crossfade helper using the native View Transitions API. When supported,
 * `document.startViewTransition(cb)` snapshots the page, runs `cb`, and
 * crossfades the before/after states. Browsers without the API silently
 * run `cb` synchronously — feature degradation is invisible.
 *
 * Used to add motion to high-impact demo swaps:
 *   - adapter switch (React → Vue → Svelte ...)
 *   - theme toggle (light / dark)
 *   - language toggle (en / ru)
 *
 * The browser respects `prefers-reduced-motion` at the View Transitions
 * layer — we don't need to gate the call ourselves. CSS controls duration
 * and easing via the `::view-transition-{old,new}(name)` pseudo-elements
 * (see demo/style.css for the `device-frame` group).
 */
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
    // Swallow rejections from `.finished` — when a competing transition
    // cancels this one (e.g. user clicks another adapter mid-crossfade),
    // the promise rejects with `AbortError`. We don't surface it to the
    // user; the next transition starts cleanly. Without this catch it
    // becomes an unhandled-rejection in the console.
    transition.finished.catch(() => {});
  } else {
    cb();
  }
};
