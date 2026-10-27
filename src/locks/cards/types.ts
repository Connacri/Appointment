/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Hotel Lock System - Card Types & Domain Interfaces
 * Covers all 13 official proUSB card families decoded in the reverse engineering dossier.
 */

export type ProUsbCardType =
  | 'reset'       // 0x00: Lock reset / Initialization card (IniCard / ResetCard)
  | 'hard_reset'  // 0x00: Hard persistent reset — admin-only, overrides any existing config
  | 'record'      // 0x10: Audit readout / Record collection card
  | 'room_set'    // 0x20: Step 2: Set Room Number in Lock
  | 'time_set'    // 0x30: Step 3: Set Lock Clock & Calendar
  | 'limit'       // 0x40: Access limit / time restriction card
  | 'group_set'   // 0x50: Lock group association card
  | 'guest'       // 0x60: Guest room card (client stay card)
  | 'checkout'    // 0x70: Check-out revocation card
  | 'group'       // 0x80: Group master pass
  | 'emergency'   // 0xA0: Emergency pass (opens deadbolt)
  | 'master'      // 0xB0: Hotel master card (opens all rooms)
  | 'building'    // 0xC0: Building pass (opens all rooms in building)
  | 'floor';      // 0xD0: Floor pass (opens all rooms on floor)

export interface ProUsbCardTypeMeta {
  type: ProUsbCardType;
  typeFamilyByte: number; // e.g. 0x60 for guest, 0xB0 for master
  label: { fr: string; en: string; ar: string };
  description: { fr: string; en: string; ar: string };
  badgeColor: string;
  isStaffCard: boolean;
  isCommissioningCard: boolean;
}

