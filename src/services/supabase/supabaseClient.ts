import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Public client configuration defaults to the Appointment Supabase project.
// Environment variables override these defaults for staging, local development,
// previews, or another deployment target. Never use a service_role key here.
export const DEFAULT_SUPABASE_URL = 'https://vkmgakmujipnpjlawjqm.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yIVkxXo_x--f6FWt5zua1w_GzqI5XNv';

export const SUPABASE_URL_STORAGE_KEY = 'appointment_supabase_url';
export const SUPABASE_PUBLISHABLE_KEY_STORAGE_KEY = 'appointment_supabase_publishable_key';
export const SUPABASE_ANON_KEY_STORAGE_KEY = 'appointment_supabase_anon_key';

export interface SupabaseRuntimeConfig {
  url: string;
  publishableKey: string;
  anonKey: string;
  activeKey: string;
  isDefault: boolean;
}

export interface SupabaseConfigInput {
  storedUrl: string;
  storedPublishableKey: string;
  storedAnonKey: string;
  envUrl: string;
  envKey: string;
}

/**
 * Pure resolver shared by runtime config and regression tests.
 *
 * A legacy anon key can be rotated in the Supabase dashboard. When the app points
 * at its bundled project, always use the key shipped with this build so a stale
 * key saved earlier in localStorage cannot make auth fail with "Invalid API key".
 * A genuinely different project keeps using the key explicitly paired with it.
 */
export function resolveSupabaseConfig(input: SupabaseConfigInput): SupabaseRuntimeConfig {
  const storedUrlValue = input.storedUrl.trim();
  const envUrl = input.envUrl.trim();
  const envKey = input.envKey.trim();
  const url = storedUrlValue || envUrl || DEFAULT_SUPABASE_URL;
  const storedKey = input.storedPublishableKey.trim() || input.storedAnonKey.trim();
  const activeKey =
    url === DEFAULT_SUPABASE_URL
      ? envKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY
      : storedUrlValue
        ? storedKey
        : envKey;

  return {
    url,
    publishableKey: input.storedPublishableKey.trim(),
    anonKey: input.storedAnonKey.trim(),
    activeKey,
    isDefault: !storedUrlValue && url === DEFAULT_SUPABASE_URL,
  };
}

export function readSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  let storedUrl = '';
  let storedPublishableKey = '';
  let storedAnonKey = '';
  if (typeof window !== 'undefined') {
    try {
      storedUrl = localStorage.getItem(SUPABASE_URL_STORAGE_KEY) || '';
      storedPublishableKey = localStorage.getItem(SUPABASE_PUBLISHABLE_KEY_STORAGE_KEY) || '';
      storedAnonKey = localStorage.getItem(SUPABASE_ANON_KEY_STORAGE_KEY) || '';
    } catch {
      // Ignore storage access failures in restricted environments
    }
  }

  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return resolveSupabaseConfig({
    storedUrl,
    storedPublishableKey,
    storedAnonKey,
    envUrl: env.VITE_SUPABASE_URL ?? '',
    envKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  });
}

function buildSupabaseClient(): { configured: boolean; client: SupabaseClient<Database> | null } {
  const cfg = readSupabaseRuntimeConfig();
  const configured = Boolean(cfg.url && cfg.activeKey);
  if (!configured) {
    return { configured: false, client: null };
  }
  const client = createClient<Database>(cfg.url, cfg.activeKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    db: { schema: 'public' },
  });
  return { configured: true, client };
}

const initial = buildSupabaseClient();

export let isSupabaseConfigured = initial.configured;
export let supabase: SupabaseClient<Database> | null = initial.client;

if (!isSupabaseConfigured) {
  console.warn('[Appointment] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

const configListeners = new Set<() => void>();

export function onSupabaseConfigChange(listener: () => void): () => void {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

export function reconfigureSupabaseClient(): void {
  const next = buildSupabaseClient();
  isSupabaseConfigured = next.configured;
  supabase = next.client;
  for (const listener of configListeners) {
    try {
      listener();
    } catch (error) {
      console.error('[Appointment] Supabase config listener failed:', error);
    }
  }
}

export function saveSupabaseRuntimeConfig(url: string, publishableKey: string, anonKey = ''): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUPABASE_URL_STORAGE_KEY, url.trim());
  localStorage.setItem(SUPABASE_PUBLISHABLE_KEY_STORAGE_KEY, publishableKey.trim());
  localStorage.setItem(SUPABASE_ANON_KEY_STORAGE_KEY, anonKey.trim());
  reconfigureSupabaseClient();
}

export function resetSupabaseRuntimeConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPABASE_URL_STORAGE_KEY);
  localStorage.removeItem(SUPABASE_PUBLISHABLE_KEY_STORAGE_KEY);
  localStorage.removeItem(SUPABASE_ANON_KEY_STORAGE_KEY);
  reconfigureSupabaseClient();
}

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}
