/**
 * Round-trip parse test for the inlined-and-minified base stylesheet.
 *
 * `scripts/inline-base-css.mjs` runs a regex-only minifier (drops comments,
 * collapses whitespace, tightens punctuation around `{ } ; , : >`). The
 * approach is fast and dependency-free, but a regex pipeline could in theory
 * mangle CSS in ways no rule on the current sheet exercises (e.g. `content:
 * ":"`, attribute selectors with embedded `;`, complex `@supports` queries).
 *
 * This test re-parses `baseStyles` through `lightningcss` — a real spec-
 * compliant CSS parser — and asserts no errors. If a future CSS edit slips
 * past the regex unscathed but corrupts at byte level, the parse will reject
 * the input and this test will fail loudly instead of letting broken styles
 * ship into the Web Component bundle.
 */
import { describe, expect, it } from "vitest";
import { transform } from "lightningcss";
import { baseStyles } from "../../src/web-component/baseStyles";

describe("inline-base-css minifier — round-trip parse", () => {
  it("baseStyles is valid CSS after the regex minify pipeline", () => {
    // lightningcss.transform throws on parse error — wrapping in expect().not.toThrow
    // surfaces the failure with the raw input visible in the assertion message.
    expect(() => {
      transform({
        filename: "baseStyles.css",
        code: Buffer.from(baseStyles),
        // Minify=false: we don't want lightningcss to do its OWN minify on our
        // already-minified input — we're testing parse validity only.
        minify: false,
        // No browser targets — skip vendor-prefix work for a pure parse check.
      });
    }).not.toThrow();
  });

  it("preserves load-bearing structures across the minify pass", () => {
    // Smoke-checks for primitives that the regex minifier could plausibly break:
    // - `:where(...)` selector wrapping (the layered tokens approach)
    // - `@media` queries with feature-name `:` colons
    // - `calc(...)` expressions where space-around-operator is significant
    // - `--bs-*` custom property declarations
    // - `cubic-bezier(...)` with comma-separated arguments
    expect(baseStyles).toContain(":where(");
    expect(baseStyles).toContain("@media");
    expect(baseStyles).toContain("calc(");
    expect(baseStyles).toContain("--bs-");
    expect(baseStyles).toContain("cubic-bezier(");
    // Negative checks — the minifier should have stripped these.
    expect(baseStyles).not.toContain("/*");      // comments removed
    expect(baseStyles).not.toContain(";\n}");   // trailing-semicolon-before-} removed
    expect(baseStyles).not.toMatch(/\n\s*\n/);  // no consecutive blank lines
  });
});
