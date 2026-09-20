/** @jsxImportSource solid-js */
import { render } from "solid-js/web";
import { For } from "solid-js";
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import type { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import { POINTS, ROWS, hostFor, type AdapterHandle } from "./adapters-fit-shared";

export const mountSolid = (): AdapterHandle => {
  let engine: BottomSheetEngine | null = null;
  render(
    () => (
      <BottomSheet
        snapPoints={POINTS}
        initial="closed"
        animation="tween"
        lockBodyScroll={false}
        fitContentToSnap
        engineRef={next => {
          engine = next;
        }}
        footer={
          <button type="button" data-action="solid">
            action
          </button>
        }
      >
        <For each={ROWS}>
          {i => (
            <div class="row" data-row={i} data-owner="solid">
              row {i}
            </div>
          )}
        </For>
      </BottomSheet>
    ),
    hostFor("solid"),
  );
  return {
    open: id => engine!.open(id),
    close: () => engine!.close(),
  };
};
