import { useEffect } from "react";
import type { SheetEventMap } from "../core/types";

// Structural shape of `formik`'s FormikProps — duplicated so this module
// type-checks without the peer dep installed.
export type FormikStateLike = {
  dirty: boolean;
  isSubmitting: boolean;
};

export type SheetEventTarget = {
  on: <K extends keyof SheetEventMap>(
    event: K,
    listener: (payload: SheetEventMap[K]) => void,
  ) => () => void;
};

export type SheetGuardRef =
  | { current: SheetEventTarget | null | undefined }
  | { readonly current: SheetEventTarget | null | undefined };

export type FormikRefLike = {
  current: FormikStateLike | null | undefined;
};

/**
 * Formik counterpart to useFormGuard — takes a `ref<FormikProps>` because
 * Formik's render-prop API doesn't surface props at hook-call time the way
 * useForm() does. Use `<Formik innerRef={formikRef}>` or stash `useFormik()`
 * on a ref yourself.
 */
export function useFormikGuard<Values extends Record<string, unknown> = Record<string, unknown>>(
  sheetRef: SheetGuardRef,
  formikRef: FormikRefLike,
  _tag?: Values,
): void {
  useEffect(() => {
    const target = sheetRef.current;
    if (!target) return;
    const off = target.on("before-snap", payload => {
      const formik = formikRef.current;
      if (!formik) return;
      if (formik.isSubmitting) {
        payload.cancel();
        return;
      }
      if (payload.id === "closed" && formik.dirty) {
        payload.cancel();
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetRef, formikRef]);
}
