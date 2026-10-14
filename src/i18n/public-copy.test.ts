import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

test("public translations use the agreed vocabulary", () => {
  const directory = new URL("./", import.meta.url);
  const signedInFiles = new Set(["desk.ts", "desk-orgs.ts", "reach.ts", "org-work.ts", "drones.ts", "coverage.ts"]);
  const forbidden = /\b(news|reporter|reporters|news portal)\b/i;
  // ponytail: Plain text tokens cover quoted and template strings; upgrade to syntax-aware scanning if nested templates are introduced.
  const tokens = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g;
  const violations: string[] = [];

  for (const file of readdirSync(directory).sort()) {
    if (!file.endsWith(".ts") || signedInFiles.has(file)) continue;
    const source = readFileSync(new URL(file, directory), "utf8");
    for (const token of source.matchAll(tokens)) {
      const literal = token[0];
      if (literal.startsWith("/")) continue;
      const match = literal.match(forbidden);
      if (match) violations.push(`src/i18n/${file}: ${literal} (matched: ${match[0]})`);
    }
  }

  assert.equal(violations.length, 0, violations.join("\n"));
});
