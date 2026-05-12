import { useEffect } from "react";
import type { SheetEventMap } from "../core/types";

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
