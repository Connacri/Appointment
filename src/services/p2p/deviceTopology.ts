/**
 * Appointment PMS device topology and mutation-availability contract.
 *
 * This module is intentionally transport-independent. LAN discovery is not an
 * authenticated peer session and must never be passed as a coordination grant.
 */
export type DeploymentMode = 'SINGLE_DEVICE' | 'MULTI_DEVICE';
export type DeviceAuthorization = 'active' | 'revoked';
export type DeviceRole = 'admin' | 'operator';
export type MutationRuntimeState = 'ONLINE' | 'LOCAL_SINGLE_DEVICE' | 'RECONNECTING' | 'READ_ONLY';

export interface RegisteredDevice {
  deviceId: string;
  role: DeviceRole;
  authorization: DeviceAuthorization;
  publicKeyFingerprint?: string;
  registeredAt: string;
  revokedAt?: string;
}

export interface DeviceRegistry {
  schemaVersion: 1;
  workspaceId: string;
  establishmentId: string;
  deploymentMode: DeploymentMode;
  epoch: number;
  devices: RegisteredDevice[];
  /** Required in SINGLE_DEVICE and must identify its only active device. */
  singleDeviceId?: string;
  updatedAt: string;
}

export interface MutationAvailabilityInput {
  registry: DeviceRegistry | null;
  localDeviceId: string;
  /** A successful, authorized coordination path; discovery alone is never enough. */
  coordinationAuthority: 'supabase' | 'authenticated-p2p' | 'none';
  registryEpochVerified: boolean;
  coreDataHydrated: boolean;
  integrityChecksPassed: boolean;
}

