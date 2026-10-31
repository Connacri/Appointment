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
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { playSuccessFeedback } from '../utils/audioFeedback';
import { PipelineStatusIndicator } from './PipelineStatusIndicator';
import {
  lockManager,
  UsbConnectionStatus,
  UsbDeviceInfo,
} from '../locks/lockManager';

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
    currentRole,
    setIsQrScannerOpen,
    setActiveQrPassBooking,
    bookings,
    currency,
    setCurrency,
    tasks,
    stockItems,
    setActiveView,
    isSidebarMobileOpen,
    setIsSidebarMobileOpen,
    isSoundEnabled,
    toggleSound,
  } = useApp();

  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [usbDevice, setUsbDevice] = useState<UsbDeviceInfo | null>(lockManager.getDeviceInfo());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [usbNotice, setUsbNotice] = useState<string | null>(null);
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
      <header className="min-h-14 py-1.5 px-2.5 sm:px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 z-20 shrink-0 select-none shadow-xs">
        {/* ======================================================== */}
        {/* SECTION GAUCHE : Menu Mobile, Recherche, Secteur         */}
        {/* ======================================================== */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Mobile Sidebar Hamburger Toggle (Touch target >= 44px) */}
          <button
            type="button"
            onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Ouvrir le menu de navigation"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>

          {/* Search Box - Fluid & Touch Friendly */}
          <div className="relative min-w-[120px] max-w-[240px] sm:max-w-[280px]">
            <Search
              size={15}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'fr'
                  ? 'Recherche...'
                  : language === 'ar'
                  ? 'بحث...'
                  : 'Search...'
              }
              className="w-full h-9 pl-8 pr-7 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium truncate"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full"
                title="Effacer la recherche"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sector Pill Switcher: Hotel / Resort (Hidden on small mobile to avoid crowding) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveSector('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeSector === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setActiveSector('hotel')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                activeSector === 'hotel'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Hotel size={13} />
              <span>Hôtel</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSector('resort')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                activeSector === 'resort'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Palmtree size={13} />
              <span>Resort</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION CENTRALE : Date & Mode 14J / 1M                   */}
        {/* ======================================================== */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => shiftDays(-1)}
              className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Jour précédent"
              aria-label="Jour précédent"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="px-2 sm:px-3 text-center">
              <span className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap block">
                {formatDateDisplay(currentBaseDate)} - {endDateFormatted}
              </span>
            </div>

            <button
              type="button"
              onClick={() => shiftDays(1)}
              className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Jour suivant"
              aria-label="Jour suivant"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* 14J / 1M Segment */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 text-xs font-semibold">
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

        {/* ======================================================== */}
        {/* SECTION DROITE : USB Physique, CI Pipeline, + Nouveau    */}
        {/* ======================================================== */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* PROMINENT USB PHYSIQUE (WebHID) BUTTON */}
          <button
            type="button"
            onClick={handlePhysicalUsbClick}
            disabled={isRequestingUsb}
            className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500 ${
              usbStatus === 'connected'
                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 dark:hover:bg-amber-900/70 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
            }`}
            title={
              usbStatus === 'connected'
                ? `Encodeur USB proUSB connecté (${usbDevice?.productName || 'USB HID'}) - Cliquez pour gérer`
                : "Encodeur USB non connecté - Cliquez pour demander l'autorisation WebHID au navigateur"
            }
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {usbStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  usbStatus === 'connected'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500 animate-pulse'
                }`}
              ></span>
            </span>

            <Usb
              size={15}
              className={
                usbStatus === 'connected'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }
            />

            <span className="text-[11px] sm:text-xs font-bold whitespace-nowrap">
              {usbStatus === 'connected' ? (
                <span>USB Physique <span className="hidden sm:inline font-normal text-emerald-700 dark:text-emerald-300">• Prêt</span></span>
              ) : (
                <span>USB Physique <span className="hidden md:inline font-normal text-amber-700 dark:text-amber-300">(Activer)</span></span>
              )}
            </span>
          </button>

          {/* CI/CD Pipeline Status Badge (GitHub Actions) */}
          <div className="hidden sm:block">
            <PipelineStatusIndicator />
          </div>

          {/* Currency Dropdown */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-1">
            <select
              value={currency === 'DZD' ? 'DA' : currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-100 font-bold cursor-pointer focus:outline-none text-xs"
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

          {/* Primary Action Button: + Nouveau / + New Booking (Touch target >= 44px) */}
          <button
            type="button"
            onClick={() => {
              setNewBookingInitialSlot(null);
              setIsNewBookingModalOpen(true);
            }}
            className="min-h-[38px] px-3 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            title="Créer une nouvelle réservation ou séjour"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">
              {language === 'fr'
                ? 'Nouveau'
                : language === 'ar'
                ? 'حجز جديد'
                : 'New Booking'}
            </span>
          </button>

          {/* Quick Menu ("...") for overflow items */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Options & Paramètres rapides"
              aria-label="Options"
            >
              <MoreVertical size={16} />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 z-[100] text-xs space-y-3.5 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    Préférences & Outils
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Language Switcher */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                    Langue / Language / اللغة :
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['fr', 'en', 'ar'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all cursor-pointer ${
                          language === lang
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
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

                {/* Sector Switcher on mobile */}
                <div className="lg:hidden pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Secteur Actif :</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSector('hotel');
                        setIsMoreMenuOpen(false);
                      }}
                      className={`p-1.5 rounded-lg flex items-center justify-center gap-1 font-semibold ${
                        activeSector === 'hotel'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Hotel size={13} /> Hôtel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSector('resort');
                        setIsMoreMenuOpen(false);
                      }}
                      className={`p-1.5 rounded-lg flex items-center justify-center gap-1 font-semibold ${
                        activeSector === 'resort'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Palmtree size={13} /> Resort
                    </button>
                  </div>
                </div>

                {/* QR Pass / Scanner */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {currentRole === 'client' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const latest = bookings[0] || null;
                        if (latest) setActiveQrPassBooking(latest);
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
      </header>

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
