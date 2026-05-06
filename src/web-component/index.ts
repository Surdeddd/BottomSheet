export {
  BottomSheetElement,
  defineBottomSheet,
  type TypedBottomSheetElement,
} from "./BottomSheetElement";

// Auto-register on import for convenience. To customize the tag, import
// `defineBottomSheet` from "@surdeddd/bottom-sheet/element" and call it manually
// before this side-effecting import.
if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  import("./BottomSheetElement").then(({ defineBottomSheet }) => {
    defineBottomSheet();
  });
}
