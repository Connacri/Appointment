// Decode a 16-byte CardLock card record (as stored in CardInfo.CardData).
//
// Usage: node card-record-decode.mjs <hex32> [hex32 …]
//        node card-record-decode.mjs --file cardinfo.txt      # lines produced by mdb-query.ps1
//
// Layout references: docs/re-proUSB/CARD-API.md §6 (type byte) and §7 (field packing).

import fs from 'node:fs'

const TYPE_NAMES = {
  0x10: 'RecordCard',
  0x20: 'RoomSetCard',
  0x30: 'TimeSetCard',
  0x40: 'LimitCard',
  0x50: 'GroupSetCard',
  0x60: 'GuestCard',
  0x70: 'CheckOutCard',
  0x80: 'GroupCard',
  0xa0: 'EmergencyCard',
  0xb0: 'MasterCard',
  0xc0: 'BuildingCard',
  0xd0: 'FloorCard',
}

function decode(hex) {
  const b = Buffer.from(hex, 'hex')
  if (b.length !== 16) return { error: `expected 16 bytes, got ${b.length}` }

  const typeByte = b[9]
  const typeFamily = typeByte & 0xf0
  const typeName = TYPE_NAMES[typeFamily] || `unknown(0x${typeFamily.toString(16)})`

  const M = (b[10] >> 4) & 0xf
  const A = b[10] & 0xf
  const B = (b[11] >> 3) & 0x1f
  const C = ((b[11] & 0x07) << 2) | ((b[12] >> 6) & 0x03)
  const D = b[12] & 0x3f
  const O = (b[13] >> 4) & 0xf
  const E = b[13] & 0xf
  const F = (b[14] >> 3) & 0x1f
  const G = ((b[14] & 0x07) << 2) | ((b[15] >> 6) & 0x03)
  const H = b[15] & 0x3f

  return {
    hex: b.toString('hex').toUpperCase(),
    typeByte: `0x${typeByte.toString(16).padStart(2, '0').toUpperCase()}`,
    typeName,
    index: typeByte & 0x0f,
    head: `${b[0].toString(16)}${b[1].toString(16)}${b[2].toString(16)}${b[3].toString(16)}`,
    p4: b[4],
    p5: b[5],
    p6: b[6],
    p7: b[7],
    p8: b[8],
    start: `20${String(C).padStart(2, '0')}-${String(A).padStart(2, '0')}-${String(B).padStart(2, '0')} ${String(D).padStart(2, '0')}h`,
    end: `20${String(G).padStart(2, '0')}-${String(E).padStart(2, '0')}-${String(F).padStart(2, '0')} 23:${String(H).padStart(2, '0')}`,
    extra: `M=${M} O=${O} I=${b[7] & 0xf}`,
    guest: {
      L: (b[4] + 0x80) & 0xff,
      K: (b[5] + 0x80) & 0xff,
      J: (b[6] + 0x80) & 0xff,
      param6: (b[7] >> 4) & 0xf,
      I: b[7] & 0xf,
    },
  }
}

const args = process.argv.slice(2)
if (args[0] === '--file') {
  const text = fs.readFileSync(args[1], 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*\|\s*([0-9A-Fa-f]{32})\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/)
    if (!m) continue
    const [, id, hex, holder, gonghao] = m
    const d = decode(hex)
    if (d.error) continue
    console.log(
      `#${id.padStart(3)} ${d.typeName.padEnd(13)} idx=${String(d.index).padStart(2)} ` +
        `start=${d.start} end=${d.end} p4=${String(d.p4).padStart(3)} p5=${d.p5} p6=${d.p6} ` +
        `J/K/L=${d.guest.J}/${d.guest.K}/${d.guest.L} holder="${holder}" gonghao="${gonghao}"`
    )
  }
} else if (args.length === 0) {
  console.error('usage: node card-record-decode.mjs <hex32…> | --file <path>')
  process.exit(1)
} else {
  for (const hex of args) {
    const d = decode(hex)
    console.log(JSON.stringify(d, null, 1))
  }
}
