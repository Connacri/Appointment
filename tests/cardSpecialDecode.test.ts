import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCardRecord, encodeMasterCard } from '../src/locks/cards/codec.ts';

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
