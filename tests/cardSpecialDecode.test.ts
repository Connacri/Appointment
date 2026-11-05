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

test('floor card scopes its building in byte [7]', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 8, startMinute: 20,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  const bytes = encodeMasterCard({
    cardType: 'floor', floorNo: 2, buildingNo: 3, cardIndex: 5, nonce: 0x29, siteCodeLow: 0x033b, validity,
  });
  assert.equal(bytes[4], 2); // floor
  assert.equal(bytes[5], 0x00); // [4..5] is the level field, not the start hour
  assert.equal(bytes[7], 0x83); // 0x80 staff marker + building 3
  assert.equal(bytes[9], 0xd5); // 0xD0 family + index 5

  const decoded = decodeCardRecord(bytes);
  assert.equal(decoded.type, 'floor');
  assert.equal(decoded.floorNo, 2);
  assert.equal(decoded.buildingNo, 3);
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
