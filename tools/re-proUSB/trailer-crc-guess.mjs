// Try to identify the 4-byte trailer the reader writes after the 16-byte record.
// Input: 32-byte write payload (20 bytes record/trailer + 12 zero pad).
// Observed trailer after write: 50 50 00 83

import zlib from 'node:zlib'

const payload32 = Buffer.from(
  'C9121722FF00298000B919D2C029D5FB5029466D' + '00'.repeat(12),
  'hex'
)
const record16 = payload32.subarray(0, 16)
const record20 = payload32.subarray(0, 20)

const observed = '50500083'
const observedBe = Buffer.from(observed, 'hex')
const observedLe = Buffer.from(observed, 'hex').reverse()

function hex(buf) {
  return Buffer.from(buf).toString('hex').toUpperCase()
}

function crc32(buf) {
  return zlib.crc32 ? zlib.crc32(buf) >>> 0 : null
}

// Generic CRC-32 (reflected, poly 0xEDB88320), init/xorout configurable
function crc32Reflected(buf, init = 0xffffffff, xorout = 0xffffffff) {
  let c = init >>> 0
  for (const b of buf) {
    c ^= b
    for (let i = 0; i < 8; i++) {
      c = (c & 1) ? ((c >>> 1) ^ 0xedb88320) : (c >>> 1)
      c >>>= 0
    }
  }
  return (c ^ xorout) >>> 0
}

// Non-reflected CRC-32 (poly 0x04C11DB7)
function crc32Normal(buf, init = 0xffffffff, xorout = 0xffffffff) {
  let c = init >>> 0
  for (const b of buf) {
    c = (c ^ (b << 24)) >>> 0
    for (let i = 0; i < 8; i++) {
      c = (c & 0x80000000) ? (((c << 1) ^ 0x04c11db7) >>> 0) : ((c << 1) >>> 0)
      c >>>= 0
    }
  }
  return (c ^ xorout) >>> 0
}

// Simple additive / xor checksums as fallback hypotheses
function xorAll(buf) {
  let x = 0
  for (const b of buf) x ^= b
  return x >>> 0
}

const targets = [
  ['payload32 BE', record20.length],
]

const candidates = []
function add(name, value) {
  const be = Buffer.alloc(4)
  be.writeUInt32BE(value >>> 0, 0)
  candidates.push([name, hex(be)])
}

for (const [label, buf] of [['payload32', payload32], ['record16', record16], ['record20', record20]]) {
  add(`${label} crc32Refl default`, crc32Reflected(buf))
  add(`${label} crc32Refl init0`, crc32Reflected(buf, 0, 0))
  add(`${label} crc32Norm default`, crc32Normal(buf))
  add(`${label} crc32Norm init0`, crc32Normal(buf, 0, 0))
  if (zlib.crc32) add(`${label} zlib.crc32`, zlib.crc32(buf) >>> 0)
}

console.log('payload32 =', hex(payload32))
console.log('record16  =', hex(record16))
console.log('record20  =', hex(record20))
console.log('observed trailer =', observed, '(BE) /', hex(observedLe), '(LE)')
console.log('')
let hit = false
for (const [name, value] of candidates) {
  const match = value === observed || value === hex(observedLe)
  if (match) hit = true
  console.log(`${match ? '*** MATCH ***' : '            '} ${name.padEnd(30)} = ${value}`)
}
if (!hit) console.log('\nNo common CRC-32 variant matches the 4-byte trailer.')
console.log('\nxorAll(payload32) =', xorAll(payload32).toString(16).toUpperCase())
console.log('xorAll(record16)  =', xorAll(record16).toString(16).toUpperCase())
