import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
  resolveSupabaseConfig,
} from '../src/services/supabase/supabaseClient';

const baseInput = {
  storedUrl: '',
  storedPublishableKey: '',
  storedAnonKey: '',
  envUrl: '',
  envKey: '',
};

test('bundled project always uses the current shipped key, ignoring stale stored keys', () => {
  const resolved = resolveSupabaseConfig({
    ...baseInput,
    storedUrl: DEFAULT_SUPABASE_URL,
    storedAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stale-rotated-key',
  });
  assert.equal(resolved.url, DEFAULT_SUPABASE_URL);
  assert.equal(resolved.activeKey, DEFAULT_SUPABASE_PUBLISHABLE_KEY);
});

test('bundled project keeps an explicit environment key override', () => {
  const resolved = resolveSupabaseConfig({
    ...baseInput,
    envKey: 'sb_publishable_environment_override',
  });
  assert.equal(resolved.activeKey, 'sb_publishable_environment_override');
});

test('custom project URL keeps its explicitly paired key', () => {
  const resolved = resolveSupabaseConfig({
    ...baseInput,
    storedUrl: 'https://custom-project.supabase.co',
    storedPublishableKey: 'sb_publishable_custom_project_key',
  });
  assert.equal(resolved.url, 'https://custom-project.supabase.co');
  assert.equal(resolved.activeKey, 'sb_publishable_custom_project_key');
  assert.equal(resolved.isDefault, false);
});

test('custom project URL never inherits the bundled project key', () => {
  const resolved = resolveSupabaseConfig({
    ...baseInput,
    storedUrl: 'https://custom-project.supabase.co',
  });
  assert.equal(resolved.activeKey, '');
});

test('environment URL uses its paired environment key', () => {
  const resolved = resolveSupabaseConfig({
    ...baseInput,
    envUrl: 'https://env-project.supabase.co',
    envKey: 'sb_publishable_env_project_key',
  });
  assert.equal(resolved.url, 'https://env-project.supabase.co');
  assert.equal(resolved.activeKey, 'sb_publishable_env_project_key');
});
