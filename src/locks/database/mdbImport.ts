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
 * Card record layout, taken from the original `proRFL.dll` builders
 * (`ResetCard`, `GuestCard`, `MasterCard`) and confirmed on 62 real records
 * (CardInfo.CardData):
 *
 *   [0]      0xC9                      magic
 *   [1]      0x12                      site high (constant)
 *   [2..3]   site code                 e.g. 03 3B  (was 24 B6 in 2015)
 *   [4..5]   family field              FF00 master, E3xx guest, ~site system
 *   [6..8]   family header             (system cards: p5 p6 p4)
 *   [9]      family + index            high nibble = family, low = type
 *                                      0x00-family: 0x01 reset, 0x0E hard reset
 *   [10..12] date/time                issue date (system) or stay start
 *   [13..15] trailer                  stay end (guest/master) or rand() padding
 *                                     (system cards — never a date)
 */

import { DEFAULT_SYSTEM_CARD_TEMPLATE as DEFAULT_TEMPLATE } from '../cards/codec';
import { ResourceGroup, ResourceItem, TimelineBooking } from '../../types/booking';

/**
 * Default template used when no `CardLock.mdb` has been imported yet.
 * (Extends the codec template with traceability fields.)
 */
export const DEFAULT_SYSTEM_CARD_TEMPLATE: SystemCardProfile = {
  site: DEFAULT_TEMPLATE.site,
  marker: DEFAULT_TEMPLATE.marker ?? [0xfc, 0xc4],
  header: DEFAULT_TEMPLATE.header,
  tail: DEFAULT_TEMPLATE.tail ?? [0x29, 0x23, 0xbe],
  sampleHex: '',
  sampleId: 0,
};

export interface SystemCardProfile {
  /** Bytes [2..3] — site / system code shared by every card of this installation. */
  site: [number, number];
  /** Bytes [4..5] — always the bitwise complement of `site` (`ResetCard`). */
  marker: [number, number];
  /** Bytes [6..8] — family header used by system cards (p5, p6, p4). */
  header: [number, number, number];
  /** Bytes [13..15] of the sample record — `rand()` padding, not written back. */
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
  /**
   * RoomInfo.CardCount — nombre de cartes client actuellement en circulation
   * pour cette chambre (compteur de l'ancien logiciel).
   */
  cardCount: number;
  /** RoomInfo.MaxCards — nombre maximum de cartes simultanées autorisées. */
  maxCards: number;
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
  /**
   * `File.lastModified` of the imported file, ISO-8601. `null` when unknown
   * (e.g. snapshot restored from storage). Used to warn when the user picked
   * the frozen `Program Files` copy instead of the live VirtualStore one.
   */
  fileLastModified: string | null;
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
 * header (bytes [6..8]) from the most recent system card of that same site.
 *
 * Bytes [4..5] are **not** copied from the record: `ResetCard` always writes
 * the bitwise complement of the site there, so we recompute them. That way an
 * imported card that was corrupted (or hand-edited) can never poison the
 * template we use to write new cards.
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
    marker: [(~site) & 0xff, (~siteLow) & 0xff],
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
  // `buffer` and `mdb-reader` reference Node's `process`, which doesn't exist
  // in the browser/WebView. Shim it before loading them.
  if (typeof globalThis.process === 'undefined') {
    (globalThis as unknown as { process?: unknown }).process = {
      env: {},
      version: '',
      nextTick: (cb: () => void) => setTimeout(cb, 0),
    };
  }
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
    cardCount: num(r.CardCount, 0),
    maxCards: num(r.MaxCards, 0),
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
    fileLastModified: null,
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

/**
 * Normalise une référence de chambre pour le rattachement réservation↔chambre.
 *
 * `GuestInfo.BldRoomNo` est au format « bâtiment-chambre » (`1-103`) alors que
 * `RoomInfo.RoomNo` est nu (`103`). Sans cette normalisation aucune réservation
 * ne se rattache à une ressource et le Gantt apparaît vide/décorrélé.
 */
export function normalizeRoomNo(value: string): string {
  const v = str(value);
  // « 1-103 » → « 103 » ; « 103 » → « 103 ».
  const m = v.match(/^(?:\d+\s*-\s*)?(\d+)$/);
  return (m ? m[1] : v).trim();
}

/**
 * Parse les dates de la base Access au format texte `jj/mm/aaaa hh:mm:ss`
 * (ex. `27/05/2015 12:21:50`). Retourne `null` si illisible — jamais de date
 * fabriquée.
 */
export function parseAccessDateTime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const v = str(value);
  if (!v) return null;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', s = '0'] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
    return null;
  }
  // Variante ISO déjà normalisée.
  const dt = new Date(v);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  return null;
}

/**
 * Convertit un snapshot CardLock.mdb importé en données de planning/Gantt :
 *   • un `ResourceGroup` par bâtiment (ou un groupe "Chambres" si aucun bâtiment)
 *   • un `ResourceItem` par chambre (RoomInfo), avec son compteur de cartes
 *   • un `TimelineBooking` par séjour client (GuestInfo : comeTime → goTime)
 *
 * Les lignes « Copy » (copies d'une même carte) d'un même séjour sont fusionnées
 * pour ne pas dupliquer le même séjour sur le Gantt.
 */
