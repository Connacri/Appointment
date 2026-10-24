/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Hotel Lock System - Binary Frame Protocol
 * Implements verified proUSB HID encoder protocol:
 * - Vendor ID: 0x9915, Product ID: 0x1116 (proUSB-TEMIC Reader_0000016)
 * - Request Frame: AA <length> <command> <payload...> <checksum>
 * - Response Frame: 55 <length> <status> <data...> <checksum>
 * - Checksum: XOR of all bytes preceding the checksum (including AA / 55)
 */

export const FRAME_START = 0xaa;
export const RESPONSE_START = 0x55;
export const MAX_PAYLOAD = 0xff - 1;

export class FrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameError';
  }
}

export class ChecksumError extends FrameError {
  readonly expected: number;
  readonly actual: number;

  constructor(expected: number, actual: number) {
    super(`Checksum mismatch: expected 0x${expected.toString(16).padStart(2, '0')}, got 0x${actual.toString(16).padStart(2, '0')}`);
    this.name = 'ChecksumError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Computes the XOR checksum of bytes in range [from, to)
 */
export function xorChecksum(bytes: ArrayLike<number>, from = 0, to = bytes.length): number {
  let value = 0;
  for (let i = from; i < to; i += 1) {
    value ^= bytes[i] & 0xff;
  }
  return value & 0xff;
}

/**
 * Builds a validated proUSB host-to-reader frame
 */
export function buildFrame(command: number, payload: readonly number[] = []): Uint8Array {
  if (!Number.isInteger(command) || command < 0 || command > 0xff) {
    throw new RangeError(`Invalid command byte: ${command}`);
  }
  if (payload.length > MAX_PAYLOAD) {
    throw new RangeError(`Payload too long: ${payload.length} > ${MAX_PAYLOAD}`);
  }

  const length = payload.length + 1;
  const frame = new Uint8Array(length + 3);
  frame[0] = FRAME_START;
  frame[1] = length;
  frame[2] = command;
  for (let i = 0; i < payload.length; i += 1) {
    frame[3 + i] = payload[i] & 0xff;
  }
  frame[frame.length - 1] = xorChecksum(frame, 0, frame.length - 1);
  return frame;
}

export interface LockResponse {
  status: number;
  data: Uint8Array;
  length: number;
  frameLength: number;
  raw: Uint8Array;
}

/**
 * Parses and validates a response buffer from the encoder
 */
export function parseResponse(bytes: Uint8Array): LockResponse {
  if (bytes.length < 4) {
    throw new FrameError(`Response too short: ${bytes.length} bytes`);
  }

  // Handle optional report ID prefix (0x00) if passed raw from HID
  let offset = 0;
  if (bytes[0] === 0x00 && bytes.length > 4 && bytes[1] === RESPONSE_START) {
    offset = 1;
  }

  if (bytes[offset] !== RESPONSE_START) {
    throw new FrameError(`Bad response start byte: 0x${bytes[offset].toString(16).padStart(2, '0')} (expected 0x55)`);
  }

  const length = bytes[offset + 1];
  if (length < 1) {
    throw new FrameError(`Invalid response length byte: 0x${length.toString(16).padStart(2, '0')}`);
  }

  const frameLength = length + 3;
  if (bytes.length - offset < frameLength) {
    throw new FrameError(`Truncated response: need ${frameLength} bytes, got ${bytes.length - offset}`);
  }

  const expectedChecksum = xorChecksum(bytes, offset, offset + frameLength - 1);
  const actualChecksum = bytes[offset + frameLength - 1];
  if (expectedChecksum !== actualChecksum) {
    throw new ChecksumError(expectedChecksum, actualChecksum);
  }

  return {
    status: bytes[offset + 2],
    data: bytes.slice(offset + 3, offset + frameLength - 1),
    length,
    frameLength,
    raw: bytes.slice(offset, offset + frameLength),
  };
}

export function tryParseResponse(bytes: Uint8Array): LockResponse | null {
  try {
    return parseResponse(bytes);
  } catch {
    return null;
  }
}

export function isAccepted(response: LockResponse): boolean {
  return response.status === 0x01;
}

export function toHex(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += (bytes[i] & 0xff).toString(16).padStart(2, '0');
  }
  return out.toUpperCase();
}

export function toHexFormatted(bytes: ArrayLike<number>): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    parts.push((bytes[i] & 0xff).toString(16).padStart(2, '0').toUpperCase());
  }
  return parts.join(' ');
}

export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/[\s:_-]/g, '').toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new FrameError(`Odd hex string length: ${clean.length}`);
  }
  if (!/^[0-9a-f]*$/.test(clean)) {
    throw new FrameError('Invalid hex characters');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
