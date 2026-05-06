import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-regression breakpoints. Kept here (not in the spec) so the
 * Playwright reporter shows one project per width and snapshot paths
 * group cleanly under `__snapshots__/visual-regression.spec.ts/<project>/`.
 */
const VISUAL_BREAKPOINTS = [
  { name: "visual-320", width: 320, height: 720 },
  { name: "visual-375", width: 375, height: 812 },
  { name: "visual-480", width: 480, height: 900 },
  { name: "visual-720", width: 720, height: 1024 },
  { name: "visual-1280", width: 1280, height: 900 },
] as const;

// Mobile-device visual regression projects. Use real device descriptors
// (Pixel 5, iPhone 13) so the screenshot includes device-pixel-ratio +
// mobile-Chrome rendering quirks — desktop-Chrome at 393×851 misses things
// like text auto-sizing, scrollbar thickness, and momentum scrolling.
const MOBILE_VISUAL_PROJECTS = [
  { name: "visual-pixel-5", device: devices["Pixel 5"] },
  { name: "visual-iphone-13", device: devices["iPhone 13"] },
] as const;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI runners (especially WebKit emulation on Linux) have non-deterministic
  // first-paint timing for shadow-DOM and Svelte adapters. Two retries on CI
  // catches flakes without masking real regressions — local runs stay strict.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  webServer: {
    command: "npx vite --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  // Default snapshot threshold: flag any frame with >2% pixel diff. Per-call
  // overrides in the visual spec can tighten this further if needed.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: [
    {
      name: "mobile-chrome",
      // Existing project — pinned to Pixel 5 (393×851). Do not touch.
      testIgnore: /visual-regression\.spec\.ts/,
      use: devices["Pixel 5"],
    },
    {
      // iOS Safari coverage. Bottom sheets ship 50%+ traffic on iOS, so
      // WebKit-specific gesture / VisualViewport / overscroll quirks must be
      // exercised before release. Snapshot, benchmark, and head-to-head specs
      // are pinned to Chrome (device-specific baselines + competitor parity)
      // so we exclude them here. soft-keyboard is .fixme everywhere — keep it
      // out of WebKit until Playwright/CDP gains a soft-keyboard simulator.
      name: "mobile-safari",
      testIgnore:
        /(visual-regression|headtohead|benchmark|soft-keyboard)\.spec\.ts/,
      use: devices["iPhone 13"],
    },
    // One project per breakpoint so screenshots are tagged + grouped per width.
    ...VISUAL_BREAKPOINTS.map(bp => ({
      name: bp.name,
      testMatch: /visual-regression\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: bp.width, height: bp.height },
        deviceScaleFactor: 1,
        // Disable animations is enforced again at screenshot time below; the
        // Desktop Chrome device profile is otherwise neutral.
      },
    })),
    // Mobile-device visual regression — catches DPR-related sub-pixel shifts,
    // mobile font auto-sizing, and momentum-scroll-induced layout deltas that
    // Desktop Chrome at the same pixel width would miss.
    ...MOBILE_VISUAL_PROJECTS.map(p => ({
      name: p.name,
      testMatch: /visual-regression\.spec\.ts/,
      use: p.device,
    })),
  ],
});
