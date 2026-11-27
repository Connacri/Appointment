import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getBookingArchivePeriodBounds,
  getBookingArchivePeriodKey,
  getBookingOperationalCutoffDate,
  isBookingEligibleForArchive,
} from '../src/utils/bookingArchive';

test('operational cutoff uses six calendar months in UTC without DST drift', () => {
  assert.equal(getBookingOperationalCutoffDate(new Date('2026-11-27T12:00:00.000Z')), '2026-05-27');
  assert.equal(getBookingOperationalCutoffDate(new Date('2026-08-31T12:00:00.000Z')), '2026-02-28');
});

test('only completed or cancelled bookings strictly older than cutoff are archived', () => {
  const cutoff = '2026-05-27';
  assert.equal(isBookingEligibleForArchive({ status: 'checked_out', endDate: '2026-05-26' }, cutoff), true);
  assert.equal(isBookingEligibleForArchive({ status: 'cancelled', endDate: '2026-05-26' }, cutoff), true);
  assert.equal(isBookingEligibleForArchive({ status: 'checked_out', endDate: cutoff }, cutoff), false);
  assert.equal(isBookingEligibleForArchive({ status: 'checked_in', endDate: '2025-01-01' }, cutoff), false);
  assert.equal(isBookingEligibleForArchive({ status: 'confirmed', endDate: '2025-01-01' }, cutoff), false);
  assert.equal(isBookingEligibleForArchive({ status: 'checked_out', endDate: 'invalid' }, cutoff), false);
  assert.equal(isBookingEligibleForArchive({ status: 'checked_out', endDate: '2026-02-31' }, cutoff), false);
});

test('archive partitions use calendar half-years and expose exact boundaries', () => {
  assert.equal(getBookingArchivePeriodKey('2026-01-01'), '2026-H1');
  assert.equal(getBookingArchivePeriodKey('2026-06-30'), '2026-H1');
  assert.equal(getBookingArchivePeriodKey('2026-07-01'), '2026-H2');
  assert.deepEqual(getBookingArchivePeriodBounds('2026-H1'), {
    startDate: '2026-01-01', endDate: '2026-06-30',
  });
  assert.deepEqual(getBookingArchivePeriodBounds('2026-H2'), {
    startDate: '2026-07-01', endDate: '2026-12-31',
  });
  assert.throws(() => getBookingArchivePeriodKey('2026-13-01'), /invalid month/i);
  assert.throws(() => getBookingArchivePeriodBounds('2026-Q1'), /period key/i);
});


test('archive date validation rejects impossible calendar dates', () => {
  assert.equal(isBookingEligibleForArchive({
    status: 'checked_out',
    endDate: '2026-02-31',
  }, '2026-05-27'), false);
  assert.throws(() => getBookingArchivePeriodKey('2026-13-01'), /invalid month/i);
  assert.throws(() => getBookingArchivePeriodKey('2026-02-31'), /calendar date/i);
});
