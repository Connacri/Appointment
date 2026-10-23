// Search a PE32 for a byte pattern and print VA + a short hex/ASCII window.
// Pattern syntax: hex bytes separated by spaces, `??` for a wildcard byte.
//
// Usage: node pe-pattern.mjs <pe-file> "<AA BB ?? DD>" [afterBytes]
//        node pe-pattern.mjs <pe-file> --va <startVA> <endVA> "<pattern>"   # restrict to a VA range

import fs from 'node:fs'

const args = process.argv.slice(2)
const filePath = args.shift()
if (!filePath) {
  console.error('usage: node pe-pattern.mjs <pe-file> "<hex pattern>" [afterBytes]')
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

function offToVa(off) {
  for (const s of sections) {
    if (off >= s.rawPtr && off < s.rawPtr + s.rawSize) return imageBase + s.vaddr + (off - s.rawPtr)
  }
  return -1
}

const printable = (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')

let restrict = null
let afterBytes = 24
let patternArg = null

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--va') {
    restrict = [Number(BigInt(args[i + 1])), Number(BigInt(args[i + 2]))]
    i += 2
    continue
  }
  if (!patternArg) { patternArg = args[i]; continue }
  afterBytes = parseInt(args[i], 10)
}

const tokens = patternArg.trim().split(/\s+/)
const pattern = tokens.map((t) => (t === '??' || t === '?' ? null : parseInt(t, 16)))

let startOff = 0
let endOff = buf.length
if (restrict) {
  startOff = vaToOff(restrict[0])
  endOff = vaToOff(restrict[1])
  if (startOff < 0) {
    console.error('start VA not mapped')
    process.exit(1)
  }
}

let hits = 0
for (let o = startOff; o <= endOff - pattern.length; o++) {
  let ok = true
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== null && buf[o + i] !== pattern[i]) { ok = false; break }
  }
  if (!ok) continue

  hits++
  const va = offToVa(o)
  const n = Math.min(afterBytes, endOff - o)
  const bytes = []
  const asc = []
  for (let i = 0; i < n; i++) {
    bytes.push(buf[o + i].toString(16).padStart(2, '0'))
    asc.push(printable(buf[o + i]))
  }
  console.log(`hit 0x${va.toString(16)}  ${bytes.join(' ')}  |${asc.join('')}|`)
}

console.log(`-- ${hits} hit(s)`)
