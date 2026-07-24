const STAGGER_STEP_MS = 60;
const FAILSAFE_MS = 2500;

/**
 * One-shot scroll-reveal: elements carrying [data-reveal] get .reveal (hidden,
 * shifted) and reveal on intersection. No-JS / reduced-motion / no-IO → no
 * classes are added, content stays fully visible.
 *
 * .reveal hides with `visibility`, so a never-firing observer would strand the
 * content: anything already scrolled into view is force-revealed as a backstop.
 */
export const initReveal = (root: ParentNode = document): void => {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (els.length === 0) return;

  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof IntersectionObserver !== "function") return;

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add("is-revealed");
        io.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
  );

  for (const el of els) {
    const stagger = Number(el.dataset.reveal ?? 0);
    if (stagger > 0) {
      el.style.setProperty("--reveal-delay", `${stagger * STAGGER_STEP_MS}ms`);
    }
    el.classList.add("reveal");
    io.observe(el);
  }

  setTimeout(() => {
    for (const el of els) {
      if (el.classList.contains("is-revealed")) continue;
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add("is-revealed");
        io.unobserve(el);
      }
    }
  }, FAILSAFE_MS);
};