export const PROUSB_CARD_TYPES: Record<ProUsbCardType, ProUsbCardTypeMeta> = {
  guest: {
    type: 'guest',
    typeFamilyByte: 0x60,
    label: { fr: 'Carte Client (Guest)', en: 'Guest Card', ar: 'بطاقة النزيل' },
    description: { fr: 'Accès chambre selon dates et heures d\'arrivée et départ', en: 'Room access matching check-in and check-out window', ar: 'دخول الغرفة حسب تواريخ الإقامة' },
    badgeColor: 'emerald',
    isStaffCard: false,
    isCommissioningCard: false,
  },
  master: {
    type: 'master',
    typeFamilyByte: 0xb0,
    label: { fr: 'Carte Maître (Master)', en: 'Master Card', ar: 'بطاقة الماستر العامة' },
    description: { fr: 'Passe-partout général ouvrant toutes les chambres de l\'établissement', en: 'Master key opening all rooms in establishment', ar: 'تفتح جميع غرف المنشأة' },
    badgeColor: 'purple',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  floor: {
    type: 'floor',
    typeFamilyByte: 0xd0,
    label: { fr: 'Carte Étage (Floor)', en: 'Floor Card', ar: 'بطاقة الطابق' },
    description: { fr: 'Ouvre toutes les chambres d\'un étage sélectionné', en: 'Opens all rooms on designated floor', ar: 'تفتح جميع غرف طابق محدد' },
    badgeColor: 'blue',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  building: {
    type: 'building',
    typeFamilyByte: 0xc0,
    label: { fr: 'Carte Bâtiment (Building)', en: 'Building Card', ar: 'بطاقة المبنى' },
    description: { fr: 'Ouvre toutes les chambres d\'un bâtiment entier', en: 'Opens all rooms in an entire building', ar: 'تفتح جميع غرف مبنى كامل' },
    badgeColor: 'indigo',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  emergency: {
    type: 'emergency',
    typeFamilyByte: 0xa0,
    label: { fr: 'Carte Urgence (Emergency)', en: 'Emergency Card', ar: 'بطاقة الطوارئ' },
    description: { fr: 'Déverrouillage d\'urgence immédiat outrepassant le pêne dormant intérieur', en: 'Emergency unlock overriding internal deadbolt', ar: 'فتح طارئ فوري متجاوز للترباس الداخلي' },
    badgeColor: 'rose',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  group: {
    type: 'group',
    typeFamilyByte: 0x80,
    label: { fr: 'Carte Groupe (Group)', en: 'Group Card', ar: 'بطاقة المجموعة' },
    description: { fr: 'Accès simultané à plusieurs chambres définies dans le même groupe', en: 'Access to multiple rooms linked in a designated group', ar: 'دخول لعدة غرف محددة ضمن مجموعة' },
    badgeColor: 'cyan',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  checkout: {
    type: 'checkout',
    typeFamilyByte: 0x70,
    label: { fr: 'Carte Check-Out', en: 'Check-Out Card', ar: 'بطاقة المغادرة' },
    description: { fr: 'Invalide immédiatement la carte précédente dans la serrure', en: 'Immediately revokes prior guest card in lock', ar: 'إلغاء فوري لصلاحية بطاقة النزيل السابقة' },
    badgeColor: 'amber',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  limit: {
    type: 'limit',
    typeFamilyByte: 0x40,
    label: { fr: 'Carte Limite (Limit)', en: 'Limit Card', ar: 'بطاقة التقييد' },
    description: { fr: 'Restreint les horaires ou la validité d\'accès d\'une serrure', en: 'Restricts access times or validity on a lock', ar: 'تقييد ساعات أو صلاحية الدخول' },
    badgeColor: 'slate',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  group_set: {
    type: 'group_set',
    typeFamilyByte: 0x50,
    label: { fr: 'Carte Config Groupe', en: 'Group Setting Card', ar: 'بطاقة إعداد المجموعة' },
    description: { fr: 'Programme le code groupe dans la serrure', en: 'Programs group association into lock', ar: 'برمجة رمز المجموعة في القفل' },
    badgeColor: 'teal',
    isStaffCard: true,
    isCommissioningCard: true,
  },
  room_set: {
    type: 'room_set',
    typeFamilyByte: 0x20,
    label: { fr: 'Carte N° Chambre (RoomSet)', en: 'Room Set Card', ar: 'بطاقة تعيين رقم الغرفة' },
    description: { fr: 'Étape 2 de mise en service : affecte le N° de chambre à la serrure', en: 'Step 2 of lock setup: assigns room number to lock', ar: 'المرحلة 2: تعيين رقم الغرفة في القفل' },
    badgeColor: 'orange',
    isStaffCard: false,
    isCommissioningCard: true,
  },
  time_set: {
    type: 'time_set',
    typeFamilyByte: 0x30,
    label: { fr: 'Carte Horloge (TimeSet)', en: 'Clock Set Card', ar: 'بطاقة ضبط الساعة' },
    description: { fr: 'Étape 3 de mise en service : synchronise l\'horloge interne de la serrure', en: 'Step 3 of lock setup: synchronizes internal lock clock', ar: 'المرحلة 3: ضبط ساعة وتاريخ القفل' },
    badgeColor: 'sky',
    isStaffCard: false,
    isCommissioningCard: true,
  },
  record: {
    type: 'record',
    typeFamilyByte: 0x10,
    label: { fr: 'Carte Journal (Record)', en: 'Audit Record Card', ar: 'بطاقة سجل التدقيق' },
    description: { fr: 'Relève l\'historique d\'ouvertures et passages de la serrure', en: 'Retrieves audit trail of openings from lock', ar: 'استخراج سجل الفتح والعمليات من القفل' },
    badgeColor: 'violet',
    isStaffCard: true,
    isCommissioningCard: false,
  },
  hard_reset: {
    type: 'hard_reset',
    typeFamilyByte: 0x00,
    label: { fr: 'Reset Persistant (Hard Reset)', en: 'Persistent Hard Reset', ar: 'إعادة ضبط ثابتة' },
    description: { fr: 'Réinitialisation persistante et irréversible de la serrure — réservé aux administrateurs. Outrepasse toute configuration existante.', en: 'Persistent and irreversible lock reset — admin only. Overrides any existing configuration.', ar: 'إعادة ضبط ثابتة لا رجعة فيها — للمسؤولين فقط. تتجاوز أي إعدادات موجودة.' },
    badgeColor: 'red',
    isStaffCard: true,
    isCommissioningCard: true,
  },
  reset: {
    type: 'reset',
    typeFamilyByte: 0x00,
    label: { fr: 'Carte Reset (IniCard)', en: 'Lock Reset Card', ar: 'بطاقة إعادة ضبط القفل' },
    description: { fr: 'Étape 1 de mise en service : réinitialise la serrure en paramètres d\'usine', en: 'Step 1 of lock setup: factory resets lock memory', ar: 'المرحلة 1: إعادة ضبط مصنع لذاكرة القفل' },
    badgeColor: 'rose',
    isStaffCard: false,
    isCommissioningCard: true,
  },
};

export interface CardValidityWindow {
  startYear: number;  // 2026
  startMonth: number; // 1-12
  startDay: number;   // 1-31
  startHour: number;  // 0-23
  startMinute?: number; // 0-59 (real issue time, e.g. 12:21 on CardInfo records)
  endYear: number;    // 2026
  endMonth: number;   // 1-12
  endDay: number;     // 1-31
  endHour: number;    // 0-23
  endMinute?: number; // 0-59 (usually 00 or 59)
}

export interface DecodedProUsbCard {
  rawHex: string;
  type: ProUsbCardType;
  cardIndex: number;
  /** Raw byte [9] — family nibble plus type/index nibble. */
  rawTypeIndex?: number;
  /**
   * True when bytes [0..1] are the proUSB record magic `C9 12`. When false the
   * card belongs to another system: only the raw bytes are meaningful and no
   * field is interpreted (nothing is invented).
   */
  isProUsbFormat?: boolean;
  /** Raw bytes exactly as read (padded to 16 when the frame was shorter). */
  bytes?: number[];
  /** Number of bytes actually returned by the encoder before padding. */
  bytesReceived?: number;
  /** Bytes [4..5] — site complement (system) / access marker (guest). */
  marker?: [number, number];
  /** Bytes [6..8] — family header (system) or floor/building/options. */
  header?: [number, number, number];
  /** Bytes [13..15] — random padding (system) or end-of-stay stamp. */
  tail?: [number, number, number];
  /** Anomalies found while decoding (unknown format, bad complement, bad date…). */
  notes?: string[];
  siteCode: string; // 24-bit site/serial e.g. "C912" + low 14 bits
  /** 16-bit site code (bytes [2..3], big-endian) — the value locks compare. */
  siteValue?: number;
  /** True when the card carries the wildcard site `0000` (universal card). */
  isUniversalSite?: boolean;
  /**
   * System cards only: bytes [4..5] equal the bitwise complement of the site
   * (the integrity check `ResetCard` writes). `false` means a corrupted or
   * hand-edited record.
   */
  siteComplementOk?: boolean;
  /**
   * System cards only: the record has **no expiry date**. Bytes [13..15] are
   * random padding, so `validity.end*` mirrors the issue date.
   */
  endIsUnknown?: boolean;
  buildingNo?: number;
  floorNo?: number;
  roomNumber?: string;
  roomMod100?: number;
  roomDiv100?: number;
  validity?: CardValidityWindow;
  options: {
    allowDeadbolt: boolean;      // Can unlock if internal deadbolt is thrown
    coverCardsBefore: boolean;   // Invalidate previous cards for this room
    openPublicDoor: boolean;     // Access communal entrance doors
  };
  holderName?: string;
  operatorId?: string;
  issuedAt?: string;
}

export interface LockAuditRecord {
  orderFlag: number;           // 0..32 (index in lock memory)
  recDataHex: string;          // 8 bytes hex representation from lock
  openTime: string;            // ISO formatted timestamp
  eventType: 'guest_open' | 'master_open' | 'emergency_open' | 'key_open' | 'deadbolt_forced' | 'invalid_card';
  cardIdentifier?: string;
  roomNo?: string;
}

export interface ProUsbLockSettings {
  companyName: string;
  hotelName: string;
  skin: string;
  checkoutTime: string;    // e.g. "12:00:00"
  vipCheckoutTime: string; // e.g. "14:00:00"
  guestAccessBolt: boolean; // GuestLLock = 1
  alarmForcedPin: boolean;  // BaoJing = 128
  remindCloseDoor: boolean; // TiShi = 152
  dontDisturbMode: boolean;
  lockAfterReleaseKnob: boolean;
  ignoreCoverFunction: boolean;
  defaultBuildingNo: number;
}
