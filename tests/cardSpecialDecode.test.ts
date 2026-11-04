import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCardRecord, encodeMasterCard, encodeGuestCard, encodeSpecialCard } from '../src/locks/cards/codec.ts';

test('building and floor cards preserve zero-based CardLock identifiers', () => {
  const validity = {
    startYear: 2026, startMonth: 11, startDay: 4, startHour: 8, startMinute: 0,
    endYear: 2027, endMonth: 11, endDay: 4, endHour: 23, endMinute: 59,
  };
  const building = decodeCardRecord(encodeMasterCard({ cardType: 'building', buildingNo: 0, siteCodeLow: 0x033b, validity }));
  const floor = decodeCardRecord(encodeMasterCard({ cardType: 'floor', floorNo: 0, siteCodeLow: 0x033b, validity }));
  assert.equal(building.type, 'building');
  assert.equal(building.buildingNo, 0);
  assert.equal(floor.type, 'floor');
  assert.equal(floor.floorNo, 0);
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
