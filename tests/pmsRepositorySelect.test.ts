import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { RESOURCE_GROUPS_WITH_RESOURCES_SELECT } from '../src/services/supabase/pmsRepository';

const repositorySource = readFileSync(
  new URL('../src/services/supabase/pmsRepository.ts', import.meta.url),
  'utf8',
);

test('resource group pull disambiguates the resources embed with the tenant FK', () => {
  assert.equal(
    RESOURCE_GROUPS_WITH_RESOURCES_SELECT,
    '*,resources!resources_group_tenant_fk(*)',
  );
  assert.doesNotMatch(RESOURCE_GROUPS_WITH_RESOURCES_SELECT, /(?:^|,)resources\(\*\)/);
});

test('listResourceGroups uses the tenant-safe relationship select', () => {
  assert.match(
    repositorySource,
    /db\.from\('resource_groups'\)\.select\(RESOURCE_GROUPS_WITH_RESOURCES_SELECT\)/,
  );
  assert.doesNotMatch(repositorySource, /\.select\('\*,resources\(\*\)'\)/);
});

test('listBookingsWindow paginates an overlap-safe window on the calendar index', () => {
  const functionStart = repositorySource.indexOf('export async function listBookingsWindow');
  const windowSource = repositorySource.slice(
    repositorySource.lastIndexOf('/**', functionStart),
    repositorySource.indexOf('export async function saveBooking'),
  );

  assert.ok(windowSource, 'listBookingsWindow must exist');
  assert.match(windowSource, /\.lte\('start_date', endDate\)/);
  assert.match(windowSource, /\.gte\('end_date', startDate\)/);
  assert.match(windowSource, /\.order\('start_date', \{ ascending: true \}\)/);
  assert.match(windowSource, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(windowSource, /\.range\(offset, Math\.max\(offset, offset \+ limit - 1\)\)/);
  assert.match(windowSource, /count: 'exact'/);
  assert.match(windowSource, /idx_bookings_calendar/);
  assert.doesNotMatch(windowSource, /\.select\('\*'\)/);
});

test('listBookings pages only the operational six-month projection', () => {
  const listSource = repositorySource.slice(
    repositorySource.indexOf('export async function listBookings('),
    repositorySource.indexOf('export async function listBookingsWindow'),
  );

  assert.ok(listSource, 'listBookings must exist');
  assert.match(listSource, /getBookingOperationalCutoffDate\(\)/);
  assert.match(listSource, /\.or\(\`end_date\.gte\.\$\{cutoffDate\},status\.not\.in\.\(checked_out,cancelled\)\`\)/);
  assert.match(listSource, /\.range\(offset, Math\.max\(offset, offset \+ pageSize - 1\)\)/);
  assert.match(listSource, /while \(first\.length === pageSize\)/);
  assert.match(listSource, /offset \+= page\.length/);
  assert.match(listSource, /if \(page\.length === 0\) break;/);
  assert.doesNotMatch(listSource, /0001-01-01|9999-12-31/);
});

test('saveResourceGroupRow upserts only the group row and never cascades resources', () => {
  const groupSource = repositorySource.slice(
    repositorySource.indexOf('export async function saveResourceGroupRow'),
    repositorySource.indexOf('export async function saveResource('),
  );

  assert.ok(groupSource, 'saveResourceGroupRow must exist');
  assert.match(groupSource, /db\.from\('resource_groups'\)\.upsert\(\{/);
  assert.match(groupSource, /establishment_id: establishmentId/);
  assert.match(groupSource, /domain: group\.sector/);
  assert.doesNotMatch(groupSource, /saveResource\(/);
});

test('saveEstablishment persists the real profile fields required by the backfill', () => {
  const establishmentSource = repositorySource.slice(
    repositorySource.indexOf('export async function saveEstablishment'),
    repositorySource.indexOf('export const RESOURCE_GROUPS_WITH_RESOURCES_SELECT'),
  );

  assert.ok(establishmentSource, 'saveEstablishment must exist');
  assert.match(establishmentSource, /domain: item\.domain \?\? 'hotel'/);
  assert.match(establishmentSource, /currency: item\.currency \?\? 'DZD'/);
  assert.match(establishmentSource, /country: item\.country \?\? ''/);
  assert.match(establishmentSource, /address: item\.address \?\? null/);
  assert.match(establishmentSource, /establishment_type: item\.establishmentType \?\? 'hotel'/);
});
