import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  READER_INFO_MARKER,
  formatMachineCode,
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

test('reads the machine code ("Current Reader No.") from bytes 5..8', () => {
  // Real identification block prefix from Reg.ini: 55 21 01 55 39 | 50 12 14 D2
  const info = parseReaderInfo(
    reportFromBytes(
      [0x55, 0x21, 0x01, 0x55, 0x39, 0x50, 0x12, 0x14, 0xd2, 0x00, 0x00, 0x00, 0x00],
      '-proUSB',
      ' ',
      '016',
      [0x00, 0x00, 0x00],
      [0x90, 0x99]
    )
  );
  assert.ok(info);
  assert.equal(info.machineCode, '501214D2');
  assert.equal(formatMachineCode(info.machineCode), '5012 14D2');
});

test('reads the machine code from a full Reg.ini report (M9 family)', () => {
  const report = Uint8Array.from(
    Buffer.from(
      '552101553950129BF7881988180FFF2D70726F4D392D32303132313133302D3134CCCCF5',
      'hex'
    )
  );
  const info = parseReaderInfo(report);
  assert.ok(info);
  assert.equal(info.machineCode, '50129BF7');
  assert.equal(info.marker, 'M9-');
});

/** Standard `-proUSB` identification block, bytes 0..35, machine code 501214D2. */
function standardUsbBlock(): number[] {
  return [
    0x55, 0x21, 0x01, 0x55, 0x39, 0x50, 0x12, 0x14, 0xd2, 0x88, 0x19, 0x88, 0x18, 0x0f, 0xff,
    0x2d, 0x70, 0x72, 0x6f, 0x55, 0x53, 0x42, 0x20, 0x30, 0x31, 0x36, 0x00, 0x00, 0x00, 0x90,
    0x99, 0x00, 0x00, 0x00, 0x00, 0xf5,
  ];
}

test('keeps the machine code aligned when the transport prepends a report ID', () => {
  // WebHidTransport stores `array[0] = reportId` before the report payload, so
  // the block is shifted by one byte. The old fixed `Copy(hex, 11, 8)` read
  // bytes 4..7 of the block and produced 39501214.
  for (const reportId of [0x00, 0x40]) {
    const info = parseReaderInfo(reportFromBytes([reportId], standardUsbBlock()));
    assert.ok(info);
    assert.equal(info.machineCode, '501214D2');
    assert.equal(formatMachineCode(info.machineCode), '5012 14D2');
    // Marker-relative parsing is unaffected by the shift.
    assert.equal(info.encoderNo, 16);
    assert.equal(info.marker, '-proUSB');
    assert.equal(info.legal, true);
  }
});

test('reads the same machine code with and without a report ID prefix', () => {
  const plain = parseReaderInfo(reportFromBytes(standardUsbBlock()));
  const prefixed = parseReaderInfo(reportFromBytes([0x00], standardUsbBlock()));
  assert.ok(plain);
  assert.ok(prefixed);
  assert.equal(prefixed.machineCode, plain.machineCode);
  assert.equal(prefixed.reportHex.length, plain.reportHex.length + 2);
});

test('formatMachineCode rejects incomplete or malformed codes', () => {
  assert.equal(formatMachineCode('501214D2'), '5012 14D2');
  assert.equal(formatMachineCode('501214'), null);
  assert.equal(formatMachineCode('501214d2'), null);
  assert.equal(formatMachineCode(null), null);
  assert.equal(formatMachineCode(undefined), null);
});
