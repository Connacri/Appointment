import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPOINTMENT_ACADEMY_PROGRESS_KEY,
  LEGACY_ACADEMY_PROGRESS_KEY,
  filterHelpTutorials,
  normalizeHelpSearchText,
  parseCompletedTutorialIds,
  readCompletedTutorialIds,
  writeCompletedTutorialIds,
} from '../src/utils/helpCenter';

const tutorials = [
  {
    id: 'planning',
    category: 'reservations',
    title: { fr: 'Planning Gantt', en: 'Gantt planner', ar: 'مخطط جانت' },
    summary: { fr: 'Disponibilités des chambres', en: 'Room availability', ar: 'توفر الغرف' },
    prerequisites: { fr: ['Choisir le bon bâtiment'], en: ['Select the correct building'], ar: ['اختر المبنى الصحيح'] },
    steps: { fr: ['Vérifier les dates de réservation'], en: ['Check booking dates'], ar: ['تحقق من تواريخ الحجز'] },
    result: { fr: 'Occupation lisible', en: 'Readable occupancy', ar: 'إشغال واضح' },
    warnings: { fr: ['Une chambre hors service ne peut pas être attribuée'], en: ['Do not assign an out-of-order room'], ar: ['لا تخصص غرفة خارج الخدمة'] },
    tips: { fr: ['Filtrer par bâtiment'], en: ['Filter by building'], ar: ['تصفية حسب المبنى'] },
  },
  {
    id: 'locks',
    category: 'access',
    title: { fr: 'Serrures proUSB', en: 'proUSB locks', ar: 'أقفال proUSB' },
    summary: { fr: 'Cartes et programmation', en: 'Cards and programming', ar: 'البطاقات والبرمجة' },
    prerequisites: { fr: ['Accès au programmateur'], en: ['Programmer access'], ar: ['الوصول إلى المبرمج'] },
    steps: { fr: ['Importer CardLock MDB'], en: ['Import CardLock MDB'], ar: ['استيراد قاعدة CardLock'] },
    result: { fr: 'Données de serrures importées', en: 'Lock data imported', ar: 'تم استيراد بيانات الأقفال' },
    warnings: { fr: ['Vérifier le bâtiment'], en: ['Verify building'], ar: ['تحقق من المبنى'] },
    tips: { fr: ['Sauvegarder la base'], en: ['Back up the database'], ar: ['انسخ قاعدة البيانات'] },
  },
];

test('academy search is accent-insensitive and searches procedural content in every language', () => {
  assert.equal(normalizeHelpSearchText('ÉTAGE & Réservation'), 'etage & reservation');
  assert.equal(normalizeHelpSearchText('  Café   CRÈME  '), 'cafe creme');
  assert.equal(normalizeHelpSearchText('مُرَاجَعَة'), 'مراجعة');
  assert.deepEqual(filterHelpTutorials(tutorials, 'all', 'reservation').map((item) => item.id), ['planning']);
  assert.deepEqual(filterHelpTutorials(tutorials, 'all', 'CardLock MDB').map((item) => item.id), ['locks']);
  assert.deepEqual(filterHelpTutorials(tutorials, 'all', 'out-of-order').map((item) => item.id), ['planning']);
  assert.deepEqual(filterHelpTutorials(tutorials, 'all', '  building   ' ).map((item) => item.id), ['planning', 'locks']);
  assert.deepEqual(filterHelpTutorials(tutorials, 'access', 'planning').map((item) => item.id), []);
  assert.equal(filterHelpTutorials(tutorials, 'all', '   ').length, 2);
});

test('academy completion data accepts only unique known tutorial IDs', () => {
  assert.deepEqual(
    parseCompletedTutorialIds(['planning', 'unknown', 'planning', 42, 'locks'], ['planning', 'locks']),
    ['planning', 'locks'],
  );
  assert.deepEqual(parseCompletedTutorialIds({ bad: true }, ['planning']), []);
});

test('academy progress migrates the legacy Omnibook key to the Appointment key', () => {
  const validIds = ['planning', 'locks'];
  const writes: Array<[string, string]> = [];
  const storage = {
    getItem: (key: string) => key === LEGACY_ACADEMY_PROGRESS_KEY
      ? '["planning","stale","planning"]'
      : null,
    setItem: (key: string, value: string) => writes.push([key, value]),
  };

  assert.deepEqual(readCompletedTutorialIds(storage, validIds), ['planning']);
  assert.deepEqual(writes, [[APPOINTMENT_ACADEMY_PROGRESS_KEY, '["planning"]']]);
});

test('academy progress storage tolerates malformed, unavailable, and quota-blocked storage', () => {
  const validIds = ['planning', 'locks'];
  assert.deepEqual(readCompletedTutorialIds({ getItem: () => 'not-json' }, validIds), []);
  assert.deepEqual(readCompletedTutorialIds({ getItem: () => '["planning","stale"]' }, validIds), ['planning']);
  assert.deepEqual(readCompletedTutorialIds({ getItem: () => { throw new Error('blocked'); } }, validIds), []);
  assert.deepEqual(readCompletedTutorialIds(null, validIds), []);

  let stored = '';
  const storage = { getItem: () => stored || null, setItem: (_key: string, value: string) => { stored = value; } };
  assert.equal(writeCompletedTutorialIds(storage, ['planning', 'stale', 'planning'], validIds), true);
  assert.equal(stored, '["planning"]');
  assert.equal(writeCompletedTutorialIds({ setItem: () => { throw new Error('quota'); } }, ['planning'], validIds), false);
  assert.equal(writeCompletedTutorialIds(null, ['planning'], validIds), false);
});
