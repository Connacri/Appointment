/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * proUSB CardLock.mdb — real database import
 * ------------------------------------------
 * The original proUSB software keeps everything in a JET4/Access database
 * (`CardLock.mdb`, next to `CardLock.Exe`). This module parses that file
 * **client side** with `mdb-reader` (pure JavaScript), so the app can be
 * installed either:
 *
 *   • after the original software  → it reads the very same database and
 *     continues to operate on the existing rooms / guests / cards;
 *   • first (standalone)           → no database is imported, the app keeps
 *     working with its own persisted model.
 *
 * Verified against the shipped database (no password required):
 *   tables = BuildingInfo, CaoZuoInfo, CardInfo, Dai, GuestInfo, LogInfo,
 *            OperatorInfo, RecordOpen, RegInfo, RoomInfo
 *
 * Card record layout recovered from 62 real records (CardInfo.CardData):
 *
 *   [0]      0xC9                      magic
 *   [1]      0x12                      site high (constant)
 *   [2..3]   site code                 e.g. 03 3B  (was 24 B6 in 2015)
 *   [4..5]   family marker             FF00 master, E3xx room, FCC4 system
 *   [6..8]   family header
 *   [9]      card type / index         0x01..0x0F system, 0x60+ guest, 0xB0+ master
 *   [10..12] card serial (24 bit, big endian, monotonic)
 *   [13..15] family trailer            system cards always end 29 23 BE
 */

import { DEFAULT_SYSTEM_CARD_TEMPLATE as DEFAULT_TEMPLATE } from '../cards/codec';

/**
 * Default template used when no `CardLock.mdb` has been imported yet.
 * (Extends the codec template with traceability fields.)
 */
export const DEFAULT_SYSTEM_CARD_TEMPLATE: SystemCardProfile = {
  ...DEFAULT_TEMPLATE,
  sampleHex: '',
  sampleId: 0,
};

export interface SystemCardProfile {
  /** Bytes [2..3] — site / system code shared by every card of this installation. */
  site: [number, number];
  /** Bytes [4..5] — family marker used by system (configuration) cards. */
  marker: [number, number];
  /** Bytes [6..8] — family header used by system cards. */
  header: [number, number, number];
  /** Bytes [13..15] — family trailer (constant for system cards). */
  tail: [number, number, number];
  /** A genuine record from the database, kept for traceability. */
  sampleHex: string;
  sampleId: number;
}

export interface ImportedCard {
  id: number;
  hex: string;
  holder: string;
  operator: string;
  status: string;
  /** Byte [9] — card type / index. */
  typeIndex: number;
}

export interface ImportedRoom {
  building: number;
  floor: number;
  roomNo: string;
  type: string;
  status: string;
  price: string;
}

export interface ImportedGuest {
  roomNo: string;
  name: string;
  comeTime: string | null;
  goTime: string | null;
  cardId: string;
  flag: string;
}

export interface ImportedBuilding {
  no: number;
  name: string;
}

export interface MdbSnapshot {
  fileName: string;
  importedAt: string;
  buildings: ImportedBuilding[];
  rooms: ImportedRoom[];
  guests: ImportedGuest[];
  cards: ImportedCard[];
  systemProfile: SystemCardProfile | null;
  counts: { cards: number; guests: number; rooms: number; openings: number };
  warnings: string[];
}

const HEX_RE = /^[0-9a-fA-F]{32}$/;

function normalizeHex(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (cleaned.length !== 32) return '';
  return HEX_RE.test(cleaned) ? cleaned : '';
}

function bytesOf(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 16; i += 1) out.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return out;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  return null;
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Recovers the installation signature from the cards themselves.
 *
 * The site code is not stored explicitly anywhere: it only exists inside the
 * card records. We take it from the most recent card that carries a real site
 * (never the universal `00 00` master images), then read the system-card
 * family marker / header / trailer from the most recent system card of that
 * same site.
 */
