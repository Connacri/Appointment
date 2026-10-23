// Hex dump a virtual-address range of a PE32, with ASCII column.
// Usage: node pe-hexdump.mjs <pe-file> <startVA> <endVA>

import fs from 'node:fs'

const [, , filePath, startArg, endArg] = process.argv
if (!filePath || !startArg || !endArg) {
  console.error('usage: node pe-hexdump.mjs <pe-file> <startVA> <endVA>')
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
  })
}

function vaToOff(va) {
  const rva = va - imageBase
  for (const s of sections) {
    if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) {
      const d = rva - s.vaddr
      return d < s.rawSize ? s.rawPtr + d : -1
    }
  }
  return -1
}

const start = Number(BigInt(startArg))
const end = Number(BigInt(endArg))
let off = vaToOff(start)
if (off < 0) {
  console.error('start VA not mapped')
  process.exit(1)
}

const printable = (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')

for (let va = start; va < end; va += 16) {
  const row = []
  const asc = []
  let ok = true
  for (let i = 0; i < 16 && va + i < end; i++) {
    const o = vaToOff(va + i)
    if (o < 0 || o >= buf.length) { ok = false; break }
    row.push(buf[o].toString(16).padStart(2, '0'))
    asc.push(printable(buf[o]))
  }
  if (!ok) { console.log(`0x${va.toString(16)}  <unmapped>`); break }
  console.log(`0x${va.toString(16)}  ${row.join(' ').padEnd(47)}  ${asc.join('')}`)
}
