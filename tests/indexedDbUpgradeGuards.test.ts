import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dbSource = readFileSync(new URL('../src/db/indexedDb.ts', import.meta.url), 'utf8');

test('upgrade checks an object store exists before opening it for index changes', () => {
  assert.match(
    dbSource,
    /db\.objectStoreNames\.contains\('bookingArchiveRecords'\)[\s\S]*?objectStore\('bookingArchiveRecords'\)/,
  );
  assert.match(
    dbSource,
    /db\.objectStoreNames\.contains\('p2pTransportQueue'\)[\s\S]*?objectStore\('p2pTransportQueue'\)/,
  );
});

test('new archive and P2P queue stores are created with every index required by readers', () => {
  assert.match(
    dbSource,
    /createObjectStore\('bookingArchiveRecords'[\s\S]*?createIndex\('workspaceStartDate', \['workspaceId', 'startDate'\]/,
  );
  assert.match(
    dbSource,
    /createObjectStore\('p2pTransportQueue'[\s\S]*?createIndex\('workspaceEntity', \['workspaceId', 'event\.entity', 'event\.entityId'\]/,
  );
});
