#!/usr/bin/env node
// Extract PE resources + Delphi binary DFM (TPF0) forms from a 32-bit PE image.
// Read-only: parses the file on disk, never executes it.
//
// Usage: node pe-resources.mjs <path-to.exe> [outDir]

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const file = process.argv[2];
const outDir = process.argv[3] ?? ".";
if (!file) {
  console.error("usage: node pe-resources.mjs <exe> [outDir]");
  process.exit(1);
}

const buf = readFileSync(file);

// ---------------- PE headers ----------------
const peOff = buf.readUInt32LE(0x3c);
if (buf.toString("ascii", peOff, peOff + 4) !== "PE\0\0") throw new Error("not a PE file");
const numSections = buf.readUInt16LE(peOff + 6);
const optSize = buf.readUInt16LE(peOff + 20);
const optOff = peOff + 24;
const pe32plus = buf.readUInt16LE(optOff) === 0x20b;
const ddOff = optOff + (pe32plus ? 112 : 96);
const resRva = buf.readUInt32LE(ddOff + 16);
if (!resRva) throw new Error("no resource directory");

const sections = [];
let secOff = optOff + optSize;
for (let i = 0; i < numSections; i++) {
  sections.push({
    va: buf.readUInt32LE(secOff + 12),
    vsize: buf.readUInt32LE(secOff + 8),
    rawSize: buf.readUInt32LE(secOff + 16),
    rawPtr: buf.readUInt32LE(secOff + 20),
  });
  secOff += 40;
}
const rvaToOff = (rva) => {
  for (const s of sections) {
    if (rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize)) return rva - s.va + s.rawPtr;
  }
  throw new Error(`unmapped rva 0x${rva.toString(16)}`);
};

// ---------------- resource walk ----------------
const RT = {
  1: "CURSOR", 2: "BITMAP", 3: "ICON", 4: "MENU", 5: "DIALOG", 6: "STRING", 7: "FONTDIR",
  8: "FONT", 9: "ACCELERATOR", 10: "RCDATA", 11: "MESSAGETABLE", 12: "GROUP_CURSOR",
  14: "GROUP_ICON", 16: "VERSION", 24: "MANIFEST",
};
const entries = [];
const walk = (dirOff, path) => {
  const base = rvaToOff(resRva + dirOff);
  const named = buf.readUInt16LE(base + 12);
  const ids = buf.readUInt16LE(base + 14);
  for (let i = 0; i < named + ids; i++) {
    const e = base + 16 + i * 8;
    const nameField = buf.readUInt32LE(e);
    const dataField = buf.readUInt32LE(e + 4);
    let key = nameField;
    if (nameField & 0x80000000) {
      const sOff = rvaToOff(resRva + (nameField & 0x7fffffff));
      key = buf.toString("utf16le", sOff + 2, sOff + 2 + buf.readUInt16LE(sOff) * 2);
    }
    if (dataField & 0x80000000) walk(dataField & 0x7fffffff, [...path, key]);
    else {
      const d = rvaToOff(resRva + dataField);
      entries.push({
        path,
        key,
        size: buf.readUInt32LE(d + 4),
        off: rvaToOff(buf.readUInt32LE(d)),
      });
    }
  }
};
walk(0, []);

// ---------------- Delphi binary DFM ----------------
const va = {
  0: "Null", 1: "List", 2: "Int8", 3: "Int16", 4: "Int32", 5: "Extended", 6: "String",
  7: "Ident", 8: "False", 9: "True", 10: "Binary", 11: "Set", 12: "LString", 13: "Nil",
  14: "Collection", 15: "Single", 16: "Currency", 17: "Date", 18: "WString", 19: "Int64",
  20: "UTF8String", 21: "Double",
};

const shortStr = (b, o) => {
  const n = b[o];
  return { v: b.toString("latin1", o + 1, o + 1 + n), next: o + 1 + n };
};

