#!/usr/bin/env node
// Summarize parsed Delphi form JSON (from pe-resources.mjs) into a UI -> handler map.
// Usage: node forms-summary.mjs <formsDir> <outFile.md>

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const outFile = process.argv[3] ?? "FORMS.md";
if (!dir) {
  console.error("usage: node forms-summary.mjs <formsDir> [outFile]");
  process.exit(1);
}

const HANDLER = /^On/;
const INTERESTING = /^(Caption|Text|Title|Hint|Items|Lines|Strings|Filename|Filter|CommandText|SQL|DatabaseName|TableName)$/;

const files = readdirSync(dir).filter((f) => f.startsWith("form_") && f.endsWith(".json")).sort();
const lines = ["# Recovered Delphi forms (CardLock.Exe)", ""];

for (const f of files) {
  const root = JSON.parse(readFileSync(join(dir, f), "utf8"));
  lines.push(`## ${root.class} — \`${root.name}\``, "");

  const walk = (node, depth) => {
    const p = node.props ?? {};
    const capt = p.Caption ?? p.Text ?? null;
    const handlers = Object.entries(p).filter(([k]) => HANDLER.test(k)).map(([k, v]) => `${k}=${typeof v === "object" ? v?.ident ?? JSON.stringify(v) : v}`);
    const data = Object.entries(p)
      .filter(([k]) => INTERESTING.test(k))
      .filter(([k]) => k !== "Caption" && k !== "Text")
      .map(([k, v]) => `${k}=${Array.isArray(v) ? JSON.stringify(v).slice(0, 160) : JSON.stringify(v).slice(0, 160)}`);

    const bits = [];
    if (capt) bits.push(`"${String(capt).replace(/\r?\n/g, " ").slice(0, 70)}"`);
    if (handlers.length) bits.push(handlers.join(" "));
    if (data.length) bits.push(data.join(" "));
    if (bits.length) lines.push(`${"  ".repeat(depth)}- \`${node.class}:${node.name}\` — ${bits.join(" | ")}`);
    for (const c of node.children ?? []) walk(c, depth + 1);
  };
  walk(root, 0);
  lines.push("");
}

writeFileSync(outFile, lines.join("\n"));
console.log(`wrote ${outFile} (${lines.length} lines, ${files.length} forms)`);