export function mdbSnapshotToPlanning(snapshot: MdbSnapshot): {
  resourceGroups: ResourceGroup[];
  bookings: TimelineBooking[];
} {
  const { buildings, rooms, guests } = snapshot;

  // Index des chambres par numéro normalisé pour lier les séjours.
  const roomByNo = new Map(rooms.map((r) => [normalizeRoomNo(r.roomNo), r]));

  // Regroupe les chambres par bâtiment.
  const roomsByBuilding = new Map<number, ImportedRoom[]>();
  const roomsWithoutBuilding: ImportedRoom[] = [];
  for (const r of rooms) {
    if (r.building && r.building > 0) {
      const arr = roomsByBuilding.get(r.building) ?? [];
      arr.push(r);
      roomsByBuilding.set(r.building, arr);
    } else {
      roomsWithoutBuilding.push(r);
    }
  }

  const resourceGroups: ResourceGroup[] = [];

  // Un groupe par bâtiment.
  for (const b of buildings) {
    const bRooms = roomsByBuilding.get(b.no) ?? [];
    resourceGroups.push({
      id: `mdb-bld-${b.no}`,
      name: {
        fr: b.name || `Bâtiment ${b.no}`,
        en: b.name || `Building ${b.no}`,
        ar: b.name || `مبنى ${b.no}`,
      },
      sector: 'hotel',
      icon: 'Building',
      resources: bRooms.map((r) => resourceItemFromRoom(r)),
    });
  }

  // Groupe pour les chambres sans bâtiment.
  if (roomsWithoutBuilding.length > 0) {
    resourceGroups.push({
      id: 'mdb-rooms-nobld',
      name: {
        fr: 'Chambres (sans bâtiment)',
        en: 'Rooms (no building)',
        ar: 'الغرف (بدون مبنى)',
      },
      sector: 'hotel',
      icon: 'BedDouble',
      resources: roomsWithoutBuilding.map((r) => resourceItemFromRoom(r)),
    });
  }

  // Si aucune chambre ni bâtiment, on crée un groupe vide pour ne pas perdre l'import.
  if (resourceGroups.length === 0 && rooms.length > 0) {
    resourceGroups.push({
      id: 'mdb-rooms',
      name: {
        fr: 'Chambres importées',
        en: 'Imported rooms',
        ar: 'الغرف المستوردة',
      },
      sector: 'hotel',
      resources: rooms.map((r) => resourceItemFromRoom(r)),
    });
  }

  // Convertit les séjours clients en réservations du planning.
  // Clé de déduplication : même chambre + même heure d'arrivée + même client
  // = un seul séjour (les lignes « Copy » sont des cartes supplémentaires).
  const stayByKey = new Map<string, TimelineBooking>();
  const bookings: TimelineBooking[] = [];

  for (const g of guests) {
    const roomNo = normalizeRoomNo(g.roomNo);
    const room = roomByNo.get(roomNo);
    const resourceId = room ? `mdb-rm-${room.roomNo}` : `mdb-room-${roomNo}`;
    const resourceName = room ? room.roomNo : roomNo;

    const startIso = parseAccessDateTime(g.comeTime);
    const endIso = parseAccessDateTime(g.goTime);
    const startDate = startIso ? startIso.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const endDate = endIso ? endIso.slice(0, 10) : startDate;

    const price = room ? parsePrice(room.price) : 0;
    const flag = g.flag || '';
    const status: TimelineBooking['status'] = /check.?out/i.test(flag)
      ? 'checked_out'
      : /copy/i.test(flag)
        ? 'confirmed'
        : /walk.?in|check.?in|arriv/i.test(flag)
          ? 'checked_in'
          : 'confirmed';

    const key = `${roomNo}|${startIso ?? startDate}|${g.name}`;
    const existing = stayByKey.get(key);
    if (existing) {
      // Carte « Copy » d'un séjour déjà présent : on étend la durée si besoin
      // et on compte les copies.
      if (endIso && endDate > existing.endDate) existing.endDate = endDate;
      const copies = Number(existing.customMetadata?.copies ?? 1) + 1;
      existing.customMetadata = { ...existing.customMetadata, copies };
      continue;
    }

    const booking: TimelineBooking = {
      id: `mdb-bkg-${roomNo}-${startDate}-${bookings.length + 1}`,
      resourceId,
      resourceName,
      sector: 'hotel',
      guestName: g.name || 'Client',
      guestEmail: '',
      guestPhone: '',
      startDate,
      endDate,
      status,
      totalPrice: price,
      paymentStatus: 'pending',
      notes: `Importé de CardLock.mdb — carte ${g.cardId || '—'}, flag: ${flag || '—'}`,
      color: '#2563eb',
      adults: 1,
      customMetadata: {
        source: 'cardlock_mdb',
        cardId: g.cardId,
        flag,
        roomType: room?.type,
        building: room?.building,
        floor: room?.floor,
        originalPrice: room?.price,
        cardCount: room?.cardCount,
        maxCards: room?.maxCards,
      },
    };
    stayByKey.set(key, booking);
    bookings.push(booking);
  }

  return { resourceGroups, bookings };
}

function resourceItemFromRoom(r: ImportedRoom): ResourceItem {
  return {
    id: `mdb-rm-${r.roomNo}`,
    name: r.roomNo,
    type: r.type || 'Chambre',
    sector: 'hotel',
    pricePerDay: parsePrice(r.price),
    housekeepingStatus: (r.status && /clean/i.test(r.status)
      ? 'clean'
      : /dirty/i.test(r.status)
        ? 'dirty'
        : /out.of.order|hs/i.test(r.status)
          ? 'out_of_order'
          : 'clean') as ResourceItem['housekeepingStatus'],
    capacity: 1,
    building: r.building ? String(r.building) : undefined,
    floor: r.floor ? String(r.floor) : undefined,
  };
}

function parsePrice(value: string): number {
  const n = parseFloat(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
