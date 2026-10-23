#!/usr/bin/env node
// Dump PE export tables (ordinal, RVA, name) and import DLLs. Read-only.
// Usage: node pe-exports.mjs <file.dll|exe> [...]

import { readFileSync } from "node:fs";
import { basename } from "node:path";

for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const peOff = buf.readUInt32LE(0x3c);
  if (buf.toString("ascii", peOff, peOff + 4) !== "PE\0\0") {
    console.log(`${basename(file)}: not PE`);
    continue;
  }
  const numSections = buf.readUInt16LE(peOff + 6);
  const optSize = buf.readUInt16LE(peOff + 20);
  const optOff = peOff + 24;
  const pe32plus = buf.readUInt16LE(optOff) === 0x20b;
  const ddOff = optOff + (pe32plus ? 112 : 96);

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
    return -1;
  };
  const cstr = (off) => {
    if (off < 0) return "?";
    let end = off;
    while (end < buf.length && buf[end] !== 0) end++;
    return buf.toString("latin1", off, end);
  };

  console.log(`\n=== ${basename(file)} ===`);
  const machine = buf.readUInt16LE(peOff + 4);
  console.log(`machine=0x${machine.toString(16)}  size=${buf.length}`);

  // exports
  const expRva = buf.readUInt32LE(ddOff + 0 * 8);
  if (!expRva) {
    console.log("exports: none");
  } else {
    const e = rvaToOff(expRva);
    const nameRva = buf.readUInt32LE(e + 12);
    const ordinalBase = buf.readUInt32LE(e + 16);
    const numNames = buf.readUInt32LE(e + 24);
    const namesRva = buf.readUInt32LE(e + 32);
    const ordRva = buf.readUInt32LE(e + 36);
    console.log(`exports: ${numNames} named  (dll: ${cstr(rvaToOff(nameRva))})`);
    const out = [];
    for (let i = 0; i < numNames; i++) {
      const nOff = rvaToOff(buf.readUInt32LE(rvaToOff(namesRva) + i * 4));
      const ord = buf.readUInt16LE(rvaToOff(ordRva) + i * 2);
      out.push(`${ord + ordinalBase}  ${cstr(nOff)}`);
    }
    for (const line of out) console.log("  " + line);
  }

  // imports (DLL names only)
  const impRva = buf.readUInt32LE(ddOff + 1 * 8);
  if (impRva) {
    const dlls = [];
    let d = rvaToOff(impRva);
    for (;;) {
      const oft = buf.readUInt32LE(d);
      const nameRva2 = buf.readUInt32LE(d + 12);
      const ft = buf.readUInt32LE(d + 16);
      if (!oft && !nameRva2 && !ft) break;
      dlls.push(cstr(rvaToOff(nameRva2)));
      d += 20;
      if (dlls.length > 200) break;
    }
    console.log("imports: " + dlls.join(", "));
  }
}
