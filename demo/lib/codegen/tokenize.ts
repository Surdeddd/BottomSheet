
export type Token = {
  text: string;
  cls: "" | "c-c" | "c-k" | "c-i" | "c-s" | "c-a";
};

const KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "let",
  "var",
  "function",
  "return",
  "new",
  "class",
  "extends",
  "this",
  "if",
  "else",
  "for",
  "of",
  "in",
  "default",
  "export",
  "async",
  "await",
  "true",
  "false",
  "null",
  "undefined",
  "any",
  "void",
  "string",
  "number",
  "boolean",
  "script",
  "template",
  "lang",
  "h2",
  "h1",
  "div",
  "ul",
  "li",
  "link",
  "type",
  "stylesheet",
  "module",
  "setup",
]);

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const push = (text: string, cls: Token["cls"]): void => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.cls === cls) last.text += text;
    else out.push({ text, cls });
  };
  let i = 0;
  const n = src.length;
  const at = (k: number): string => (k < n ? src.charAt(k) : "");
  while (i < n) {
    const ch = at(i);
    if (ch === "/" && at(i + 1) === "/") {
      let j = i;
      while (j < n && at(j) !== "\n") j++;
      push(src.slice(i, j), "c-c");
      i = j;
      continue;
    }
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i);
      const stop = end === -1 ? n : end + 3;
      push(src.slice(i, stop), "c-c");
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < n && at(j) !== quote) {
        if (at(j) === "\\" && j + 1 < n) j += 2;
        else j++;
      }
      j = Math.min(j + 1, n);
      push(src.slice(i, j), "c-s");
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$-]/.test(at(j))) j++;
      const word = src.slice(i, j);
      if (KEYWORDS.has(word)) push(word, "c-k");
      else if (/^[A-Z]/.test(word)) push(word, "c-i");
      else if (at(j) === "=" || (at(j) === " " && /^\s*=/.test(src.slice(j))))
        push(word, "c-a");
      else push(word, "");
      i = j;
      continue;
    }
    push(ch, "");
    i++;
  }
  return out;
}
