/**
 * proUSB reader frame grammar.
 *
 * The encoder is a vendor-defined HID device (VID 0x9915 / PID 0x1116) that
 * speaks a tiny binary protocol over 65-byte reports.
 *
 * Command frame
 *   AA | n | cmd | payload[n-1] | xor
 *   n         = payload.length + 1
 *   xor       = XOR of every preceding byte
 *
 * Response frame
 *   55 | n | status | data[n-1] | xor
 *   n         = data.length + 1
 *   xor       = XOR of every preceding byte
 *
 * The reader pads reports with 0xFF, so a response is always read from the
 * declared length and never from the transport buffer size.
 *
 * Reference: docs/re-proUSB/CARD-API.md §5 and §6.
 *
 * This module is pure: no DOM, no hardware, no React. It must stay testable
 * in Node and safe to import anywhere.
 */

/** First byte of every host-to-reader frame. */
export const FRAME_START = 0xaa;

/** First byte of every reader-to-host frame. */
export const RESPONSE_START = 0x55;

/** Largest frame accepted by the reader (one 64-byte HID report + marker). */
export const MAX_PAYLOAD = 0xff - 1;

/** A response that cannot be decoded into a valid frame. */
export class FrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameError';
  }
}

/** A response whose checksum does not match its content. */
export class ChecksumError extends FrameError {
  readonly expected: number;
  readonly actual: number;

  constructor(expected: number, actual: number) {
    super(`checksum mismatch: expected 0x${hex(expected)}, got 0x${hex(actual)}`);
    this.name = 'ChecksumError';
    this.expected = expected;
    this.actual = actual;
  }
}

/** XOR of `bytes[from, to)`. This is the only checksum the reader uses. */
export function xorChecksum(bytes: ArrayLike<number>, from = 0, to = bytes.length): number {
  let value = 0;
  for (let i = from; i < to; i += 1) value ^= bytes[i] & 0xff;
  return value & 0xff;
}

/**
 * Build a host-to-reader frame.
 *
 * `buildFrame(0xe4)` -> `AA 01 E4 4F` (ReadCard, verified on hardware).
 * `buildFrame(0x80, [0x01])` -> `AA 02 80 01 29` (Buzzer on).
 */
export function buildFrame(command: number, payload: readonly number[] = []): Uint8Array {
  assertByte(command, 'command');
  if (payload.length > MAX_PAYLOAD) {
    throw new RangeError(`payload too long: ${payload.length} > ${MAX_PAYLOAD}`);
  }
  for (const byte of payload) assertByte(byte, 'payload');

  const length = payload.length + 1;
  const frame = new Uint8Array(length + 3);
  frame[0] = FRAME_START;
  frame[1] = length;
  frame[2] = command;
  frame.set(payload, 3);
  frame[frame.length - 1] = xorChecksum(frame, 0, frame.length - 1);
  return frame;
}

/** A decoded reader response. */
export interface LockResponse {
  /** Status byte sent by the reader (`0x01` = accepted). */
  status: number;
  /** Response payload, `n - 1` bytes. */
  data: Uint8Array;
  /** Declared payload length + 1 (`n`). */
  length: number;
  /** Number of bytes consumed from the buffer, padding excluded. */
  frameLength: number;
  /** Full frame as received, checksum included. */
  raw: Uint8Array;
}

/**
 * Decode a response buffer.
 *
 * Trailing 0xFF padding is ignored. Throws {@link FrameError} when the buffer
 * cannot hold a complete frame and {@link ChecksumError} when the checksum is
 * wrong, so a corrupted read never reaches a card codec.
 */
export function parseResponse(bytes: Uint8Array): LockResponse {
  if (bytes.length < 4) {
    throw new FrameError(`response too short: ${bytes.length} byte(s)`);
  }
  if (bytes[0] !== RESPONSE_START) {
    throw new FrameError(`bad start byte: 0x${hex(bytes[0])} (expected 0x55)`);
  }

  const length = bytes[1];
  if (length < 1) throw new FrameError(`bad length byte: 0x${hex(length)}`);

  const frameLength = length + 3;
  if (bytes.length < frameLength) {
    throw new FrameError(`truncated frame: need ${frameLength}, got ${bytes.length}`);
  }

  const expected = xorChecksum(bytes, 0, frameLength - 1);
  const actual = bytes[frameLength - 1];
  if (expected !== actual) throw new ChecksumError(expected, actual);

  return {
    status: bytes[2],
    data: bytes.slice(3, frameLength - 1),
    length,
    frameLength,
    raw: bytes.slice(0, frameLength),
  };
}

/** `parseResponse` but returns `null` instead of throwing. */
export function tryParseResponse(bytes: Uint8Array): LockResponse | null {
  try {
    return parseResponse(bytes);
  } catch {
    return null;
  }
}

/** True when the reader accepted the command. */
export function isAccepted(response: LockResponse): boolean {
  return response.status === 0x01;
}

/** Lowercase hex, no separators. `Uint8Array.of(0xaa, 0x01)` -> `"aa01"`. */
export function toHex(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += (bytes[i] & 0xff).toString(16).padStart(2, '0');
  return out;
}

/** Parse hex, ignoring spaces and separators. Throws on odd length or bad digits. */
export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/[\s:_-]/g, '').toLowerCase();
  if (clean.length % 2 !== 0) throw new FrameError(`odd hex length: ${clean.length}`);
  if (!/^[0-9a-f]*$/.test(clean)) throw new FrameError('invalid hex digit');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function hex(value: number): string {
  return (value & 0xff).toString(16).padStart(2, '0');
}

function assertByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} out of range: ${value}`);
  }
}
