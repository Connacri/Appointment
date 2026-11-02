import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidCalendarDate,
  shouldMarkPaymentAsPaid,
} from '../src/utils/bookingValidation';

test('accepts real ISO calendar dates', () => {
  assert.equal(isValidCalendarDate('2026-11-02'), true);
  assert.equal(isValidCalendarDate('2024-02-29'), true);
});

test('rejects impossible or non-ISO calendar dates', () => {
  assert.equal(isValidCalendarDate('2026-02-31'), false);
  assert.equal(isValidCalendarDate('2025-02-29'), false);
  assert.equal(isValidCalendarDate('02/11/2026'), false);
  assert.equal(isValidCalendarDate('2026-13-01'), false);
});

test('pending payment stays pending when cash was not received', () => {
  assert.equal(shouldMarkPaymentAsPaid('pending', false), false);
  assert.equal(shouldMarkPaymentAsPaid(undefined, false), false);
});

test('payment settles only after explicit cash receipt or if already paid', () => {
  assert.equal(shouldMarkPaymentAsPaid('pending', true), true);
  assert.equal(shouldMarkPaymentAsPaid('paid', false), true);
});
