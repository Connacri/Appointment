/**
 * Dev-only verification of the CardLock.mdb import.
 *
 * Usage:
 *   npx tsx scripts/verify-mdb.ts "C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb"
 *
 * Prints the recovered system profile and the system card that would be
 * written, so it can be compared with the original CardLock.exe output.
 */
import { readFileSync } from 'node:fs';
import { parseCardLockMdb } from '../src/locks/database/mdbImport';
import { encodeSystemCard } from '../src/locks/cards/codec';

const path = process.argv[2];
if (!path) {
  console.error('Usage: npx tsx scripts/verify-mdb.ts <CardLock.mdb>');
  process.exit(1);
}

const buffer = readFileSync(path);
const snapshot = await parseCardLockMdb(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  path.split(/[\\/]/).pop() ?? 'CardLock.mdb',
);

console.log('counts   :', snapshot.counts);
console.log('warnings :', snapshot.warnings);
console.log('buildings:', snapshot.buildings);
console.log('profile  :', snapshot.systemProfile);

if (snapshot.systemProfile) {
  for (const typeIndex of [0x01, 0x0e]) {
    const card = encodeSystemCard({ typeIndex, template: snapshot.systemProfile });
    const hex = Array.from(card, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    console.log(`system card 0x${typeIndex.toString(16).padStart(2, '0')}: ${hex}`);
  }
}

// Cross-check: every imported card must be 16 bytes / 32 hex chars
const bad = snapshot.cards.filter((c) => c.hex.length !== 32);
console.log('invalid card records:', bad.length);
