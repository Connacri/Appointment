export const PERSONAL_WORKSPACE_NAME = 'Espace personnel';

export interface WorkspaceCandidate {
  id: string;
  name: string;
  owner_id: string;
  workspace_members?: Array<{ role: string }>;
}

export function personalWorkspaceIdForUser(userId: string): string {
  return userId.trim();
}

export function findPersonalWorkspace(
  workspaces: readonly WorkspaceCandidate[],
  userId: string,
): WorkspaceCandidate | undefined {
  const ownerId = personalWorkspaceIdForUser(userId);
  if (!ownerId) return undefined;
  return workspaces.find((workspace) =>
    personalWorkspaceIdForUser(workspace.id) === ownerId &&
    personalWorkspaceIdForUser(workspace.owner_id) === ownerId
  );
}

/**
 * listWorkspaces() is RLS-scoped and includes only workspaces where the current
 * account has a membership. Prefer its previous shared selection, then the
 * sole shared workspace, and only then the account's personal workspace.
 */
export function findAccessibleWorkspace(
  workspaces: readonly WorkspaceCandidate[],
  userId: string,
  cachedWorkspaceId = '',
): WorkspaceCandidate | undefined {
  const ownerId = personalWorkspaceIdForUser(userId);
  if (!ownerId) return undefined;
  const cached = workspaces.find((workspace) => workspace.id === cachedWorkspaceId);
  const shared = workspaces.filter((workspace) => workspace.owner_id !== ownerId);
  if (cached && cached.owner_id !== ownerId) return cached;
  if (shared.length === 1) return shared[0];
  if (shared.length > 1) return undefined;
  return cached ?? findPersonalWorkspace(workspaces, ownerId);
}

export function selectPersonalWorkspaceId(
  workspaces: readonly WorkspaceCandidate[],
  userId: string,
): string {
  return findPersonalWorkspace(workspaces, userId)?.id ?? '';
}

const NETWORK_ERROR_PATTERN =
  /failed to fetch|networkerror|load failed|network request failed|fetch failed|internet disconnected|err_network|aborterror|the operation was aborted/i;

export function isWorkspaceNetworkError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return NETWORK_ERROR_PATTERN.test(message);
}
