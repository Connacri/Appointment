import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capitalizeFirstLetter } from '../src/utils/text';

test('capitalizeFirstLetter uppercases only the first Latin letter', () => {
  assert.equal(capitalizeFirstLetter('bâtiment a'), 'Bâtiment a');
  assert.equal(capitalizeFirstLetter('oasis'), 'Oasis');
  assert.equal(capitalizeFirstLetter('étoile'), 'Étoile');
  assert.equal(capitalizeFirstLetter('ÿasmine'), 'Ÿasmine');
  assert.equal(capitalizeFirstLetter('österreich'), 'Österreich');
  assert.equal(capitalizeFirstLetter('œuvre'), 'Œuvre');
});

test('capitalizeFirstLetter preserves Arabic, digits and already-uppercase text', () => {
  assert.equal(capitalizeFirstLetter('فندق الواحة'), 'فندق الواحة');
  assert.equal(capitalizeFirstLetter('est-123'), 'Est-123');
  assert.equal(capitalizeFirstLetter('101'), '101');
  assert.equal(capitalizeFirstLetter('Hôtel Royal'), 'Hôtel Royal');
});

test('capitalizeFirstLetter is safe for empty strings and leading spaces', () => {
  assert.equal(capitalizeFirstLetter(''), '');
  assert.equal(capitalizeFirstLetter('  hôtel'), '  hôtel');
});
