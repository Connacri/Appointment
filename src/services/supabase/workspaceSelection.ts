export const PERSONAL_WORKSPACE_NAME = 'Espace personnel';

export interface WorkspaceCandidate {
  id: string;
  name: string;
  owner_id: string;
}

/**
 * A personal workspace uses the authenticated account id as its stable id.
 * Concurrent first logins from several tabs/devices therefore target the same
 * row, which can be reused and self-healed instead of being duplicated. The id
 * and owner identity are authoritative; the display name is not used for
 * selection so a renamed personal workspace stays selected.
 */
export function personalWorkspaceIdForUser(userId: string): string {
  return userId.trim();
}

export function findPersonalWorkspace(
  workspaces: readonly WorkspaceCandidate[],
  userId: string
): WorkspaceCandidate | undefined {
  const ownerId = personalWorkspaceIdForUser(userId);
  if (!ownerId) return undefined;
  return workspaces.find(
    (workspace) =>
      personalWorkspaceIdForUser(workspace.id) === ownerId &&
      personalWorkspaceIdForUser(workspace.owner_id) === ownerId
  );
}

export function selectPersonalWorkspaceId(
  workspaces: readonly WorkspaceCandidate[],
  userId: string
): string {
  return findPersonalWorkspace(workspaces, userId)?.id ?? '';
}
