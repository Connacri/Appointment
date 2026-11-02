import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Language,
  Theme,
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
  initialBookings,
  initialResourceGroups,
  initialInvoices,
  initialEstablishments,
  initialStockItems,
  initialPmsTasks,
} from '../data/mockData';
import { EstablishmentProfile, DEFAULT_ESTABLISHMENT_PROFILE } from '../types/establishment';
import { objectBox } from '../db/objectbox';
import { lockManager } from '../locks/lockManager';
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
  | 'prousb';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
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
  setBookings: (bookings: TimelineBooking[]) => void;
  resourceGroups: ResourceGroup[];
  setResourceGroups: (groups: ResourceGroup[]) => void;
  updateHousekeepingStatus: (resourceId: string, status: 'clean' | 'cleaning' | 'dirty' | 'out_of_order') => void;
  checkConflict: (resourceId: string, startDate: string, endDate: string, excludeBookingId?: string) => boolean;
  addBooking: (booking: Omit<TimelineBooking, 'id'>) => { success: boolean; error?: string; booking?: TimelineBooking };
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
  newBookingInitialSlot: { resourceId?: string; date?: string } | null;
  setNewBookingInitialSlot: (slot: { resourceId?: string; date?: string } | null) => void;
  isCockpitOpen: boolean;
  setIsCockpitOpen: (open: boolean) => void;
  isLegalModalOpen: boolean;
  setIsLegalModalOpen: (open: boolean) => void;
  isObjectBoxOpen: boolean;
  setIsObjectBoxOpen: (open: boolean) => void;
  isQrScannerOpen: boolean;
  setIsQrScannerOpen: (open: boolean) => void;
  activeQrPassBooking: TimelineBooking | null;
  setActiveQrPassBooking: (booking: TimelineBooking | null) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  isSidebarMobileOpen: boolean;
  setIsSidebarMobileOpen: (open: boolean) => void;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

// Strict YYYY-MM-DD calendar validation. Date() alone normalizes impossible dates
// (for example 2026-02-31) into a date in the following month.
const isValidCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('omnibook_lang') as Language) || 'fr';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('omnibook_theme') as Theme) || 'light';
  });

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
  const [establishments] = useState<HotelEstablishment[]>(initialEstablishments);
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
        return JSON.parse(saved);
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
  const [newBookingInitialSlot, setNewBookingInitialSlot] = useState<{ resourceId?: string; date?: string } | null>(null);
  const [isCockpitOpen, setIsCockpitOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isObjectBoxOpen, setIsObjectBoxOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [activeQrPassBooking, setActiveQrPassBooking] = useState<TimelineBooking | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

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

  // Sync theme
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('omnibook_theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Save bookings & resources to localStorage & ObjectBox
  useEffect(() => {
    localStorage.setItem('omnibook_bookings', JSON.stringify(bookings));
    // Atomic replacement keeps IndexedDB and its fallback aligned, including deletions.
    void objectBox.replaceAll('bookings', bookings).catch((error) => {
      console.error('[AppContext] Failed to persist bookings to ObjectBox:', error);
    });
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('omnibook_resource_groups', JSON.stringify(resourceGroups));
    const resources = resourceGroups.flatMap((g) => g.resources);
    void objectBox.replaceAll('resources', resources).catch((error) => {
      console.error('[AppContext] Failed to persist resources to ObjectBox:', error);
    });
  }, [resourceGroups]);

  // Seed initial ObjectBox data on startup
  useEffect(() => {
    objectBox.openStore().then(() => {
      initialInvoices.forEach((inv) => objectBox.put('invoices', inv));
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
    excludeBookingId?: string
  ): boolean => {
    return bookings.some((b) => {
      if (b.resourceId !== resourceId) return false;
      if (b.id === excludeBookingId) return false;
      if (b.status === 'cancelled') return false;
      // Overlap condition: start < otherEnd && end > otherStart
      return startDate < b.endDate && endDate > b.startDate;
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
  ): { success: boolean; error?: string; booking?: TimelineBooking } => {
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
      bookingData.endDate
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
      id: `bkg_${Date.now()}`,
    };
    setBookings((prev) => [newBkg, ...prev]);

    // Auto-issue proUSB guest card for hotel/resort bookings
    if (bookingData.sector === 'hotel' || bookingData.sector === 'resort') {
      try {
        lockManager
          .issueGuestCardFromBooking(
            {
              id: newBkg.id,
              guestName: bookingData.guestName,
              resourceName: bookingData.resourceName,
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
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const updateBookingStatus = (id: string, status: BookingStatus) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b))
    );
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking((prev) => (prev ? { ...prev, status } : null));
    }
  };

  const deleteBooking = (id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking(null);
    }
  };

  const markBookingAsPaid = (
    bookingId: string,
    receiptNote?: string
  ): { success: boolean; message: string; booking?: TimelineBooking } => {
    let targetBooking: TimelineBooking | undefined;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          const updated: TimelineBooking = {
            ...b,
            paymentStatus: 'paid',
            notes:
              (b.notes || '') +
              (receiptNote ||
                ' [✓ Reçu de paiement acquitté via QR Code - Marqué PAYÉ par le personnel]'),
          };
          targetBooking = updated;
          return updated;
        }
        return b;
      })
    );

    if (selectedBooking && selectedBooking.id === bookingId) {
      setSelectedBooking((prev) =>
        prev ? { ...prev, paymentStatus: 'paid' } : null
      );
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
      currentBooking.paymentStatus === 'paid' || cashReceived === true;
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

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId ? updatedBooking : booking
      )
    );
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking(updatedBooking);
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

    // Wait for IndexedDB completion. A failed transaction must not be reported as success.
    await objectBox.clearAll();
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
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
        isObjectBoxOpen,
        setIsObjectBoxOpen,
        isQrScannerOpen,
        setIsQrScannerOpen,
        activeQrPassBooking,
        setActiveQrPassBooking,
        isOffline,
        setIsOffline,
        isSidebarMobileOpen,
        setIsSidebarMobileOpen,
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
