import type { Lang } from "./types";
import { startViewTransition } from "./view-transition";

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "hero.kicker.left": "Issue Nº 01 · Apr 2026 · MIT",
    "hero.kicker.right": "Filed under: gestures · physics · a11y",
    "hero.lede":
      "A <em>universal</em> sheet engine. One framework-agnostic core, seven adapters, native-feel gestures.",
    "stat.core": "core / esm",
    "stat.adapters": "adapters",
    "stat.modes": "modes",
    "stat.tests": "tests · unit + e2e",
    "stat.deps": "runtime deps",
    "live.title": "Live state",
    "live.active": "snap.active",
    "live.progress": "progress",
    "live.size": "size · px",
    "live.velocity": "velocity · px/ms",
    "live.flags": "flags",
    "live.fps": "fps · drag-frame",
    "kbd.title": "keyboard",
    "kbd.step": "step snap",
    "kbd.jump": "jump min · max",
    "kbd.close": "close",
    "kbd.cycle": "cycle inside trap",
    "ctrl.snap": "Snap point",
    "ctrl.mode": "Mode",
    "ctrl.spring": "Spring physics",
    "ctrl.spring.hint": "(remounts)",
    "ctrl.behavior": "Behavior",
    "ctrl.trap": "focus trap",
    "ctrl.esc": "close on Esc",
    "ctrl.haptic": "haptic on snap",
    "ctrl.rubber": "rubber-band",
    "ctrl.scrim": "Scrim",
    "ctrl.scrim.subtle": "subtle",
    "ctrl.scrim.standard": "standard",
    "ctrl.scrim.monitoring": "monitoring",
    "ctrl.scrim.cinematic": "cinematic",
    "ctrl.scrim.above": "above sheet only",
    "ctrl.scrim.tap": "tap to close",
    "ctrl.scrim.off": "off",
    "ctrl.scrim.floating": "floating action",
    "ctrl.scrim.floating.btn": "Quick action",
    "features.title.a": "What's inside",
    "features.title.b": "— twelve+",
    "f01.title": "Spring physics",
    "f01.body":
      "Critical-damped harmonic oscillator. Drag <em>velocity</em> carries into the settle — no jerk on flick. Sub-stepped at 240Hz, one DOM write per RAF.",
    "f02.title": "GPU-only motion",
    "f02.body":
      "Sized once via <code>height</code>; resized via <code>transform: translate3d</code>. Zero layout per frame. <code>will-change</code> gated to drag/animate.",
    "f03.title": "Any CSS length",
    "f03.body":
      "Snap points accept px, percentages, <code>fit</code>, <code>full</code>, plus arbitrary CSS: <code>50dvh</code>, <code>clamp()</code>, <code>env()</code>.",
    "f04.title": "Four directions",
    "f04.body":
      "<em>bottom · top · left · right</em>. Same engine — drawer-side sheets without code duplication. Pointer axis & sign computed.",
    "f05.title": "Pointer-type tuned",
    "f05.body":
      "Touch flicks: 0.65px/ms threshold, 120ms velocity window. Mouse inertia: 0.4px/ms, 160ms window. Gesture parses what the pointer is.",
    "f06.title": "Native a11y",
    "f06.body":
      "<code>role=slider</code> on handle. ↑↓ steps snaps, Home/End jumps, Esc closes. Focus trap with restore. ARIA-live announcer. WCAG 2.1 AA.",
    "f07.title": "Mobile primitives",
    "f07.body":
      "<code>env(safe-area-inset-*)</code>, hardware-back interception, haptic tick on snap, body scroll lock that's iOS-safe (<code>position:fixed</code>).",
    "f08.title": "Headless or framed",
    "f08.body":
      "Use <code>useBottomSheet()</code> for full JSX control, or grab the ready-made <code>&lt;BottomSheet&gt;</code>. Three layers, your call.",
    "f09.title": "Multi-sheet stack",
    "f09.body":
      "Open a sheet from another sheet. Z-index orchestrated, backdrops de-duped, only the topmost owns Escape.",
    "f10.title": "SSR-safe",
    "f10.body":
      "Zero <code>window</code> at import. <code>useSyncExternalStore</code> with cached snapshot. Optional <code>noSSR</code> prop kills hydration mismatches in Next.js.",
    "f11.title": "Sheet manager",
    "f11.body":
      "<code>createSheetManager()</code> — typed registry mapping route keys to configs. <code>onOpen</code>/<code>onClose</code> hooks, framework-agnostic.",
    "f12.title": "Tested",
    "f12.body":
      "138 unit tests (vitest + happy-dom) covering snap math, spring, gestures, focus trap, scroll lock, manager, vh→dvh, viewport resize. 32 e2e via Playwright on mobile-Chrome. All green.",
    "advanced.title": "Advanced playground",
    "adv.editor.title": "Snap-point editor",
    "adv.editor.sub": "Add, remove, edit, reorder snaps. Sheet remounts live.",
    "adv.editor.add": "+ add snap",
    "adv.stress.title": "Stress test",
    "adv.stress.sub": "Cycle min↔full at decreasing intervals. Watch the FPS.",
    "adv.stress.run": "⚡ stress 8s",
  },
  ru: {
    "hero.kicker.left": "Выпуск № 01 · Апр 2026 · MIT",
    "hero.kicker.right": "Раздел: жесты · физика · доступность",
    "hero.lede":
      "<em>Универсальный</em> движок шторки. Одно ядро без привязки к фреймворку, семь адаптеров, нативные жесты.",
    "stat.core": "ядро / esm",
    "stat.adapters": "адаптеры",
    "stat.modes": "режимы",
    "stat.tests": "тесты · unit + e2e",
    "stat.deps": "зависимости",
    "live.title": "Состояние",
    "live.active": "snap.активный",
    "live.progress": "прогресс",
    "live.size": "размер · px",
    "live.velocity": "скорость · px/мс",
    "live.flags": "флаги",
    "live.fps": "fps · кадр перетаскивания",
    "kbd.title": "клавиатура",
    "kbd.step": "шаг по точкам",
    "kbd.jump": "к мин · макс",
    "kbd.close": "закрыть",
    "kbd.cycle": "цикл внутри ловушки",
    "ctrl.snap": "Точка фиксации",
    "ctrl.mode": "Режим",
    "ctrl.spring": "Пружинная физика",
    "ctrl.spring.hint": "(пересоздаёт)",
    "ctrl.behavior": "Поведение",
    "ctrl.trap": "ловушка фокуса",
    "ctrl.esc": "закрытие по Esc",
    "ctrl.haptic": "вибро при фиксации",
    "ctrl.rubber": "резиновое отскакивание",
    "ctrl.scrim": "Затемнение",
    "ctrl.scrim.subtle": "лёгкое",
    "ctrl.scrim.standard": "стандарт",
    "ctrl.scrim.monitoring": "монитор",
    "ctrl.scrim.cinematic": "кино",
    "ctrl.scrim.above": "только над листом",
    "ctrl.scrim.tap": "тап закрывает",
    "ctrl.scrim.off": "выкл",
    "ctrl.scrim.floating": "плавающая кнопка",
    "ctrl.scrim.floating.btn": "Быстрое действие",
    "features.title.a": "Что внутри",
    "features.title.b": "— двенадцать+",
    "f01.title": "Пружинная физика",
    "f01.body":
      "Критически демпфированный гармонический осциллятор. <em>Скорость</em> перетаскивания переносится в затухание — без рывка на флике. Подшаг 240 Гц, одна запись в DOM на RAF.",
    "f02.title": "Анимация только на GPU",
    "f02.body":
      "Размер задаётся один раз через <code>height</code>, пересчёт — через <code>transform: translate3d</code>. Ноль reflow на кадр. <code>will-change</code> включается только во время жеста.",
    "f03.title": "Любая CSS-длина",
    "f03.body":
      "Точки принимают px, проценты, <code>fit</code>, <code>full</code> и любой CSS: <code>50dvh</code>, <code>clamp()</code>, <code>env()</code>.",
    "f04.title": "Четыре направления",
    "f04.body":
      "<em>снизу · сверху · слева · справа</em>. Один движок — боковые шторки без дублирования кода. Ось и знак указателя вычисляются автоматически.",
    "f05.title": "Настройка под тип указателя",
    "f05.body":
      "Тач-флик: порог 0,65 px/мс, окно 120 мс. Инерция мыши: 0,4 px/мс, 160 мс. Жест распознаёт тип указателя.",
    "f06.title": "Нативная доступность",
    "f06.body":
      "<code>role=slider</code> на ручке. ↑↓ — шаг, Home/End — крайние точки, Esc — закрыть. Ловушка фокуса с возвратом. ARIA-live. WCAG 2.1 AA.",
    "f07.title": "Мобильные примитивы",
    "f07.body":
      "<code>env(safe-area-inset-*)</code>, перехват аппаратной кнопки «назад», тактильный отклик при фиксации, iOS-совместимая блокировка прокрутки (<code>position:fixed</code>).",
    "f08.title": "Без обвязки или готовый",
    "f08.body":
      "<code>useBottomSheet()</code> для полного контроля над JSX или готовый <code>&lt;BottomSheet&gt;</code>. Три слоя — выбор за вами.",
    "f09.title": "Стек из нескольких шторок",
    "f09.body":
      "Открывайте шторку из шторки. Z-index согласован, бэкдропы не дублируются, Esc обрабатывает только верхняя.",
    "f10.title": "Безопасно для SSR",
    "f10.body":
      "Никакого <code>window</code> при импорте. <code>useSyncExternalStore</code> с кэшированным снапшотом. Опция <code>noSSR</code> устраняет рассинхрон гидратации в Next.js.",
    "f11.title": "Менеджер шторок",
    "f11.body":
      "<code>createSheetManager()</code> — типизированный реестр ключ маршрута → конфиг. Хуки <code>onOpen</code>/<code>onClose</code>, без привязки к фреймворку.",
    "f12.title": "Покрытие тестами",
    "f12.body":
      "138 unit-тестов (vitest + happy-dom) на snap-math, spring, gestures, focus trap, scroll lock, manager, vh→dvh, viewport resize. 32 e2e через Playwright на mobile-Chrome. Все зелёные.",
    "advanced.title": "Расширенные эксперименты",
    "adv.editor.title": "Редактор snap-точек",
    "adv.editor.sub": "Добавляйте, удаляйте, меняйте порядок. Шторка пересобирается на лету.",
    "adv.editor.add": "+ добавить",
    "adv.stress.title": "Стресс-тест",
    "adv.stress.sub": "Цикл min↔full с убывающим интервалом. Следите за FPS.",
    "adv.stress.run": "⚡ стресс 8с",
  },
};

