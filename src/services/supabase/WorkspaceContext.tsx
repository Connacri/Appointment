import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createWorkspace as createRemoteWorkspace, listWorkspaces } from './pmsRepository';
import { isSupabaseConfigured } from './supabaseClient';

export interface WorkspaceOption {
  id: string;
  name: string;
  owner_id: string;
}

interface WorkspaceContextValue {
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'appointment_active_workspace_id';
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? ''
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listWorkspaces();
      const options = rows.map((row: { id: string; name: string; owner_id: string }) => ({
        id: row.id,
        name: row.name,
        owner_id: row.owner_id,
      }));
      setWorkspaces(options);
      const storedWorkspaceId = localStorage.getItem(STORAGE_KEY) ?? '';
      const validWorkspaceId = options.some((workspace) => workspace.id === storedWorkspaceId)
        ? storedWorkspaceId
        : '';
      if (!validWorkspaceId) localStorage.removeItem(STORAGE_KEY);
      setActiveWorkspaceIdState(validWorkspaceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les espaces de travail.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    const exists = workspaces.some((workspace) => workspace.id === id);
    if (!exists) {
      setError('Espace de travail non autorisé ou indisponible.');
      return;
    }
    localStorage.setItem(STORAGE_KEY, id);
    setActiveWorkspaceIdState(id);
    setError(null);
  }, [workspaces]);

  const createWorkspace = useCallback(async (name: string) => {
    const normalized = name.trim();
    if (normalized.length < 2 || normalized.length > 80) {
      throw new Error('Le nom de l’espace doit contenir entre 2 et 80 caractères.');
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createRemoteWorkspace(normalized);
      const rows = await listWorkspaces();
      const options = rows.map((row: { id: string; name: string; owner_id: string }) => ({
        id: row.id,
        name: row.name,
        owner_id: row.owner_id,
      }));
      setWorkspaces(options);
      if (options.some((workspace) => workspace.id === created.id)) {
        localStorage.setItem(STORAGE_KEY, created.id);
        setActiveWorkspaceIdState(created.id);
      } else {
        throw new Error('L’espace a été créé, mais son appartenance n’est pas visible. Rechargez la liste avant de continuer.');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Échec de création de l’espace de travail.';
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    refreshWorkspaces,
    createWorkspace,
    loading,
    error,
  }), [workspaces, activeWorkspaceId, setActiveWorkspaceId, refreshWorkspaces, createWorkspace, loading, error]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
