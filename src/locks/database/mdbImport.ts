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
  /** null means the source row does not identify a building; 0 is a valid ID. */
  building: number | null;
  /** null means the source row does not identify a floor; 0 is a valid ID. */
  floor: number | null;
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
  /** Raw GuestInfo.BldRoomNo, commonly formatted as `building-room`. */
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

export interface MdbTableSummary {
  name: string;
  rowCount: number | null;
  columns: string[];
  readable: boolean;
}

export interface MdbSnapshot {
  fileName: string;
  /** Inventory of every source table, including tables not yet mapped to PMS entities. */
  tableInventory?: MdbTableSummary[];
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
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function nullableInt(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  const tableRows = new Map<string, Row[]>();
  const tableInventory = tableNames.map((name) => {
    try {
      const rows = db.getTable(name).getData();
      tableRows.set(name, rows);
      return { name, rowCount: rows.length, columns: [...new Set(rows.flatMap((row) => Object.keys(row)))].sort(), readable: true };
    } catch {
      warnings.push('Table « ' + name + ' » présente mais illisible.');
      return { name, rowCount: null, columns: [], readable: false };
    }
  });

  const findTable = (candidateNames: string[]): string | undefined => {
    for (const name of candidateNames) {
      const match = tableNames.find((t) => t.toLowerCase() === name.toLowerCase());
      if (match) return match;
    }
    return undefined;
  };

  const getField = (row: Row, candidateKeys: string[]): unknown => {
    const lowerMap = new Map<string, string>();
    for (const key of Object.keys(row)) lowerMap.set(key.toLowerCase(), key);
    for (const candidate of candidateKeys) {
      const actual = row[candidate] !== undefined ? candidate : lowerMap.get(candidate.toLowerCase());
      if (!actual) continue;
      const value = row[actual];
      // Blank text columns must not mask a populated legacy alias such as RomID.
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) continue;
      return value;
    }
    return undefined;
  };

  const read = (primaryName: string, aliases: string[] = []): Row[] => {
    const match = findTable([primaryName, ...aliases]);
    if (!match) {
      warnings.push(`Table « ${primaryName} » absente du fichier.`);
      return [];
    }
    try {
      return tableRows.get(match) ?? db.getTable(match).getData();
    } catch (error) {
      warnings.push(`Table « ${primaryName} » (${match}) illisible : ${(error as Error).message}`);
      return [];
    }
  };

  const rawBuildings = read('BuildingInfo', ['Building', 'Buildings', 'BldInfo', 'tblBuilding']);
  const buildings: ImportedBuilding[] = rawBuildings.map((r, idx) => {
    const noVal = getField(r, ['BldNo', 'bldno', 'Bld_No', 'BuildingNo', 'BuildingID', 'ID', 'No']);
    const nameVal = getField(r, ['BldName', 'bldname', 'Bld_Name', 'BuildingName', 'Name', 'Description']);
    const buildingNumber = noVal !== undefined ? num(noVal, idx + 1) : idx + 1;
    return {
      no: buildingNumber,
      name: str(nameVal) || `Bâtiment ${buildingNumber}`,
    };
  });

