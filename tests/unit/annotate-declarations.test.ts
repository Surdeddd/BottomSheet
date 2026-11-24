import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  annotate,
  optionDocs,
} from "../../scripts/annotate-declarations.mjs";
import { ENGINE_OPTION_KEYS } from "../../src/core/primitives/option-keys";

const here = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(resolve(here, "../../README.md"), "utf8");

const TABLE = `
### Options

Sizing

| Option | Default | What it does |
| --- | --- | --- |
| \`snapPoints\` | required | List of \`{ id, size }\` |
| \`maxHeight\` | none | Cap on the size. [Details](docs/content-fit.md) |
| \`focusTrap\` | \`false\` | Keep Tab inside the sheet |
| \`handleLabel\`, \`contentLabel\` | English | Accessible names |

Component adapters add a few props of their own:

| Prop | Default | What it does |
| --- | --- | --- |
| \`backdrop\` | \`true\` | Render the backdrop |

### Methods

| \`notAnOption\` | none | Outside the options section |
`;

const DECLARATION = `type Other = {
    focusTrap?: boolean;
};
type EngineOptions = {
    element: HTMLElement;
    snapPoints: SnapPointDef[];
    maxHeight?: string | number;
    focusTrap?: boolean;
    spring?: {
        stiffness?: number;
    };
};
type After = {
    maxHeight?: number;
};
`;

describe("descriptions of the options in the published types", () => {
  it("reads one description per option out of the README tables", () => {
    const docs = optionDocs(TABLE);

    expect(docs.get("snapPoints")).toBe("List of `{ id, size }`");
    expect(docs.get("focusTrap")).toBe(
      "Keep Tab inside the sheet\n\nDefault: `false`",
    );
    expect(docs.get("handleLabel")).toBe("Accessible names\n\nDefault: English");
    expect(docs.get("contentLabel")).toBe(docs.get("handleLabel"));
    expect(docs.has("notAnOption")).toBe(false);
    expect(docs.has("backdrop")).toBe(false);
  });

  it("drops a link that would not resolve from inside a package and keeps its text", () => {
    expect(optionDocs(TABLE).get("maxHeight")).toBe("Cap on the size. Details");
  });

  it("writes the description above the option, and only inside EngineOptions", () => {
    const out = annotate(DECLARATION, optionDocs(TABLE));

    expect(out).toContain(
      "    /** List of `{ id, size }` */\n    snapPoints: SnapPointDef[];",
    );
    expect(out).toContain(
      "    /**\n     * Keep Tab inside the sheet\n     *\n     * Default: `false`\n     */\n    focusTrap?: boolean;\n    spring?:",
    );
    expect(out.startsWith("type Other = {\n    focusTrap?: boolean;\n};")).toBe(
      true,
    );
    expect(out.endsWith("type After = {\n    maxHeight?: number;\n};\n")).toBe(
      true,
    );
    expect(out).toContain("    element: HTMLElement;\n    /**");
    expect(out).toContain("        stiffness?: number;");
  });

  it("leaves a file without the options type as it was, and does not annotate twice", () => {
    expect(annotate("type Other = {};\n", optionDocs(TABLE))).toBe(
      "type Other = {};\n",
    );
    const once = annotate(DECLARATION, optionDocs(TABLE));
    expect(annotate(once, optionDocs(TABLE))).toBe(once);
  });

  it("finds a description in the README for every engine option", () => {
    const docs = optionDocs(readme);
    const missing = ENGINE_OPTION_KEYS.filter(key => !docs.has(key));

    expect(missing).toEqual([]);
  });
});
