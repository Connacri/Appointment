import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  Filter,
  QrCode,
  Camera,
  Usb,
  MoreVertical,
  X,
  Bell,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
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
  } = useApp();

  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [usbDevice, setUsbDevice] = useState<UsbDeviceInfo | null>(lockManager.getDeviceInfo());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
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
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2 sm:px-4 gap-1.5 sm:gap-2 z-20 shrink-0 select-none">
      {/* ======================================================== */}
      {/* ZONE GAUCHE : Recherche et Filtre Secteur fluide          */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1.5 shrink min-w-0 max-w-[140px] sm:max-w-[200px] md:max-w-xs">
        <div className="relative flex-1 min-w-0">
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
                ? 'Rechercher...'
                : language === 'ar'
                ? 'بحث...'
                : 'Search...'
            }
            className="w-full h-8 sm:h-9 pl-8 pr-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
          />
        </div>

        {/* Sector Quick Pills (Desktop XL only to avoid crowding) */}
        <div className="hidden 2xl:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setActiveSector('all')}
            className={`px-2 py-0.5 font-medium rounded transition-colors ${
              activeSector === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {getTranslation('sectorAll', language)}
          </button>
          <button
            onClick={() => setActiveSector('hotel')}
            className={`px-2 py-0.5 font-medium rounded transition-colors ${
              activeSector === 'hotel'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Hôtel
          </button>
          <button
            onClick={() => setActiveSector('clinic')}
            className={`px-2 py-0.5 font-medium rounded transition-colors ${
              activeSector === 'clinic'
                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Clinique
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ZONE CENTRALE : Navigation Date & Échelle 14J / 1M       */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => shiftDays(-14)}
            className="hidden sm:inline-flex p-1 text-slate-500 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Reculer de 2 semaines"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => shiftDays(-1)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Jour précédent"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="px-1.5 sm:px-2 text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
            {formatDateDisplay(currentBaseDate)} - {endDateFormatted}
          </span>

          <button
            onClick={() => shiftDays(1)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Jour suivant"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => shiftDays(14)}
            className="hidden sm:inline-flex p-1 text-slate-500 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Avancer de 2 semaines"
          >
            <ChevronsRight size={14} />
          </button>
        </div>

        {/* 14 Jours / 1 Mois pills */}
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setDateRangeMode('two_weeks')}
            className={`px-2 py-0.5 font-medium rounded transition-colors text-[11px] ${
              dateRangeMode === 'two_weeks'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            14J
          </button>
          <button
            onClick={() => setDateRangeMode('one_month')}
            className={`px-2 py-0.5 font-medium rounded transition-colors text-[11px] ${
              dateRangeMode === 'one_month'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            1M
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ZONE DROITE : USB Physique WebHID, CI Pipeline, Actions   */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* ProUSB Physical USB Hardware Visual Indicator */}
        <button
          onClick={() => setActiveView('prousb')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
            usbStatus === 'connected'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : usbStatus === 'connecting'
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 animate-pulse'
              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
          title={
            usbStatus === 'connected'
              ? `ProUSB Encodeur : Connecté via WebHID (${usbDevice?.productName || 'USB HID'}) - Cliquez pour gérer`
              : usbStatus === 'connecting'
              ? 'ProUSB : Connexion WebHID en cours...'
              : 'ProUSB : Déconnecté - Cliquez pour initialiser le matériel USB'
          }
        >
          <span className="relative flex h-2 w-2">
            {usbStatus === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                usbStatus === 'connected'
                  ? 'bg-emerald-500'
                  : usbStatus === 'connecting'
                  ? 'bg-blue-500'
                  : 'bg-rose-500'
              }`}
            ></span>
          </span>

          <Usb size={14} className={usbStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />

          <span className="hidden lg:inline text-[11px] font-bold">
            {usbStatus === 'connected' ? 'USB ProUSB' : 'USB Off'}
          </span>
        </button>

        {/* CI/CD GitHub Actions Pipeline Status Indicator */}
        <PipelineStatusIndicator />

        {/* Currency Switcher (compact) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-semibold">
          <select
            value={currency === 'DZD' ? 'DA' : currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-100 font-bold px-1 py-0.5 rounded cursor-pointer focus:outline-none text-[11px]"
            title="Devise"
          >
            <option value="DA">🇩🇿 DA</option>
            <option value="EUR">🇪🇺 €</option>
            <option value="USD">🇺🇸 $</option>
            <option value="RMB">🇨🇳 ¥</option>
            <option value="GBP">🇬🇧 £</option>
            <option value="SAR">🇸🇦 ﷼</option>
          </select>
        </div>

        {/* Desktop Quick Icons: Alerts, Theme, Language */}
        <div className="hidden xl:flex items-center gap-1.5">
          {/* Alerts count */}
          {(urgentTasksCount > 0 || lowStockCount > 0) && (
            <button
              onClick={() => setActiveView(urgentTasksCount > 0 ? 'tasks' : 'stock')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold cursor-pointer"
              title="Alertes PMS"
            >
              <Bell size={13} />
              <span className="font-mono text-[11px]">{urgentTasksCount + lowStockCount}</span>
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            title="Thème Clair / Sombre"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Language selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-semibold">
            {(['fr', 'en', 'ar'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-1.5 py-0.5 rounded uppercase transition-colors text-[10px] ${
                  language === lang
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Button: + Nouveau / + New Booking */}
        <button
          onClick={() => {
            setNewBookingInitialSlot(null);
            setIsNewBookingModalOpen(true);
          }}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          title="Créer une nouvelle réservation ou rendez-vous"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">
            {language === 'fr'
              ? 'Nouveau'
              : language === 'ar'
              ? 'حجز جديد'
              : 'New Booking'}
          </span>
        </button>

        {/* Responsive Overflow Dropdown Menu (for smaller screens) */}
        <div className="relative xl:hidden" ref={moreMenuRef}>
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            title="Options supplémentaires"
          >
            <MoreVertical size={16} />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Options & Contrôles
                </span>
                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Language selection in menu */}
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Langue :</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['fr', 'en', 'ar'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`py-1 rounded text-center font-bold uppercase ${
                        language === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme toggle in menu */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center justify-between py-1.5 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-semibold"
              >
                <span>Thème d'affichage</span>
                {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
              </button>

              {/* Offline mode toggle */}
              <button
                onClick={() => setIsOffline(!isOffline)}
                className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg font-semibold ${
                  isOffline
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Mode Hors-Ligne</span>
                {isOffline ? <WifiOff size={15} /> : <Wifi size={15} />}
              </button>

              {/* QR action in menu */}
              {currentRole === 'client' ? (
                <button
                  onClick={() => {
                    const latest = bookings[0] || null;
                    if (latest) setActiveQrPassBooking(latest);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 py-1.5 px-2 bg-blue-600 text-white font-bold rounded-lg"
                >
                  <QrCode size={15} />
                  <span>Mon Pass QR Code</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsQrScannerOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 py-1.5 px-2 bg-blue-600 text-white font-bold rounded-lg"
                >
                  <Camera size={15} />
                  <span>Scanner QR Client</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
