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

/**
 * Unpacks 3 bytes into date/time components.
 *
 * The year is a 4-bit field with a 16-year window: base 2009. The window is
 * rolled forward to the present so a card written in 2026 (nibble 1) is not
 * decoded as 2010, while a genuine 2015 card (nibble 6) still reads 2015.
 */
function unpackDateTime(b0: number, b1: number, b2: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const nibble = (b0 >> 4) & 0x0f;
  let year = 2009 + nibble;
  const currentYear = new Date().getFullYear();
  while (year + 16 <= currentYear + 1) year += 16;

  const month = b0 & 0x0f;
  const day = (b1 >> 3) & 0x1f;
  const hour = ((b1 & 0x07) << 2) | ((b2 >> 6) & 0x03);
  const minute = b2 & 0x3f;

  return {
    year,
    month: month || 1,
    day: day || 1,
    hour,
    minute,
  };
}

/**
 * Like `unpackDateTime`, but returns null when the 3 bytes cannot be a real
 * date/time. Used for optional fields (system-card trailer, which is a family
 * marker instead of an expiry date).
 */
function tryUnpackDateTime(
  b0: number,
  b1: number,
  b2: number,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const month = b0 & 0x0f;
  const day = (b1 >> 3) & 0x1f;
  const hour = ((b1 & 0x07) << 2) | ((b2 >> 6) & 0x03);
  const minute = b2 & 0x3f;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  return unpackDateTime(b0, b1, b2);
}

