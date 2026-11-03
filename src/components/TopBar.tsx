import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  QrCode,
  Camera,
  Usb,
  MoreVertical,
  X,
  Bell,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Hotel,
  Palmtree,
  Calendar,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp, ActiveAppView } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { playSuccessFeedback } from '../utils/audioFeedback';
import { PipelineStatusIndicator } from './PipelineStatusIndicator';
import {
  lockManager,
  UsbConnectionStatus,
  UsbDeviceInfo,
} from '../locks/lockManager';

const viewLabels: Record<ActiveAppView, { fr: string; en: string; ar: string }> = {
  planning: { fr: 'Planning', en: 'Planning', ar: 'الجدول الزمني' },
  my_bookings: { fr: 'Réservations', en: 'Bookings', ar: 'الحجوزات' },
  reports: { fr: 'Main Courante', en: 'Night Audit', ar: 'التقارير اليومية' },
  analytics: { fr: 'Statistiques & Revenus', en: 'Analytics & Revenue', ar: 'الإحصائيات' },
  housekeeping: { fr: 'Gouvernante & Chambres', en: 'Housekeeping', ar: 'خدمة الغرف' },
  tasks: { fr: 'Tâches PMS', en: 'PMS Tasks', ar: 'مهام الفندق' },
  stock: { fr: 'Stocks & Économat', en: 'Stock & Inventory', ar: 'المخزون' },
  pricing: { fr: 'Tarifs Dynamiques', en: 'Dynamic Pricing', ar: 'الأسعار الديناميكية' },
  billing: { fr: 'Facturation & Devis', en: 'Billing & Invoices', ar: 'الفواتير' },
  channels: { fr: 'Channel Manager', en: 'Channel Manager', ar: 'مدير القنوات' },
  prousb: { fr: 'Serrures proUSB', en: 'proUSB Locks', ar: 'أقفال proUSB' },
  spa: { fr: 'Spa & Espace Bien-Être', en: 'Spa & Wellness Centre', ar: 'السبا والعافية' },
};

