import { BottomSheetEngine } from "../core/BottomSheetEngine";
import type {
  CloseReason,
  EngineOptions,
  EngineState,
} from "../core/types";
import type { AnchorOptions } from "../core/features/sheet-anchors";
import type { ScrimStagesOptions } from "../core/features/scrim-stages";
import { baseStyles } from "./baseStyles";
import { buildShadowTree, type ShadowRefs } from "./shadow-tree";
import {
  ATTR_ALLOWED,
  ATTR_ANIMATION,
  ATTR_BACKDROP,
  ATTR_BACKDROP_COLOR,
  ATTR_CLOSE_ON_ESCAPE,
  ATTR_CLOSE_ON_ROUTE_CHANGE,
  ATTR_DISABLE_CLOSE,
  ATTR_DISABLE_DRAG,
  ATTR_DRAG_FROM,
  ATTR_DRAG_FROM_CONTENT,
  parseDragFrom,
  ATTR_FOCUS_TRAP,
  ATTR_INITIAL,
  ATTR_LOCK_BODY_SCROLL,
  ATTR_MAX_HEIGHT,
  ATTR_MODE,
  ATTR_PERSISTENT,
  ATTR_RADIUS,
  ATTR_RETURN_FOCUS_TO,
  ATTR_SCRIM_COLOR,
  ATTR_SHEET_LABEL,
  ATTR_SNAP,
  ATTR_SNAP_POINTS,
  ATTR_STACK_EFFECT,
  ATTR_STYLESHEET,
  LIVE_ATTRS,
  OBSERVED_ATTRS,
  parseAnchorOptions,
  parseAnimation,
  parseDimension,
  parseList,
  parseMode,
  parseSnapPoints,
} from "./attributes";

const BaseHTMLElement = (
  typeof HTMLElement !== "undefined" ? HTMLElement : class {}
) as typeof HTMLElement;

export class BottomSheetElement extends BaseHTMLElement {
  static get observedAttributes(): string[] {
    return OBSERVED_ATTRS.slice();
  }

