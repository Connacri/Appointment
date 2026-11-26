import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSingleDeviceTransition,
  evaluateMutationAvailability,
  validateDeviceRegistry,
  type DeviceRegistry,
} from '../src/services/p2p/deviceTopology';

const registry: DeviceRegistry = {
  schemaVersion: 1,
  workspaceId: 'workspace-1',
  establishmentId: 'hotel-1',
  deploymentMode: 'MULTI_DEVICE',
  epoch: 4,
  updatedAt: '2026-11-27T10:00:00.000Z',
  devices: [
    { deviceId: 'pc-a', role: 'admin', authorization: 'active', publicKeyFingerprint: 'aa11', registeredAt: '2026-11-01T10:00:00.000Z' },
    { deviceId: 'pc-b', role: 'operator', authorization: 'active', publicKeyFingerprint: 'bb22', registeredAt: '2026-11-02T10:00:00.000Z' },
  ],
};

const ready = {
  registryEpochVerified: true,
  coreDataHydrated: true,
  integrityChecksPassed: true,
};

test('validates a multi-device registry and unique identities', () => {
  assert.doesNotThrow(() => validateDeviceRegistry(registry));
  assert.throws(() => validateDeviceRegistry({
    ...registry,
    devices: [...registry.devices, registry.devices[0]],
  }), /duplicate device ID/);
});

test('multi-device goes read-only when Supabase and authenticated P2P are absent', () => {
  const result = evaluateMutationAvailability({
    ...ready, registry, localDeviceId: 'pc-a', coordinationAuthority: 'none',
  });
  assert.equal(result.state, 'READ_ONLY');
  assert.equal(result.canMutate, false);
});

test('peer discovery without authenticated coordination cannot authorize writes', () => {
  const result = evaluateMutationAvailability({
    ...ready, registry, localDeviceId: 'pc-a', coordinationAuthority: 'none',
  });
  assert.equal(result.reason, 'no_coordination_authority');
});

test('a verified single-device installation can mutate locally without a network authority', () => {
  const single: DeviceRegistry = {
    ...registry,
    deploymentMode: 'SINGLE_DEVICE',
    epoch: 5,
    singleDeviceId: 'pc-a',
    devices: [
      { ...registry.devices[0] },
      { ...registry.devices[1], authorization: 'revoked', revokedAt: '2026-11-27T10:00:00.000Z' },
    ],
  };
  const result = evaluateMutationAvailability({
    ...ready, registry: single, localDeviceId: 'pc-a', coordinationAuthority: 'none',
  });
  assert.equal(result.state, 'LOCAL_SINGLE_DEVICE');
  assert.equal(result.canMutate, true);
});

test('a multi-device installation never becomes single-device because only one peer is visible', () => {
  const result = evaluateMutationAvailability({
    ...ready, registry, localDeviceId: 'pc-a', coordinationAuthority: 'none',
  });
  assert.equal(result.state, 'READ_ONLY');
});

test('registry verification and hydration gate mutations during reconnect', () => {
  const unverified = evaluateMutationAvailability({
    ...ready, registry, localDeviceId: 'pc-a', coordinationAuthority: 'supabase', registryEpochVerified: false,
  });
  assert.equal(unverified.state, 'RECONNECTING');
  assert.equal(unverified.canMutate, false);
  const hydrating = evaluateMutationAvailability({
    ...ready, registry, localDeviceId: 'pc-a', coordinationAuthority: 'supabase', coreDataHydrated: false,
  });
  assert.equal(hydrating.state, 'RECONNECTING');
});

test('only an authorized administrator can explicitly transition to single-device', () => {
  const next = buildSingleDeviceTransition(registry, 'pc-a', 'pc-a', 'admin', '2026-11-27T11:00:00.000Z');
  assert.equal(next.epoch, 5);
  assert.equal(next.singleDeviceId, 'pc-a');
  assert.equal(next.devices.find((device) => device.deviceId === 'pc-b')?.authorization, 'revoked');
  assert.throws(() => buildSingleDeviceTransition(registry, 'pc-a', 'pc-b', 'operator'), /Only an administrator/);
});
