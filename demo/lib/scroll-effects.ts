const reducedMotion = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Thin vermillion progress line pinned to the top of the page. */
export const initScrollProgress = (barId = "scroll-progress"): void => {
  const bar = document.getElementById(barId);
  if (!bar) return;
  let ticking = false;
  const update = (): void => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
};

/** Count the hero stats up from 0 on load. Skipped under reduced-motion. */
export const initCountUp = (selector = ".stat-num"): void => {
  if (reducedMotion()) return;
  document.querySelectorAll<HTMLElement>(selector).forEach((el, i) => {
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const target = parseInt(node.textContent ?? "", 10);
    if (!Number.isFinite(target) || target <= 0) return;
    const start = performance.now() + i * 90;
    const duration = 900;
    const tick = (now: number): void => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

/** Subtle parallax: the hero title sinks slower than the page scroll. */
export const initHeroParallax = (selector = ".hero-title"): void => {
  if (reducedMotion()) return;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  let ticking = false;
  const update = (): void => {
    ticking = false;
    el.style.transform = `translate3d(0, ${Math.min(window.scrollY * 0.06, 60)}px, 0)`;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
};
