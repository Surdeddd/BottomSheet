import { useEffect, useRef, useState } from "react";
import {
  BottomSheet,
  Overlay,
  useBottomSheet,
  type BottomSheetHandle,
} from "@surdeddd/bottom-sheet/react";
import { useFormGuard } from "@surdeddd/bottom-sheet/integrations/react-hook-form";
import { useFormikGuard } from "@surdeddd/bottom-sheet/integrations/formik";
import "@surdeddd/bottom-sheet/styles";
import "@surdeddd/bottom-sheet/themes/ios";

const FilterForm = () => null;
const PlaceList = (_: { onPick?: () => void }) => null;
const Menu = () => null;

export function Filters() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Filters</button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "open", size: "fit" },
        ]}
        focusTrap
        inertSiblings
        header={<h2>Filters</h2>}
        footer={<button onClick={() => setOpen(false)}>Apply</button>}
      >
        <FilterForm />
      </BottomSheet>
    </>
  );
}

export function Nearby() {
  const sheet = useRef<BottomSheetHandle>(null);
  return (
    <BottomSheet
      ref={sheet}
      snapPoints={[
        { id: "peek", size: 96 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "90%" },
      ]}
      initial="peek"
      header={<h2>Nearby</h2>}
      onSnap={id => console.log("rests at", id)}
      persistent
      backdropOpacity={0.6}
      backdropColor="rgb(0 0 0 / 0.4)"
      backdropRange={[0.4, 1]}
      teleportTo="body"
      handleLabel="Resize"
      contentLabel="Places"
      fitContentToSnap
      dragFromContent={false}
      initialFocus="[name=reply]"
      onBeforeClose={({ reason, cancel }) => {
        if (reason === "backdrop") cancel();
      }}
    >
      <PlaceList onPick={() => sheet.current?.snapTo("full")} />
    </BottomSheet>
  );
}

export function Follow() {
  const sheet = useRef<BottomSheetHandle>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      sheet.current?.on("progress", ({ value }) => {
        mapRef.current!.style.opacity = String(1 - value);
      }),
    [],
  );
  return <div ref={mapRef} />;
}

const snapPoints = [
  { id: "peek", size: 96 },
  { id: "full", size: "90%" },
];

export function Hook() {
  const { sheetRef, handleRef, contentRef, backdropRef, state, snapTo } =
    useBottomSheet({ snapPoints, initial: "peek" });
  void state;
  void snapTo;
  return (
    <div className="bs-root">
      <div ref={backdropRef} className="bs-backdrop" />
      <section ref={sheetRef} className="bs-sheet" data-mode="bottom" aria-label="Places">
        <div ref={handleRef} className="bs-handle" role="slider" tabIndex={0} aria-label="Resize sheet" />
        <div ref={contentRef} className="bs-content">…</div>
      </section>
    </div>
  );
}

export function Guard() {
  const form = { formState: { isDirty: false, isSubmitting: false, isSubmitSuccessful: false } };
  const formik = useRef({ dirty: false, isSubmitting: false });
  const sheet = useRef<BottomSheetHandle>(null);
  useFormGuard(sheet, form);
  useFormikGuard(sheet, formik);
  return null;
}

export function Side() {
  const [open, setOpen] = useState(false);
  return (
    <Overlay open={open} edge="right" preset="sidebar" onClose={() => setOpen(false)}>
      <Menu />
    </Overlay>
  );
}
