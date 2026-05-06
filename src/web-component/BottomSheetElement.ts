import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type { EngineOptions, EngineState, SnapPointDef } from "../core/types";
import { baseStyles } from "./baseStyles";

const ATTR_SNAP_POINTS = "snap-points";
const ATTR_ALLOWED = "allowed";
const ATTR_INITIAL = "initial";
const ATTR_MODE = "mode";
const ATTR_BACKDROP = "backdrop";
const ATTR_STYLESHEET = "stylesheet";
const ATTR_ANIMATION = "animation";
const ATTR_FOCUS_TRAP = "focus-trap";
const ATTR_CLOSE_ON_ESCAPE = "close-on-escape";
const ATTR_LOCK_BODY_SCROLL = "lock-body-scroll";

const isValidSnapPoint = (p: unknown): p is SnapPointDef =>
  !!p &&
  typeof p === "object" &&
  typeof (p as SnapPointDef).id === "string" &&
  (typeof (p as SnapPointDef).size === "number" ||
    typeof (p as SnapPointDef).size === "string");

const DEFAULT_SNAP_POINTS: SnapPointDef[] = [{ id: "full", size: "full" }];

const parseSnapPoints = (raw: string | null): SnapPointDef[] => {
  if (!raw) return DEFAULT_SNAP_POINTS;
  // Accept either JSON or shorthand: "minimized:80,half:40%,full:80%"
  try {
    const parsed = JSON.parse(raw);
    // Runtime shape check — without it a malformed JSON object passes
    // through to the engine and fails deep in axis math. JSON.parse
    // strips dangerous `__proto__` keys via the spec's
    // `[[DefineOwnProperty]]` path so prototype pollution is impossible
    // here, but `[{"id":null,"size":{}}]` would otherwise reach engine.
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(isValidSnapPoint)
    ) {
      return parsed;
    }
    // JSON parsed but shape invalid (or empty array) — treat as malformed
    // and fall back to a safe default rather than letting the shorthand
    // parser produce garbage from JSON-syntax input like `[{"id":null}]`.
    if (Array.isArray(parsed)) return DEFAULT_SNAP_POINTS;
  } catch {
    /* fall through to shorthand parse */
  }
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(part => {
      const [id, size] = part.split(":").map(s => s.trim());
      const numeric = Number(size);
      const resolvedSize = Number.isFinite(numeric)
        ? numeric
        : (size as SnapPointDef["size"]);
      return { id: id ?? "default", size: resolvedSize };
    });
};

const VALID_MODES: ReadonlyArray<NonNullable<EngineOptions["mode"]>> = [
  "bottom",
  "top",
  "left",
  "right",
];

const VALID_ANIMATIONS: ReadonlyArray<NonNullable<EngineOptions["animation"]>> =
  ["spring", "tween", "ios-spring", "material-bounce", "linear", "snappy"];

const parseMode = (raw: string | null): NonNullable<EngineOptions["mode"]> =>
  raw && (VALID_MODES as readonly string[]).includes(raw)
    ? (raw as NonNullable<EngineOptions["mode"]>)
    : "bottom";

const parseAnimation = (raw: string | null): EngineOptions["animation"] =>
  raw && (VALID_ANIMATIONS as readonly string[]).includes(raw)
    ? (raw as EngineOptions["animation"])
    : undefined;

const parseList = (raw: string | null): string[] | undefined =>
  raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : undefined;

const buildSlot = (name: string): HTMLSlotElement => {
  const slot = document.createElement("slot");
  slot.name = name;
  return slot;
};

const buildShadowTree = (): {
  fragment: DocumentFragment;
  refs: {
    sheet: HTMLElement;
    handle: HTMLElement;
    content: HTMLElement;
    backdrop: HTMLElement;
    screen: HTMLElement;
    leftButton: HTMLElement;
    rightButton: HTMLElement;
    announcer: HTMLElement;
  };
} => {
  const root = document.createElement("div");
  root.className = "bs-root";

  const backdrop = document.createElement("div");
  backdrop.className = "bs-backdrop";
  backdrop.setAttribute("part", "backdrop");

  const screen = document.createElement("div");
  screen.className = "bs-screen";
  screen.setAttribute("part", "screen");
  screen.appendChild(buildSlot("screen"));

  const sheet = document.createElement("section");
  sheet.className = "bs-sheet";
  sheet.setAttribute("part", "sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "false");

  const leftButton = document.createElement("div");
  leftButton.className = "bs-button-slot";
  leftButton.setAttribute("data-side", "left");
  leftButton.setAttribute("part", "left-button");
  leftButton.appendChild(buildSlot("leftButton"));

  const rightButton = document.createElement("div");
  rightButton.className = "bs-button-slot";
  rightButton.setAttribute("data-side", "right");
  rightButton.setAttribute("part", "right-button");
  rightButton.appendChild(buildSlot("rightButton"));

  const handle = document.createElement("div");
  handle.className = "bs-handle";
  handle.setAttribute("part", "handle");
  handle.setAttribute("role", "slider");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("aria-label", "Resize sheet");
  handle.appendChild(buildSlot("header"));

  const content = document.createElement("div");
  content.className = "bs-content";
  content.setAttribute("part", "content");
  // WCAG 2.1 SC 2.1.1 — scrollable region must be keyboard-focusable.
  content.setAttribute("tabindex", "0");
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "Sheet content");
  const defaultSlot = document.createElement("slot");
  content.appendChild(defaultSlot);

  // SR-only live region for snap announcements (WCAG 4.1.3 Status Messages).
  // The framework adapters render an equivalent <span role="status"> in their
  // returned JSX/template; the WC must own one in shadow DOM since consumers
  // can't inject DOM into the shadow tree. Visually hidden but discoverable
  // by AT.
  const announcer = document.createElement("span");
  announcer.className = "bs-sr-announce";
  announcer.setAttribute("role", "status");
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  announcer.style.cssText =
    "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);";

  sheet.append(leftButton, rightButton, handle, content);
  root.append(backdrop, screen, sheet, announcer);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(root);

  return {
    fragment,
    refs: {
      sheet,
      handle,
      content,
      backdrop,
      screen,
      leftButton,
      rightButton,
      announcer,
    },
  };
};

