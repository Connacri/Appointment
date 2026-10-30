/**
 * Dev-only round-trip check of the card codec against real CardLock.mdb
 * records and against the original `proRFL.dll` builders.
 * Run with: npx tsx scripts/verify-codec.ts
 */
import { encodeGuestCard, encodeMasterCard, encodeSystemCard, decodeCardRecord } from '../src/locks/cards/codec';
import type { SystemCardTemplate } from '../src/locks/cards/codec';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');

let failures = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(label: string, expected: string, actual: Uint8Array) {
  const got = hex(actual);
  const good = got === expected;
  if (!good) failures += 1;
  console.log(`${good ? 'OK  ' : 'FAIL'} ${label}`);
  if (!good) {
    console.log(`     attendu: ${expected}`);
    console.log(`     obtenu : ${got}`);
  }
}

/** Compares the deterministic part of a record (bytes [0..12]). */
function checkPrefix(label: string, expectedPrefix: string, actual: Uint8Array) {
  const got = hex(actual.slice(0, 13));
  const good = got === expectedPrefix;
  if (!good) failures += 1;
  console.log(`${good ? 'OK  ' : 'FAIL'} ${label}`);
  if (!good) {
    console.log(`     attendu: ${expectedPrefix} [+3 octets aléatoires]`);
    console.log(`     obtenu : ${got} ${hex(actual.slice(13, 16))}`);
  }
}

const template: SystemCardTemplate = {
  site: [0x03, 0x3b],
  header: [0x80, 0x98, 0x00],
};

// ── CardInfo ID 2 — [WalkIn]1-101, 2015-05-27 12:21 → 2015-05-28 12:00
check(
  'invité 101 (2015)',
  'C9 12 24 B6 E3 81 81 01 01 62 65 DB 15 65 E3 00',
  encodeGuestCard({
    roomNumber: '101',
    cardIndex: 2,
    siteCodeLow: 0x24b6,
    validity: {
      startYear: 2015, startMonth: 5, startDay: 27, startHour: 12, startMinute: 21,
      endYear: 2015, endMonth: 5, endDay: 28, endHour: 12, endMinute: 0,
    },
    options: { openPublicDoor: true },
  }),
);

// ── CardInfo ID 62 — [WalkIn]1-103, 2023-12-12 12:28 → 2023-12-13 12:00
check(
  'invité 103 (2023)',
  'C9 12 03 3B E3 83 81 01 01 62 EC 63 1C EC 6B 00',
  encodeGuestCard({
    roomNumber: '103',
    cardIndex: 2,
    siteCodeLow: 0x033b,
    validity: {
      startYear: 2023, startMonth: 12, startDay: 12, startHour: 12, startMinute: 28,
      endYear: 2023, endMonth: 12, endDay: 13, endHour: 12, endMinute: 0,
    },
    options: { openPublicDoor: true },
  }),
);

// ── CardInfo ID 39 — master B0, 2018-04-09 17:26 → 2019-04-09 23:59
// The genuine record writes wildcard site 0000 (universal master) — only
// reproduced when `universal: true` is passed explicitly.
check(
  'master 0xB0 (universal)',
  'C9 12 00 00 FF 00 29 80 00 B0 94 4C 5A A4 4D FB',
  encodeMasterCard({
    cardIndex: 0,
    cardType: 'master',
    nonce: 0x29,
    universal: true,
    validity: {
      startYear: 2018, startMonth: 4, startDay: 9, startHour: 17, startMinute: 26,
      endYear: 2019, endMonth: 4, endDay: 9, endHour: 23, endMinute: 59,
    },
    siteCodeLow: 0x033b,
  }),
);

// ── Default master — carries the installation site (033B) so a commissioned
// lock accepts it. A wildcard 0000 master is rejected by a commissioned lock.
check(
  'master 0xB0 (site réel)',
  'C9 12 03 3B FF 00 29 80 00 B0 94 4C 5A A4 4D FB',
  encodeMasterCard({
    cardIndex: 0,
    cardType: 'master',
    nonce: 0x29,
    validity: {
      startYear: 2018, startMonth: 4, startDay: 9, startHour: 17, startMinute: 26,
      endYear: 2019, endMonth: 4, endDay: 9, endHour: 23, endMinute: 59,
    },
    siteCodeLow: 0x033b,
  }),
);

