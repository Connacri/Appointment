/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Card Encoders & Decoders
 * Faithful implementation of the verified proUSB record layouts:
 * - 16 bytes raw payload (CardInfo.CardData)
 * - 20 bytes on card (including 4-byte trailer calculated by reader)
 * - Exact bit-packing for all 13 card families
 */

import {
  ProUsbCardType,
  CardValidityWindow,
  DecodedProUsbCard,
  PROUSB_CARD_TYPES,
} from './types';
import { toHex, fromHex } from '../protocol/frames';

const DEFAULT_SITE_HIGH = 0x12;
const DEFAULT_SITE_LOW = 0x24b6; // Standard site code matching CardLock.mdb

/**
 * Packs date/time into 3 bytes (verified against real CardLock.mdb records):
 * byte 0: (((year - 2009) & 0x0F) << 4) | (month & 0x0F)
 * byte 1: ((day & 0x1F) << 3) | ((hour >> 2) & 0x07)
 * byte 2: ((hour & 0x03) << 6) | (minute & 0x3F)
 *
 * Evidence (GuestInfo.ComeTime ↔ CardInfo.CardData):
 *   2015-05-27 12:21 -> 65 DB 15   (2015 - 2009 = 6)
 *   2017-09-11 11:18 -> 89 5A D2   (2017 - 2009 = 8)
 *   2022-04-06 21:31 -> D4 35 5F   (2022 - 2009 = 13)
 *   2023-12-12 12:28 -> EC 63 1C   (2023 - 2009 = 14)
 *   2026-10-25 09:24 -> 1A CA 58   (2026 - 2009 = 17 -> 1)
 */
function packDateTime(year: number, month: number, day: number, hour: number, minute: number): [number, number, number] {
  const yy = (year - 2009) & 0x0f;
  const mm = Math.min(Math.max(month, 1), 12);
  const dd = Math.min(Math.max(day, 1), 31);
  const hh = Math.min(Math.max(hour, 0), 23);
  const mi = Math.min(Math.max(minute, 0), 59);

  const b0 = ((yy & 0x0f) << 4) | (mm & 0x0f);
  const b1 = ((dd & 0x1f) << 3) | ((hh >> 2) & 0x07);
  const b2 = ((hh & 0x03) << 6) | (mi & 0x3f);

  return [b0, b1, b2];
}

/** First year representable in the 4-bit year field (`(year - 2009) & 0x0F`). */
const YEAR_BASE = 2009;
/** The year field repeats every 16 years. */
const YEAR_SPAN = 16;

/**
 * Resolves the 4-bit year nibble around a reference year.
 *
 * The format only stores `(year - 2009) & 0x0F`, so every 16 years the same
 * nibble comes back (2026 and 2042 are both `1`). We pick the latest candidate
 * that is not more than one year in the future of `refYear`: a card read in
 * 2026 decodes as 2026 (not 2010), a genuine 2015 card still decodes as 2015,
 * and as long as clocks keep moving forward the resolution keeps working.
 */
function resolveYear(nibble: number, refYear: number): number {
  const base = YEAR_BASE + (nibble & 0x0f);
  let best = base;
  for (let k = -1; k <= 3; k += 1) {
    const candidate = base + k * YEAR_SPAN;
    if (candidate <= refYear + 1 && candidate > best - 1) best = candidate;
  }
  return best;
}

/**
 * Resolves the 4-bit year nibble of an **expiry** field: the first candidate
 * that is not before the start year, so a stay never ends before it begins.
 */
function resolveYearAtLeast(nibble: number, notBeforeYear: number): number {
  const base = YEAR_BASE + (nibble & 0x0f);
  let year = base;
  while (year < notBeforeYear) year += YEAR_SPAN;
  return year;
}

