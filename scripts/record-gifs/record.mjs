import { chromium } from "playwright";
import { mkdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const RAW_DIR = join(__dirname, ".raw");
const OUT_DIR = join(ROOT, "docs", "gifs");

const URL = process.env.DEMO_URL || "https://bottom-sheet-demo.vercel.app";
const VIEWPORT = { width: 1280, height: 860 };
const FPS = 16;
const GIF_WIDTH = 380;
const WARMUP_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dragHandle(
  page,
  selector,
  dy,
  steps = 30,
  stepDelay = 8,
) {
  const el = await page.locator(selector).first();
  const box = await el.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  const startX = box.x + box.width / 2;
  const startY = box.y + 24;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX, startY + (dy * i) / steps, { steps: 1 });
    await sleep(stepDelay);
  }
  await page.mouse.up();
}

async function scrollContent(page, dy, steps = 8, stepDelay = 60) {
  const content = await page
    .locator(".device-screen:not([hidden]) .bs-content")
    .first();
  const box = await content.boundingBox();
  if (!box) throw new Error("no .bs-content box (active adapter not mounted?)");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(stepDelay);
  }
}

async function api(page, fn, arg) {
  return page.evaluate(([f, a]) => {
    const click = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    };
    const fns = {
      snap: (id) => click(`[data-snap="${id}"]`),
      mode: (id) => click(`[data-mode="${id}"]`),
      theme: (id) => click(`[data-theme-preset="${id}"]`),
      scrim: (id) => click(`[data-scrim-preset="${id}"]`),
      adapter: (id) => click(`[data-adapter="${id}"]`),
    };
    fns[f](a);
  }, [fn, arg]);
}

const SCENARIOS = [
  {
    name: "01-drag-to-close",
    async run(page) {
      await api(page, "snap", "minimized");
      await sleep(900);
      await dragHandle(page, ".bs-handle", -440, 44, 14);
      await sleep(1300);
      await sleep(400);
      await scrollContent(page, 320, 8, 70);
      await sleep(900);
      await scrollContent(page, -320, 8, 70);
      await sleep(800);
      await dragHandle(page, ".bs-handle", 220, 28, 14);
      await sleep(1100);
      await dragHandle(page, ".bs-handle", 520, 16, 4);
      await sleep(1500);
    },
  },
];

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-y", "-loglevel", "error", ...args], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)),
    );
  });
}

async function videoToGif(videoPath, gifPath, cropBox, trimStart) {
  const palette = videoPath + ".palette.png";
  const crop = cropBox
    ? `crop=${cropBox.w}:${cropBox.h}:${cropBox.x}:${cropBox.y},`
    : "";
  const filterBase = `${crop}fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;
  const trimArgs = trimStart > 0 ? ["-ss", String(trimStart)] : [];
  await ffmpeg([
    ...trimArgs,
    "-i",
    videoPath,
    "-vf",
    `${filterBase},palettegen=stats_mode=diff`,
    palette,
  ]);
  await ffmpeg([
    ...trimArgs,
    "-i",
    videoPath,
    "-i",
    palette,
    "-filter_complex",
    `${filterBase}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    gifPath,
  ]);
  await rm(palette, { force: true });
}

async function main() {
  if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
    console.error(
      "ffmpeg is required to encode gifs. Install it (e.g. `brew install ffmpeg`) and re-run.",
    );
    process.exit(1);
  }

  if (existsSync(RAW_DIR)) await rm(RAW_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  for (const sc of SCENARIOS) {
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      recordVideo: { dir: RAW_DIR, size: VIEWPORT },
    });
    const recordingStartedAt = Date.now();
    const page = await ctx.newPage();
    console.log(`▶ ${sc.name}`);
    const response = await page.goto(URL, { waitUntil: "networkidle" });
    if (!response || !response.ok()) {
      throw new Error(
        `${URL} responded ${response?.status() ?? "no response"}; refusing to record`,
      );
    }
    await page.waitForSelector(".bs-handle", { timeout: 8000 });
    await page.waitForSelector('[data-snap]', { timeout: 8000 });

    await page.evaluate(() => {
      const wrap = document.querySelector(".device-wrap");
      const rect = wrap.getBoundingClientRect();
      const lockedY = window.scrollY + rect.top - 30;
      window.scrollTo({ top: lockedY, behavior: "instant" });
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      window.addEventListener(
        "scroll",
        () => {
          if (Math.abs(window.scrollY - lockedY) > 1) {
            window.scrollTo({ top: lockedY, behavior: "instant" });
          }
        },
        { passive: true },
      );
    });

    await sleep(WARMUP_MS);
    const trimStart = (Date.now() - recordingStartedAt) / 1000;

    const wrapBox = await page.locator(".device-wrap").boundingBox();
    await sc.run(page);
    await sleep(400);
    const video = await page.video();
    await ctx.close();
    const rawPath = await video.path();
    const target = join(RAW_DIR, `${sc.name}.webm`);
    await rename(rawPath, target);

    let crop = null;
    if (wrapBox) {
      const pad = 8;
      crop = {
        x: Math.max(0, Math.round(wrapBox.x - pad)),
        y: Math.max(0, Math.round(wrapBox.y - pad)),
        w: Math.round(wrapBox.width + pad * 2),
        h: Math.round(wrapBox.height + pad * 2),
      };
      crop.w = Math.min(crop.w, VIEWPORT.width - crop.x);
      crop.h = Math.min(crop.h, VIEWPORT.height - crop.y);
      if (crop.w % 2) crop.w -= 1;
      if (crop.h % 2) crop.h -= 1;
    }
    const gifPath = join(OUT_DIR, `${sc.name}.gif`);
    await videoToGif(target, gifPath, crop, trimStart);
    console.log(`  ✓ ${gifPath}  (trim=${trimStart.toFixed(2)}s)`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
