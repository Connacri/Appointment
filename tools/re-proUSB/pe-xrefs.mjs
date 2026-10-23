// Locate call sites of imported functions in a PE32 binary.
//
// CardLock.Exe imports proRFL.DLL; every card operation (GuestCard, MasterCard, …) is an
// indirect call through the IAT (`FF 15 <imm32>` / `FF 25 <imm32>`). This script prints the
// IAT slot and every code reference to it, so the callers can be decompiled one by one.
//
// Usage:
//   node pe-xrefs.mjs "<path to CardLock.Exe>" [filterDllSubstring] [filterSymbolSubstring]

import fs from 'node:fs'

const [, , filePath, dllFilter = 'prorfl', symbolFilter = ''] = process.argv
if (!filePath) {
  console.error('usage: node pe-xrefs.mjs <pe-file> [dllFilter] [symbolFilter]')
  process.exit(1)
}

const buf = fs.readFileSync(filePath)

function u16(o) { return buf.readUInt16LE(o) }
function u32(o) { return buf.readUInt32LE(o) }
function u8(o) { return buf[o] }

const peOff = u32(0x3c)
if (buf.toString('ascii', peOff, peOff + 4) !== 'PE\0\0') {
  console.error('not a PE file')
  process.exit(1)
}

const coff = peOff + 4
const numberOfSections = u16(coff + 2)
const optHeaderSize = u16(coff + 16)
const opt = coff + 20
const magic = u16(opt)
if (magic !== 0x10b) {
  console.error('expected PE32 (0x10b), got 0x' + magic.toString(16))
  process.exit(1)
}

const imageBase = u32(opt + 28)
const sizeOfHeaders = u32(opt + 60)
const numRvaAndSizes = u32(opt + 92)
const dataDir = opt + 96

const sections = []
let secOff = opt + optHeaderSize
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

function rvaToOff(rva) {
  for (const s of sections) {
    if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) {
      const delta = rva - s.vaddr
      if (delta >= s.rawSize) return -1
      return s.rawPtr + delta
    }
  }
  if (rva < sizeOfHeaders) return rva
  return -1
}

function readCString(rva) {
  const off = rvaToOff(rva)
  if (off < 0) return null
  let end = off
  while (end < buf.length && buf[end] !== 0) end++
  return buf.toString('ascii', off, end)
}

if (numRvaAndSizes < 2) {
  console.error('no import directory')
  process.exit(1)
}
const importDirRva = u32(dataDir + 8)
const importDirSize = u32(dataDir + 12)

const imports = [] // { dll, symbol, iatVa }
let descOff = rvaToOff(importDirRva)
if (descOff < 0) {
  console.error('cannot map import directory')
  process.exit(1)
}

for (let d = 0; ; d++) {
  const o = descOff + d * 20
  const oft = u32(o)
  const nameRva = u32(o + 12)
  const ft = u32(o + 16)
  if (!oft && !nameRva && !ft) break

  const dll = readCString(nameRva) || '?'
  let thunkRva = oft || ft
  for (let i = 0; ; i++) {
    const tOff = rvaToOff(thunkRva + i * 4)
    if (tOff < 0) break
    const thunk = u32(tOff)
    if (!thunk) break

    let symbol
    if (thunk & 0x80000000) {
      symbol = '#' + (thunk & 0xffff)
    } else {
      symbol = readCString(thunk + 2) || '?'
    }
    imports.push({ dll, symbol, iatVa: imageBase + ft + i * 4 })
  }
}

const wanted = imports.filter(
  (im) =>
    im.dll.toLowerCase().includes(dllFilter.toLowerCase()) &&
    im.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
)

console.log(`file        = ${filePath}`)
console.log(`imageBase   = 0x${imageBase.toString(16)}`)
console.log(`sections    = ${sections.map((s) => `${s.name}(0x${s.vaddr.toString(16)}+0x${s.vsize.toString(16)})`).join(' ')}`)
console.log(`imports     = ${imports.length} across ${new Set(imports.map((i) => i.dll)).size} DLLs`)
console.log(`matching    = ${wanted.length}`)
console.log('')

// Scan executable sections for FF 15 / FF 25 with an absolute operand equal to the IAT slot.
const execSections = sections.filter((s) => s.characteristics & 0x20000000)

function scanRefs(iatVa) {
  const hits = []
  for (const s of execSections) {
    const start = s.rawPtr
    const end = Math.min(buf.length, s.rawPtr + s.rawSize)
    for (let o = start; o < end - 6; o++) {
      const op = buf[o]
      if ((op === 0xff && buf[o + 1] === 0x15) || (op === 0xff && buf[o + 1] === 0x25)) {
        if (u32(o + 2) === iatVa) {
          const rva = s.vaddr + (o - s.rawPtr)
          hits.push({ va: imageBase + rva, rva, kind: op === 0xff && buf[o + 1] === 0x15 ? 'call' : 'jmp' })
        }
      }
    }
  }
  return hits
}

// `call rel32` / `jmp rel32` targeting an absolute VA.
function scanRelCalls(targetVa) {
  const hits = []
  for (const s of execSections) {
    const end = Math.min(buf.length, s.rawPtr + s.rawSize)
    for (let o = s.rawPtr; o < end - 5; o++) {
      const op = buf[o]
      if (op !== 0xe8 && op !== 0xe9) continue
      const at = imageBase + s.vaddr + (o - s.rawPtr)
      const target = (at + 5 + (u32(o + 1) | 0)) >>> 0
      if (target === targetVa >>> 0) hits.push({ kind: op === 0xe8 ? 'call' : 'jmp', va: at })
    }
  }
  return hits
}

for (const im of wanted) {
  const refs = scanRefs(im.iatVa)
  console.log(`${im.symbol}  (iat 0x${im.iatVa.toString(16)})  refs=${refs.length}`)
  for (const r of refs) {
    console.log(`    ${r.kind} @ 0x${r.va.toString(16)}  (rva 0x${r.rva.toString(16)})`)
    // Delphi routes calls through a `jmp [iat]` thunk: find the code that calls the thunk.
    if (r.kind === 'jmp') {
      for (const c of scanRelCalls(r.va)) {
        console.log(`        <- ${c.kind} @ 0x${c.va.toString(16)}`)
      }
    }
  }
}