export interface DecodedStamp {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Unpacks the 3 date/time bytes into components, exactly as `proRFL.dll` writes
 * them (`packDateTime` above).
 *
 * Returns `null` instead of inventing `1` when the field cannot be a real date
 * (`month = 0`, `day = 0`, `minute = 62`…). This is what makes the reading
 * honest: a random system-card trailer is reported as "no date", never as
 * "2025/0/1 0:0:0" or "30 décembre 1899".
 *
 * @param opts.notBeforeYear when set, the year is resolved at or after that
 *   year (used for expiry fields, resolved relative to the start date).
 */
function unpackStamp(
  b0: number,
  b1: number,
  b2: number,
  opts: { refYear: number; notBeforeYear?: number },
): DecodedStamp | null {
  const month = b0 & 0x0f;
  const day = (b1 >> 3) & 0x1f;
  const hour = ((b1 & 0x07) << 2) | ((b2 >> 6) & 0x03);
  const minute = b2 & 0x3f;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;

  const nibble = (b0 >> 4) & 0x0f;
  const year = opts.notBeforeYear !== undefined
    ? resolveYearAtLeast(nibble, opts.notBeforeYear)
    : resolveYear(nibble, opts.refYear);

  return { year, month, day, hour, minute };
}

function stampToValidity(start: DecodedStamp, end: DecodedStamp | null): CardValidityWindow {
  const tail = end ?? start;
  return {
    startYear: start.year,
    startMonth: start.month,
    startDay: start.day,
    startHour: start.hour,
    startMinute: start.minute,
    endYear: tail.year,
    endMonth: tail.month,
    endDay: tail.day,
    endHour: tail.hour,
    endMinute: tail.minute,
  };
}

function pseudoRand(seed: number): number {
  return ((seed * 1103515245 + 12345) & 0x7fffffff) & 0xff;
}

/**
 * Three random bytes for the system-card trailer.
 *
 * `ResetCard` in `proRFL.dll` fills bytes [13..15] with three `rand() & 0xFF`
 * calls. It is pure padding: the reader/lock never interprets it as a date or
 * a checksum. The `29 23 BE` seen on old cards is simply the first three values
 * of the unseeded libc sequence, which is why several cards share it.
 */
function randomTail(): [number, number, number] {
  const bytes = new Uint8Array(3);
  const cryptoRef = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [bytes[0], bytes[1], bytes[2]];
}

export interface EncodeGuestCardParams {
  roomNumber: string; // e.g. "101", "205", "1-101"
  cardIndex?: number; // 0..15 (defaults to 1)
  validity: CardValidityWindow;
  options?: {
    allowDeadbolt?: boolean;
    coverCardsBefore?: boolean;
    openPublicDoor?: boolean;
  };
  siteCodeLow?: number;
}

/**
 * Encodes a verified proUSB Guest Card (0x60 family)
 * Hardware-verified match against [WalkIn]1-101 (ID 2):
 * C9 12 24 B6 E3 81 81 01 01 62 65 DB 15 65 E3 00
 */
export function encodeGuestCard(params: EncodeGuestCardParams): Uint8Array {
  // Expert hôtelier: expiration never before creation
  const startMs = new Date(params.validity.startYear, params.validity.startMonth - 1, params.validity.startDay, params.validity.startHour).getTime();
  const endMs = new Date(params.validity.endYear, params.validity.endMonth - 1, params.validity.endDay, params.validity.endHour).getTime();
  if (endMs <= startMs) throw new Error("Régle métier : expiration avant début d'accès.");
  if ((endMs - startMs) > 365 * 24 * 3600 * 1000) throw new Error("Régle hôtel : carte client > 365 jours.");

  const card = new Uint8Array(16);
  const cleanRoom = params.roomNumber.replace(/^[0-9]+-/, '');
  const roomNum = parseInt(cleanRoom, 10) || 101;
  const floorNo = Math.floor(roomNum / 100);
  const roomMod = roomNum % 100;
  const index = (params.cardIndex ?? 1) & 0x0f;

  card[0] = 0xc9; // Constant magic
  card[1] = DEFAULT_SITE_HIGH; // 0x12

  const siteLow = (params.siteCodeLow ?? DEFAULT_SITE_LOW) & 0x3fff;
  // Site code is stored BIG-ENDIAN on the card: 0x24B6 -> "24 B6"
  // (verified against CardInfo ID 2: C9 12 24 B6 ...)
  // Never OR extra flags into these two bytes: the lock compares the whole
  // 16-bit site code and would answer "not a card for this system".
  card[2] = (siteLow >> 8) & 0xff;
  card[3] = siteLow & 0xff;

  card[4] = 0x63 | 0x80; // Constant sentinel 99 with high bit set = 0xE3
  card[5] = (roomMod & 0x7f) | 0x80; // room mod 100 e.g. room 1 -> 0x81, room 5 -> 0x85
  card[6] = (floorNo & 0x7f) | 0x80; // floor div 100 e.g. floor 1 -> 0x81, floor 2 -> 0x82
  card[7] = 0x01; // Card sequence / nights indicator
  card[8] = params.options?.openPublicDoor ? 0x01 : 0x00;
  card[9] = 0x60 | index; // 0x60 family + card index

  const [s0, s1, s2] = packDateTime(
    params.validity.startYear,
    params.validity.startMonth,
    params.validity.startDay,
    params.validity.startHour,
    params.validity.startMinute ?? 0
  );
  card[10] = s0;
  card[11] = s1;
  card[12] = s2;

  const [e0, e1, e2] = packDateTime(
    params.validity.endYear,
    params.validity.endMonth,
    params.validity.endDay,
    params.validity.endHour,
    params.validity.endMinute ?? 0
  );
  card[13] = e0;
  card[14] = e1;
  card[15] = e2;

  return card;
}

export interface EncodeMasterCardParams {
  cardIndex?: number;
  validity: CardValidityWindow;
  cardType?: 'master' | 'floor' | 'building' | 'emergency';
  floorNo?: number;
  buildingNo?: number;
  siteCodeLow?: number;
  /** Byte [6] — per-card random nonce (CardLock.exe uses a random value). */
  nonce?: number;
}

/**
 * Encodes a proUSB Master / Floor / Building / Emergency card
 */
export function encodeMasterCard(params: EncodeMasterCardParams): Uint8Array {
  const card = new Uint8Array(16);
  const index = (params.cardIndex ?? 1) & 0x0f;
  const type = params.cardType || 'master';

  card[0] = 0xc9;
  card[1] = DEFAULT_SITE_HIGH;

  // Master cards from CardLock.mdb carry a 00 00 site:
  //   C9 12 00 00 FF 00 29 80 00 B0 94 4C 5A A4 4D FB
  // → a master is not bound to a site and opens every lock of the reader.
  // Other families keep the site read from the database.
  const siteLow = (params.siteCodeLow ?? DEFAULT_SITE_LOW) & 0x3fff;
  const siteIndependent = type === 'master' || type === 'emergency';
  card[2] = siteIndependent ? 0x00 : (siteLow >> 8) & 0xff;
  card[3] = siteIndependent ? 0x00 : siteLow & 0xff;

  switch (type) {
    case 'floor':
      card[4] = (params.floorNo ?? 1) & 0xff;
      card[9] = 0xd0 | index; // 0xD0 family for FloorCard
      break;
    case 'building':
      card[4] = (params.buildingNo ?? 1) & 0xff;
      card[9] = 0xc0 | index; // 0xC0 family for BuildingCard
      break;
    case 'emergency':
      card[4] = 0xff;
      card[9] = 0xa0 | index; // 0xA0 family for EmergencyCard
      break;
    case 'master':
    default:
      card[4] = 0xff; // Master opens all
      card[9] = 0xb0 | index; // 0xB0 family for MasterCard
      break;
  }

  card[5] = 0x00;
  card[6] = params.nonce !== undefined ? params.nonce & 0xff : pseudoRand(index + 29); // Per-card nonce
  card[7] = 0x80;
  card[8] = 0x00;

  const [s0, s1, s2] = packDateTime(
    params.validity.startYear,
    params.validity.startMonth,
    params.validity.startDay,
    params.validity.startHour,
    params.validity.startMinute ?? 0
  );
  card[10] = s0;
  card[11] = s1;
  card[12] = s2;

  const [e0, e1, e2] = packDateTime(
    params.validity.endYear,
    params.validity.endMonth,
    params.validity.endDay,
    params.validity.endHour,
    params.validity.endMinute ?? 59
  );
  card[13] = e0;
  card[14] = e1;
  card[15] = e2;

  return card;
}

export interface SystemCardTemplate {
  /** Bytes [2..3] — 16-bit site code, big-endian. `[0, 0]` means "universal". */
  site: [number, number];
  /** Bytes [6..8] — ResetCard parameters p5, p6, p4 (reader / model code). */
  header: [number, number, number];
  /**
   * Bytes [4..5] as found in the database.
   * @deprecated NOT written anymore: `ResetCard` derives [4..5] as the bitwise
   * complement of the site (`~site`), which is the real integrity check. Kept
   * only for traceability of the imported record.
   */
  marker?: [number, number];
  /**
   * Bytes [13..15] as found in the database.
   * @deprecated NOT written anymore: `ResetCard` fills [13..15] with `rand()`.
   * Kept only for traceability of the imported record.
   */
  tail?: [number, number, number];
}

/**
 * Template recovered from the shipped `CardLock.mdb`.
 * Only used when no database has been imported (standalone mode).
 */
export const DEFAULT_SYSTEM_CARD_TEMPLATE: SystemCardTemplate = {
  site: [0x03, 0x3b],
  marker: [0xfc, 0xc4],
  header: [0x80, 0x98, 0x00],
  tail: [0x29, 0x23, 0xbe],
};

/**
 * System / configuration card type indices (byte [9]).
 * 0x01..0x0F are the configuration family; 0x0E is the hard-reset card that
 * the original software writes (verified on hardware:
 * C9 12 03 3B FC C4 80 9C 00 0E 1A CA 58 29 23 BE).
 */
export const SYSTEM_CARD_TYPE = {
  reset: 0x01,
  hard_reset: 0x0e,
} as const;

/** Site value that makes a card acceptable by any lock (wildcard). */
export const UNIVERSAL_SITE = 0x0000;

/** True when the record is a system (configuration) card — family 0x00. */
export function isSystemCardByte(byte9: number): boolean {
  return (byte9 & 0xf0) === 0x00;
}

/**
 * Encodes a genuine proUSB system (configuration) card.
 *
 * Layout taken from the **original source**, `proRFL.dll` → exported
 * `ResetCard(char port, uint site, byte typeIndex, byte p4, byte p5, byte p6,
 * char *datetime "YYMMDDHHmm", int outHex)` (real body at `0x10001d50`):
 *
 *   [0]      0xC9
 *   [1..3]   site, big-endian 24-bit (bits 16-23 are the constant 0x12)
 *   [4..5]   bitwise complement of the 16-bit site  →  the integrity check
 *   [6]      p5      ┐
 *   [7]      p6      ├ reader / model header, read from CardLock.mdb
 *   [8]      p4      ┘
 *   [9]      typeIndex & 0x0F
 *   [10..12] date of issue (same packing as every other family)
 *   [13..15] three random bytes (rand() ×3) — pure padding
 *
 * Because [4..5] is *derived* from the site, a site of `0x0000` produces the
 * self-consistent `00 00 FF FF`, which is how a **universal** reset card is
 * built: the same wildcard convention the original software uses for master
 * cards (written with site `0000`).
 */
export function encodeSystemCard(params: {
  typeIndex: number;
  template?: SystemCardTemplate | null;
  issuedAt?: Date;
  /** 16-bit site code to write. Ignored when `universal` is true. */
  site?: number;
  /** Write site 0x0000 so the card is accepted by a lock of any system. */
  universal?: boolean;
}): Uint8Array {
  const tpl = params.template;
  const card = new Uint8Array(16);

  const templateSite = tpl ? ((tpl.site[0] << 8) | tpl.site[1]) & 0x3fff : DEFAULT_SITE_LOW & 0x3fff;
  const site = params.universal ? UNIVERSAL_SITE : (params.site ?? templateSite) & 0x3fff;

  card[0] = 0xc9;
  card[1] = DEFAULT_SITE_HIGH;
  card[2] = (site >> 8) & 0xff;
  card[3] = site & 0xff;
  // Complement of the site — verified on all six genuine system cards of
  // CardLock.mdb: 033B→FCC4, 316A→CE95, 24B6→DB49, 0000→FFFF.
  card[4] = (~card[2]) & 0xff;
  card[5] = (~card[3]) & 0xff;
  card[6] = tpl ? tpl.header[0] : 0x80;
  card[7] = tpl ? tpl.header[1] : 0x98;
  card[8] = tpl ? tpl.header[2] : 0x00;
  card[9] = params.typeIndex & 0x0f;

  const when = params.issuedAt ?? new Date();
  const [t0, t1, t2] = packDateTime(
    when.getFullYear(),
    when.getMonth() + 1,
    when.getDate(),
    when.getHours(),
    when.getMinutes(),
  );
  card[10] = t0;
  card[11] = t1;
  card[12] = t2;

  const [r0, r1, r2] = randomTail();
  card[13] = r0;
  card[14] = r1;
  card[15] = r2;

  return card;
}

export interface EncodeCommissioningCardParams {
  type: 'reset' | 'hard_reset' | 'room_set' | 'time_set' | 'record' | 'checkout' | 'blacklist' | 'group_set' | 'limit';
  roomNumber?: string;
  floorNo?: number;
  buildingNo?: number;
  time?: { year: number; month: number; day: number; hour: number; minute: number };
  blacklistTargetHex?: string; // 8 hex digits
  cardIndex?: number;
  adminCode?: string; // Admin authentication code for hard_reset
  /** Site/marker/header/tail read from CardLock.mdb. */
  template?: SystemCardTemplate | null;
  /** Overrides the issue timestamp written at bytes [10..12]. */
  issuedAt?: Date;
  /** Write site 0x0000 so the card resets a lock of **any** system. */
  universal?: boolean;
}

/**
 * Encodes special setup, commissioning and audit cards
 */
export function encodeCommissioningCard(params: EncodeCommissioningCardParams): Uint8Array {
  if (params.type === 'reset' || params.type === 'hard_reset') {
    return encodeSystemCard({
      typeIndex: SYSTEM_CARD_TYPE[params.type],
      template: params.template ?? null,
      issuedAt: params.issuedAt,
      universal: params.universal,
    });
  }

  const card = new Uint8Array(16);
  const index = (params.cardIndex ?? 0) & 0x0f;

  card[0] = 0xc9;
  card[1] = DEFAULT_SITE_HIGH;
  card[2] = (DEFAULT_SITE_LOW >> 8) & 0xff;
  card[3] = DEFAULT_SITE_LOW & 0xff;

  const now = params.time || {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    hour: new Date().getHours(),
    minute: new Date().getMinutes(),
  };

  switch (params.type) {
    case 'room_set': {
      // Step 2 of lock setup: sets building & room into lock
      const clean = (params.roomNumber || '101').replace(/^[0-9]+-/, '');
      const num = parseInt(clean, 10) || 101;
      card[4] = (params.buildingNo ?? 1) & 0xff;
      card[5] = (params.floorNo ?? Math.floor(num / 100)) & 0xff;
      card[6] = (num % 100) & 0xff;
      card[7] = 0x80;
      card[8] = 0x00;
      card[9] = 0x20 | index; // 0x20 family
      card[13] = pseudoRand(index + 3);
      card[14] = pseudoRand(index + 7);
      card[15] = pseudoRand(index + 11);
      break;
    }
    case 'time_set': {
      // Step 3 of lock setup: synchronizes lock internal clock
      card[4] = pseudoRand(index + 1);
      card[5] = pseudoRand(index + 2);
      card[6] = pseudoRand(index + 3);
      card[7] = pseudoRand(index + 4);
      card[8] = 0x00;
      card[9] = 0x30 | index; // 0x30 family
      const [t0, t1, t2] = packDateTime(now.year, now.month, now.day, now.hour, now.minute);
      card[10] = t0;
      card[11] = t1;
      card[12] = t2;
      card[13] = 0x00;
      card[14] = pseudoRand(index + 5);
      card[15] = pseudoRand(index + 6);
      break;
    }
    case 'record': {
      // Audit record card: presented to lock to extract its opening log
      card[4] = pseudoRand(index + 1);
      card[5] = pseudoRand(index + 2);
      card[6] = pseudoRand(index + 3);
      card[7] = 0x00;
      card[8] = 0x00;
      card[9] = 0x10 | index; // 0x10 family
      const [t0, t1, t2] = packDateTime(now.year, now.month, now.day, now.hour, now.minute);
      card[10] = t0;
      card[11] = t1;
      card[12] = t2;
      card[13] = pseudoRand(index + 4);
      card[14] = pseudoRand(index + 5);
      card[15] = pseudoRand(index + 6);
      break;
    }
    case 'checkout': {
      // Check-out card to cancel active guest stay in lock
      const clean = (params.roomNumber || '101').replace(/^[0-9]+-/, '');
      const num = parseInt(clean, 10) || 101;
      card[4] = (num % 100) & 0xff;
      card[5] = Math.floor(num / 100) & 0xff;
      card[9] = 0x70 | index; // 0x70 family
      break;
    }
    case 'blacklist': {
      // Blacklist / revoked cards
      card[9] = 0x40 | index; // 0x40 family
      if (params.blacklistTargetHex) {
        const targetBytes = fromHex(params.blacklistTargetHex);
        for (let i = 0; i < Math.min(4, targetBytes.length); i += 1) {
          card[4 + i] = targetBytes[i];
        }
      }
      break;
    }
    case 'group_set': {
      card[9] = 0x50 | index;
      break;
    }
    case 'limit': {
      card[9] = 0x40 | index;
      break;
    }
  }

  return card;
}

/**
 * Resolves the card family from byte [9].
 *
 * Families 0x10..0xD0 use the high nibble as the family marker. Family 0x00
 * (system / configuration cards) uses the **low** nibble as the type index:
 * 0x01 = reset, 0x0E = hard reset. There is no 0x00 "family" collision, so the
 * old first-match loop wrongly reported every reset card as a hard reset.
 */
function resolveCardType(byte9: number): ProUsbCardType {
  const family = byte9 & 0xf0;
  if (family === 0x00) {
    return (byte9 & 0x0f) === SYSTEM_CARD_TYPE.hard_reset ? 'hard_reset' : 'reset';
  }
  for (const [type, meta] of Object.entries(PROUSB_CARD_TYPES)) {
    if (meta.typeFamilyByte === family) return type as ProUsbCardType;
  }
  return 'guest';
}

/**
 * Decodes any raw 16-byte proUSB card record into structured details.
 *
 * The field layout is taken from the original `proRFL.dll` builders, not from
 * guesswork:
 *   ResetCard   → [4..5] = ~site, [13..15] = random padding
 *   GuestCard   → [4] sentinel, [5] room, [6] floor, [7] building, [13..15] end
 *   MasterCard  → [4] level, [6] nonce, [7] p6<<4, [13..15] end
 *
 * Consequences for reading:
 *   • a system card has **no expiry date** — [13..15] is random, so it is
 *     never decoded as a date;
 *   • invalid date fields return `null` (reported as "unknown") instead of a
 *     fabricated 1st January or a 1899 placeholder;
 *   • the site-complement integrity check of system cards is exposed through
 *     `siteComplementOk`, and `isUniversalSite` flags a wildcard `0000` card.
 */
export function decodeCardRecord(rawBytesOrHex: Uint8Array | string): DecodedProUsbCard {
  const bytes = typeof rawBytesOrHex === 'string' ? fromHex(rawBytesOrHex) : rawBytesOrHex;
  if (bytes.length < 16) {
    throw new Error(`Record too short: need 16 bytes, got ${bytes.length}`);
  }

  const rawHex = toHex(bytes.slice(0, 16));
  const rawTypeIndex = bytes[9];
  const cardIndex = rawTypeIndex & 0x0f;
  const type = resolveCardType(rawTypeIndex);
  const isSystem = isSystemCardByte(rawTypeIndex);

  // Site code is stored big-endian: [2]=high, [3]=low (C9 12 24 B6 ...)
  const siteLow = ((bytes[2] << 8) | bytes[3]) & 0x3fff;
  const siteCode = `${toHex([bytes[0], bytes[1]])}-${siteLow.toString(16).padStart(4, '0').toUpperCase()}`;

  const decoded: DecodedProUsbCard = {
    rawHex,
    type,
    cardIndex,
    rawTypeIndex,
    siteCode,
    siteValue: siteLow,
    isUniversalSite: siteLow === UNIVERSAL_SITE,
    options: {
      allowDeadbolt: false,
      coverCardsBefore: type === 'hard_reset',
      openPublicDoor: false,
    },
  };

  if (isSystem) {
    // [4..5] must be the bitwise complement of [2..3]: that is the integrity
    // check ResetCard creates and the reader verifies.
    decoded.siteComplementOk = bytes[4] === ((~bytes[2]) & 0xff) && bytes[5] === ((~bytes[3]) & 0xff);

    // [10..12] = date of issue. [13..15] = random padding, never a date.
    const issued = unpackStamp(bytes[10], bytes[11], bytes[12], {
      refYear: new Date().getFullYear(),
    });
    if (issued) {
      decoded.validity = stampToValidity(issued, null);
      decoded.endIsUnknown = true;
      decoded.issuedAt = formatIso(issued);
    }
  } else if (type === 'guest') {
    // GuestCard: [5] = room (low 7 bits), [6] = floor, [7] = building.
    const roomMod = bytes[5] & 0x7f;
    const floor = bytes[6] & 0x7f;
    decoded.buildingNo = bytes[7] & 0x0f;
    decoded.floorNo = floor;
    decoded.roomMod100 = roomMod;
    decoded.roomDiv100 = floor;
    decoded.roomNumber = `${floor * 100 + roomMod}`;
    decoded.options.openPublicDoor = bytes[8] === 0x01;

    const start = unpackStamp(bytes[10], bytes[11], bytes[12], {
      refYear: new Date().getFullYear(),
    });
    const end = start
      ? unpackStamp(bytes[13], bytes[14], bytes[15], {
          refYear: start.year,
          notBeforeYear: start.year,
        })
      : null;
    if (start) decoded.validity = stampToValidity(start, end);
  } else if (type === 'master' || type === 'floor' || type === 'building' || type === 'emergency') {
    if (type === 'floor') decoded.floorNo = bytes[4];
    if (type === 'building') decoded.buildingNo = bytes[4];

    const start = unpackStamp(bytes[10], bytes[11], bytes[12], {
      refYear: new Date().getFullYear(),
    });
    const end = start
      ? unpackStamp(bytes[13], bytes[14], bytes[15], {
          refYear: start.year,
          notBeforeYear: start.year,
        })
      : null;
    if (start) decoded.validity = stampToValidity(start, end);
  } else if (type === 'room_set') {
    decoded.buildingNo = bytes[4];
    decoded.floorNo = bytes[5];
    decoded.roomMod100 = bytes[6];
    decoded.roomNumber = `${bytes[5] * 100 + bytes[6]}`;
  }

  return decoded;
}

function formatIso(stamp: DecodedStamp): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${stamp.year}-${p(stamp.month)}-${p(stamp.day)}T${p(stamp.hour)}:${p(stamp.minute)}`;
}
