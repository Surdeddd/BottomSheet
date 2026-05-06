import { $ } from "./types";

/**
 * Lightweight FPS meter that only reports while the sheet is actively
 * dragging or animating — otherwise the readout shows `—`. We attach the
 * RAF loop once at boot; the cost is one timestamp diff + a counter
 * increment per frame.
 */
export const startFpsLoop = (): void => {
  const fpsOut = $<HTMLElement>("#ro-fps");
  const flDragging = $<HTMLElement>("#fl-dragging");
  const flAnimating = $<HTMLElement>("#fl-animating");
  let frames = 0;
  let lastUpdate = performance.now();
  const tick = (ts: number): void => {
    frames++;
    if (ts - lastUpdate >= 500) {
      const fps = Math.round((frames * 1000) / (ts - lastUpdate));
      const active =
        flDragging.classList.contains("is-on") ||
        flAnimating.classList.contains("is-on");
      fpsOut.textContent = active ? String(fps) : "—";
      frames = 0;
      lastUpdate = ts;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
