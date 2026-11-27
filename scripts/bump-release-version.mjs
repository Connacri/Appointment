import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { incrementReleaseVersion } from './versioning.mjs';

const packagePath = new URL('../package.json', import.meta.url);
const cargoPath = new URL('../windows-native/Cargo.toml', import.meta.url);
const cargoLockPath = new URL('../windows-native/Cargo.lock', import.meta.url);
const appVersionPath = new URL('../src/version.ts', import.meta.url);

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .map((tag) => tag.trim())
  .filter(Boolean);

const nextVersion = incrementReleaseVersion(packageJson.version, tags);
packageJson.version = nextVersion;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

const cargoToml = readFileSync(cargoPath, 'utf8');
const cargoLock = readFileSync(cargoLockPath, 'utf8');
const packageBlock = /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m;
const lockBlock = /(\[\[package\]\]\s*\nname\s*=\s*"appointment-pms-native"\s*\nversion\s*=\s*")([^"]+)(")/m;

if (!packageBlock.test(cargoToml)) throw new Error('Cargo.toml package version not found.');
if (!lockBlock.test(cargoLock)) throw new Error('Cargo.lock native package version not found.');

writeFileSync(cargoPath, cargoToml.replace(packageBlock, '$1' + nextVersion + '$3'));
writeFileSync(cargoLockPath, cargoLock.replace(lockBlock, '$1' + nextVersion + '$3'));
writeFileSync(appVersionPath, `export const APP_VERSION = '${nextVersion}' as const;\n`);
process.stdout.write(nextVersion + '\n');
