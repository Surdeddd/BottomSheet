import { createRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BottomSheet,
  type BottomSheetHandle,
} from "@surdeddd/bottom-sheet/react";
import { POINTS, ROWS, hostFor, type AdapterHandle } from "./adapters-fit-shared";

export const mountReact = (): AdapterHandle => {
  const sheet = createRef<BottomSheetHandle>();
  createRoot(hostFor("react")).render(
    <BottomSheet
      ref={sheet}
      snapPoints={POINTS}
      initial="closed"
      animation="tween"
      lockBodyScroll={false}
      fitContentToSnap
      footer={
        <button type="button" data-action="react">
          action
        </button>
      }
    >
      {ROWS.map(i => (
        <div className="row" data-row={i} data-owner="react" key={i}>
          row {i}
        </div>
      ))}
    </BottomSheet>,
  );
  return {
    open: id => sheet.current!.open(id),
    close: () => sheet.current!.close(),
  };
};
