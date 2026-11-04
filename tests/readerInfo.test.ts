import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  READER_INFO_MARKER,
  formatReaderLabel,
  parseReaderInfo,
  readerInfoRequest,
} from '../src/locks/protocol/readerInfo';

/** Encodes ASCII text the way proRFL exposes it: two hex chars per byte. */
function reportFromBytes(...parts: Array<string | number[]>): Uint8Array {
  const bytes: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      for (const char of part) bytes.push(char.charCodeAt(0));
    } else {
      bytes.push(...part);
    }
  }
  return Uint8Array.from(bytes);
}

function reportOf(text: string): Uint8Array {
  return reportFromBytes(text);
}

test('readerInfoRequest sends IniCard mode 2 padded with 0xCC', () => {
  const frame = readerInfoRequest();
  assert.equal(frame.length, 64);
  assert.deepEqual(Array.from(frame.slice(0, 4)), [0xaa, 0x01, 0x56, 0xfd]);
  assert.equal(frame[4], 0xcc);
  assert.equal(frame[63], 0xcc);
});

test('formatReaderLabel matches the proUSB %.6d layout', () => {
  assert.equal(formatReaderLabel(16), 'Reader_000016');
  assert.equal(formatReaderLabel(0), 'Reader_000000');
  assert.equal(formatReaderLabel(1234567), 'Reader_1234567');
  assert.equal(formatReaderLabel(null), null);
  assert.equal(formatReaderLabel(undefined), null);
});

test('parses the standard -proUSB layout (space separator + legal marker)', () => {
  // -proUSB + space + 3 ASCII digits + 3 filler bytes + the 0x90 0x99 legal marker
  const info = parseReaderInfo(
    reportFromBytes('-proUSB', ' ', '016', [0x00, 0x00, 0x00], [0x90, 0x99])
  );
  assert.ok(info);
  assert.equal(info.marker, '-proUSB');
  assert.equal(info.encoderNo, 16);
  assert.equal(info.legal, true);
  assert.match(info.text, /-proUSB 016/);
  assert.equal(info.reportHex.startsWith(READER_INFO_MARKER), true);
});

test('reports a non-legal encoder when the 9099 marker is absent', () => {
  const info = parseReaderInfo(reportOf('-proUSB 016ABC0000'));
  assert.ok(info);
  assert.equal(info.encoderNo, 16);
  assert.equal(info.legal, false);
});

test('parses the digit branch (separator "2", 6-digit number)', () => {
  // separator at char 7 is '2', number starts at char 9 and spans 6 chars
  const info = parseReaderInfo(reportOf('-proUSB20123456'));
  assert.ok(info);
  assert.equal(info.encoderNo, 123456);
});

test('parses the EM4305 alternate family (12-char number right after the marker)', () => {
  const info = parseReaderInfo(reportOf('EM4305-000123'));
  assert.ok(info);
  assert.equal(info.marker, 'EM4305-');
  assert.equal(info.encoderNo, 123);
});

test('parses the -proEM alternate family', () => {
  const info = parseReaderInfo(reportOf('-proEM 000042'));
  assert.ok(info);
  assert.equal(info.marker, '-proEM');
  assert.equal(info.encoderNo, 42);
});

test('returns null for reports without a known marker', () => {
  assert.equal(parseReaderInfo(reportOf('55 15 01 ACK')), null);
  assert.equal(parseReaderInfo(new Uint8Array(0)), null);
});
