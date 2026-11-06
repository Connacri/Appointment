import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCardLockImport } from '../src/locks/cardLockMigration.ts';

const SITE = 0x033b;

test('re-importing the same hotel after a purge is allowed and drops the stale guard', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: SITE,
    currentSiteCode: undefined,
    hasLoadedDatabase: false,
    previousSite: String(SITE),
    recommissioningRequired: true,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: false, clearGuard: true });
});

test('going back to the previous hotel while a database is loaded stays blocked', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: SITE,
    currentSiteCode: 0x044c,
    hasLoadedDatabase: true,
    previousSite: String(SITE),
    recommissioningRequired: true,
  });

  assert.deepEqual(decision, { blocked: true, siteChanged: false, clearGuard: false });
});

test('re-importing the database that is already loaded never deadlocks', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: SITE,
    currentSiteCode: SITE,
    hasLoadedDatabase: true,
    previousSite: String(SITE),
    recommissioningRequired: true,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: false, clearGuard: true });
});

test('a plain disconnect/re-import of the same hotel clears the previous-site marker', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: SITE,
    currentSiteCode: undefined,
    hasLoadedDatabase: false,
    previousSite: String(SITE),
    recommissioningRequired: false,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: false, clearGuard: true });
});

test('importing a different hotel with a loaded database is a migration', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: 0x044c,
    currentSiteCode: SITE,
    hasLoadedDatabase: true,
    previousSite: null,
    recommissioningRequired: false,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: true, clearGuard: false });
});

test('importing a different hotel after a purge is a migration once the site is known', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: 0x044c,
    currentSiteCode: undefined,
    hasLoadedDatabase: false,
    previousSite: String(SITE),
    recommissioningRequired: true,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: true, clearGuard: false });
});

test('a first import on a fresh install is not a migration', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: SITE,
    currentSiteCode: undefined,
    hasLoadedDatabase: false,
    previousSite: null,
    recommissioningRequired: false,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: false, clearGuard: false });
});

test('a database without a system profile never triggers a false migration', () => {
  const decision = resolveCardLockImport({
    nextSiteCode: null,
    currentSiteCode: undefined,
    hasLoadedDatabase: false,
    previousSite: String(SITE),
    recommissioningRequired: true,
  });

  assert.deepEqual(decision, { blocked: false, siteChanged: false, clearGuard: false });
});
