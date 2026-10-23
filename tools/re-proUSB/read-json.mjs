#!/usr/bin/env node
// Read a JSON file regardless of BOM/UTF-16/UTF-8 encoding, and print either
//   - the paths of long string values (no dotpath), or
//   - the value at a dot path.
// Usage: node read-json.mjs <file.json> [dot.path]

import { readFileSync } from "node:fs";

const file = process.argv[2];
const dotPath = process.argv[3];
if (!file) {
  console.error("usage: node read-json.mjs <file.json> [dot.path]");
  process.exit(1);
}

let buf = readFileSync(file);
let text;
if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
  text = buf.subarray(2).toString("utf16le");
} else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
  const swapped = Buffer.from(buf.subarray(2));
  swapped.swap16();
  text = swapped.toString("utf16le");
} else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
  text = buf.subarray(3).toString("utf8");
} else {
  text = buf.toString("utf8");
}

let json;
try {
  json = JSON.parse(text);
} catch (err) {
  console.error(`parse error: ${err.message}`);
  process.exit(2);
}

const getPath = (obj, path) =>
  path.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    const m = /^(.*)\[(\d+)\]$/.exec(key);
    if (m) return acc[m[1]]?.[Number(m[2])];
    return acc[key];
  }, obj);

if (dotPath) {
  const v = getPath(json, dotPath);
  console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
  process.exit(0);
}

const found = [];
const walk = (node, path, depth) => {
  if (depth > 7 || node == null) return;
  if (typeof node === "string") {
    if (node.length > 300) found.push({ path, len: node.length });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, depth + 1);
  }
};
walk(json, "", 0);

console.log("top-level: " + Object.keys(json).join(", "));
console.log("long string values:");
for (const f of found.slice(0, 40)) console.log(`  ${f.path}  (${f.len} chars)`);
