import test from 'node:test';
import assert from 'node:assert/strict';
import { incrementReleaseVersion, parseReleaseVersion } from '../scripts/versioning.mjs';

test('release version increments patch for each production release', () => {
  assert.equal(incrementReleaseVersion('1.2.0'), '1.2.1');
  assert.equal(incrementReleaseVersion('1.2.98'), '1.2.99');
});

test('patch 99 rolls over to the next minor release', () => {
  assert.equal(incrementReleaseVersion('1.2.99'), '1.3.0');
});

test('existing tags are skipped without reusing a published version', () => {
  assert.equal(incrementReleaseVersion('1.2.0', ['v1.2.1', 'v1.2.2']), '1.2.3');
});

test('invalid release versions fail closed', () => {
  assert.throws(() => parseReleaseVersion('1.2'), /Expected MAJOR\.MINOR\.PATCH/);
  assert.throws(() => incrementReleaseVersion('v1.2.0'), /Expected MAJOR\.MINOR\.PATCH/);
});
