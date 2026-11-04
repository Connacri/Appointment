/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * proUSB encoder identification (reader info).
 *
 * Reversed from CardLock.Exe (proUSBHotelLockSystem):
 *
 *   `IniCard(port, 2, out)` writes the 64-byte frame `AA 01 56 FD` (padded with
 *   `0xCC`, exactly like the OEM DLL) and reads a raw 64-byte HID report.
 *   proRFL then hex-encodes the first 36 bytes and CardLock parses that hex
 *   string: the encoder answers with an ASCII identification block such as
 *   `-proUSB 016 ...` where `016` is the encoder number.
 *
 *   CardLock locates the ASCII marker `-proUSB` (`2D70726F555342`) in the hex
 *   string and reads, relative to it (offsets are hex characters, two per
 *   byte, and string positions are 1-based like Delphi's `Copy`):
 *     +0x0E (2 chars)  separator - `20` (space) in the standard layout
 *     +0x10 (6 chars)  encoder number, three ASCII digits (`30 31 36` -> "016")
 *     +0x1C (4 chars)  `9099` marks a legal (authorized) encoder
 *   When the separator is not a space, or when the encoder answers with the
 *   `-proEM` / `EM4305-` / `M9-` families, a 12-character number is read
 *   instead (`32` branch and EM4305 branch of the original routine).
 *
 *   Independently of the marker, the registration screen shows the
 *   **machine code** ("Current Reader No.") of the reader: `Copy(hex, 11, 8)`,
 *   i.e. bytes 5..8 of the identification block (`50 12 14 D2` -> `501214D2`).
 *   `50 12` is a constant vendor prefix; the following bytes are the unique
 *   reader serial. CardLock stores the same value at the head of `SerialNo2`
 *   in `Reg.ini`.
 *
 * Nothing here is guessed: every offset maps to an instruction of the routine
 * at `CardLock.Exe` VA 0x6CD924 (marker) and VA 0x6D8644/0x6D8660 (machine
 * code, `Copy(hex, 11, 8)`).
 */

import { toHex } from './frames';
import { LockTransport, TransportError, withDeviceLock } from './transport';

/** Hex encoding of the ASCII marker `-proUSB` (the proUSB reader family). */
export const READER_INFO_MARKER = '2D70726F555342';

/** Alternative reader families understood by the OEM parser. */
const READER_INFO_ALTERNATE_MARKERS = ['454D343330352D', '2D70726F454D', '4D392D'] as const;

const LEGAL_MARKER_HEX = '9099';
const SPACE_HEX = '20';
const DIGIT_MARKER_HEX = '32';

/** Delphi `Copy(reportHex, 11, 8)`: machine code starts at byte 5 (0-based). */
const MACHINE_CODE_POSITION = 11;
const MACHINE_CODE_LENGTH = 8;

/** Identification command for `IniCard` mode 2 (`AA 01 56 FD`). */
export const READER_INFO_COMMAND = [0xaa, 0x01, 0x56, 0xfd] as const;

export interface ReaderInfo {
  /** Encoder number reported by the hardware (e.g. `16` for `Reader_000016`). */
  encoderNo: number | null;
  /** True when the encoder reports the `9099` authorization marker. */
  legal: boolean;
  /** Marker that matched (`-proUSB`, `-proEM`, `EM4305-`, `M9-`). */
  marker: string;
  /**
   * Machine code of the reader ("Current Reader No." in CardLock), 8 uppercase
   * hex characters such as `501214D2`. This is the value `Reg.ini` stores at
   * the beginning of `SerialNo2`.
   */
  machineCode: string | null;
  /** Printable ASCII identification text carried by the report. */
  text: string;
  /** Full uppercase hex dump of the identification report. */
  reportHex: string;
}

/**
 * Builds the 64-byte identification request the OEM DLL sends for `IniCard`
 * mode 2. Trailing bytes are `0xCC` filler, as observed in `proRFL!IniCard`.
 */
export function readerInfoRequest(): Uint8Array {
  const frame = new Uint8Array(64).fill(0xcc);
  frame.set(READER_INFO_COMMAND, 0);
  return frame;
}

/** Formats an encoder number the way proUSB does (`%.6d`). */
export function formatReaderLabel(encoderNo: number | null | undefined): string | null {
  if (encoderNo === null || encoderNo === undefined || !Number.isFinite(encoderNo)) {
    return null;
  }
  return `Reader_${Math.trunc(encoderNo).toString().padStart(6, '0')}`;
}

/**
 * Groups a machine code the way it is read on the encoder label:
 * `501214D2` -> `5012 14D2` (two 16-bit words).
 */
export function formatMachineCode(machineCode: string | null | undefined): string | null {
  if (!machineCode || !/^[0-9A-F]{8}$/.test(machineCode)) return null;
  return `${machineCode.slice(0, 4)} ${machineCode.slice(4)}`;
}

function hexToText(hex: string): string {
  let text = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16);
    if (!Number.isFinite(code)) return text;
    text += String.fromCharCode(code);
  }
  return text;
}

