import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANDROID_CARDLOCK_MDB_PATHS,
  WEB_CARDLOCK_MDB_PATHS,
  WINDOWS_CARDLOCK_MDB_PATHS,
  getCardLockBackupDirectoryPath,
  getCardLockMdbPaths,
  getLiveCardLockMdbPath,
  getProgramFilesCardLockMdbPath,
} from '../src/locks/database/mdbPaths.ts';

test('defines exact Windows CardLock MDB paths', () => {
  assert.equal(WINDOWS_CARDLOCK_MDB_PATHS.platform, 'windows');
  assert.equal(
    WINDOWS_CARDLOCK_MDB_PATHS.liveMdbPath,
    '%LOCALAPPDATA%\\VirtualStore\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',
  );
  // No separate Program Files path is kept; the live path is the one to use.
  assert.equal(WINDOWS_CARDLOCK_MDB_PATHS.programFilesMdbPath, WINDOWS_CARDLOCK_MDB_PATHS.liveMdbPath);
  assert.equal(WINDOWS_CARDLOCK_MDB_PATHS.backupDirectoryPath, 'D:\\proUSB_DBBak');
});

test('defines Android CardLock MDB paths without invented local proUSB path', () => {
  assert.equal(ANDROID_CARDLOCK_MDB_PATHS.platform, 'android');
  assert.equal(ANDROID_CARDLOCK_MDB_PATHS.liveMdbPath, null);
  assert.equal(ANDROID_CARDLOCK_MDB_PATHS.programFilesMdbPath, null);
  assert.equal(ANDROID_CARDLOCK_MDB_PATHS.backupDirectoryPath, null);
  assert.match(ANDROID_CARDLOCK_MDB_PATHS.accessNote, /Android/i);
});

test('defines generic web CardLock MDB paths without direct filesystem access', () => {
  assert.equal(WEB_CARDLOCK_MDB_PATHS.platform, 'web');
  assert.equal(WEB_CARDLOCK_MDB_PATHS.liveMdbPath, null);
  assert.equal(WEB_CARDLOCK_MDB_PATHS.programFilesMdbPath, null);
  assert.equal(WEB_CARDLOCK_MDB_PATHS.backupDirectoryPath, null);
  assert.match(WEB_CARDLOCK_MDB_PATHS.accessNote, /Web|browser/i);
});

test('returns platform-specific paths through helpers', () => {
  assert.deepEqual(getCardLockMdbPaths('windows'), WINDOWS_CARDLOCK_MDB_PATHS);
  assert.deepEqual(getCardLockMdbPaths('android'), ANDROID_CARDLOCK_MDB_PATHS);
  assert.deepEqual(getCardLockMdbPaths('web'), WEB_CARDLOCK_MDB_PATHS);

  assert.equal(getLiveCardLockMdbPath('windows'), WINDOWS_CARDLOCK_MDB_PATHS.liveMdbPath);
  assert.equal(getProgramFilesCardLockMdbPath('windows'), WINDOWS_CARDLOCK_MDB_PATHS.programFilesMdbPath);
  assert.equal(getCardLockBackupDirectoryPath('windows'), WINDOWS_CARDLOCK_MDB_PATHS.backupDirectoryPath);

  assert.equal(getLiveCardLockMdbPath('android'), null);
  assert.equal(getCardLockBackupDirectoryPath('web'), null);
});
