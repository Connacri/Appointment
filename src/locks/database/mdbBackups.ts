/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sauvegardes CardLock — listing via la File System Access API.
 *
 * Le chemin exact du dossier de sauvegarde dépend de la plateforme et est
 * fourni par `getCardLockBackupDirectoryPath()` (source de vérité :
 * `mdbPaths.ts`). Sur Windows proUSB, il s'agit de `D:\proUSB_DBBak`.
 *
 * Un navigateur ne peut pas lister un disque local tout seul. On utilise
 * `window.showDirectoryPicker`, disponible sous Chromium, Edge et le WebView2
 * empaqueté. Partout ailleurs (Firefox, Safari, Android natif via WebView sans
 * support) `canListDirectory()` retourne false et l'appelleur retombe sur un
 * simple `<input type="file">` : l'utilisateur navigue alors lui-même jusqu'au
 * dossier exact de sa plateforme.
 *
 * Tout est côté navigateur : aucun chemin local n'est jamais envoyé au serveur.
 */

import { getCardLockBackupDirectoryPath } from './mdbPaths';

/** Exact backup directory path for the current platform, or null if none. */
export const CARDLOCK_BACKUP_DIRECTORY_PATH = getCardLockBackupDirectoryPath();

export { getCardLockBackupDirectoryPath };

export interface MdbBackupFile {
  /** Nom du fichier tel que vu sur le disque (`CardLock261104.MDB`). */
  name: string;
  /** `File.lastModified` en epoch ms, ou null si le navigateur ne l'expose pas. */
  lastModified: number | null;
  file: File;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
      id?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}

export function canListDirectory(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Ouvre le sélecteur de dossier. Retourne `null` si l'API n'existe pas ou si
 * l'utilisateur annule — jamais une exception, l'appelleur n'a rien à rattraper.
 */
export async function pickMdbBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!canListDirectory()) return null;
  try {
    // `id` makes the browser remember the last chosen directory for this picker.
    // The exact platform path is surfaced in the UI; the sandbox prevents opening it programmatically.
    return await window.showDirectoryPicker!({ mode: 'read', id: 'cardlock-mdb-backups' });
  } catch {
    return null;
  }
}

const MDB_EXTENSION = /\.(mdb|accdb)$/i;

/**
 * Fichiers `.mdb`/`.accdb` du dossier, du plus récent au plus ancien.
 * Un fichier verrouillé ou inaccessible est ignoré plutôt que de faire échouer
 * tout le dossier : l'utilisateur pourra toujours l'importer via `<input>`.
 */
export async function listMdbBackups(handle: FileSystemDirectoryHandle): Promise<MdbBackupFile[]> {
  const backups: MdbBackupFile[] = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== 'file' || !MDB_EXTENSION.test(name)) continue;
    try {
      const file = await (entry as FileSystemFileHandle).getFile();
      backups.push({
        name,
        lastModified: Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : null,
        file,
      });
    } catch {
      // ignore inaccessible file
    }
  }
  return backups.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
}