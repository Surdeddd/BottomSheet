import { animate, inView } from "motion";

/**
 * The small stuff: a blinking terminal caret, a section rail that tracks where
 * you are, and section captions that stamp in. Each is independently gated so
 * a missing element or reduced motion simply skips that piece.
 */

export type DetailsHandle = { destroy: () => void };

const reduced = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A caret that blinks at the end of the install command. */
const initCaret = (): (() => void) => {
  const install = document.querySelector<HTMLElement>(".install");
  if (!install || install.querySelector(".caret")) return () => {};
  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");
  install.appendChild(caret);
  return () => caret.remove();
};

/**
 * A rail of section marks down the right edge. Clicking one scrolls there;
 * the active mark tracks the section currently filling the viewport.
 */
const initSectionRail = (): (() => void) => {
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("main > section, main > header"),
  ).filter(s => s.offsetHeight > 200);
  if (sections.length < 3) return () => {};

  const rail = document.createElement("nav");
  rail.className = "section-rail";
  rail.setAttribute("aria-label", "Section navigation");

  const marks = sections.map((section, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail-mark";
    const label =
      section.querySelector("h1, h2")?.textContent?.trim().slice(0, 40) ??
      `Section ${i + 1}`;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      section.scrollIntoView({
        behavior: reduced() ? "auto" : "smooth",
        block: "start",
      });
    });
    rail.appendChild(button);
    return { button, section };
  });

  document.body.appendChild(rail);

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const hit = marks.find(m => m.section === entry.target);
        if (!hit) continue;
        hit.button.classList.toggle("is-active", entry.isIntersecting);
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  for (const m of marks) io.observe(m.section);

  return () => {
    io.disconnect();
    rail.remove();
  };
};

/** Section captions stamp in rather than simply appearing. */
const initCaptionStamp = (): (() => void) => {
  if (reduced()) return () => {};
  const caps = Array.from(document.querySelectorAll<HTMLElement>(".sec-cap"));
  const stops = caps.map(cap =>
    inView(
      cap,
      () => {
        const label = cap.querySelector("span");
        if (!label) return;
        animate(
          label,
          { opacity: [0, 1], letterSpacing: ["0.5em", "0.2em"] },
          { duration: 0.7, ease: [0.2, 0.8, 0.3, 1] },
        );
      },
      { amount: 0.8 },
    ),
  );
  return () => {
    for (const s of stops) s();
  };
};

export const initDetails = (): DetailsHandle => {
  const teardowns = [initCaret(), initSectionRail(), initCaptionStamp()];
  return {
    destroy: () => {
      for (const t of teardowns) t();
    },
  };
};