/**
 * Custom element wrapping the engine. Works in any framework — drop it into
 * Angular, Svelte, plain HTML, WordPress, anything that accepts HTML.
 *
 *   <bottom-sheet snap-points='[{"id":"min","size":80},{"id":"full","size":"80%"}]'
 *                 initial="min">
 *     <div slot="header">Title</div>
 *     <p>Content</p>
 *   </bottom-sheet>
 *
 * ## Per-snap header limitation
 *
 * The framework adapters (React, Vue, Svelte) accept a function/scoped-slot
 * `header` that re-renders on every snap transition — so the header can morph
 * (e.g. minimized vs full) without imperative wiring. The Web Component
 * deliberately does NOT replicate this: native `<slot>` in Shadow DOM has
 * no concept of "render this slot with these props per state", and
 * synthesizing that on top would either bloat the shadow tree or force
 * Light DOM consumers into an opaque, framework-flavored API.
 *
 * If you need per-snap header content with the Web Component, listen to the
 * `snap` CustomEvent and update the slotted node imperatively:
 *
 *   const sheet = document.querySelector("bottom-sheet");
 *   const header = sheet.querySelector('[slot="header"]');
 *   sheet.addEventListener("snap", e => {
 *     const { id } = e.detail;
 *     header.textContent = id === "min" ? "Title" : "Full title";
 *   });
 *
 * `snap` fires after the animation settles, so the swap is jank-free.
 */
