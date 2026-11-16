/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exact, platform-specific locations of the real proUSB/CardLock database.
 *
 * These paths are the single source of truth used by the UI, import guidance,
 * and backup discovery. Reading a path is never attempted automatically in
 * sandboxed environments (web/PWA/Capacitor WebView): the browser cannot open
 * arbitrary filesystem paths, so callers must always go through an explicit
 * user file/directory picker and use these values as the canonical locations to
 * show and prefer.
 */

export type MdbPlatform = 'windows' | 'android' | 'web';

export interface CardLockMdbPlatformPaths {
  platform: MdbPlatform;
  /** Exact path to the live CardLock.mdb for this platform, or null when none. */
  liveMdbPath: string | null;
  /** Legacy field retained for compatibility; set to the live MDB path to use (no separate Program Files path kept). */
  programFilesMdbPath: string | null;
  /** Exact path to the automatic backup directory, when applicable. */
  backupDirectoryPath: string | null;
  /** Human-readable note about how this platform accesses the database. */
  accessNote: string;
}

/**
 * Exact Windows paths for proUSB Hotel Lock System.
 * - Live DB: written by CardLock.exe under UAC virtualization (VirtualStore).
 * - Backups: automatic copies written by proUSB.
 */
export const WINDOWS_CARDLOCK_MDB_PATHS: CardLockMdbPlatformPaths = {
  platform: 'windows',
  liveMdbPath:
    '%LOCALAPPDATA%\\VirtualStore\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',
  programFilesMdbPath:
    '%LOCALAPPDATA%\\VirtualStore\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',
  backupDirectoryPath: 'D:\\proUSB_DBBak',
  accessNote:
    'Windows (proUSB desktop): utilisez la base vivante (VirtualStore) au chemin exact. Sélectionnez-la manuellement dans le sélecteur de fichiers ; le navigateur ne peut pas lire ce chemin directement.',
};

/**
 * Exact Android paths. proUSB/CardLock is Windows software and does not produce a
 * live VirtualStore database on Android; import requires a user-selected .mdb
 * file (e.g. a copy transferred to device storage).
 */
export const ANDROID_CARDLOCK_MDB_PATHS: CardLockMdbPlatformPaths = {
  platform: 'android',
  liveMdbPath: null,
  programFilesMdbPath: null,
  backupDirectoryPath: null,
  accessNote:
    'Android: no local proUSB VirtualStore database. Import a CardLock.mdb file selected by the user from device storage.',
};

/**
 * Generic web (non-Windows) paths. No direct filesystem path is accessible from
 * the browser sandbox; import is always user-selected.
 */
export const WEB_CARDLOCK_MDB_PATHS: CardLockMdbPlatformPaths = {
  platform: 'web',
  liveMdbPath: null,
  programFilesMdbPath: null,
  backupDirectoryPath: null,
  accessNote:
    'Web: the browser cannot access local database paths directly. Import a CardLock.mdb file selected by the user.',
};

function isWindowsUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform
    || '';
  return /Win/i.test(platform) || /Windows/i.test(ua);
}

/**
 * Resolves the current runtime platform for CardLock MDB access.
 * - Capacitor native Android -> android
 * - Web/PWA running on Windows -> windows (uses exact proUSB VirtualStore path)
 * - Web/PWA running elsewhere -> web
 */
export function getMdbPlatform(): MdbPlatform {
  if (typeof window !== 'undefined') {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }).Capacitor;
    const native = cap?.isNativePlatform?.() ?? false;
    const platform = cap?.getPlatform?.();
    if (native && platform === 'android') return 'android';
    if (platform === 'android') return 'android';
  }
  return isWindowsUserAgent() ? 'windows' : 'web';
}

export function getCardLockMdbPaths(platform: MdbPlatform = getMdbPlatform()): CardLockMdbPlatformPaths {
  switch (platform) {
    case 'windows':
      return WINDOWS_CARDLOCK_MDB_PATHS;
    case 'android':
      return ANDROID_CARDLOCK_MDB_PATHS;
    default:
      return WEB_CARDLOCK_MDB_PATHS;
  }
}

export function getLiveCardLockMdbPath(platform: MdbPlatform = getMdbPlatform()): string | null {
  return getCardLockMdbPaths(platform).liveMdbPath;
}

/** @deprecated No separate Program Files path is kept; returns the live MDB path to use. */
export function getProgramFilesCardLockMdbPath(platform: MdbPlatform = getMdbPlatform()): string | null {
  return getCardLockMdbPaths(platform).programFilesMdbPath;
}

export function getCardLockBackupDirectoryPath(platform: MdbPlatform = getMdbPlatform()): string | null {
  return getCardLockMdbPaths(platform).backupDirectoryPath;
}
