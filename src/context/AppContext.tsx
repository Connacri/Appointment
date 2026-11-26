import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Language,
  Theme,
  AppThemeId,
  SectorType,
  TimelineBooking,
  BookingStatus,
  ResourceGroup,
  ResourceItem,
  DomainType,
  UserRole,
  ClientProfile,
  PmsTask,
  StockItem,
  StockMovement,
  StockSupplier,
  PurchaseOrderRecord,
  HotelEstablishment,
  InvoiceRecord,
  InvoiceItem,
  DocumentType,
} from '../types/booking';
import { applyStockDeductions, type StockDeductionLine } from '../utils/stockProcurement';
import {
  initialResourceGroups,
  initialBookings,
  initialStockItems,
  initialPmsTasks,
} from '../data/mockData';
import { EstablishmentProfile, DEFAULT_ESTABLISHMENT_PROFILE } from '../types/establishment';
import { indexedDb } from '../db/indexedDb';
import { useWorkspace } from '../services/supabase/WorkspaceContext';
import { isSupabaseConfigured, onSupabaseConfigChange, supabase } from '../services/supabase/supabaseClient';
import { subscribeWorkspaceRealtime } from '../services/supabase/supabaseRealtime';
import {
  deleteBooking as remoteDeleteBooking,
  deleteResource as remoteDeleteResource,
  deleteStockItem as remoteDeleteStockItem,
  deleteTask as remoteDeleteTask,
  deleteStockSupplier as remoteDeleteStockSupplier,
  deletePurchaseOrder as remoteDeletePurchaseOrder,
  deleteStaffMember as remoteDeleteStaffMember,
  listBookings,
  listBookingTombstones,
  listDynamicRates,
  listEstablishments,
  listResourceGroups,
  listStockItems,
  listStockMovements,
  listStockSuppliers,
  listPurchaseOrders,
  listStaffMembers,
  listEstablishmentProfile,
  listTasks,
  saveBooking as remoteSaveBooking,
  saveEstablishment as remoteSaveEstablishment,
  saveEstablishmentProfile as remoteSaveEstablishmentProfile,
  saveResource as remoteSaveResource,
  saveResourceGroupRow as remoteSaveResourceGroupRow,
  saveStockItem as remoteSaveStockItem,
  saveStockMovement as remoteSaveStockMovement,
  saveStockSupplier as remoteSaveStockSupplier,
  savePurchaseOrder as remoteSavePurchaseOrder,
  saveStaffMember as remoteSaveStaffMember,
  saveTask as remoteSaveTask,
} from '../services/supabase/pmsRepository';
import { planBackfill, stableEstablishmentId } from '../services/supabase/backfillPlanner';
import {
  deriveIdleSyncPhase,
  INITIAL_CLOUD_SYNC_STATUS,
  runSupabaseSync,
  shouldSkipRedundantSync,
  type CloudSyncStatus,
} from '../services/supabase/supabaseSync';
import {
  SYNC_LOG_MAX_ENTRIES,
  type SyncLogEntry,
  type SyncProgressEvent,
} from '../services/supabase/syncLog';
import { isValidCalendarDate, shouldMarkPaymentAsPaid, validateBookingOccupants } from '../utils/bookingValidation';
import { normalizeBookingForPersistence } from '../utils/bookingOccupants';
import { isDemoBookingId } from '../utils/bookingPersistence';
import { isRoomReadyForBooking } from '../utils/roomReadiness';
import { lockManager } from '../locks/lockManager';
import type { EventLogEntry, NewEventLogInput } from '../types/eventLog';
import {
  EVENT_LOG_MAX_ENTRIES,
  buildHistoricalEventSeeds,
  computeBookingDiff,
  mergeEventLogs,
} from '../utils/eventLog';
import { useThemeSync } from '../hooks/useThemeSync';
import {
  audioFeedbackService,
  playAudioFeedback,
  playSuccessFeedback,
  playErrorFeedback,
  playClickFeedback,
  playBipFeedback,
  type AudioFeedbackType,
  type AudioFeedbackOptions,
} from '../utils/audioFeedback';

import type {
  AppTabId,
  RoleCategory,
  RoleDefinition,
  RoleIconName,
  RolePermissions,
  StaffCareerChangeType,
  StaffEmploymentStatus,
  StaffMemberRecord,
  StaffShiftType,
  StoredRolesPayload,
} from '../types/roles';
import { BUILT_IN_ROLES } from '../data/roles';
import {
  isTabAllowedForRole,
  loadStoredRolesPayload,
  mergeRolesWithStoredConfig,
  normalizeLegacyRoleId,
  resolveFallbackTabForRole,
  resolveRoleDefinition,
  sanitizeAllowedTabs,
  saveStoredRolesPayload,
  slugifyCustomRoleId,
} from '../utils/rolePermissions';
import {
  applyStaffAssignmentUpdate,
  applyStaffPromotionOrTransfer,
  buildStaffMemberRecord,
  mapRoleToTaskCategory,
} from '../utils/staffHr';

export type ActiveAppView =
  | 'planning'
  | 'my_bookings'
  | 'lost_property'
  | 'reports'
  | 'analytics'
  | 'housekeeping'
  | 'tasks'
  | 'stock'
  | 'pricing'
  | 'billing'
  | 'channels'
  | 'prousb'
  | 'spa'
  | 'events'
  | 'roles'
  | 'help'
  | 'videos';

