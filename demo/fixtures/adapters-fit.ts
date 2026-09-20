import "@surdeddd/bottom-sheet/styles";
import "@surdeddd/bottom-sheet/element";
import { mount } from "svelte";
import AdaptersFitSvelte from "./AdaptersFitSvelte.svelte";
import { mountReact } from "./adapters-fit-react";
import { mountVue } from "./adapters-fit-vue";
import { mountSolid } from "./adapters-fit.solid";
import { POINTS, ROWS, hostFor, type AdapterHandle } from "./adapters-fit-shared";

const mountSvelte = (): AdapterHandle =>
  mount(AdaptersFitSvelte, { target: hostFor("svelte") }) as AdapterHandle;

const mountElement = (): AdapterHandle => {
  const el = document.createElement("bottom-sheet") as HTMLElement &
    AdapterHandle;
  el.setAttribute("snap-points", JSON.stringify(POINTS));
  el.setAttribute("initial", "closed");
  el.setAttribute("animation", "tween");
  el.setAttribute("lock-body-scroll", "false");
  el.setAttribute("fit-content-to-snap", "");
  for (const i of ROWS) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.row = String(i);
    row.dataset.owner = "element";
    row.textContent = `row ${i}`;
    el.append(row);
  }
  const footer = document.createElement("div");
  footer.slot = "footer";
  footer.innerHTML = '<button type="button" data-action="element">action</button>';
  el.append(footer);
  hostFor("element").append(el);
  return { open: id => el.open(id), close: () => el.close() };
};

Object.assign(window as unknown as Record<string, unknown>, {
  bsAdapters: {
    react: mountReact(),
    vue: mountVue(),
    svelte: mountSvelte(),
    solid: mountSolid(),
    element: mountElement(),
  },
});
