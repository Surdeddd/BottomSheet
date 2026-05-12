import { useEffect, useRef } from "react";
import type { SheetEventMap } from "../core/types";

export type RhfFormStateLike = {
  formState: {
    isDirty: boolean;
    isSubmitting: boolean;
    isSubmitSuccessful: boolean;
  };
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

export function useFormGuard<TFieldValues extends Record<string, unknown> = Record<string, unknown>>(
  sheetRef: SheetGuardRef,
  methods: RhfFormStateLike,
  _tag?: TFieldValues,
): void {
  const methodsRef = useRef(methods);
  methodsRef.current = methods;

  useEffect(() => {
    const target = sheetRef.current;
    if (!target) return;
    const off = target.on("before-snap", payload => {
      const { isDirty, isSubmitting } = methodsRef.current.formState;
      if (isSubmitting) {
        payload.cancel();
        return;
      }
      if (payload.id === "closed" && isDirty) {
        payload.cancel();
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetRef]);
}
