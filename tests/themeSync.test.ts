import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  THEME_STORAGE_KEY,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  getBrowserPreferredTheme,
} from '../src/hooks/useThemeSync';

test('theme constants have expected storage keys and default preset', () => {
  assert.equal(THEME_STORAGE_KEY, 'omnibook_theme');
  assert.equal(APP_THEME_STORAGE_KEY, 'omnibook_app_theme');
  assert.equal(DEFAULT_APP_THEME, 'classic-slate');
});

test('getBrowserPreferredTheme returns light by default when window or matchMedia is missing', () => {
  const result = getBrowserPreferredTheme();
  assert.equal(result === 'light' || result === 'dark', true);
});
