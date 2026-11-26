import type { EstablishmentProfile } from '../types/establishment';

/**
 * Recover only missing establishment identity from the remote profile.
 * A populated local profile remains authoritative; a missing logo is the one
 * field that must still hydrate so the property branding follows the workspace.
 */
export function mergeRecoveredEstablishmentProfile(
  local: EstablishmentProfile,
  remote: Partial<EstablishmentProfile>,
  remoteEstablishmentId: string | undefined,
  updatedAt: string,
): EstablishmentProfile | null {
  const localHasName = Boolean(local.name?.trim());
  const remoteHasName = Boolean(remote.name?.trim());
  const localHasLogo = Boolean(local.logoUrl?.trim());
  const remoteHasLogo = Boolean(remote.logoUrl?.trim());

  if (!localHasName && remoteHasName) {
    return {
      ...local,
      ...remote,
      id: local.id === 'establishment-draft'
        ? (remoteEstablishmentId || 'establishment-cloud')
        : local.id,
      updatedAt,
    };
  }

  if (!localHasLogo && remoteHasLogo) {
    return {
      ...local,
      logoUrl: remote.logoUrl,
      id: local.id === 'establishment-draft'
        ? (remoteEstablishmentId || 'establishment-cloud')
        : local.id,
      updatedAt,
    };
  }

  return null;
}
