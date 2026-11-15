import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
let diffArgs;
if (event.pull_request) {
  diffArgs = [event.pull_request.base.sha + '...' + event.pull_request.head.sha];
} else if (event.before && event.after && !/^0+$/.test(event.before)) {
  diffArgs = [event.before, event.after];
} else if (event.after) {
  diffArgs = ['--root', event.after];
} else {
  console.log('No push/PR comparison is available (manual dispatch); contract change-set check skipped.');
  process.exit(0);
}

let changed;
try {
  changed = execFileSync('git', ['diff', '--name-only', ...diffArgs], { encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
} catch (error) {
  console.error('Unable to inspect the event diff. The data-contract gate cannot validate this change set.');
  process.exit(1);
}

const dataPaths = /^(src\/types\/|src\/db\/|src\/services\/supabase\/|src\/locks\/database\/|src\/locks\/lockManager\.ts$|src\/context\/AppContext\.tsx$|supabase\/migrations\/)/;
const sourceDataPaths = /^(src\/types\/|src\/db\/|src\/services\/supabase\/|src\/locks\/database\/|src\/locks\/lockManager\.ts$|src\/context\/AppContext\.tsx$)/;
const has = (pattern) => changed.some((file) => pattern.test(file));
const errors = [];

if (!has(dataPaths)) {
  console.log('No data-contract source paths changed; no additional change-set requirements.');
  process.exit(0);
}

if (!changed.includes('docs/DATA_CONTRACT.md')) {
  errors.push('Update docs/DATA_CONTRACT.md with the changed invariant and current alignment status.');
}
if (has(sourceDataPaths) && !has(/^tests\/.*\.(test|spec)\.[cm]?[jt]sx?$/)) {
  errors.push('Add or update a regression test under tests/ for the data/model/persistence change.');
}
const migrationChanged = has(/^supabase\/migrations\/\d+.*\.sql$/);
const generatedTypesChanged = changed.includes('src/services/supabase/database.types.ts');
if (migrationChanged && !generatedTypesChanged) {
  errors.push('A remote SQL migration changed: regenerate and commit src/services/supabase/database.types.ts.');
}
if (generatedTypesChanged && !migrationChanged) {
  errors.push('Generated Supabase types changed without a versioned SQL migration in the same change set.');
}

if (errors.length) {
  console.error('Data-contract change-set validation FAILED:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Data-contract change-set validation passed.');
console.log('Changed files:');
for (const file of changed.filter((file) => dataPaths.test(file))) console.log(' - ' + file);
console.log('Note: this gate enforces tests, migration/type generation and contract documentation; it does not replace live PostgreSQL schema-diff or RLS integration tests.');
