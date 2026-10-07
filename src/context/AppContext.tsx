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
} from '../types/booking';
import { initialBookings, initialResourceGroups, initialInvoices } from '../data/mockData';
import { objectBox } from '../db/objectbox';

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
  resourceGroups: ResourceGroup[];
  updateHousekeepingStatus: (resourceId: string, status: 'clean' | 'cleaning' | 'dirty' | 'out_of_order') => void;
  checkConflict: (resourceId: string, startDate: string, endDate: string, excludeBookingId?: string) => boolean;
  addBooking: (booking: Omit<TimelineBooking, 'id'>) => { success: boolean; error?: string; booking?: TimelineBooking };
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
  purgeAllUserData: () => void;
  activeView: 'planning' | 'my_bookings' | 'reports' | 'analytics' | 'housekeeping' | 'billing' | 'channels';
  setActiveView: (view: 'planning' | 'my_bookings' | 'reports' | 'analytics' | 'housekeeping' | 'billing' | 'channels') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('omnibook_lang') as Language) || 'fr';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('omnibook_theme') as Theme) || 'light';
  });

  const [currentDomain, setCurrentDomainState] = useState<DomainType>(() => {
    return (localStorage.getItem('omnibook_domain') as DomainType) || 'hotel';
  });

  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('omnibook_role') as UserRole) || 'manager';
  });

  const setCurrentDomain = (d: DomainType) => {
    setCurrentDomainState(d);
    localStorage.setItem('omnibook_domain', d);
  };

  const setCurrentRole = (r: UserRole) => {
    setCurrentRoleState(r);
    localStorage.setItem('omnibook_role', r);
  };

  const [activeSector, setActiveSector] = useState<SectorType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeMode, setDateRangeMode] = useState<'two_weeks' | 'one_month'>('two_weeks');
  const [currentBaseDate, setCurrentBaseDate] = useState('2026-10-26');
  const [activeView, setActiveView] = useState<'planning' | 'my_bookings' | 'reports' | 'analytics' | 'housekeeping' | 'billing' | 'channels'>('planning');

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
    // Asynchronously update ObjectBox store
    bookings.forEach((b) => objectBox.put('bookings', b));
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('omnibook_resource_groups', JSON.stringify(resourceGroups));
    resourceGroups.flatMap((g) => g.resources).forEach((r) => objectBox.put('resources', r));
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

  const addBooking = (bookingData: Omit<TimelineBooking, 'id'>): { success: boolean; error?: string } => {
    // Business rule check: double booking prevention
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

    const newBkg: TimelineBooking = {
      ...bookingData,
      id: `bkg_${Date.now()}`,
    };
    setBookings((prev) => [newBkg, ...prev]);
    return { success: true, booking: newBkg };
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
    cashReceived: boolean = true
  ): { success: boolean; message: string; booking?: TimelineBooking } => {
    let targetBooking: TimelineBooking | undefined;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          const isCash = b.paymentStatus === 'pending' || cashReceived;
          const updated: TimelineBooking = {
            ...b,
            status: 'checked_in',
            paymentStatus: isCash ? 'paid' : b.paymentStatus,
            notes: (b.notes || '') + (isCash ? ' [✓ Présence confirmée via QR Code & Paiement Cash finalisé]' : ' [✓ Présence confirmée via QR Code]'),
          };
          targetBooking = updated;
          return updated;
        }
        return b;
      })
    );

    if (selectedBooking && selectedBooking.id === bookingId) {
      setSelectedBooking((prev) => (prev ? { ...prev, status: 'checked_in', paymentStatus: 'paid' } : null));
    }

    return {
      success: true,
      message:
        language === 'fr'
          ? 'Présence confirmée par QR Code et règlement finalisé avec succès !'
          : language === 'ar'
          ? 'تم تأكيد الحضور برمز QR وتسوية الدفع بنجاح!'
          : 'Check-in confirmed with QR Code and payment settled successfully!',
      booking: targetBooking,
    };
  };

  const purgeAllUserData = () => {
    localStorage.removeItem('omnibook_bookings');
    localStorage.removeItem('omnibook_resource_groups');
    setBookings([]);
    setSelectedBooking(null);
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
        resourceGroups,
        updateHousekeepingStatus,
        checkConflict,
        addBooking,
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
        purgeAllUserData,
        activeView,
        setActiveView,
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
