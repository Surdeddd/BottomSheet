/** @jsxImportSource @builder.io/qwik */
import { component$, useSignal } from "@builder.io/qwik";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik";
import "@surdeddd/bottom-sheet/styles";

const FilterForm = component$(() => <form />);

export const Filters = component$(() => {
  const open = useSignal(false);
  return (
    <>
      <button onClick$={() => (open.value = true)}>Filters</button>
      <BottomSheet
        open={open.value}
        onOpenChange$={next => (open.value = next)}
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "open", size: "fit" },
        ]}
        focusTrap
      >
        <h2 q:slot="header">Filters</h2>
        <FilterForm />
        <button q:slot="footer" onClick$={() => (open.value = false)}>
          Apply
        </button>
      </BottomSheet>
    </>
  );
});

export const Nearby = component$(() => {
  const snap = useSignal("peek");
  return (
    <BottomSheet
      snap={snap.value}
      onSnap$={id => (snap.value = id)}
      snapPoints={[
        { id: "peek", size: 96 },
        { id: "half", size: "45dvh" },
        { id: "full", size: "90%" },
      ]}
      persistKey="nearby"
      teleportTo="body"
    >
      <h2 q:slot="header">Nearby</h2>
      <button onClick$={() => (snap.value = "full")}>Show all</button>
    </BottomSheet>
  );
});
