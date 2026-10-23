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
import { objectBox } from '../db/objectbox';

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
  | 'channels';

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
  activeView: ActiveAppView;
  setActiveView: (view: ActiveAppView) => void;

  // Rich Hotel PMS State
  establishments: HotelEstablishment[];
  selectedEstablishmentId: string | 'all';
  setSelectedEstablishmentId: (id: string | 'all') => void;
  currency: 'DA' | 'EUR';
  setCurrency: (c: 'DA' | 'EUR') => void;
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
  const [currentBaseDate, setCurrentBaseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [activeView, setActiveView] = useState<ActiveAppView>('planning');

  // PMS Hotel Complex & Currency
  const [establishments] = useState<HotelEstablishment[]>(initialEstablishments);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | 'all'>('all');
  const [currency, setCurrencyState] = useState<'DA' | 'EUR'>(() => {
    return (localStorage.getItem('omnibook_currency') as 'DA' | 'EUR') || 'DA';
  });

  const setCurrency = (c: 'DA' | 'EUR') => {
    setCurrencyState(c);
    localStorage.setItem('omnibook_currency', c);
  };

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

  const addBooking = (
    bookingData: Omit<TimelineBooking, 'id'>
  ): { success: boolean; error?: string; booking?: TimelineBooking } => {
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

  const addTask = (taskData: Omit<PmsTask, 'id'>) => {
    const newTask: PmsTask = {
      ...taskData,
      id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    setTasks((prev) => {
      const updated = [newTask, ...prev];
      localStorage.setItem('omnibook_pms_tasks', JSON.stringify(updated));
      return updated;
    });
  };

  const updateTaskStatus = (id: string, status: PmsTask['status']) => {
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

  const purgeAllUserData = () => {
    localStorage.removeItem('omnibook_bookings');
    localStorage.removeItem('omnibook_resource_groups');
    localStorage.removeItem('omnibook_pms_tasks');
    localStorage.removeItem('omnibook_stock_items');
    localStorage.removeItem('omnibook_stock_movements');
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
