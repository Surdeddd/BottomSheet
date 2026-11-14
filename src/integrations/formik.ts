import { useEffect, useRef } from "react";
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
  const boundTo = useRef<SheetEventTarget | null>(null);
  const release = useRef<(() => void) | null>(null);

  useEffect(() => {
    const target = sheetRef.current ?? null;
    if (target === boundTo.current) return;
    release.current?.();
    boundTo.current = target;
    if (!target) {
      release.current = null;
      return;
    }
    release.current = target.on("before-snap", payload => {
      const formik = formikRef.current;
      if (!formik) return;
      if (formik.isSubmitting || (payload.size === 0 && formik.dirty)) {
        payload.cancel();
      }
    });
  });

  useEffect(
    () => () => {
      release.current?.();
      release.current = null;
      boundTo.current = null;
    },
    [],
  );
}
