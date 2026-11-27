import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createWorkspace as createRemoteWorkspace, listWorkspaces } from './pmsRepository';
import { isSupabaseConfigured, onSupabaseConfigChange, supabase } from './supabaseClient';
import {
  findAccessibleWorkspace,
  findPersonalWorkspace,
  isWorkspaceNetworkError,
  PERSONAL_WORKSPACE_NAME,
  personalWorkspaceIdForUser,
} from './workspaceSelection';

interface WorkspaceContextValue {
  activeWorkspaceId: string;
  isWorkspaceResolved: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const STORAGE_KEY = 'appointment_active_workspace_id';
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function readStoredWorkspace(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
}
function clearStoredWorkspace(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}
function storeWorkspace(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* In-memory selection remains active. */ }
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(() => readStoredWorkspace());
  const [isWorkspaceResolvedState, setIsWorkspaceResolvedState] = useState(false);
  const [configEpoch, setConfigEpoch] = useState(0);
  const refreshSequenceRef = useRef(0);
  const creationByUserRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => onSupabaseConfigChange(() => {
    setIsWorkspaceResolvedState(false);
    setConfigEpoch((prev) => prev + 1);
  }), []);

  const ensurePersonalWorkspace = useCallback(async (userId: string) => {
    const workspaceId = personalWorkspaceIdForUser(userId);
    if (!workspaceId) throw new Error('Authentification Supabase requise pour créer l’espace personnel.');
    const inFlight = creationByUserRef.current.get(workspaceId);
    if (inFlight) return inFlight;
    const creation = createRemoteWorkspace(PERSONAL_WORKSPACE_NAME, workspaceId).then(() => undefined);
    creationByUserRef.current.set(workspaceId, creation);
    try { await creation; } finally {
      if (creationByUserRef.current.get(workspaceId) === creation) creationByUserRef.current.delete(workspaceId);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const requestId = ++refreshSequenceRef.current;
    setIsWorkspaceResolvedState(false);
    let expectedPersonalId = '';

    try {
      if (!isSupabaseConfigured || !supabase) {
        setActiveWorkspaceIdState('');
        clearStoredWorkspace();
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionData.session?.user;
        if (!user) {
          setActiveWorkspaceIdState('');
          clearStoredWorkspace();
          return;
        }

        expectedPersonalId = personalWorkspaceIdForUser(user.id);
        const cachedId = readStoredWorkspace();

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          // Offline reuse is intentionally limited to the deterministic personal
          // workspace. A shared membership could have been revoked while offline.
          if (cachedId && cachedId === expectedPersonalId) setActiveWorkspaceIdState(expectedPersonalId);
          else {
            setActiveWorkspaceIdState('');
            if (cachedId) clearStoredWorkspace();
          }
          return;
        }

        let rows = await listWorkspaces();
        let selectedWorkspace = findAccessibleWorkspace(rows, user.id, cachedId);
        const sharedWorkspaces = rows.filter((row) => row.owner_id !== user.id);

        // A staff account with exactly one shared hotel workspace must open it
        // instead of silently creating/selecting its own empty personal workspace.
        if (!selectedWorkspace && sharedWorkspaces.length === 0 && !findPersonalWorkspace(rows, user.id)) {
          await ensurePersonalWorkspace(user.id);
          rows = await listWorkspaces();
          selectedWorkspace = findAccessibleWorkspace(rows, user.id, cachedId);
        }

        if (!selectedWorkspace) {
          throw new Error(
            sharedWorkspaces.length > 1
              ? 'Plusieurs espaces partagés sont accessibles. Une sélection explicite est nécessaire.'
              : 'Aucun espace de travail accessible pour ce compte.',
          );
        }

        storeWorkspace(selectedWorkspace.id);
        setActiveWorkspaceIdState(selectedWorkspace.id);
      } catch (cause) {
        const isOfflineOrNetwork =
          (typeof navigator !== 'undefined' && navigator.onLine === false) ||
          isWorkspaceNetworkError(cause);
        const detail = cause instanceof Error ? cause.message : String(cause);
        if (isOfflineOrNetwork) {
          console.warn('[WorkspaceContext] Workspace verification deferred:', detail);
          const cachedId = readStoredWorkspace();
          if (expectedPersonalId && cachedId === expectedPersonalId) {
            setActiveWorkspaceIdState(expectedPersonalId);
            return;
          }
        } else {
          console.error('[WorkspaceContext] Workspace resolution failed:', detail);
        }
        setActiveWorkspaceIdState('');
        clearStoredWorkspace();
      }
    } finally {
      if (requestId === refreshSequenceRef.current) setIsWorkspaceResolvedState(true);
    }
  }, [ensurePersonalWorkspace]);

  useEffect(() => {
    void refreshWorkspaces();
    const handleOnline = () => { void refreshWorkspaces(); };
    if (typeof window !== 'undefined') window.addEventListener('online', handleOnline);
    if (!isSupabaseConfigured || !supabase) {
      return () => { if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline); };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void refreshWorkspaces();
      else {
        refreshSequenceRef.current += 1;
        setActiveWorkspaceIdState('');
        clearStoredWorkspace();
        setIsWorkspaceResolvedState(true);
      }
    });
    return () => {
      subscription.unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline);
    };
  }, [refreshWorkspaces, configEpoch]);

  const value = useMemo(() => ({
    activeWorkspaceId: activeWorkspaceIdState,
    isWorkspaceResolved: isWorkspaceResolvedState,
    refreshWorkspaces,
  }), [activeWorkspaceIdState, isWorkspaceResolvedState, refreshWorkspaces]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
