// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_OPTION_KEYS } from "../../src/core/primitives/option-keys";
import {
  ATTR_STYLESHEET,
  OBSERVED_ATTRS,
} from "../../src/web-component/attributes";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

const missingFrom = (path: string, names: readonly string[]): string[] => {
  const text = read(path);
  return names.filter(name => !text.includes(`\`${name}\``));
};

describe("documentation coverage", () => {
  for (const file of ["README.md", "README.ru.md", "llms.txt"]) {
    it(`${file} names every engine option`, () => {
      expect(missingFrom(file, ENGINE_OPTION_KEYS)).toEqual([]);
    });
  }

  const attributes = [...OBSERVED_ATTRS, ATTR_STYLESHEET];

  for (const file of ["docs/web-component.md", "llms.txt"]) {
    it(`${file} names every attribute of the custom element`, () => {
      expect(missingFrom(file, attributes)).toEqual([]);
    });
  }

  it("the two READMEs have the same sections in the same order", () => {
    const outline = (path: string): number[] =>
      read(path)
        .split("\n")
        .filter(line => /^#{2,3} /.test(line))
        .map(line => line.indexOf(" "));
    expect(outline("README.ru.md")).toEqual(outline("README.md"));
  });

  it("the two READMEs carry the same code", () => {
    const code = (path: string): string[] =>
      [...read(path).matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(m =>
        m[1]!
          .split("\n")
          .map(line => line.replace(/\s*(\/\/|#|<!--).*$/, "").trimEnd())
          .join("\n"),
      );
    expect(code("README.ru.md")).toEqual(code("README.md"));
  });
});