function pseudoRand(seed: number): number {
  return ((seed * 1103515245 + 12345) & 0x7fffffff) & 0xff;
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
  site: [number, number];
  marker: [number, number];
  header: [number, number, number];
  tail: [number, number, number];
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

/**
 * Encodes a genuine proUSB system (configuration) card.
 *
 * Layout recovered from 62 records of the shipped CardLock.mdb:
 *   C9 12 | site(2) | marker(2) | header(3) | type(1) | issued(3) | tail(3)
 *
 * [10..12] is the issue date/time (same packing as every other family), not a
 * serial: CardInfo #61 = EC 63 1B → 2023-12-12 12:27, one minute before the
 * guest card #62 (EC 63 1C → 12:28). The 2026 card read from the real encoder
 * (1A CA 58) decodes to 2026-10-25 09:24.
 *
 * Site, marker, header and tail are read **from the database**, so the record
 * is structurally identical to the one produced by CardLock.exe.
 */
export function encodeSystemCard(params: {
  typeIndex: number;
  template?: SystemCardTemplate | null;
  issuedAt?: Date;
}): Uint8Array {
  const tpl = params.template;
  const card = new Uint8Array(16);

  card[0] = 0xc9;
  card[1] = DEFAULT_SITE_HIGH;
  card[2] = tpl ? tpl.site[0] : (DEFAULT_SITE_LOW >> 8) & 0xff;
  card[3] = tpl ? tpl.site[1] : DEFAULT_SITE_LOW & 0xff;
  card[4] = tpl ? tpl.marker[0] : 0xfc;
  card[5] = tpl ? tpl.marker[1] : 0xc4;
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

  card[13] = tpl ? tpl.tail[0] : 0x29;
  card[14] = tpl ? tpl.tail[1] : 0x23;
  card[15] = tpl ? tpl.tail[2] : 0xbe;

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
 * Decodes any raw 16-byte proUSB card record into structured details
 */
export function decodeCardRecord(rawBytesOrHex: Uint8Array | string): DecodedProUsbCard {
  const bytes = typeof rawBytesOrHex === 'string' ? fromHex(rawBytesOrHex) : rawBytesOrHex;
  if (bytes.length < 16) {
    throw new Error(`Record too short: need 16 bytes, got ${bytes.length}`);
  }

  const rawHex = toHex(bytes.slice(0, 16));
  const byte9 = bytes[9];
  const typeFamily = byte9 & 0xf0;
  const cardIndex = byte9 & 0x0f;

  let type: ProUsbCardType = 'guest';
  for (const [t, meta] of Object.entries(PROUSB_CARD_TYPES)) {
    if (meta.typeFamilyByte === typeFamily) {
      type = t as ProUsbCardType;
      break;
    }
  }

  // Site code is stored big-endian: [2]=high, [3]=low (C9 12 24 B6 ...)
  const siteLow = (bytes[2] << 8) | bytes[3];
  const siteCode = `${toHex([bytes[0], bytes[1]])}-${(siteLow & 0x3fff).toString(16).padStart(4, '0').toUpperCase()}`;

  const decoded: DecodedProUsbCard = {
    rawHex,
    type,
    cardIndex,
    siteCode,
    options: {
      allowDeadbolt: false,
      // Not encoded in bytes [2..3]: the whole 16-bit field is the site code
      // the lock compares. The flag is kept for API compatibility only.
      coverCardsBefore: false,
      openPublicDoor: false,
    },
  };

  if (type === 'hard_reset') {
    decoded.options.allowDeadbolt = true;
    decoded.options.coverCardsBefore = true;
    decoded.options.openPublicDoor = true;

    // System cards: [10..12] = issue date/time, [13..15] = family trailer
    // (29 23 BE), which is not a date. End = start when the trailer is opaque.
    const start = unpackDateTime(bytes[10], bytes[11], bytes[12]);
    const end = tryUnpackDateTime(bytes[13], bytes[14], bytes[15]) ?? start;
    decoded.validity = {
      startYear: start.year,
      startMonth: start.month,
      startDay: start.day,
      startHour: start.hour,
      startMinute: start.minute,
      endYear: end.year,
      endMonth: end.month,
      endDay: end.day,
      endHour: end.hour,
      endMinute: end.minute,
    };
  } else if (type === 'guest') {
    // Room number decoding:
    // byte 5 is room mod 100 with high bit set (0x80)
    // byte 6 is floor (room div 100) with high bit set (0x80)
    const roomMod = bytes[5] & 0x7f;
    const floor = bytes[6] & 0x7f;
    const roomNum = floor * 100 + roomMod;
    decoded.floorNo = floor;
    decoded.roomMod100 = roomMod;
    decoded.roomDiv100 = floor;
    decoded.roomNumber = `${roomNum}`;
    decoded.options.openPublicDoor = bytes[8] === 0x01;

    // Unpack dates
    const start = unpackDateTime(bytes[10], bytes[11], bytes[12]);
    const end = unpackDateTime(bytes[13], bytes[14], bytes[15]);
    decoded.validity = {
      startYear: start.year,
      startMonth: start.month,
      startDay: start.day,
      startHour: start.hour,
      startMinute: start.minute,
      endYear: end.year,
      endMonth: end.month,
      endDay: end.day,
      endHour: end.hour,
      endMinute: end.minute,
    };
  } else if (type === 'master' || type === 'floor' || type === 'building' || type === 'emergency') {
    if (type === 'floor') decoded.floorNo = bytes[4];
    if (type === 'building') decoded.buildingNo = bytes[4];

    const start = unpackDateTime(bytes[10], bytes[11], bytes[12]);
    const end = unpackDateTime(bytes[13], bytes[14], bytes[15]);
    decoded.validity = {
      startYear: start.year,
      startMonth: start.month,
      startDay: start.day,
      startHour: start.hour,
      startMinute: start.minute,
      endYear: end.year,
      endMonth: end.month,
      endDay: end.day,
      endHour: end.hour,
      endMinute: end.minute,
    };
  } else if (type === 'room_set') {
    decoded.buildingNo = bytes[4];
    decoded.floorNo = bytes[5];
    decoded.roomMod100 = bytes[6];
    decoded.roomNumber = `${bytes[5] * 100 + bytes[6]}`;
  }

  return decoded;
}
