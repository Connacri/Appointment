/**
 * Protocol layer tests.
 *
 * Every expected frame below is taken from the hardware capture in
 * docs/re-proUSB/CARD-API.md §5/§6, so a regression here means we would send
 * something different to the real encoder.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ChecksumError,
  FrameError,
  LockTimeoutError,
  MockTransport,
  Op,
  buildFrame,
  buzzer,
  fromHex,
  iniCard,
  IniMode,
  isAccepted,
  parseResponse,
  readCard,
  readE2,
  readRecord,
  toHex,
  transact,
  writeCard,
  xorChecksum,
} from '../../src/locks/protocol/index.ts';

/** Wrap a payload in a valid response frame. */
function response(status: number, data: readonly number[]): Uint8Array {
  const body = [0x55, data.length + 1, status, ...data];
  const checksum = xorChecksum(body);
  return Uint8Array.from([...body, checksum]);
}

describe('frames', () => {
  it('computes the checksum the reader expects', () => {
    assert.equal(xorChecksum(Uint8Array.from([0xaa, 0x01, 0xe4])), 0x4f);
    assert.equal(xorChecksum(Uint8Array.from([0xaa, 0x02, 0x80, 0x01])), 0x29);
  });

  it('builds the verified ReadCard frame', () => {
    assert.equal(toHex(readCard()), 'aa01e44f');
  });

  it('builds both Buzzer frames', () => {
    assert.equal(toHex(buzzer(1)), 'aa02800129');
    assert.equal(toHex(buzzer(0)), 'aa02800028');
  });

  it('builds the ReadRecord frame', () => {
    assert.equal(toHex(readRecord()), 'aa018229');
  });

  it('builds the three IniCard frames', () => {
    assert.equal(toHex(iniCard(IniMode.Step0)), 'aa01963d');
    assert.equal(toHex(iniCard(IniMode.Step1)), 'aa0169c2');
    assert.equal(toHex(iniCard(IniMode.Step2)), 'aa0156fd');
  });

  it('builds ReadE2 with the address XORed into the checksum', () => {
    assert.equal(toHex(readE2(0x00)), 'aa024700ef');
    assert.equal(toHex(readE2(0x2a)), 'aa02472ac5');
  });

  it('rejects invalid commands and payloads', () => {
    assert.throws(() => buildFrame(0x100), RangeError);
    assert.throws(() => buildFrame(0x80, [0x1ff]), RangeError);
    assert.throws(() => buildFrame(0x80, new Array(300).fill(0)), RangeError);
  });

  it('round-trips hex', () => {
    const bytes = fromHex('C9 12 24 B6 E3 81 81 01 01 62 65 DB 15 65 E3 00');
    assert.equal(bytes.length, 16);
    assert.equal(toHex(bytes), 'c91224b6e3818101016265db1565e300');
    assert.throws(() => fromHex('abc'), FrameError);
    assert.throws(() => fromHex('zz'), FrameError);
  });
});

describe('commands', () => {
  it('writes a 16-byte record in the verified 20-byte frame', () => {
    const record = fromHex('C91224B6E3818101016265DB1565E300');
    const frame = writeCard(record);
    assert.equal(frame.length, 20);
    assert.equal(toHex(frame.slice(0, 3)), 'aa11ec');
    assert.equal(toHex(frame.slice(3, 19)), toHex(record));
    assert.equal(frame[19], xorChecksum(frame, 0, 19));
  });

  it('writes a 32-byte payload in the 36-byte frame', () => {
    const frame = writeCard(new Uint8Array(32).fill(0x5a));
    assert.equal(frame.length, 36);
    assert.equal(frame[1], 0x21);
  });

  it('refuses records that are neither 16 nor 32 bytes', () => {
    assert.throws(() => writeCard(new Uint8Array(20)), RangeError);
  });
});

describe('responses', () => {
  it('decodes a ReadCard response and drops the 0xFF padding', () => {
    const area = fromHex('C91224B6E3818101016265DB1565E30050500083');
    const frame = response(0x01, Array.from(area));
    const padded = new Uint8Array(65).fill(0xff);
    padded.set(frame);
    const parsed = parseResponse(padded);
    assert.equal(parsed.status, 0x01);
    assert.equal(parsed.length, 21);
    assert.equal(parsed.frameLength, 24);
    assert.equal(parsed.data.length, 20);
    assert.equal(toHex(parsed.data), toHex(area));
    assert.ok(isAccepted(parsed));
  });

  it('decodes a ReadE2 response with 32 data bytes', () => {
    const data = new Uint8Array(32).map((_, i) => i);
    const parsed = parseResponse(response(0x01, Array.from(data)));
    assert.equal(parsed.length, 33);
    assert.equal(toHex(parsed.data), toHex(data));
  });

  it('rejects a corrupted checksum', () => {
    const frame = response(0x01, [1, 2, 3]);
    frame[frame.length - 1] ^= 0xff;
    assert.throws(() => parseResponse(frame), ChecksumError);
  });

  it('rejects a bad start byte and a truncated frame', () => {
    assert.throws(() => parseResponse(Uint8Array.from([0xaa, 0x01, 0x01, 0x00])), FrameError);
    assert.throws(() => parseResponse(Uint8Array.from([0x55, 0x15, 0x01])), FrameError);
  });
});

describe('transport', () => {
  it('sends the frame and returns the decoded response', async () => {
    const area = fromHex('C91224B6E3818101016265DB1565E30050500083');
    const transport = new MockTransport(() => response(0x01, Array.from(area)));
    await transport.open();
    const result = await transact(transport, readCard());
    assert.equal(toHex(transport.sent[0]), 'aa01e44f');
    assert.equal(result.data.length, 20);
  });

  it('retries when the reader misses the first exchange', async () => {
    let calls = 0;
    const transport = new MockTransport(() => {
      calls += 1;
      return calls === 1 ? null : response(0x01, new Array(20).fill(0x00));
    });
    await transport.open();
    const result = await transact(transport, readCard(), { timeoutMs: 5, retryDelayMs: 1 });
    assert.equal(calls, 2);
    assert.equal(result.status, 0x01);
    assert.equal(transport.sent.length, 2);
  });

  it('gives up after the configured number of attempts', async () => {
    const transport = new MockTransport(() => null);
    await transport.open();
    await assert.rejects(
      transact(transport, readCard(), { timeoutMs: 5, attempts: 2, retryDelayMs: 1 }),
      LockTimeoutError,
    );
    assert.equal(transport.sent.length, 2);
  });

  it('refuses to send on a closed transport', async () => {
    const transport = new MockTransport(() => null);
    await assert.rejects(transport.send(buildFrame(Op.ReadCard)));
  });
});
