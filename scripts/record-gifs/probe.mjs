import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(process.env.DEMO_URL || "https://bottom-sheet-demo.vercel.app", {
  waitUntil: "networkidle",
});
await page.waitForSelector(".bs-handle", { timeout: 8000 });
await page.locator(".device-wrap").scrollIntoViewIfNeeded();
await new Promise((r) => setTimeout(r, 500));
const wrapBox = await page.locator(".device-wrap").boundingBox();
const innerBox = await page
  .locator("#device-frame")
  .first()
  .boundingBox()
  .catch(() => null);
console.log("device-wrap (used by record.mjs):", wrapBox);
console.log("device-frame (debug-only, may be null):", innerBox);
await page.screenshot({ path: "/tmp/probe-full.png", fullPage: false });
await browser.close();
