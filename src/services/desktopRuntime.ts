import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export interface NativeCardLockCandidate {
  path: string;
  modifiedUnixMs: number | null;
  sizeBytes: number;
}

export interface DesktopRuntimeInfo {
  native: boolean;
  filesystem: boolean;
  windowsCredentialManager: boolean;
  runtime: string;
}

export const isNativeDesktop = (): boolean => isTauri();

export async function getDesktopRuntimeInfo(): Promise<DesktopRuntimeInfo | null> {
  if (!isTauri()) return null;
  return invoke<DesktopRuntimeInfo>('desktop_runtime_info');
}

export async function discoverNativeCardLockFiles(): Promise<NativeCardLockCandidate[]> {
  if (!isTauri()) return [];
  return invoke<NativeCardLockCandidate[]>('discover_cardlock_candidates');
}

async function readNativeCardLock(path: string): Promise<File> {
  const encoded = await invoke<string>('read_cardlock_file', { path });
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const name = path.split(/[\\/]/).pop() || 'CardLock.mdb';
  return new File([bytes], name, { type: 'application/x-msaccess', lastModified: Date.now() });
}

export async function pickNativeCardLockFile(): Promise<File | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    title: 'Sélectionner la base proUSB CardLock',
    filters: [{ name: 'Microsoft Access database', extensions: ['mdb'] }],
  });
  if (typeof selected !== 'string') return null;
  return readNativeCardLock(selected);
}

export async function readDiscoveredCardLock(candidate: NativeCardLockCandidate): Promise<File> {
  if (!isTauri()) throw new Error('Le runtime natif Windows est requis.');
  return readNativeCardLock(candidate.path);
}

const ALLOWED_SECRET_KEYS = new Set([
  'supabase.publishable_key',
  'supabase.anon_key',
  'neon.connection_string',
  'google.refresh_token',
]);

export async function getNativeSecret(key: string): Promise<string | null> {
  if (!isTauri() || !ALLOWED_SECRET_KEYS.has(key)) return null;
  return invoke<string | null>('secure_secret_get', { key });
}

export async function setNativeSecret(key: string, value: string): Promise<void> {
  if (!isTauri()) throw new Error('Credential Manager nécessite le runtime natif Windows.');
  if (!ALLOWED_SECRET_KEYS.has(key)) throw new Error('Type de credential non autorisé.');
  await invoke('secure_secret_set', { key, value });
}

export async function deleteNativeSecret(key: string): Promise<void> {
  if (!isTauri()) throw new Error('Credential Manager nécessite le runtime natif Windows.');
  if (!ALLOWED_SECRET_KEYS.has(key)) throw new Error('Type de credential non autorisé.');
  await invoke('secure_secret_delete', { key });
}
