import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  HotelEstablishment,
} from '../types/booking';
import {
  initialResourceGroups,
  initialBookings,
  initialStockItems,
  initialPmsTasks,
} from '../data/mockData';
import { EstablishmentProfile, DEFAULT_ESTABLISHMENT_PROFILE } from '../types/establishment';
import { indexedDb } from '../db/indexedDb';
import { useWorkspace } from '../services/supabase/WorkspaceContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/supabaseClient';
import {
  deleteBooking as remoteDeleteBooking,
  deleteResource as remoteDeleteResource,
  listBookings,
  listDynamicRates,
  listEstablishments,
  listResourceGroups,
  listStockItems,
  listTasks,
  saveBooking as remoteSaveBooking,
  saveEstablishment as remoteSaveEstablishment,
  saveResource as remoteSaveResource,
  saveResourceGroupRow as remoteSaveResourceGroupRow,
  saveStockItem as remoteSaveStockItem,
  saveTask as remoteSaveTask,
} from '../services/supabase/pmsRepository';
import { planBackfill } from '../services/supabase/backfillPlanner';
import {
  deriveIdleSyncPhase,
  INITIAL_CLOUD_SYNC_STATUS,
  runSupabaseSync,
  type CloudSyncStatus,
} from '../services/supabase/supabaseSync';
import {
  SYNC_LOG_MAX_ENTRIES,
  type SyncLogEntry,
  type SyncProgressEvent,
} from '../services/supabase/syncLog';
import { isValidCalendarDate, shouldMarkPaymentAsPaid } from '../utils/bookingValidation';
import { isRoomReadyForBooking } from '../utils/roomReadiness';
import { lockManager } from '../locks/lockManager';
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
  updateBooking: (id: string, updates: Partial<TimelineBooking>) => void;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  deleteBooking: (id: string) => void;
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
  updateTaskStatus: (id: string, status: PmsTask['status']) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  generateTurnoverTasksForCheckout: (roomName: string) => void;
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  addStockMovement: (itemId: string, delta: number, reason: string, room?: string) => void;
  updateStockItem: (item: StockItem) => void;
  deleteStockItem: (id: string) => void;
  dynamicRates: Record<string, Record<string, number>>;
  setDynamicRate: (roomType: string, date: string, price: number) => void;
  applyDynamicRatesBulk: (roomType: string, rates: Record<string, number>) => void;
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

  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('omnibook_role') as UserRole) || 'manager';
  });

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
    setCurrentDomainState(d);
    localStorage.setItem('omnibook_domain', d);
    if (!isViewAllowedForDomain(activeView, d)) {
      setActiveView('planning');
    }
  };

  const setCurrentRole = (r: UserRole) => {
    setCurrentRoleState(r);
    localStorage.setItem('omnibook_role', r);
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
  const [activeView, setActiveView] = useState<ActiveAppView>('planning');

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
    setCurrencyState(c);
    localStorage.setItem('omnibook_currency', c);
  };

  // Establishment Profile (Hôtel, Coordonnées, Logo, Fiscalité) & Onboarding
  const [establishmentProfile, setEstablishmentProfileState] = useState<EstablishmentProfile>(() => {
    const saved = localStorage.getItem('omnibook_establishment_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as EstablishmentProfile;
        // Older releases persisted a fabricated demo hotel as if it were real.
        if (parsed.id === 'est_default_oran' && parsed.name === 'Grand Hôtel & Resort Méditerranée') {
          localStorage.removeItem('omnibook_establishment_profile');
          return DEFAULT_ESTABLISHMENT_PROFILE;
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_ESTABLISHMENT_PROFILE;
  });

  const setEstablishmentProfile = (profile: EstablishmentProfile) => {
    setEstablishmentProfileState(profile);
    localStorage.setItem('omnibook_establishment_profile', JSON.stringify(profile));
  };

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
    if (!workspace.activeWorkspaceId || DEMO_BOOKING_IDS.has(booking.id) || DEMO_RESOURCE_IDS.has(booking.resourceId)) return;
    const bookedResource = latestGroupsRef.current
      .flatMap((group) => group.resources)
      .find((resource) => resource.id === booking.resourceId);
    const resolvedEstablishmentId =
      selectedEstablishmentId !== 'all'
        ? selectedEstablishmentId
        : bookedResource?.establishmentId;
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

  const setClientProfile = (p: ClientProfile) => {
    setClientProfileState(p);
    localStorage.setItem('omnibook_client_profile', JSON.stringify(p));
  };

  const [selectedBooking, setSelectedBooking] = useState<TimelineBooking | null>(null);
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
        const [storedBookings, storedResources, storedGroups] = await Promise.all([
          indexedDb.queryStore<TimelineBooking>('bookings'),
          indexedDb.queryStore<ResourceItem>('resources'),
          indexedDb.getAllFromStore<ResourceGroup>('resourceGroups'),
        ]);
        const demoBookingIds = new Set(initialBookings.map((booking) => booking.id));
        const demoResourceIds = new Set(initialResourceGroups.flatMap((group) => group.resources.map((resource) => resource.id)));
        const demoGroupIds = new Set(initialResourceGroups.map((group) => group.id));

        const legacyBookings = readLegacy<TimelineBooking>('omnibook_bookings');
        const bookingById = new Map<string, TimelineBooking>();
        for (const booking of legacyBookings) bookingById.set(booking.id, booking);
        // IndexedDB wins on conflicts; legacy localStorage contributes only missing IDs.
        for (const booking of storedBookings.data) bookingById.set(booking.id, booking);
        const realBookings = [...bookingById.values()].filter((booking) => !demoBookingIds.has(booking.id));

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
          indexedDb.replaceAll('bookings', realBookings),
          indexedDb.replaceAll('resources', sourceResources),
          indexedDb.replaceStore('resourceGroups', groupMetadata),
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
        setIsCoreDataHydrated(true);
      } catch (error) {
        console.error('[AppContext] Core IndexedDB hydration failed; writes are disabled to protect existing data:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // IndexedDB is the authoritative store. No full booking/resource snapshots are
  // written to localStorage, avoiding quota exhaustion and stale dual-write state.
  useEffect(() => {
    if (!isCoreDataHydrated) return;
    void indexedDb.replaceAll('bookings', bookings).catch((error) => {
      console.error('[AppContext] Failed to persist bookings to IndexedDB:', error);
    });
  }, [bookings, isCoreDataHydrated]);

  useEffect(() => {
    if (!isCoreDataHydrated) return;
    const groupMetadata = resourceGroups.map((group) => ({ ...group, resources: [] as ResourceItem[] }));
    const resources = resourceGroups.flatMap((group) =>
      group.resources.map((resource) => ({ ...resource, groupId: group.id }))
    );
    void Promise.all([
      indexedDb.replaceStore('resourceGroups', groupMetadata),
      indexedDb.replaceAll('resources', resources),
    ]).catch((error) => {
      console.error('[AppContext] Failed to persist resource groups/resources to IndexedDB:', error);
    });
  }, [resourceGroups, isCoreDataHydrated]);

  const latestBookingsRef = useRef(bookings);
  const latestGroupsRef = useRef(resourceGroups);
  const latestProfileRef = useRef(establishmentProfile);
  latestBookingsRef.current = bookings;
  latestGroupsRef.current = resourceGroups;
  latestProfileRef.current = establishmentProfile;

  const syncInFlightRef = useRef<Promise<CloudRecoveryReport> | null>(null);
  const pendingResyncRef = useRef(false);
  const pendingForceRef = useRef(false);
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;
  const activeWorkspaceIdRef = useRef(workspace.activeWorkspaceId);
  activeWorkspaceIdRef.current = workspace.activeWorkspaceId;
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
  }, []);

  const clearSyncLog = useCallback(() => setSyncLog([]), []);

  // Bidirectional automatic Supabase synchronization:
  // pushes Outbox mutations sequentially (ACK before dequeue), pulls latest remote state,
  // and merges safely without overwriting pending local edits or tombstones.
  const executeSyncOnce = useCallback(async (force = false): Promise<CloudRecoveryReport> => {
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
          pullRemoteState: async (targetWsId) => {
            const [remoteGroups, remoteBookings, remoteEstablishments, remoteRates] = await Promise.all([
              listResourceGroups(targetWsId),
              listBookings(targetWsId),
              listEstablishments(targetWsId).catch(() => [] as HotelEstablishment[]),
              listDynamicRates(targetWsId).catch(() => ({} as Record<string, Record<string, number>>)),
            ]);
            let remoteTasks: PmsTask[] = [];
            let remoteStockItems: StockItem[] = [];
            if (remoteEstablishments.length > 0) {
              const [taskLists, stockLists] = await Promise.all([
                Promise.all(remoteEstablishments.map((est) => listTasks(targetWsId, est.id).catch(() => []))),
                Promise.all(remoteEstablishments.map((est) => listStockItems(targetWsId, est.id).catch(() => []))),
              ]);
              remoteTasks = taskLists.flat();
              remoteStockItems = stockLists.flat();
            }
            return {
              establishments: remoteEstablishments,
              groups: remoteGroups,
              bookings: remoteBookings,
              tasks: remoteTasks,
              stockItems: remoteStockItems,
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
          localStorage.setItem('omnibook_stock_items', JSON.stringify(next));
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
        !latestProfileRef.current.name.trim() &&
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

  const syncWithSupabase = useCallback(async (options?: { force?: boolean }): Promise<CloudRecoveryReport> => {
    const force = options?.force === true;
    if (syncInFlightRef.current) {
      pendingResyncRef.current = true;
      if (force) pendingForceRef.current = true;
      return syncInFlightRef.current;
    }

    const runner = (async () => {
      let report = await executeSyncOnce(force);
      while (pendingResyncRef.current) {
        const nextForce = pendingForceRef.current;
        pendingResyncRef.current = false;
        pendingForceRef.current = false;
        report = await executeSyncOnce(nextForce);
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
      !hasLoadedRemoteSnapshot ||
      backfillRunRef.current
    ) {
      return;
    }
    const profile = establishmentProfile;
    if (!profile.name.trim()) return;

    const plan = planBackfill({
      profile,
      workspaceId: workspace.activeWorkspaceId,
      groups: latestGroupsRef.current,
      bookings: latestBookingsRef.current,
      remoteEstablishments: establishments,
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

    (async () => {
      try {
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

  // Automatic periodic, focus, visibility, and explicit refresh sync triggers
  useEffect(() => {
    const handleForcedEvent = () => {
      void forceSupabaseSync();
    };
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (isOfflineRef.current || !activeWorkspaceIdRef.current) return;
      const lastAttemptMs = cloudSyncStatusRef.current.lastAttemptAt
        ? Date.parse(cloudSyncStatusRef.current.lastAttemptAt)
        : 0;
      if (Number.isFinite(lastAttemptMs) && Date.now() - lastAttemptMs < 15_000) return;
      void syncWithSupabase({ force: false });
    };
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (isOfflineRef.current || !activeWorkspaceIdRef.current) return;
      void syncWithSupabase({ force: false });
    }, 45_000);

    window.addEventListener('appointment-refresh', handleForcedEvent);
    window.addEventListener('appointment-cloud-config-updated', handleForcedEvent);
    window.addEventListener('focus', handleVisibilityOrFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('appointment-refresh', handleForcedEvent);
      window.removeEventListener('appointment-cloud-config-updated', handleForcedEvent);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [forceSupabaseSync, syncWithSupabase]);

  // Housekeeping status updater
  const updateHousekeepingStatus = (
    resourceId: string,
    status: 'clean' | 'cleaning' | 'dirty' | 'out_of_order'
  ) => {
    let updatedResource: ResourceItem | undefined;
    for (const grp of latestGroupsRef.current) {
      const match = grp.resources.find((r) => r.id === resourceId);
      if (match) {
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
      return {
        success: false,
        error:
          language === 'fr'
            ? 'Dates de réservation invalides.'
            : language === 'ar'
            ? 'تواريخ الحجز غير صالحة.'
            : 'Invalid booking dates.',
      };
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
        return { success: false, code: 'room_not_ready', roomName: room?.name ?? bookingData.resourceName, roomStatus: room?.housekeepingStatus, error: statusMessage };
      }
    }

    // 1. Strict date sanity checks before modifying state
    if (bookingData.sector === 'hotel' || bookingData.sector === 'resort') {
      const s = new Date(`${bookingData.startDate}T${bookingData.checkInTime || '14:00'}:00`);
      const e = new Date(`${bookingData.endDate}T${bookingData.checkOutTime || '12:00'}:00`);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return {
          success: false,
          error:
            language === 'fr'
              ? 'Dates de séjour invalides.'
              : language === 'ar'
              ? 'تواريخ الإقامة غير صالحة.'
              : 'Invalid stay dates.',
        };
      }
      if (e <= s) {
        return {
          success: false,
          error:
            language === 'fr'
              ? "Règle hôtel : la date de départ doit être postérieure à la date d'arrivée."
              : language === 'ar'
              ? 'قاعدة الفندق: يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول.'
              : 'Hotel rule: Check-out date must be after check-in date.',
        };
      }
      if (e.getTime() - s.getTime() > 365 * 24 * 3600 * 1000) {
        return {
          success: false,
          error:
            language === 'fr'
              ? 'Règle hôtel : séjour supérieur à 365 jours non autorisé.'
              : language === 'ar'
              ? 'قاعدة الفندق: لا يُسمح بإقامة تتجاوز 365 يوماً.'
              : 'Hotel rule: Stay cannot exceed 365 days.',
        };
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
      return {
        success: false,
        error:
          language === 'fr'
            ? 'Conflit détecté : Cette ressource est déjà réservée sur cette plage de dates.'
            : language === 'ar'
            ? 'تعارض في الحجز: هذه الغرفة أو العيادة محجوزة بالفعل في نفس الفترة.'
            : 'Scheduling conflict: This resource is already booked for these dates.',
      };
    }

    // 3. Only now instantiate and commit the valid booking
    const newBkg: TimelineBooking = {
      ...bookingData,
      id: `bkg_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
    };
    setBookings((prev) => [newBkg, ...prev]);
    persistBookingMutation(newBkg);

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
            currentRole === 'manager' ? 'Admin' : 'Reception'
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

  const updateBooking = (id: string, updates: Partial<TimelineBooking>) => {
    const existing = bookings.find((booking) => booking.id === id);
    if (existing) persistBookingMutation({ ...existing, ...updates });
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const updateBookingStatus = (id: string, status: BookingStatus) => {
    const existing = bookings.find((booking) => booking.id === id);
    if (existing) persistBookingMutation({ ...existing, status });
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b))
    );
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const deleteBooking = (id: string) => {
    const existing = bookings.find((booking) => booking.id === id);
    if (existing && workspace.activeWorkspaceId && !DEMO_BOOKING_IDS.has(id) && !DEMO_RESOURCE_IDS.has(existing.resourceId)) {
      const bookedResource = latestGroupsRef.current
        .flatMap((group) => group.resources)
        .find((resource) => resource.id === existing.resourceId);
      const resolvedEstablishmentId =
        selectedEstablishmentId !== 'all'
          ? selectedEstablishmentId
          : bookedResource?.establishmentId;
      void indexedDb.deleteWithOutbox('bookings', id, {
        workspaceId: workspace.activeWorkspaceId,
        establishmentId: resolvedEstablishmentId,
      }, 'booking')
        .then(() => scheduleAutoSync())
        .catch((error) => console.error('[Outbox] Booking deletion was not queued:', error));
    }
    setBookings((prev) => prev.filter((b) => b.id !== id));
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking(null);
    }
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
    if (targetBooking) persistBookingMutation(targetBooking);
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
  };

  const updateTaskStatus = (id: string, status: PmsTask['status']) => {
    if (status === 'done') {
      playSuccessFeedback();
    } else {
      playClickFeedback();
    }

    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
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
            completedAt: status === 'done' ? nowStr : t.completedAt,
            completedBy: status === 'done' ? (currentRole === 'staff' ? 'Amina (Staff)' : 'Gouvernante') : t.completedBy,
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
  };

  const addStockMovement = (itemId: string, delta: number, reason: string, room?: string) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setStockItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, quantity: Math.max(0, item.quantity + delta) };
        }
        return item;
      });
      localStorage.setItem('omnibook_stock_items', JSON.stringify(updated));
      return updated;
    });

    const targetItem = stockItems.find((s) => s.id === itemId);
    const newMovement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      itemId,
      itemName: targetItem?.name || itemId,
      delta,
      reason,
      room,
      user: currentRole === 'staff' ? 'Amina (Étage)' : 'Gouvernante',
    };

    setStockMovements((prev) => {
      const updated = [newMovement, ...prev].slice(0, 200);
      localStorage.setItem('omnibook_stock_movements', JSON.stringify(updated));
      return updated;
    });
  };

  const updateStockItem = (updatedItem: StockItem) => {
    setStockItems((prev) => {
      const updated = prev.map((item) => (item.id === updatedItem.id ? updatedItem : item));
      localStorage.setItem('omnibook_stock_items', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteStockItem = (id: string) => {
    setStockItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem('omnibook_stock_items', JSON.stringify(updated));
      return updated;
    });
  };

  const setDynamicRate = (roomType: string, date: string, price: number) => {
    setDynamicRates((prev) => {
      const next = { ...prev, [roomType]: { ...(prev[roomType] || {}), [date]: price } };
      localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
      return next;
    });
  };

  const applyDynamicRatesBulk = (roomType: string, rates: Record<string, number>) => {
    setDynamicRates((prev) => {
      const next = { ...prev, [roomType]: { ...(prev[roomType] || {}), ...rates } };
      localStorage.setItem('omnibook_dynamic_rates', JSON.stringify(next));
      return next;
    });
  };

  const purgeAllUserData = async (): Promise<void> => {
    // Reset all user-owned in-memory collections.
    setBookings([]);
    setSelectedBooking(null);
    setResourceGroups([]);
    setTasks([]);
    setStockItems([]);
    setStockMovements([]);
    setDynamicRates({});
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
        stockItems,
        stockMovements,
        addStockMovement,
        updateStockItem,
        deleteStockItem,
        dynamicRates,
        setDynamicRate,
        applyDynamicRatesBulk,
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
