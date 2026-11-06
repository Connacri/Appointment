import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Plus,
  Usb,
  MoreVertical,
  X,
  Hotel,
  Palmtree,
  Crown,
  Shield,
  Briefcase,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Database,
  FileCode,
  FileText,
  Info,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { lockManager, UsbConnectionStatus, UsbDeviceInfo } from '../locks/lockManager';
import { indexedDb, IndexedDbSyncState } from '../db/indexedDb';
import { UserRole } from '../types/booking';

export const TopBar: React.FC = () => {
  const {
    language,
    searchQuery,
    setSearchQuery,
    currentDomain,
    setCurrentDomain,
    currentRole,
    setCurrentRole,
    setIsNewBookingModalOpen,
    setNewBookingInitialSlot,
    setIsSidebarMobileOpen,
    isSidebarMobileOpen,
    isSoundEnabled,
    toggleSound,
    setIsEstablishmentModalOpen,
    setIsIndexedDBOpen,
    setIsCockpitOpen,
    setIsLegalModalOpen,
    setIsAboutModalOpen,
    setActiveView,
    currency,
    setCurrency,
  } = useApp();
  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [usbDevice, setUsbDevice] = useState<UsbDeviceInfo | null>(() => lockManager.getDeviceInfo());
  const [indexedDbSync, setIndexedDBSync] = useState<IndexedDbSyncState>(indexedDb.getSyncStatus());

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isSectorMenuOpen, setIsSectorMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem('pms_operator_name') || 'Réception');
  const [operatorPin, setOperatorPin] = useState('');
  const [isOperatorAuthenticated, setIsOperatorAuthenticated] = useState(() => localStorage.getItem('pms_operator_auth') !== 'false');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [usbNotice, setUsbNotice] = useState<string | null>(null);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const sectorMenuRef = useRef<HTMLDivElement>(null);

  // Subscribe to USB connection status
  useEffect(() => {
    const unsub = lockManager.subscribeConnection((st, device) => {
      setUsbStatus(st);
      setUsbDevice(device);
    });
    return unsub;
  }, []);

  // Subscribe to real-time IndexedDB sync state
  useEffect(() => {
    const unsub = indexedDb.subscribeSyncStatus((status) => {
      setIndexedDBSync(status);
    });
    return unsub;
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setIsRoleMenuOpen(false);
      }
      if (sectorMenuRef.current && !sectorMenuRef.current.contains(e.target as Node)) {
        setIsSectorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Physical USB WebHID connect handler
  const handlePhysicalUsbClick = async () => {
    if (usbStatus === 'connected') {
      setActiveView('prousb');
      return;
    }

    if (typeof navigator === 'undefined' || !('hid' in navigator)) {
      setUsbNotice(
        language === 'fr'
          ? 'Votre navigateur ne supporte pas WebHID (utilisez Google Chrome ou Microsoft Edge).'
          : language === 'ar'
          ? 'متصفحك لا يدعم WebHID (يرجى استخدام Google Chrome أو Microsoft Edge).'
          : 'Your browser does not support WebHID (please use Google Chrome or Microsoft Edge).'
      );
      setTimeout(() => setUsbNotice(null), 4000);
      return;
    }

    try {
      await lockManager.requestPhysicalUsbDevice();
      setUsbNotice(
        language === 'fr'
          ? 'Encodeur proUSB connecté avec succès !'
          : language === 'ar'
          ? 'تم توصيل جهاز تشفير proUSB بنجاح!'
          : 'proUSB encoder connected successfully!'
      );
      setTimeout(() => setUsbNotice(null), 3000);
      setActiveView('prousb');
    } catch (err: any) {
      console.warn('[TopBar] WebHID error:', err);
      setUsbNotice(
        language === 'fr'
          ? "Sélectionnez l'encodeur proUSB dans la boîte de dialogue."
          : language === 'ar'
          ? 'يرجى تحديد جهاز proUSB من نافذة الإذن.'
          : 'Please select the proUSB encoder in the permissions dialog.'
      );
      setTimeout(() => setUsbNotice(null), 3500);
    }
  };

  const roleDefinitions: { id: UserRole; label: { fr: string; en: string; ar: string }; icon: any }[] = [
    { id: 'admin', label: { fr: 'Administrateur', en: 'Administrator', ar: 'مدير النظام' }, icon: Crown },
    { id: 'manager', label: { fr: 'Gérant', en: 'General Manager', ar: 'المدير العام' }, icon: Shield },
    { id: 'receptionist', label: { fr: 'Réception', en: 'Reception', ar: 'الاستقبال' }, icon: Briefcase },
    { id: 'staff', label: { fr: 'Étage', en: 'Staff', ar: 'طاقم العمل' }, icon: UserCheck },
    { id: 'client', label: { fr: 'Client', en: 'Guest', ar: 'النزيل' }, icon: Users },
  ];

  const currentRoleObj = roleDefinitions.find((r) => r.id === currentRole) || roleDefinitions[0];
  const CurrentRoleIcon = currentRoleObj.icon;

  const isRtl = language === 'ar';

  return (
    <header className="pms-app-topbar pms-material-bar pms-material-edge w-full border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 px-2 sm:px-3 py-1.5 flex flex-nowrap items-center justify-between gap-1 sm:gap-2 shrink-0 select-none z-40 relative transition-colors duration-200 overflow-x-auto [scrollbar-width:none]">
      {/* Dynamic theme accent strip along top edge */}
      <div className="pms-theme-strip absolute top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none" />
      {/* Toast notice for USB or status */}
      {usbNotice && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs shadow-xl z-50 pms-toast flex items-center gap-2">
          <Info size={14} className="text-cyan-400" />
          <span>{usbNotice}</span>
        </div>
      )}

      {/* LEFT SECTION: Mobile hamburger, Sector dropdown, Role selector */}
      <div className="pms-app-topbar-left flex items-center gap-1 sm:gap-2 min-w-0 shrink-0">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors shrink-0"
          aria-label={language === 'fr' ? 'Menu' : language === 'ar' ? 'القائمة' : 'Menu'}
        >
          <Menu size={16} />
        </button>

        {/* SECTEUR label */}
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 hidden xl:inline">
          {language === 'fr' ? 'SECTEUR :' : language === 'ar' ? 'القطاع :' : 'SECTOR :'}
        </span>

        {/* Sector: Dropdown Menu (Hôtel / Resort) */}
        <div className="relative shrink-0" ref={sectorMenuRef}>
          <button
            type="button"
            onClick={() => setIsSectorMenuOpen(!isSectorMenuOpen)}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm transition-colors shrink-0"
            title={language === 'fr' ? 'Secteur d’activité (Hôtel / Resort)' : language === 'ar' ? 'قطاع النشاط (فندق / منتجع)' : 'Business Sector'}
          >
            {currentDomain === 'hotel' ? (
              <Hotel size={14} className="text-amber-300 shrink-0" />
            ) : (
              <Palmtree size={14} className="text-amber-300 shrink-0" />
            )}
            <span className="truncate max-w-[90px] sm:max-w-none hidden lg:inline">
              {currentDomain === 'hotel'
                ? (language === 'fr' ? 'Hôtel' : language === 'ar' ? 'فندق' : 'Hotel')
                : (language === 'fr' ? 'Resort' : language === 'ar' ? 'منتجع' : 'Resort')}
            </span>
            <ChevronDown size={13} className="text-white/80 shrink-0" />
          </button>

          {isSectorMenuOpen && (
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="absolute top-full mt-1.5 left-0 rtl:left-auto rtl:right-0 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs pms-dropdown"
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                {language === 'fr' ? 'Sélectionnez un secteur' : language === 'ar' ? 'اختر القطاع' : 'Select sector'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCurrentDomain('hotel');
                  setIsSectorMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left rtl:text-right transition-colors cursor-pointer ${
                  currentDomain === 'hotel'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Hotel size={14} className={currentDomain === 'hotel' ? 'text-amber-300' : 'text-slate-500'} />
                <span className="flex-1">{language === 'fr' ? 'Hôtel & Chambres' : language === 'ar' ? 'فندق وغرف' : 'Hotel & Rooms'}</span>
                {currentDomain === 'hotel' && <CheckCircle2 size={13} className="text-white ml-auto rtl:ml-0 rtl:mr-auto" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentDomain('resort');
                  setIsSectorMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left rtl:text-right transition-colors cursor-pointer ${
                  currentDomain === 'resort'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Palmtree size={14} className={currentDomain === 'resort' ? 'text-amber-300' : 'text-slate-500'} />
                <span className="flex-1">{language === 'fr' ? 'Resort & Complexe' : language === 'ar' ? 'منتجع ومجمع' : 'Resort & Complex'}</span>
                {currentDomain === 'resort' && <CheckCircle2 size={13} className="text-white ml-auto rtl:ml-0 rtl:mr-auto" />}
              </button>
            </div>
          )}
        </div>

        {/* RÔLE ACTIF label */}
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 ml-1 hidden xl:inline">
          {language === 'fr' ? 'RÔLE ACTIF :' : language === 'ar' ? 'الدور النشط :' : 'ACTIVE ROLE :'}
        </span>

        {/* Role dropdown button */}
        <div className="relative shrink-0" ref={roleMenuRef}>
          <button
            type="button"
            onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm transition-colors shrink-0"
            title={language === 'fr' ? 'Changer de rôle actif' : language === 'ar' ? 'تغيير الدور النشط' : 'Change active role'}
          >
            <CurrentRoleIcon size={14} className="text-amber-300 shrink-0" />
            <span className="truncate max-w-[90px] sm:max-w-none hidden lg:inline">
              {currentRoleObj.label[language] || currentRoleObj.label.fr}
            </span>
            <ChevronDown size={13} className="text-white/80 shrink-0" />
          </button>

          {isRoleMenuOpen && (
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="absolute top-full mt-1.5 left-0 rtl:left-auto rtl:right-0 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs pms-dropdown"
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                {language === 'fr' ? 'Sélectionnez un rôle' : language === 'ar' ? 'اختر الدور' : 'Select a role'}
              </div>
              {roleDefinitions.map((role) => {
                const IconComponent = role.icon;
                const isSelected = currentRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setCurrentRole(role.id);
                      setIsRoleMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left rtl:text-right transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <IconComponent size={14} className={isSelected ? 'text-amber-300' : 'text-slate-500 dark:text-slate-400'} />
                    <span className="flex-1">{role.label[language] || role.label.fr}</span>
                    {isSelected && <CheckCircle2 size={13} className="text-white ml-auto rtl:ml-0 rtl:mr-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CENTER SECTION: Global search (reduced width for tablet & mobile) */}
      <div className="pms-app-topbar-search flex-1 min-w-[70px] max-w-[120px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[220px] xl:max-w-[280px] relative flex items-center">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={13} className="absolute left-2 rtl:left-auto rtl:right-2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'fr' ? 'Rechercher...' : language === 'ar' ? 'بحث...' : 'Search...'}
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs pl-7 pr-6 rtl:pl-6 rtl:pr-7 py-1 rounded-lg border border-slate-300 dark:border-slate-700 shadow-inner focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 rtl:right-auto rtl:left-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={language === 'fr' ? 'Effacer la recherche' : language === 'ar' ? 'مسح البحث' : 'Clear search'}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Auth, Local Storage, USB, Currency, + Nouveau, More ⋮ all inline on one row */}
      <div className="pms-app-topbar-actions flex flex-nowrap items-center gap-1 sm:gap-1.5 shrink-0">
        {/* User / Operator Authentication button */}
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className={`h-8 px-2 sm:px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 ${
            isOperatorAuthenticated
              ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
          }`}
          title={`${language === 'fr' ? 'Session Utilisateur / Opérateur :' : language === 'ar' ? 'جلسة المشغل :' : 'Operator Session:'} ${operatorName} (${currentRoleObj.label[language] || currentRole}) — ${language === 'fr' ? 'Cliquer pour vous authentifier' : language === 'ar' ? 'اضغط لإدارة الحساب' : 'Click to authenticate'}`}
          aria-label={language === 'fr' ? 'Connexion Opérateur' : language === 'ar' ? 'دخول المشغل' : 'Operator Login'}
        >
          <UserCheck size={14} className={isOperatorAuthenticated ? 'text-emerald-600 dark:text-emerald-400 shrink-0' : 'text-blue-600 dark:text-blue-400 shrink-0'} />
          <span className="hidden lg:inline font-bold">
            {isOperatorAuthenticated ? operatorName : (language === 'fr' ? 'Connexion' : language === 'ar' ? 'دخول' : 'Login')}
          </span>
        </button>

        {/* Local database activity indicator */}
        <button
          type="button"
          onClick={() => setIsIndexedDBOpen(true)}
          className={`h-8 px-2 sm:px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
            indexedDbSync === 'synced'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
              : indexedDbSync === 'syncing'
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
          }`}
          title={`${
            language === 'fr' ? 'Stockage local' : language === 'ar' ? 'التخزين المحلي' : 'Local storage'
          }: ${
            indexedDbSync === 'synced'
              ? (language === 'fr' ? 'Disponible' : language === 'ar' ? 'متاح ومؤمّن' : 'Available')
              : indexedDbSync === 'syncing'
              ? (language === 'fr' ? 'Écriture locale en cours...' : language === 'ar' ? 'جارٍ الحفظ محلياً...' : 'Writing...')
              : (language === 'fr' ? 'Mode hors ligne' : language === 'ar' ? 'وضع غير متصل' : 'Offline mode')
          } — ${language === 'fr' ? 'Cliquer pour consulter' : language === 'ar' ? 'اضغط للمعاينة' : 'Click to inspect'}`}
        >
          <Database size={13} className={indexedDbSync === 'synced' ? 'text-emerald-600 dark:text-emerald-300' : indexedDbSync === 'syncing' ? 'text-blue-600 dark:text-blue-300' : 'text-rose-600 dark:text-rose-300'} />
          <span className={`w-2 h-2 rounded-full ${indexedDbSync === 'synced' ? 'bg-emerald-500 animate-pulse' : indexedDbSync === 'syncing' ? 'bg-blue-500 animate-spin' : 'bg-rose-500'}`} />
          <span className="hidden lg:inline">{language === 'fr' ? 'Local' : language === 'ar' ? 'محلي' : 'Local'}</span>
        </button>

        {/* USB Hardware Button */}
        <button
          type="button"
          onClick={handlePhysicalUsbClick}
          className={`h-8 px-2 sm:px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs shrink-0 ${
            usbStatus === 'connected'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-rose-50 dark:bg-rose-950/80 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60'
          }`}
          title={
            usbStatus === 'connected'
              ? (language === 'fr'
                  ? `Encodeur USB proUSB connecté${usbDevice?.machineCode ? ` — machine code ${usbDevice.machineCode}` : ''}`
                  : language === 'ar'
                  ? `جهاز تشفير proUSB متصل${usbDevice?.machineCode ? ` — الرمز ${usbDevice.machineCode}` : ''}`
                  : `proUSB encoder connected${usbDevice?.machineCode ? ` — machine code ${usbDevice.machineCode}` : ''}`)
              : (language === 'fr'
                  ? 'Encodeur USB proUSB — Cliquez pour autoriser WebHID'
                  : language === 'ar'
                  ? 'جهاز تشفير proUSB — اضغط للسماح بـ WebHID'
                  : 'proUSB USB encoder — Click to authorize WebHID')
          }
        >
          <span className="relative flex h-2 w-2">
            {usbStatus === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                usbStatus === 'connected' ? 'bg-white' : 'bg-rose-500'
              }`}
            />
          </span>
          <Usb size={14} />
          <span className="whitespace-nowrap hidden lg:inline">
            USB • {usbStatus === 'connected' ? (usbDevice?.readerLabel ?? (language === 'fr' ? 'Prêt' : language === 'ar' ? 'جاهز' : 'Ready')) : (language === 'fr' ? 'Connecter' : language === 'ar' ? 'اتصال' : 'Connect')}
          </span>
        </button>

        {/* Global Currency Switcher */}
        <div className="pms-app-topbar-currency h-8 flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-lg px-1.5 sm:px-2 text-[11px] sm:text-xs font-mono font-bold text-amber-600 dark:text-amber-400 shadow-2xs shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1 rtl:mr-0 rtl:ml-1 font-sans hidden xl:inline">
            {language === 'fr' ? 'Devise:' : language === 'ar' ? 'العملة:' : 'Currency:'}
          </span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-transparent text-amber-600 dark:text-amber-400 font-bold focus:outline-none cursor-pointer"
            title={language === 'fr' ? "Changer la devise globale de l'établissement" : language === 'ar' ? 'تغيير العملة العامة للمنشأة' : 'Change establishment global currency'}
          >
            <option value="DZD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇩🇿 DZD (DA)</option>
            <option value="DA" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇩🇿 DA</option>
            <option value="EUR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇪🇺 EUR (€)</option>
            <option value="USD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇺🇸 USD ($)</option>
            <option value="GBP" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇬🇧 GBP (£)</option>
            <option value="SAR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇸🇦 SAR (﷼)</option>
            <option value="RMB" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇨🇳 RMB (¥)</option>
            <option value="CAD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🇨🇦 CAD ($)</option>
          </select>
        </div>

        {/* Primary Action Button: + Nouveau */}
        <button
          type="button"
          onClick={() => {
            setNewBookingInitialSlot(null);
            setIsNewBookingModalOpen(true);
          }}
          className="h-8 px-2 sm:px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
          title={language === 'fr' ? 'Créer une nouvelle réservation' : language === 'ar' ? 'إنشاء حجز جديد' : 'Create new booking'}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden lg:inline">{language === 'fr' ? 'Nouveau' : language === 'ar' ? 'حجز جديد' : 'New'}</span>
        </button>

        {/* More Menu [⋮] */}
        <div className="relative shrink-0" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
            title={language === 'fr' ? 'Options supplémentaires' : language === 'ar' ? 'خيارات إضافية' : 'More options'}
            aria-label={language === 'fr' ? 'Options' : language === 'ar' ? 'خيارات' : 'Options'}
          >
            <MoreVertical size={16} />
          </button>

          {isMoreMenuOpen && (
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="absolute top-full mt-1.5 right-0 rtl:right-auto rtl:left-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1 pms-dropdown pms-dropdown-end text-slate-700 dark:text-slate-200"
            >
              {/* Audio feedback toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left rtl:text-right"
              >
                {isSoundEnabled ? <Volume2 size={14} className="text-emerald-500 shrink-0" /> : <VolumeX size={14} className="text-slate-400 shrink-0" />}
                <span>
                  {isSoundEnabled
                    ? (language === 'fr' ? 'Bips & Sons : Activés' : language === 'ar' ? 'المؤثرات الصوتية: مفعلة' : 'Sound effects: On')
                    : (language === 'fr' ? 'Bips & Sons : Désactivés' : language === 'ar' ? 'المؤثرات الصوتية: معطلة' : 'Sound effects: Off')}
                </span>
              </button>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 my-1" />

              {/* Establishment Setup */}
              <button
                type="button"
                onClick={() => {
                  setIsEstablishmentModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left rtl:text-right"
              >
                <Sliders size={14} className="text-blue-500 shrink-0" />
                <span>
                  {language === 'fr' ? 'Paramètres Établissement' : language === 'ar' ? 'إعدادات المنشأة' : 'Property Settings'}
                </span>
              </button>

              {/* Local data inspector */}
              <button
                type="button"
                onClick={() => {
                  setIsIndexedDBOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left rtl:text-right"
              >
                <Database size={14} className="text-emerald-500 shrink-0" />
                <span>
                  {language === 'fr' ? 'Inspecteur des données locales' : language === 'ar' ? 'فاحص البيانات المحلية' : 'Local Data Inspector'}
                </span>
              </button>

              {/* CI/CD & AGENTS.md Specs */}
              <button
                type="button"
                onClick={() => {
                  setIsCockpitOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left rtl:text-right"
              >
                <FileCode size={14} className="text-cyan-500 shrink-0" />
                <span>
                  {language === 'fr' ? 'Spécifications AGENTS.md' : language === 'ar' ? 'مواصفات AGENTS.md' : 'AGENTS.md Specifications'}
                </span>
              </button>

              {/* Legal & Privacy */}
              <button
                type="button"
                onClick={() => {
                  setIsLegalModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left rtl:text-right"
              >
                <FileText size={14} className="text-slate-400 shrink-0" />
                <span>
                  {language === 'fr' ? 'Légal & Confidentialité' : language === 'ar' ? 'الخصوصية والشروط' : 'Legal & Privacy'}
                </span>
              </button>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 my-1" />

              {/* À Propos FORSLOG LTD & Développeur S.M. Ramzi Guedouar */}
              <button
                type="button"
                onClick={() => {
                  setIsAboutModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 hover:text-cyan-900 dark:hover:text-cyan-100 transition-colors cursor-pointer font-semibold text-left rtl:text-right"
              >
                <Info size={14} className="text-cyan-500 shrink-0" />
                <span>
                  {language === 'fr'
                    ? '✨ À Propos (FORSLOG & Développeur)'
                    : language === 'ar'
                    ? '✨ حول النظام (FORSLOG والمطور)'
                    : '✨ About (FORSLOG & Developer)'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User / Operator Authentication Modal - Displayed strictly ON TOP of all UI */}
      {isAuthModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsAuthModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5 relative"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ${isOperatorAuthenticated ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' : 'bg-gradient-to-tr from-blue-600 to-indigo-500'}`}>
                  <UserCheck size={22} />
                </div>
                <div>
                  <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {language === 'fr' ? 'Authentification & Session Opérateur' : language === 'ar' ? 'مصادقة وجلسة المشغل' : 'Operator Authentication & Session'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'fr' ? 'Contrôle des accès locaux et profil utilisateur' : language === 'ar' ? 'التحكم في الوصول المحلي وملف المستخدم' : 'Local access control & operator profile'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {authNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{authNotice}</span>
              </div>
            )}

            {/* Current Active Status */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'fr' ? 'Statut de session :' : language === 'ar' ? 'حالة الجلسة:' : 'Session status:'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1.5 ${
                  isOperatorAuthenticated
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isOperatorAuthenticated ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isOperatorAuthenticated
                    ? (language === 'fr' ? 'Opérateur Connecté' : language === 'ar' ? 'المشغل متصل' : 'Operator Logged In')
                    : (language === 'fr' ? 'Session Invité / Non authentifiée' : language === 'ar' ? 'غير مسجل' : 'Guest Session')}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>{language === 'fr' ? 'Rôle actif :' : language === 'ar' ? 'الدور الحالي:' : 'Active role:'}</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {currentRoleObj.label[language] || currentRole}
                </span>
              </div>
            </div>

            {/* Operator Login Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                localStorage.setItem('pms_operator_name', operatorName || 'Réception');
                localStorage.setItem('pms_operator_auth', 'true');
                setIsOperatorAuthenticated(true);
                setAuthNotice(
                  language === 'fr'
                    ? `Authentifié avec succès en tant que ${operatorName || 'Réception'} !`
                    : language === 'ar'
                    ? `تم تسجيل الدخول بنجاح باسم ${operatorName || 'الاستقبال'}!`
                    : `Logged in successfully as ${operatorName || 'Front Desk'}!`
                );
                setTimeout(() => {
                  setAuthNotice(null);
                  setIsAuthModalOpen(false);
                }, 1200);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  {language === 'fr' ? 'Nom ou Matricule Opérateur :' : language === 'ar' ? 'اسم المشغل أو الرقم الوظيفي:' : 'Operator Name or ID:'}
                </label>
                <input
                  type="text"
                  required
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder={language === 'fr' ? 'Ex: Réception Amina / Gérant' : language === 'ar' ? 'مثال: موظف الاستقبال' : 'e.g. Front Desk Amina'}
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  {language === 'fr' ? 'Code PIN rapide (4 chiffres) :' : language === 'ar' ? 'رمز PIN السريع (4 أرقام):' : 'Quick PIN Code (4 digits):'}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={operatorPin}
                  onChange={(e) => setOperatorPin(e.target.value)}
                  placeholder="••••"
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-center tracking-widest text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {language === 'fr' ? 'PIN par défaut : 1234 (facultatif pour la session locale)' : language === 'ar' ? 'رمز PIN الافتراضي: 1234' : 'Default PIN: 1234 (optional for local)'}
                </span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <UserCheck size={15} />
                  <span>{language === 'fr' ? 'Valider & Authentifier' : language === 'ar' ? 'تأكيد وتسجيل الدخول' : 'Sign in & Authenticate'}</span>
                </button>

                {isOperatorAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('pms_operator_auth', 'false');
                      setIsOperatorAuthenticated(false);
                      setCurrentRole('client');
                      setAuthNotice(
                        language === 'fr'
                          ? 'Session déconnectée. Vous êtes en mode invité.'
                          : language === 'ar'
                          ? 'تم قفل الجلسة وتسجيل الخروج.'
                          : 'Logged out. Session locked.'
                      );
                      setTimeout(() => {
                        setAuthNotice(null);
                        setIsAuthModalOpen(false);
                      }, 1000);
                    }}
                    className="h-9 px-3 rounded-xl border border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{language === 'fr' ? 'Verrouiller / Quitter' : language === 'ar' ? 'قفل الجلسة' : 'Lock / Logout'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
