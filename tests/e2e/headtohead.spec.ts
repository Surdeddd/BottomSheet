import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const RUNS = 5;
const FIXTURE_BASE = "/bench";

type Result = {
  dragFps: number[];
  settleMs: number[];
  dragFpsMedian: number;
  settleMsMedian: number;
};

const median = (xs: number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
};

const benchOne = async (
  page: import("@playwright/test").Page,
  fixturePath: string,
): Promise<Result> => {
  await page.goto(fixturePath);
  await page.waitForFunction(
    "window.__benchReady === true",
    undefined,
    { timeout: 10000 },
  );
  const dragFps: number[] = [];
  const settleMs: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const fps = await page.evaluate(
      "window.__bench.runDrag()",
    );
    dragFps.push(fps as number);
    const ms = await page.evaluate("window.__bench.runSettle()");
    settleMs.push(ms as number);
  }
  return {
    dragFps,
    settleMs,
    dragFpsMedian: median(dragFps),
    settleMsMedian: median(settleMs),
  };
};

test.describe.configure({ mode: "serial" });
test.skip(
  !process.env.RUN_BENCHMARK,
  "Head-to-head benchmark — opt-in via RUN_BENCHMARK=1 env var.",
);

test.describe("head-to-head: surdeddd vs vaul vs react-modal-sheet", () => {
  test("runs all three fixtures and writes report", async ({ page }) => {
    test.setTimeout(180_000);
    const surdeddd = await benchOne(page, `${FIXTURE_BASE}/surdeddd.html`);
    let vaul: Result | { error: string };
    try {
      vaul = await benchOne(page, `${FIXTURE_BASE}/vaul.html`);
    } catch (e) {
      vaul = { error: String(e) };
    }
    let rms: Result | { error: string };
    try {
      rms = await benchOne(
        page,
        `${FIXTURE_BASE}/react-modal-sheet.html`,
      );
    } catch (e) {
      rms = { error: String(e) };
    }

    const out = resolve(process.cwd(), "tests/benchmark");
    if (!existsSync(out)) mkdirSync(out, { recursive: true });
    writeFileSync(
      resolve(out, "results.json"),
      JSON.stringify(
        {
          ts: new Date().toISOString(),
          surdeddd,
          vaul,
          "react-modal-sheet": rms,
        },
        null,
        2,
      ),
    );

    const report = buildReport(surdeddd, vaul, rms);
    writeFileSync(resolve(out, "report.md"), report);
    console.log(`\n${report}\n`);

    expect(surdeddd.dragFpsMedian).toBeGreaterThan(30);
  });
});

function buildReport(
  ours: Result,
  vaul: Result | { error: string },
  rms: Result | { error: string },
): string {
  const fmt = (n: number) => n.toFixed(1);
  const cell = (r: Result | { error: string }, k: keyof Result) => {
    if ("error" in r) return "—";
    return fmt(r[k] as number);
  };
  return [
    "# Head-to-head benchmark",
    "",
    `Run timestamp: ${new Date().toISOString()}`,
    `Methodology: 5-run median, 1000 list items, programmatic snap from min → full, ~320ms drag window. Fixtures load competitor libs via esm.sh (no install).`,
    "",
    "| Metric | @surdeddd/bottom-sheet | vaul | react-modal-sheet |",
    "|---|---:|---:|---:|",
    `| Drag FPS (median) | **${fmt(ours.dragFpsMedian)}** | ${cell(vaul, "dragFpsMedian")} | ${cell(rms, "dragFpsMedian")} |`,
    `| Settle latency (ms, median) | **${fmt(ours.settleMsMedian)}** | ${cell(vaul, "settleMsMedian")} | ${cell(rms, "settleMsMedian")} |`,
    "",
    "## Notes",
    "",
    "- mobile-Chrome viewport (375×667), 1000 plain DOM items, no virtualization.",
    "- **Drag FPS** is rAF frame-time deltas during a programmatic snap, NOT a real pointer drag. Surdeddd's snap kicks the spring synchronously; vaul/react-modal-sheet route through a React `setState` round-trip before their animation starts, costing 1-3 frames of the 320ms window. Treat as ROUGHLY comparable, not pixel-perfect identical.",
    "- **Settle latency**: surdeddd value is actual `await snapTo()` resolution time. Vaul/react-modal-sheet expose no equivalent promise — their value is the library's hardcoded animation window (Framer Motion default ~540ms). Treat as a ceiling.",
    "- **Bundle sizes** (gzip): surdeddd react adapter **10.4 KB** · vaul ~22 KB · react-modal-sheet + framer-motion ~60+ KB.",
    "",
    "_If a competitor cell shows `—`, the fixture failed to load (network, esm.sh outage, or runtime crash). See `results.json` for details._",
    "",
  ].join("\n");
}
