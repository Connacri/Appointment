import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const billing = readFileSync(new URL('../src/components/BillingInvoicingView.tsx', import.meta.url), 'utf8');

function section(start: string, end: string): string {
  const from = app.indexOf(start);
  assert.notEqual(from, -1, `missing section: ${start}`);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return app.slice(from, to);
}

test('generic business upserts and deletes are guarded before durable queue writes', () => {
  assert.match(section('const queueBusinessUpsert', 'const queueBusinessDelete'), /assertBusinessMutationAllowed/);
  assert.match(section('const queueBusinessDelete', 'const commitBusinessUpsert'), /assertBusinessMutationAllowed/);
  assert.match(section('const commitBusinessUpsert', 'const commitBusinessDelete'), /assertBusinessMutationAllowed/);
  assert.match(section('const commitBusinessDelete', 'const reportQueueFailure'), /assertBusinessMutationAllowed/);
});

test('stock, housekeeping and procurement critical writes are guarded', () => {
  assert.match(section('const persistStockMutationsAtomically', 'const queueBusinessDelete'), /assertBusinessMutationAllowed/);
  assert.match(section('const updateHousekeepingStatus', 'const checkConflict'), /assertBusinessMutationAllowed/);
  assert.match(section('const markPurchaseOrderReceived', 'const applyDynamicRatesBulk'), /assertBusinessMutationAllowed/);
  assert.match(section('const deleteStockItem', 'const recordRoomReplenishment'), /assertBusinessMutationAllowed/);
});

test('invoice, dynamic pricing and role configuration writes are guarded', () => {
  assert.match(section('const createInvoiceFromBooking', 'const setClientProfile'), /assertBusinessMutationAllowed/);
  assert.match(section('const setDynamicRate', 'const createStaffMember'), /assertBusinessMutationAllowed/);
  assert.match(section('const persistRolesConfig', 'const createCustomRole'), /assertBusinessMutationAllowed/);
  assert.match(billing, /const handleCreateDocument[\s\S]*?assertBusinessMutationAllowed\(\)/);
});

test('raw booking and resource setters cannot bypass the mutation policy', () => {
  assert.match(app, /setBookings: \(next\) => \{ assertBusinessMutationAllowed\(true\); setBookings\(next\); \}/);
  assert.match(app, /setResourceGroups: \(next\) => \{ assertBusinessMutationAllowed\(true\); setResourceGroups\(next\); \}/);
});

test('initial establishment setup is the only no-registry bootstrap exception', () => {
  assert.match(app, /if \(allowInitialSetup && !hasOnboardedRef\.current && !deviceRegistry\) return/);
});
