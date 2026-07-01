import { expect, test } from "@playwright/test";

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const RUNS = 5;
const ITEMS = 1000;
const FPS_TARGET = 55;

const median = (xs: number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
};

const sheetSelector = '.device-screen[data-screen="react"] .bs-sheet';

test.describe.configure({ mode: "serial" });

test.describe("benchmark — bottom-sheet under 1000-item load", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.click('[data-adapter="react"]');
    await page.waitForSelector(sheetSelector);
    await page.evaluate(count => {
      const content = document.querySelector(
        '.device-screen[data-screen="react"] .bs-content',
      );
      if (!content) return;
      const list = content.querySelector(".sheet-list");
      if (!list) return;
      const template = list.firstElementChild;
      if (!template) return;
      for (let i = 0; i < count; i++) {
        const clone = template.cloneNode(true) as HTMLElement;
        list.appendChild(clone);
      }
    }, ITEMS);
  });

  test(`drag FPS ≥ ${FPS_TARGET} (median of ${RUNS} runs)`, async ({ page }) => {
    const samples: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const fps = await page.evaluate(async () => {
        const el = document.querySelector<HTMLElement>(
          '.device-screen[data-screen="react"] .bs-sheet',
        );
        if (!el) return 0;
        const handle = el.querySelector<HTMLElement>(".bs-handle");
        if (!handle) return 0;
        const start = performance.now();
        let frames = 0;
        let lastT = start;
        const deltas: number[] = [];
        const tick = (t: number) => {
          frames++;
          deltas.push(t - lastT);
          lastT = t;
          if (t - start < 320) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const root = el.closest<HTMLElement>(".bs-root");
        const event = new CustomEvent("bs-bench-snap", { detail: "full" });
        root?.dispatchEvent(event);
        await new Promise(r => setTimeout(r, 360));
        const meanDelta =
          deltas.reduce((a, b) => a + b, 0) / Math.max(deltas.length, 1);
        return meanDelta > 0 ? 1000 / meanDelta : 0;
      });
      samples.push(fps);
    }
    const med = median(samples);
    console.log(
      `  drag FPS samples: ${samples.map(s => s.toFixed(1)).join(", ")} → median ${med.toFixed(1)}`,
    );
    expect(med).toBeGreaterThanOrEqual(FPS_TARGET);
    saveResult("dragFps", { samples, median: med, target: FPS_TARGET });
  });

  test("settle latency: snapTo → DOM reflects target", async ({ page }) => {
    const samples: number[] = [];
    // 'full' (3rd chip) settles well below a fixed 600px on framed mobile
    // viewports (the device frame caps it ~520px), which made the old hardcoded
    // threshold never resolve → empty samples → NaN. Derive the real target for
    // this device and wait for the sheet to reach ~95% of it.
    await page.click('#snap-chips .chip:nth-child(3)');
    await page.waitForTimeout(700);
    const fullTarget = await page.evaluate(sel => {
      const el = document.querySelector<HTMLElement>(sel);
      return el ? parseFloat(el.style.getPropertyValue("--bs-size")) || 0 : 0;
    }, sheetSelector);
    const reach = Math.max(200, fullTarget * 0.95);
    for (let r = 0; r < RUNS; r++) {
      await page.click('#snap-chips .chip:has-text("minimized")');
      await page.waitForFunction(
        sel => {
          const el = document.querySelector<HTMLElement>(sel);
          const v = el ? parseFloat(el.style.getPropertyValue("--bs-size")) : 0;
          return v > 0 && v < 200;
        },
        sheetSelector,
        { timeout: 2000 },
      );
      const ms = await page.evaluate(async ({ sel, reach }) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return -1;
        const start = performance.now();
        const chip = document.querySelector<HTMLElement>(
          '#snap-chips .chip:nth-child(3)',
        );
        chip?.click();
        return await new Promise<number>(resolve => {
          const tick = () => {
            const v =
              parseFloat(el.style.getPropertyValue("--bs-size")) || 0;
            if (v >= reach) {
              resolve(performance.now() - start);
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(() => resolve(-1), 1000);
        });
      }, { sel: sheetSelector, reach });
      if (ms > 0) samples.push(ms);
    }
    const med = median(samples);
    console.log(
      `  settle latency samples (ms): ${samples.map(s => s.toFixed(0)).join(", ")} → median ${med.toFixed(0)}ms`,
    );
    expect(med).toBeGreaterThan(0);
    expect(med).toBeLessThan(500);
    saveResult("settleLatencyMs", {
      samples,
      median: med,
      maxAllowed: 500,
    });
  });
});

function saveResult(metric: string, payload: unknown): void {
  const dir = resolve(process.cwd(), "tests/benchmark");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = resolve(dir, "results.json");
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").readFileSync(file, "utf8"),
    );
  } catch {
  }
  existing[metric] = payload;
  existing._lastRun = new Date().toISOString();
  writeFileSync(file, JSON.stringify(existing, null, 2));
}
