import { $ } from "./types";

export type StressDeps = {
  getController: () => {
    snapTo: (id: string) => void;
    getState?: () => { activeId: string } | null;
  } | null;
};

const DURATION_MS = 8000;
const START_INTERVAL_MS = 1000;
const MIN_INTERVAL_MS = 60;
const DECAY = 0.85;

/**
 * Cycles the sheet between its smallest and largest snap at a shrinking
 * interval. It never navigates or remounts anything — it only calls snapTo —
 * but it used to abandon the sheet wherever the last cycle landed and keep its
 * timer alive after the page moved on, which read as the demo resetting itself.
 */
export const wireStressTest = (deps: StressDeps): (() => void) => {
  const status = $<HTMLElement>("#stress-status");
  const button = $<HTMLButtonElement>("#stress-start");
  const idleLabel = button.textContent ?? "stress";

  let timer: number | null = null;
  let restoreTo: string | null = null;

  const stop = (finalText: string): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    button.textContent = idleLabel;
    button.setAttribute("aria-pressed", "false");
    // put the sheet back where the run found it
    if (restoreTo) {
      deps.getController()?.snapTo(restoreTo);
      restoreTo = null;
    }
    status.textContent = finalText;
  };

  const start = (): void => {
    restoreTo = deps.getController()?.getState?.()?.activeId ?? null;
    button.textContent = "■ stop";
    button.setAttribute("aria-pressed", "true");

    let cycle = 0;
    let interval = START_INTERVAL_MS;
    let toMax = true;
    const startedAt = performance.now();

    const tick = (): void => {
      const controller = deps.getController();
      if (!controller) {
        stop("controller gone");
        return;
      }
      controller.snapTo(toMax ? "full" : "minimized");
      toMax = !toMax;
      cycle++;
      interval = Math.max(MIN_INTERVAL_MS, interval * DECAY);

      const elapsed = performance.now() - startedAt;
      if (elapsed > DURATION_MS) {
        stop(`done · ${cycle} cycles`);
        return;
      }
      status.textContent = `cycle ${cycle} · ${Math.round(interval)}ms · ${Math.round(elapsed / 1000)}s`;
      timer = window.setTimeout(tick, interval);
    };

    timer = window.setTimeout(tick, interval);
  };

  const onClick = (): void => {
    if (timer !== null) stop("stopped");
    else start();
  };
  button.addEventListener("click", onClick);

  // a run that outlives its page keeps snapping into a dead controller
  const onPageHide = (): void => {
    if (timer !== null) stop("stopped");
  };
  window.addEventListener("pagehide", onPageHide);

  return () => {
    button.removeEventListener("click", onClick);
    window.removeEventListener("pagehide", onPageHide);
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
};
