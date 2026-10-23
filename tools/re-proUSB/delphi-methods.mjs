// Recover Delphi published-method addresses from VMT method tables.
//
// Delphi stores each published method as:
//     Word   size      (bytes of code)
//     DWORD  code      (absolute VA in PE32)
//     Byte   nameLen
//     Char   name[nameLen]
// so the code address of a handler sits 5 bytes before its name.
//
// Usage: node delphi-methods.mjs <pe-file> <methodName> [methodName2 …]
//        node delphi-methods.mjs <pe-file> --near <substring>   # dump every published method whose name contains it

import fs from 'node:fs'

const [, , filePath, ...rest] = process.argv
if (!filePath || rest.length === 0) {
  console.error('usage: node delphi-methods.mjs <pe-file> <method…> | --near <substring>')
  process.exit(1)
}

const buf = fs.readFileSync(filePath)
const u16 = (o) => buf.readUInt16LE(o)
const u32 = (o) => buf.readUInt32LE(o)

const peOff = u32(0x3c)
const coff = peOff + 4
const numberOfSections = u16(coff + 2)
const optHeaderSize = u16(coff + 16)
const opt = coff + 20
const imageBase = u32(opt + 28)

const sections = []
const secOff = opt + optHeaderSize
for (let i = 0; i < numberOfSections; i++) {
  const s = secOff + i * 40
  sections.push({
    name: buf.toString('ascii', s, s + 8).replace(/\0+$/, ''),
    vsize: u32(s + 8),
    vaddr: u32(s + 12),
    rawSize: u32(s + 16),
    rawPtr: u32(s + 20),
    characteristics: u32(s + 36),
  })
}

function offToVa(off) {
  for (const s of sections) {
    if (off >= s.rawPtr && off < s.rawPtr + s.rawSize) {
      return imageBase + s.vaddr + (off - s.rawPtr)
    }
  }
  return -1
}

function sectionOf(off) {
  for (const s of sections) {
    if (off >= s.rawPtr && off < s.rawPtr + s.rawSize) return s.name
  }
  return '?'
}

function isExecVa(va) {
  const rva = va - imageBase
  for (const s of sections) {
    if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) {
      return (s.characteristics & 0x20000000) !== 0
    }
  }
  return false
}

// Decode a VMT entry ending at `pos` (start of the name) and validate it.
function entryAt(pos, nameLen) {
  if (pos < 7) return null
  if (buf[pos - 1] !== nameLen) return null
  const size = u16(pos - 7)
  const code = u32(pos - 5)
  if (!isExecVa(code)) return null
  if (size === 0 || size > 0x4000) return null
  return { code, size }
}

function report(name, hits) {
  if (hits.length === 0) {
    console.log(`${name}  (no VMT entry)`)
    return
  }
  for (const h of hits) {
    console.log(
      `${name}  code=0x${h.code.toString(16)}  size=${h.size} (0x${h.size.toString(16)})  ` +
        `vmt@0x${h.vmtVa.toString(16)} section=${h.section}`
    )
  }
}

if (rest[0] === '--near') {
  const needle = rest[1]
  const raw = Buffer.from(needle, 'latin1')
  let pos = 0
  const out = []
  while ((pos = buf.indexOf(raw, pos)) >= 0) {
    // Walk back to the first byte of the name (max 64 chars).
    for (let len = 1; len <= 64; len++) {
      const start = pos - len + 1
      if (start - 1 < 0) break
      if (buf[start - 1] !== len) continue
      const nameBytes = buf.toString('latin1', start, pos + raw.length)
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nameBytes)) continue
      if (start + len - 1 !== pos) break
      const e = entryAt(start, len)
      if (e) out.push({ name: nameBytes, ...e, vmtVa: offToVa(start - 7), section: sectionOf(start - 7) })
      break
    }
    pos += raw.length
  }
  const seen = new Set()
  for (const o of out) {
    const key = o.name + ':' + o.code
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`${o.name.padEnd(34)} code=0x${o.code.toString(16)}  size=${o.size}  vmt@0x${o.vmtVa.toString(16)}  ${o.section}`)
  }
  if (out.length === 0) console.log(`(no published method matching "${needle}")`)
} else {
  for (const name of rest) {
    const raw = Buffer.from(name, 'latin1')
    const hits = []
    let pos = 0
    while ((pos = buf.indexOf(raw, pos)) >= 0) {
      // The name must be terminated by a non-identifier char or the end of the table.
      const after = pos + raw.length
      const okAfter = after >= buf.length || !/[A-Za-z0-9_]/.test(String.fromCharCode(buf[after]))
      if (okAfter) {
        const e = entryAt(pos, raw.length)
        if (e) hits.push({ ...e, vmtVa: offToVa(pos - 7), section: sectionOf(pos - 7) })
      }
      pos += raw.length
    }
    report(name, hits)
  }
}
