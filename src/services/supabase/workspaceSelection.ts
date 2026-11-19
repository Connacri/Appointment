export const PERSONAL_WORKSPACE_NAME = 'Espace personnel';

export interface WorkspaceCandidate {
  id: string;
  name: string;
  owner_id: string;
}

/**
 * A personal workspace uses the authenticated account id as its stable id.
 * Concurrent first logins from several tabs/devices therefore target the same
 * row; the workspace primary key makes the second insert fail harmlessly and
 * the caller can reload the existing workspace instead of creating a duplicate.
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
      personalWorkspaceIdForUser(workspace.owner_id) === ownerId &&
      workspace.name === PERSONAL_WORKSPACE_NAME
  );
}

export function selectPersonalWorkspaceId(
  workspaces: readonly WorkspaceCandidate[],
  userId: string
): string {
  return findPersonalWorkspace(workspaces, userId)?.id ?? '';
}
