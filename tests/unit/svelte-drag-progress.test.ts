// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { compile } from "svelte/compiler";

const here = dirname(fileURLToPath(import.meta.url));
const sfcPath = resolve(here, "../../src/svelte/BottomSheet.svelte");
const dtsPath = resolve(here, "../../src/svelte/index.d.ts.template");

const sfcSrc = readFileSync(sfcPath, "utf8");
const dtsSrc = readFileSync(dtsPath, "utf8");

const scriptOf = (src: string): string => {
  const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return m?.[1] ?? "";
};

const script = scriptOf(sfcSrc);

describe("Svelte <BottomSheet> ondrag/onprogress", () => {
  it("compiles as a Svelte 5 client component with the new callbacks", () => {
    const { js } = compile(sfcSrc, {
      filename: "BottomSheet.svelte",
      generate: "client",
    });
    expect(js.code).toContain("ondrag");
    expect(js.code).toContain("onprogress");
  });

  it("declares ondrag and onprogress as destructured props", () => {
    const propsBlock = script.slice(
      script.indexOf("let {"),
      script.indexOf("}: Props = $props()"),
    );
    expect(propsBlock).toContain("ondrag");
    expect(propsBlock).toContain("onprogress");
  });

  it("subscribes engine 'drag'/'progress' to the callback only (no sync in hot path)", () => {
    const dragWire = script.match(
      /engine\.on\("drag",\s*payload\s*=>\s*ondrag\(payload\)\)/,
    );
    const progressWire = script.match(
      /engine\.on\("progress",\s*payload\s*=>\s*onprogress\(payload\)\)/,
    );
    expect(dragWire).not.toBeNull();
    expect(progressWire).not.toBeNull();

    const dragHandler = dragWire![0];
    const progressHandler = progressWire![0];
    expect(dragHandler).not.toContain("sync");
    expect(progressHandler).not.toContain("sync");
  });

  it("syncs the .d.ts.template props block with ondrag/onprogress", () => {
    expect(dtsSrc).toContain('ondrag?: (payload: SheetEventMap["drag"]) => void');
    expect(dtsSrc).toContain(
      'onprogress?: (payload: SheetEventMap["progress"]) => void',
    );
  });
});
