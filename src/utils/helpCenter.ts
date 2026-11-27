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

export function normalizeHelpSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
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

type HelpStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readCompletedTutorialIds(
  storage: Pick<Storage, 'getItem'> | null,
  validIds: readonly string[],
  key = 'omnibook_help_completed',
): string[] {
  try {
    const raw = storage?.getItem(key);
    return parseCompletedTutorialIds(raw ? JSON.parse(raw) : [], validIds);
  } catch {
    return [];
  }
}

export function writeCompletedTutorialIds(
  storage: HelpStorage | null,
  ids: readonly string[],
  validIds: readonly string[],
  key = 'omnibook_help_completed',
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(parseCompletedTutorialIds(ids, validIds)));
    return true;
  } catch {
    return false;
  }
}
