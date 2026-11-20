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
