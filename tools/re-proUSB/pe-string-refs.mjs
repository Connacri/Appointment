// Map file offsets to RVAs in a PE32 and find code references to a string constant.
//
// Usage: node pe-string-refs.mjs <pe-file> <needle> [needle2 …]
//
// For every occurrence of a needle: file offset, RVA, VA, containing section, plus every
// `push imm32` (68 xx xx xx xx) or `mov r32, imm32` (B8+r) whose immediate equals the string's
// VA — i.e. the places the code passes that string to something (typically GetProcAddress).

import fs from 'node:fs'

const [, , filePath, ...needles] = process.argv
if (!filePath || needles.length === 0) {
  console.error('usage: node pe-string-refs.mjs <pe-file> <needle…>')
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
const sizeOfHeaders = u32(opt + 60)

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

function offToRva(off) {
  for (const s of sections) {
    if (off >= s.rawPtr && off < s.rawPtr + s.rawSize) return s.vaddr + (off - s.rawPtr)
  }
  return off < sizeOfHeaders ? off : -1
}

function sectionOf(off) {
  for (const s of sections) {
    if (off >= s.rawPtr && off < s.rawPtr + s.rawSize) return s.name
  }
  return '?'
}

const execSections = sections.filter((s) => s.characteristics & 0x20000000)

// Find code references to an absolute address: `push imm32`, `mov r32, imm32`,
// `lea r32, [imm32]` (8D /r with mod=00, rm=101), `call/jmp rel32`, `call/jmp [imm32]`.
function findImmRefs(va) {
  const hits = []
  for (const s of execSections) {
    const end = Math.min(buf.length, s.rawPtr + s.rawSize)
    for (let o = s.rawPtr; o < end; o++) {
      const op = buf[o]
      const at = imageBase + s.vaddr + (o - s.rawPtr)

      // push imm32
      if (op === 0x68 && o + 5 <= end && u32(o + 1) === va) {
        hits.push({ insn: 'push', va: at })
        continue
      }
      // mov r32, imm32
      if (op >= 0xb8 && op <= 0xbf && o + 5 <= end && u32(o + 1) === va) {
        hits.push({ insn: 'mov', va: at })
        continue
      }
      // lea r32, [imm32]  → mod=00, rm=101
      if (op === 0x8d && o + 6 <= end && (buf[o + 1] & 0xc7) === 0x05 && u32(o + 2) === va) {
        hits.push({ insn: 'lea', va: at })
        continue
      }
      // mov eax,[imm32] (A1) / mov [imm32],eax (A3)
      if ((op === 0xa1 || op === 0xa3) && o + 5 <= end && u32(o + 1) === va) {
        hits.push({ insn: op === 0xa1 ? 'mov-r' : 'mov-w', va: at })
        continue
      }
      // mov r32,[imm32] (8B /r) / mov [imm32],r32 (89 /r), mod=00 rm=101
      if ((op === 0x8b || op === 0x89) && o + 6 <= end && (buf[o + 1] & 0xc7) === 0x05 && u32(o + 2) === va) {
        hits.push({ insn: op === 0x8b ? 'mov-r' : 'mov-w', va: at })
        continue
      }
      // call/jmp rel32
      if ((op === 0xe8 || op === 0xe9) && o + 5 <= end) {
        const target = (at + 5 + (u32(o + 1) | 0)) >>> 0
        if (target === (va >>> 0)) {
          hits.push({ insn: op === 0xe8 ? 'call' : 'jmp', va: at })
        }
        continue
      }
      // call/jmp [imm32]
      if (op === 0xff && o + 6 <= end && (buf[o + 1] === 0x15 || buf[o + 1] === 0x25)) {
        if (u32(o + 2) === va) {
          hits.push({ insn: buf[o + 1] === 0x15 ? 'call[iat]' : 'jmp[iat]', va: at })
        }
      }
    }
  }
  return hits
}

for (const needle of needles) {
  // Allow a raw address: 0x6cd724 → report every code reference to it.
  if (/^0x[0-9a-f]+$/i.test(needle)) {
    const va = parseInt(needle, 16)
    const refs = findImmRefs(va)
    console.log(`addr ${needle}  refs=${refs.length}`)
    for (const r of refs) console.log(`    ${r.insn} @ 0x${r.va.toString(16)}`)
    continue
  }

  const raw = Buffer.from(needle, 'latin1')
  let pos = 0
  let n = 0
  while ((pos = buf.indexOf(raw, pos)) >= 0) {
    n++
    const rva = offToRva(pos)
    const va = rva >= 0 ? imageBase + rva : -1
    console.log(
      `${needle}  off=0x${pos.toString(16)} rva=${rva >= 0 ? '0x' + rva.toString(16) : '?'} ` +
        `va=${va >= 0 ? '0x' + va.toString(16) : '?'} section=${sectionOf(pos)}`
    )
    if (va >= 0) {
      for (const r of findImmRefs(va)) {
        console.log(`    ${r.insn} @ 0x${r.va.toString(16)}`)
      }
    }
    pos += raw.length
  }
  if (n === 0) console.log(`${needle}  (not found)`)
}
