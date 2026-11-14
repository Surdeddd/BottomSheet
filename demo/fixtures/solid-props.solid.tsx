/** @jsxImportSource solid-js */
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { BottomSheet } from "@surdeddd/bottom-sheet/solid";
import "@surdeddd/bottom-sheet/styles";
import type { BottomSheetEngine } from "../../src/core/BottomSheetEngine";
import type { SheetMode } from "../../src/core/types";

const POINTS = [
  { id: "closed", size: 0 },
  { id: "half", size: 240 },
  { id: "full", size: 480 },
];

let engine: BottomSheetEngine | null = null;
let headerMounts = 0;

const Header = () => {
  headerMounts += 1;
  return <h2 data-testid="solid-header">Solid header</h2>;
};

const [persistent, setPersistent] = createSignal<boolean | undefined>();
const [mode, setMode] = createSignal<SheetMode | undefined>();
const [radius, setRadius] = createSignal(12);
const [allowed, setAllowed] = createSignal<string[] | undefined>();
const [open, setOpen] = createSignal<boolean | undefined>();
const openChanges: boolean[] = [];

render(
  () => (
    <BottomSheet
      snapPoints={POINTS}
      initial="half"
      animation="tween"
      lockBodyScroll={false}
      scrimPreset="cinematic"
      handleLabel="Resize the panel"
      contentLabel="Panel content"
      persistent={persistent()}
      mode={mode()}
      radius={radius()}
      allowed={allowed()}
      open={open()}
      onOpenChange={next => {
        openChanges.push(next);
      }}
      engineRef={next => {
        engine = next;
      }}
      header={<Header />}
    >
      <p style={{ padding: "16px" }}>content</p>
    </BottomSheet>
  ),
  document.getElementById("host")!,
);

Object.assign(window as unknown as Record<string, unknown>, {
  bsSolid: {
    setPersistent,
    setMode,
    setRadius,
    setAllowed,
    setOpen,
    openChanges: (): boolean[] => [...openChanges],
    phase: (): string => engine!.state.phase,
    canDismiss: (): boolean => engine!.canDismiss(),
    allowedIds: (): string[] => engine!.getAllowedIds(),
    headerMounts: (): number => headerMounts,
  },
});
