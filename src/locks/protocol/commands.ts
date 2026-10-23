/**
 * Verified command frames for the proUSB encoder.
 *
 * Every constant below was observed on the owned reader
 * (USB\VID_9915&PID_1116\READER_0000016, firmware 0x0120) and is reproduced
 * byte-for-byte from the vendor DLL. Anything not verified on hardware is
 * deliberately absent rather than guessed.
 *
 * Reference: docs/re-proUSB/CARD-API.md §5 (commands) and §7 (card area).
 */

import { buildFrame } from './frames.ts';

/** Opcodes, as sent in the third byte of a host frame. */
export const Op = {
  /** `Buzzer(port, level)` — audible feedback. */
  Buzzer: 0x80,
  /** `IniCard(port, mode)` — commissioning card. */
  IniCard: 0x96,
  /** `IniCard1` consecutive modes, see {@link iniCard}. */
  IniCardAlt1: 0x69,
  IniCardAlt2: 0x56,
  /** `ReadCard` — reads the 20-byte card area. */
  ReadCard: 0xe4,
  /** `WriteCard` — writes the record (16 or 32 bytes). */
  WriteCard: 0xec,
  /** `ReadRecord` — streams the lock opening log. */
  ReadRecord: 0x82,
  /** `ReadE2` — reads 32 bytes from the lock EEPROM. */
  ReadE2: 0x47,
} as const;

/** Commissioning steps accepted by `IniCard`. */
export const IniMode = {
  /** `AA 01 96 3D` */
  Step0: 0,
  /** `AA 01 69 C2` */
  Step1: 1,
  /** `AA 01 56 FD` */
  Step2: 2,
} as const;

export type IniModeValue = (typeof IniMode)[keyof typeof IniMode];

/** Card area returned by `ReadCard`: 16-byte record + 4-byte reader trailer. */
export const CARD_AREA_BYTES = 20;

/** Bytes of record returned by `ReadE2`. */
export const E2_CHUNK_BYTES = 32;

/** `ReadCard` — `AA 01 E4 4F`, answered with `55 15 01 <20 bytes> <xor>`. */
export function readCard(): Uint8Array {
  return buildFrame(Op.ReadCard);
}

/** `Buzzer` — `AA 02 80 <level> <level ^ 0x28>`. */
export function buzzer(level: boolean | 0 | 1): Uint8Array {
  return buildFrame(Op.Buzzer, [level ? 0x01 : 0x00]);
}

/**
 * `WriteCard` — `AA 11 EC <16 bytes> <xor>` or `AA 21 EC <32 bytes> <xor>`.
 *
 * The 16-byte form is the one verified end to end: the card reads back the
 * exact record. The reader never replies to `0xEC`, so callers must confirm a
 * write by reading the card back.
 */
export function writeCard(record: Uint8Array): Uint8Array {
  if (record.length !== 16 && record.length !== 32) {
    throw new RangeError(`record must be 16 or 32 bytes, got ${record.length}`);
  }
  return buildFrame(Op.WriteCard, Array.from(record));
}

/** `IniCard` — the three commissioning frames. */
export function iniCard(mode: IniModeValue): Uint8Array {
  switch (mode) {
    case IniMode.Step0:
      return buildFrame(Op.IniCard);
    case IniMode.Step1:
      return buildFrame(Op.IniCardAlt1);
    case IniMode.Step2:
      return buildFrame(Op.IniCardAlt2);
    default: {
      const never: never = mode;
      throw new RangeError(`unknown IniCard mode: ${String(never)}`);
    }
  }
}

/** `ReadRecord` — `AA 01 82 29`. The reader streams 37-byte packets. */
export function readRecord(): Uint8Array {
  return buildFrame(Op.ReadRecord);
}

/** `ReadE2` — `AA 02 47 <address> <address ^ 0xEF>`. */
export function readE2(address: number): Uint8Array {
  if (!Number.isInteger(address) || address < 0 || address > 0xff) {
    throw new RangeError(`EEPROM address out of range: ${address}`);
  }
  return buildFrame(Op.ReadE2, [address]);
}
