const reducedMotion = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

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

export const initCountUp = (selector = ".stat-num"): void => {
  const all = document.querySelectorAll<HTMLElement>(selector);
  if (reducedMotion()) {
    all.forEach(el => {
      el.dataset.countDone = "true";
    });
    return;
  }
  all.forEach((el, i) => {
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      el.dataset.countDone = "true";
      return;
    }
    const target = parseInt(node.textContent ?? "", 10);
    if (!Number.isFinite(target) || target <= 0) {
      el.dataset.countDone = "true";
      return;
    }
    const delay = i * 90;
    const duration = 900;
    const start = performance.now() + delay;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      node.textContent = String(target);
      el.dataset.countDone = "true";
    };
    const tick = (now: number): void => {
      if (done) return;
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      if (t >= 1) {
        finish();
        return;
      }
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.setTimeout(finish, delay + duration + 400);
  });
};

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
