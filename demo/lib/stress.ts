import { $ } from "./types";

export type StressDeps = {
  // Engine handle gives `snapTo` directly. We pull it via getter so the
  // stress loop always targets the currently-mounted adapter, not a stale
  // controller from the moment the button was wired.
  getController: () => { snapTo: (id: string) => void } | null;
};

/**
 * Stress test: cycles min↔full at progressively shorter intervals over 8s.
 * Click the button to stop early. Status text updates live for the user.
 */
export const wireStressTest = (deps: StressDeps): void => {
  const status = $<HTMLElement>("#stress-status");
  let timer: number | null = null;

  $<HTMLButtonElement>("#stress-start").addEventListener("click", () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
      status.textContent = "stopped";
      return;
    }
    let cycle = 0;
    let interval = 1000;
    let isMin = true;
    const startTs = performance.now();
    const tick = (): void => {
      deps.getController()?.snapTo(isMin ? "full" : "minimized");
      isMin = !isMin;
      cycle++;
      interval = Math.max(60, interval * 0.85);
      const elapsed = performance.now() - startTs;
      status.textContent = `cycle ${cycle} · ${Math.round(interval)}ms · ${Math.round(elapsed / 1000)}s`;
      if (elapsed > 8000) {
        if (timer) window.clearTimeout(timer);
        timer = null;
        status.textContent = `done · ${cycle} cycles`;
        return;
      }
      timer = window.setTimeout(tick, interval);
    };
    timer = window.setTimeout(tick, interval);
  });
};
