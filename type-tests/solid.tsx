/** @jsxImportSource solid-js */
import { createSignal } from "solid-js";
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import type { BottomSheetEngine } from "@surdeddd/bottom-sheet";
import "@surdeddd/bottom-sheet/styles";

const FilterForm = () => null;
const PlaceList = (_: { onPick?: () => void }) => null;

export function Filters() {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Filters</button>
      <BottomSheet
        open={open()}
        onOpenChange={setOpen}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "open", size: "fit" },
        ]}
        focusTrap
        header={<h2>Filters</h2>}
        footer={<button onClick={() => setOpen(false)}>Apply</button>}
      >
        <FilterForm />
      </BottomSheet>
    </>
  );
}

export function Nearby() {
  let sheet: BottomSheetEngine | null = null;
  return (
    <BottomSheet
      engineRef={engine => (sheet = engine)}
      snapPoints={[
        { id: "peek", size: 96 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "90%" },
      ]}
      initial="peek"
      header={<h2>Nearby</h2>}
      onSnap={id => console.log("rests at", id)}
      teleportTo="body"
      handleLabel="Resize"
      scrimPreset="cinematic"
      backdropOpacity={0.5}
    >
      <PlaceList onPick={() => sheet?.snapTo("full")} />
    </BottomSheet>
  );
}
