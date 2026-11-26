import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ESTABLISHMENT_PROFILE } from '../src/types/establishment';
import { mergeRecoveredEstablishmentProfile } from '../src/utils/establishmentProfileRecovery';

test('hydrates a missing drawer logo without overwriting a populated local profile', () => {
  const local = {
    ...DEFAULT_ESTABLISHMENT_PROFILE,
    id: 'hotel-local',
    name: 'Hotel Local',
    address: 'Local address',
    logoUrl: '',
  };
  const recovered = mergeRecoveredEstablishmentProfile(
    local,
    { name: 'Hotel Cloud', address: 'Cloud address', logoUrl: 'data:image/png;base64,abc' },
    'hotel-cloud',
    '2026-11-26T12:00:00.000Z',
  );

  assert.ok(recovered);
  assert.equal(recovered.name, 'Hotel Local');
  assert.equal(recovered.address, 'Local address');
  assert.equal(recovered.logoUrl, 'data:image/png;base64,abc');
  assert.equal(recovered.id, 'hotel-local');
});

test('recovers the complete remote profile when the local profile has no name', () => {
  const local = { ...DEFAULT_ESTABLISHMENT_PROFILE };
  const recovered = mergeRecoveredEstablishmentProfile(
    local,
    { name: 'Hotel Cloud', address: 'Cloud address', logoUrl: 'https://cdn.example.test/logo.png' },
    'hotel-cloud',
    '2026-11-26T12:00:00.000Z',
  );

  assert.ok(recovered);
  assert.equal(recovered.name, 'Hotel Cloud');
  assert.equal(recovered.address, 'Cloud address');
  assert.equal(recovered.logoUrl, 'https://cdn.example.test/logo.png');
  assert.equal(recovered.id, 'hotel-cloud');
});

test('does not replace an existing local logo or rewrite a complete local profile', () => {
  const local = {
    ...DEFAULT_ESTABLISHMENT_PROFILE,
    id: 'hotel-local',
    name: 'Hotel Local',
    logoUrl: 'https://local.example.test/logo.png',
  };
  const recovered = mergeRecoveredEstablishmentProfile(
    local,
    { name: 'Hotel Cloud', logoUrl: 'https://cloud.example.test/logo.png' },
    'hotel-cloud',
    '2026-11-26T12:00:00.000Z',
  );

  assert.equal(recovered, null);
});
