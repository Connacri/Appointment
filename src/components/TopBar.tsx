import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  BookOpen,
  Search,
  Plus,
  Moon,
  Sun,
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
import { lockManager, UsbConnectionStatus } from '../locks/lockManager';
import { indexedDb, IndexedDbSyncState } from '../db/indexedDb';
import { UserRole } from '../types/booking';

export const TopBar: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
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
  const [indexedDbSync, setIndexedDBSync] = useState<IndexedDbSyncState>(indexedDb.getSyncStatus());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [usbNotice, setUsbNotice] = useState<string | null>(null);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Subscribe to USB connection status
  useEffect(() => {
    const unsub = lockManager.subscribeConnection((st) => {
      setUsbStatus(st);
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
      setUsbNotice("Votre navigateur ne supporte pas WebHID (utilisez Google Chrome ou Microsoft Edge).");
      setTimeout(() => setUsbNotice(null), 4000);
      return;
    }

    try {
      await lockManager.requestPhysicalUsbDevice();
      setUsbNotice("Encodeur proUSB connecté avec succès !");
      setTimeout(() => setUsbNotice(null), 3000);
      setActiveView('prousb');
    } catch (err: any) {
      console.warn('[TopBar] WebHID error:', err);
      setUsbNotice("Sélectionnez l'encodeur proUSB dans la boîte de dialogue.");
      setTimeout(() => setUsbNotice(null), 3500);
    }
  };

  const roleDefinitions: { id: UserRole; label: { fr: string; en: string; ar: string }; icon: any }[] = [
    { id: 'admin', label: { fr: 'Administrateur', en: 'Administrator', ar: 'مدير النظام' }, icon: Crown },
    { id: 'manager', label: { fr: 'Gérant', en: 'General Manager', ar: 'المدير' }, icon: Shield },
    { id: 'receptionist', label: { fr: 'Réception', en: 'Reception', ar: 'الاستقبال' }, icon: Briefcase },
    { id: 'staff', label: { fr: 'Étage', en: 'Staff', ar: 'الخدمة' }, icon: UserCheck },
    { id: 'client', label: { fr: 'Client', en: 'Guest', ar: 'النزيل' }, icon: Users },
  ];

  const currentRoleObj = roleDefinitions.find((r) => r.id === currentRole) || roleDefinitions[0];
  const CurrentRoleIcon = currentRoleObj.icon;

  const isRtl = language === 'ar';

  return (
    <header className="pms-app-topbar w-full bg-[#0a0f1d] text-slate-100 border-b border-slate-800/80 px-2 sm:px-4 py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-3 shrink-0 select-none z-40 relative">
      {/* Toast notice for USB or status */}
      {usbNotice && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs shadow-xl z-50 animate-in fade-in flex items-center gap-2">
          <Info size={14} className="text-cyan-400" />
          <span>{usbNotice}</span>
        </div>
      )}

      {/* LEFT SECTION: Mobile hamburger, Sector pills, Role selector */}
      <div className="pms-app-topbar-left flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
          aria-label="Menu"
        >
          <Menu size={16} />
        </button>

        {/* SECTEUR label */}
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 hidden sm:inline">
          {language === 'fr' ? 'SECTEUR :' : language === 'ar' ? 'القطاع :' : 'SECTOR :'}
        </span>

        {/* Sector: Hôtel Pill */}
        <button
          type="button"
          onClick={() => setCurrentDomain('hotel')}
          className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
            currentDomain === 'hotel'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white bg-slate-900/60'
          }`}
          title="Secteur Hôtel"
        >
          <Hotel size={14} className={currentDomain === 'hotel' ? 'text-white' : 'text-slate-400'} />
          <span>{language === 'fr' ? 'Hôtel' : language === 'ar' ? 'فندق' : 'Hotel'}</span>
        </button>

        {/* Sector: Resort & Complexe Pill */}
        <button
          type="button"
          onClick={() => setCurrentDomain('resort')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            currentDomain === 'resort'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white bg-slate-900/60'
          }`}
          title="Secteur Resort & Complexe"
        >
          <Palmtree size={14} className={currentDomain === 'resort' ? 'text-white' : 'text-slate-400'} />
          <span className="hidden sm:inline">{language === 'fr' ? 'Resort & Complexe' : language === 'ar' ? 'منتجع ومجمع' : 'Resort & Complex'}</span>
          <span className="sm:hidden">Resort</span>
        </button>

        {/* RÔLE ACTIF label */}
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 ml-1 sm:ml-2 hidden lg:inline">
          {language === 'fr' ? 'RÔLE ACTIF :' : language === 'ar' ? 'الدور النشط :' : 'ACTIVE ROLE :'}
        </span>

        {/* Role dropdown button */}
        <div className="relative" ref={roleMenuRef}>
          <button
            type="button"
            onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
            className="px-2 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
            title="Changer de rôle actif"
          >
            <CurrentRoleIcon size={14} className="text-amber-300" />
            <span className="truncate max-w-[100px] sm:max-w-none">
              {currentRoleObj.label[language] || currentRoleObj.label.fr}
            </span>
            <ChevronDown size={13} className="text-white/80" />
          </button>

          {isRoleMenuOpen && (
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="absolute top-full mt-1.5 left-0 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95"
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800 mb-1">
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
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <IconComponent size={14} className={isSelected ? 'text-amber-300' : 'text-slate-400'} />
                    <span className="flex-1">{role.label[language] || role.label.fr}</span>
                    {isSelected && <CheckCircle2 size={13} className="text-white ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CENTER SECTION: Clean White Search Input matching szsz.png */}
      <div className="pms-app-topbar-search flex-1 max-w-[160px] sm:max-w-[220px] md:max-w-[280px] lg:max-w-[340px] relative">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'fr' ? 'Rechercher...' : language === 'ar' ? 'بحث...' : 'Search...'}
            className="w-full bg-white text-slate-800 placeholder:text-slate-400 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Local storage status, USB status, + Nouveau, More ⋮ */}
      <div className="pms-app-topbar-actions flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Local database activity indicator (not Supabase sync status) */}
        <button
          type="button"
          onClick={() => setIsIndexedDBOpen(true)}
          className={`h-8 px-2 sm:px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            indexedDbSync === 'synced'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
              : indexedDbSync === 'syncing'
              ? 'bg-blue-950/60 border-blue-500/40 text-blue-300 hover:bg-blue-900/60'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
          }`}
          title={`Stockage local: ${
            indexedDbSync === 'synced'
              ? 'Disponible'
              : indexedDbSync === 'syncing'
              ? 'Écriture locale en cours...'
              : 'Mode hors ligne'
          } — Cliquer pour consulter`}
        >
          {indexedDbSync === 'synced' && (
            <>
              <Database size={13} className="text-emerald-300" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Local</span>
            </>
          )}
          {indexedDbSync === 'syncing' && (
            <>
              <Database size={13} className="text-blue-300" />
              <RefreshCw size={12} className="animate-spin text-blue-400" />
              <span className="hidden sm:inline">Écriture</span>
            </>
          )}
          {indexedDbSync === 'offline' && (
            <>
              <Database size={13} className="text-rose-300" />
              <AlertCircle size={12} className="text-rose-400" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </button>

        {/* USB Hardware Button matching szsz.png (🟢 USB • Prêt) */}
        <button
          type="button"
          onClick={handlePhysicalUsbClick}
          className={`h-8 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs ${
            usbStatus === 'connected'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60'
          }`}
          title={
            usbStatus === 'connected'
              ? 'Encodeur USB proUSB connecté et opérationnel'
              : 'Encodeur USB proUSB — Cliquez pour autoriser WebHID'
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
          <Usb size={15} />
          <span className="whitespace-nowrap hidden sm:inline">
            USB • {usbStatus === 'connected' ? 'Prêt' : 'Connecter'}
          </span>
        </button>

        {/* Global Currency Switcher */}
        <div className="pms-app-topbar-currency h-8 flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-1.5 sm:px-2 text-[11px] sm:text-xs font-mono font-bold text-amber-400 shadow-2xs">
          <span className="text-[10px] text-slate-400 mr-1.5 font-sans hidden sm:inline">Devise:</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer"
            title="Changer la devise globale de l'établissement"
          >
            <option value="DZD" className="bg-slate-900 text-white">🇩🇿 DZD (DA)</option>
            <option value="DA" className="bg-slate-900 text-white">🇩🇿 DA</option>
            <option value="EUR" className="bg-slate-900 text-white">🇪🇺 EUR (€)</option>
            <option value="USD" className="bg-slate-900 text-white">🇺🇸 USD ($)</option>
            <option value="GBP" className="bg-slate-900 text-white">🇬🇧 GBP (£)</option>
            <option value="SAR" className="bg-slate-900 text-white">🇸🇦 SAR (﷼)</option>
            <option value="RMB" className="bg-slate-900 text-white">🇨🇳 RMB (¥)</option>
            <option value="CAD" className="bg-slate-900 text-white">🇨🇦 CAD ($)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('help')}
          className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-center transition-colors"
          title={language === 'fr' ? 'Centre d’aide et tutoriels' : language === 'ar' ? 'مركز المساعدة والدروس' : 'Help center and tutorials'}
          aria-label={language === 'fr' ? 'Ouvrir le centre d’aide' : language === 'ar' ? 'فتح مركز المساعدة' : 'Open help center'}
        >
          <BookOpen size={15} />
        </button>

        {/* Primary Action Button: + Nouveau */}
        <button
          type="button"
          onClick={() => {
            setNewBookingInitialSlot(null);
            setIsNewBookingModalOpen(true);
          }}
          className="h-8 px-2 sm:px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          title="Créer une nouvelle réservation"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">{language === 'fr' ? 'Nouveau' : language === 'ar' ? 'حجز جديد' : 'New'}</span>
        </button>

        {/* More Menu [⋮] */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Options supplémentaires & À Propos"
            aria-label="Options"
          >
            <MoreVertical size={16} />
          </button>

          {isMoreMenuOpen && (
            <div
              dir={isRtl ? 'rtl' : 'ltr'}
              className="absolute top-full mt-1.5 right-0 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95"
            >
              {/* Language switcher */}
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                {language === 'fr' ? 'Langue' : language === 'ar' ? 'اللغة' : 'Language'}
              </div>
              <div className="grid grid-cols-3 gap-1 px-1 pb-2 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setLanguage('fr')}
                  className={`py-1 rounded text-center text-xs font-bold ${
                    language === 'fr' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`py-1 rounded text-center text-xs font-bold ${
                    language === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`py-1 rounded text-center text-xs font-bold ${
                    language === 'ar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  العربية
                </button>
              </div>

              {/* Theme & Sound toggle */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-400" />}
                <span>{theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}</span>
              </button>

              <button
                type="button"
                onClick={toggleSound}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                {isSoundEnabled ? <Volume2 size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-slate-500" />}
                <span>{isSoundEnabled ? 'Bips & Sons : Activés' : 'Bips & Sons : Désactivés'}</span>
              </button>

              <div className="pt-1 border-t border-slate-800 my-1" />

              {/* Establishment Setup */}
              <button
                type="button"
                onClick={() => {
                  setIsEstablishmentModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <Sliders size={14} className="text-blue-400" />
                <span>Paramètres Établissement</span>
              </button>

              {/* Local data inspector */}
              <button
                type="button"
                onClick={() => {
                  setIsIndexedDBOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <Database size={14} className="text-emerald-400" />
                <span>Inspecteur des données locales</span>
              </button>

              {/* CI/CD & AGENTS.md Specs */}
              <button
                type="button"
                onClick={() => {
                  setIsCockpitOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <FileCode size={14} className="text-cyan-400" />
                <span>Spécifications AGENTS.md</span>
              </button>

              {/* Legal & Privacy */}
              <button
                type="button"
                onClick={() => {
                  setIsLegalModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <FileText size={14} className="text-slate-400" />
                <span>Légal & Confidentialité</span>
              </button>

              <div className="pt-1 border-t border-slate-800 my-1" />

              {/* À Propos FORSLOG LTD & Développeur S.M. Ramzi Guedouar */}
              <button
                type="button"
                onClick={() => {
                  setIsAboutModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/60 hover:text-cyan-100 transition-colors cursor-pointer font-semibold"
              >
                <Info size={14} className="text-cyan-400" />
                <span>✨ À Propos (FORSLOG & Développeur)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
