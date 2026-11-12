import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCardRecord, encodeMasterCard, encodeGuestCard, encodeSpecialCard } from '../src/locks/cards/codec.ts';

test('building and floor cards preserve zero-based CardLock identifiers', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 8, startMinute: 0,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  const building = decodeCardRecord(encodeMasterCard({ cardType: 'building', buildingNo: 0, siteCodeLow: 0x033b, validity }));
  const floor = decodeCardRecord(encodeMasterCard({ cardType: 'floor', floorNo: 0, buildingNo: 0, siteCodeLow: 0x033b, validity }));
  assert.equal(building.type, 'building');
  assert.equal(building.buildingNo, 0);
  assert.equal(floor.type, 'floor');
  assert.equal(floor.floorNo, 0);
  assert.equal(floor.buildingNo, 0);
});

test('floor card uses the genuine 7F 00 / floor / building layout', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 8, startMinute: 20,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  const bytes = encodeMasterCard({
    cardType: 'floor', floorNo: 2, buildingNo: 3, cardIndex: 5, nonce: 0x29, siteCodeLow: 0x033b, validity,
  });
  // Evidence: CardInfo IDs 1384-1393 in the live CardLock.mdb.
  assert.equal(bytes[4], 0x7f); // floor-level marker, not the floor number
  assert.equal(bytes[5], 0x00); // [4..5] is the level field, not the start hour
  assert.equal(bytes[6], 2); // floor number
  assert.equal(bytes[7], 3); // plain BldNo — 0x80 here would mean "all buildings"
  assert.equal(bytes[8], 0x00);
  assert.equal(bytes[9], 0xd5); // 0xD0 family + index 5

  const decoded = decodeCardRecord(bytes);
  assert.equal(decoded.type, 'floor');
  assert.equal(decoded.floorNo, 2);
  assert.equal(decoded.buildingNo, 3);
  assert.deepEqual(decoded.notes, []);
});

test('a genuine floor card decodes and re-encodes byte for byte', () => {
  // CardInfo ID 1384 (issued 2026-11-04): floor 2, building 1, index 6.
  const hex = 'C912033B7F00020100D61B24F51C25FB';
  const original = Uint8Array.from(hex.match(/../g)!.map((byte) => parseInt(byte, 16)));

  const decoded = decodeCardRecord(original);
  assert.equal(decoded.type, 'floor');
  assert.equal(decoded.floorNo, 2);
  assert.equal(decoded.buildingNo, 1);
  assert.equal(decoded.cardIndex, 6);
  assert.ok(decoded.validity);
  assert.equal(decoded.validity!.startMonth, 11);
  assert.equal(decoded.validity!.startDay, 4);
  assert.equal(decoded.validity!.startHour, 19);
  assert.equal(decoded.validity!.startMinute, 53);
  assert.equal(decoded.validity!.endMonth, 12);
  assert.equal(decoded.validity!.endDay, 4);
  assert.equal(decoded.validity!.endHour, 23);
  assert.equal(decoded.validity!.endMinute, 59);
  // 4-bit year field: 2026 and the decoded year share the same nibble.
  assert.equal((decoded.validity!.startYear - 2009) % 16, (2026 - 2009) % 16);
  assert.equal(decoded.validity!.startYear, decoded.validity!.endYear);

  const reencoded = encodeMasterCard({
    cardType: 'floor',
    floorNo: decoded.floorNo,
    buildingNo: decoded.buildingNo,
    cardIndex: decoded.cardIndex,
    siteCodeLow: (original[2] << 8) | original[3],
    validity: decoded.validity!,
  });
  assert.deepEqual(Array.from(reencoded), Array.from(original));
});

test('building card keeps its documented byte [4] and also scopes the building in [7]', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 0, startMinute: 0,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  const bytes = encodeMasterCard({
    cardType: 'building', buildingNo: 3, cardIndex: 2, nonce: 0x29, siteCodeLow: 0x033b, validity,
  });
  assert.equal(bytes[4], 3);
  assert.equal(bytes[5], 0);
  assert.equal(bytes[7], 0x83);
  assert.equal(bytes[9], 0xc2);

  const decoded = decodeCardRecord(bytes);
  assert.equal(decoded.type, 'building');
  assert.equal(decoded.buildingNo, 3);
});

test('master card keeps the all-buildings wildcard', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 14, startMinute: 30,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  const bytes = encodeMasterCard({ cardType: 'master', cardIndex: 0, nonce: 0x29, siteCodeLow: 0x033b, validity });
  assert.equal(bytes[4], 0xff);
  assert.equal(bytes[5], 0x00);
  assert.equal(bytes[7], 0x80); // building nibble 0 = all buildings
  assert.equal(bytes[9], 0xb0);
});

test('staff card encoders refuse a missing or out-of-range building instead of masking it', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 0, startMinute: 0,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  assert.throws(() => encodeMasterCard({ cardType: 'floor', floorNo: 1, siteCodeLow: 0x033b, validity }), /bâtiment/i);
  assert.throws(() => encodeMasterCard({ cardType: 'floor', floorNo: 128, buildingNo: 1, siteCodeLow: 0x033b, validity }), /étage/i);
  // 16 & 0x0f === 0 would silently become "all buildings": must throw.
  assert.throws(() => encodeMasterCard({ cardType: 'building', buildingNo: 16, siteCodeLow: 0x033b, validity }), /bâtiment/i);
  assert.throws(() => encodeMasterCard({ cardType: 'building', siteCodeLow: 0x033b, validity }), /bâtiment/i);
});


test('special 0x90 card is decoded as a room card without treating PIN byte as expiry', () => {
  const bytes = new Uint8Array(16);
  bytes.set([0xc9, 0x12, 0x03, 0x3b, 0xe3, 0x81, 0x81, 0x01, 0x00, 0x99, 0x00, 0x00, 0x00, 0x5a, 0x01, 0x02]);
  const decoded = decodeCardRecord(bytes);
  assert.equal(decoded.type, 'special');
  assert.equal(decoded.roomNumber, '101');
  assert.equal(decoded.specialPinHash, 0x5a);
  assert.equal(decoded.endIsUnknown, true);
  assert.equal(decoded.validity, undefined);
});

test('guest card encoder preserves explicit zero-based building and floor values', () => {
  const bytes = encodeGuestCard({
    roomNumber: '101', buildingNo: 0, floorNo: 0, siteCodeLow: 0x033b,
    validity: { startYear: 2026, startMonth: 11, startDay: 4, startHour: 8, endYear: 2026, endMonth: 11, endDay: 7, endHour: 12 },
  });
  const decoded = decodeCardRecord(bytes);
  assert.equal(decoded.buildingNo, 0);
  assert.equal(decoded.floorNo, 0);
  assert.equal(decoded.roomNumber, '1');
});

test('special-card encoder preserves C9 magic and writes family 0x90 in byte 9', () => {
  const bytes = encodeSpecialCard({
    roomNumber: '101', buildingNo: 0, floorNo: 0, cardIndex: 9, passwordPin: '8844', siteCodeLow: 0x033b,
    validity: { startYear: 2026, startMonth: 11, startDay: 4, startHour: 8, endYear: 2026, endMonth: 11, endDay: 7, endHour: 12 },
  });
  assert.equal(bytes[0], 0xc9);
  assert.equal(bytes[9], 0x99);
  const decoded = decodeCardRecord(bytes);
  assert.equal(decoded.type, 'special');
  assert.equal(decoded.buildingNo, 0);
  assert.equal(decoded.floorNo, 0);
  assert.equal(decoded.specialPinHash, 0x28);
});
