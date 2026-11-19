import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeTimelineBarGeometry } from '../src/utils/timelineBarGeometry';

const windowInput = {
  windowStartDate: '2026-11-01',
  windowDays: 30,
  colWidth: 28,
  isTimedStay: false,
};

test('a malformed checkout date renders a single-day bar, never a stretched full-window bar', () => {
  const geometry = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '2026-11-10',
    endDate: 'not-a-date',
  });

  assert.equal(geometry.visible, true);
  assert.equal(geometry.leftOffset, 9 * 28);
  // One day column, not the remaining 21 days of the month window.
  assert.equal(geometry.barWidth, 28 - 6);
});

test('a checkout date earlier than check-in is treated as a single-day stay', () => {
  const geometry = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '2026-11-10',
    endDate: '2026-11-08',
  });

  assert.equal(geometry.visible, true);
  assert.equal(geometry.barWidth, 28 - 6);
});

test('a same-day booking stays visible with a minimum readable width', () => {
  const geometry = computeTimelineBarGeometry({
    ...windowInput,
    colWidth: 8,
    startDate: '2026-11-10',
    endDate: '2026-11-10',
  });

  assert.equal(geometry.visible, true);
  assert.equal(geometry.barWidth, 12);
});

test('a stay crossing the window start is clipped to the first visible column', () => {
  const geometry = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '2026-10-28',
    endDate: '2026-11-03',
  });

  assert.equal(geometry.visible, true);
  assert.equal(geometry.leftOffset, 0);
  assert.equal(geometry.barWidth, 2 * 28 - 6);
});

test('stays entirely outside the window and invalid dates are hidden', () => {
  const before = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '2026-10-01',
    endDate: '2026-10-05',
  });
  const after = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '2026-12-10',
    endDate: '2026-12-12',
  });
  const invalidStart = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '10/11/2026',
    endDate: '2026-11-12',
  });
  const impossibleDate = computeTimelineBarGeometry({
    ...windowInput,
    startDate: '2026-02-31',
    endDate: '2026-03-02',
  });

  assert.equal(before.visible, false);
  assert.equal(after.visible, false);
  assert.equal(invalidStart.visible, false);
  assert.equal(impossibleDate.visible, false);
});

test('month-width columns and timed hotel stays produce finite offsets', () => {
  const monthly = computeTimelineBarGeometry({
    ...windowInput,
    colWidth: 14,
    startDate: '2026-11-10',
    endDate: '2026-11-13',
  });
  assert.equal(monthly.visible, true);
  assert.equal(monthly.barWidth, 3 * 14 - 6);

  const timed = computeTimelineBarGeometry({
    ...windowInput,
    colWidth: 100,
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    checkInTime: '18:00',
    checkOutTime: '10:00',
    isTimedStay: true,
  });
  assert.equal(timed.visible, true);
  assert.ok(Number.isFinite(timed.leftOffset));
  assert.ok(Number.isFinite(timed.barWidth));
  assert.ok(timed.leftOffset > 9 * 100);
});
