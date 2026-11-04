import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Public client configuration defaults to the Appointment Supabase project.
// Environment variables override these defaults for staging, local development,
// previews, or another deployment target. Never use a service_role key here.
const DEFAULT_SUPABASE_URL = 'https://vkmgakmujipnpjlawjqm.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yIVkxXo_x--f6FWt5zua1w_GzqI5XNv';

function readRuntimeConfig() {
  if (typeof window === 'undefined') return { url: '', publishableKey: '', anonKey: '' };
  try {
    return {
      url: localStorage.getItem('appointment_supabase_url') || '',
      publishableKey: localStorage.getItem('appointment_supabase_publishable_key') || '',
      anonKey: localStorage.getItem('appointment_supabase_anon_key') || '',
    };
  } catch { return { url: '', publishableKey: '', anonKey: '' }; }
}
const runtimeConfig = readRuntimeConfig();
const supabaseUrl = runtimeConfig.url || (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || DEFAULT_SUPABASE_URL;
// Never pair a user-supplied project URL with another project's default public key.
const supabasePublishableKey = runtimeConfig.url
  ? runtimeConfig.publishableKey || runtimeConfig.anonKey
  : (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured) {
  console.warn('[Appointment] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      db: { schema: 'public' },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}
