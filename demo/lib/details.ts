import { animate, inView } from "motion";
import { setLabel } from "./i18n";

export type DetailsHandle = { destroy: () => void };

const reduced = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const initCaret = (): (() => void) => {
  const install = document.querySelector<HTMLElement>(".install");
  if (!install || install.querySelector(".caret")) return () => {};
  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");
  install.appendChild(caret);
  return () => caret.remove();
};

export const BENCH_MEDIA = "(min-width: 961px)";

const RAIL_SECTIONS = [
  ".hero",
  "#assembly",
  ".showcase",
  ".controls",
  ".advanced",
  ".features",
];

const initSectionRail = (): (() => void) => {
  const boxesOf = (section: HTMLElement): HTMLElement[] =>
    getComputedStyle(section).display === "contents"
      ? (Array.from(section.children) as HTMLElement[]).filter(
          child => getComputedStyle(child).position !== "sticky",
        )
      : [section];

  const sections = RAIL_SECTIONS.map(selector =>
    document.querySelector<HTMLElement>(selector),
  ).filter(
    (s): s is HTMLElement =>
      !!s && boxesOf(s).some(box => box.offsetHeight > 200),
  );
  if (sections.length < 3) return () => {};

  const labelOf = (section: HTMLElement): string => {
    const cap = section.previousElementSibling;
    const text = cap?.classList.contains("sec-cap")
      ? cap.textContent
      : section.querySelector("h1")?.textContent;
    return (text ?? "").replace(/\s+/g, " ").trim();
  };

  const rail = document.createElement("nav");
  rail.className = "section-rail";
  setLabel(rail, "a11y.rail");

  const marks = sections.map((section, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail-mark";
    const relabel = (): void => {
      const label = labelOf(section) || `Section ${i + 1}`;
      button.setAttribute("aria-label", label);
      button.dataset.label = label;
    };
    relabel();
    button.addEventListener("pointerenter", relabel);
    button.addEventListener("focus", relabel);
    button.addEventListener("click", () => {
      const cap = section.previousElementSibling;
      const target = cap?.classList.contains("sec-cap")
        ? (cap as HTMLElement)
        : boxesOf(section)[0];
      target?.scrollIntoView({
        behavior: reduced() ? "auto" : "smooth",
        block: "start",
      });
    });
    rail.appendChild(button);
    return { button, section, inView: new Set<Element>() };
  });

  document.body.appendChild(rail);

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const hit = marks.find(m =>
          boxesOf(m.section).includes(entry.target as HTMLElement),
        );
        if (!hit) continue;
        if (entry.isIntersecting) hit.inView.add(entry.target);
        else hit.inView.delete(entry.target);
        hit.button.classList.toggle("is-active", hit.inView.size > 0);
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  const observe = (): void => {
    io.disconnect();
    for (const m of marks) {
      m.inView.clear();
      m.button.classList.remove("is-active");
      for (const box of boxesOf(m.section)) io.observe(box);
    }
  };
  observe();
  const wide = matchMedia(BENCH_MEDIA);
  wide.addEventListener("change", observe);

  return () => {
    wide.removeEventListener("change", observe);
    io.disconnect();
    rail.remove();
  };
};

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
