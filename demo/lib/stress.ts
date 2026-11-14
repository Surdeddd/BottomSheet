import { t } from "./i18n";
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

export const wireStressTest = (deps: StressDeps): (() => void) => {
  const status = $<HTMLElement>("#stress-status");
  const button = $<HTMLButtonElement>("#stress-start");

  const report = (key: string, values: Record<string, number> = {}): void => {
    delete status.dataset.i18n;
    status.textContent = t(key).replace(
      /%([nis])/g,
      (_match: string, name: string) => String(values[name] ?? ""),
    );
  };

  let timer: number | null = null;
  let restoreTo: string | null = null;

  const stop = (key: string, values?: Record<string, number>): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    button.textContent = t("adv.stress.run");
    button.setAttribute("aria-pressed", "false");

    if (restoreTo) {
      deps.getController()?.snapTo(restoreTo);
      restoreTo = null;
    }
    report(key, values);
  };

  const start = (): void => {
    restoreTo = deps.getController()?.getState?.()?.activeId ?? null;
    button.textContent = t("adv.stress.stop");
    button.setAttribute("aria-pressed", "true");

    let cycle = 0;
    let interval = START_INTERVAL_MS;
    let toMax = true;
    const startedAt = performance.now();

    const tick = (): void => {
      const controller = deps.getController();
      if (!controller) {
        stop("adv.stress.gone");
        return;
      }
      controller.snapTo(toMax ? "full" : "minimized");
      toMax = !toMax;
      cycle++;
      interval = Math.max(MIN_INTERVAL_MS, interval * DECAY);

      const elapsed = performance.now() - startedAt;
      if (elapsed > DURATION_MS) {
        stop("adv.stress.done", { n: cycle });
        return;
      }
      report("adv.stress.cycle", {
        n: cycle,
        i: Math.round(interval),
        s: Math.round(elapsed / 1000),
      });
      timer = window.setTimeout(tick, interval);
    };

    timer = window.setTimeout(tick, interval);
  };

  const onClick = (): void => {
    if (timer !== null) stop("adv.stress.stopped");
    else start();
  };
  button.addEventListener("click", onClick);

  const onPageHide = (): void => {
    if (timer !== null) stop("adv.stress.stopped");
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