  private engine: BottomSheetEngine | null = null;
  private root: ShadowRoot;
  private offHandlers: Array<() => void> = [];
  private refs!: ShadowRefs;
  private backdropClickHandler: (() => void) | null = null;
  private stylesheetLinked = false;
  private declarativeAnchors: HTMLElement[] = [];
  private lastActiveId: string | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });

    const baseStyle = document.createElement("style");
    baseStyle.textContent = baseStyles;
    this.root.appendChild(baseStyle);

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
    if (!this.stylesheetLinked) {
      this.stylesheetLinked = true;
      const stylesheet = this.getAttribute(ATTR_STYLESHEET);
      if (stylesheet) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = stylesheet;
        this.root.appendChild(link);
      }
    }
    this.initEngine();
  }

  disconnectedCallback(): void {
    this.teardownEngine();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.engine) return;
    if (LIVE_ATTRS.has(name)) {
      this.applyLiveAttribute(name, value);
      return;
    }
    this.teardownEngine();
    this.initEngine();
  }

  private applyLiveAttribute(name: string, value: string | null): void {
    if (!this.engine) return;
    switch (name) {
      case ATTR_RADIUS: {
        const r = parseDimension(value);
        if (r !== undefined) this.engine.setRadius(r);
        break;
      }
      case ATTR_MAX_HEIGHT: {
        const h = parseDimension(value);
        if (h !== undefined) this.engine.setMaxHeight(h);
        break;
      }
      case ATTR_BACKDROP_COLOR:
      case ATTR_SCRIM_COLOR:
        this.engine.setScrimColor(value);
        break;
      case ATTR_PERSISTENT:
        this.engine.setPersistent(value === "true");
        break;
      case ATTR_DISABLE_CLOSE:
        this.engine.setDisableClose(value === "true");
        break;
      case ATTR_DISABLE_DRAG:
        this.engine.setDisableDrag(value === "true");
        break;
      case ATTR_DRAG_FROM_CONTENT:
        this.engine.setDragFromContent(value !== "false");
        break;
      case ATTR_SNAP:
        if (value && value !== this.engine.state.activeId) {
          void this.engine.snapTo(value);
        }
        break;
    }
  }

  getEngine(): BottomSheetEngine | null {
    return this.engine;
  }

  private teardownEngine(): void {
    this.lastActiveId = this.engine?.state.activeId ?? this.lastActiveId;
    this.offHandlers.forEach(off => off());
    this.offHandlers = [];
    if (this.backdropClickHandler) {
      this.refs.backdrop.removeEventListener("click", this.backdropClickHandler);
      this.backdropClickHandler = null;
    }
    this.engine?.destroy();
    this.engine = null;
    for (const el of this.declarativeAnchors) {
      this.appendChild(el);
    }
    this.declarativeAnchors = [];
  }

  private initEngine(): void {
    const { sheet, handle, content, backdrop, announcer } = this.refs;

    const mode = parseMode(this.getAttribute(ATTR_MODE));
    sheet.setAttribute("data-mode", mode);
    this.refs.leftButton.setAttribute("data-mode", mode);
    this.refs.rightButton.setAttribute("data-mode", mode);

    const focusTrap = this.getAttribute(ATTR_FOCUS_TRAP) === "true";

    if (focusTrap) {
      sheet.setAttribute("aria-modal", "true");
    } else {
      sheet.removeAttribute("aria-modal");
    }

    sheet.setAttribute(
      "aria-label",
      this.getAttribute(ATTR_SHEET_LABEL) ?? "Bottom sheet",
    );

    const showBackdrop = this.getAttribute(ATTR_BACKDROP) !== "false";
    backdrop.style.display = showBackdrop ? "" : "none";
    if (showBackdrop) {
      this.backdropClickHandler = () => {
        if (this.engine?.canDismiss()) void this.engine.close("backdrop");
      };
      backdrop.addEventListener("click", this.backdropClickHandler);
    }

    const snapPoints = parseSnapPoints(this.getAttribute(ATTR_SNAP_POINTS));
    const initialAttr = this.getAttribute(ATTR_INITIAL) ?? undefined;
    const initial =
      this.lastActiveId && snapPoints.some(p => p.id === this.lastActiveId)
        ? this.lastActiveId
        : initialAttr;

    const opts: EngineOptions = {
      element: sheet,
      handle,
      scrollContainer: content,
      backdrop: showBackdrop ? backdrop : undefined,
      scrim: this.refs.screen,
      mode,
      snapPoints,
      allowed: parseList(this.getAttribute(ATTR_ALLOWED)),
      initial,
      animation: parseAnimation(this.getAttribute(ATTR_ANIMATION)),
      focusTrap,
      closeOnEscape: this.getAttribute(ATTR_CLOSE_ON_ESCAPE) !== "false",
      lockBodyScroll: this.getAttribute(ATTR_LOCK_BODY_SCROLL) !== "false",
      stackEffect: this.getAttribute(ATTR_STACK_EFFECT) === "true",
      persistent: this.getAttribute(ATTR_PERSISTENT) === "true",
      disableClose: this.getAttribute(ATTR_DISABLE_CLOSE) === "true",
      disableDrag: this.getAttribute(ATTR_DISABLE_DRAG) === "true",
      dragFrom: parseDragFrom(this.getAttribute(ATTR_DRAG_FROM)),
      dragFromContent:
        this.getAttribute(ATTR_DRAG_FROM_CONTENT) === null
          ? undefined
          : this.getAttribute(ATTR_DRAG_FROM_CONTENT) !== "false",
      closeOnRouteChange:
        this.getAttribute(ATTR_CLOSE_ON_ROUTE_CHANGE) === "true",
      radius: parseDimension(this.getAttribute(ATTR_RADIUS)),
      maxHeight: parseDimension(this.getAttribute(ATTR_MAX_HEIGHT)),
      returnFocusTo: this.getAttribute(ATTR_RETURN_FOCUS_TO) ?? undefined,
    };

    this.engine = new BottomSheetEngine(opts);
    sheet.setAttribute("data-active", this.engine.state.activeId);

    const scrimColor =
      this.getAttribute(ATTR_SCRIM_COLOR) ??
      this.getAttribute(ATTR_BACKDROP_COLOR);
    if (scrimColor !== null) this.engine.setScrimColor(scrimColor);

    for (const el of Array.from(
      this.querySelectorAll<HTMLElement>('[slot="anchor"]'),
    )) {
      this.declarativeAnchors.push(el);
      this.engine.addAnchor({ ...parseAnchorOptions(el), element: el });
    }

    this.offHandlers = [
      this.engine.on("snap", payload => {
        sheet.setAttribute("data-active", payload.id);
        announcer.textContent = payload.id;
        this.dispatchEvent(new CustomEvent("snap", { detail: payload }));
      }),
      this.engine.on("before-snap", payload => {
        const accepted = this.dispatchEvent(
          new CustomEvent("before-snap", {
            detail: payload,
            cancelable: true,
          }),
        );
        if (!accepted) payload.cancel();
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
      this.engine.on("before-close", payload => {
        const accepted = this.dispatchEvent(
          new CustomEvent("before-close", {
            detail: payload,
            cancelable: true,
          }),
        );
        if (!accepted) payload.cancel();
      }),
      this.engine.on("opened", payload =>
        this.dispatchEvent(new CustomEvent("opened", { detail: payload })),
      ),
      this.engine.on("closed", () =>
        this.dispatchEvent(new CustomEvent("closed")),
      ),
      this.engine.on("dragstart", payload =>
        this.dispatchEvent(new CustomEvent("drag-start", { detail: payload })),
      ),
      this.engine.on("dragend", payload =>
        this.dispatchEvent(new CustomEvent("drag-end", { detail: payload })),
      ),
      this.engine.on("drag", payload =>
        this.dispatchEvent(new CustomEvent("drag", { detail: payload })),
      ),
    ];
  }

  snapTo(id: string): Promise<void> {
    return this.engine?.snapTo(id) ?? Promise.resolve();
  }
  open(id?: string): Promise<void> {
    return this.engine?.open(id) ?? Promise.resolve();
  }
  close(reason?: CloseReason): Promise<void> {
    return this.engine?.close(reason) ?? Promise.resolve();
  }
  expand(): Promise<void> {
    return this.engine?.expand() ?? Promise.resolve();
  }
  collapse(): Promise<void> {
    return this.engine?.collapse() ?? Promise.resolve();
  }
  isTop(): boolean {
    return this.engine?.isTop() ?? false;
  }
  depth(): number {
    return this.engine?.depth() ?? 0;
  }
  canDismiss(): boolean {
    return this.engine?.canDismiss() ?? false;
  }
  setRadius(r: string | number): void {
    this.engine?.setRadius(r);
  }
  setMaxHeight(h: string | number): void {
    this.engine?.setMaxHeight(h);
  }
  setAllowed(ids: string[], snap?: string): void {
    this.engine?.setAllowed(ids, snap);
  }
  addAnchor(opts: AnchorOptions): () => void {
    return this.engine?.addAnchor(opts) ?? (() => {});
  }
  setScrimStages(opts: ScrimStagesOptions | null): () => void {
    return this.engine?.setScrimStages(opts) ?? (() => {});
  }
  recompute(): void {
    this.engine?.recompute();
  }
  get sheetState(): EngineState | null {
    return this.engine?.state ?? null;
  }
  get snap(): string | null {
    return this.engine?.state.activeId ?? this.getAttribute(ATTR_SNAP);
  }
  set snap(id: string | null) {
    if (id === null) {
      this.removeAttribute(ATTR_SNAP);
      return;
    }
    if (this.engine) {
      if (id !== this.engine.state.activeId) void this.engine.snapTo(id);
    } else {
      this.setAttribute(ATTR_SNAP, id);
    }
  }
}

export type TypedBottomSheetElement<TId extends string = string> =
  HTMLElement & {
    snapTo: (id: TId) => Promise<void>;
    open: (id?: TId) => Promise<void>;
    close: (reason?: CloseReason) => Promise<void>;
    expand: () => Promise<void>;
    collapse: () => Promise<void>;
    isTop: () => boolean;
    depth: () => number;
    canDismiss: () => boolean;
    setRadius: (r: string | number) => void;
    setMaxHeight: (h: string | number) => void;
    setAllowed: (ids: TId[], snap?: TId) => void;
    snap: TId | null;
    readonly sheetState: (EngineState & { activeId: TId }) | null;
  };

export const defineBottomSheet = (tag = "bottom-sheet"): void => {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;
  customElements.define(tag, class extends BottomSheetElement {});
};
