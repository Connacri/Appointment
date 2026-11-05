/**
 * i18n parity gate (AGENTS.md §9).
 *
 * Fails when a translation key is missing, empty, or declared for a language
 * that is not supported, and when interpolation placeholders differ between
 * the French, English and Arabic variants of the same key.
 *
 * Usage: npm run i18n:check
 */

import { translations } from '../src/i18n/translations';

const LANGUAGES = ['fr', 'en', 'ar'] as const;
type Language = (typeof LANGUAGES)[number];

type Entry = Partial<Record<Language, string>> & Record<string, unknown>;

const problems: string[] = [];
const entries = Object.entries(translations as unknown as Record<string, Entry>);

const placeholdersOf = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

for (const [key, entry] of entries) {
  if (!entry || typeof entry !== 'object') {
    problems.push(`${key}: expected an object with fr/en/ar variants`);
    continue;
  }

  for (const language of Object.keys(entry)) {
    if (!LANGUAGES.includes(language as Language)) {
      problems.push(`${key}: unsupported language "${language}"`);
    }
  }

  let reference: string[] | null = null;
  let referenceLanguage: Language | null = null;

  for (const language of LANGUAGES) {
    const value = entry[language];

    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${key}: missing or empty "${language}" value`);
      continue;
    }

    const placeholders = placeholdersOf(value);

    if (reference === null) {
      reference = placeholders;
      referenceLanguage = language;
      continue;
    }

    const missing = reference.filter((name) => !placeholders.includes(name));
    const extra = placeholders.filter((name) => !reference!.includes(name));

    if (missing.length || extra.length) {
      const details = [
        missing.length ? `missing ${missing.map((n) => `{${n}}`).join(', ')}` : '',
        extra.length ? `unexpected ${extra.map((n) => `{${n}}`).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      problems.push(`${key}: placeholder mismatch in "${language}" vs "${referenceLanguage}" (${details})`);
    }
  }
}

if (problems.length) {
  console.error(`i18n check failed — ${problems.length} problem(s) across ${entries.length} keys:`);
  for (const problem of problems) {
    console.error(`  • ${problem}`);
  }
  process.exit(1);
}

console.log(
  `i18n check passed — ${entries.length} keys × ${LANGUAGES.length} languages (${LANGUAGES.join('/')}).`,
);
