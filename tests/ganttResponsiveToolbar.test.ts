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

test('heavy booking and print dialogs mount only while requested', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /isNewBookingModalOpen \|\| selectedBooking \? <BookingModal \/> : null/);
  assert.match(gantt, /isPoliceBatchPrintOpen && \(/);
});

test('mobile operational notifications are nested in the compact More menu', () => {
  assert.match(topBar, /relative hidden shrink-0 overflow-visible sm:block/);
  assert.match(topBar, /mobile-staff-notifications-btn/);
  assert.match(topBar, /setNotifMenuRect\(computeClampedPopoverRect\(moreMenuRef\.current, 320, !isRtlDir\)\)/);
});

test('secondary navigation chunks are prefetched on pointer intent and keyboard focus', () => {
  const sidebar = readFileSync(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');
  assert.match(sidebar, /onPointerEnter=\{\(\) => prefetchViewChunk\(item\.view\)\}/);
  assert.match(sidebar, /onFocus=\{\(\) => prefetchViewChunk\(item\.view\)\}/);
  assert.match(sidebar, /case 'billing': void import\('\.\/BillingInvoicingView'\)/);
  assert.match(sidebar, /case 'prousb': void import\('\.\/ProUsbLockSystemView'\)/);
});

test('Gantt floor availability is calculated only for expanded building and floor sections', () => {
  assert.ok(gantt.includes('if (collapsedGroups[groupId]) continue;'));
  assert.ok(gantt.includes('if (floor.label && collapsedFloors[`${groupId}:${floor.key}`]) continue;'));
  assert.ok(gantt.includes('[floorGroupsByGroup, collapsedGroups, collapsedFloors, timelineDays, bookingsByResource]'));
});