// ── System card 0x0E with the 2026-10-25 09:24 issue stamp read from the encoder.
// [4..5] = ~site = FC C4 and [13..15] are random, so only [0..12] is compared.
checkPrefix(
  'système 0x0E (2026-10-25 09:24)',
  'C9 12 03 3B FC C4 80 98 00 0E 1A CA 58',
  encodeSystemCard({ typeIndex: 0x0e, template, issuedAt: new Date(2026, 9, 25, 9, 24) }),
);

// ── System card 0x01 as stored in the database (CardInfo #61)
checkPrefix(
  'système 0x01 (2023-12-12 12:27)',
  'C9 12 03 3B FC C4 80 98 00 01 EC 63 1B',
  encodeSystemCard({ typeIndex: 0x01, template, issuedAt: new Date(2023, 11, 12, 12, 27) }),
);

// ── Universal reset card: site 0000 → 00 00 FF FF (self-consistent complement)
const universal = encodeSystemCard({
  typeIndex: 0x01,
  template,
  issuedAt: new Date(2026, 9, 25, 9, 24),
  universal: true,
});
checkPrefix('carte système UNIVERSELLE (site 0000)', 'C9 12 00 00 FF FF 80 98 00 01 1A CA 58', universal);
const universalDecoded = decodeCardRecord(universal);
ok('  → décodée comme universelle', universalDecoded.isUniversalSite === true, `site=${universalDecoded.siteCode}`);
ok('  → complément ~site valide', universalDecoded.siteComplementOk === true);
ok('  → aucune date d\'expiration inventée', universalDecoded.endIsUnknown === true);

// ── [4..5] must be the exact bitwise complement of [2..3] for every site
for (const site of [0x033b, 0x316a, 0x24b6, 0x0000]) {
  const card = encodeSystemCard({ typeIndex: 0x01, template, site });
  const expectedHi = (~(site >> 8)) & 0xff;
  const expectedLo = (~site) & 0xff;
  ok(
    `complément ~site pour 0x${site.toString(16).toUpperCase().padStart(4, '0')}`,
    card[2] === ((site >> 8) & 0xff) && card[3] === (site & 0xff) && card[4] === expectedHi && card[5] === expectedLo,
    `${hex(card.slice(2, 6))}`,
  );
}

// ── No frozen trailer: 32 cards must not all share the same [13..15]
const tails = new Set<string>();
for (let i = 0; i < 32; i += 1) {
  const c = encodeSystemCard({ typeIndex: 0x01, template });
  tails.add(hex(c.slice(13, 16)));
}
ok('queue [13..15] aléatoire (jamais 29 23 BE figé)', tails.size > 1, `${tails.size} valeurs distinctes`);

// ── A genuine 2026 card must decode as 2026, never 2010, and has no expiry
const decoded = decodeCardRecord('C912033BFCC4809C000E1ACA582923BE');
const v = decoded.validity;
ok(
  'décodage carte système 2026 (émise le 25/10/2026 09:24)',
  v?.startYear === 2026 && v.startMonth === 10 && v.startDay === 25 && v.startHour === 9 && v.startMinute === 24,
  `${v?.startYear}-${v?.startMonth}-${v?.startDay} ${v?.startHour}:${String(v?.startMinute).padStart(2, '0')}`,
);
ok('  → type exact = hard_reset', decoded.type === 'hard_reset', decoded.type);
ok('  → pas de date d\'expiration', decoded.endIsUnknown === true);
ok('  → complément ~site valide', decoded.siteComplementOk === true);

// ── A 0x01 system card must NOT be reported as a hard reset
const resetCard = decodeCardRecord('C912033BFCC480980001EC631B2923BE');
ok('décodage 0x01 = reset (et non hard_reset)', resetCard.type === 'reset', resetCard.type);

