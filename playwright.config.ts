import { defineConfig, devices } from "@playwright/test";

const VISUAL_BREAKPOINTS = [
  { name: "visual-320", width: 320, height: 720 },
  { name: "visual-375", width: 375, height: 812 },
  { name: "visual-480", width: 480, height: 900 },
  { name: "visual-720", width: 720, height: 1024 },
  { name: "visual-1280", width: 1280, height: 900 },
] as const;

const MOBILE_VISUAL_PROJECTS = [
  { name: "visual-pixel-5", device: devices["Pixel 5"] },
  { name: "visual-iphone-13", device: devices["iPhone 13"] },
] as const;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  webServer: {
    command: process.env.CI
      ? "npx vite build && npx vite preview --port 5173 --strictPort"
      : "npx vite --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
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
      testIgnore: /visual-regression\.spec\.ts/,
      retries: 3,
      timeout: 60_000,
      use: devices["Pixel 5"],
    },
    {
      name: "mobile-safari",
      testIgnore:
        /(visual-regression|headtohead|benchmark)\.spec\.ts/,
      retries: 3,
      timeout: 60_000,
      use: devices["iPhone 13"],
    },
    ...VISUAL_BREAKPOINTS.map(bp => ({
      name: bp.name,
      testMatch: /visual-regression\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: bp.width, height: bp.height },
        deviceScaleFactor: 1,
      },
    })),
    ...MOBILE_VISUAL_PROJECTS.map(p => ({
      name: p.name,
      testMatch: /visual-regression\.spec\.ts/,
      use: p.device,
    })),
  ],
});
