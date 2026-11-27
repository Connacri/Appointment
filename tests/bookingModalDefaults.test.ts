import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const bookingModal = readFileSync(
  new URL('../src/components/BookingModal.tsx', import.meta.url),
  'utf8',
);
const discoveryStatus = readFileSync(
  new URL('../src/components/LanDiscoveryStatus.tsx', import.meta.url),
  'utf8',
);

test('new hotel and resort reservations default to one adult/occupant', () => {
  assert.match(bookingModal, /const \[hotelAdults, setHotelAdults\] = useState\(1\)/);
  assert.match(bookingModal, /const \[resortOccupants, setResortOccupants\] = useState\(1\)/);
  const newBookingStart = bookingModal.indexOf('// New booking initialization strictly scoped to active domain');
  assert.notEqual(newBookingStart, -1);
  const newBookingInit = bookingModal.slice(newBookingStart, newBookingStart + 700);
  assert.match(newBookingInit, /setHotelAdults\(1\)/);
  assert.match(newBookingInit, /setHotelChildren\(0\)/);
  assert.match(newBookingInit, /setResortOccupants\(1\)/);
});

test('browser LAN status explains why Edge and Android Chrome do not discover peers', () => {
  assert.match(discoveryStatus, /Edge sur PC et Chrome Canary sur Android/);
  assert.match(discoveryStatus, /découverte WebRTC avec signalisation authentifiée n’est pas encore implémentée/);
  assert.match(discoveryStatus, /découverte non disponible en version web/);
});
