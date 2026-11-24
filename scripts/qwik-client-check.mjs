import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { buildQwikProbe, repoRoot, report } from "./qwik-probe.mjs";

const rootTsx = `/** @jsxImportSource @builder.io/qwik */
import { component$, useSignal } from "@builder.io/qwik";
import { BottomSheet } from "@surdeddd/bottom-sheet/qwik-lib";

export default component$(() => {
  const open = useSignal(false);
  const snap = useSignal<string | undefined>(undefined);
  const log = useSignal("");
  return (
    <div>
      <button id="open" onClick$={() => (open.value = true)}>open</button>
      <button id="shut" onClick$={() => (open.value = false)}>shut</button>
      <button id="full" onClick$={() => (snap.value = "full")}>full</button>
      <output id="log">{log.value}</output>
      <output id="open-state">{String(open.value)}</output>
      <BottomSheet
        snapPoints={[
          { id: "closed", size: 0 },
          { id: "half", size: 300, label: "Half open" },
          { id: "full", size: 500 },
        ]}
        open={open.value}
        snap={snap.value}
        animation="tween"
        duration={0}
        handleLabel="Resize probe"
        contentLabel="Probe content"
        onOpenChange$={next => {
          open.value = next;
          log.value += next ? "o" : "c";
        }}
        onSnap$={id => {
          snap.value = id;
          log.value += "[" + id + "]";
        }}
      >
        <p>probe row</p>
      </BottomSheet>
    </div>
  );
});
`;

const entrySsr = `/** @jsxImportSource @builder.io/qwik */
import { renderToString } from "@builder.io/qwik/server";
import Root from "./root";

export async function render(manifest) {
  const result = await renderToString(<Root />, {
    containerTagName: "div",
    manifest,
    base: "/build/",
  });
  return result.html;
}
`;

const ORIGIN = "http://qwik.probe";
const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const { html, clientOut, cleanup } = await buildQwikProbe({
  name: "qwik-client",
  rootTsx,
  entrySsr,
});

const styles = readFileSync(join(repoRoot, "dist", "styles.css"), "utf8");
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${html}</body></html>`;

const { chromium } = await import(
  pathToFileURL(join(repoRoot, "node_modules", "playwright", "index.mjs")).href
);

const checks = {
  "server markup rests closed": html.includes('data-bs-rest="closed"'),
  "server markup names the handle": html.includes('aria-label="Resize probe"'),
  "server markup names the content": html.includes('aria-label="Probe content"'),
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 800 },
  });
  const tab = await context.newPage();
  const errors = [];
  tab.on("pageerror", error => errors.push(String(error)));

  await tab.route(`${ORIGIN}/**`, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") {
      return route.fulfill({ contentType: "text/html", body: page });
    }
    const file = normalize(join(clientOut, path));
    if (!file.startsWith(clientOut) || !existsSync(file) || !statSync(file).isFile()) {
      return route.fulfill({ status: 404, body: "" });
    }
    return route.fulfill({
      contentType: TYPES[extname(file)] ?? "application/octet-stream",
      body: readFileSync(file),
    });
  });

  await tab.goto(`${ORIGIN}/`);
  const sheet = tab.locator(".bs-sheet");
  const active = () => sheet.getAttribute("data-active");
  const until = async (label, read, want) => {
    const deadline = Date.now() + 5000;
    let last;
    while (Date.now() < deadline) {
      last = await read();
      if (last === want) {
        checks[label] = true;
        return;
      }
      await tab.waitForTimeout(50);
    }
    checks[`${label} (got ${JSON.stringify(last)})`] = false;
  };
  const text = id => () => tab.locator(id).textContent();
  const press = id => tab.locator(id).dispatchEvent("click");
  const size = () =>
    sheet.evaluate(el => el.style.getPropertyValue("--bs-size").trim());

  await until("engine attaches at the closed point", size, "0px");
  await until("starts closed", active, "closed");

  await until("a sheet without a focus trap is a region", () => sheet.getAttribute("role"), "region");

  await press("#open");
  await until("open=true opens the sheet", active, "half");
  await until("opening is reported through onOpenChange$", text("#open-state"), "true");
  await until(
    "the slider reads the label of the point",
    () => tab.locator(".bs-handle").getAttribute("aria-valuetext"),
    "Half open",
  );
  await until(
    "the live region says the label too",
    async () => ((await tab.locator(".bs-sheet [role=status]").textContent()) ?? "").trim(),
    "Half open",
  );

  await press("#full");
  await until("snap moves the sheet to that point", active, "full");
  await until("the sheet is as tall as the point", size, "500px");

  await tab.keyboard.press("Escape");
  await until("Escape closes", active, "closed");
  await until("the dismissal is reported through onOpenChange$", text("#open-state"), "false");

  await press("#open");
  await until("opens again after a dismissal", active, "half");

  await press("#shut");
  await until("open=false closes the sheet", active, "closed");

  await until("events arrive in order", text("#log"), "o[half][full]c[closed]o[half]c[closed]");
  checks["no page errors"] = errors.length === 0;
  if (errors.length > 0) console.error(errors.join("\n"));
} finally {
  await browser.close();
  cleanup();
}

report("qwik-client-check", checks);
console.log("qwik-client-check: open and snap drive the engine in a browser");