export function deriveSystemProfile(cards: ImportedCard[]): SystemCardProfile | null {
  const parsed = cards
    .filter((c) => c.hex && c.hex.length === 32)
    .map((c) => ({ card: c, b: bytesOf(c.hex) }))
    .filter(({ b }) => b[0] === 0xc9 && b[1] === 0x12);

  if (parsed.length === 0) return null;

  const byNewest = [...parsed].sort((a, z) => z.card.id - a.card.id);
  const withSite = byNewest.find(({ b }) => b[2] !== 0x00 || b[3] !== 0x00);
  if (!withSite) return null;

  const site = withSite.b[2];
  const siteLow = withSite.b[3];

  const systemRef = byNewest.find(
    ({ b }) => b[9] >= 0x01 && b[9] <= 0x0f && b[2] === site && b[3] === siteLow,
  );

  const ref = systemRef ?? withSite;

  return {
    site: [site, siteLow],
    marker: systemRef ? [ref.b[4], ref.b[5]] : DEFAULT_SYSTEM_CARD_TEMPLATE.marker,
    header: systemRef
      ? [ref.b[6], ref.b[7], ref.b[8]]
      : DEFAULT_SYSTEM_CARD_TEMPLATE.header,
    tail: systemRef ? [ref.b[13], ref.b[14], ref.b[15]] : DEFAULT_SYSTEM_CARD_TEMPLATE.tail,
    sampleHex: ref.card.hex,
    sampleId: ref.card.id,
  };
}

type Row = Record<string, unknown>;

/**
 * Parses a CardLock.mdb file. Works in the browser, in a WebView and in Node.
 */
export async function parseCardLockMdb(
  data: ArrayBuffer | Uint8Array,
  fileName = 'CardLock.mdb',
): Promise<MdbSnapshot> {
  const warnings: string[] = [];

  // Lazy: `mdb-reader` (and its Buffer polyfill) is only fetched when the user
  // actually imports a database — the initial bundle stays untouched.
  const { Buffer } = await import('buffer');
  const globalRef = globalThis as unknown as { Buffer?: typeof Buffer };
  if (!globalRef.Buffer) globalRef.Buffer = Buffer;

  const buffer = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(new Uint8Array(data));

  const module_ = (await import('mdb-reader')) as unknown as {
    default: new (buf: Buffer, options?: { password?: string }) => {
      getTableNames: () => string[];
      getTable: (name: string) => { getData: () => Row[] };
    };
  };
  const MDBReader = module_.default;

  let db: InstanceType<typeof MDBReader>;
  try {
    db = new MDBReader(buffer);
  } catch (error) {
    throw new Error(
      `Fichier « ${fileName} » illisible : ${(error as Error).message}. ` +
        'Choisissez le CardLock.mdb du dossier proUSBHotelLockSystem.',
    );
  }

  const tableNames = db.getTableNames();
  const read = (name: string): Row[] => {
    if (!tableNames.includes(name)) {
      warnings.push(`Table « ${name} » absente du fichier.`);
      return [];
    }
    try {
      return db.getTable(name).getData();
    } catch (error) {
      warnings.push(`Table « ${name} » illisible : ${(error as Error).message}`);
      return [];
    }
  };

  const buildings: ImportedBuilding[] = read('BuildingInfo').map((r) => ({
    no: num(r.BldNo),
    name: str(r.BldName),
  }));

  const rooms: ImportedRoom[] = read('RoomInfo').map((r) => ({
    building: num(r.BldNo, 1),
    floor: num(r.FlrNo, 1),
    roomNo: str(r.RoomNo),
    type: str(r.sType),
    status: str(r.Status),
    price: str(r.Price),
  }));

  const guests: ImportedGuest[] = read('GuestInfo').map((r) => ({
    roomNo: str(r.BldRoomNo),
    name: str(r.Name),
    comeTime: toIsoString(r.ComeTime),
    goTime: toIsoString(r.GoTime),
    cardId: str(r.CardID),
    flag: str(r.Flag),
  }));

  const cards: ImportedCard[] = [];
  let skippedCards = 0;
  for (const row of read('CardInfo')) {
    const hex = normalizeHex(row.CardData);
    if (!hex) {
      skippedCards += 1;
      continue;
    }
    cards.push({
      id: num(row.ID),
      hex,
      holder: str(row.Holder),
      operator: str(row.GongHao),
      status: str(row.Status),
      typeIndex: parseInt(hex.slice(18, 20), 16),
    });
  }
  if (skippedCards > 0) warnings.push(`${skippedCards} carte(s) ignorée(s) (CardData vide ou invalide).`);

  const openings = read('RecordOpen').filter((r) => {
    const hex = str(r.RecData).toUpperCase();
    return hex.length > 0 && !/^F+$/.test(hex) && !/^0+$/.test(hex);
  }).length;

  return {
    fileName,
    importedAt: new Date().toISOString(),
    buildings,
    rooms,
    guests,
    cards,
    systemProfile: deriveSystemProfile(cards),
    counts: { cards: cards.length, guests: guests.length, rooms: rooms.length, openings },
    warnings,
  };
}
