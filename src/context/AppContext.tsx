import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme, SectorType, TimelineBooking, BookingStatus, ResourceGroup, DomainType, UserRole } from '../types/booking';
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
  addBooking: (booking: Omit<TimelineBooking, 'id'>) => { success: boolean; error?: string };
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  deleteBooking: (id: string) => void;
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
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  purgeAllUserData: () => void;
  activeView: 'planning' | 'my_bookings' | 'reports' | 'analytics' | 'housekeeping' | 'billing';
  setActiveView: (view: 'planning' | 'my_bookings' | 'reports' | 'analytics' | 'housekeeping' | 'billing') => void;
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
  const [activeView, setActiveView] = useState<'planning' | 'my_bookings' | 'reports' | 'analytics' | 'housekeeping' | 'billing'>('planning');

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

  const [selectedBooking, setSelectedBooking] = useState<TimelineBooking | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [newBookingInitialSlot, setNewBookingInitialSlot] = useState<{ resourceId?: string; date?: string } | null>(null);
  const [isCockpitOpen, setIsCockpitOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isObjectBoxOpen, setIsObjectBoxOpen] = useState(false);
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
    return { success: true };
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
