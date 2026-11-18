import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEGACY_COLUMN_ZOOM_STORAGE_KEY,
  SCALE_VIEW_PRESETS,
  TIMELINE_ZOOM_STORAGE_KEY,
  clampZoomLevel,
  getColumnWidthFromZoomLevel,
  getPresetZoomLevel,
  getScaleViewFromZoomLevel,
  readInitialZoomLevel,
} from '../src/utils/timelineZoom';

test('clampZoomLevel bounds values to [0, 100] and handles non-finite inputs', () => {
  assert.equal(clampZoomLevel(-25), 0);
  assert.equal(clampZoomLevel(0), 0);
  assert.equal(clampZoomLevel(42.6), 43);
  assert.equal(clampZoomLevel(140), 100);
  assert.equal(clampZoomLevel(Number.NaN), SCALE_VIEW_PRESETS.week);
  assert.equal(clampZoomLevel(Number.POSITIVE_INFINITY), SCALE_VIEW_PRESETS.week);
});

test('getScaleViewFromZoomLevel maps zoom ranges to month, week, and day views', () => {
  assert.equal(getScaleViewFromZoomLevel(0), 'month');
  assert.equal(getScaleViewFromZoomLevel(33), 'month');
  assert.equal(getScaleViewFromZoomLevel(34), 'week');
  assert.equal(getScaleViewFromZoomLevel(67), 'week');
  assert.equal(getScaleViewFromZoomLevel(68), 'day');
  assert.equal(getScaleViewFromZoomLevel(100), 'day');

  assert.equal(getScaleViewFromZoomLevel(getPresetZoomLevel('month')), 'month');
  assert.equal(getScaleViewFromZoomLevel(getPresetZoomLevel('week')), 'week');
  assert.equal(getScaleViewFromZoomLevel(getPresetZoomLevel('day')), 'day');
});

test('getColumnWidthFromZoomLevel scales monotonically for desktop and mobile', () => {
  assert.equal(getColumnWidthFromZoomLevel(0, false), 28);
  assert.equal(getColumnWidthFromZoomLevel(100, false), 180);
  assert.equal(getColumnWidthFromZoomLevel(0, true), 24);
  assert.equal(getColumnWidthFromZoomLevel(100, true), 112);

  const monthW = getColumnWidthFromZoomLevel(getPresetZoomLevel('month'), false);
  const weekW = getColumnWidthFromZoomLevel(getPresetZoomLevel('week'), false);
  const dayW = getColumnWidthFromZoomLevel(getPresetZoomLevel('day'), false);
  assert.ok(monthW < weekW && weekW < dayW);
});

test('readInitialZoomLevel reads numeric zoom and migrates legacy columnZoom preferences', () => {
  const mkStorage = (entries: Record<string, string>) => ({
    getItem: (key: string) => (key in entries ? entries[key] : null),
  });

  assert.equal(
    readInitialZoomLevel(mkStorage({ [TIMELINE_ZOOM_STORAGE_KEY]: '72' })),
    72,
  );
  assert.equal(
    readInitialZoomLevel(mkStorage({ [LEGACY_COLUMN_ZOOM_STORAGE_KEY]: 'compact' })),
    SCALE_VIEW_PRESETS.month,
  );
  assert.equal(
    readInitialZoomLevel(mkStorage({ [LEGACY_COLUMN_ZOOM_STORAGE_KEY]: 'wide' })),
    SCALE_VIEW_PRESETS.day,
  );
  assert.equal(
    readInitialZoomLevel(mkStorage({ [LEGACY_COLUMN_ZOOM_STORAGE_KEY]: 'standard' })),
    SCALE_VIEW_PRESETS.week,
  );
  assert.equal(readInitialZoomLevel(mkStorage({})), SCALE_VIEW_PRESETS.week);
  assert.equal(readInitialZoomLevel(null), SCALE_VIEW_PRESETS.week);
});
