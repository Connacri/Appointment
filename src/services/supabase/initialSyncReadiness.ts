export type InitialSyncPhase =
  | 'idle' | 'syncing' | 'synced' | 'pending' | 'error'
  | 'offline' | 'unconfigured' | 'unauthenticated' | 'no_workspace';

export interface InitialSyncReadinessInput {
  isCoreDataHydrated: boolean;
  isWorkspaceResolved: boolean;
  isConfigured: boolean;
  isOffline: boolean;
  workspaceId: string;
  syncWorkspaceId: string;
  syncPhase: InitialSyncPhase;
}

/** Gate the Gantt until local hydration and the first verified workspace sync settle. */
export function isInitialSyncReady(input: InitialSyncReadinessInput): boolean {
  if (!input.isCoreDataHydrated || !input.isWorkspaceResolved) return false;
  if (!input.isConfigured || input.isOffline) return true;
  if (!input.workspaceId.trim()) return input.syncPhase === 'unauthenticated';
  if (input.syncWorkspaceId !== input.workspaceId) return false;
  return input.syncPhase === 'synced';
}
