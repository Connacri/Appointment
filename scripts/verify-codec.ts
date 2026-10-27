/**
 * Dev-only round-trip check of the card codec against real CardLock.mdb
 * records. Run with: npx tsx scripts/verify-codec.ts
 */
import { encodeGuestCard, encodeMasterCard, encodeSystemCard, decodeCardRecord } from '../src/locks/cards/codec';
import type { SystemCardTemplate } from '../src/locks/cards/codec';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');

let failures = 0;

function check(label: string, expected: string, actual: Uint8Array) {
  const got = hex(actual);
  const ok = got === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) {
    console.log(`     attendu: ${expected}`);
    console.log(`     obtenu : ${got}`);
  }
}

const template: SystemCardTemplate = {
  site: [0x03, 0x3b],
  marker: [0xfc, 0xc4],
  header: [0x80, 0x98, 0x00],
  tail: [0x29, 0x23, 0xbe],
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
check(
  'master 0xB0',
  'C9 12 00 00 FF 00 29 80 00 B0 94 4C 5A A4 4D FB',
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

// ── System card 0x0E with the 2026-10-25 09:24 issue stamp read from the encoder
check(
  'système 0x0E (2026-10-25 09:24)',
  'C9 12 03 3B FC C4 80 98 00 0E 1A CA 58 29 23 BE',
  encodeSystemCard({ typeIndex: 0x0e, template, issuedAt: new Date(2026, 9, 25, 9, 24) }),
);

// ── System card 0x01 as stored in the database (CardInfo #61)
check(
  'système 0x01 (2023-12-12 12:27)',
  'C9 12 03 3B FC C4 80 98 00 01 EC 63 1B 29 23 BE',
  encodeSystemCard({ typeIndex: 0x01, template, issuedAt: new Date(2023, 11, 12, 12, 27) }),
);

// ── A genuine 2026 card must decode as 2026, never 2010
const decoded = decodeCardRecord('C912033BFCC4809C000E1ACA582923BE');
const v = decoded.validity;
const dateOk = v?.startYear === 2026 && v.startMonth === 10 && v.startDay === 25 && v.startHour === 9 && v.startMinute === 24;
if (!dateOk) failures += 1;
console.log(
  `${dateOk ? 'OK  ' : 'FAIL'} décodage carte système 2026: ` +
    `${v?.startYear}-${v?.startMonth}-${v?.startDay} ${v?.startHour}:${String(v?.startMinute).padStart(2, '0')}`,
);

// ── Guest card decoding must recover room 101 and the 2015 stay
const decodedGuest = decodeCardRecord('C91224B6E3818101016265DB1565E300');
const gv = decodedGuest.validity;
const guestOk =
  decodedGuest.roomNumber === '101' &&
  decodedGuest.siteCode.endsWith('24B6') &&
  gv?.startYear === 2015 &&
  gv.startMonth === 5 &&
  gv.startDay === 27;
if (!guestOk) failures += 1;
console.log(
  `${guestOk ? 'OK  ' : 'FAIL'} décodage invité: chambre ${decodedGuest.roomNumber}, site ${decodedGuest.siteCode}, ` +
    `${gv?.startYear}-${gv?.startMonth}-${gv?.startDay} ${gv?.startHour}:${String(gv?.startMinute).padStart(2, '0')}`,
);

console.log(failures === 0 ? '\nTOUT EST VERT' : `\n${failures} échec(s)`);
process.exitCode = failures === 0 ? 0 : 1;
