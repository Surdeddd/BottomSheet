import {
  genCode,
  tokenize,
  type AdapterKey as CodegenAdapterKey,
} from "./codegen";
import { snapPoints as resolveSnapPoints } from "../apps/shared";
import { announce, type AdapterKey, type Settings } from "./types";

const paintCode = (target: HTMLElement, code: string): void => {
  while (target.firstChild) target.removeChild(target.firstChild);
  for (const tok of tokenize(code)) {
    if (tok.cls === "") {
      target.appendChild(document.createTextNode(tok.text));
    } else {
      const span = document.createElement("span");
      span.className = tok.cls;
      span.textContent = tok.text;
      target.appendChild(span);
    }
  }
  target.dataset.raw = code;
};

export type CodePanelDeps = {
  settings: Settings;
  getActiveAdapter: () => AdapterKey;
};

export const renderCode = (deps: CodePanelDeps): void => {
  const adapter = deps.getActiveAdapter();
  const snaps = resolveSnapPoints(deps.settings.mode).filter(
    s => s.id !== "closed",
  );
  const target = document.querySelector<HTMLElement>(`#code-${adapter}`);
  if (!target) return;
  paintCode(target, genCode(adapter as CodegenAdapterKey, deps.settings, snaps));
};

let copyWired = false;
export const wireCopyButton = (
  getActiveAdapter: () => AdapterKey,
): void => {
  if (copyWired) return;
  copyWired = true;
  const btn = document.querySelector<HTMLButtonElement>("#code-copy");
  const label = document.querySelector<HTMLElement>("#code-copy-label");
  if (!btn || !label) return;
  btn.addEventListener("click", async () => {
    const target = document.querySelector<HTMLElement>(
      `#code-${getActiveAdapter()}`,
    );
    const raw = target?.dataset.raw ?? target?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(raw);
      label.textContent = "copied";
      announce("Code copied to clipboard");
    } catch {
      label.textContent = "failed";
      announce("Copy failed");
    }
    window.setTimeout(() => (label.textContent = "copy"), 1400);
  });
};
