import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const topBar = readFileSync(new URL('../src/components/TopBar.tsx', import.meta.url), 'utf8');
const gantt = readFileSync(new URL('../src/components/PlanningTimeline.tsx', import.meta.url), 'utf8');

test('booking search is owned by the Gantt, not duplicated in the application header', () => {
  assert.doesNotMatch(topBar, /BookingFinderModal|open-booking-finder|CalendarSearch/);
  assert.match(gantt, /ganttSearchPlaceholder/);
  assert.match(gantt, /gantt-booking-search-results/);
});

test('mobile Gantt controls and quick search share the collapsible tools panel', () => {
  assert.match(gantt, /isGanttToolsOpen \? 'max-h-\[min\(68vh,560px\)\] overflow-y-auto overscroll-contain'/);
  assert.match(gantt, /isMobileScreen && !isGanttToolsOpen \? 'hidden' : 'relative flex'/);
  assert.match(gantt, /Tools & search/);
});

test('the floating current-time badge is removed from narrow screens', () => {
  assert.match(gantt, /className="hidden sm:flex absolute top-12/);
});
