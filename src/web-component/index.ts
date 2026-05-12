export {
  BottomSheetElement,
  defineBottomSheet,
  type TypedBottomSheetElement,
} from "./BottomSheetElement";

if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  import("./BottomSheetElement").then(({ defineBottomSheet }) => {
    defineBottomSheet();
  });
}
