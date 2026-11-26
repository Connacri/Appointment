import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) {
  console.log('GITHUB_EVENT_PATH is unavailable; CI event-diff gate skipped outside GitHub Actions.');
  process.exit(0);
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
let diffArgs;
if (event.pull_request) {
  diffArgs = [event.pull_request.base.sha, event.pull_request.head.sha];
} else if (event.before && event.after && !/^0+$/.test(event.before)) {
  diffArgs = [event.before, event.after];
} else if (event.after) {
  diffArgs = ['--root', event.after];
} else {
  console.log('No push/PR comparison is available; no changed source lines to inspect.');
  process.exit(0);
}

let patch;
try {
  patch = execFileSync(
    'git',
    ['diff', '--unified=0', ...diffArgs, '--', 'src'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
} catch {
  console.error('Unable to inspect the source diff. The P2P mutation-boundary gate cannot validate this change set.');
  process.exit(1);
}

const businessKey = /booking|reservation|resource|room|invoice|task|stock|supplier|purchase|dynamic.?rate|pricing|staff|establishment|payment|movement|inventory/i;
const addedByFile = new Map();
let currentFile = '';

for (const line of patch.split(/\r?\n/)) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice('+++ b/'.length);
    if (!addedByFile.has(currentFile)) addedByFile.set(currentFile, []);
    continue;
  }
  if (line.startsWith('+') && !line.startsWith('+++') && currentFile) {
    addedByFile.get(currentFile).push(line.slice(1));
  }
}

const violations = [];
const directWrite = /localStorage\s*\.\s*setItem\s*\(\s*(['"`])([^'"`]+)\1/gs;
for (const [file, addedLines] of addedByFile) {
  const addedSource = addedLines.join('\n');
  directWrite.lastIndex = 0;
  for (const match of addedSource.matchAll(directWrite)) {
    const key = match[2];
    if (businessKey.test(key)) {
      violations.push({ file, key });
    }
  }
}

if (violations.length > 0) {
  console.error('P2P mutation-boundary validation FAILED. New business data must use the transactional domain repository:');
  for (const violation of violations) {
    console.error(` - ${violation.file}: localStorage key "${violation.key}"`);
  }
  process.exit(1);
}

console.log('P2P mutation-boundary validation passed: no new direct localStorage business-data writes.');
