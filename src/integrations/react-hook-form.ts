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
      const { isDirty, isSubmitting } = methodsRef.current.formState;
      if (isSubmitting || (payload.size === 0 && isDirty)) payload.cancel();
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
