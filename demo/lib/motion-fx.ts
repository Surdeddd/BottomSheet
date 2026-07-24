import { animate, inView, scroll, stagger } from "motion";

/**
 * The expensive-feeling layer: magnetic targets, a spring-tracked cursor and
 * scroll-linked section work, all on Motion's WAAPI/spring engine.
 *
 * Every effect is capability-gated — coarse pointers skip the cursor and
 * magnetism, and prefers-reduced-motion skips the lot — so the page degrades to
 * plain, fully usable typography instead of half-played animation.
 */

const reduced = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const finePointer = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(pointer: fine)").matches;

export type FxHandle = { destroy: () => void };

const MAGNETIC_SELECTOR = ".adapter, .chip, .topbar button, .install-copy";
const MAGNET_STRENGTH = 0.28;
const MAGNET_RADIUS = 90;

/** Interactive targets lean toward the cursor, then spring home on leave. */
export const initMagnetic = (): FxHandle => {
  if (reduced() || !finePointer()) return { destroy: () => {} };

  const targets = Array.from(
    document.querySelectorAll<HTMLElement>(MAGNETIC_SELECTOR),
  );
  const cleanups: (() => void)[] = [];

  for (const el of targets) {
    const onMove = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > r.width / 2 + MAGNET_RADIUS) return;
      animate(
        el,
        { x: dx * MAGNET_STRENGTH, y: dy * MAGNET_STRENGTH },
        { type: "spring", stiffness: 220, damping: 26 },
      );
    };
    const onLeave = (): void => {
      animate(
        el,
        { x: 0, y: 0 },
        { type: "spring", stiffness: 180, damping: 18 },
      );
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    });
  }

  return {
    destroy: () => {
      for (const c of cleanups) c();
    },
  };
};

/** A trailing ring that widens over anything clickable. */
export const initCursor = (): FxHandle => {
  if (reduced() || !finePointer()) return { destroy: () => {} };

  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.setAttribute("aria-hidden", "true");
  document.body.appendChild(ring);

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let tx = x;
  let ty = y;
  let raf = 0;

  const onMove = (e: PointerEvent): void => {
    tx = e.clientX;
    ty = e.clientY;
    const interactive = (e.target as Element | null)?.closest(
      "a, button, input, label, [role='slider']",
    );
    ring.classList.toggle("is-over", !!interactive);
  };

  const tick = (): void => {
    raf = requestAnimationFrame(tick);
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  raf = requestAnimationFrame(tick);
  document.documentElement.classList.add("has-cursor-ring");

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ring.remove();
      document.documentElement.classList.remove("has-cursor-ring");
    },
  };
};

/**
 * Section headings draw their rule across as they enter, feature cards arrive
 * in a stagger, and the hero settles back as the page scrolls past it.
 */
export const initScrollScenes = (): FxHandle => {
  if (reduced()) return { destroy: () => {} };
  const stops: (() => void)[] = [];

  const caps = document.querySelectorAll<HTMLElement>(".sec-cap");
  for (const cap of caps) {
    stops.push(
      inView(
        cap,
        () => {
          animate(
            cap,
            { opacity: [0, 1], y: [14, 0] },
            { duration: 0.6, ease: [0.2, 0.8, 0.3, 1] },
          );
        },
        { amount: 0.4 },
      ),
    );
  }

  const grids = document.querySelectorAll<HTMLElement>(".features-grid");
  for (const grid of grids) {
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".feature"));
    if (cards.length === 0) continue;
    stops.push(
      inView(
        grid,
        () => {
          animate(
            cards,
            { opacity: [0, 1], y: [20, 0] },
            {
              duration: 0.55,
              delay: stagger(0.045),
              ease: [0.2, 0.8, 0.3, 1],
            },
          );
        },
        { amount: 0.15 },
      ),
    );
  }

  const hero = document.querySelector<HTMLElement>(".hero-title");
  if (hero) {
    stops.push(
      scroll(
        animate(hero, { opacity: [1, 0.35], letterSpacing: ["0em", "0.01em"] }),
        { target: hero, offset: ["start start", "end start"] },
      ),
    );
  }

  return {
    destroy: () => {
      for (const s of stops) s();
    },
  };
};

const SPOTLIGHT_SELECTOR = ".feature, .advanced-card, .control-group";

/** A soft light that tracks the cursor inside each card. */
export const initSpotlight = (): FxHandle => {
  if (reduced() || !finePointer()) return { destroy: () => {} };

  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(SPOTLIGHT_SELECTOR),
  );
  const cleanups: (() => void)[] = [];

  for (const card of cards) {
    card.classList.add("has-spotlight");
    const onMove = (e: PointerEvent): void => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    card.addEventListener("pointermove", onMove, { passive: true });
    cleanups.push(() => {
      card.removeEventListener("pointermove", onMove);
      card.classList.remove("has-spotlight");
      card.style.removeProperty("--mx");
      card.style.removeProperty("--my");
    });
  }

  return {
    destroy: () => {
      for (const c of cleanups) c();
    },
  };
};

/** Section rules draw themselves left-to-right as they come into view. */
export const initLineDraw = (): FxHandle => {
  if (reduced()) return { destroy: () => {} };
  const rules = Array.from(
    document.querySelectorAll<HTMLElement>(".sec-cap, .features-head"),
  );
  const stops = rules.map(el =>
    inView(
      el,
      () => {
        el.classList.add("is-drawn");
      },
      { amount: 0.6 },
    ),
  );
  return {
    destroy: () => {
      for (const s of stops) s();
    },
  };
};

/**
 * Depth parallax: elements drift at their own rate against the scroll, so the
 * page reads as layered rather than flat. Driven off Motion's scroll timeline,
 * which stays on the compositor.
 */
export const initDepthParallax = (): FxHandle => {
  if (reduced()) return { destroy: () => {} };
  const stops: (() => void)[] = [];

  const layers: [string, number][] = [
    [".hero-stats", 24],
    [".readouts", 36],
    [".device-wrap", -28],
  ];

  for (const [selector, distance] of layers) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) continue;
    stops.push(
      scroll(animate(el, { y: [distance, -distance] }, { ease: "linear" }), {
        target: el,
        offset: ["start end", "end start"],
      }),
    );
  }

  return {
    destroy: () => {
      for (const s of stops) s();
    },
  };
};

/** Hero stats count up when they actually reach the viewport. */
export const initStatsOnView = (): FxHandle => {
  if (reduced()) return { destroy: () => {} };
  const stats = document.querySelector<HTMLElement>(".hero-stats");
  if (!stats) return { destroy: () => {} };

  const stop = inView(
    stats,
    () => {
      const nums = stats.querySelectorAll<HTMLElement>(".stat-num");
      animate(
        Array.from(nums),
        { opacity: [0.35, 1], y: [10, 0] },
        { duration: 0.5, delay: stagger(0.06), ease: [0.2, 0.8, 0.3, 1] },
      );
    },
    { amount: 0.5 },
  );
  return { destroy: () => stop() };
};

export const initMotionFx = (): FxHandle => {
  const parts = [
    initCursor(),
    initMagnetic(),
    initSpotlight(),
    initScrollScenes(),
    initLineDraw(),
    initDepthParallax(),
    initStatsOnView(),
  ];
  return {
    destroy: () => {
      for (const p of parts) p.destroy();
    },
  };
};
