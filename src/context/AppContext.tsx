import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Language,
  Theme,
  AppThemeId,
  SectorType,
  TimelineBooking,
  BookingStatus,
  ResourceGroup,
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
  initialInvoices,
  initialStockItems,
  initialPmsTasks,
} from '../data/mockData';
import { EstablishmentProfile, DEFAULT_ESTABLISHMENT_PROFILE } from '../types/establishment';
import { indexedDb } from '../db/indexedDb';
import { useWorkspace } from '../services/supabase/WorkspaceContext';
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
  workspaces: { id: string; name: string; owner_id: string }[];
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  isWorkspaceLoading: boolean;
  workspaceError: string | null;
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
  setNewBookingInitialSlot: (slot: { resourceId?: string; date?: string } | null) => void;
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
  selectedEstablishmentId: string | 'all';
  setSelectedEstablishmentId: (id: string | 'all') => void;
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
}

const DEMO_BOOKING_IDS = new Set(initialBookings.map((booking) => booking.id));
const DEMO_RESOURCE_IDS = new Set(initialResourceGroups.flatMap((group) => group.resources.map((resource) => resource.id)));

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
  // The Gantt selector is populated from real hotel building groups in resourceGroups.
  // Keep this compatibility field empty: mock establishments must never appear as real inventory.
  const establishments: HotelEstablishment[] = [];
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | 'all'>('all');
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
        return JSON.parse(saved);
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
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialStockItems;
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem('omnibook_stock_movements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'sm_1', timestamp: '2026-10-26 08:30', itemId: 'draps', itemName: 'Jeu de draps grand lit', delta: -4, reason: 'Rotation départ VIP', room: 'CV-101', user: 'Amina' },
      { id: 'sm_2', timestamp: '2026-10-26 09:15', itemId: 'eau', itemName: 'Eau minérale 50 cl', delta: -6, reason: 'Réassort minibar', room: 'PL-305', user: 'Yacine' },
      { id: 'sm_3', timestamp: '2026-10-25 17:00', itemId: 'shamp', itemName: 'Shampooing argan 30 ml', delta: 100, reason: 'Livraison fournisseur', user: 'Gouvernante' },
    ];
  });

  // PMS Tasks & Deliveries
  const [tasks, setTasks] = useState<PmsTask[]>(() => {
    const saved = localStorage.getItem('omnibook_pms_tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialPmsTasks;
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
    return {
      'Double Standard': {
        '2026-10-30': 10500,
        '2026-10-31': 11000,
      },
      'Double Deluxe': {
        '2026-10-30': 16000,
        '2026-10-31': 17500,
      },
    };
  });

  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>(() => {
    const saved = localStorage.getItem('omnibook_resource_groups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return initialResourceGroups;
  });

  const [bookings, setBookings] = useState<TimelineBooking[]>(() => {
    const saved = localStorage.getItem('omnibook_bookings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialBookings;
  });

  // Only explicit user-created/edited records enter the outbox. Bootstrap mock records are excluded.
  const persistBookingMutation = (booking: TimelineBooking) => {
    if (!workspace.activeWorkspaceId || DEMO_BOOKING_IDS.has(booking.id) || DEMO_RESOURCE_IDS.has(booking.resourceId)) return;
    void indexedDb.putWithOutbox(
      'bookings',
      booking,
      {
        workspaceId: workspace.activeWorkspaceId,
        establishmentId: selectedEstablishmentId === 'all' ? undefined : selectedEstablishmentId,
      },
      'booking'
    ).catch((error) => console.error('[Outbox] Booking mutation was not queued:', error));
  };

  const [clientProfile, setClientProfileState] = useState<ClientProfile>(() => {
    const saved = localStorage.getItem('omnibook_client_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      id: 'clt_2026_9812',
      name: 'Alexander Kaufmann',
      email: 'alex.kaufmann@example.com',
      phone: '+33 6 12 34 56 78',
      memberNumber: 'CLT-2026-9812',
      loyaltyPoints: 350,
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
  const [isOffline, setIsOffline] = useState(false);
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

  // Save bookings & resources to localStorage & IndexedDB
  useEffect(() => {
    localStorage.setItem('omnibook_bookings', JSON.stringify(bookings));
    // Atomic replacement keeps IndexedDB and its fallback aligned, including deletions.
    void indexedDb.replaceAll('bookings', bookings).catch((error) => {
      console.error('[AppContext] Failed to persist bookings to IndexedDB:', error);
    });
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('omnibook_resource_groups', JSON.stringify(resourceGroups));
    const resources = resourceGroups.flatMap((g) => g.resources);
    void indexedDb.replaceAll('resources', resources).catch((error) => {
      console.error('[AppContext] Failed to persist resources to IndexedDB:', error);
    });
  }, [resourceGroups]);

  // Seed initial IndexedDB data on startup
  useEffect(() => {
    indexedDb.openStore().then(() => {
      initialInvoices.forEach((inv) => indexedDb.put('invoices', inv));
    }).catch((error) => {
      console.error('[AppContext] IndexedDB initialization failed:', error);
    });
  }, []);

  // Housekeeping status updater
  const updateHousekeepingStatus = (
    resourceId: string,
    status: 'clean' | 'cleaning' | 'dirty' | 'out_of_order'
  ) => {
    setResourceGroups((prev) =>
      prev.map((grp) => ({
        ...grp,
        resources: grp.resources.map((r) =>
          r.id === resourceId ? { ...r, housekeepingStatus: status } : r
        ),
      }))
    );
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
    const toMinutes = (date: string, time: string) => {
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
      const existingEnd = toMinutes(b.endDate, b.checkOutTime || '12:00') + turnoverMs;
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
      const s = new Date(bookingData.startDate + 'T14:00');
      const e = new Date(bookingData.endDate + 'T12:00');
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
      void indexedDb.deleteWithOutbox('bookings', id, {
        workspaceId: workspace.activeWorkspaceId,
        establishmentId: selectedEstablishmentId === 'all' ? undefined : selectedEstablishmentId,
      }, 'booking').catch((error) => console.error('[Outbox] Booking deletion was not queued:', error));
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
        workspaces: workspace.workspaces,
        setActiveWorkspaceId: workspace.setActiveWorkspaceId,
        refreshWorkspaces: workspace.refreshWorkspaces,
        createWorkspace: workspace.createWorkspace,
        isWorkspaceLoading: workspace.loading,
        workspaceError: workspace.error,
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
