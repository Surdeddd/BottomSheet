/**
 * Form-integration smoke tests.
 *
 * Both adapters use type-only imports for `react-hook-form` / `formik`, so
 * the modules under test are always resolvable. The tests construct a fake
 * `BottomSheetEngine`-shaped target and verify that the `before-snap`
 * listener cancels at the documented points.
 *
 * NB: rendering the hooks needs a React renderer, so we exercise the
 * effect manually by calling the hook's effect-body equivalent — i.e. we
 * register the listener directly via the same `target.on(...)` contract.
 * That keeps the test runtime free of `react-hook-form` and `formik` and
 * avoids pulling in `@testing-library/react-hooks` for a 50-line check.
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "./_renderHook";
import { useFormGuard } from "../../src/integrations/react-hook-form";
import { useFormikGuard } from "../../src/integrations/formik";
import type { SheetEventMap } from "../../src/core/types";

type Listener = (payload: SheetEventMap["before-snap"]) => void;

const makeFakeTarget = () => {
  const listeners = new Set<Listener>();
  return {
    on: vi.fn(
      (
        event: keyof SheetEventMap,
        fn: Listener,
      ): (() => void) => {
        if (event !== "before-snap") return () => {};
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    ),
    fire: (id: string) => {
      const cancel = vi.fn();
      const payload = { id, size: 0, cancel, previousId: "open" };
      listeners.forEach(fn => fn(payload));
      return cancel;
    },
    listenerCount: () => listeners.size,
  };
};

describe("useFormGuard (react-hook-form)", () => {
  it("cancels close when the form is dirty", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const methods = {
      formState: { isDirty: true, isSubmitting: false, isSubmitSuccessful: false },
    };
    renderHook(() => useFormGuard(sheetRef, methods));
    expect(target.listenerCount()).toBe(1);
    const cancel = target.fire("closed");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does NOT cancel close when the form is clean", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const methods = {
      formState: { isDirty: false, isSubmitting: false, isSubmitSuccessful: false },
    };
    renderHook(() => useFormGuard(sheetRef, methods));
    const cancel = target.fire("closed");
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels ANY snap (not just close) while submitting", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const methods = {
      formState: { isDirty: false, isSubmitting: true, isSubmitSuccessful: false },
    };
    renderHook(() => useFormGuard(sheetRef, methods));
    expect(target.fire("half")).toHaveBeenCalledOnce();
    expect(target.fire("full")).toHaveBeenCalledOnce();
    expect(target.fire("closed")).toHaveBeenCalledOnce();
  });

  it("does not cancel resize/open when dirty (only close)", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const methods = {
      formState: { isDirty: true, isSubmitting: false, isSubmitSuccessful: false },
    };
    renderHook(() => useFormGuard(sheetRef, methods));
    expect(target.fire("half")).not.toHaveBeenCalled();
    expect(target.fire("full")).not.toHaveBeenCalled();
  });

  it("releases the listener on unmount", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const methods = {
      formState: { isDirty: true, isSubmitting: false, isSubmitSuccessful: false },
    };
    const { unmount } = renderHook(() => useFormGuard(sheetRef, methods));
    expect(target.listenerCount()).toBe(1);
    unmount();
    expect(target.listenerCount()).toBe(0);
  });

  it("does nothing when the sheet ref is empty", () => {
    const sheetRef = { current: null } as unknown as Parameters<typeof useFormGuard>[0];
    const methods = {
      formState: { isDirty: true, isSubmitting: true, isSubmitSuccessful: false },
    };
    // Just don't throw.
    expect(() =>
      renderHook(() => useFormGuard(sheetRef, methods)),
    ).not.toThrow();
  });

  // Sug-1 / Min-1: regression test for the M3 ref-pattern fix. Without the
  // internal `methodsRef`, a parent rerendering with a freshly-created
  // `methods` object (e.g. wizard step swap) would leave the listener
  // pointing at the original closure-captured form-state. This test would
  // have failed before the M3 fix.
  it("ref-pattern: rerender with new methods sees fresh state (no stale closure)", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    let methods = {
      formState: { isDirty: false, isSubmitting: false, isSubmitSuccessful: false },
    };
    const handle = renderHook(() => useFormGuard(sheetRef, methods));
    // Initial state — clean, close should NOT cancel.
    let cancel = target.fire("closed");
    expect(cancel).not.toHaveBeenCalled();
    // Parent rerenders with a fresh methods object that's now dirty (wizard
    // step that owned the form remounted with new data).
    methods = {
      formState: { isDirty: true, isSubmitting: false, isSubmitSuccessful: false },
    };
    handle.rerender(() => useFormGuard(sheetRef, methods));
    // After rerender, the listener must see the new dirty state via the ref.
    cancel = target.fire("closed");
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("useFormikGuard (formik)", () => {
  it("cancels close when dirty", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const formikRef = { current: { dirty: true, isSubmitting: false } };
    renderHook(() => useFormikGuard(sheetRef, formikRef));
    expect(target.fire("closed")).toHaveBeenCalledOnce();
  });

  it("does not cancel close when clean", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const formikRef = { current: { dirty: false, isSubmitting: false } };
    renderHook(() => useFormikGuard(sheetRef, formikRef));
    expect(target.fire("closed")).not.toHaveBeenCalled();
  });

  it("cancels ANY snap while submitting", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const formikRef = { current: { dirty: false, isSubmitting: true } };
    renderHook(() => useFormikGuard(sheetRef, formikRef));
    expect(target.fire("half")).toHaveBeenCalledOnce();
    expect(target.fire("full")).toHaveBeenCalledOnce();
  });

  it("releases listener on unmount", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const formikRef = { current: { dirty: true, isSubmitting: false } };
    const { unmount } = renderHook(() => useFormikGuard(sheetRef, formikRef));
    expect(target.listenerCount()).toBe(1);
    unmount();
    expect(target.listenerCount()).toBe(0);
  });

  it("tolerates a null formik ref (e.g. before <Formik> mounts)", () => {
    const target = makeFakeTarget();
    const sheetRef = { current: target } as unknown as Parameters<typeof useFormGuard>[0];
    const formikRef = { current: null as { dirty: boolean; isSubmitting: boolean } | null };
    renderHook(() => useFormikGuard(sheetRef, formikRef));
    expect(target.fire("closed")).not.toHaveBeenCalled();
  });
});
