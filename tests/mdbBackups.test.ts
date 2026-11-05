import test from 'node:test';
import assert from 'node:assert/strict';
import { listMdbBackups } from '../src/locks/database/mdbBackups';

test('listMdbBackups keeps only .mdb/.accdb files, sorted newest first', async () => {
  const makeHandle = (name: string, lastModified: number) => ({
    kind: 'file' as const,
    name,
    getFile: async () => ({ name, lastModified }),
  });

  const entries = [
    ['a.txt', makeHandle('a.txt', 100)],
    ['CardLock261104.MDB', makeHandle('CardLock261104.MDB', 500)],
    ['CardLock260611.mdb', makeHandle('CardLock260611.mdb', 200)],
    ['backup.accdb', makeHandle('backup.accdb', 900)],
    ['sub', { kind: 'directory' as const, name: 'sub', getFile: async () => { throw new Error('no'); } }],
  ];

  const handle = {
    entries: async function* () {
      for (const entry of entries) yield entry as never;
    },
  } as unknown as FileSystemDirectoryHandle;

  const list = await listMdbBackups(handle);
  assert.deepEqual(list.map((b) => b.name), ['backup.accdb', 'CardLock261104.MDB', 'CardLock260611.mdb']);
  assert.equal(list[0].lastModified, 900);
  assert.equal(list[2].lastModified, 200);
});