  const rawRooms = read('RoomInfo', ['Room', 'Rooms', 'RomInfo', 'tblRoom']);
  const invalidRoomRows: number[] = [];
  const rooms: ImportedRoom[] = rawRooms.flatMap((r, index) => {
    const rawBld = getField(r, ['BldNo', 'bldno', 'Bld_No', 'BuildingNo', 'Building', 'Bld', 'bld_no']);
    const rawFlr = getField(r, ['FlrNo', 'flrno', 'Flr_No', 'FloorNo', 'Floor', 'Flr', 'flr_no']);
    const rawRoomNo = getField(r, ['RoomNo', 'Room_No', 'RomID2', 'RomID', 'Room', 'RomNo', 'ID']);
    const rawType = getField(r, ['sType', 'stype', 'RoomType', 'Type', 'type']);
    const rawStatus = getField(r, ['Status', 'status']);
    const rawPrice = getField(r, ['Price', 'price', 'Rate', 'rate']);
    const rawCardCount = getField(r, ['CardCount', 'cardcount', 'Card_Count']);
    const rawMaxCards = getField(r, ['MaxCards', 'maxcards', 'Max_Cards']);

    let roomNumberStr = str(rawRoomNo);
    let parsedBld = nullableInt(rawBld);
    let parsedFlr = nullableInt(rawFlr);

    // Use a compound legacy room reference only when a DB dimension is absent.
    // Explicit zero identifiers are valid and must never be overwritten.
    const dashMatch = roomNumberStr.match(/^(\d+)-(\d+)(?:-(\d+))?$/);
    if (dashMatch) {
      if (dashMatch[3]) {
        if (parsedBld === null) parsedBld = Number(dashMatch[1]);
        if (parsedFlr === null) parsedFlr = Number(dashMatch[2]);
        roomNumberStr = dashMatch[3];
      } else {
        if (parsedBld === null) parsedBld = Number(dashMatch[1]);
        roomNumberStr = dashMatch[2];
      }
    }

    // Floor comes only from the explicit FlrNo column (or a dashed room
    // number like "1-2-205") — never inferred here, so rooms without a
    // floor in the DB stay floor-less instead of inventing floor 1.
    // Display-level inference for 3+ digit room numbers lives in
    // resourceItemFromRoom.

    if (!roomNumberStr) {
      invalidRoomRows.push(index + 1);
      return [];
    }
    return [{
      building: parsedBld,
      floor: parsedFlr,
      roomNo: roomNumberStr,
      type: str(rawType),
      status: str(rawStatus),
      price: str(rawPrice),
      cardCount: num(rawCardCount, 0),
      maxCards: num(rawMaxCards, 0),
    }];
  });
  if (invalidRoomRows.length) warnings.push(invalidRoomRows.length + ' ligne(s) RoomInfo sans numéro de chambre exploitable ont été exclues (aucune chambre fictive créée).');

  // Never drop a building that exists in BuildingInfo or is referenced in RoomInfo.
  const buildingByNo = new Map<number, ImportedBuilding>();
  for (const building of buildings) {
    buildingByNo.set(building.no, building);
  }
  for (const room of rooms) {
    if (room.building !== null && !buildingByNo.has(room.building)) {
      buildingByNo.set(room.building, { no: room.building, name: `Bâtiment ${room.building}` });
    }
  }
  const completeBuildings = [...buildingByNo.values()].sort((a, b) => a.no - b.no);

  const rawGuests = read('GuestInfo', ['Guest', 'Guests', 'tblGuest']);
  const guests: ImportedGuest[] = rawGuests.map((r) => ({
    roomNo: str(getField(r, ['BldRoomNo', 'bldroomno', 'RoomNo', 'Room', 'BldRoom'])),
    name: str(getField(r, ['Name', 'name', 'GuestName', 'Customer'])),
    comeTime: toIsoString(getField(r, ['ComeTime', 'cometime', 'CheckIn', 'StartDate', 'Come_Time'])),
    goTime: toIsoString(getField(r, ['GoTime', 'gotime', 'CheckOut', 'EndDate', 'Go_Time'])),
    cardId: str(getField(r, ['CardID', 'cardid', 'CardNo', 'Card_ID'])),
    flag: str(getField(r, ['Flag', 'flag', 'Status', 'State'])),
  }));

  const cards: ImportedCard[] = [];
  let skippedCards = 0;
  for (const row of read('CardInfo', ['Card', 'Cards', 'tblCard'])) {
    const rawData = getField(row, ['CardData', 'carddata', 'Card_Data', 'Data', 'Hex']);
    const hex = normalizeHex(rawData);
    if (!hex) {
      skippedCards += 1;
      continue;
    }
    cards.push({
      id: num(getField(row, ['ID', 'id', 'CardID', 'CardId'])),
      hex,
      holder: str(getField(row, ['Holder', 'holder', 'GuestName', 'Name'])),
      operator: str(getField(row, ['GongHao', 'gonghao', 'Operator', 'User'])),
      status: str(getField(row, ['Status', 'status'])),
      typeIndex: parseInt(hex.slice(18, 20), 16),
    });
  }
  if (skippedCards > 0) warnings.push(`${skippedCards} carte(s) ignorée(s) (CardData vide ou invalide).`);

  const openings = read('RecordOpen', ['Record', 'Records', 'OpenRecord', 'tblRecordOpen']).filter((r) => {
    const rawRec = getField(r, ['RecData', 'recdata', 'Data', 'RecordData']);
    const hex = str(rawRec).toUpperCase();
    return hex.length > 0 && !/^F+$/.test(hex) && !/^0+$/.test(hex);
  }).length;

