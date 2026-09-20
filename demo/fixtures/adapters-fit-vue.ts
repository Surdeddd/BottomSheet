import { createApp, h } from "vue";
import { BottomSheet } from "@surdeddd/bottom-sheet/vue";
import { POINTS, ROWS, hostFor, type AdapterHandle } from "./adapters-fit-shared";

export const mountVue = (): AdapterHandle => {
  let sheet: AdapterHandle | null = null;
  createApp({
    render: () =>
      h(
        BottomSheet,
        {
          ref: (instance: unknown) => {
            sheet = instance as AdapterHandle | null;
          },
          snapPoints: POINTS,
          initial: "closed",
          animation: "tween",
          lockBodyScroll: false,
          fitContentToSnap: true,
        },
        {
          default: () =>
            ROWS.map(i =>
              h(
                "div",
                { class: "row", "data-row": i, "data-owner": "vue", key: i },
                `row ${i}`,
              ),
            ),
          footer: () =>
            h("button", { type: "button", "data-action": "vue" }, "action"),
        },
      ),
  }).mount(hostFor("vue"));
  return {
    open: id => sheet!.open(id),
    close: () => sheet!.close(),
  };
};
