import { test } from "@playwright/test";

/**
 * Soft-keyboard popup adjustment — UNTESTABLE in Playwright.
 *
 * On real iOS/Android Chrome, focusing an `<input>` inside the sheet pops
 * up the OS soft keyboard. This shrinks the visual viewport (but NOT
 * `window.innerHeight` on iOS), and the engine's VisualViewport listener
 * (core/BottomSheetEngine.ts ~L477 `attachVisualViewport`) clamps the
 * sheet's `maxAxisSize` so the sheet never reaches into the keyboard area.
 *
 * Why we can't test this in Playwright:
 *   - Playwright/Chromium do not simulate the OS soft keyboard at all.
 *     Focusing an input in headless or headed mobile-chrome emulation
 *     does NOT fire `visualViewport.resize` and does NOT change
 *     `window.visualViewport.height`. There is no flag, CDP command, or
 *     device descriptor that triggers it.
 *   - Manually dispatching a synthetic `resize` on `window.visualViewport`
 *     is not allowed (read-only EventTarget for synthetic emit), and even
 *     if forced via `Object.defineProperty` patching it bypasses the very
 *     code path we want to assert.
 *
 * MANUAL VERIFICATION CHECKLIST (real device only):
 *   1. Open the demo on real iOS Safari / Chrome iOS / Android Chrome.
 *   2. Open a sheet that contains an `<input>` (e.g. the React demo's
 *      search field at .sheet-search inside the bs-content).
 *   3. Tap the input. Soft keyboard slides up.
 *   4. Verify the sheet's bottom edge stays *above* the keyboard with at
 *      least the engine's 8px SAFETY_PAD (BottomSheetEngine.ts L489).
 *   5. Verify the sheet content remains scrollable while the keyboard is
 *      open.
 *   6. Dismiss the keyboard (tap outside / press Done). Verify the sheet
 *      smoothly restores to its prior `maxAxisSize` and `--bs-size`
 *      without a layout jump.
 *   7. Repeat in `top` mode — the clamp must still apply because the
 *      engine reads `vv.height` regardless of mode (`isVerticalAxis`
 *      branch resolves to `vv.height` for both `bottom` and `top`).
 *
 * If any step fails on a real device, the bug is in
 * `attachVisualViewport`'s clamp logic or the listener was disconnected
 * prematurely (check `detachVisualViewport` callsites).
 */

test.describe("Soft keyboard popup (manual only)", () => {
  // Tests audit #17: marked .fixme so Playwright reports it as known-broken
  // (visible in the report) rather than silent .skip. Convert back to a
  // working test if Playwright/CDP ever ships a soft-keyboard simulator.
  test.fixme(
    "soft keyboard popup is not testable in Playwright",
    () => {
      // Intentionally empty — this test never runs (.fixme marks it as
      // a known-failing TODO). See file header for manual verification steps.
    },
  );
});
