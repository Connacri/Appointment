import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const billing = readFileSync(new URL('../src/components/BillingInvoicingView.tsx', import.meta.url), 'utf8');
const proUsb = readFileSync(new URL('../src/components/ProUsbLockSystemView.tsx', import.meta.url), 'utf8');
const bookingModal = readFileSync(new URL('../src/components/BookingModal.tsx', import.meta.url), 'utf8');
const setupModal = readFileSync(new URL('../src/components/EstablishmentSetupModal.tsx', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../src/components/IndexedDbInspectorModal.tsx', import.meta.url), 'utf8');
const myBookings = readFileSync(new URL('../src/components/MyBookingsView.tsx', import.meta.url), 'utf8');
const channelManager = readFileSync(new URL('../src/components/ChannelManagerView.tsx', import.meta.url), 'utf8');
const spaManagement = readFileSync(new URL('../src/components/SpaManagementView.tsx', import.meta.url), 'utf8');
const cloudConfig = readFileSync(new URL('../src/components/CloudConfigPanel.tsx', import.meta.url), 'utf8');
const eventLogView = readFileSync(new URL('../src/components/EventLogView.tsx', import.meta.url), 'utf8');
const staffHr = readFileSync(new URL('../src/components/StaffHrPanel.tsx', import.meta.url), 'utf8');
const tasksView = readFileSync(new URL('../src/components/TasksManagementView.tsx', import.meta.url), 'utf8');
const housekeepingView = readFileSync(new URL('../src/components/HousekeepingView.tsx', import.meta.url), 'utf8');
const roleManagement = readFileSync(new URL('../src/components/RoleManagementView.tsx', import.meta.url), 'utf8');

function sectionProUsb(start: string, end: string): string {
  const from = proUsb.indexOf(start);
  assert.notEqual(from, -1, `missing ProUSB section: ${start}`);
  const to = proUsb.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing ProUSB end marker: ${end}`);
  return proUsb.slice(from, to);
}

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
  assert.match(app, /const assertBusinessMutationAllowed = \(allowInitialSetup = false\): void => \{/);
  assert.match(app, /const assertInitialSetupMutationAllowed = \(\): void => \{\s+assertBusinessMutationAllowed\(true\)/);
  assert.match(app, /assertBusinessMutationAllowed: \(\) => assertBusinessMutationAllowed\(\)/);
  assert.match(app, /assertInitialSetupMutationAllowed,/);
});


test('customer profile and onboarding mutations respect the topology gate', () => {
  assert.match(section('const setHasOnboarded', '// 1ère ouverture'), /assertBusinessMutationAllowed\(true\)/);
  assert.match(section('const setClientProfile', 'const [selectedBooking'), /assertBusinessMutationAllowed\(\)/);
});

test('physical lock card issuance, revocation, settings and destructive actions are guarded', () => {
  assert.match(proUsb, /const runWithCardProgress[\s\S]*?assertBusinessMutationAllowed\(\)/);
  assert.match(sectionProUsb('const confirmRevoke', 'const cancelRevoke'), /runGuardedLockMutation/);
  assert.match(proUsb, /const runGuardedLockMutation[\s\S]*?assertBusinessMutationAllowed\(\)/);
  assert.match(proUsb, /runGuardedLockMutation\(\(\) => \{\s*lockManager\.clearMdb\(\)/);
  assert.match(proUsb, /runGuardedLockMutation\(\(\) => \{\s*lockManager\.clearPersistedData\(\)/);
  assert.match(proUsb, /runGuardedLockMutation\(\(\) => lockManager\.updateSettings\(\{ guestAccessBolt:/);
  assert.match(proUsb, /runGuardedLockMutation\(\(\) => lockManager\.clearLogs\(\)\)/);
});

test('CardLock imports and BookingModal card writes check device mutation authority first', () => {
  assert.match(sectionProUsb('const handleImportMdb', 'const handleIssueCommissioning'), /assertBusinessMutationAllowed\(\)/);
  assert.match(setupModal, /assertInitialSetupMutationAllowed\(\)[\s\S]*?lockManager\.importMdb/);
  assert.match(inspector, /assertBusinessMutationAllowed\(\)[\s\S]*?lockManager\.importMdb/);
  assert.match(bookingModal, /const handleCreateRoomCard[\s\S]*?assertBusinessMutationAllowed\(\)/);
});

test('read-only UI disables high-risk profile, booking and lock controls', () => {
  assert.match(myBookings, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
  assert.match(proUsb, /disabled=\{!deviceMutationAvailability\.canMutate \|\| isWriting\}/);
  assert.match(proUsb, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
});


test('OTA channel and Spa mutations are rejected and disabled in read-only mode', () => {
  assert.match(channelManager, /const handleCreateChannel[\s\S]*?assertBusinessMutationAllowed\(\)/);
  assert.match(channelManager, /const handleExecuteResolution[\s\S]*?assertBusinessMutationAllowed\(\)/);
  assert.match(channelManager, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
  assert.match(spaManagement, /const handleCreateAppointment[\s\S]*?assertBusinessMutationAllowed\(\)/);
  assert.match(spaManagement, /const handleUpdateAppointmentStatus[\s\S]*?assertBusinessMutationAllowed\(\)/);
  assert.match(spaManagement, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
});

test('Supabase runtime configuration remains editable only during explicit first-run bootstrap or writable mode', () => {
  assert.match(cloudConfig, /assertInitialSetupMutationAllowed\(\)/);
  assert.match(cloudConfig, /canEditCloudConfig = deviceMutationAvailability\.canMutate \|\| \(!hasOnboarded && !deviceRegistry\)/);
  assert.match(inspector, /assertInitialSetupMutationAllowed\(\)/);
  assert.match(inspector, /disabled=\{!canEditCloudConfig\}/);
});


test('audit-log deletion is a guarded mutation and disabled without write authority', () => {
  assert.match(section('const clearEventLogs = async', 'const createMutationId'), /assertBusinessMutationAllowed\(\)/);
  assert.match(eventLogView, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
});


test('staff, task, housekeeping and role mutation controls are disabled without write authority', () => {
  assert.match(staffHr, /deviceMutationAvailability\.canMutate/);
  assert.match(staffHr, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
  assert.match(tasksView, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
  assert.match(housekeepingView, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
  assert.match(roleManagement, /disabled=\{!deviceMutationAvailability\.canMutate\}/);
});
