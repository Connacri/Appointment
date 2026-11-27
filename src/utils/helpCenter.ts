export interface HelpTutorialSearchable {
  id: string;
  category: string;
  title: Record<string, string>;
  summary: Record<string, string>;
  prerequisites: Record<string, readonly string[]>;
  steps: Record<string, readonly string[]>;
  result: Record<string, string>;
  warnings: Record<string, readonly string[]>;
  tips: Record<string, readonly string[]>;
}

export const APPOINTMENT_ACADEMY_PROGRESS_KEY = 'appointment_academy_completed_v1';
export const LEGACY_ACADEMY_PROGRESS_KEY = 'omnibook_help_completed';

export function normalizeHelpSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\\s+/g, ' ')
    .trim();
}

export function filterHelpTutorials<T extends HelpTutorialSearchable>(
  tutorials: readonly T[],
  category: string,
  query: string,
): T[] {
  const normalizedQuery = normalizeHelpSearchText(query);
  return tutorials.filter((tutorial) => {
    if (category !== 'all' && tutorial.category !== category) return false;
    if (!normalizedQuery) return true;

    const searchableText = [
      tutorial.id,
      tutorial.category,
      ...Object.values(tutorial.title),
      ...Object.values(tutorial.summary),
      ...Object.values(tutorial.prerequisites).flat(),
      ...Object.values(tutorial.steps).flat(),
      ...Object.values(tutorial.result),
      ...Object.values(tutorial.warnings).flat(),
      ...Object.values(tutorial.tips).flat(),
    ].join(' ');

    return normalizeHelpSearchText(searchableText).includes(normalizedQuery);
  });
}

export function parseCompletedTutorialIds(value: unknown, validIds: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set(validIds);
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && valid.has(id)))];
}

type HelpStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>>;

export function readCompletedTutorialIds(
  storage: HelpStorage | null,
  validIds: readonly string[],
  key = APPOINTMENT_ACADEMY_PROGRESS_KEY,
  legacyKey = LEGACY_ACADEMY_PROGRESS_KEY,
): string[] {
  try {
    const currentRaw = storage?.getItem(key);
    if (currentRaw !== null && currentRaw !== undefined) {
      return parseCompletedTutorialIds(JSON.parse(currentRaw), validIds);
    }

    const legacyRaw = storage?.getItem(legacyKey);
    if (!legacyRaw) return [];
    const migrated = parseCompletedTutorialIds(JSON.parse(legacyRaw), validIds);
    try {
      storage?.setItem?.(key, JSON.stringify(migrated));
    } catch {
      // Keep the readable legacy value when storage is temporarily read-only.
    }
    return migrated;
  } catch {
    return [];
  }
}

export function writeCompletedTutorialIds(
  storage: HelpStorage | null,
  ids: readonly string[],
  validIds: readonly string[],
  key = APPOINTMENT_ACADEMY_PROGRESS_KEY,
): boolean {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(key, JSON.stringify(parseCompletedTutorialIds(ids, validIds)));
    return true;
  } catch {
    return false;
  }
}