export const TopBar: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    searchQuery,
    setSearchQuery,
    dateRangeMode,
    setDateRangeMode,
    currentBaseDate,
    shiftDays,
    setIsNewBookingModalOpen,
    setNewBookingInitialSlot,
    isOffline,
    setIsOffline,
    activeSector,
    setActiveSector,
    currentDomain,
    setCurrentDomain,
    currentRole,
    setCurrentRole,
    setIsQrScannerOpen,
    setActiveQrPassBooking,
    bookings,
    clientProfile,
    currency,
    setCurrency,
    tasks,
    stockItems,
    activeView,
    setActiveView,
    isSidebarMobileOpen,
    setIsSidebarMobileOpen,
    isSoundEnabled,
    toggleSound,
  } = useApp();

  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [usbDevice, setUsbDevice] = useState<UsbDeviceInfo | null>(lockManager.getDeviceInfo());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [usbNotice, setUsbNotice] = useState<string | null>(null);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);
  const [isRequestingUsb, setIsRequestingUsb] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Subscribe to WebHID Hardware state
  useEffect(() => {
    const unsub = lockManager.subscribeConnection((st, dev) => {
      setUsbStatus(st);
      setUsbDevice(dev);
    });
    return unsub;
  }, []);

  // Close more menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  const urgentTasksCount = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length;
  const lowStockCount = stockItems.filter((s) => s.quantity <= s.minThreshold).length;
  const canCreateBooking = ['admin', 'manager', 'receptionist', 'client'].includes(currentRole);
  const canUseUsb = ['admin', 'manager', 'receptionist'].includes(currentRole);
  const canSeeFinance = ['admin', 'manager'].includes(currentRole);

  // Direct USB Hardware Permission Request via WebHID
  const handlePhysicalUsbClick = async () => {
    if (usbStatus === 'connected') {
      setActiveView('prousb');
      return;
    }

    if (typeof navigator === 'undefined' || !('hid' in navigator)) {
      setUsbNotice("Votre navigateur ne supporte pas WebHID. Utilisez Google Chrome, Microsoft Edge ou Opera sur HTTPS/localhost.");
      setTimeout(() => setUsbNotice(null), 5000);
      return;
    }

    setIsRequestingUsb(true);
    try {
      await lockManager.requestPhysicalUsbDevice();
      setUsbNotice("Encodeur proUSB connecté avec succès via WebHID !");
      setTimeout(() => setUsbNotice(null), 4000);
      setActiveView('prousb');
    } catch (err: any) {
      console.warn('[TopBar] WebHID request cancelled or failed:', err);
      if (err?.name === 'SecurityError' || err?.message?.includes('denied')) {
        setUsbNotice("Autorisation USB refusée par l'utilisateur.");
      } else {
        setUsbNotice("Sélectionnez l'encodeur proUSB dans la boîte de dialogue du navigateur.");
      }
      setTimeout(() => setUsbNotice(null), 4500);
    } finally {
      setIsRequestingUsb(false);
    }
  };

  // Helper to format date display compactly
  const formatDateDisplay = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
  };

  const [y, m, d] = currentBaseDate.split('-').map(Number);
  const endDateObj = new Date(y, m - 1, d);
  endDateObj.setDate(endDateObj.getDate() + (dateRangeMode === 'two_weeks' ? 13 : 27));
  const endDateFormatted = endDateObj.toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US',
    {
      day: 'numeric',
      month: 'short',
    }
  );

  return (
    <>
      <header className="workspace-topbar relative z-[500] min-w-0 w-full px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 shrink-0 select-none shadow-xs backdrop-blur">
        {/* Primary toolbar row: single-line on mobile, no multi-row wrapping */}
        <div className="w-full min-w-0 flex items-center justify-between gap-1.5 sm:gap-2.5">
          {/* LEFT: Mobile Menu, Breadcrumb / Title, and Sector Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Ouvrir le menu de navigation"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb Navigation Trail */}
            <nav aria-label="Fil d'Ariane / Breadcrumb" className="flex items-center text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <button
                type="button"
                onClick={() => setActiveView('planning')}
                className="hidden sm:flex hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold items-center gap-1.5 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0"
                title="Appointment PMS - Retour au planning"
              >
                <Hotel size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="hidden xl:inline font-bold">APPOINTMENT PMS</span>
              </button>
              <ChevronRight size={13} className="hidden sm:inline mx-1 text-slate-400 shrink-0 rtl:rotate-180" />
              <span className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm max-w-[110px] sm:max-w-[170px]">
                {viewLabels[activeView]?.[language] || activeView}
              </span>

              {/* Clickable Quick Sector Switcher Badge */}
              <button
                type="button"
                onClick={() => setCurrentDomain(currentDomain === 'hotel' ? 'resort' : 'hotel')}
                className="ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shrink-0 cursor-pointer"
                title="Cliquer pour basculer Secteur Hôtel / Resort"
              >
                {currentDomain === 'hotel' ? (language === 'fr' ? 'HÔTEL' : 'HOTEL') : 'RESORT'}
              </button>

              <span className="hidden xl:inline-flex items-center ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                {currentRole === 'admin' ? 'ADMIN' : currentRole === 'manager' ? (language === 'fr' ? 'GÉRANT' : 'MANAGER') : currentRole === 'receptionist' ? (language === 'fr' ? 'RÉCEPTION' : 'RECEPTION') : currentRole === 'staff' ? (language === 'fr' ? 'ÉQUIPE' : 'STAFF') : 'CLIENT'}
              </span>
            </nav>
          </div>

          {/* RIGHT: Compact Action Buttons (USB, + Nouveau, More, Search) */}
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            {/* Currency Selector (Desktop) */}
            {canSeeFinance && (
              <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-1">
                <select
                  value={currency === 'DZD' ? 'DA' : currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-100 font-bold cursor-pointer focus:outline-none text-[11px]"
                  title="Devise principale de facturation"
                >
                  <option value="DA">🇩🇿 DA (DZD)</option>
                  <option value="EUR">🇪🇺 € (EUR)</option>
                  <option value="USD">🇺🇸 $ (USD)</option>
                  <option value="RMB">🇨🇳 ¥ (RMB)</option>
                  <option value="GBP">🇬🇧 £ (GBP)</option>
                  <option value="SAR">🇸🇦 ﷼ (SAR)</option>
                </select>
              </div>
            )}

            {/* Mobile Search Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="sm:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Rechercher"
              aria-label="Rechercher"
            >
              <Search size={16} />
            </button>

            {/* Physical USB Hardware Button (WebHID) */}
            {canUseUsb && (
              <button
                type="button"
                onClick={handlePhysicalUsbClick}
                disabled={isRequestingUsb}
                className={`w-9 h-9 sm:w-auto sm:min-h-[36px] px-0 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center sm:gap-1.5 transition-all cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  usbStatus === 'connected'
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border-emerald-700 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                }`}
                title={
                  usbStatus === 'connected'
                    ? `Encodeur USB proUSB connecté (${usbDevice?.productName || 'USB HID'}) - Gérer`
                    : "Encodeur USB proUSB - Cliquez pour autoriser WebHID"
                }
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {usbStatus === 'connected' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      usbStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                    }`}
                  ></span>
                </span>
                <Usb
                  size={15}
                  className={`shrink-0 ${
                    usbStatus === 'connected'
                      ? 'text-white sm:text-emerald-100'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
                <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">
                  USB{usbStatus === 'connected' ? ' • Prêt' : ''}
                </span>
              </button>
            )}

            {/* CI/CD Pipeline Badge */}
            {canSeeFinance && (
              <div className="hidden xl:block">
                <PipelineStatusIndicator />
              </div>
            )}

            {/* Primary Action Button: + Nouveau / + New Booking */}
            {canCreateBooking && (
              <button
                type="button"
                onClick={() => {
                  setNewBookingInitialSlot(null);
                  setIsNewBookingModalOpen(true);
                }}
                className="w-9 h-9 sm:w-auto sm:min-h-[36px] sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center sm:gap-1.5 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Créer une nouvelle réservation ou séjour"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span className="hidden sm:inline text-xs">
                  {language === 'fr' ? 'Nouveau' : language === 'ar' ? 'حجز جديد' : 'New Booking'}
                </span>
              </button>
            )}

            {/* More Menu ("...") */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Options, Rôles & Outils"
                aria-label="Options"
              >
                <MoreVertical size={16} />
              </button>

              {isMoreMenuOpen && (
                <div
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  className={`absolute top-full mt-2 w-72 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 z-[1000] text-xs space-y-3 animate-in fade-in zoom-in-95 ${
                    language === 'ar' ? 'left-0 right-auto' : 'right-0 left-auto'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {language === 'fr' ? 'Préférences & Rôles' : language === 'ar' ? 'التفضيلات والأدوار' : 'Preferences & Roles'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Mobile Role Switcher in More Menu */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      {language === 'fr' ? 'Rôle Actif :' : language === 'ar' ? 'الدور النشط:' : 'Active Role:'}
                    </span>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      {[
                        { id: 'admin', label: 'Admin' },
                        { id: 'manager', label: language === 'fr' ? 'Gérant' : 'Manager' },
                        { id: 'receptionist', label: language === 'fr' ? 'Réception' : 'Reception' },
                        { id: 'staff', label: language === 'fr' ? 'Équipe' : 'Staff' },
                        { id: 'client', label: language === 'fr' ? 'Client (Pass)' : 'Guest' },
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setCurrentRole(r.id as any);
                            setIsMoreMenuOpen(false);
                          }}
                          className={`px-2 py-1.5 text-[11px] rounded-lg font-semibold transition-colors text-left cursor-pointer ${
                            currentRole === r.id
                              ? 'bg-blue-600 text-white font-bold shadow-2xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency Switcher */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      {language === 'fr' ? 'Devise de facturation :' : 'Currency:'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {['DA', 'EUR', 'USD', 'RMB', 'GBP', 'SAR'].map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => setCurrency(curr)}
                          className={`py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                            currency === curr || (curr === 'DA' && currency === 'DZD')
                              ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language Switcher */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      {language === 'fr' ? 'Langue :' : language === 'ar' ? 'اللغة:' : 'Language:'}
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['fr', 'en', 'ar'] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setLanguage(lang)}
                          aria-pressed={language === lang}
                          className={`py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                            language === lang
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Mode Switch */}
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-semibold cursor-pointer border border-slate-200/80 dark:border-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      {theme === 'dark' ? <Moon size={15} className="text-indigo-400" /> : <Sun size={15} className="text-amber-500" />}
                      <span>{theme === 'dark' ? 'Mode Sombre' : 'Mode Clair'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Basculer</span>
                  </button>

                  {/* Offline Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsOffline(!isOffline)}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded-xl font-semibold cursor-pointer border transition-colors ${
                      isOffline
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isOffline ? <WifiOff size={15} className="text-amber-600" /> : <Wifi size={15} className="text-emerald-500" />}
                      <span>Mode Hors-Ligne</span>
                    </span>
                    <span className="text-[10px] font-bold">{isOffline ? 'ACTIF' : 'OFF'}</span>
                  </button>

                  {/* QR Pass / Scanner */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    {currentRole === 'client' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const profileEmail = clientProfile.email.trim().toLowerCase();
                          const clientBookings = bookings
                            .filter(
                              (booking) =>
                                booking.sector === currentDomain &&
                                profileEmail.length > 0 &&
                                booking.guestEmail.trim().toLowerCase() === profileEmail &&
                                booking.status !== 'cancelled' &&
                                booking.status !== 'checked_out'
                            )
                            .sort((a, b) => a.startDate.localeCompare(b.startDate));
                          const nextBooking = clientBookings[0] || null;
                          if (nextBooking) {
                            setActiveQrPassBooking(nextBooking);
                            setQuickActionNotice(null);
                          } else {
                            setQuickActionNotice(
                              language === 'fr'
                                ? 'Aucun séjour actif ou à venir ne correspond à votre profil client.'
                                : language === 'ar'
                                ? 'لا توجد إقامة حالية أو قادمة مرتبطة بملفك.'
                                : 'No active or upcoming stay matches your client profile.'
                            );
                          }
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        <QrCode size={15} />
                        <span>Mon Pass QR Code</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsQrScannerOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        <Camera size={15} />
                        <span>Scanner QR Pass Client</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Input Drawer (Only opens when search icon is clicked on mobile) */}
        {isMobileSearchOpen && (
          <div className="sm:hidden w-full pt-1 pb-0.5 animate-in slide-in-from-top-1 duration-150">
            <div className="relative w-full">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'fr' ? 'Recherche rapide de chambre ou client...' : language === 'ar' ? 'بحث سريع عن غرفة أو نزيل...' : 'Quick search room or guest...'}
                className="w-full h-9 pl-8 pr-16 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsMobileSearchOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Desktop Secondary toolbar row (Search & Date range navigation) */}
        <div className={`hidden sm:flex w-full min-w-0 items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-2 ${activeView === 'planning' ? '' : 'sm:hidden'}`}>
          {/* Desktop Search */}
          <div className="relative min-w-[180px] max-w-[260px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'fr' ? 'Rechercher...' : language === 'ar' ? 'بحث...' : 'Search...'}
              className="w-full h-8 pl-8 pr-7 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full"
                title="Effacer la recherche"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Desktop Date Navigation & Range */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => shiftDays(-1)}
                className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Jour précédent"
                aria-label="Jour précédent"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="px-2.5 text-center">
                <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap block">
                  {formatDateDisplay(currentBaseDate)} - {endDateFormatted}
                </span>
              </div>
              <button
                type="button"
                onClick={() => shiftDays(1)}
                className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Jour suivant"
                aria-label="Jour suivant"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDateRangeMode('two_weeks')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-bold ${
                  dateRangeMode === 'two_weeks'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                14J
              </button>
              <button
                type="button"
                onClick={() => setDateRangeMode('one_month')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-bold ${
                  dateRangeMode === 'one_month'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                1M
              </button>
            </div>
          </div>
        </div>
      </header>

      {quickActionNotice && (
        <div role="status" className="bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-100 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs flex items-center justify-between gap-3">
          <span>{quickActionNotice}</span>
          <button type="button" onClick={() => setQuickActionNotice(null)} aria-label="Fermer" className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900"><X size={14} /></button>
        </div>
      )}

      {/* Ephemeral USB Banner Alert if browser permission needed */}
      {usbNotice && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs flex items-center justify-between animate-in slide-in-from-top z-30 shadow-md">
          <div className="flex items-center gap-2">
            <Usb size={16} className="shrink-0 animate-pulse" />
            <span className="font-medium">{usbNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setUsbNotice(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
};