/** Delphi `Copy(hex, position, count)` on a hex string (1-based positions). */
function copyHex(hex: string, position: number, count: number): string {
  const start = position - 1;
  if (start < 0) return '';
  return hex.slice(start, start + count);
}

/**
 * Parses an identification report. Returns `null` when the report does not
 * carry a known reader marker (for instance a command acknowledgement).
 */
export function parseReaderInfo(report: Uint8Array): ReaderInfo | null {
  if (!report || report.length < 8) return null;

  const reportHex = toHex(report);
  let markerHex: string | null = null;
  let position = reportHex.indexOf(READER_INFO_MARKER);
  if (position >= 0) {
    markerHex = READER_INFO_MARKER;
  } else {
    for (const candidate of READER_INFO_ALTERNATE_MARKERS) {
      const found = reportHex.indexOf(candidate);
      if (found >= 0) {
        position = found;
        markerHex = candidate;
        break;
      }
    }
  }
  if (!markerHex || position < 0) return null;

  // CardLock works with 1-based string positions.
  const markerPosition = position + 1;
  const separator = copyHex(reportHex, markerPosition + 0x0e, 2);
  const numberHex =
    markerHex === READER_INFO_MARKER && separator === SPACE_HEX
      ? copyHex(reportHex, markerPosition + 0x10, 6)
      : separator === DIGIT_MARKER_HEX
        ? copyHex(reportHex, markerPosition + 0x12, 12)
        : copyHex(reportHex, markerPosition + 0x0e, 12);

  const digits = hexToText(numberHex).replace(/\D/g, '');
  const encoderNo = digits ? Number.parseInt(digits, 10) : null;
  const machineCodeHex = copyHex(reportHex, MACHINE_CODE_POSITION, MACHINE_CODE_LENGTH);
  const machineCode = machineCodeHex.length === MACHINE_CODE_LENGTH ? machineCodeHex : null;

  return {
    encoderNo: encoderNo !== null && Number.isFinite(encoderNo) ? encoderNo : null,
    legal: copyHex(reportHex, markerPosition + 0x1c, 4) === LEGAL_MARKER_HEX,
    marker: hexToText(markerHex),
    machineCode,
    text: hexToText(reportHex).replace(/[^\x20-\x7e]/g, '.'),
    reportHex,
  };
}

/**
 * Asks the physical encoder to identify itself. Serialized with every other
 * device exchange so a concurrent command cannot consume the answer.
 */
export async function readReaderInfo(
  transport: LockTransport,
  timeoutMs = 2000
): Promise<ReaderInfo | null> {
  if (!transport.isPhysical) return null;

  return withDeviceLock(async () => {
    if (!transport.isOpen()) {
      throw new TransportError('Encoder is not connected.');
    }

    transport.drain?.();
    await transport.send(readerInfoRequest());

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const report = await transport.receive(Math.max(150, deadline - Date.now()));
      if (!report) break;
      const info = parseReaderInfo(report);
      if (info) {
        const detail = [
          info.marker,
          info.machineCode ? `machine ${formatMachineCode(info.machineCode)}` : null,
        ]
          .filter(Boolean)
          .join(', ');
        transport.onLog?.('info', `Encodeur identifié : ${info.text.trim()} (${detail})`, report);
        return info;
      }
    }

    transport.onLog?.('error', "L'encodeur n'a pas renvoyé son numéro de lecteur (IniCard 0x56).");
    return null;
  });
}
