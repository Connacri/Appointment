/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Verified Command Builders
 * Hardware-tested against proUSB-TEMIC encoder (Reader_0000016).
 */

import { buildFrame } from './frames';

export const Op = {
  Buzzer: 0x80,
  IniCard0: 0x96,
  IniCard1: 0x69,
  IniCard2: 0x56,
  ReadCard: 0xe4,
  WriteCard: 0xec,
  ReadRecord: 0x82,
  ReadE2: 0x47,
} as const;

export const IniMode = {
  Step0: 0, // AA 01 96 3D
  Step1: 1, // AA 01 69 C2
  Step2: 2, // AA 01 56 FD
} as const;

export type IniModeValue = (typeof IniMode)[keyof typeof IniMode];

export const CARD_AREA_BYTES = 20; // 16 bytes record + 4 bytes trailer computed by reader
export const RECORD_BYTES = 16;
export const E2_CHUNK_BYTES = 32;

/**
 * Builds the ReadCard command: AA 01 E4 4F
 * Returns 55 15 01 <20 bytes card data> <checksum>
 */
export function readCard(): Uint8Array {
  return buildFrame(Op.ReadCard);
}

/**
 * Builds the Buzzer command: AA 02 80 <level> <level ^ 0x28>
 * level = true (1) -> AA 02 80 01 29
 * level = false (0) -> AA 02 80 00 28
 */
export function buzzer(level: boolean | 0 | 1): Uint8Array {
  return buildFrame(Op.Buzzer, [level ? 0x01 : 0x00]);
}

/**
 * Builds the WriteCard command:
 * For 16-byte record: AA 11 EC <16 bytes> <checksum> (20 bytes total, verified on hardware)
 * For 32-byte payload: AA 21 EC <32 bytes> <checksum> (36 bytes total, zero-padded)
 */
export function writeCard(record: Uint8Array): Uint8Array {
  if (record.length !== 16 && record.length !== 32) {
    throw new RangeError(`Record must be exactly 16 or 32 bytes (got ${record.length})`);
  }
  return buildFrame(Op.WriteCard, Array.from(record));
}

/**
 * Builds the IniCard / Reset command for lock commissioning:
 * - mode 0: AA 01 96 3D
 * - mode 1: AA 01 69 C2
 * - mode 2: AA 01 56 FD
 */
export function iniCard(mode: IniModeValue = IniMode.Step0): Uint8Array {
  switch (mode) {
    case IniMode.Step0:
      return buildFrame(Op.IniCard0);
    case IniMode.Step1:
      return buildFrame(Op.IniCard1);
    case IniMode.Step2:
      return buildFrame(Op.IniCard2);
    default:
      return buildFrame(Op.IniCard0);
  }
}

/**
 * Builds the ReadRecord command: AA 01 82 29
 * Used to stream the audit log from a Record card
 */
export function readRecord(): Uint8Array {
  return buildFrame(Op.ReadRecord);
}

/**
 * Builds the ReadE2 command: AA 02 47 <addr> <addr ^ 0xEF>
 * Reads 32 bytes from EEPROM at address
 */
export function readE2(address: number): Uint8Array {
  if (!Number.isInteger(address) || address < 0 || address > 0xff) {
    throw new RangeError(`EEPROM address out of range (0-255): ${address}`);
  }
  return buildFrame(Op.ReadE2, [address & 0xff]);
}