interface AppContextType {
  activeWorkspaceId: string;
  refreshWorkspaces: () => Promise<void>;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  appTheme: AppThemeId;
  setAppTheme: (theme: AppThemeId) => void;
  resetThemeToDefault: () => { mode: Theme; appTheme: AppThemeId };
  isThemeModalOpen: boolean;
  setIsThemeModalOpen: (open: boolean) => void;
  currentDomain: DomainType;
  setCurrentDomain: (domain: DomainType) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  roles: RoleDefinition[];
  activeRoleDefinition: RoleDefinition;
  createCustomRole: (input: {
    name: string;
    label?: { fr: string; en: string; ar: string };
    description?: { fr: string; en: string; ar: string };
    category: RoleCategory;
    iconName: RoleIconName;
    allowedTabs: AppTabId[];
    permissions: RolePermissions;
  }) => RoleDefinition;
  updateRoleConfig: (
    roleId: UserRole,
    patch: {
      label?: { fr: string; en: string; ar: string };
      description?: { fr: string; en: string; ar: string };
      category?: RoleCategory;
      iconName?: RoleIconName;
      allowedTabs?: AppTabId[];
      permissions?: RolePermissions;
    }
  ) => void;
  deleteCustomRole: (roleId: UserRole) => boolean;
  resetBuiltInRoles: () => void;
  hasCustomizedBuiltInRoles: boolean;
  staffMembers: StaffMemberRecord[];
  createStaffMember: (input: {
    fullName: string;
    phone?: string;
    roleId: UserRole;
    assignment: string;
    shift: StaffShiftType;
    defaultTasks: string[];
    status?: StaffEmploymentStatus;
    note?: string;
    createInitialTasks?: boolean;
    initialRoom?: string;
  }) => StaffMemberRecord;
  updateStaffAssignment: (
    staffId: string,
    patch: {
      assignment: string;
      shift: StaffShiftType;
      status?: StaffEmploymentStatus;
      defaultTasks?: string[];
      note?: string;
    }
  ) => void;
  promoteOrTransferStaff: (
    staffId: string,
    change: {
      newRoleId: UserRole;
      newAssignment?: string;
      newShift?: StaffShiftType;
      defaultTasks?: string[];
      changeType: Extract<StaffCareerChangeType, 'promoted' | 'transferred'>;
      note?: string;
    }
  ) => void;
  assignTaskToStaff: (
    staffId: string,
    input: {
      room: string;
      taskTitle: string;
      priority?: 'normal' | 'urgent';
      note?: string;
    }
  ) => void;
  deleteStaffMember: (staffId: string) => void;
  clientProfile: ClientProfile;
  setClientProfile: (profile: ClientProfile) => void;
  activeSector: SectorType | 'all';
  setActiveSector: (sector: SectorType | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateRangeMode: 'two_weeks' | 'one_month';
  setDateRangeMode: (mode: 'two_weeks' | 'one_month') => void;
  currentBaseDate: string;
  setCurrentBaseDate: (date: string) => void;
  shiftDays: (days: number) => void;
  bookings: TimelineBooking[];
  setBookings: React.Dispatch<React.SetStateAction<TimelineBooking[]>>;
  resourceGroups: ResourceGroup[];
  setResourceGroups: React.Dispatch<React.SetStateAction<ResourceGroup[]>>;
  updateHousekeepingStatus: (resourceId: string, status: 'clean' | 'cleaning' | 'dirty' | 'out_of_order') => void;
  checkConflict: (resourceId: string, startDate: string, endDate: string, excludeBookingId?: string, checkInTime?: string, checkOutTime?: string) => boolean;
  addBooking: (booking: Omit<TimelineBooking, 'id'>) => { success: boolean; error?: string; code?: 'room_not_ready'; roomName?: string; roomStatus?: 'clean' | 'cleaning' | 'dirty' | 'out_of_order'; booking?: TimelineBooking };
  updateBooking: (id: string, updates: Partial<TimelineBooking>) => { success: boolean; error?: string };
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  deleteBooking: (id: string) => Promise<void>;
  confirmCheckInAndCashPayment: (
    bookingId: string,
    cashReceived?: boolean
  ) => { success: boolean; message: string; booking?: TimelineBooking };
  markBookingAsPaid: (
    bookingId: string,
    receiptNote?: string
  ) => { success: boolean; message: string; booking?: TimelineBooking };
  selectedBooking: TimelineBooking | null;
  setSelectedBooking: (booking: TimelineBooking | null) => void;
  lastCreatedInvoice: InvoiceRecord | null;
  setLastCreatedInvoice: (invoice: InvoiceRecord | null) => void;
  createInvoiceFromBooking: (booking: TimelineBooking, docType?: DocumentType) => InvoiceRecord | null;
  isNewBookingModalOpen: boolean;
  setIsNewBookingModalOpen: (open: boolean) => void;
  newBookingInitialSlot: { resourceId?: string; date?: string; time?: string } | null;
  setNewBookingInitialSlot: (slot: { resourceId?: string; date?: string; time?: string } | null) => void;
  isCockpitOpen: boolean;
  setIsCockpitOpen: (open: boolean) => void;
  isLegalModalOpen: boolean;
  setIsLegalModalOpen: (open: boolean) => void;
  isIndexedDBOpen: boolean;
  setIsIndexedDBOpen: (open: boolean) => void;
  isQrScannerOpen: boolean;
  setIsQrScannerOpen: (open: boolean) => void;
  activeQrPassBooking: TimelineBooking | null;
  setActiveQrPassBooking: (booking: TimelineBooking | null) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  isSidebarMobileOpen: boolean;
  setIsSidebarMobileOpen: (open: boolean) => void;
  isAboutModalOpen: boolean;
  setIsAboutModalOpen: (open: boolean) => void;
  purgeAllUserData: () => Promise<void> | void;
  activeView: ActiveAppView;
  setActiveView: (view: ActiveAppView) => void;

  // PMS Hotel Complex & Multi-Currency State
  establishments: HotelEstablishment[];
  /** Remote establishment scope used by Supabase writes. Never a ResourceGroup id. */
  selectedEstablishmentId: string | 'all';
  setSelectedEstablishmentId: (id: string | 'all') => void;
  /** Local ResourceGroup (building) used by the top selector and the Gantt filter. */
  selectedBuildingGroupId: string | 'all';
  setSelectedBuildingGroupId: (id: string | 'all') => void;
  currency: 'DA' | 'DZD' | 'EUR' | 'USD' | 'RMB' | 'GBP' | 'SAR' | string;
  setCurrency: (c: string) => void;
  tasks: PmsTask[];
  addTask: (task: Omit<PmsTask, 'id'>) => void;
  updateTaskStatus: (id: string, status: PmsTask['status'], completedByOverride?: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  generateTurnoverTasksForCheckout: (roomName: string) => void;
  activeOperatorName: string;
  setActiveOperatorName: (name: string) => void;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  addStockMovement: (itemId: string, delta: number, reason: string, room?: string) => void;
  addStockItem: (item: Omit<StockItem, 'id'>) => StockItem;
  seedStandardStockCatalog: () => number;
  updateStockItem: (item: StockItem) => void;
  deleteStockItem: (id: string) => void;
  recordRoomReplenishment: (input: {
    roomId?: string;
    roomName: string;
    items: StockDeductionLine[];
    markRoomClean?: boolean;
    note?: string;
    operatorName?: string;
  }) => { deductedCount: number; lowStockTriggered: StockItem[]; rupturedItems: StockItem[] };
  suppliers: StockSupplier[];
  saveSupplier: (supplier: Omit<StockSupplier, 'id'> & { id?: string }) => StockSupplier;
  deleteSupplier: (id: string) => void;
  purchaseOrders: PurchaseOrderRecord[];
  createPurchaseOrder: (
    input: Omit<PurchaseOrderRecord, 'id' | 'orderNumber' | 'createdAt' | 'createdBy'> & {
      orderNumber?: string;
      createdBy?: string;
    }
  ) => PurchaseOrderRecord;
  updatePurchaseOrder: (po: PurchaseOrderRecord) => void;
  deletePurchaseOrder: (id: string) => void;
  markPurchaseOrderReceived: (id: string) => void;
  focusedStockTab: 'stock' | 'movements' | 'reorder' | 'suppliers' | null;
  setFocusedStockTab: (tab: 'stock' | 'movements' | 'reorder' | 'suppliers' | null) => void;
  dynamicRates: Record<string, Record<string, number>>;
  setDynamicRate: (roomType: string, date: string, price: number) => void;
  applyDynamicRatesBulk: (roomType: string, rates: Record<string, number>) => void;
  clearDynamicRate: (roomType: string, date: string) => void;
  clearDynamicRatesMonth: (roomType: string, yearMonth: string) => void;
  isSoundEnabled: boolean;
  toggleSound: () => boolean;
  playFeedback: (type: AudioFeedbackType, options?: AudioFeedbackOptions) => void;
  establishmentProfile: EstablishmentProfile;
  setEstablishmentProfile: (profile: EstablishmentProfile) => void;
  isEstablishmentModalOpen: boolean;
  setIsEstablishmentModalOpen: (open: boolean) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (done: boolean) => void;
  triggerCloudRecovery: () => Promise<CloudRecoveryReport>;
  cloudSyncStatus: CloudSyncStatus;
  forceSupabaseSync: () => Promise<CloudRecoveryReport>;
  syncLog: SyncLogEntry[];
  syncTerminalOpen: boolean;
  setSyncTerminalOpen: (open: boolean) => void;
  clearSyncLog: () => void;
  eventLogs: EventLogEntry[];
  logEvent: (input: NewEventLogInput) => EventLogEntry;
  clearEventLogs: () => Promise<void>;
  openBookingFromEvent: (bookingId: string) => boolean;
}

export interface CloudRecoveryReport {
  sources: Array<'supabase'>;
  recoveredGroupsCount: number;
  recoveredBookingsCount: number;
  recoveredTasksCount: number;
  recoveredStockCount: number;
  pushedCount?: number;
  pushFailedCount?: number;
  recoveredProfile: Partial<EstablishmentProfile> | null;
  warnings: string[];
  skippedOffline?: boolean;
}

const DEMO_BOOKING_IDS = new Set(initialBookings.map((booking) => booking.id));
const DEMO_RESOURCE_IDS = new Set(initialResourceGroups.flatMap((group) => group.resources.map((resource) => resource.id)));
const DEMO_GROUP_IDS = new Set(initialResourceGroups.map((group) => group.id));

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const workspace = useWorkspace();
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('omnibook_lang') as Language) || 'fr';
  });

  const {
    theme,
    setTheme,
    appTheme,
    setAppTheme,
    resetThemeToDefault,
  } = useThemeSync();

  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);

  const [currentDomain, setCurrentDomainState] = useState<DomainType>(() => {
    const saved = localStorage.getItem('omnibook_domain') as DomainType;
    if (saved === 'hotel' || saved === 'resort') {
      return saved;
    }
    return 'hotel';
  });

  const [storedRolesConfig, setStoredRolesConfig] = useState<StoredRolesPayload>(() => loadStoredRolesPayload());
  const roles = useMemo(() => mergeRolesWithStoredConfig(storedRolesConfig), [storedRolesConfig]);
  const hasCustomizedBuiltInRoles = Object.keys(storedRolesConfig.builtInOverrides || {}).length > 0;

  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    return normalizeLegacyRoleId(localStorage.getItem('omnibook_role'));
  });

  const activeRoleDefinition = useMemo(
    () => resolveRoleDefinition(roles, currentRole),
    [roles, currentRole]
  );

  const [persistedEventLogs, setPersistedEventLogs] = useState<EventLogEntry[]>([]);
  const [lockHistoryVersion, setLockHistoryVersion] = useState(0);
  const eventLogSeqRef = useRef(0);
  const activeWorkspaceIdRef = useRef(workspace.activeWorkspaceId);
  activeWorkspaceIdRef.current = workspace.activeWorkspaceId;
  const currentRoleRef = useRef<UserRole>(currentRole);
  currentRoleRef.current = currentRole;
  const rolesRef = useRef<RoleDefinition[]>(roles);
  rolesRef.current = roles;
  const languageRef = useRef<Language>(language);
  languageRef.current = language;
  const clientProfileRef = useRef<ClientProfile | null>(null);
  const [activeOperatorName, setActiveOperatorNameState] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('omnibook_active_operator') || '';
  });
  const activeOperatorNameRef = useRef<string>(activeOperatorName);
  activeOperatorNameRef.current = activeOperatorName;

  const setActiveOperatorName = useCallback((name: string) => {
    const cleaned = name.trim();
    setActiveOperatorNameState(cleaned);
    activeOperatorNameRef.current = cleaned;
    try {
      if (cleaned) {
        localStorage.setItem('omnibook_active_operator', cleaned);
      } else {
        localStorage.removeItem('omnibook_active_operator');
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const resolveActorLabel = useCallback((role: UserRole): string => {
    const operatorName = activeOperatorNameRef.current.trim();
    if (operatorName) return operatorName;
    const profileName = clientProfileRef.current?.name?.trim();
    if (profileName) return profileName;
    const roleDef = resolveRoleDefinition(rolesRef.current, role);
    return roleDef.label[languageRef.current] || roleDef.label.fr || String(role);
  }, []);

  const logEvent = useCallback((input: NewEventLogInput): EventLogEntry => {
    eventLogSeqRef.current += 1;
    const role = currentRoleRef.current;
    const entry: EventLogEntry = {
      id: input.id || `evt_${Date.now()}_${eventLogSeqRef.current}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: input.timestamp || new Date().toISOString(),
      category: input.category,
      action: input.action,
      severity: input.severity,
      title: input.title,
      description: input.description,
      actor: input.actor || {
        role,
        label: resolveActorLabel(role),
      },
      target: input.target,
      changes: input.changes,
      metadata: input.metadata,
      bookingId: input.bookingId,
      resourceId: input.resourceId,
      workspaceId: input.workspaceId ?? (activeWorkspaceIdRef.current || undefined),
      source: input.source ?? 'live',
    };
    setPersistedEventLogs((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, EVENT_LOG_MAX_ENTRIES));
    void indexedDb.appendEventLog(entry, EVENT_LOG_MAX_ENTRIES).catch((error) => {
      console.warn('[EventLog] Failed to persist event locally:', error);
    });
    return entry;
  }, [resolveActorLabel]);

  const clearEventLogs = useCallback(async (): Promise<void> => {
    setPersistedEventLogs([]);
    await indexedDb.clearEventLogs();
  }, []);

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => audioFeedbackService.isEnabled());

  const toggleSound = () => {
    const next = audioFeedbackService.toggle();
    setIsSoundEnabled(next);
    return next;
  };

  const playFeedback = (type: AudioFeedbackType, options?: AudioFeedbackOptions) => {
    playAudioFeedback(type, options);
  };

  const isViewAllowedForDomain = (_view: ActiveAppView, domain: DomainType) => {
    return domain === 'hotel' || domain === 'resort';
  };

  const setCurrentDomain = (d: DomainType) => {
    if (d !== currentDomain) {
      logEvent({
        category: 'system',
        action: 'system.domain_changed',
        severity: 'info',
        title: `Domaine actif modifié · ${d}`,
        description: `Bascule du secteur ${currentDomain} vers ${d}.`,
        changes: [{ field: 'Domaine', before: currentDomain, after: d }],
      });
    }
    setCurrentDomainState(d);
    localStorage.setItem('omnibook_domain', d);
    if (!isViewAllowedForDomain(activeView, d)) {
      setActiveView('planning');
    }
  };

  const setCurrentRole = (r: UserRole) => {
    const normalized = normalizeLegacyRoleId(r);
    const targetDef = resolveRoleDefinition(rolesRef.current, normalized);
    if (normalized !== currentRole) {
      const prevDef = resolveRoleDefinition(rolesRef.current, currentRole);
      logEvent({
        category: 'system',
        action: 'system.role_changed',
        severity: 'info',
        title: `Profil opérateur modifié · ${targetDef.label.fr}`,
        description: `Changement de rôle session : ${prevDef.label.fr} → ${targetDef.label.fr}.`,
        changes: [{ field: 'Rôle', before: prevDef.label.fr, after: targetDef.label.fr }],
      });
    }
    setCurrentRoleState(normalized);
    localStorage.setItem('omnibook_role', normalized);
    if (!isTabAllowedForRole(targetDef, activeView)) {
      setActiveView(resolveFallbackTabForRole(targetDef, activeView));
    }
    if (!targetDef.permissions.canManageBookings && !targetDef.allowedTabs.includes('planning') && !targetDef.allowedTabs.includes('my_bookings')) {
      setSelectedBooking(null);
      setIsNewBookingModalOpen(false);
    }
    if (!targetDef.permissions.canManageRoles && !targetDef.permissions.canManageBookings) {
      setIsEstablishmentModalOpen(false);
      setIsIndexedDBOpen(false);
      setIsCockpitOpen(false);
    }
  };

  const persistRolesConfig = useCallback((updater: (prev: StoredRolesPayload) => StoredRolesPayload) => {
    setStoredRolesConfig((prev) => {
      const next = updater(prev);
      saveStoredRolesPayload(next);
      return next;
    });
  }, []);

  const createCustomRole: AppContextType['createCustomRole'] = (input) => {
    const trimmedName = input.name.trim() || 'Nouveau rôle';
    const existingIds = rolesRef.current.map((r) => r.id);
    const id = slugifyCustomRoleId(trimmedName, existingIds);
    const allowedTabs = sanitizeAllowedTabs(input.allowedTabs);
    if (input.permissions.canManageRoles && !allowedTabs.includes('roles')) {
      allowedTabs.push('roles');
    }
    const newRole: RoleDefinition = {
      id,
      label: {
        fr: input.label?.fr?.trim() || trimmedName,
        en: input.label?.en?.trim() || trimmedName,
        ar: input.label?.ar?.trim() || trimmedName,
      },
      description: {
        fr: input.description?.fr?.trim() || '',
        en: input.description?.en?.trim() || input.description?.fr?.trim() || '',
        ar: input.description?.ar?.trim() || input.description?.fr?.trim() || '',
      },
      category: input.category,
      iconName: input.iconName,
      isBuiltIn: false,
      allowedTabs,
      permissions: { ...input.permissions },
    };

    persistRolesConfig((prev) => ({
      ...prev,
      customRoles: [...prev.customRoles, newRole],
    }));

    logEvent({
      category: 'system',
      action: 'system.role_created',
      severity: 'success',
      title: `Rôle personnalisé créé · ${newRole.label.fr}`,
      description: `${newRole.allowedTabs.length} onglet(s) autorisé(s).`,
    });

    return newRole;
  };

  const updateRoleConfig: AppContextType['updateRoleConfig'] = (roleId, patch) => {
    const isBuiltIn = BUILT_IN_ROLES.some((b) => b.id === roleId);
    const sanitizedTabs = patch.allowedTabs ? sanitizeAllowedTabs(patch.allowedTabs) : undefined;
    if (sanitizedTabs && patch.permissions?.canManageRoles && !sanitizedTabs.includes('roles')) {
      sanitizedTabs.push('roles');
    }

    persistRolesConfig((prev) => {
      if (isBuiltIn) {
        return {
          ...prev,
          builtInOverrides: {
            ...prev.builtInOverrides,
            [roleId]: {
              ...(prev.builtInOverrides[roleId] || {}),
              ...(patch.label ? { label: patch.label } : {}),
              ...(patch.description ? { description: patch.description } : {}),
              ...(patch.category ? { category: patch.category } : {}),
              ...(patch.iconName ? { iconName: patch.iconName } : {}),
              ...(sanitizedTabs ? { allowedTabs: sanitizedTabs } : {}),
              ...(patch.permissions ? { permissions: patch.permissions } : {}),
            },
          },
        };
      }
      return {
        ...prev,
        customRoles: prev.customRoles.map((role) =>
          role.id === roleId
            ? {
                ...role,
                label: patch.label || role.label,
                description: patch.description || role.description,
                category: patch.category || role.category,
                iconName: patch.iconName || role.iconName,
                allowedTabs: sanitizedTabs || role.allowedTabs,
                permissions: patch.permissions || role.permissions,
              }
            : role
        ),
      };
    });

    logEvent({
      category: 'system',
      action: 'system.role_updated',
      severity: 'info',
      title: `Permissions de rôle mises à jour · ${resolveRoleDefinition(rolesRef.current, roleId).label.fr}`,
      description: sanitizedTabs ? `${sanitizedTabs.length} onglet(s) configuré(s).` : 'Configuration modifiée.',
    });
  };

  const deleteCustomRole = (roleId: UserRole): boolean => {
    if (BUILT_IN_ROLES.some((b) => b.id === roleId)) return false;
    const target = rolesRef.current.find((r) => r.id === roleId);
    if (!target) return false;

    persistRolesConfig((prev) => ({
      ...prev,
      customRoles: prev.customRoles.filter((r) => r.id !== roleId),
    }));

    if (currentRole === roleId) {
      setCurrentRole('manager');
    }

    logEvent({
      category: 'system',
      action: 'system.role_deleted',
      severity: 'warn',
      title: `Rôle personnalisé supprimé · ${target.label.fr}`,
      description: `Le rôle ${target.label.fr} a été supprimé.`,
    });
    return true;
  };

  const resetBuiltInRoles = () => {
    persistRolesConfig((prev) => ({
      ...prev,
      builtInOverrides: {},
    }));
  };

  const [activeSector, setActiveSector] = useState<SectorType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeMode, setDateRangeMode] = useState<'two_weeks' | 'one_month'>('two_weeks');
  const [currentBaseDate, setCurrentBaseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [activeView, setActiveView] = useState<ActiveAppView>(() =>
    resolveFallbackTabForRole(
      resolveRoleDefinition(mergeRolesWithStoredConfig(loadStoredRolesPayload()), normalizeLegacyRoleId(localStorage.getItem('omnibook_role'))),
      'planning'
    )
  );

  // Ensure the active view is always permitted for the currently selected role.
  useEffect(() => {
    if (activeView !== 'help' && !isTabAllowedForRole(activeRoleDefinition, activeView)) {
      setActiveView(resolveFallbackTabForRole(activeRoleDefinition, activeView));
    }
  }, [activeRoleDefinition, activeView]);

  // PMS Hotel Complex & Multi-Currency (DZD, EUR, USD, RMB, GBP, SAR)
  // Populated only from verified remote Supabase establishments (never fabricated locally).
  const [establishments, setEstablishments] = useState<HotelEstablishment[]>([]);
  const [hasLoadedRemoteSnapshot, setHasLoadedRemoteSnapshot] = useState(false);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | 'all'>('all');
  const [selectedBuildingGroupId, setSelectedBuildingGroupId] = useState<string | 'all'>('all');
  const [currency, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem('omnibook_currency') || 'DA';
  });

  const setCurrency = (c: string) => {
    if (c !== currency) {
      logEvent({
        category: 'system',
        action: 'system.currency_changed',
        severity: 'info',
        title: `Devise modifiée · ${c}`,
        description: `Changement de devise par défaut : ${currency} → ${c}.`,
        changes: [{ field: 'Devise', before: currency, after: c }],
      });
    }
    setCurrencyState(c);
    localStorage.setItem('omnibook_currency', c);
  };

  // Establishment Profile (Hôtel, Coordonnées, Logo, Fiscalité) & Onboarding
  const [establishmentProfile, setEstablishmentProfileState] = useState<EstablishmentProfile>(() => {
    const saved = localStorage.getItem('omnibook_establishment_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<EstablishmentProfile>;
        // Older releases persisted a fabricated demo hotel as if it were real.
        if (parsed.id === 'est_default_oran' && parsed.name === 'Grand Hôtel & Resort Méditerranée') {
          localStorage.removeItem('omnibook_establishment_profile');
          return DEFAULT_ESTABLISHMENT_PROFILE;
        }
        return { ...DEFAULT_ESTABLISHMENT_PROFILE, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_ESTABLISHMENT_PROFILE;
  });

  const setEstablishmentProfile = (profile: EstablishmentProfile) => {
    const normalized = { ...DEFAULT_ESTABLISHMENT_PROFILE, ...profile };
    const prev = establishmentProfile;
    const changes: Array<{ field: string; before?: string; after?: string }> = [];
    if (prev.name !== normalized.name) changes.push({ field: 'Nom établissement', before: prev.name || '—', after: normalized.name || '—' });
    if (prev.city !== normalized.city) changes.push({ field: 'Ville', before: prev.city || '—', after: normalized.city || '—' });
    if (prev.phone !== normalized.phone) changes.push({ field: 'Téléphone', before: prev.phone || '—', after: normalized.phone || '—' });
    if (prev.defaultCurrency !== normalized.defaultCurrency) changes.push({ field: 'Devise', before: prev.defaultCurrency || '—', after: normalized.defaultCurrency || '—' });
    if (changes.length > 0) {
      logEvent({
        category: 'system',
        action: 'system.profile_updated',
        severity: 'info',
        title: `Fiche établissement mise à jour · ${normalized.name || 'Hôtel'}`,
        description: `${changes.length} paramètre(s) établissement modifié(s).`,
        target: { type: 'establishment', id: normalized.id, label: normalized.name },
        changes,
      });
    }
    setEstablishmentProfileState(normalized);
    localStorage.setItem('omnibook_establishment_profile', JSON.stringify(normalized));
  };

  const resolveMutationEstablishmentId = (): string => {
    if (selectedEstablishmentId !== 'all' && selectedEstablishmentId.trim()) return selectedEstablishmentId;
    if (establishmentProfile.id && establishmentProfile.id !== 'establishment-draft') return establishmentProfile.id;
    if (establishmentProfile.name.trim()) return stableEstablishmentId(establishmentProfile);
    return '';
  };

  const createMutationId = (): string => {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
  };

  const queueBusinessUpsert = async (
    entity: 'task' | 'stock_item' | 'stock_movement' | 'supplier' | 'purchase_order' | 'staff_member' | 'establishment_profile',
    entityId: string,
    payload: Record<string, unknown>,
    establishmentOverride?: string,
  ): Promise<void> => {
    const workspaceId = workspace.activeWorkspaceId?.trim();
    // Local-only installations remain usable; cloud Outbox requires a verified tenant.
    if (!workspaceId) return;
    const establishmentId = establishmentOverride?.trim() || resolveMutationEstablishmentId();
    if (!establishmentId || establishmentId === 'all') {
      throw new Error(`Établissement réel requis pour synchroniser ${entity}/${entityId}.`);
    }
    const context = { workspaceId, establishmentId };
    const idempotencyKey = `${workspaceId}:${entity}:${entityId}:${createMutationId()}`;
    await indexedDb.enqueueOutboxOnly(
      context, entity, entityId, 'upsert', 1,
      { ...payload, workspaceId, establishmentId }, idempotencyKey,
    );
  };

  const queueBusinessDelete = async (
    entity: 'task' | 'stock_item' | 'supplier' | 'purchase_order' | 'staff_member',
    entityId: string,
  ): Promise<void> => {
    const workspaceId = workspace.activeWorkspaceId?.trim();
    if (!workspaceId) return;
    const establishmentId = resolveMutationEstablishmentId();
    if (!establishmentId || establishmentId === 'all') {
      throw new Error(`Établissement réel requis pour supprimer ${entity}/${entityId}.`);
    }
    await indexedDb.deleteWorkspaceEntityWithOutbox(
      { workspaceId, establishmentId }, entity, entityId,
      `${workspaceId}:${entity}:${entityId}:${createMutationId()}`,
    );
  };

  const reportQueueFailure = (entity: string, entityId: string, error: unknown): void => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[P2P/Outbox] ${entity}/${entityId} was not queued:`, detail);
    setCloudSyncStatus((prev) => ({
      ...prev,
      phase: 'error',
      lastError: `Mutation locale non ajoutée à l’Outbox (${entity}/${entityId}) : ${detail}`,
    }));
  };

  // Recover committed generic projections before relying on the localStorage mirror.
  useEffect(() => {
    const workspaceId = workspace.activeWorkspaceId?.trim();
    if (!workspaceId) return;
    let cancelled = false;
    void Promise.all([
      indexedDb.getWorkspaceEntities<PmsTask>(workspaceId, 'task'),
      indexedDb.getWorkspaceEntities<StockItem>(workspaceId, 'stock_item'),
      indexedDb.getWorkspaceEntities<StockMovement>(workspaceId, 'stock_movement'),
      indexedDb.getWorkspaceEntities<StockSupplier>(workspaceId, 'supplier'),
      indexedDb.getWorkspaceEntities<PurchaseOrderRecord>(workspaceId, 'purchase_order'),
      indexedDb.getWorkspaceEntities<StaffMemberRecord>(workspaceId, 'staff_member'),
      indexedDb.getWorkspaceEntities<EstablishmentProfile>(workspaceId, 'establishment_profile'),
    ]).then(([tasksRows, stockRows, movementRows, supplierRows, orderRows, staffRows, profileRows]) => {
      if (cancelled) return;
      const mergeById = <T extends { id: string }>(local: T[], durable: T[]): T[] => {
        const rows = new Map(local.map((item) => [item.id, item]));
        for (const item of durable) rows.set(item.id, item);
        return [...rows.values()];
      };
      if (tasksRows.length) setTasks((prev) => {
        const next = mergeById(prev, tasksRows);
        localStorage.setItem('omnibook_pms_tasks', JSON.stringify(next));
        return next;
      });
      if (stockRows.length) setStockItems((prev) => {
        const next = mergeById(prev, stockRows);
        stockItemsRef.current = next;
        localStorage.setItem('omnibook_stock_items', JSON.stringify(next));
        return next;
      });
      if (movementRows.length) setStockMovements((prev) => {
        const next = mergeById(prev, movementRows).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        localStorage.setItem('omnibook_stock_movements', JSON.stringify(next.slice(0, 200)));
        return next.slice(0, 200);
      });
      if (supplierRows.length) setSuppliers((prev) => {
        const next = mergeById(prev, supplierRows);
        localStorage.setItem('omnibook_stock_suppliers', JSON.stringify(next));
        return next;
      });
      if (orderRows.length) setPurchaseOrders((prev) => {
        const next = mergeById(prev, orderRows);
        localStorage.setItem('omnibook_purchase_orders', JSON.stringify(next));
        return next;
      });
      if (staffRows.length) setStaffMembers((prev) => {
        const next = mergeById(prev, staffRows);
        localStorage.setItem('omnibook_staff_members', JSON.stringify(next));
        return next;
      });
      if (profileRows.length && !(latestProfileRef.current.name ?? '').trim()) {
        const profile = profileRows[profileRows.length - 1];
        setEstablishmentProfileState(profile);
        latestProfileRef.current = profile;
        localStorage.setItem('omnibook_establishment_profile', JSON.stringify(profile));
      }
    }).catch((error) => {
      reportQueueFailure('workspaceEntities', workspaceId, error);
    });
    return () => { cancelled = true; };
  }, [workspace.activeWorkspaceId]);

  const [hasOnboarded, setHasOnboardedState] = useState<boolean>(() => {
    return localStorage.getItem('omnibook_onboarding_completed') === 'true';
  });

  const setHasOnboarded = (done: boolean) => {
    setHasOnboardedState(done);
    if (done) {
      localStorage.setItem('omnibook_onboarding_completed', 'true');
    } else {
      localStorage.removeItem('omnibook_onboarding_completed');
    }
  };

  // 1ère ouverture : ouvre automatiquement le modal d'onboarding si non complété
  const [isEstablishmentModalOpen, setIsEstablishmentModalOpen] = useState<boolean>(() => {
    return localStorage.getItem('omnibook_onboarding_completed') !== 'true';
  });

  // Stock & Inventory
  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem('omnibook_stock_items');
    if (saved) {
      try {
        const demoIds = new Set(initialStockItems.map((item) => item.id));
        return (JSON.parse(saved) as StockItem[]).filter((item) => !demoIds.has(item.id));
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });
  const stockItemsRef = useRef<StockItem[]>(stockItems);
  stockItemsRef.current = stockItems;

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem('omnibook_stock_movements');
    if (saved) {
      try {
        const demoMovementIds = new Set(['sm_1', 'sm_2', 'sm_3']);
        return (JSON.parse(saved) as StockMovement[]).filter((movement) => !demoMovementIds.has(movement.id));
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [suppliers, setSuppliers] = useState<StockSupplier[]>(() => {
    const saved = localStorage.getItem('omnibook_stock_suppliers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? (parsed as StockSupplier[]) : [];
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>(() => {
    const saved = localStorage.getItem('omnibook_purchase_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? (parsed as PurchaseOrderRecord[]) : [];
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [focusedStockTab, setFocusedStockTab] = useState<'stock' | 'movements' | 'reorder' | 'suppliers' | null>(null);

  // HR Staff Directory & Career History
  const [staffMembers, setStaffMembers] = useState<StaffMemberRecord[]>(() => {
    const saved = localStorage.getItem('omnibook_staff_members');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? (parsed as StaffMemberRecord[]) : [];
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // PMS Tasks & Deliveries
  const [tasks, setTasks] = useState<PmsTask[]>(() => {
    const saved = localStorage.getItem('omnibook_pms_tasks');
    if (saved) {
      try {
        const demoIds = new Set(initialPmsTasks.map((task) => task.id));
        return (JSON.parse(saved) as PmsTask[]).filter((task) => !demoIds.has(task.id));
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Dynamic Rates Matrix
  const [dynamicRates, setDynamicRates] = useState<Record<string, Record<string, number>>>(() => {
    const saved = localStorage.getItem('omnibook_dynamic_rates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {};
  });

  // Operational inventory starts empty. Real records are hydrated from IndexedDB;
  // mockData is retained only as a legacy-ID deny-list during migration.
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [bookings, setBookings] = useState<TimelineBooking[]>([]);
  const [isCoreDataHydrated, setIsCoreDataHydrated] = useState(false);

  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(INITIAL_CLOUD_SYNC_STATUS);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncTerminalOpen, setSyncTerminalOpen] = useState(false);
  const syncLogSeqRef = useRef(0);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerSyncFnRef = useRef<((options?: { force?: boolean }) => Promise<CloudRecoveryReport>) | null>(null);

  const scheduleAutoSync = useCallback((delayMs = 900) => {
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }
    autoSyncTimerRef.current = setTimeout(() => {
      autoSyncTimerRef.current = null;
      if (triggerSyncFnRef.current) {
        void triggerSyncFnRef.current({ force: false });
      }
    }, delayMs);
  }, []);

  // Only explicit user-created/edited records enter the outbox. Bootstrap mock records are excluded.
  const persistBookingMutation = (booking: TimelineBooking) => {
    if (!workspace.activeWorkspaceId || isDemoBookingId(booking.id, DEMO_BOOKING_IDS)) return;
    const bookedResource = latestGroupsRef.current
      .flatMap((group) => group.resources)
      .find((resource) => resource.id === booking.resourceId);
    const resolvedEstablishmentId =
      selectedEstablishmentId !== 'all'
        ? selectedEstablishmentId
        : bookedResource?.establishmentId || stableEstablishmentId(establishmentProfile);
    void indexedDb.putWithOutbox(
      'bookings',
      booking,
      {
        workspaceId: workspace.activeWorkspaceId,
        establishmentId: resolvedEstablishmentId,
      },
      'booking'
    )
      .then(() => {
        scheduleAutoSync();
      })
      .catch((error) => console.error('[Outbox] Booking mutation was not queued:', error));
  };

  const createInvoiceFromBooking = (booking: TimelineBooking, docType: DocumentType = 'invoice'): InvoiceRecord | null => {
    if (!booking.id) return null;
    const profile = establishmentProfile;
    const activeCurrency = profile.defaultCurrency || currency || 'DA';
    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const prefix = docType === 'invoice' ? 'FAC' : docType === 'quote' ? 'DEV' : 'PRO';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const docNumber = `${prefix}-2026-${randNum}`;
    const item: InvoiceItem = {
      id: `inv_item_${Date.now()}`,
      description: booking.resourceName || 'Séjour / Hébergement',
      quantity: 1,
      unitPrice: booking.totalPrice > 0 ? booking.totalPrice : 0,
      vatRate: 10,
      total: booking.totalPrice > 0 ? booking.totalPrice : 0,
    };
    const subtotalHT = Math.round((item.quantity * item.unitPrice) / (1 + item.vatRate / 100) * 100) / 100;
    const vatAmount = Math.round(subtotalHT * (item.vatRate / 100) * 100) / 100;
    const totalTTC = Math.round((subtotalHT + vatAmount) * 100) / 100;
    const invoice: InvoiceRecord = {
      id: `inv_${Date.now()}`,
      docNumber,
      docType,
      domain: booking.sector as DomainType,
      bookingId: booking.id,
      customerName: booking.guestName || 'Client',
      customerEmail: booking.guestEmail || 'client@example.com',
      customerPhone: booking.guestPhone || undefined,
      issueDate,
      validUntilOrDueDate: dueDate,
      items: [item],
      subtotalHT,
      discountType: 'none',
      discountValue: 0,
      discountAmount: 0,
      vatAmount,
      cityTouristTax: 0,
      currency: activeCurrency,
      totalTTC,
      depositPaid: 0,
      balanceDue: totalTTC,
      status: docType === 'invoice' ? 'sent' : 'draft',
      termsAndNotes: `Document généré depuis la réservation ${booking.id}.`,
    };
    try {
      const saved = localStorage.getItem('omnibook_invoices');
      const existing: InvoiceRecord[] = saved ? JSON.parse(saved) : [];
      const updated = [invoice, ...existing];
      localStorage.setItem('omnibook_invoices', JSON.stringify(updated));
      setLastCreatedInvoice(invoice);
      logEvent({
        category: 'billing',
        action: 'billing.invoice_created',
        severity: 'success',
        title: `${docNumber} créé · ${invoice.customerName}`,
        description: `Document ${docType.toUpperCase()} généré depuis séjour · Total TTC ${totalTTC} ${activeCurrency}.`,
        target: { type: 'invoice', id: invoice.id, label: docNumber, secondaryLabel: invoice.customerName },
        metadata: {
          docType,
          docNumber,
          totalTTC,
          subtotalHT,
          vatAmount,
          currency: activeCurrency,
        },
        bookingId: booking.id,
        resourceId: booking.resourceId,
      });
      return invoice;
    } catch (error) {
      console.error('[Invoice] Failed to persist invoice from booking:', error);
      return null;
    }
  };

  const [clientProfile, setClientProfileState] = useState<ClientProfile>(() => {
    const saved = localStorage.getItem('omnibook_client_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ClientProfile;
        if (parsed.id === 'clt_2026_9812' && parsed.email === 'alex.kaufmann@example.com') {
          localStorage.removeItem('omnibook_client_profile');
          return { id: '', name: '', email: '', phone: '', memberNumber: '', loyaltyPoints: 0 };
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return {
      id: '',
      name: '',
      email: '',
      phone: '',
      memberNumber: '',
      loyaltyPoints: 0,
    };
  });
  clientProfileRef.current = clientProfile;

  const setClientProfile = (p: ClientProfile) => {
    setClientProfileState(p);
    localStorage.setItem('omnibook_client_profile', JSON.stringify(p));
  };

  const [selectedBooking, setSelectedBooking] = useState<TimelineBooking | null>(null);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<InvoiceRecord | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [newBookingInitialSlot, setNewBookingInitialSlot] = useState<{ resourceId?: string; date?: string; time?: string } | null>(null);
  const [isCockpitOpen, setIsCockpitOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isIndexedDBOpen, setIsIndexedDBOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [activeQrPassBooking, setActiveQrPassBooking] = useState<TimelineBooking | null>(null);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Sync language with HTML dir and lang
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('omnibook_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  // Hydrate the operational collections before enabling persistence. This prevents
  // the first React render (empty state) from overwriting existing IndexedDB data.
  useEffect(() => {
    let cancelled = false;
    const readLegacy = <T,>(key: string): T[] => {
      try {
        const value = localStorage.getItem(key);
        const parsed = value ? JSON.parse(value) : [];
        return Array.isArray(parsed) ? parsed as T[] : [];
      } catch (error) {
        console.warn(`[AppContext] Legacy data ${key} could not be parsed:`, error);
        return [];
      }
    };

    void (async () => {
      try {
        await indexedDb.openStore();
        const [storedBookings, storedResources, storedGroups, storedEventLogs] = await Promise.all([
          indexedDb.queryStore<TimelineBooking>('bookings'),
          indexedDb.queryStore<ResourceItem>('resources'),
          indexedDb.getAllFromStore<ResourceGroup>('resourceGroups'),
          indexedDb.getEventLogs(),
        ]);
        const demoBookingIds = new Set(initialBookings.map((booking) => booking.id));
        const demoResourceIds = new Set(initialResourceGroups.flatMap((group) => group.resources.map((resource) => resource.id)));
        const demoGroupIds = new Set(initialResourceGroups.map((group) => group.id));

        const legacyBookings = readLegacy<TimelineBooking>('omnibook_bookings');
        const bookingById = new Map<string, TimelineBooking>();
        for (const booking of legacyBookings) bookingById.set(booking.id, booking);
        // IndexedDB wins on conflicts; legacy localStorage contributes only missing IDs.
        for (const booking of storedBookings.data) bookingById.set(booking.id, booking);
        const realBookings = [...bookingById.values()]
          .filter((booking) => !demoBookingIds.has(booking.id))
          .map((booking) => normalizeBookingForPersistence(booking));

        const legacyGroups = readLegacy<ResourceGroup>('omnibook_resource_groups')
          .filter((group) => !demoGroupIds.has(group.id));
        const legacyGroupByResourceId = new Map<string, string>();
        for (const group of legacyGroups) {
          for (const resource of group.resources) legacyGroupByResourceId.set(resource.id, group.id);
        }
        const legacyResources = legacyGroups.flatMap((group) =>
          group.resources.map((resource) => ({ ...resource, groupId: group.id }))
        );
        const resourceById = new Map<string, ResourceItem>();
        for (const resource of legacyResources) resourceById.set(resource.id, resource);
        for (const resource of storedResources.data) resourceById.set(resource.id, resource);
        const sourceResources = [...resourceById.values()]
          .filter((resource) => !demoResourceIds.has(resource.id))
          .map((resource) => ({
            ...resource,
            groupId: resource.groupId ?? legacyGroupByResourceId.get(resource.id),
          }));
        const groupById = new Map<string, ResourceGroup>();
        for (const group of legacyGroups) groupById.set(group.id, group);
        for (const group of storedGroups) groupById.set(group.id, group);
        const groupMetadata = [...groupById.values()]
          .filter((group) => !demoGroupIds.has(group.id))
          .map((group) => ({ ...group, resources: [] as ResourceItem[] }));

        let hydratedGroups: ResourceGroup[] = groupMetadata.map((group) => ({ ...group, resources: [] }));
        const hydratedGroupById = new Map<string, ResourceGroup>(
          hydratedGroups.map((group) => [group.id, group] as const)
        );
        const fallbackGroups = new Map<string, ResourceGroup>();
        for (const resource of sourceResources) {
          const parent = resource.groupId ? hydratedGroupById.get(resource.groupId) : undefined;
          if (parent) {
            parent.resources.push(resource);
            continue;
          }
          // Older records have no groupId. Reconstruct only a presentation group
          // from their explicit building label; never create an Establishment.
          if (!resource.groupId && resource.building) {
            const id = `local-building-${resource.building}`;
            let group = fallbackGroups.get(id);
            if (!group) {
              group = {
                id,
                name: { fr: resource.building, en: resource.building, ar: resource.building },
                sector: resource.sector,
                icon: 'Building',
                resources: [],
              };
              fallbackGroups.set(id, group);
            }
            group.resources.push(resource);
          }
        }
        hydratedGroups = [...hydratedGroups, ...fallbackGroups.values()];
        // Commit the merged, demo-filtered migration before deleting legacy snapshots.
        await Promise.all([
          indexedDb.replaceAllForMigration('bookings', realBookings),
          indexedDb.replaceAllForMigration('resources', sourceResources),
          indexedDb.replaceStoreForMigration('resourceGroups', groupMetadata),
        ]);
        try {
          localStorage.removeItem('omnibook_bookings');
          localStorage.removeItem('omnibook_resource_groups');
        } catch (cleanupError) {
          console.warn('[AppContext] Legacy snapshot cleanup failed after IndexedDB migration:', cleanupError);
        }
        if (cancelled) return;
        setBookings(realBookings);
        setResourceGroups(hydratedGroups);
        if (storedEventLogs.length > 0) {
          setPersistedEventLogs((prev) => {
            const byId = new Map(storedEventLogs.map((item) => [item.id, item]));
            for (const item of prev) byId.set(item.id, item);
            return [...byId.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, EVENT_LOG_MAX_ENTRIES);
          });
        }
        setIsCoreDataHydrated(true);
      } catch (error) {
        console.error('[AppContext] Core IndexedDB hydration failed; writes are disabled to protect existing data:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reconcile UI snapshots through strict, versioned Outbox + P2P mutations.
  // Absence from a React snapshot never implies deletion, and rows from another
  // workspace are never copied into the currently selected workspace.
  useEffect(() => {
    if (!isCoreDataHydrated || !workspace.activeWorkspaceId) return;
    const realBookings = bookings.filter((booking) => !isDemoBookingId(booking.id, DEMO_BOOKING_IDS));
    void indexedDb.reconcileSnapshotWithOutbox(
      'bookings',
      realBookings,
      'booking',
      (booking) => {
        const resource = latestGroupsRef.current
          .flatMap((group) => group.resources)
          .find((item) => item.id === booking.resourceId);
        return {
          workspaceId: workspace.activeWorkspaceId,
          establishmentId: (booking as TimelineBooking & { establishmentId?: string }).establishmentId
            ?? resource?.establishmentId
            ?? (selectedEstablishmentId !== 'all'
              ? selectedEstablishmentId
              : stableEstablishmentId(establishmentProfile)),
        };
      },
      DEMO_BOOKING_IDS,
    ).catch((error) => {
      console.error('[AppContext] Booking snapshot reconciliation failed; existing rows were preserved:', error);
    });
  }, [
    bookings,
    isCoreDataHydrated,
    workspace.activeWorkspaceId,
    selectedEstablishmentId,
    establishmentProfile,
  ]);

  useEffect(() => {
    if (!isCoreDataHydrated || !workspace.activeWorkspaceId) return;
    const groupMetadata = resourceGroups
      .filter((group) => !DEMO_GROUP_IDS.has(group.id))
      .map((group) => ({ ...group, resources: [] as ResourceItem[] }));
    const resources = resourceGroups.flatMap((group) =>
      group.resources
        .filter((resource) => !DEMO_RESOURCE_IDS.has(resource.id))
        .map((resource) => ({ ...resource, groupId: group.id }))
    );
    const contextForEstablishment = (establishmentId?: string) => ({
      workspaceId: workspace.activeWorkspaceId,
      establishmentId: establishmentId
        ?? (selectedEstablishmentId !== 'all'
          ? selectedEstablishmentId
          : stableEstablishmentId(establishmentProfile)),
    });
    void Promise.all([
      indexedDb.reconcileSnapshotWithOutbox(
        'resourceGroups',
        groupMetadata,
        'resource_group',
        (group) => contextForEstablishment(group.resources[0]?.establishmentId),
        DEMO_GROUP_IDS,
      ),
      indexedDb.reconcileSnapshotWithOutbox(
        'resources',
        resources,
        'resource',
        (resource) => contextForEstablishment(resource.establishmentId),
        DEMO_RESOURCE_IDS,
      ),
    ]).catch((error) => {
      console.error('[AppContext] Resource/group snapshot reconciliation failed; existing rows were preserved:', error);
    });
  }, [
    resourceGroups,
    isCoreDataHydrated,
    workspace.activeWorkspaceId,
    selectedEstablishmentId,
    establishmentProfile,
  ]);

  const latestBookingsRef = useRef(bookings);
  const latestGroupsRef = useRef(resourceGroups);
  const latestProfileRef = useRef(establishmentProfile);
  latestBookingsRef.current = bookings;
  latestGroupsRef.current = resourceGroups;
  latestProfileRef.current = establishmentProfile;

  const [supabaseConfigVersion, setSupabaseConfigVersion] = useState(0);
  const syncInFlightRef = useRef<Promise<CloudRecoveryReport> | null>(null);
  const pendingResyncRef = useRef(false);
  const pendingForceRef = useRef(false);
  const pendingRealtimeRef = useRef(false);
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;
  const selectedEstablishmentIdRef = useRef(selectedEstablishmentId);
  selectedEstablishmentIdRef.current = selectedEstablishmentId;
  const isOfflineRef = useRef(isOffline);
  isOfflineRef.current = isOffline;
  const isHydratedRef = useRef(isCoreDataHydrated);
  isHydratedRef.current = isCoreDataHydrated;
  const backfillRunRef = useRef(false);

  // A workspace/account change must never reuse another tenant's cached remote
  // roots, loaded-snapshot flag or one-shot backfill latch.
  useEffect(() => {
    setEstablishments([]);
    setHasLoadedRemoteSnapshot(false);
    backfillRunRef.current = false;
  }, [workspace.activeWorkspaceId]);

  // Keep cloudSyncStatus evidence-based whenever Outbox records change locally
  useEffect(() => {
    let active = true;
    const refreshSummary = async () => {
      const wsId = activeWorkspaceIdRef.current;
      const prev = cloudSyncStatusRef.current;
      if (prev.isSyncing) return;
      const emptySummary: { pendingCount: number; failedCount: number; dueCount: number; lastError?: string } = {
        pendingCount: 0,
        failedCount: 0,
        dueCount: 0,
      };
      const summary = wsId ? await indexedDb.getOutboxSummary(wsId).catch(() => emptySummary) : emptySummary;
      let hasSession = false;
      if (isSupabaseConfigured && supabase && !isOfflineRef.current) {
        try {
          const { data } = await supabase.auth.getSession();
          hasSession = Boolean(data.session);
        } catch {
          hasSession = false;
        }
      }
      if (!active) return;
      const phase = deriveIdleSyncPhase({
        isOffline: isOfflineRef.current,
        isConfigured: isSupabaseConfigured,
        isAuthenticated: hasSession,
        workspaceId: wsId,
        summary,
        lastSyncedAt: prev.lastSyncedAt,
        lastError: summary.lastError ?? prev.lastError,
      });
      setCloudSyncStatus((current) => ({
        ...current,
        phase,
        pendingCount: summary.pendingCount,
        failedCount: summary.failedCount,
        lastError: summary.lastError ?? (phase === 'synced' ? null : current.lastError),
        workspaceId: wsId,
      }));
    };

    void refreshSummary();
    const unsubscribe = indexedDb.subscribeOutboxChanges(() => {
      void refreshSummary();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [workspace.activeWorkspaceId, isOffline]);

  const appendSyncLog = useCallback((event: SyncProgressEvent) => {
    syncLogSeqRef.current += 1;
    const entry: SyncLogEntry = {
      ...event,
      id: `sync-${syncLogSeqRef.current}`,
      at: new Date().toISOString(),
    };
    setSyncLog((prev) => [...prev, entry].slice(-SYNC_LOG_MAX_ENTRIES));

    if (
      event.key !== 'syncLogNothingToSync' &&
      event.key !== 'syncLogStarted' &&
      event.key !== 'syncLogVerifying'
    ) {
      const severity =
        event.level === 'error'
          ? 'error'
          : event.level === 'warn'
          ? 'warn'
          : event.key === 'syncLogSynced' || event.key === 'syncLogPushDone' || event.key === 'syncLogBackfillDone'
          ? 'success'
          : 'info';
      const titleMap: Record<string, string> = {
        syncLogSynced: 'Synchronisation Supabase vérifiée',
        syncLogPending: 'Synchronisation partielle (Outbox en attente)',
        syncLogForceStarted: 'Synchronisation manuelle lancée',
        syncLogBackfillSkipped: 'Initialisation espace ignorée',
        syncLogBackfillDone: 'Espace personnel initialisé vers Supabase',
        syncLogBackfillFailed: 'Échec initialisation espace personnel',
        syncLogPushing: 'Envoi Outbox vers Supabase',
        syncLogPushed: 'Élément poussé vers Supabase',
        syncLogPushDone: 'Envoi Outbox terminé',
        syncLogPushFailed: 'Échec partiel d’envoi Outbox',
        syncLogPulling: 'Récupération des données distantes',
        syncLogPulled: 'Données distantes récupérées',
        syncLogPullFailed: 'Échec récupération distante',
        syncLogMerged: 'Fusion locale/distante appliquée',
        syncLogError: 'Erreur synchronisation Supabase',
        cloudStatusOffline: 'Mode hors ligne détecté',
        cloudStatusNotConfigured: 'Synchronisation cloud non configurée',
        supabaseStatusAuthRequired: 'Session Supabase requise',
        supabaseStatusNoWorkspace: 'Aucun espace de travail actif',
      };
      const meta: Record<string, string | number | boolean | null> = {
        key: event.key,
        detail: event.detail ?? null,
      };
      if (event.params) {
        for (const [k, v] of Object.entries(event.params)) {
          meta[k] = v;
        }
      }
      logEvent({
        category: 'sync',
        action: `sync.${event.key}`,
        severity,
        title: titleMap[event.key] || event.key,
        description: event.detail || `Événement synchronisation (${event.key})`,
        actor: { role: 'system', label: 'Sync Supabase' },
        metadata: meta,
      });
    }
  }, [logEvent]);

  const clearSyncLog = useCallback(() => setSyncLog([]), []);

  // Observe proUSB lock hardware, card issuance/revocation, and lock audit scans.
  useEffect(() => {
    const getAuditKey = (audit: { orderFlag: number; openTime: string; recDataHex: string }) =>
      `${audit.orderFlag}-${audit.openTime}-${audit.recDataHex}`;

    let prevStatus = lockManager.getStatus();
    let prevCardsById = new Map(lockManager.getIssuedCards().map((c) => [c.id, c.status]));
    let prevAuditIds = new Set(lockManager.getAuditRecords().map(getAuditKey));

    const unsubscribe = lockManager.subscribeState(() => {
      setLockHistoryVersion((v) => v + 1);
      const nextStatus = lockManager.getStatus();
      if (nextStatus !== prevStatus) {
        const device = lockManager.getDeviceInfo();
        prevStatus = nextStatus;
        if (nextStatus === 'connected') {
          logEvent({
            category: 'locks',
            action: 'locks.usb_connected',
            severity: 'success',
            title: 'Encodeur proUSB connecté',
            description: `${device?.productName || 'proUSB-TEMIC'}${device?.readerLabel ? ` · ${device.readerLabel}` : ''}`,
            target: { type: 'hardware', label: device?.productName || 'proUSB-TEMIC' },
            metadata: {
              encoderNo: device?.encoderNo ?? null,
              machineCode: device?.machineCode ?? null,
            },
          });
        } else {
          logEvent({
            category: 'locks',
            action: 'locks.usb_disconnected',
            severity: 'warn',
            title: 'Encodeur proUSB déconnecté',
            description: 'L’encodeur WebHID a été déconnecté.',
            target: { type: 'hardware', label: 'proUSB-TEMIC' },
          });
        }
      }

      const currentCards = lockManager.getIssuedCards();
      for (const card of currentCards) {
        const prevCardStatus = prevCardsById.get(card.id);
        if (!prevCardStatus) {
          logEvent({
            category: 'locks',
            action: 'locks.card_issued',
            severity: 'success',
            title: `Carte ${card.type} émise · ${card.roomNumber || 'Système'}`,
            description: `Titulaire : ${card.holderName || '—'} · Validité jusqu’au ${card.validUntil || '—'}`,
            target: { type: 'card', id: card.id, label: card.holderName || card.type, secondaryLabel: card.roomNumber },
            metadata: { cardType: card.type, roomNumber: card.roomNumber || null, status: card.status, operator: card.operator },
          });
        } else if (prevCardStatus !== 'revoked' && card.status === 'revoked') {
          logEvent({
            category: 'locks',
            action: 'locks.card_revoked',
            severity: 'warn',
            title: `Carte ${card.type} révoquée · ${card.roomNumber || 'Système'}`,
            description: `Carte annulée pour ${card.holderName || 'titulaire'}.`,
            target: { type: 'card', id: card.id, label: card.holderName || card.type, secondaryLabel: card.roomNumber },
          });
        }
      }
      prevCardsById = new Map(currentCards.map((c) => [c.id, c.status]));

      const currentAudits = lockManager.getAuditRecords();
      for (const audit of currentAudits) {
        const auditKey = getAuditKey(audit);
        if (!prevAuditIds.has(auditKey)) {
          logEvent({
            category: 'locks',
            action: `locks.${audit.eventType}`,
            severity: audit.eventType === 'emergency_open' || audit.eventType === 'deadbolt_forced' || audit.eventType === 'invalid_card' ? 'warn' : 'info',
            title: `Audit serrure ${audit.roomNo || '—'} · ${audit.eventType}`,
            description: `Carte ${audit.cardIdentifier || '—'} · Trame ${audit.recDataHex}`,
            target: { type: 'lock_audit', id: auditKey, label: audit.roomNo || 'Serrure', secondaryLabel: audit.cardIdentifier },
            metadata: { roomNo: audit.roomNo || null, cardIdentifier: audit.cardIdentifier || null, orderFlag: audit.orderFlag },
          });
        }
      }
      prevAuditIds = new Set(currentAudits.map(getAuditKey));
    });

    return unsubscribe;
  }, [logEvent]);

  // Bidirectional automatic Supabase synchronization:
  // pushes Outbox mutations sequentially (ACK before dequeue), pulls latest remote state,
  // and merges safely without overwriting pending local edits or tombstones.
  const executeSyncOnce = useCallback(async (force = false, realtime = false): Promise<CloudRecoveryReport> => {
    const emptyReport: CloudRecoveryReport = {
      sources: [],
      recoveredGroupsCount: 0,
      recoveredBookingsCount: 0,
      recoveredTasksCount: 0,
      recoveredStockCount: 0,
      pushedCount: 0,
      pushFailedCount: 0,
      recoveredProfile: null,
      warnings: [],
    };
    const wsId = activeWorkspaceIdRef.current;
    if (!isHydratedRef.current) {
      return emptyReport;
    }

    // Skip duplicate sync work. Local changes always push; a stale snapshot
    // always pulls (so remote edits are still discovered). Only a verified
    // recent successful sync with an empty Outbox is considered redundant.
    if (!isOfflineRef.current) {
      try {
        const summary = await indexedDb.getOutboxSummary(wsId);
        if (
          !realtime &&
          shouldSkipRedundantSync({
            force,
            summary,
            lastSyncedAt: cloudSyncStatusRef.current.lastSyncedAt,
          })
        ) {
          appendSyncLog({ key: 'syncLogNothingToSync', level: 'info' });
          setCloudSyncStatus((prev) => ({
            ...prev,
            phase: 'synced',
            isSyncing: false,
            workspaceId: wsId,
            lastAttemptAt: new Date().toISOString(),
          }));
          return { ...emptyReport, sources: [] };
        }
      } catch {
        // En cas d'erreur de lecture Outbox, on tente quand même le sync.
      }
    }

    setCloudSyncStatus((prev) => ({
      ...prev,
      phase: isOfflineRef.current ? 'offline' : 'syncing',
      isSyncing: !isOfflineRef.current,
      workspaceId: wsId,
    }));

    try {
      const result = await runSupabaseSync({
        force,
        isOffline: isOfflineRef.current,
        isConfigured: isSupabaseConfigured,
        workspaceId: wsId,
        selectedEstablishmentId: selectedEstablishmentIdRef.current,
        defaultEstablishmentId: stableEstablishmentId(establishmentProfile),
        localGroups: latestGroupsRef.current,
        localBookings: latestBookingsRef.current,
        previousStatus: cloudSyncStatusRef.current,
        demoGroupIds: DEMO_GROUP_IDS,
        demoResourceIds: DEMO_RESOURCE_IDS,
        demoBookingIds: DEMO_BOOKING_IDS,
        adapter: {
          hasSession: async () => {
            if (!supabase) return false;
            const { data } = await supabase.auth.getSession();
            return Boolean(data.session);
          },
          getPendingOutbox: (targetWsId, limit, includeFutureRetries) =>
            indexedDb.getPendingOutbox(targetWsId, limit, { includeFutureRetries }),
          getOutboxSummary: (targetWsId) => indexedDb.getOutboxSummary(targetWsId),
          getTombstones: (targetWsId) => indexedDb.getTombstones(targetWsId),
          applyRemoteBookingTombstones: (targetWsId, tombstones) =>
            indexedDb.applyRemoteBookingTombstones(targetWsId, tombstones),
          markOutboxSynced: (id) => indexedDb.markOutboxSynced(id),
          markOutboxFailed: (id, error, nextAttemptAt) =>
            indexedDb.markOutboxFailed(id, error, nextAttemptAt),
          pushEstablishmentUpsert: async (targetWsId, establishment) => {
            await remoteSaveEstablishment(targetWsId, establishment);
          },
          pushResourceGroupUpsert: async (targetWsId, estId, group) => {
            await remoteSaveResourceGroupRow(targetWsId, estId, group);
          },
          pushBookingUpsert: async (targetWsId, estId, booking) => {
            await remoteSaveBooking(targetWsId, estId, booking);
          },
          pushBookingDelete: async (targetWsId, bookingId) => {
            await remoteDeleteBooking(bookingId, targetWsId);
          },
          pushResourceUpsert: async (targetWsId, estId, resource) => {
            await remoteSaveResource(targetWsId, estId, resource.groupId ?? null, resource);
          },
          pushResourceDelete: async (targetWsId, resourceId) => {
            await remoteDeleteResource(resourceId, targetWsId);
          },
          pushTaskUpsert: async (targetWsId, estId, task) => {
            await remoteSaveTask(targetWsId, estId, task);
          },
          pushStockItemUpsert: async (targetWsId, estId, item) => {
            await remoteSaveStockItem(targetWsId, estId, item);
          },
          pushStockItemDelete: async (targetWsId, itemId) => {
            await remoteDeleteStockItem(targetWsId, itemId);
          },
          pushTaskDelete: async (targetWsId, taskId) => {
            await remoteDeleteTask(targetWsId, taskId);
          },
          pushStockMovementUpsert: async (targetWsId, estId, movement) => {
            await remoteSaveStockMovement(targetWsId, estId, movement);
          },
          pushSupplierUpsert: async (targetWsId, estId, supplier) => {
            await remoteSaveStockSupplier(targetWsId, estId, supplier);
          },
          pushSupplierDelete: async (targetWsId, supplierId) => {
            await remoteDeleteStockSupplier(targetWsId, supplierId);
          },
          pushPurchaseOrderUpsert: async (targetWsId, estId, order) => {
            await remoteSavePurchaseOrder(targetWsId, estId, order);
          },
          pushPurchaseOrderDelete: async (targetWsId, orderId) => {
            await remoteDeletePurchaseOrder(targetWsId, orderId);
          },
          pushStaffMemberUpsert: async (targetWsId, estId, member) => {
            await remoteSaveStaffMember(targetWsId, estId, member);
          },
          pushStaffMemberDelete: async (targetWsId, memberId) => {
            await remoteDeleteStaffMember(targetWsId, memberId);
          },
          pushEstablishmentProfileUpsert: async (targetWsId, estId, profile) => {
            await remoteSaveEstablishmentProfile(targetWsId, estId, profile);
          },
          pullRemoteState: async (targetWsId) => {
            const [
              remoteGroups,
              remoteBookings,
              remoteBookingTombstones,
              remoteEstablishments,
              remoteRates,
            ] = await Promise.all([
              listResourceGroups(targetWsId),
              listBookings(targetWsId),
              listBookingTombstones(targetWsId),
              listEstablishments(targetWsId).catch(() => [] as HotelEstablishment[]),
              listDynamicRates(targetWsId).catch(() => ({} as Record<string, Record<string, number>>)),
            ]);
            let remoteTasks: PmsTask[] = [];
            let remoteStockItems: StockItem[] = [];
            let remoteStockMovements: StockMovement[] = [];
            let remoteSuppliers: StockSupplier[] = [];
            let remotePurchaseOrders: PurchaseOrderRecord[] = [];
            let remoteStaffMembers: StaffMemberRecord[] = [];
            const establishmentIds = remoteEstablishments.map((est) => est.id);
            if (establishmentIds.length === 0 && selectedEstablishmentId !== 'all') {
              establishmentIds.push(selectedEstablishmentId);
            }
            if (establishmentIds.length > 0) {
              const [taskLists, stockLists, movementLists, supplierLists, orderLists, staffLists] = await Promise.all([
                Promise.all(establishmentIds.map((id) => listTasks(targetWsId, id))),
                Promise.all(establishmentIds.map((id) => listStockItems(targetWsId, id))),
                Promise.all(establishmentIds.map((id) => listStockMovements(targetWsId, id))),
                Promise.all(establishmentIds.map((id) => listStockSuppliers(targetWsId, id))),
                Promise.all(establishmentIds.map((id) => listPurchaseOrders(targetWsId, id))),
                Promise.all(establishmentIds.map((id) => listStaffMembers(targetWsId, id))),
              ]);
              remoteTasks = taskLists.flat();
              remoteStockItems = stockLists.flat();
              remoteStockMovements = movementLists.flat();
              remoteSuppliers = supplierLists.flat();
              remotePurchaseOrders = orderLists.flat();
              remoteStaffMembers = staffLists.flat();
            }
            const profileEstablishmentId = selectedEstablishmentId !== 'all'
              ? selectedEstablishmentId
              : establishmentIds.length === 1 ? establishmentIds[0] : '';
            const remoteProfile = profileEstablishmentId
              ? await listEstablishmentProfile(targetWsId, profileEstablishmentId)
              : null;
            return {
              establishments: remoteEstablishments,
              groups: remoteGroups,
              bookings: remoteBookings,
              bookingTombstones: remoteBookingTombstones,
              tasks: remoteTasks,
              stockItems: remoteStockItems,
              stockMovements: remoteStockMovements,
              suppliers: remoteSuppliers,
              purchaseOrders: remotePurchaseOrders,
              staffMembers: remoteStaffMembers,
              establishmentProfile: remoteProfile,
              dynamicRates: remoteRates,
            };
          },
        },
        onEvent: appendSyncLog,
      });

      // Never apply a completed sync from a previous workspace/account.
      if (activeWorkspaceIdRef.current !== wsId) {
        return emptyReport;
      }

      setCloudSyncStatus(result.status);

      if (result.remoteEstablishments) {
        setEstablishments(result.remoteEstablishments);
        setHasLoadedRemoteSnapshot(true);
      }
      if (result.mergedGroups) {
        setResourceGroups(result.mergedGroups);
      }
      if (result.mergedBookings) {
        setBookings(result.mergedBookings);
      }

      if (result.remoteTasks.length > 0) {
        setTasks((prev) => {
          const byId = new Map(prev.map((t) => [t.id, t]));
          for (const task of result.remoteTasks) byId.set(task.id, task);
          const next = [...byId.values()];
          localStorage.setItem('omnibook_pms_tasks', JSON.stringify(next));
          return next;
        });
      }

      if (result.remoteStockItems.length > 0) {
        setStockItems((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s]));
          for (const item of result.remoteStockItems) byId.set(item.id, item);
          const next = [...byId.values()];
          stockItemsRef.current = next;
          localStorage.setItem('omnibook_stock_items', JSON.stringify(next));
          return next;
        });
      }

      if (result.remoteStockMovements.length > 0) {
        setStockMovements((prev) => {
          const byId = new Map(prev.map((movement) => [movement.id, movement]));
          for (const movement of result.remoteStockMovements) byId.set(movement.id, movement);
          const next = [...byId.values()];
          localStorage.setItem('omnibook_stock_movements', JSON.stringify(next));
          return next;
        });
      }

      if (result.remoteSuppliers.length > 0) {
        setSuppliers((prev) => {
          const byId = new Map(prev.map((supplier) => [supplier.id, supplier]));
          for (const supplier of result.remoteSuppliers) byId.set(supplier.id, supplier);
          const next = [...byId.values()];
          localStorage.setItem('omnibook_stock_suppliers', JSON.stringify(next));
          return next;
        });
      }

      if (result.remotePurchaseOrders.length > 0) {
        setPurchaseOrders((prev) => {
          const byId = new Map(prev.map((order) => [order.id, order]));
          for (const order of result.remotePurchaseOrders) byId.set(order.id, order);
          const next = [...byId.values()];
          localStorage.setItem('omnibook_purchase_orders', JSON.stringify(next));
          return next;
        });
      }

      if (result.remoteStaffMembers.length > 0) {
        setStaffMembers((prev) => {
          const byId = new Map(prev.map((member) => [member.id, member]));
          for (const member of result.remoteStaffMembers) byId.set(member.id, member);
          const next = [...byId.values()];
          localStorage.setItem('omnibook_staff_members', JSON.stringify(next));
          return next;
        });
      }

      if (Object.keys(result.remoteDynamicRates).length > 0) {
        setDynamicRates((prev) => {
          const next = { ...prev };
          for (const [roomType, dates] of Object.entries(result.remoteDynamicRates)) {
            next[roomType] = { ...(next[roomType] || {}), ...dates };
          }
          localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
          return next;
        });
      }

      if (
        result.recoveredProfile &&
        !(latestProfileRef.current.name ?? '').trim() &&
        result.recoveredProfile.name?.trim()
      ) {
        const hydratedProfile: EstablishmentProfile = {
          ...latestProfileRef.current,
          ...result.recoveredProfile,
          id: latestProfileRef.current.id === 'establishment-draft'
            ? (result.remoteEstablishments?.[0]?.id ?? 'establishment-cloud')
            : latestProfileRef.current.id,
          updatedAt: new Date().toISOString(),
        };
        setEstablishmentProfile(hydratedProfile);
      }

      return {
        sources: result.skippedReason ? [] : ['supabase'],
        recoveredGroupsCount: result.recoveredGroupsCount,
        recoveredBookingsCount: result.recoveredBookingsCount,
        recoveredTasksCount: result.recoveredTasksCount,
        recoveredStockCount: result.recoveredStockCount,
        pushedCount: result.pushedCount,
        pushFailedCount: result.pushFailedCount,
        recoveredProfile: result.recoveredProfile,
        warnings: result.warnings,
        skippedOffline: result.skippedReason === 'offline',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur synchronisation Supabase';
      appendSyncLog({ key: 'syncLogError', level: 'error', detail: msg });
      console.warn('[AppContext] Supabase sync failed:', error);
      setCloudSyncStatus((prev) => ({
        ...prev,
        phase: 'error',
        isSyncing: false,
        lastAttemptAt: new Date().toISOString(),
        lastError: msg,
        workspaceId: wsId,
      }));
      return {
        ...emptyReport,
        warnings: [msg],
      };
    }
  }, [appendSyncLog]);

  const syncWithSupabase = useCallback(async (options?: { force?: boolean; realtime?: boolean }): Promise<CloudRecoveryReport> => {
    const force = options?.force === true;
    const realtime = options?.realtime === true;
    if (syncInFlightRef.current) {
      pendingResyncRef.current = true;
      if (force) pendingForceRef.current = true;
      if (realtime) pendingRealtimeRef.current = true;
      return syncInFlightRef.current;
    }

    const runner = (async () => {
      let report = await executeSyncOnce(force, realtime);
      while (pendingResyncRef.current) {
        const nextForce = pendingForceRef.current;
        const nextRealtime = pendingRealtimeRef.current;
        pendingResyncRef.current = false;
        pendingForceRef.current = false;
        pendingRealtimeRef.current = false;
        report = await executeSyncOnce(nextForce, nextRealtime);
      }
      return report;
    })();

    syncInFlightRef.current = runner;
    try {
      return await runner;
    } finally {
      syncInFlightRef.current = null;
    }
  }, [executeSyncOnce]);

  triggerSyncFnRef.current = syncWithSupabase;

  const forceSupabaseSync = useCallback(async (): Promise<CloudRecoveryReport> => {
    clearSyncLog();
    setSyncTerminalOpen(true);
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (!isOfflineRef.current && isSupabaseConfigured && supabase) {
      await workspace.refreshWorkspaces().catch(() => undefined);
    }
    return syncWithSupabase({ force: true });
  }, [syncWithSupabase, workspace.refreshWorkspaces, clearSyncLog]);

  // Backfill existing local inventory into the automatic personal workspace once
  // hydrated, the personal workspace is selected, and a real remote snapshot has
  // been loaded. Waiting for that snapshot prevents creating a second establishment
  // when the workspace already owns one. Runs after syncWithSupabase is declared
  // (dependency array evaluation would otherwise hit the TDZ).
  // Idempotent: re-runs never duplicate Outbox records thanks to stable
  // `backfill:` idempotency keys.
  useEffect(() => {
    if (
      !isCoreDataHydrated ||
      !workspace.activeWorkspaceId ||
      backfillRunRef.current
    ) {
      return;
    }
    const profile = { ...DEFAULT_ESTABLISHMENT_PROFILE, ...establishmentProfile };
    // A blank profile is a draft, not a real business entity. Let the planner
    // abort backfill instead of inventing an "Établissement" row in Supabase.
    const profileName = (profile.name ?? '').trim();

    (async () => {
      try {
        // Résoudre les établissements distants existants pour éviter d'en créer un
        // second. On tente une lecture légère même sans snapshot complet préalable.
        let remoteEstablishments: HotelEstablishment[] = establishments;
        if (!hasLoadedRemoteSnapshot && !isOfflineRef.current) {
          try {
            remoteEstablishments =
              (await listEstablishments(workspace.activeWorkspaceId).catch(() => [])) ??
              [];
          } catch {
            remoteEstablishments = [];
          }
        }

        const plan = planBackfill({
          profile: { ...profile, name: profileName },
          workspaceId: workspace.activeWorkspaceId,
          groups: latestGroupsRef.current,
          bookings: latestBookingsRef.current,
          remoteEstablishments,
          selectedEstablishmentId,
        });

        if (!plan.ok || !plan.establishmentId) {
          plan.warnings.forEach((warning) => console.warn('[Backfill]', warning));
          appendSyncLog({
            key: 'syncLogBackfillSkipped',
            level: 'warn',
            detail: plan.warnings.join(' ; '),
          });
          return;
        }

        backfillRunRef.current = true;
        const establishmentId = plan.establishmentId;

        // Persist the real establishment id (derived once, or the existing remote id)
        // so a later rename updates the same remote establishment instead of
        // deriving a new id and creating a duplicate.
        if (profile.id !== establishmentId) {
          setEstablishmentProfile({ ...profile, id: establishmentId });
        }

        // 1. Establishment (root, pushed first by Outbox priority).
        for (const operation of plan.operations) {
          if (operation.kind === 'establishment') {
            await indexedDb.enqueueOutboxOnly(
              {
                workspaceId: workspace.activeWorkspaceId,
                establishmentId,
              },
              'establishment',
              establishmentId,
              'upsert',
              1,
              operation.payload as unknown as Record<string, unknown>,
              operation.idempotencyKey,
            );
          } else if (operation.kind === 'resourceGroup') {
            // 2. Building row before its resources (`resources.group_id` FK).
            await indexedDb.enqueueOutboxOnly(
              {
                workspaceId: workspace.activeWorkspaceId,
                establishmentId: operation.establishmentId,
              },
              'resource_group',
              operation.entityId,
              'upsert',
              1,
              operation.payload as unknown as Record<string, unknown>,
              operation.idempotencyKey,
            );
          } else if (operation.kind === 'resource') {
            // 3. Resource after its group.
            await indexedDb.putWithOutboxByKey(
              'resources',
              operation.payload,
              {
                workspaceId: workspace.activeWorkspaceId,
                establishmentId: operation.establishmentId,
              },
              'resource',
              operation.idempotencyKey,
              1,
            );
          } else if (operation.kind === 'booking') {
            // 4. Booking after its resource.
            await indexedDb.putWithOutboxByKey(
              'bookings',
              operation.payload,
              {
                workspaceId: workspace.activeWorkspaceId,
                establishmentId: operation.establishmentId,
              },
              'booking',
              operation.idempotencyKey,
              1,
            );
          }
        }

        plan.warnings.forEach((warning) => console.warn('[Backfill]', warning));
        appendSyncLog({
          key: 'syncLogBackfillDone',
          level: 'info',
          detail: `${plan.operations.length} opération(s) de backfill en file d’attente`,
        });

        // Push immediately so the backfill reaches Supabase without waiting for the next tick.
        if (plan.operations.length > 0) {
          void syncWithSupabase({ force: false });
        }
      } catch (error) {
        // Allow a later data/profile change to retry a failed local backfill.
        backfillRunRef.current = false;
        const message = error instanceof Error ? error.message : 'Échec du backfill';
        setCloudSyncStatus((previous) => ({
          ...previous,
          phase: 'error',
          isSyncing: false,
          lastAttemptAt: new Date().toISOString(),
          lastError: `Backfill local : ${message}`,
          workspaceId: workspace.activeWorkspaceId,
        }));
        appendSyncLog({ key: 'syncLogBackfillFailed', level: 'error', detail: message });
        console.warn('[Backfill]', message);
      }
    })();
  }, [
    isCoreDataHydrated,
    workspace.activeWorkspaceId,
    hasLoadedRemoteSnapshot,
    establishments,
    selectedEstablishmentId,
    establishmentProfile,
    appendSyncLog,
    syncWithSupabase,
  ]);

  // Automatic initial & reconnect sync
  useEffect(() => {
    if (!isCoreDataHydrated) return;
    void syncWithSupabase({ force: false });
  }, [isCoreDataHydrated, workspace.activeWorkspaceId, isOffline, syncWithSupabase]);

  useEffect(() => onSupabaseConfigChange(() => setSupabaseConfigVersion((value) => value + 1)), []);

  // Supabase Realtime is the primary remote-change signal. The five-minute
  // watchdog only recovers from dropped notifications or temporary outages.
  useEffect(() => {
    const wsId = activeWorkspaceIdRef.current;
    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRealtimeSync = () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        realtimeTimer = null;
        if (isOfflineRef.current || !activeWorkspaceIdRef.current) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        void syncWithSupabase({ realtime: true });
      }, 180);
    };
    const handleForcedEvent = () => { void forceSupabaseSync(); };
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (isOfflineRef.current || !activeWorkspaceIdRef.current) return;
      void syncWithSupabase({ force: false });
    };
    const watchdogId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (isOfflineRef.current || !activeWorkspaceIdRef.current) return;
      void syncWithSupabase({ force: false });
    }, 5 * 60_000);
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (isCoreDataHydrated && wsId && !isOfflineRef.current && supabase) {
      channel = subscribeWorkspaceRealtime(supabase, wsId, scheduleRealtimeSync, (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Appointment] Supabase Realtime unavailable:', status);
        }
      });
    }
    window.addEventListener('appointment-refresh', handleForcedEvent);
    window.addEventListener('appointment-cloud-config-updated', handleForcedEvent);
    window.addEventListener('focus', handleVisibilityOrFocus);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      clearInterval(watchdogId);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      if (channel && supabase) void supabase.removeChannel(channel);
      window.removeEventListener('appointment-refresh', handleForcedEvent);
      window.removeEventListener('appointment-cloud-config-updated', handleForcedEvent);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    };
  }, [forceSupabaseSync, syncWithSupabase, isCoreDataHydrated, workspace.activeWorkspaceId, isOffline, supabaseConfigVersion]);
  // Housekeeping status updater
  const updateHousekeepingStatus = (
    resourceId: string,
    status: 'clean' | 'cleaning' | 'dirty' | 'out_of_order'
  ) => {
    let updatedResource: ResourceItem | undefined;
    let previousStatus: string | undefined;
    let groupLabel: string | undefined;
    for (const grp of latestGroupsRef.current) {
      const match = grp.resources.find((r) => r.id === resourceId);
      if (match) {
        previousStatus = match.housekeepingStatus || 'clean';
        groupLabel = grp.name?.[language] || grp.name?.fr || grp.name?.en;
        updatedResource = { ...match, groupId: match.groupId ?? grp.id, housekeepingStatus: status };
        break;
      }
    }
    setResourceGroups((prev) =>
      prev.map((grp) => ({
        ...grp,
        resources: grp.resources.map((r) =>
          r.id === resourceId ? { ...r, housekeepingStatus: status } : r
        ),
      }))
    );
    if (updatedResource) {
      logEvent({
        category: 'housekeeping',
        action: 'housekeeping.status_changed',
        severity: status === 'out_of_order' ? 'warn' : status === 'clean' ? 'success' : 'info',
        title: `Statut ménage · ${updatedResource.name} → ${status}`,
        description: `${updatedResource.name}${groupLabel ? ` (${groupLabel})` : ''} : ${previousStatus || '—'} → ${status}`,
        target: { type: 'resource', id: resourceId, label: updatedResource.name, secondaryLabel: groupLabel },
        changes: [{ field: 'Statut ménage', before: previousStatus || '—', after: status }],
        resourceId,
      });
    }
    if (updatedResource && workspace.activeWorkspaceId && !DEMO_RESOURCE_IDS.has(resourceId)) {
      const resolvedEstId =
        updatedResource.establishmentId ??
        (selectedEstablishmentId === 'all' ? undefined : selectedEstablishmentId);
      void indexedDb
        .putWithOutbox(
          'resources',
          updatedResource,
          { workspaceId: workspace.activeWorkspaceId, establishmentId: resolvedEstId },
          'resource'
        )
        .then(() => scheduleAutoSync())
        .catch((error) => console.error('[Outbox] Resource status update was not queued:', error));
    }
  };

  // Conflict detection according to international hospitality/clinic standards
  const checkConflict = (
    resourceId: string,
    startDate: string,
    endDate: string,
    excludeBookingId?: string,
    checkInTime = '14:00',
    checkOutTime = '12:00'
  ): boolean => {
    const toMinutes = (date: string | undefined, time: string | undefined) => {
      if (typeof date !== 'string' || typeof time !== 'string') return Number.NaN;
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute).getTime();
    };
    const requestedStart = toMinutes(startDate, checkInTime);
    const requestedEnd = toMinutes(endDate, checkOutTime);
    if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd) || requestedEnd <= requestedStart) return true;
    const turnoverMs = 10 * 60 * 1000;
    return bookings.some((b) => {
      if (b.resourceId !== resourceId || b.id === excludeBookingId || b.status === 'cancelled') return false;
      const existingStart = toMinutes(b.startDate, b.checkInTime || '14:00');
      const existingEnd = toMinutes(b.endDate, b.checkOutTime || '12:00') + (b.sector === 'hotel' ? turnoverMs : 0);
      // Imported/legacy records without usable dates occupy no slot: skip them
      // instead of throwing inside the submit handler, which silently blocked
      // every new booking made on the same room.
      if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;
      return requestedStart < existingEnd && requestedEnd > existingStart;
    });
  };

  // Network offline listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const shiftDays = (days: number) => {
    const [y, m, d] = currentBaseDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    const newD = String(date.getDate()).padStart(2, '0');
    setCurrentBaseDate(`${newY}-${newM}-${newD}`);
  };

  const addBooking = (
    bookingData: Omit<TimelineBooking, 'id'>
  ): { success: boolean; error?: string; code?: 'room_not_ready'; roomName?: string; roomStatus?: 'clean' | 'cleaning' | 'dirty' | 'out_of_order'; booking?: TimelineBooking } => {
    // Validate both calendar dates for every reservation sector before changing state.
    if (!isValidCalendarDate(bookingData.startDate) || !isValidCalendarDate(bookingData.endDate)) {
      const msg =
        language === 'fr'
          ? 'Dates de réservation invalides.'
          : language === 'ar'
          ? 'تواريخ الحجز غير صالحة.'
          : 'Invalid booking dates.';
      logEvent({
        category: 'booking',
        action: 'booking.rejected',
        severity: 'warn',
        title: `Réservation refusée · ${bookingData.guestName}`,
        description: `${msg} (${bookingData.resourceName})`,
        target: { type: 'booking', label: bookingData.guestName, secondaryLabel: bookingData.resourceName },
        metadata: { reason: 'invalid_dates', startDate: bookingData.startDate, endDate: bookingData.endDate },
        resourceId: bookingData.resourceId,
      });
      return { success: false, error: msg };
    }

    // A hotel room must be explicitly marked clean (green) before a new stay is accepted.
    // This is enforced here as the domain boundary, not only in the modal UI.
    if (bookingData.sector === 'hotel') {
      const room = resourceGroups.flatMap((group) => group.resources).find((item) => item.id === bookingData.resourceId);
      if (!room || !isRoomReadyForBooking(room.housekeepingStatus)) {
        const statusMessage = language === 'fr'
          ? 'Réservation refusée : la chambre doit être propre et disponible (statut vert) avant toute réservation.'
          : language === 'ar'
            ? 'تم رفض الحجز: يجب أن تكون الغرفة نظيفة ومتاحة (الحالة الخضراء) قبل الحجز.'
            : 'Booking rejected: the room must be clean and available (green status) before it can be booked.';
        logEvent({
          category: 'booking',
          action: 'booking.rejected',
          severity: 'warn',
          title: `Réservation bloquée · ${room?.name ?? bookingData.resourceName}`,
          description: `${bookingData.guestName} · Chambre non prête (${room?.housekeepingStatus || 'inconnue'})`,
          target: { type: 'booking', label: bookingData.guestName, secondaryLabel: room?.name ?? bookingData.resourceName },
          metadata: { reason: 'room_not_ready', roomStatus: room?.housekeepingStatus ?? null },
          resourceId: bookingData.resourceId,
        });
        return { success: false, code: 'room_not_ready', roomName: room?.name ?? bookingData.resourceName, roomStatus: room?.housekeepingStatus, error: statusMessage };
      }
    }

    // 1. Strict date sanity checks before modifying state
    if (bookingData.sector === 'hotel' || bookingData.sector === 'resort') {
      const s = new Date(`${bookingData.startDate}T${bookingData.checkInTime || '14:00'}:00`);
      const e = new Date(`${bookingData.endDate}T${bookingData.checkOutTime || '12:00'}:00`);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        const msg =
          language === 'fr'
            ? 'Dates de séjour invalides.'
            : language === 'ar'
            ? 'تواريخ الإقامة غير صالحة.'
            : 'Invalid stay dates.';
        logEvent({
          category: 'booking',
          action: 'booking.rejected',
          severity: 'warn',
          title: `Réservation refusée · ${bookingData.guestName}`,
          description: msg,
          target: { type: 'booking', label: bookingData.guestName, secondaryLabel: bookingData.resourceName },
          metadata: { reason: 'invalid_stay_dates' },
          resourceId: bookingData.resourceId,
        });
        return { success: false, error: msg };
      }
      if (e <= s) {
        const msg =
          language === 'fr'
            ? "Règle hôtel : la date de départ doit être postérieure à la date d'arrivée."
            : language === 'ar'
            ? 'قاعدة الفندق: يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول.'
            : 'Hotel rule: Check-out date must be after check-in date.';
        logEvent({
          category: 'booking',
          action: 'booking.rejected',
          severity: 'warn',
          title: `Réservation refusée · ${bookingData.guestName}`,
          description: msg,
          target: { type: 'booking', label: bookingData.guestName, secondaryLabel: bookingData.resourceName },
          metadata: { reason: 'checkout_before_checkin', startDate: bookingData.startDate, endDate: bookingData.endDate },
          resourceId: bookingData.resourceId,
        });
        return { success: false, error: msg };
      }
      if (e.getTime() - s.getTime() > 365 * 24 * 3600 * 1000) {
        const msg =
          language === 'fr'
            ? 'Règle hôtel : séjour supérieur à 365 jours non autorisé.'
            : language === 'ar'
            ? 'قاعدة الفندق: لا يُسمح بإقامة تتجاوز 365 يوماً.'
            : 'Hotel rule: Stay cannot exceed 365 days.';
        logEvent({
          category: 'booking',
          action: 'booking.rejected',
          severity: 'warn',
          title: `Réservation refusée · ${bookingData.guestName}`,
          description: msg,
          target: { type: 'booking', label: bookingData.guestName, secondaryLabel: bookingData.resourceName },
          metadata: { reason: 'exceeds_365_days' },
          resourceId: bookingData.resourceId,
        });
        return { success: false, error: msg };
      }
    }

    // 2. Business rule check: double booking prevention
    const hasConflict = checkConflict(
      bookingData.resourceId,
      bookingData.startDate,
      bookingData.endDate,
      undefined,
      bookingData.checkInTime || '14:00',
      bookingData.checkOutTime || '12:00'
    );

    if (hasConflict) {
      const msg =
        language === 'fr'
          ? 'Conflit détecté : Cette ressource est déjà réservée sur cette plage de dates.'
          : language === 'ar'
          ? 'تعارض في الحجز: هذه الغرفة أو العيادة محجوزة بالفعل في نفس الفترة.'
          : 'Scheduling conflict: This resource is already booked for these dates.';
      logEvent({
        category: 'booking',
        action: 'booking.rejected',
        severity: 'warn',
        title: `Conflit de réservation · ${bookingData.resourceName}`,
        description: `${bookingData.guestName} (${bookingData.startDate} → ${bookingData.endDate}) refusé pour chevauchement.`,
        target: { type: 'booking', label: bookingData.guestName, secondaryLabel: bookingData.resourceName },
        metadata: { reason: 'scheduling_conflict', startDate: bookingData.startDate, endDate: bookingData.endDate },
        resourceId: bookingData.resourceId,
      });
      return { success: false, error: msg };
    }

    const normalizedInput = normalizeBookingForPersistence(bookingData);
    const occupantValidation = validateBookingOccupants(normalizedInput, language);
    if (!occupantValidation.valid) {
      const msg =
        occupantValidation.summaryError ||
        (language === 'fr'
          ? 'Veuillez renseigner les coordonnées et pièces d’identité de tous les occupants.'
          : language === 'ar'
          ? 'يرجى إدخال بيانات ووسائل تواصل جميع النزلاء.'
          : 'Please complete details and contact info for all occupants.');
      logEvent({
        category: 'booking',
        action: 'booking.rejected',
        severity: 'warn',
        title: `Réservation incomplète · ${normalizedInput.guestName || normalizedInput.resourceName}`,
        description: msg,
        target: { type: 'booking', label: normalizedInput.guestName || normalizedInput.resourceName, secondaryLabel: normalizedInput.resourceName },
        metadata: {
          reason: 'incomplete_occupants',
          totalPeople: occupantValidation.totalPeople,
          errorsCount: occupantValidation.errors.length,
        },
        resourceId: normalizedInput.resourceId,
      });
      return { success: false, error: msg };
    }

    // 3. Only now instantiate and commit the valid normalized booking
    const newBkg: TimelineBooking = normalizeBookingForPersistence({
      ...normalizedInput,
      id: `bkg_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
    });
    setBookings((prev) => [newBkg, ...prev]);
    persistBookingMutation(newBkg);

    logEvent({
      category: 'booking',
      action: 'booking.created',
      severity: 'success',
      title: `Nouvelle réservation · ${newBkg.guestName}`,
      description: `${newBkg.resourceName} · ${newBkg.startDate} → ${newBkg.endDate} · ${newBkg.totalPrice} ${newBkg.paymentCurrency || currency}`,
      target: {
        type: 'booking',
        id: newBkg.id,
        label: newBkg.guestName,
        secondaryLabel: newBkg.resourceName,
      },
      metadata: {
        startDate: newBkg.startDate,
        endDate: newBkg.endDate,
        totalPrice: newBkg.totalPrice,
        currency: newBkg.paymentCurrency || currency,
        status: newBkg.status,
        paymentStatus: newBkg.paymentStatus,
        paymentMethodType: newBkg.paymentMethodType || null,
        sector: newBkg.sector,
      },
      bookingId: newBkg.id,
      resourceId: newBkg.resourceId,
    });

    // Auto-issue proUSB guest card for hotel/resort bookings
    if (bookingData.sector === 'hotel' || bookingData.sector === 'resort') {
      const bookedResource = resourceGroups.flatMap((group) => group.resources).find((resource) => resource.id === bookingData.resourceId);
      try {
        lockManager
          .issueGuestCardFromBooking(
            {
              id: newBkg.id,
              guestName: bookingData.guestName,
              resourceName: bookingData.resourceName,
              buildingNo: bookedResource?.building !== undefined ? Number.parseInt(bookedResource.building, 10) : undefined,
              floorNo: bookedResource?.floor !== undefined ? Number.parseInt(bookedResource.floor, 10) : undefined,
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
            },
            resolveRoleDefinition(rolesRef.current, currentRoleRef.current).category === 'management'
              ? 'Admin'
              : resolveActorLabel(currentRoleRef.current)
          )
          .then((card: any) => {
            console.log('[AppContext] Auto-issued proUSB guest card for booking', newBkg.id, card?.rawHex);
          })
          .catch((err: any) => {
            console.warn('[AppContext] Failed to auto-issue proUSB card:', err);
          });
      } catch (e) {
        console.warn('[AppContext] proUSB card auto-issue error:', e);
      }
    }

    return { success: true, booking: newBkg };
  };

  const updateBooking = (
    id: string,
    updates: Partial<TimelineBooking>
  ): { success: boolean; error?: string } => {
    const existing = bookings.find((booking) => booking.id === id);
    if (!existing) {
      return { success: false, error: 'Booking not found.' };
    }

    const merged = normalizeBookingForPersistence({ ...existing, ...updates });
    const touchesOccupancyOrIdentity =
      'adults' in updates ||
      'children' in updates ||
      'adultGuests' in updates ||
      'occupantsList' in updates ||
      'guestName' in updates ||
      Boolean(
        updates.customMetadata &&
          ('hotelAdults' in updates.customMetadata ||
            'hotelChildren' in updates.customMetadata ||
            'resortOccupants' in updates.customMetadata)
      );

    if (touchesOccupancyOrIdentity) {
      const validation = validateBookingOccupants(merged, language);
      if (!validation.valid) {
        const msg =
          validation.summaryError ||
          (language === 'fr'
            ? 'Veuillez renseigner les coordonnées et pièces d’identité de tous les occupants.'
            : language === 'ar'
            ? 'يرجى إدخال بيانات ووسائل تواصل جميع النزلاء.'
            : 'Please complete details and contact info for all occupants.');
        logEvent({
          category: 'booking',
          action: 'booking.rejected',
          severity: 'warn',
          title: `Mise à jour refusée · ${merged.guestName || existing.guestName}`,
          description: msg,
          target: { type: 'booking', id, label: merged.guestName || existing.guestName, secondaryLabel: merged.resourceName },
          metadata: { reason: 'incomplete_occupants', totalPeople: validation.totalPeople },
          bookingId: id,
          resourceId: merged.resourceId,
        });
        return { success: false, error: msg };
      }
    }

    persistBookingMutation(merged);
    const changes = computeBookingDiff(existing, merged);
    if (changes.length > 0) {
      logEvent({
        category: 'booking',
        action: 'booking.updated',
        severity: 'info',
        title: `Réservation modifiée · ${merged.guestName}`,
        description: `${merged.resourceName} · ${changes.map((c) => `${c.field}: ${c.before} → ${c.after}`).join(' · ')}`,
        target: {
          type: 'booking',
          id,
          label: merged.guestName,
          secondaryLabel: merged.resourceName,
        },
        changes,
        bookingId: id,
        resourceId: merged.resourceId,
      });
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === id ? merged : b))
    );
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking((prev) => (prev && prev.id === id ? merged : prev));
    }
    return { success: true };
  };

  const updateBookingStatus = (id: string, status: BookingStatus) => {
    const existing = bookings.find((booking) => booking.id === id);
    if (existing) {
      persistBookingMutation({ ...existing, status });
      logEvent({
        category: 'booking',
        action: 'booking.status_changed',
        severity: status === 'cancelled' || status === 'out_of_order' ? 'warn' : status === 'checked_in' || status === 'checked_out' ? 'success' : 'info',
        title: `Statut séjour · ${existing.guestName} → ${status}`,
        description: `${existing.resourceName} · ${existing.status} → ${status}`,
        target: {
          type: 'booking',
          id,
          label: existing.guestName,
          secondaryLabel: existing.resourceName,
        },
        changes: [{ field: 'Statut séjour', before: existing.status, after: status }],
        bookingId: id,
        resourceId: existing.resourceId,
      });
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b))
    );
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const deleteBooking = async (id: string): Promise<void> => {
    const existing = bookings.find((booking) => booking.id === id);
    if (!existing) return;

    const isDemo = isDemoBookingId(id, DEMO_BOOKING_IDS);
    if (!isDemo) {
      const workspaceId = workspace.activeWorkspaceId?.trim();
      if (!workspaceId) {
        throw new Error('Aucun workspace actif : la suppression ne peut pas être mise en file de synchronisation.');
      }

      const bookedResource = latestGroupsRef.current
        .flatMap((group) => group.resources)
        .find((resource) => resource.id === existing.resourceId);
      const resolvedEstablishmentId =
        selectedEstablishmentId !== 'all'
          ? selectedEstablishmentId
          : bookedResource?.establishmentId || undefined;

      // Do not update React state before the local row, tombstone, Outbox and
      // P2P event have committed together. A failed IDB transaction leaves the
      // booking visible and lets the caller display the actual failure.
      await indexedDb.deleteWithOutbox(
        'bookings',
        id,
        { workspaceId, establishmentId: resolvedEstablishmentId },
        'booking',
      );
      scheduleAutoSync();
    }

    logEvent({
      category: 'booking',
      action: 'booking.deleted',
      severity: 'warn',
      title: `Réservation supprimée · ${existing.guestName}`,
      description: `${existing.resourceName} (${existing.startDate} → ${existing.endDate}) · ${existing.totalPrice} ${existing.paymentCurrency || currency}`,
      target: {
        type: 'booking',
        id,
        label: existing.guestName,
        secondaryLabel: existing.resourceName,
      },
      metadata: {
        startDate: existing.startDate,
        endDate: existing.endDate,
        totalPrice: existing.totalPrice,
        status: existing.status,
      },
      bookingId: id,
      resourceId: existing.resourceId,
    });

    setBookings((prev) => prev.filter((booking) => booking.id !== id));
    if (selectedBooking?.id === id) setSelectedBooking(null);
  };

  const markBookingAsPaid = (
    bookingId: string,
    receiptNote?: string
  ): { success: boolean; message: string; booking?: TimelineBooking } => {
    const currentBooking = bookings.find((booking) => booking.id === bookingId);
    const targetBooking = currentBooking ? {
      ...currentBooking,
      paymentStatus: 'paid' as const,
      notes: (currentBooking.notes || '') + (receiptNote ||
        ' [✓ Reçu de paiement acquitté via QR Code - Marqué PAYÉ par le personnel]'),
    } : undefined;
    if (targetBooking && currentBooking) {
      persistBookingMutation(targetBooking);
      logEvent({
        category: 'billing',
        action: 'booking.payment_settled',
        severity: 'success',
        title: `Paiement encaissé · ${currentBooking.guestName}`,
        description: `${currentBooking.resourceName} · ${currentBooking.totalPrice} ${currentBooking.paymentCurrency || currency} marqué PAYÉ`,
        target: {
          type: 'booking',
          id: bookingId,
          label: currentBooking.guestName,
          secondaryLabel: currentBooking.resourceName,
        },
        changes: [{ field: 'Statut paiement', before: currentBooking.paymentStatus, after: 'paid' }],
        metadata: {
          totalPrice: currentBooking.totalPrice,
          currency: currentBooking.paymentCurrency || currency,
        },
        bookingId,
        resourceId: currentBooking.resourceId,
      });
    }
    setBookings((prev) =>
      prev.map((booking) => booking.id === bookingId && targetBooking ? targetBooking : booking)
    );

    if (selectedBooking && selectedBooking.id === bookingId) {
      setSelectedBooking(targetBooking ?? null);
    }

    return {
      success: true,
      message:
        language === 'fr'
          ? 'Reçu scanné avec succès : Dossier marqué comme PAYÉ !'
          : language === 'ar'
          ? 'تم مسح الإيصال بنجاح: تم تسجيل الحجز كمدفوع بالكامل!'
          : 'Receipt scanned successfully: Booking marked as PAID!',
      booking: targetBooking,
    };
  };

  const confirmCheckInAndCashPayment = (
    bookingId: string,
    cashReceived: boolean = false
  ): { success: boolean; message: string; booking?: TimelineBooking } => {
    const currentBooking = bookings.find((booking) => booking.id === bookingId);
    if (!currentBooking) {
      return {
        success: false,
        message:
          language === 'fr'
            ? 'Réservation introuvable.'
            : language === 'ar'
            ? 'الحجز غير موجود.'
            : 'Booking not found.',
      };
    }

    // Only an explicit cashReceived=true can settle a pending cash payment.
    // A previously paid booking remains paid; a pending booking remains pending otherwise.
    const paymentSettled =
      shouldMarkPaymentAsPaid(currentBooking.paymentStatus, cashReceived);
    const updatedBooking: TimelineBooking = {
      ...currentBooking,
      status: 'checked_in',
      paymentStatus: paymentSettled ? 'paid' : currentBooking.paymentStatus,
      notes:
        (currentBooking.notes || '') +
        (cashReceived === true && currentBooking.paymentStatus !== 'paid'
          ? ' [✓ Présence confirmée via QR Code & Paiement Cash finalisé]'
          : ' [✓ Présence confirmée via QR Code]'),
    };

    persistBookingMutation(updatedBooking);
    const changes: Array<{ field: string; before?: string; after?: string }> = [];
    if (currentBooking.status !== 'checked_in') {
      changes.push({ field: 'Statut séjour', before: currentBooking.status, after: 'checked_in' });
    }
    if (paymentSettled && currentBooking.paymentStatus !== 'paid') {
      changes.push({ field: 'Statut paiement', before: currentBooking.paymentStatus, after: 'paid' });
    }
    logEvent({
      category: 'booking',
      action: 'booking.qr_checkin',
      severity: 'success',
      title: `Check-in QR · ${currentBooking.guestName}`,
      description: `${currentBooking.resourceName} · ${paymentSettled ? 'Présence confirmée & paiement réglé' : 'Présence confirmée (paiement en attente)'}`,
      target: {
        type: 'booking',
        id: bookingId,
        label: currentBooking.guestName,
        secondaryLabel: currentBooking.resourceName,
      },
      changes: changes.length > 0 ? changes : undefined,
      metadata: {
        cashReceived,
        paymentSettled,
      },
      bookingId,
      resourceId: currentBooking.resourceId,
    });
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId ? updatedBooking : booking
      )
    );
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking(updatedBooking);
    }
    if (activeQrPassBooking?.id === bookingId) {
      setActiveQrPassBooking(updatedBooking);
    }

    const message = paymentSettled
      ? language === 'fr'
        ? 'Présence confirmée par QR Code et règlement finalisé avec succès !'
        : language === 'ar'
        ? 'تم تأكيد الحضور برمز QR وتسوية الدفع بنجاح!'
        : 'Check-in confirmed with QR Code and payment settled successfully!'
      : language === 'fr'
      ? 'Présence confirmée par QR Code (règlement toujours en attente).'
      : language === 'ar'
      ? 'تم تأكيد الحضور برمز QR (الدفع لا يزال قيد الانتظار).'
      : 'Check-in confirmed with QR Code (payment remains pending).';

    return {
      success: true,
      message,
      booking: updatedBooking,
    };
  };

  const addTask = (taskData: Omit<PmsTask, 'id'>) => {
    const newTask: PmsTask = {
      ...taskData,
      id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    playSuccessFeedback();
    setTasks((prev) => {
      const updated = [newTask, ...prev];
      localStorage.setItem('omnibook_pms_tasks', JSON.stringify(updated));
      return updated;
    });
    logEvent({
      category: 'task',
      action: 'task.created',
      severity: newTask.priority === 'urgent' ? 'warn' : 'info',
      title: `Tâche créée · ${newTask.typeName}`,
      description: `Chambre ${newTask.room} · Assignée à ${newTask.assignee} · Priorité ${newTask.priority}`,
      target: { type: 'task', id: newTask.id, label: newTask.typeName, secondaryLabel: newTask.room },
      metadata: { assignee: newTask.assignee, priority: newTask.priority, category: newTask.category, date: newTask.date },
    });
  };

  const updateTaskStatus = (id: string, status: PmsTask['status'], completedByOverride?: string) => {
    if (status === 'done') {
      playSuccessFeedback();
    } else {
      playClickFeedback();
    }

    const targetTask = tasks.find((t) => t.id === id);
    const resolvedExecutor =
      completedByOverride?.trim() ||
      activeOperatorNameRef.current.trim() ||
      clientProfileRef.current?.name?.trim() ||
      targetTask?.assignee?.trim() ||
      resolveActorLabel(currentRoleRef.current);

    if (targetTask) {
      logEvent({
        category: 'task',
        action: 'task.status_changed',
        severity: status === 'done' ? 'success' : status === 'cancel' ? 'warn' : 'info',
        title: `Tâche ${targetTask.room} · ${targetTask.typeName} → ${status}`,
        description:
          status === 'done'
            ? `Achevée par ${resolvedExecutor} (assignée à ${targetTask.assignee})`
            : `Statut tâche : ${targetTask.status} → ${status} (${targetTask.assignee})`,
        target: { type: 'task', id, label: targetTask.typeName, secondaryLabel: targetTask.room },
        metadata: status === 'done' ? { completedBy: resolvedExecutor, assignee: targetTask.assignee } : undefined,
        changes: [{ field: 'Statut tâche', before: targetTask.status, after: status }],
      });
    }

    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const taskExecutor =
            completedByOverride?.trim() ||
            activeOperatorNameRef.current.trim() ||
            clientProfileRef.current?.name?.trim() ||
            t.assignee?.trim() ||
            resolveActorLabel(currentRoleRef.current);
          if (status === 'done' && t.status !== 'done' && t.consumedItems?.length) {
            t.consumedItems.forEach((c) => {
              addStockMovement(c.itemId, -c.quantity, `Consommation tâche: ${t.typeName}`, t.room);
            });
          }
          if (status === 'done' && (t.typeId === 'clean' || t.typeId === 'depclean')) {
            const foundRes = resourceGroups.flatMap((g) => g.resources).find((r) => r.name.includes(t.room) || r.id === t.room);
            if (foundRes) {
              updateHousekeepingStatus(foundRes.id, 'clean');
            }
          }
          return {
            ...t,
            status,
            completedAt: status === 'done' ? nowStr : undefined,
            completedBy: status === 'done' ? taskExecutor : undefined,
          };
        }
        return t;
      });
      localStorage.setItem('omnibook_pms_tasks', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    playClickFeedback();
    const targetTask = tasks.find((t) => t.id === taskId);
    const targetSub = targetTask?.subtasks?.find((st) => st.id === subtaskId);
    if (targetTask && targetSub) {
      logEvent({
        category: 'task',
        action: 'task.subtask_toggled',
        severity: 'info',
        title: `Sous-tâche ${!targetSub.completed ? 'cochée' : 'décochée'} · ${targetTask.room}`,
        description: `${targetSub.text} (${targetTask.typeName})`,
        target: { type: 'task', id: taskId, label: targetTask.typeName, secondaryLabel: targetTask.room },
        changes: [{ field: targetSub.text, before: targetSub.completed ? 'Fait' : 'À faire', after: !targetSub.completed ? 'Fait' : 'À faire' }],
      });
    }
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId && t.subtasks) {
          return {
            ...t,
            subtasks: t.subtasks.map((st) => (st.id === subtaskId ? { ...st, completed: !st.completed } : st)),
          };
        }
        return t;
      });
      localStorage.setItem('omnibook_pms_tasks', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteTask = (id: string) => {
    playClickFeedback();
    const targetTask = tasks.find((t) => t.id === id);
    if (targetTask) {
      logEvent({
        category: 'task',
        action: 'task.deleted',
        severity: 'warn',
        title: `Tâche supprimée · ${targetTask.room}`,
        description: `${targetTask.typeName} (${targetTask.assignee}) supprimée.`,
        target: { type: 'task', id, label: targetTask.typeName, secondaryLabel: targetTask.room },
      });
    }
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      localStorage.setItem('omnibook_pms_tasks', JSON.stringify(updated));
      return updated;
    });
  };

  const generateTurnoverTasksForCheckout = (roomName: string) => {
    const foundRes = resourceGroups.flatMap((g) => g.resources).find((r) => r.name.includes(roomName) || r.id === roomName);
    if (foundRes) {
      updateHousekeepingStatus(foundRes.id, 'dirty');
    }

    const nowStr = new Date().toISOString().slice(0, 10);
    const checkoutTaskList: Omit<PmsTask, 'id'>[] = [
      {
        room: roomName,
        typeId: 'depclean',
        typeName: 'Nettoyage départ à fond',
        category: 'Ménage',
        assignee: 'Amina',
        date: nowStr,
        status: 'pending',
        priority: 'urgent',
        note: `Départ client effectué - Remise en état chambre ${roomName}`,
        subtasks: [
          { id: 'st_1', text: 'Changement intégral literie & alèses', completed: false },
          { id: 'st_2', text: 'Désinfection salle d\'eau & poignées', completed: false },
          { id: 'st_3', text: 'Aspiration & nettoyage sol', completed: false },
        ],
        consumedItems: [
          { itemId: 'sac', itemName: 'Sac poubelle 30L', quantity: 2 },
          { itemId: 'pt', itemName: 'Papier toilette', quantity: 2 },
          { itemId: 'draps', itemName: 'Jeu de draps', quantity: 1 },
          { itemId: 'taie', itemName: 'Taie d’oreiller', quantity: 2 },
        ],
      },
      {
        room: roomName,
        typeId: 'towels',
        typeName: 'Changement du linge de bain',
        category: 'Linge',
        assignee: 'Sonia',
        date: nowStr,
        status: 'pending',
        priority: 'normal',
        note: 'Dotation 2 draps de bain + 2 serviettes main',
        consumedItems: [
          { itemId: 'sdb', itemName: 'Serviette de bain', quantity: 2 },
          { itemId: 'main', itemName: 'Serviette de main', quantity: 2 },
          { itemId: 'tapis', itemName: 'Tapis de bain', quantity: 1 },
        ],
      },
      {
        room: roomName,
        typeId: 'fridge',
        typeName: 'Inventaire & recharge minibar',
        category: 'Minibar & accueil',
        assignee: 'Yacine',
        date: nowStr,
        status: 'pending',
        priority: 'normal',
        note: 'Relever consommations du séjour pour facturation',
        consumedItems: [
          { itemId: 'eau', itemName: 'Eau minérale 50cl', quantity: 2 },
          { itemId: 'soda', itemName: 'Soda', quantity: 2 },
        ],
      },
    ];

    checkoutTaskList.forEach((t) => addTask(t));
    logEvent({
      category: 'housekeeping',
      action: 'housekeeping.turnover_generated',
      severity: 'info',
      title: `Protocole départ lancé · ${roomName}`,
      description: `${checkoutTaskList.length} tâche(s) de remise en état générée(s) suite au départ.`,
      target: { type: 'resource', id: foundRes?.id, label: roomName },
      metadata: { generatedTasks: checkoutTaskList.length },
      resourceId: foundRes?.id,
    });
  };

  const addStockMovement = (itemId: string, delta: number, reason: string, room?: string) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const currentList = stockItemsRef.current;
    const targetItem = currentList.find((s) => s.id === itemId);
    const prevQty = targetItem?.quantity ?? 0;
    const nextQty = Math.max(0, prevQty + delta);
    const updatedList = currentList.map((item) =>
      item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    );
    stockItemsRef.current = updatedList;
    setStockItems(updatedList);
    localStorage.setItem('omnibook_stock_items', JSON.stringify(updatedList));

    const newMovement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      itemId,
      itemName: targetItem?.name || itemId,
      delta,
      reason,
      room,
      user: resolveActorLabel(currentRoleRef.current),
    };

    setStockMovements((prev) => {
      const updated = [newMovement, ...prev].slice(0, 200);
      localStorage.setItem('omnibook_stock_movements', JSON.stringify(updated));
      return updated;
    });

    logEvent({
      category: 'stock',
      action: delta >= 0 ? 'stock.entry' : 'stock.exit',
      severity: targetItem && nextQty <= targetItem.minThreshold ? 'warn' : delta >= 0 ? 'success' : 'info',
      title: `${delta >= 0 ? 'Entrée' : 'Sortie'} stock · ${targetItem?.name || itemId}`,
      description: `${delta >= 0 ? '+' : ''}${delta} (${prevQty} → ${nextQty}) · ${reason}${room ? ` · ${room}` : ''}`,
      target: { type: 'stock_item', id: itemId, label: targetItem?.name || itemId, secondaryLabel: room },
      changes: [{ field: 'Quantité stock', before: String(prevQty), after: String(nextQty) }],
      metadata: { delta, reason, room: room || null },
    });
  };

  const addStockItem = (input: Omit<StockItem, 'id'>): StockItem => {
    const newItem: StockItem = {
      ...input,
      id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const next = [newItem, ...stockItemsRef.current];
    stockItemsRef.current = next;
    setStockItems(next);
    localStorage.setItem('omnibook_stock_items', JSON.stringify(next));
    logEvent({
      category: 'stock',
      action: 'stock.item_created',
      severity: 'success',
      title: `Article ajouté au stock · ${newItem.name}`,
      description: `${newItem.quantity} ${newItem.unit} (seuil min ${newItem.minThreshold}) · ${newItem.category}`,
      target: { type: 'stock_item', id: newItem.id, label: newItem.name, secondaryLabel: newItem.category },
    });
    return newItem;
  };

  const seedStandardStockCatalog = (): number => {
    const existingIds = new Set(stockItemsRef.current.map((s) => s.id));
    const existingNames = new Set(stockItemsRef.current.map((s) => s.name.trim().toLowerCase()));
    const toAdd: StockItem[] = [];
    for (const template of initialStockItems) {
      const candidateId = `std_${template.id}`;
      if (existingIds.has(candidateId) || existingIds.has(template.id) || existingNames.has(template.name.trim().toLowerCase())) {
        continue;
      }
      toAdd.push({ ...template, id: candidateId });
    }
    if (toAdd.length === 0) return 0;
    const next = [...stockItemsRef.current, ...toAdd];
    stockItemsRef.current = next;
    setStockItems(next);
    localStorage.setItem('omnibook_stock_items', JSON.stringify(next));
    logEvent({
      category: 'stock',
      action: 'stock.catalog_seeded',
      severity: 'success',
      title: `Catalogue hôtelier standard chargé`,
      description: `${toAdd.length} consommables hôteliers ajoutés à l'économat.`,
      metadata: { addedCount: toAdd.length },
    });
    return toAdd.length;
  };

  const updateStockItem = (updatedItem: StockItem) => {
    const existing = stockItemsRef.current.find((item) => item.id === updatedItem.id);
    const updated = stockItemsRef.current.map((item) => (item.id === updatedItem.id ? updatedItem : item));
    stockItemsRef.current = updated;
    setStockItems(updated);
    localStorage.setItem('omnibook_stock_items', JSON.stringify(updated));
    logEvent({
      category: 'stock',
      action: 'stock.item_updated',
      severity: 'info',
      title: `Article stock mis à jour · ${updatedItem.name}`,
      description: `Stock : ${updatedItem.quantity} ${updatedItem.unit} (seuil min ${updatedItem.minThreshold})`,
      target: { type: 'stock_item', id: updatedItem.id, label: updatedItem.name, secondaryLabel: updatedItem.category },
      changes: existing
        ? [
            ...(existing.quantity !== updatedItem.quantity ? [{ field: 'Quantité', before: String(existing.quantity), after: String(updatedItem.quantity) }] : []),
            ...(existing.minThreshold !== updatedItem.minThreshold ? [{ field: 'Seuil alerte', before: String(existing.minThreshold), after: String(updatedItem.minThreshold) }] : []),
          ]
        : undefined,
    });
  };

  const deleteStockItem = (id: string) => {
    const existing = stockItemsRef.current.find((item) => item.id === id);
    const updated = stockItemsRef.current.filter((item) => item.id !== id);
    stockItemsRef.current = updated;
    setStockItems(updated);
    localStorage.setItem('omnibook_stock_items', JSON.stringify(updated));
    if (existing) {
      logEvent({
        category: 'stock',
        action: 'stock.item_deleted',
        severity: 'warn',
        title: `Article stock supprimé · ${existing.name}`,
        description: `Article retiré de l’inventaire (${existing.quantity} ${existing.unit}).`,
        target: { type: 'stock_item', id, label: existing.name, secondaryLabel: existing.category },
      });
    }
  };

  const recordRoomReplenishment: AppContextType['recordRoomReplenishment'] = (input) => {
    const { roomId, roomName, items, markRoomClean, note, operatorName } = input;
    const result = applyStockDeductions(stockItemsRef.current, items);
    const actor = operatorName?.trim() || resolveActorLabel(currentRoleRef.current);
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const reasonText = note?.trim() ? `Réalimentation chambre · ${note.trim()}` : 'Réalimentation chambre';

    if (result.appliedLines.length > 0) {
      stockItemsRef.current = result.updatedStockItems;
      setStockItems(result.updatedStockItems);
      localStorage.setItem('omnibook_stock_items', JSON.stringify(result.updatedStockItems));

      const newMovements: StockMovement[] = result.appliedLines.map((line, idx) => ({
        id: `mov_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowStr,
        itemId: line.item.id,
        itemName: line.item.name,
        delta: -line.deductedQty,
        reason: reasonText,
        room: roomName,
        user: actor,
      }));

      setStockMovements((prev) => {
        const updated = [...newMovements, ...prev].slice(0, 200);
        localStorage.setItem('omnibook_stock_movements', JSON.stringify(updated));
        return updated;
      });

      logEvent({
        category: 'stock',
        action: 'stock.room_replenishment',
        severity: result.lowStockTriggered.length > 0 ? 'warn' : 'success',
        title: `Réalimentation validée · ${roomName}`,
        description: `${result.appliedLines.length} consommable(s) déduit(s) du stock par ${actor}.`,
        target: { type: 'resource', id: roomId, label: roomName },
        metadata: {
          deductedItems: result.appliedLines.map((l) => `${l.item.name} ×${l.deductedQty}`).join(', '),
          lowStockCount: result.lowStockTriggered.length,
        },
        resourceId: roomId,
      });

      if (result.lowStockTriggered.length > 0) {
        logEvent({
          category: 'stock',
          action: 'stock.low_threshold_alert',
          severity: 'warn',
          title: `Alerte rupture / seuil bas · ${result.lowStockTriggered.map((i) => i.name).join(', ')}`,
          description: `${result.rupturedItems.length} rupture(s) et ${result.lowStockTriggered.length} article(s) à commander suite à la réalimentation ${roomName}.`,
          metadata: {
            rupturedIds: result.rupturedItems.map((i) => i.id).join(', '),
            lowStockIds: result.lowStockTriggered.map((i) => i.id).join(', '),
          },
        });
      }
    }

    if (markRoomClean && roomId) {
      updateHousekeepingStatus(roomId, 'clean');
    }

    return {
      deductedCount: result.appliedLines.length,
      lowStockTriggered: result.lowStockTriggered,
      rupturedItems: result.rupturedItems,
    };
  };

  const saveSupplier: AppContextType['saveSupplier'] = (input) => {
    const id = input.id || `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record: StockSupplier = {
      id,
      name: input.name.trim(),
      category: input.category.trim() || 'Général',
      contactName: input.contactName?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      preferredChannel: input.preferredChannel || 'whatsapp',
      notes: input.notes?.trim() || undefined,
    };
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === id);
      const updated = exists ? prev.map((s) => (s.id === id ? record : s)) : [record, ...prev];
      localStorage.setItem('omnibook_stock_suppliers', JSON.stringify(updated));
      return updated;
    });
    logEvent({
      category: 'stock',
      action: input.id ? 'stock.supplier_updated' : 'stock.supplier_created',
      severity: 'info',
      title: `Fournisseur enregistré · ${record.name}`,
      description: `Canal préféré : ${record.preferredChannel.toUpperCase()}${record.phone ? ` · ${record.phone}` : ''}`,
    });
    return record;
  };

  const deleteSupplier = (id: string) => {
    setSuppliers((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem('omnibook_stock_suppliers', JSON.stringify(updated));
      return updated;
    });
  };

  const createPurchaseOrder: AppContextType['createPurchaseOrder'] = (input) => {
    const nowIso = new Date().toISOString();
    const record: PurchaseOrderRecord = {
      ...input,
      id: `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orderNumber:
        input.orderNumber?.trim() ||
        `CMD-${nowIso.slice(0, 7).replace('-', '')}-${String(Math.floor(100 + Math.random() * 900))}`,
      createdAt: nowIso,
      createdBy: input.createdBy?.trim() || resolveActorLabel(currentRoleRef.current),
    };
    setPurchaseOrders((prev) => {
      const updated = [record, ...prev];
      localStorage.setItem('omnibook_purchase_orders', JSON.stringify(updated));
      return updated;
    });
    logEvent({
      category: 'stock',
      action: 'stock.purchase_order_created',
      severity: record.status === 'confirmed' ? 'success' : 'info',
      title: `Commande ${record.orderNumber} (${record.status}) · ${record.supplierName}`,
      description: `${record.items.length} ligne(s) préparée(s) par ${record.createdBy}.`,
    });
    return record;
  };

  const updatePurchaseOrder = (po: PurchaseOrderRecord) => {
    setPurchaseOrders((prev) => {
      const updated = prev.map((item) => (item.id === po.id ? po : item));
      localStorage.setItem('omnibook_purchase_orders', JSON.stringify(updated));
      return updated;
    });
    logEvent({
      category: 'stock',
      action: 'stock.purchase_order_updated',
      severity: po.status === 'sent' || po.status === 'confirmed' ? 'success' : 'info',
      title: `Commande ${po.orderNumber} (${po.status}) · ${po.supplierName}`,
      description: po.sentVia
        ? `Envoyée au fournisseur via ${po.sentVia.toUpperCase()}.`
        : `${po.items.length} article(s) — statut ${po.status}.`,
    });
  };

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem('omnibook_purchase_orders', JSON.stringify(updated));
      return updated;
    });
  };

  const markPurchaseOrderReceived = (id: string) => {
    const targetPo = purchaseOrders.find((p) => p.id === id);
    if (!targetPo || targetPo.status === 'received') return;
    for (const line of targetPo.items) {
      if (line.orderQty > 0) {
        addStockMovement(line.itemId, line.orderQty, `Réception commande ${targetPo.orderNumber}`);
      }
    }
    const nowIso = new Date().toISOString();
    updatePurchaseOrder({
      ...targetPo,
      status: 'received',
      receivedAt: nowIso,
    });
  };

  const setDynamicRate = (roomType: string, date: string, price: number) => {
    const prevPrice = dynamicRates[roomType]?.[date];
    setDynamicRates((prev) => {
      const next = { ...prev, [roomType]: { ...(prev[roomType] || {}), [date]: price } };
      localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
      return next;
    });
    logEvent({
      category: 'billing',
      action: 'pricing.rate_updated',
      severity: 'info',
      title: `Tarif dynamique modifié · ${roomType}`,
      description: `${date} : ${prevPrice !== undefined ? prevPrice : 'auto'} → ${price} ${currency}`,
      target: { type: 'rate', label: roomType, secondaryLabel: date },
      changes: [{ field: `Tarif ${date}`, before: prevPrice !== undefined ? String(prevPrice) : 'Standard', after: String(price) }],
    });
  };

  const applyDynamicRatesBulk = (roomType: string, rates: Record<string, number>) => {
    setDynamicRates((prev) => {
      const next = { ...prev, [roomType]: { ...(prev[roomType] || {}), ...rates } };
      localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
      return next;
    });
    const datesCount = Object.keys(rates).length;
    logEvent({
      category: 'billing',
      action: 'pricing.bulk_updated',
      severity: 'info',
      title: `Tarifs dynamiques appliqués en masse · ${roomType}`,
      description: `${datesCount} journée(s) tarifaire(s) mise(s) à jour.`,
      target: { type: 'rate', label: roomType },
      metadata: { datesCount },
    });
  };

  const clearDynamicRate = (roomType: string, date: string) => {
    setDynamicRates((prev) => {
      const typeRates = { ...(prev[roomType] || {}) };
      if (!(date in typeRates)) return prev;
      delete typeRates[date];
      const next = { ...prev, [roomType]: typeRates };
      localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
      return next;
    });
  };

  const clearDynamicRatesMonth = (roomType: string, yearMonth: string) => {
    let removedCount = 0;
    setDynamicRates((prev) => {
      const typeRates = { ...(prev[roomType] || {}) };
      for (const dateKey of Object.keys(typeRates)) {
        if (dateKey.startsWith(`${yearMonth}-`)) {
          delete typeRates[dateKey];
          removedCount++;
        }
      }
      const next = { ...prev, [roomType]: typeRates };
      localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
      return next;
    });
    logEvent({
      category: 'billing',
      action: 'pricing.month_reset',
      severity: 'info',
      title: `Tarifs réinitialisés · ${roomType} (${yearMonth})`,
      description: `${removedCount} surcharge(s) réinitialisée(s) au tarif de base.`,
      target: { type: 'rate', label: roomType, secondaryLabel: yearMonth },
    });
  };

  const createStaffMember: AppContextType['createStaffMember'] = (input) => {
    const approvedBy = resolveActorLabel(currentRoleRef.current);
    const record = buildStaffMemberRecord({
      fullName: input.fullName,
      phone: input.phone,
      roleId: input.roleId,
      assignment: input.assignment,
      shift: input.shift,
      defaultTasks: input.defaultTasks,
      status: input.status || 'active',
      note: input.note,
      approvedBy,
    });

    setStaffMembers((prev) => {
      const updated = [record, ...prev];
      localStorage.setItem('omnibook_staff_members', JSON.stringify(updated));
      return updated;
    });

    const roleDef = resolveRoleDefinition(rolesRef.current, input.roleId);
    logEvent({
      category: 'system',
      action: 'staff.member_created',
      severity: 'success',
      title: `Personnel créé · ${record.fullName} (${roleDef.label.fr})`,
      description: `Affectation : ${record.assignment} · Shift ${record.shift} · ${record.defaultTasks.length} tâche(s).`,
      metadata: { roleId: record.roleId, assignment: record.assignment, shift: record.shift },
    });

    if (input.createInitialTasks && record.defaultTasks.length > 0) {
      const targetRoom = input.initialRoom?.trim() || record.assignment || 'Étage 1';
      const category = mapRoleToTaskCategory(roleDef);
      const todayDate = new Date().toISOString().slice(0, 10);
      record.defaultTasks.forEach((taskTitle) => {
        addTask({
          room: targetRoom,
          typeId: 'custom',
          typeName: taskTitle,
          category,
          assignee: record.fullName,
          date: todayDate,
          status: 'pending',
          priority: 'normal',
          note: `${roleDef.label.fr} · ${record.assignment} (${record.shift})`,
        });
      });
    }

    return record;
  };

  const updateStaffAssignment: AppContextType['updateStaffAssignment'] = (staffId, patch) => {
    const approvedBy = resolveActorLabel(currentRoleRef.current);
    const target = staffMembers.find((s) => s.id === staffId);
    if (!target) return;

    setStaffMembers((prev) => {
      const updated = prev.map((member) =>
        member.id === staffId
          ? applyStaffAssignmentUpdate(member, { ...patch, approvedBy })
          : member
      );
      localStorage.setItem('omnibook_staff_members', JSON.stringify(updated));
      return updated;
    });

    logEvent({
      category: 'system',
      action: 'staff.assignment_updated',
      severity: 'info',
      title: `Affectation mise à jour · ${target.fullName}`,
      description: `${target.assignment} → ${patch.assignment} (${patch.shift})${patch.note ? ` · ${patch.note}` : ''}`,
      changes: [
        ...(target.assignment !== patch.assignment ? [{ field: 'Affectation', before: target.assignment, after: patch.assignment }] : []),
        ...(target.shift !== patch.shift ? [{ field: 'Shift', before: target.shift, after: patch.shift }] : []),
      ],
    });
  };

  const promoteOrTransferStaff: AppContextType['promoteOrTransferStaff'] = (staffId, change) => {
    const approvedBy = resolveActorLabel(currentRoleRef.current);
    const target = staffMembers.find((s) => s.id === staffId);
    if (!target) return;

    const fromRole = resolveRoleDefinition(rolesRef.current, target.roleId);
    const toRole = resolveRoleDefinition(rolesRef.current, change.newRoleId);

    setStaffMembers((prev) => {
      const updated = prev.map((member) =>
        member.id === staffId
          ? applyStaffPromotionOrTransfer(member, { ...change, approvedBy })
          : member
      );
      localStorage.setItem('omnibook_staff_members', JSON.stringify(updated));
      return updated;
    });

    logEvent({
      category: 'system',
      action: change.changeType === 'promoted' ? 'staff.promoted' : 'staff.transferred',
      severity: 'success',
      title: `${change.changeType === 'promoted' ? 'Promotion' : 'Mutation / Changement de poste'} · ${target.fullName}`,
      description: `${fromRole.label.fr} → ${toRole.label.fr}${change.newAssignment ? ` · ${change.newAssignment}` : ''}`,
      changes: [{ field: 'Poste / Rôle', before: fromRole.label.fr, after: toRole.label.fr }],
    });
  };

  const assignTaskToStaff: AppContextType['assignTaskToStaff'] = (staffId, input) => {
    const target = staffMembers.find((s) => s.id === staffId);
    if (!target) return;
    const roleDef = resolveRoleDefinition(rolesRef.current, target.roleId);
    addTask({
      room: input.room.trim() || target.assignment || '101',
      typeId: 'custom',
      typeName: input.taskTitle.trim(),
      category: mapRoleToTaskCategory(roleDef),
      assignee: target.fullName,
      date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      priority: input.priority || 'normal',
      note: input.note?.trim() || `${roleDef.label.fr} · ${target.assignment} (${target.shift})`,
    });
  };

  const deleteStaffMember = (staffId: string) => {
    const target = staffMembers.find((s) => s.id === staffId);
    setStaffMembers((prev) => {
      const updated = prev.filter((m) => m.id !== staffId);
      localStorage.setItem('omnibook_staff_members', JSON.stringify(updated));
      return updated;
    });
    if (target) {
      logEvent({
        category: 'system',
        action: 'staff.member_deleted',
        severity: 'warn',
        title: `Fiche personnel retirée · ${target.fullName}`,
        description: `Ancien poste : ${resolveRoleDefinition(rolesRef.current, target.roleId).label.fr} (${target.assignment}).`,
      });
    }
  };

  const purgeAllUserData = async (): Promise<void> => {
    // Reset all user-owned in-memory collections.
    setBookings([]);
    setSelectedBooking(null);
    setResourceGroups([]);
    setTasks([]);
    stockItemsRef.current = [];
    setStockItems([]);
    setStockMovements([]);
    setSuppliers([]);
    setPurchaseOrders([]);
    setStaffMembers([]);
    setDynamicRates({});
    setPersistedEventLogs([]);
    setEstablishmentProfileState(DEFAULT_ESTABLISHMENT_PROFILE);
    setClientProfileState({
      id: '',
      name: '',
      email: '',
      phone: '',
      memberNumber: '',
      loyaltyPoints: 0,
    });
    setSelectedEstablishmentId('all');
    setSelectedBuildingGroupId('all');
    setEstablishments([]);
    setHasLoadedRemoteSnapshot(false);
    backfillRunRef.current = false;
    setCloudSyncStatus(INITIAL_CLOUD_SYNC_STATUS);
    setSyncLog([]);
    setHasOnboardedState(false);
    setIsEstablishmentModalOpen(false);
    setActiveSector('all');
    setSearchQuery('');
    setStoredRolesConfig({ customRoles: [], builtInOverrides: {} });

    // Remove every key owned by this application, including future proUSB keys.
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key && (key.startsWith('omnibook_') || key.startsWith('ob_'))) {
          localStorage.removeItem(key);
        }
      }
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key && key.startsWith('omnibook_')) sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.error('[AppContext] Failed to clear browser storage:', error);
      throw error;
    }

    // Clear proUSB cards, MDB snapshot, settings and audit records in memory.
    lockManager.purgeAllData();

    // Revert theme to system default
    resetThemeToDefault();

    // Wait for IndexedDB completion. A failed transaction must not be reported as success.
    await indexedDb.clearAll();
  };

  const eventLogs = useMemo<EventLogEntry[]>(() => {
    let invoicesSnapshot: InvoiceRecord[] = [];
    try {
      const raw = localStorage.getItem('omnibook_invoices');
      invoicesSnapshot = raw ? (JSON.parse(raw) as InvoiceRecord[]) : [];
    } catch {
      invoicesSnapshot = [];
    }
    const historicalSeeds = buildHistoricalEventSeeds({
      bookings,
      stockMovements,
      issuedCards: lockManager.getIssuedCards(),
      auditRecords: lockManager.getAuditRecords(),
      invoices: invoicesSnapshot,
      workspaceId: workspace.activeWorkspaceId || undefined,
    });
    return mergeEventLogs(persistedEventLogs, historicalSeeds, EVENT_LOG_MAX_ENTRIES);
  }, [
    persistedEventLogs,
    bookings,
    stockMovements,
    lastCreatedInvoice,
    lockHistoryVersion,
    workspace.activeWorkspaceId,
  ]);

  const openBookingFromEvent = useCallback((bookingId: string): boolean => {
    const match = latestBookingsRef.current.find((b) => b.id === bookingId);
    if (!match) return false;
    setSelectedBooking(match);
    return true;
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeWorkspaceId: workspace.activeWorkspaceId,
        refreshWorkspaces: workspace.refreshWorkspaces,
        language,
        setLanguage,
        theme,
        setTheme,
        appTheme,
        setAppTheme,
        resetThemeToDefault,
        isThemeModalOpen,
        setIsThemeModalOpen,
        currentDomain,
        setCurrentDomain,
        currentRole,
        setCurrentRole,
        roles,
        activeRoleDefinition,
        createCustomRole,
        updateRoleConfig,
        deleteCustomRole,
        resetBuiltInRoles,
        hasCustomizedBuiltInRoles,
        staffMembers,
        createStaffMember,
        updateStaffAssignment,
        promoteOrTransferStaff,
        assignTaskToStaff,
        deleteStaffMember,
        clientProfile,
        setClientProfile,
        activeSector,
        setActiveSector,
        searchQuery,
        setSearchQuery,
        dateRangeMode,
        setDateRangeMode,
        currentBaseDate,
        setCurrentBaseDate,
        shiftDays,
        bookings,
        setBookings,
        resourceGroups,
        setResourceGroups,
        updateHousekeepingStatus,
        checkConflict,
        addBooking,
        updateBooking,
        updateBookingStatus,
        deleteBooking,
        confirmCheckInAndCashPayment,
        markBookingAsPaid,
        selectedBooking,
        setSelectedBooking,
        lastCreatedInvoice,
        setLastCreatedInvoice,
        createInvoiceFromBooking,
        isNewBookingModalOpen,
        setIsNewBookingModalOpen,
        newBookingInitialSlot,
        setNewBookingInitialSlot,
        isCockpitOpen,
        setIsCockpitOpen,
        isLegalModalOpen,
        setIsLegalModalOpen,
        isIndexedDBOpen,
        setIsIndexedDBOpen,
        isQrScannerOpen,
        setIsQrScannerOpen,
        activeQrPassBooking,
        setActiveQrPassBooking,
        isOffline,
        setIsOffline,
        isSidebarMobileOpen,
        setIsSidebarMobileOpen,
        isAboutModalOpen,
        setIsAboutModalOpen,
        purgeAllUserData,
        activeView,
        setActiveView,

        // PMS Rich Hotel State
        establishments,
        selectedEstablishmentId,
        setSelectedEstablishmentId,
        selectedBuildingGroupId,
        setSelectedBuildingGroupId,
        currency,
        setCurrency,
        tasks,
        addTask,
        updateTaskStatus,
        toggleSubtask,
        deleteTask,
        generateTurnoverTasksForCheckout,
        activeOperatorName,
        setActiveOperatorName,
        focusedTaskId,
        setFocusedTaskId,
        stockItems,
        stockMovements,
        addStockMovement,
        addStockItem,
        seedStandardStockCatalog,
        updateStockItem,
        deleteStockItem,
        recordRoomReplenishment,
        suppliers,
        saveSupplier,
        deleteSupplier,
        purchaseOrders,
        createPurchaseOrder,
        updatePurchaseOrder,
        deletePurchaseOrder,
        markPurchaseOrderReceived,
        focusedStockTab,
        setFocusedStockTab,
        dynamicRates,
        setDynamicRate,
        applyDynamicRatesBulk,
        clearDynamicRate,
        clearDynamicRatesMonth,
        isSoundEnabled,
        toggleSound,
        playFeedback,
        establishmentProfile,
        setEstablishmentProfile,
        isEstablishmentModalOpen,
        setIsEstablishmentModalOpen,
        hasOnboarded,
        setHasOnboarded,
        triggerCloudRecovery: forceSupabaseSync,
        cloudSyncStatus,
        forceSupabaseSync,
        syncLog,
        syncTerminalOpen,
        setSyncTerminalOpen,
        clearSyncLog,
        eventLogs,
        logEvent,
        clearEventLogs,
        openBookingFromEvent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
