import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dbSource = readFileSync(new URL('../src/db/indexedDb.ts', import.meta.url), 'utf8');
const analyticsSource = readFileSync(
  new URL('../src/components/BookingAnalyticsView.tsx', import.meta.url),
  'utf8',
);

test('historical archive reads are indexed by workspace and booking start date', () => {
  assert.match(dbSource, /createIndex\('workspaceStartDate', \['workspaceId', 'startDate'\]/);
  assert.match(dbSource, /index\('workspaceStartDate'\)\.openCursor/);
  assert.match(dbSource, /skipped < offset/);
  assert.match(dbSource, /result.length < limit/);
});

test('analytics loads archives only for the 365-day comparison window', () => {
  assert.match(analyticsSource, /range !== '365d'/);
  assert.match(analyticsSource, /getArchivedBookingsWindow/);
  assert.match(analyticsSource, /listBookingsWindow/);
  assert.match(analyticsSource, /bookings: analyticsBookings/);
  assert.match(analyticsSource, /analyticsBookings\.filter/);
});
