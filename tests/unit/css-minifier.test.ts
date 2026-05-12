import { describe, expect, it } from "vitest";
import { transform } from "lightningcss";
import { baseStyles } from "../../src/web-component/baseStyles";

describe("inline-base-css minifier — round-trip parse", () => {
  it("baseStyles is valid CSS after the regex minify pipeline", () => {
    expect(() => {
      transform({
        filename: "baseStyles.css",
        code: Buffer.from(baseStyles),
        minify: false,
      });
    }).not.toThrow();
  });

  it("preserves load-bearing structures across the minify pass", () => {
    expect(baseStyles).toContain(":where(");
    expect(baseStyles).toContain("@media");
    expect(baseStyles).toContain("calc(");
    expect(baseStyles).toContain("--bs-");
    expect(baseStyles).toContain("cubic-bezier(");
    expect(baseStyles).not.toContain("/*");
    expect(baseStyles).not.toContain(";\n}");
    expect(baseStyles).not.toMatch(/\n\s*\n/);
  });
});
