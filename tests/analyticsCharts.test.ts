import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSmoothSplinePath,
  computeRoundedPieWedges,
  computeSegmentedRingArcs,
} from '../src/utils/analyticsCharts';

test('computeSegmentedRingArcs produces non-overlapping arcs with accurate percentages and handles empty/single slices', () => {
  assert.deepEqual(computeSegmentedRingArcs([]), { total: 0, slices: [] });
  assert.deepEqual(
    computeSegmentedRingArcs([{ key: 'zero', label: 'Zero', value: 0, color: '#000' }]),
    { total: 0, slices: [] }
  );

  const single = computeSegmentedRingArcs([
    { key: 'only', label: 'Confirmed', value: 12, color: '#87CEFA' },
  ]);
  assert.equal(single.total, 12);
  assert.equal(single.slices.length, 1);
  assert.equal(single.slices[0]?.percentage, 100);
  assert.equal(single.slices[0]?.isFullCircle, true);

  const multi = computeSegmentedRingArcs([
    { key: 'a', label: 'Confirmed', value: 36, color: '#87CEFA' },
    { key: 'b', label: 'Active', value: 24, color: '#7178FF' },
    { key: 'c', label: 'Pending', value: 22, color: '#67C380' },
    { key: 'd', label: 'Cancelled', value: 18, color: '#6E717A' },
  ]);
  assert.equal(multi.total, 100);
  assert.equal(multi.slices.length, 4);
  assert.equal(multi.slices[0]?.percentage, 36);
  // Gap-compensated sum of sweep angles stays strictly below 360 so round caps do not overlap
  const sweepSum = multi.slices.reduce((sum, s) => sum + s.sweepAngle, 0);
  assert.ok(sweepSum < 360);
});

test('computeRoundedPieWedges computes separated rounded wedges for 1 or multiple slices', () => {
  assert.deepEqual(computeRoundedPieWedges([]), { total: 0, wedges: [] });

  const three = computeRoundedPieWedges([
    { key: 'paid', label: 'Réglées', value: 48, color: '#D9FF54' },
    { key: 'due', label: 'À encaisser', value: 30, color: '#FF7369' },
    { key: 'cancelled', label: 'Annulées', value: 22, color: '#FFA84B' },
  ]);
  assert.equal(three.total, 100);
  assert.equal(three.wedges.length, 3);
  assert.equal(three.wedges[0]?.percentage, 48);
  assert.ok(three.wedges.every((w) => w.wedgePath.includes('A ')));
});

test('buildSmoothSplinePath generates clamped cubic bezier curves without NaN or out-of-bounds control points', () => {
  assert.equal(buildSmoothSplinePath([], 10, 120), '');
  assert.equal(buildSmoothSplinePath([{ x: 20, y: 50 }], 10, 120), 'M 20.0 50.0');

  const path = buildSmoothSplinePath(
    [
      { x: 18, y: 120 },
      { x: 120, y: 20 },
      { x: 240, y: 126 },
      { x: 360, y: 25 },
    ],
    20,
    126
  );

  assert.match(path, /^M 18\.0 120\.0 C /);
  assert.equal(path.includes('NaN'), false);

  // Extract all Y coordinates from cubic curve commands and verify they remain inside [20, 126]
  const numbers = path
    .replace(/[MC,]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number);
  for (let i = 1; i < numbers.length; i += 2) {
    assert.ok(numbers[i] >= 20 && numbers[i] <= 126, `Y value ${numbers[i]} exceeded bounds`);
  }
});