export class BottomSheetElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [
      ATTR_SNAP_POINTS,
      ATTR_ALLOWED,
      ATTR_INITIAL,
      ATTR_MODE,
      ATTR_BACKDROP,
      ATTR_ANIMATION,
      ATTR_FOCUS_TRAP,
      ATTR_CLOSE_ON_ESCAPE,
      ATTR_LOCK_BODY_SCROLL,
    ];
  }

  private engine: BottomSheetEngine | null = null;
  private root: ShadowRoot;
  private offHandlers: Array<() => void> = [];
  private refs!: ReturnType<typeof buildShadowTree>["refs"];
  private backdropClickHandler: (() => void) | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    // Page stylesheets can't reach Shadow DOM, so inject base styles first.
    const baseStyle = document.createElement("style");
    baseStyle.textContent = baseStyles;
    this.root.appendChild(baseStyle);
    // Consumer-provided overrides loaded after base so they win on tokens.
    //
    // SECURITY: the `stylesheet` attribute MUST NOT be derived from untrusted
    // input. CSS injected here can exfiltrate sibling form values via
    // attribute-selector requests (`input[value^="a"] { background: url(...) }`),
    // mount UI redress via `position: fixed`, or leak the visitor's IP through
    // a third-party stylesheet load. The element does not validate the URL —
    // pass only same-origin or trusted CDN URLs, and consider Subresource
    // Integrity at the consumer level if CDN-loaded.
    const stylesheet = this.getAttribute(ATTR_STYLESHEET);
    if (stylesheet) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = stylesheet;
      this.root.appendChild(link);
    }
    const inlineStyle = document.createElement("style");
    inlineStyle.textContent = [
      ":host { display: contents; }",
      ".bs-handle:focus-visible {",
      "  outline: 2px solid currentColor;",
      "  outline-offset: -2px;",
      "  border-radius: var(--bs-radius, 20px);",
      "}",
      "@media (forced-colors: active) {",
      "  .bs-handle:focus-visible { outline: 2px solid CanvasText; }",
      "}",
    ].join("\n");
    this.root.appendChild(inlineStyle);
    const { fragment, refs } = buildShadowTree();
    this.refs = refs;
    this.root.appendChild(fragment);
  }

  connectedCallback(): void {
    this.initEngine();
  }

  disconnectedCallback(): void {
    this.teardownEngine();
  }

  attributeChangedCallback(): void {
    if (!this.engine) return;
    this.teardownEngine();
    this.initEngine();
  }

  private teardownEngine(): void {
    this.offHandlers.forEach(off => off());
    this.offHandlers = [];
    if (this.backdropClickHandler) {
      this.refs.backdrop.removeEventListener("click", this.backdropClickHandler);
      this.backdropClickHandler = null;
    }
    this.engine?.destroy();
    this.engine = null;
  }

  private initEngine(): void {
    const { sheet, handle, content, backdrop, announcer } = this.refs;

    const mode = parseMode(this.getAttribute(ATTR_MODE));
    sheet.setAttribute("data-mode", mode);

    const focusTrap = this.getAttribute(ATTR_FOCUS_TRAP) === "true";
    // aria-modal must reflect the actual modality. With focus-trap on, inert
    // siblings + scroll lock activate too, so SR users should switch to the
    // modal interaction model. With focus-trap off, the sheet is non-modal
    // and we OMIT the attribute rather than setting "false" (see WAI-ARIA:
    // omitted attribute is preferred over the stale "false" string for
    // some AT implementations).
    if (focusTrap) {
      sheet.setAttribute("aria-modal", "true");
    } else {
      sheet.removeAttribute("aria-modal");
    }

    const showBackdrop = this.getAttribute(ATTR_BACKDROP) !== "false";
    backdrop.style.display = showBackdrop ? "" : "none";
    if (showBackdrop) {
      this.backdropClickHandler = () => void this.engine?.close();
      backdrop.addEventListener("click", this.backdropClickHandler);
    }

    const opts: EngineOptions = {
      element: sheet,
      handle,
      scrollContainer: content,
      backdrop: showBackdrop ? backdrop : undefined,
      screenComponent: this.refs.screen,
      mode,
      snapPoints: parseSnapPoints(this.getAttribute(ATTR_SNAP_POINTS)),
      allowed: parseList(this.getAttribute(ATTR_ALLOWED)),
      initial: this.getAttribute(ATTR_INITIAL) ?? undefined,
      animation: parseAnimation(this.getAttribute(ATTR_ANIMATION)),
      focusTrap,
      closeOnEscape: this.getAttribute(ATTR_CLOSE_ON_ESCAPE) !== "false",
      lockBodyScroll: this.getAttribute(ATTR_LOCK_BODY_SCROLL) !== "false",
    };

    this.engine = new BottomSheetEngine(opts);

    this.offHandlers = [
      this.engine.on("snap", payload => {
        // Announce snap id to AT via the live region. Update textContent so
        // SRs re-announce on each change (aria-live=polite + aria-atomic).
        announcer.textContent = payload.id;
        this.dispatchEvent(new CustomEvent("snap", { detail: payload }));
      }),
      this.engine.on("open", payload =>
        this.dispatchEvent(new CustomEvent("open", { detail: payload })),
      ),
      this.engine.on("close", () =>
        this.dispatchEvent(new CustomEvent("close")),
      ),
      this.engine.on("progress", payload =>
        this.dispatchEvent(new CustomEvent("progress", { detail: payload })),
      ),
    ];
  }

  snapTo(id: string): Promise<void> {
    return this.engine?.snapTo(id) ?? Promise.resolve();
  }
  open(id?: string): Promise<void> {
    return this.engine?.open(id) ?? Promise.resolve();
  }
  close(): Promise<void> {
    return this.engine?.close() ?? Promise.resolve();
  }
  setAllowed(ids: string[], snap?: string): void {
    this.engine?.setAllowed(ids, snap);
  }
  get sheetState(): EngineState | null {
    return this.engine?.state ?? null;
  }
}

/**
 * Opt-in literal-id narrowing for the Web Component instance. The class
 * itself stays `string`-typed — making `BottomSheetElement` generic would
 * break `customElements.define`, which registers a 1:1 tag→class mapping
 * (one runtime class per tag, regardless of TS generic instantiations).
 *
 * Consumers narrow at the call site by typing the `querySelector` result:
 *
 * ```ts
 * import type { TypedBottomSheetElement } from "@surdeddd/bottom-sheet/element";
 *
 * const el = document.querySelector<
 *   TypedBottomSheetElement<"min" | "full">
 * >("bottom-sheet");
 * el?.snapTo("typo"); // ❌ TS2345
 * el?.snapTo("full"); // ✓
 * ```
 *
 * Defaults `TId = string` so untyped `querySelector("bottom-sheet")` keeps
 * the existing string-loose behaviour. The runtime class is unchanged; this
 * is purely a TS-level convenience layered on the HTMLElement instance.
 */
export type TypedBottomSheetElement<TId extends string = string> =
  HTMLElement & {
    snapTo: (id: TId) => Promise<void>;
    open: (id?: TId) => Promise<void>;
    close: () => Promise<void>;
    setAllowed: (ids: TId[], snap?: TId) => void;
    readonly sheetState: (EngineState & { activeId: TId }) | null;
  };

let registered = false;
export const defineBottomSheet = (tag = "bottom-sheet"): void => {
  if (registered || customElements.get(tag)) return;
  customElements.define(tag, BottomSheetElement);
  registered = true;
};