export interface MutationAvailability {
  state: MutationRuntimeState;
  canMutate: boolean;
  reason:
    | 'single_device_local'
    | 'coordination_available'
    | 'registry_missing'
    | 'registry_unverified'
    | 'data_not_ready'
    | 'integrity_failed'
    | 'device_not_authorized'
    | 'no_coordination_authority';
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function validateDeviceRegistry(registry: DeviceRegistry): void {
  if (registry.schemaVersion !== 1) throw new Error('Unsupported device registry schema version.');
  if (!registry.workspaceId.trim() || !registry.establishmentId.trim()) {
    throw new Error('Device registry workspace and establishment scope are required.');
  }
  if (!Number.isSafeInteger(registry.epoch) || registry.epoch < 1) {
    throw new Error('Device registry epoch must be a positive safe integer.');
  }
  if (!ISO_TIMESTAMP.test(registry.updatedAt) || !Number.isFinite(Date.parse(registry.updatedAt))) {
    throw new Error('Device registry updatedAt must be a valid UTC timestamp.');
  }
  if (registry.deploymentMode !== 'SINGLE_DEVICE' && registry.deploymentMode !== 'MULTI_DEVICE') {
    throw new Error('Unsupported deployment mode.');
  }
  if (!Array.isArray(registry.devices) || registry.devices.length === 0) {
    throw new Error('Device registry must contain at least one registered device.');
  }

  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  for (const device of registry.devices) {
    if (!device.deviceId.trim() || ids.has(device.deviceId)) {
      throw new Error('Device registry contains an empty or duplicate device ID.');
    }
    ids.add(device.deviceId);
    if (device.role !== 'admin' && device.role !== 'operator') {
      throw new Error('Device registry contains an invalid role.');
    }
    if (device.authorization !== 'active' && device.authorization !== 'revoked') {
      throw new Error('Device registry contains an invalid authorization state.');
    }
    if (!ISO_TIMESTAMP.test(device.registeredAt) || !Number.isFinite(Date.parse(device.registeredAt))) {
      throw new Error('Device registeredAt must be a valid UTC timestamp.');
    }
    if (device.authorization === 'revoked') {
      if (!device.revokedAt || !ISO_TIMESTAMP.test(device.revokedAt) || !Number.isFinite(Date.parse(device.revokedAt))) {
        throw new Error('Revoked devices must have a valid revokedAt timestamp.');
      }
    } else if (device.revokedAt) {
      throw new Error('An active device cannot have revokedAt.');
    }
    const fingerprint = device.publicKeyFingerprint?.trim().toLowerCase();
    if (fingerprint) {
      if (fingerprints.has(fingerprint)) throw new Error('Duplicate device public-key fingerprint.');
      fingerprints.add(fingerprint);
    }
  }

  const active = registry.devices.filter((device) => device.authorization === 'active');
  if (active.length === 0) throw new Error('Device registry must retain at least one active device.');
  if (registry.deploymentMode === 'SINGLE_DEVICE') {
    if (!registry.singleDeviceId || active.length !== 1 || active[0].deviceId !== registry.singleDeviceId) {
      throw new Error('SINGLE_DEVICE must identify exactly one active device.');
    }
  } else if (registry.singleDeviceId) {
    throw new Error('MULTI_DEVICE cannot declare a singleDeviceId.');
  }
}

/** Fail-closed state evaluation. Never infer SINGLE_DEVICE from missing peers. */
export function evaluateMutationAvailability(input: MutationAvailabilityInput): MutationAvailability {
  if (!input.coreDataHydrated) {
    return { state: 'RECONNECTING', canMutate: false, reason: 'data_not_ready' };
  }
  if (!input.integrityChecksPassed) {
    return { state: 'READ_ONLY', canMutate: false, reason: 'integrity_failed' };
  }
  if (!input.registry) {
    return { state: 'READ_ONLY', canMutate: false, reason: 'registry_missing' };
  }
  try {
    validateDeviceRegistry(input.registry);
  } catch {
    return { state: 'READ_ONLY', canMutate: false, reason: 'registry_unverified' };
  }
  if (!input.registryEpochVerified) {
    return { state: 'RECONNECTING', canMutate: false, reason: 'registry_unverified' };
  }

  const local = input.registry.devices.find((device) => device.deviceId === input.localDeviceId);
  if (!local || local.authorization !== 'active') {
    return { state: 'READ_ONLY', canMutate: false, reason: 'device_not_authorized' };
  }

  if (input.registry.deploymentMode === 'SINGLE_DEVICE') {
    if (input.registry.singleDeviceId !== input.localDeviceId) {
      return { state: 'READ_ONLY', canMutate: false, reason: 'device_not_authorized' };
    }
    return { state: 'LOCAL_SINGLE_DEVICE', canMutate: true, reason: 'single_device_local' };
  }

  if (input.coordinationAuthority !== 'none') {
    return { state: 'ONLINE', canMutate: true, reason: 'coordination_available' };
  }
  return { state: 'READ_ONLY', canMutate: false, reason: 'no_coordination_authority' };
}

/**
 * Build an explicit MULTI_DEVICE -> SINGLE_DEVICE transition.
 * The caller must separately authenticate the administrator and durably commit
 * this new epoch to the authoritative registry before applying it locally.
 */
export function buildSingleDeviceTransition(
  current: DeviceRegistry,
  retainedDeviceId: string,
  actorDeviceId: string,
  actorRole: DeviceRole,
  now = new Date().toISOString(),
): DeviceRegistry {
  validateDeviceRegistry(current);
  if (actorRole !== 'admin') throw new Error('Only an administrator can change deployment mode.');
  if (current.deploymentMode !== 'MULTI_DEVICE') throw new Error('Registry is not in MULTI_DEVICE mode.');
  if (!current.devices.some((device) => device.deviceId === retainedDeviceId && device.authorization === 'active')) {
    throw new Error('The retained device must be currently authorized.');
  }
  if (!current.devices.some((device) => device.deviceId === actorDeviceId && device.authorization === 'active')) {
    throw new Error('The administrator device is not authorized.');
  }
  if (!ISO_TIMESTAMP.test(now) || !Number.isFinite(Date.parse(now))) throw new Error('Transition timestamp must be valid UTC.');

  const next: DeviceRegistry = {
    ...current,
    deploymentMode: 'SINGLE_DEVICE',
    epoch: current.epoch + 1,
    singleDeviceId: retainedDeviceId,
    updatedAt: now,
    devices: current.devices.map((device) => {
      if (device.deviceId === retainedDeviceId) return { ...device, authorization: 'active', revokedAt: undefined };
      if (device.authorization === 'revoked') return device;
      return { ...device, authorization: 'revoked', revokedAt: now };
    }),
  };
  validateDeviceRegistry(next);
  return next;
}
