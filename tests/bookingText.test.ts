import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBookingText } from '../src/utils/bookingText';

test('normalizes stored booking text for comparisons', () => {
  assert.equal(normalizeBookingText('  Ahmed Benali '), 'ahmed benali');
  assert.equal(normalizeBookingText('Chambre 101'), 'chambre 101');
});

test('never throws when an imported record misses a text field', () => {
  // Regression: calling .toLowerCase() on these values during render unmounted
  // the whole React tree and left a blank page after a booking was confirmed.
  assert.equal(normalizeBookingText(undefined), '');
  assert.equal(normalizeBookingText(null), '');
  assert.equal(normalizeBookingText(new Date('2026-11-15T00:00:00.000Z')), '');
  assert.equal(normalizeBookingText(42), '');
  assert.equal(normalizeBookingText({ text: 'legacy' }), '');
});

test('keeps empty strings comparable', () => {
  assert.equal(normalizeBookingText(''), '');
  assert.equal(normalizeBookingText('   '), '');
});