export const detectLang = (): Lang => {
  const stored = localStorage.getItem("bs-demo-lang");
  if (stored === "ru" || stored === "en") return stored;
  return navigator.language.startsWith("ru") ? "ru" : "en";
};

const renderInlineMarkup = (el: HTMLElement, html: string): void => {
  el.textContent = "";
  const tokens = html.split(/(<\/?(?:em|code)>|&lt;|&gt;)/g);
  let stack: HTMLElement[] = [el];
  for (const tok of tokens) {
    if (!tok) continue;
    const top = stack[stack.length - 1]!;
    if (tok === "<em>" || tok === "<code>") {
      const node = document.createElement(tok.slice(1, -1));
      top.appendChild(node);
      stack.push(node);
    } else if (tok === "</em>" || tok === "</code>") {
      if (stack.length > 1) stack.pop();
    } else if (tok === "&lt;") {
      top.appendChild(document.createTextNode("<"));
    } else if (tok === "&gt;") {
      top.appendChild(document.createTextNode(">"));
    } else {
      top.appendChild(document.createTextNode(tok));
    }
  }
};

let currentLang: Lang = detectLang();

export const getLang = (): Lang => currentLang;

export const t = (key: string): string => DICT[currentLang][key] ?? key;

export const applyLang = (lang: Lang): void => {
  currentLang = lang;
  localStorage.setItem("bs-demo-lang", lang);
  document.documentElement.lang = lang;
  const dict = DICT[lang];
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n!;
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach(el => {
    const key = el.dataset.i18nHtml!;
    const html = dict[key];
    if (html) renderInlineMarkup(el, html);
  });
  document
    .getElementById("lang-en")
    ?.classList.toggle("topbar-active", lang === "en");
  document
    .getElementById("lang-ru")
    ?.classList.toggle("topbar-active", lang === "ru");
  document
    .getElementById("lang-toggle")
    ?.setAttribute(
      "aria-label",
      `Language: ${lang === "en" ? "English" : "Russian"}. Click to switch.`,
    );
};

let langToggleWired = false;
export const wireLangToggle = (): void => {
  if (langToggleWired) return;
  langToggleWired = true;
  document.getElementById("lang-toggle")?.addEventListener("click", () => {
    startViewTransition(() => {
      applyLang(currentLang === "en" ? "ru" : "en");
    });
  });
};
