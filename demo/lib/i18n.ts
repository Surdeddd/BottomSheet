import type { Lang } from "./types";
import { startViewTransition } from "./view-transition";

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "hero.kicker.left": "Issue Nº {issue} · v{version} · MIT",
    "adapters.more": "same engine, no live tab here",
    "hero.kicker.right": "Filed under: gestures · physics · a11y",
    "hero.docs": "API docs",
    "hero.lede":
      "A <em>universal</em> sheet engine. One framework-agnostic core, seven adapters, native-feel gestures.",
    "sec.assembly": "§ 01 — the anatomy",
    "sec.demo": "§ 02 — the device",
    "sec.controls": "§ 03 — playground",
    "sec.advanced": "§ 04 — advanced",
    "asm.title": "Five layers, one gesture",
    "asm.lede":
      "Every layer is a real node the engine owns — nothing here is a picture of a sheet.",
    "asm.hint": "↓ scroll to build it",
    "asm.l1": "Backdrop",
    "asm.l1.note": "opacity tracks progress",
    "asm.l2": "Scrim",
    "asm.l2.note": "above-sheet · blur · presets",
    "asm.l3": "Surface",
    "asm.l3.note": "translate3d only · 0 reflow",
    "asm.l4": "Handle",
    "asm.l4.note": "role=slider · drag zones",
    "asm.l5": "Content",
    "asm.l5.note": "scrollable · drag-from-content",
    "sec.features": "§ 05 — what's inside",
    "install.copy": "copy",
    "install.copied": "copied",
    "install.failed": "failed",
    "a11y.skip": "Skip to demo",
    "a11y.lang": "EN · RU. Language: English. Click to switch.",
    "a11y.theme.light": "Theme: light. Click to switch.",
    "a11y.theme.dark": "Theme: dark. Click to switch.",
    "a11y.copyInstall": "Copy install command",
    "a11y.copyCode": "Copy code to clipboard",
    "a11y.adapters": "Adapter selector",
    "a11y.readouts": "Live engine readouts",
    "a11y.snippet": "Code snippet for active adapter",
    "a11y.code": "code example",
    "a11y.links": "Project links",
    "a11y.rail": "Section navigation",
    "a11y.snap.id": "Snap %n id",
    "a11y.snap.size": "Snap %n size in pixels",
    "a11y.snap.remove": "Remove snap %n",
    "a11y.copied": "Code copied to clipboard",
    "a11y.copyFailed": "Copy failed",
    "snippet.title": "Usage",
    "device.mode": "mode",
    "footer.changelog": "Changelog",
    "footer.note": "Distilled from a fleet-monitoring app, rebuilt headless",
    "adv.stress.idle": "idle",
    "adv.stress.stop": "■ stop",
    "adv.stress.stopped": "stopped",
    "adv.stress.done": "done · %n cycles",
    "adv.stress.cycle": "cycle %n · %ims · %ss",
    "adv.stress.gone": "sheet is gone",
    "stat.core": "core / esm",
    "stat.adapters": "adapters",
    "stat.modes": "modes",
    "stat.tests": "unit + e2e tests",
    "stat.deps": "runtime deps",
    "live.title": "Live state",
    "live.active": "snap.active",
    "live.progress": "progress",
    "live.size": "size · px",
    "live.velocity": "velocity · px/ms",
    "live.flags": "flags",
    "live.fps": "fps while dragging",
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
    "ctrl.drag": "Drag surface",
    "ctrl.drag.handle": "handle",
    "ctrl.drag.sheet": "whole sheet",
    "ctrl.drag.zones": "zones only",
    "ctrl.drag.content": "drag from content",
    "ctrl.drag.note.handle": "Only the handle starts a drag — the default.",
    "ctrl.drag.note.sheet":
      "Anywhere on the sheet drags it, except [data-bs-no-drag] subtrees.",
    "ctrl.drag.note.zones":
      "Only [data-bs-drag] subtrees drag — here, the sheet header.",
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
    "features.title.b": "— sixteen",
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
      "<em>bottom · top · left · right</em>, plus logical <code>start</code> / <code>end</code> that follow <code>dir</code>. One engine, so a side drawer is the same sheet on another edge.",
    "f05.title": "Back button aware",
    "f05.body":
      "<code>closeOnBack</code> gives the sheet a history entry, so Back closes it instead of leaving the page. <code>routedTo</code> puts it on its own URL, and <code>await close()</code> waits for the history to settle.",
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
      "Open a sheet from another sheet. Z-index, the focus trap, <code>inert</code> and Escape follow the stack: only the top sheet owns them.",
    "f10.title": "SSR-safe",
    "f10.body":
      "Zero <code>window</code> at import. <code>useSyncExternalStore</code> with cached snapshot. Optional <code>noSSR</code> prop kills hydration mismatches in Next.js.",
    "f11.title": "Sheet manager",
    "f11.body":
      "<code>createSheetManager()</code> — typed registry mapping route keys to configs. <code>onOpen</code>/<code>onClose</code> hooks, framework-agnostic.",
    "f12.title": "WebGL renderer",
    "f12.body":
      "An opt-in second renderer paints the surface on the GPU: it bends with drag velocity and hands the text back to the DOM when it settles. Layout, scrolling and the accessibility tree never leave the DOM.",
    "f13.title": "Drag zones",
    "f13.body":
      "<code>dragFrom</code>: handle, whole sheet, or opt-in <code>[data-bs-drag]</code> islands. <code>[data-bs-no-drag]</code> excludes a subtree, so carousels keep their own gesture.",
    "f14.title": "Anchored UI",
    "f14.body":
      "Elements ride the sheet edge on the compositor via <code>--bs-size</code>. Scrim stages swap content per state; docked bars let the sheet slide under them.",
    "f15.title": "Pay for what you use",
    "f15.body":
      "<code>/core</code> is the engine alone at ~22 KB. Route, persist, auto-collapse and the rest are opt-in <code>EngineFeature</code>s you register per instance.",
    "f16.title": "Debuggable",
    "f16.body":
      "<code>attachDebugOverlay(engine)</code> prints live snap, size, progress and flags from public events only — and ships zero bytes into every other bundle.",
    "adv.editor.title": "Snap-point editor",
    "adv.editor.sub": "Add, remove, edit, reorder snaps. Sheet remounts live.",
    "adv.editor.add": "+ add snap",
    "adv.stress.title": "Stress test",
    "adv.stress.sub": "Cycle min↔full at decreasing intervals. Watch the FPS.",
    "adv.stress.run": "⚡ stress 8s",
    "adv.theme.title": "Theme preset",
    "adv.theme.sub": "Opt-in via class on .bs-root. Loads the theme CSS lazily.",
    "adv.float.title": "Floating UI",
    "adv.float.sub": "Anchored elements ride the sheet edge on the compositor; scrim stages swap content per state.",
    "adv.float.anchor": "anchored close button",
    "adv.float.stages": "scrim stages (per-state content)",
    "adv.float.dock": "docked tab bar (sheet slides under)",
  },
  ru: {
    "hero.kicker.left": "Выпуск № {issue} · v{version} · MIT",
    "adapters.more": "тот же движок, без вкладки в демо",
    "hero.kicker.right": "Раздел: жесты · физика · доступность",
    "hero.docs": "Документация API",
    "hero.lede":
      "<em>Универсальный</em> движок шторки. Одно ядро без привязки к фреймворку, семь адаптеров, нативные жесты.",
    "sec.assembly": "§ 01 — анатомия",
    "sec.demo": "§ 02 — устройство",
    "sec.controls": "§ 03 — площадка",
    "sec.advanced": "§ 04 — расширенное",
    "asm.title": "Пять слоёв, один жест",
    "asm.lede":
      "Каждый слой — реальный узел, которым владеет движок, а не картинка листа.",
    "asm.hint": "↓ прокрути, чтобы собрать",
    "asm.l1": "Подложка",
    "asm.l1.note": "прозрачность идёт за прогрессом",
    "asm.l2": "Затемнение",
    "asm.l2.note": "над листом · блюр · пресеты",
    "asm.l3": "Поверхность",
    "asm.l3.note": "только translate3d · 0 reflow",
    "asm.l4": "Ручка",
    "asm.l4.note": "role=slider · зоны перетаскивания",
    "asm.l5": "Контент",
    "asm.l5.note": "скроллится · тянется за контент",
    "sec.features": "§ 05 — что внутри",
    "install.copy": "копировать",
    "install.copied": "скопировано",
    "install.failed": "не вышло",
    "a11y.skip": "К демо",
    "a11y.lang": "EN · RU. Язык: русский. Нажмите, чтобы переключить.",
    "a11y.theme.light": "Тема: светлая. Нажмите, чтобы переключить.",
    "a11y.theme.dark": "Тема: тёмная. Нажмите, чтобы переключить.",
    "a11y.copyInstall": "Копировать команду установки",
    "a11y.copyCode": "Копировать код в буфер обмена",
    "a11y.adapters": "Выбор адаптера",
    "a11y.readouts": "Показания движка в реальном времени",
    "a11y.snippet": "Пример кода для выбранного адаптера",
    "a11y.code": "пример кода",
    "a11y.links": "Ссылки проекта",
    "a11y.rail": "Навигация по разделам",
    "a11y.snap.id": "Идентификатор точки %n",
    "a11y.snap.size": "Размер точки %n в пикселях",
    "a11y.snap.remove": "Удалить точку %n",
    "a11y.copied": "Код скопирован в буфер обмена",
    "a11y.copyFailed": "Скопировать не удалось",
    "snippet.title": "Использование",
    "device.mode": "режим",
    "footer.changelog": "История версий",
    "footer.note": "Выросло из приложения для мониторинга автопарка, пересобрано без привязки к UI",
    "adv.stress.idle": "ожидание",
    "adv.stress.stop": "■ стоп",
    "adv.stress.stopped": "остановлено",
    "adv.stress.done": "готово · циклов: %n",
    "adv.stress.cycle": "цикл %n · %i мс · %s с",
    "adv.stress.gone": "лист исчез",
    "stat.core": "ядро / esm",
    "stat.adapters": "адаптеры",
    "stat.modes": "режимы",
    "stat.tests": "тесты unit + e2e",
    "stat.deps": "зависимости",
    "live.title": "Состояние",
    "live.active": "snap.активный",
    "live.progress": "прогресс",
    "live.size": "размер · px",
    "live.velocity": "скорость · px/мс",
    "live.flags": "флаги",
    "live.fps": "fps во время жеста",
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
    "ctrl.drag": "Зона перетаскивания",
    "ctrl.drag.handle": "только ручка",
    "ctrl.drag.sheet": "весь лист",
    "ctrl.drag.zones": "только зоны",
    "ctrl.drag.content": "тянуть за контент",
    "ctrl.drag.note.handle": "Лист тянется только за ручку — поведение по умолчанию.",
    "ctrl.drag.note.sheet":
      "Тянется в любом месте листа, кроме поддеревьев [data-bs-no-drag].",
    "ctrl.drag.note.zones":
      "Тянут только поддеревья [data-bs-drag] — здесь это шапка листа.",
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
    "features.title.b": "— шестнадцать",
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
      "<em>снизу · сверху · слева · справа</em> и логические <code>start</code> / <code>end</code>, которые идут за <code>dir</code>. Движок один: боковая шторка — тот же лист у другого края.",
    "f05.title": "Знает про «Назад»",
    "f05.body":
      "<code>closeOnBack</code> заводит шторке запись в истории: «Назад» закрывает её, а не уводит со страницы. <code>routedTo</code> даёт ей свой адрес, а <code>await close()</code> ждёт, пока история успокоится.",
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
      "Открывайте шторку из шторки. Z-index, ловушка фокуса, <code>inert</code> и Esc идут за стеком: ими владеет только верхняя.",
    "f10.title": "Безопасно для SSR",
    "f10.body":
      "Никакого <code>window</code> при импорте. <code>useSyncExternalStore</code> с кэшированным снапшотом. Опция <code>noSSR</code> устраняет рассинхрон гидратации в Next.js.",
    "f11.title": "Менеджер шторок",
    "f11.body":
      "<code>createSheetManager()</code> — типизированный реестр ключ маршрута → конфиг. Хуки <code>onOpen</code>/<code>onClose</code>, без привязки к фреймворку.",
    "f12.title": "WebGL-рендерер",
    "f12.body":
      "Второй рендерер по желанию рисует поверхность на GPU: она гнётся от скорости жеста и возвращает текст в DOM, когда успокаивается. Вёрстка, прокрутка и дерево доступности остаются в DOM.",
    "f13.title": "Зоны перетаскивания",
    "f13.body":
      "<code>dragFrom</code>: ручка, весь лист или только острова <code>[data-bs-drag]</code>. <code>[data-bs-no-drag]</code> исключает поддерево — карусель сохраняет свой жест.",
    "f14.title": "Привязанный интерфейс",
    "f14.body":
      "Элементы едут по краю листа на композиторе через <code>--bs-size</code>. Сцены затемнения меняют контент по состоянию; докнутые панели пропускают лист под собой.",
    "f15.title": "Платишь за то, что берёшь",
    "f15.body":
      "<code>/core</code> — только движок, ~22 КБ. Роутинг, persist, авто-сворачивание и прочее — опциональные <code>EngineFeature</code>, подключаемые на инстанс.",
    "f16.title": "Отлаживаемый",
    "f16.body":
      "<code>attachDebugOverlay(engine)</code> показывает живой снап, размер, прогресс и флаги — только из публичных событий, и ноль байт в остальных бандлах.",
    "adv.editor.title": "Редактор snap-точек",
    "adv.editor.sub": "Добавляйте, удаляйте, меняйте порядок. Шторка пересобирается на лету.",
    "adv.editor.add": "+ добавить",
    "adv.stress.title": "Стресс-тест",
    "adv.stress.sub": "Цикл min↔full с убывающим интервалом. Следите за FPS.",
    "adv.stress.run": "⚡ стресс 8с",
    "adv.theme.title": "Тема оформления",
    "adv.theme.sub": "Включается классом на .bs-root. CSS темы подгружается лениво.",
    "adv.float.title": "Плавающие элементы",
    "adv.float.sub": "Анкоры едут за кромкой шторки на компоновщике; стейджи скрима меняют контент по состоянию.",
    "adv.float.anchor": "кнопка закрытия на кромке",
    "adv.float.stages": "стейджи скрима (контент по состоянию)",
    "adv.float.dock": "нижнее меню (шторка уходит под него)",
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

const vars: Record<string, string> = {};

const fill = (text: string): string | null => {
  let missing = false;
  const out = text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) missing = true;
    return value ?? "";
  });
  return missing ? null : out;
};

export const getLang = (): Lang => currentLang;

export const t = (key: string): string =>
  fill(DICT[currentLang][key] ?? key) ?? key;

const paintLabel = (el: HTMLElement): void => {
  const text = t(el.dataset.i18nLabel!);
  const prefix = el.dataset.labelPrefix;
  el.setAttribute("aria-label", prefix ? `${prefix} · ${text}` : text);
};

export const setLabel = (el: HTMLElement, key: string): void => {
  el.dataset.i18nLabel = key;
  paintLabel(el);
};

export const applyLang = (lang: Lang): void => {
  currentLang = lang;
  localStorage.setItem("bs-demo-lang", lang);
  document.documentElement.lang = lang;
  const dict = DICT[lang];
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n!;
    const text = dict[key] ? fill(dict[key]) : null;
    if (text !== null) el.textContent = text;
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
    .querySelectorAll<HTMLElement>("[data-i18n-label]")
    .forEach(paintLabel);
};

export const setLangVars = (next: Record<string, string>): void => {
  Object.assign(vars, next);
  applyLang(currentLang);
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