  return {
    fileName,
    fileLastModified: null,
    importedAt: new Date().toISOString(),
    buildings: completeBuildings,
    rooms,
    guests,
    cards,
    systemProfile: deriveSystemProfile(cards),
    counts: { cards: cards.length, guests: guests.length, rooms: rooms.length, openings },
    warnings,
    tableInventory,
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
  warnings: string[];
} {
  const { rooms, guests } = snapshot;
  const warnings: string[] = [];

  // Building 0 and floor 0 are valid source identifiers. Only null means
  // "missing"; never use truthiness or > 0 to decide whether a dimension exists.
  const buildingByNo = new Map<number, ImportedBuilding>();
  for (const building of snapshot.buildings) {
    if (Number.isFinite(building.no)) buildingByNo.set(building.no, building);
  }
  for (const room of rooms) {
    if (room.building !== null && Number.isFinite(room.building) && !buildingByNo.has(room.building)) {
      buildingByNo.set(room.building, { no: room.building, name: 'Bâtiment ' + room.building });
    }
  }

  const buildings = [...buildingByNo.values()].sort((a, b) => a.no - b.no);
  const roomsByBuilding = new Map<number, ImportedRoom[]>();
  const unassignedRooms: ImportedRoom[] = [];
  for (const room of rooms) {
    if (room.building !== null) {
      const buildingRooms = roomsByBuilding.get(room.building) ?? [];
      buildingRooms.push(room);
      roomsByBuilding.set(room.building, buildingRooms);
    } else {
      unassignedRooms.push(room);
    }
  }

  const resourceGroups: ResourceGroup[] = buildings.map((building) => {
    const name = building.name.trim() || 'Bâtiment ' + building.no;
    return {
      id: 'mdb-bld-' + building.no,
      name: {
        fr: name,
        en: building.name.trim() || 'Building ' + building.no,
        ar: building.name.trim() || 'مبنى ' + building.no,
      },
      sector: 'hotel',
      icon: 'Building',
      resources: (roomsByBuilding.get(building.no) ?? []).map(resourceItemFromRoom),
    };
  });

  if (unassignedRooms.length > 0) {
    resourceGroups.push({
      id: 'mdb-rooms-nobld',
      name: {
        fr: 'Chambres sans bâtiment identifié',
        en: 'Rooms without a building identifier',
        ar: 'غرف دون معرّف مبنى',
      },
      sector: 'hotel',
      icon: 'Building',
      resources: unassignedRooms.map(resourceItemFromRoom),
    });
    warnings.push(unassignedRooms.length + ' chambre(s) source n’ont pas de BldNo exploitable ; elles restent isolées au lieu d’être attribuées arbitrairement.');
  }

  const roomByBuildingAndNo = new Map<string, ImportedRoom[]>();
  const roomsByNo = new Map<string, ImportedRoom[]>();
  for (const room of rooms) {
    const key = normalizeRoomNo(room.roomNo);
    const composite = String(room.building ?? 'unassigned') + ':' + key;
    const byBuilding = roomByBuildingAndNo.get(composite) ?? [];
    byBuilding.push(room);
    roomByBuildingAndNo.set(composite, byBuilding);
    const matches = roomsByNo.get(key) ?? [];
    matches.push(room);
    roomsByNo.set(key, matches);
  }

  const stayByKey = new Map<string, TimelineBooking>();
  const bookings: TimelineBooking[] = [];
  let unresolvedGuests = 0;
  let invalidDateGuests = 0;

  for (const guest of guests) {
    const rawRoomRef = str(guest.roomNo);
    const parts = rawRoomRef.split('-').map((part) => part.trim());
    const compoundRef = parts.length >= 2 && parts.every((part) => /^\\d+$/.test(part));
    const guestBuilding = compoundRef ? Number(parts[0]) : null;
    const guestFloor = compoundRef && parts.length >= 3 ? Number(parts[1]) : null;
    const rawRoomNo = compoundRef
      ? (parts.length >= 3 ? parts.slice(2).join('-') : parts.slice(1).join('-'))
      : rawRoomRef;
    const roomNo = normalizeRoomNo(rawRoomNo);

    const candidates = roomsByNo.get(roomNo) ?? [];
    const buildingMatches = guestBuilding !== null
      ? candidates.filter((candidate) => candidate.building === guestBuilding)
      : candidates;
    let room: ImportedRoom | undefined;
    if (guestFloor !== null) {
      room = buildingMatches.find((candidate) => candidate.floor === guestFloor);
    } else if (guestBuilding !== null) {
      const exact = roomByBuildingAndNo.get(String(guestBuilding) + ':' + roomNo) ?? [];
      room = exact.length === 1 ? exact[0] : undefined;
    } else {
      room = buildingMatches.length === 1 ? buildingMatches[0] : undefined;
    }

    // GuestInfo is not a room master. Never synthesize a room from a guest row.
    if (!room) {
      unresolvedGuests += 1;
      continue;
    }

    const startIso = parseAccessDateTime(guest.comeTime);
    const endIso = parseAccessDateTime(guest.goTime);
    if (!startIso || !endIso) {
      invalidDateGuests += 1;
      continue;
    }
    const startDate = startIso.slice(0, 10);
    const endDate = endIso.slice(0, 10);
    if (endDate <= startDate) {
      invalidDateGuests += 1;
      continue;
    }

    const resourceId = 'mdb-rm-' + (room.building === null ? 'unassigned' : room.building) + '-' + normalizeRoomNo(room.roomNo);
    const price = parsePrice(room.price);
    const flag = guest.flag || '';
    const status: TimelineBooking['status'] = /check.?out/i.test(flag)
      ? 'checked_out'
      : /copy/i.test(flag)
        ? 'confirmed'
        : /walk.?in|check.?in|arriv/i.test(flag)
          ? 'checked_in'
          : 'confirmed';
    const key = String(room.building ?? '') + ':' + String(room.floor ?? '') + ':' + roomNo + '|' + startIso + '|' + guest.name;
    const existing = stayByKey.get(key);
    if (existing) {
      if (endDate > existing.endDate) existing.endDate = endDate;
      const copies = Number(existing.customMetadata?.copies ?? 1) + 1;
      existing.customMetadata = { ...existing.customMetadata, copies };
      continue;
    }

    const booking: TimelineBooking = {
      id: 'mdb-bkg-' + (room.building ?? 'unknown') + '-' + roomNo + '-' + startDate + '-' + (bookings.length + 1),
      resourceId,
      resourceName: room.roomNo,
      sector: 'hotel',
      guestName: guest.name || 'Client',
      guestEmail: '',
      guestPhone: '',
      startDate,
      endDate,
      status,
      totalPrice: price,
      paymentStatus: 'pending',
      notes: 'Importé de CardLock.mdb — carte ' + (guest.cardId || '—') + ', flag: ' + (flag || '—'),
      color: '#2563eb',
      adults: 1,
      customMetadata: {
        source: 'cardlock_mdb',
        cardId: guest.cardId,
        flag,
        roomType: room.type,
        building: room.building,
        floor: room.floor,
        originalPrice: room.price,
        cardCount: room.cardCount,
        maxCards: room.maxCards,
      },
    };
    stayByKey.set(key, booking);
    bookings.push(booking);
  }

  if (unresolvedGuests) warnings.push(unresolvedGuests + ' séjour(s) GuestInfo ne correspondent à aucune ligne RoomInfo sans ambiguïté ; aucun logement n’a été créé à partir de ces séjours.');
  if (invalidDateGuests) warnings.push(invalidDateGuests + ' séjour(s) GuestInfo ignoré(s) : date d’arrivée/de départ absente, invalide ou intervalle nul.');
  return { resourceGroups, bookings, warnings };
}

function resourceItemFromRoom(r: ImportedRoom): ResourceItem {
  const normalizedRoomNo = normalizeRoomNo(r.roomNo);
  const status = r.status.trim().toLowerCase();
  const housekeepingStatus: ResourceItem['housekeepingStatus'] =
    status === 'clean' || status === 'propre' ? 'clean'
      : status === 'dirty' || status === 'sale' ? 'dirty'
        : status === 'cleaning' || status === 'in cleaning' || status === 'en nettoyage' ? 'cleaning'
          : status === 'out_of_order' || status === 'out of order' || status === 'hs' ? 'out_of_order'
            : undefined;

  return {
    id: 'mdb-rm-' + (r.building === null ? 'unassigned' : r.building) + '-' + normalizedRoomNo,
    name: r.roomNo,
    type: r.type || 'Type non renseigné',
    sector: 'hotel',
    pricePerDay: parsePrice(r.price),
    ...(housekeepingStatus ? { housekeepingStatus } : {}),
    capacity: 1,
    ...(r.building !== null ? { building: String(r.building) } : {}),
    ...(r.floor !== null ? { floor: String(r.floor) } : {}),
  };
}

function parsePrice(value: string): number {
  const n = parseFloat(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
