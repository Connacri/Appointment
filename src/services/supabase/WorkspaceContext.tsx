import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createWorkspace as createRemoteWorkspace, listWorkspaces } from './pmsRepository';
import { isSupabaseConfigured, onSupabaseConfigChange, supabase } from './supabaseClient';
import {
  findPersonalWorkspace,
  PERSONAL_WORKSPACE_NAME,
  personalWorkspaceIdForUser,
} from './workspaceSelection';

interface WorkspaceContextValue {
  activeWorkspaceId: string;
  refreshWorkspaces: () => Promise<void>;
}

const STORAGE_KEY = 'appointment_active_workspace_id';
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function clearStoredWorkspace(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable; sync still stays gated by the in-memory id.
  }
}

function storeWorkspace(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage may be unavailable; sync still uses the in-memory id.
  }
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? ''
  );
  const [configEpoch, setConfigEpoch] = useState(0);
  const creationByUserRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => onSupabaseConfigChange(() => {
    setConfigEpoch((prev) => prev + 1);
  }), []);

  const ensurePersonalWorkspace = useCallback(async (userId: string) => {
    const workspaceId = personalWorkspaceIdForUser(userId);
    if (!workspaceId) {
      throw new Error('Authentification Supabase requise pour créer l’espace personnel.');
    }
    const inFlight = creationByUserRef.current.get(workspaceId);
    if (inFlight) return inFlight;

    // Creation is idempotent and self-healing: an existing personal workspace
    // is reused and a missing owner membership is repaired by the repository.
    const creation = createRemoteWorkspace(PERSONAL_WORKSPACE_NAME, workspaceId).then(
      () => undefined
    );
    creationByUserRef.current.set(workspaceId, creation);
    try {
      await creation;
    } finally {
      if (creationByUserRef.current.get(workspaceId) === creation) {
        creationByUserRef.current.delete(workspaceId);
      }
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setActiveWorkspaceIdState('');
      clearStoredWorkspace();
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        // Signed out is a normal state, not a workspace error.
        setActiveWorkspaceIdState('');
        clearStoredWorkspace();
        return;
      }

      let rows = await listWorkspaces();
      let personalWorkspace = findPersonalWorkspace(rows, user.id);
      if (!personalWorkspace) {
        await ensurePersonalWorkspace(user.id);
        rows = await listWorkspaces();
        personalWorkspace = findPersonalWorkspace(rows, user.id);
      }
      if (!personalWorkspace) {
        throw new Error('Espace de travail personnel inaccessible après création.');
      }

      // A personal workspace is selected automatically: there is no user-facing
      // workspace selector or creation form.
      storeWorkspace(personalWorkspace.id);
      setActiveWorkspaceIdState(personalWorkspace.id);
    } catch (cause) {
      console.error(
        '[WorkspaceContext] Personal workspace setup failed:',
        cause instanceof Error ? cause.message : String(cause)
      );
      setActiveWorkspaceIdState('');
      clearStoredWorkspace();
    }
  }, [ensurePersonalWorkspace]);

  useEffect(() => {
    void refreshWorkspaces();
    if (!isSupabaseConfigured || !supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void refreshWorkspaces();
      } else {
        setActiveWorkspaceIdState('');
        clearStoredWorkspace();
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshWorkspaces, configEpoch]);

  const value = useMemo(() => ({
    activeWorkspaceId: activeWorkspaceIdState,
    refreshWorkspaces,
  }), [activeWorkspaceIdState, refreshWorkspaces]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