const parseValue = (b, o) => {
  const t = b[o++];
  switch (t) {
    case 0: return { v: null, next: o };
    case 1: { // ( ... )
      const arr = [];
      for (;;) {
        if (b[o] === 0) { o++; break; }
        const r = parseValue(b, o);
        arr.push(r.v);
        o = r.next;
      }
      return { v: arr, next: o };
    }
    case 2: return { v: b.readInt8(o), next: o + 1 };
    case 3: return { v: b.readInt16LE(o), next: o + 2 };
    case 4: return { v: b.readInt32LE(o), next: o + 4 };
    case 5: return { v: null, next: o + 10 };
    case 6: { const r = shortStr(b, o); return { v: r.v, next: r.next }; }
    case 7: { const r = shortStr(b, o); return { v: { ident: r.v }, next: r.next }; }
    case 8: return { v: false, next: o };
    case 9: return { v: true, next: o };
    case 10: { const n = b.readInt32LE(o); return { v: `<binary ${n}>`, next: o + 4 + n }; }
    case 11: { // set: shortstrings terminated by a zero-length entry
      const arr = [];
      for (;;) {
        const r = shortStr(b, o);
        o = r.next;
        if (r.v === "") break;
        arr.push(r.v);
      }
      return { v: arr, next: o };
    }
    case 12: { const n = b.readInt32LE(o); return { v: b.toString("latin1", o + 4, o + 4 + n), next: o + 4 + n }; }
    case 13: return { v: null, next: o };
    case 14: { // collection: items are vaList-wrapped property lists, closed by vaNull
      const items = [];
      for (;;) {
        if (b[o] === 0) { o++; break; } // empty / end of collection
        if (b[o] === 1) o++;            // item list-begin
        const pr = parseProps(b, o);
        items.push(pr.props);
        o = pr.next;
        if (b[o] === 0) { o++; break; } // end of collection
      }
      return { v: items, next: o };
    }
    case 15: return { v: b.readFloatLE(o), next: o + 4 };
    case 16: return { v: null, next: o + 8 };
    case 17: return { v: null, next: o + 8 };
    case 18: {
      const n = b.readInt32LE(o);
      return { v: buf.length >= 0 ? b.toString("utf16le", o + 4, o + 4 + n * 2) : null, next: o + 4 + n * 2 };
    }
    case 19: return { v: Number(b.readBigInt64LE(o)), next: o + 8 };
    case 20: { const n = b.readInt32LE(o); return { v: b.toString("utf8", o + 4, o + 4 + n), next: o + 4 + n }; }
    case 21: return { v: b.readDoubleLE(o), next: o + 8 };
    default: throw new Error(`unknown value type ${t} at ${o - 1} (${va[t] ?? "?"})`);
  }
};

const parseProps = (b, o) => {
  const props = {};
  while (b[o] !== 0) {
    const r = shortStr(b, o);
    const pname = r.v;
    o = r.next;
    globalThis.__trace = `${pname}@${o}`;
    const val = parseValue(b, o);
    props[pname] = val.v;
    o = val.next;
  }
  return { props, next: o + 1 }; // consume property terminator
};

const parseObject = (b, o) => {
  let r = shortStr(b, o);
  const cls = r.v;
  o = r.next;
  r = shortStr(b, o);
  const name = r.v;
  o = r.next;
  const pr = parseProps(b, o);
  o = pr.next; // property terminator consumed
  const children = [];
  while (b[o] !== 0) {
    const c = parseObject(b, o);
    children.push(c.v);
    o = c.next;
  }
  o++; // child terminator
  return { v: { class: cls, name, props: pr.props, children }, next: o };
};

const forms = entries.filter((e) => buf.toString("ascii", e.off, e.off + 4) === "TPF0");
mkdirSync(outDir, { recursive: true });

const byType = new Map();
for (const e of entries) {
  const t = e.path[0];
  const label = typeof t === "number" ? RT[t] ?? `TYPE_${t}` : t;
  byType.set(label, (byType.get(label) ?? 0) + 1);
}
console.log(`file: ${basename(file)}  resources: ${entries.length}`);
for (const [k, v] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log(`\nDelphi DFM forms: ${forms.length}`);

const summary = [];
forms.forEach((f, i) => {
  const blob = buf.subarray(f.off, f.off + f.size);
  try {
    const root = parseObject(blob, 4);
    const o = root.v;
    const flat = [];
    const collect = (n, d = 0) => { flat.push({ class: n.class, name: n.name, depth: d }); n.children.forEach((c) => collect(c, d + 1)); };
    collect(o);
    const file_ = `form_${String(i).padStart(3, "0")}_${o.class}.json`;
    writeFileSync(join(outDir, file_), JSON.stringify(o, null, 2));
    summary.push({ form: `${o.class} (${o.name})`, components: flat.length, file: file_ });
    console.log(`  ${String(i).padStart(3, "0")} ${o.class} "${o.name}"  components=${flat.length}`);
  } catch (err) {
    const m = /at (\d+)/.exec(err.message);
    const at = m ? Number(m[1]) : 0;
    const from = Math.max(0, at - 40);
    const hex = [...blob.subarray(from, at + 8)].map((x) => x.toString(16).padStart(2, "0")).join(" ");
    const asc = blob.toString("latin1", from, at + 8).replace(/[^\x20-\x7e]/g, ".");
    console.log(`  ! ${String(i).padStart(3, "0")} parse error: ${err.message}  [last prop: ${globalThis.__trace ?? "n/a"}]`);
    console.log(`      @${from}: ${hex}`);
    console.log(`      ascii: ${asc}`);
    summary.push({ resource: f.path.join("/"), error: err.message, last: globalThis.__trace ?? null });
  }
});
writeFileSync(join(outDir, "_forms.json"), JSON.stringify(summary, null, 2));