// ── Guest card decoding must recover room 101, building 1, floor 1 and the stay
const decodedGuest = decodeCardRecord('C91224B6E3818101016265DB1565E300');
const gv = decodedGuest.validity;
ok(
  'décodage invité: chambre 101 / site 24B6 / 2015-05-27 12:21 → 2015-05-28 12:00',
  decodedGuest.roomNumber === '101' &&
    decodedGuest.siteCode.endsWith('24B6') &&
    decodedGuest.buildingNo === 1 &&
    gv?.startYear === 2015 && gv.startMonth === 5 && gv.startDay === 27 && gv.startHour === 12 && gv.startMinute === 21 &&
    gv?.endYear === 2015 && gv.endMonth === 5 && gv.endDay === 28 && gv.endHour === 12 && gv.endMinute === 0,
  `chambre ${decodedGuest.roomNumber}, site ${decodedGuest.siteCode}, ` +
    `${gv?.startYear}-${gv?.startMonth}-${gv?.startDay} ${gv?.startHour}:${String(gv?.startMinute).padStart(2, '0')} → ` +
    `${gv?.endYear}-${gv?.endMonth}-${gv?.endDay} ${gv?.endHour}:${String(gv?.endMinute).padStart(2, '0')}`,
);

// ── Master card decoding (site 0000, one-year validity)
const decodedMaster = decodeCardRecord('C9120000FF00298000B0944C5AA44DFB');
const mv = decodedMaster.validity;
ok(
  'décodage master: 2018-04-09 17:26 → 2019-04-09 23:59, site universel',
  decodedMaster.type === 'master' &&
    decodedMaster.isUniversalSite === true &&
    mv?.startYear === 2018 && mv.startMonth === 4 && mv.startDay === 9 && mv.startHour === 17 && mv.startMinute === 26 &&
    mv?.endYear === 2019 && mv.endMonth === 4 && mv.endDay === 9 && mv.endHour === 23 && mv.endMinute === 59,
);

// ── Integrity check must fail on a hand-edited complement
const corrupted = decodeCardRecord('C912033BFDC480980001EC631B2923BE');
ok('complément corrompu détecté', corrupted.siteComplementOk === false);

// ── A card with an impossible date must not fabricate 1st January
const brokenDate = decodeCardRecord('C912033BFCC4809800010000002923BE');
ok('date impossible → pas de date inventée', brokenDate.validity === undefined);

// ── Carte d'un autre système : lecture totale, aucune interprétation inventée
const foreign = decodeCardRecord('00112233445566778899AABBCCDDEEFF');
ok('carte étrangère → format non proUSB détecté', foreign.isProUsbFormat === false);
ok('carte étrangère → octets bruts conservés', foreign.rawHex.toLowerCase() === '00112233445566778899aabbccddeeff' && foreign.bytes?.length === 16);
ok('carte étrangère → aucun champ interprété', foreign.validity === undefined && foreign.roomNumber === undefined);
ok('carte étrangère → anomalie signalée', (foreign.notes ?? []).some((n) => n.includes('non proUSB')));

// ── Trame courte : complétée, jamais rejetée
const short = decodeCardRecord('C912033BFCC4809C0009');
ok('trame courte → acceptée et complétée', short.bytesReceived === 10 && short.bytes?.length === 16);
ok('trame courte → anomalie signalée', (short.notes ?? []).some((n) => n.includes('incomplète')));
ok('trame courte → en-tête proUSB conservé', short.isProUsbFormat === true && short.siteCode === 'C912-033B');

// ── Carte proUSB : tous les octets exposés (rien n'est perdu à la lecture)
const full = decodeCardRecord('C912033BFCC4809C000E1ACA582923BE');
ok('lecture complète → magic + header + marker + tail exposés',
  full.isProUsbFormat === true &&
    full.bytes?.length === 16 &&
    full.marker?.[0] === 0xfc && full.marker?.[1] === 0xc4 &&
    full.header?.[0] === 0x80 && full.header?.[1] === 0x9c && full.header?.[2] === 0x00 &&
    full.tail?.[0] === 0x29 && full.tail?.[1] === 0x23 && full.tail?.[2] === 0xbe);

console.log(failures === 0 ? '\nTOUT EST VERT' : `\n${failures} échec(s)`);
process.exitCode = failures === 0 ? 0 : 1;
