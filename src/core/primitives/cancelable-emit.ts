import { devWarn } from "./devWarn";

export function emitCancelable<P>(
  emit: (payload: P & { cancel: () => void }) => void,
  base: P,
  warnLabel: string,
): boolean {
  let cancelled = false;
  let frozen = false;
  emit({
    ...base,
    cancel: () => {
      if (frozen) {
        devWarn(
          `[BottomSheet] ${warnLabel}.cancel() called asynchronously — ignored. cancel() must be invoked synchronously inside the listener.`,
        );
        return;
      }
      cancelled = true;
    },
  });
  frozen = true;
  return cancelled;
}
