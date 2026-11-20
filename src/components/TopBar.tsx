import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Menu,
  Search,
  Plus,
  Usb,
  MoreVertical,
  X,
  Hotel,
  Building2,
  Palmtree,
  Crown,
  Shield,
  Briefcase,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sliders,
  Database,
  FileCode,
  FileText,
  Info,
  ChevronDown,
  RefreshCw,
  Cloud,
  CloudOff,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { capitalizeFirstLetter } from '../utils/text';
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
    cloudSyncStatus,
    forceSupabaseSync,
    isOffline,
    resourceGroups,
    selectedBuildingGroupId,
    setSelectedBuildingGroupId,
  } = useApp();

  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [usbDevice, setUsbDevice] = useState<UsbDeviceInfo | null>(() => lockManager.getDeviceInfo());
  const [indexedDbSync, setIndexedDBSync] = useState<IndexedDbSyncState>(indexedDb.getSyncStatus());

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isSectorMenuOpen, setIsSectorMenuOpen] = useState(false);
  const [usbNotice, setUsbNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Click outside listener for dropdowns (mouse & touch)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(target)) {
        setIsRoleMenuOpen(false);
      }
      if (sectorMenuRef.current && !sectorMenuRef.current.contains(target)) {
        setIsSectorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const toggleSectorMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSectorMenuOpen((prev) => !prev);
    setIsRoleMenuOpen(false);
    setIsMoreMenuOpen(false);
  };

  const toggleRoleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRoleMenuOpen((prev) => !prev);
    setIsSectorMenuOpen(false);
    setIsMoreMenuOpen(false);
  };

  const toggleMoreMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMoreMenuOpen((prev) => !prev);
    setIsSectorMenuOpen(false);
    setIsRoleMenuOpen(false);
  };

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

  // Only buildings that really exist in the local IndexedDB inventory are offered.
  // ResourceGroup ids are local building ids, never Supabase establishment ids.
  const localBuildings = useMemo(
    () => resourceGroups.filter((group) => group.sector === 'hotel' || group.sector === 'resort'),
    [resourceGroups]
  );
  const selectedBuilding = localBuildings.find((group) => group.id === selectedBuildingGroupId);

  return (
    <header className="pms-app-topbar pms-material-bar pms-material-edge w-full border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 px-2 sm:px-3 py-1.5 flex flex-col gap-1.5 shrink-0 select-none z-50 relative transition-colors duration-200 overflow-visible">
      {/* Dynamic theme accent strip along top edge */}
      <div className="pms-theme-strip absolute top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none" />

      {/* Toast notice for USB or status */}
      {usbNotice && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs shadow-xl z-[120] pms-toast flex items-center gap-2">
          <Info size={14} className="text-cyan-400" />
          <span>{usbNotice}</span>
        </div>
      )}

      {/* ROW 1: Main Toolbar (Left tools, Tablet/Desktop search, Right actions) */}
      <div className="w-full flex items-center justify-between gap-1 sm:gap-2 min-w-0 overflow-visible">
        {/* LEFT SECTION: Hamburger (mobile), Secteur dropdown, Role dropdown */}
        <div className="pms-app-topbar-left flex items-center gap-1.5 min-w-0 shrink-0 overflow-visible">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-2xs shrink-0"
            aria-label={language === 'fr' ? 'Menu' : language === 'ar' ? 'القائمة' : 'Menu'}
          >
            <Menu size={16} />
          </button>

          {/* SECTEUR label (Desktop) */}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 hidden xl:inline">
            {language === 'fr' ? 'SECTEUR :' : language === 'ar' ? 'القطاع :' : 'SECTOR :'}
          </span>

          {/* Sector dropdown seeded only from the real local building inventory */}
          <div className="relative shrink-0 overflow-visible" ref={sectorMenuRef}>
            <button
              type="button"
              onClick={toggleSectorMenu}
              aria-haspopup="menu"
              aria-expanded={isSectorMenuOpen}
              className="h-9 px-2.5 sm:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={selectedBuilding
                ? `${getTranslation('sectorSelectBuilding', language)} : ${capitalizeFirstLetter(selectedBuilding.name[language] || selectedBuilding.name.fr)}`
                : getTranslation('sectorSelectBuilding', language)}
            >
              {selectedBuilding ? (
                <Building2 size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              ) : currentDomain === 'hotel' ? (
                <Hotel size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              ) : (
                <Palmtree size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className="truncate max-w-[85px] sm:max-w-[150px]">
                {selectedBuilding
                  ? capitalizeFirstLetter(selectedBuilding.name[language] || selectedBuilding.name.fr)
                  : currentDomain === 'hotel'
                    ? (language === 'fr' ? 'Hôtel' : language === 'ar' ? 'فندق' : 'Hotel')
                    : (language === 'fr' ? 'Resort' : language === 'ar' ? 'منتجع' : 'Resort')}
              </span>
              <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${isSectorMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSectorMenuOpen && (
              <div
                role="menu"
                dir={isRtl ? 'rtl' : 'ltr'}
                className="absolute top-full mt-1.5 left-0 rtl:left-auto rtl:right-0 w-56 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-[100] text-xs pms-dropdown"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                  {getTranslation('sectorSelectBuilding', language)}
                </div>
                {localBuildings.length === 0 ? (
                  <div className="px-2.5 py-3 space-y-2">
                    <p className="text-slate-600 dark:text-slate-300">
                      {getTranslation('topbarNoLocalBuildings', language)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEstablishmentModalOpen(true);
                        setIsSectorMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Building2 size={14} className="shrink-0" />
                      <span>{getTranslation('topbarAddBuilding', language)}</span>
                    </button>
                  </div>
                ) : (
                  (['hotel', 'resort'] as const).map((sector) => {
                    const options = localBuildings.filter((group) => group.sector === sector);
                    if (options.length === 0) return null;
                    const SectorIcon = sector === 'hotel' ? Hotel : Palmtree;
                    const allSelected = currentDomain === sector && selectedBuildingGroupId === 'all';
                    return (
                      <div key={sector} className="mb-1 last:mb-0">
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <SectorIcon size={12} />
                          <span>{getTranslation(sector === 'hotel' ? 'sectorHotel' : 'sectorResort', language)}</span>
                        </div>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={allSelected}
                          onClick={() => {
                            setCurrentDomain(sector);
                            setSelectedBuildingGroupId('all');
                            setIsSectorMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left rtl:text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            allSelected
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex-1 truncate">{getTranslation('topbarAllBuildings', language)}</span>
                          {allSelected && <CheckCircle2 size={13} className="text-white ml-auto rtl:ml-0 rtl:mr-auto" />}
                        </button>
                        {options.map((group) => {
                          const isSelected = selectedBuildingGroupId === group.id;
                          const buildingName = capitalizeFirstLetter(group.name[language] || group.name.fr);
                          return (
                            <button
                              key={group.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={isSelected}
                              onClick={() => {
                                setCurrentDomain(sector);
                                setSelectedBuildingGroupId(group.id);
                                setIsSectorMenuOpen(false);
                              }}
                              title={buildingName}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left rtl:text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isSelected
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Building2 size={13} className={isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                              <span className="flex-1 truncate">{buildingName}</span>
                              {isSelected && <CheckCircle2 size={13} className="text-white ml-auto rtl:ml-0 rtl:mr-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* RÔLE ACTIF label (Desktop) */}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 ml-1 hidden xl:inline">
            {language === 'fr' ? 'RÔLE ACTIF :' : language === 'ar' ? 'الدور النشط :' : 'ACTIVE ROLE :'}
          </span>

          {/* Role Dropdown Menu */}
          <div className="relative shrink-0 overflow-visible" ref={roleMenuRef}>
            <button
              type="button"
              onClick={toggleRoleMenu}
              className="h-9 px-2.5 sm:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
              title={language === 'fr' ? 'Changer de rôle actif' : language === 'ar' ? 'تغيير الدور النشط' : 'Change active role'}
            >
              <CurrentRoleIcon size={14} className="text-amber-500 shrink-0" />
              <span className="truncate max-w-[85px] sm:max-w-none">
                {currentRoleObj.label[language] || currentRoleObj.label.fr}
              </span>
              <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${isRoleMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isRoleMenuOpen && (
              <div
                dir={isRtl ? 'rtl' : 'ltr'}
                className="absolute top-full mt-1.5 left-0 rtl:left-auto rtl:right-0 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-[100] text-xs pms-dropdown"
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
                      <IconComponent size={14} className={isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                      <span className="flex-1">{role.label[language] || role.label.fr}</span>
                      {isSelected && <CheckCircle2 size={13} className="text-white ml-auto rtl:ml-0 rtl:mr-auto" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CENTER SECTION: Tablet & Desktop Global Search */}
        <div className="pms-app-topbar-search hidden md:flex relative items-center h-9 md:w-[88px] md:max-w-[88px] lg:w-36 lg:max-w-[160px] xl:w-44 xl:max-w-[190px] 2xl:w-56 2xl:max-w-[240px] shrink-0">
          <div className="relative flex min-w-0 flex-1 items-center h-9">
            <Search size={14} className="absolute left-2.5 rtl:left-auto rtl:right-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'fr' ? 'Rechercher...' : language === 'ar' ? 'بحث...' : 'Search...'}
              className="w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs pl-8 pr-6 rtl:pl-6 rtl:pr-8 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 rtl:right-auto rtl:left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={language === 'fr' ? 'Effacer la recherche' : language === 'ar' ? 'مسح البحث' : 'Clear search'}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT SECTION: Force Sync Supabase, Refresh, Local Storage, USB, Currency, + Nouveau, Options [⋮] */}
        <div className="pms-app-topbar-actions flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-visible">
          {/* Bidirectional Supabase Auto-Sync + Force Sync Button */}
          {(() => {
            const syncBusy = cloudSyncStatus.isSyncing;
            const pendingCount = cloudSyncStatus.pendingCount;
            const phase = cloudSyncStatus.phase;
            const statusText = syncBusy
              ? getTranslation('supabaseSyncing', language)
              : phase === 'synced'
              ? getTranslation('supabaseStatusSynced', language)
              : phase === 'offline'
              ? getTranslation('cloudStatusOffline', language)
              : phase === 'error'
              ? getTranslation('supabaseStatusError', language)
              : phase === 'pending'
              ? getTranslation('supabaseStatusPending', language).replace('{count}', String(pendingCount))
              : phase === 'no_workspace'
              ? getTranslation('supabaseStatusNoWorkspace', language)
              : phase === 'unauthenticated'
              ? getTranslation('supabaseStatusAuthRequired', language)
              : getTranslation('supabaseForceSyncBtn', language);
            const lastSyncLabel = cloudSyncStatus.lastSyncedAt
              ? ` · ${getTranslation('supabaseLastSyncedAt', language).replace('{time}', new Date(cloudSyncStatus.lastSyncedAt).toLocaleTimeString())}`
              : '';
            const toneClass = syncBusy
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : phase === 'synced'
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50'
              : phase === 'error'
              ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60'
              : phase === 'pending'
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200';
            const titleText = `Supabase : ${statusText}${lastSyncLabel}${cloudSyncStatus.lastError ? ` — ${cloudSyncStatus.lastError}` : ''} — ${getTranslation('supabaseForceSyncFullBtn', language)}`;
            return (
              <button
                type="button"
                data-testid="force-supabase-sync-btn"
                disabled={syncBusy || isOffline}
                onClick={() => void forceSupabaseSync()}
                className={`h-9 w-9 sm:w-auto sm:px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs shrink-0 whitespace-nowrap relative ${toneClass}`}
                title={titleText}
                aria-label={`${getTranslation('supabaseForceSyncBtn', language)} (${statusText})`}
              >
                {syncBusy ? (
                  <RefreshCw size={14} className="animate-spin shrink-0" />
                ) : phase === 'offline' ? (
                  <CloudOff size={14} className="shrink-0" />
                ) : phase === 'error' || phase === 'pending' ? (
                  <AlertTriangle size={14} className="shrink-0" />
                ) : (
                  <Cloud size={14} className="shrink-0" />
                )}
                <span className="hidden lg:inline">
                  {syncBusy
                    ? getTranslation('supabaseSyncing', language)
                    : getTranslation('supabaseForceSyncBtn', language)}
                </span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })()}

          <button type="button" disabled={isRefreshing} onClick={() => { setIsRefreshing(true); window.dispatchEvent(new CustomEvent('appointment-refresh-request', { detail: { onComplete: () => setIsRefreshing(false) } })); }} className="hidden sm:flex h-9 w-9 2xl:w-auto 2xl:px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-700 dark:text-slate-200 text-xs font-semibold items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0" title={language === 'fr' ? 'Actualiser toutes les pages' : language === 'ar' ? 'تحديث جميع الصفحات' : 'Refresh all pages'} aria-label={language === 'fr' ? 'Actualiser' : language === 'ar' ? 'تحديث' : 'Refresh'}>
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/><span className="hidden 2xl:inline">{language === 'fr' ? 'Actualiser' : language === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>
          {/* Local database sync indicator */}
          <button
            type="button"
            onClick={() => setIsIndexedDBOpen(true)}
            className="hidden sm:flex h-9 px-2 2xl:px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
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
            <Database size={14} className={indexedDbSync === 'synced' ? 'text-emerald-600 dark:text-emerald-400' : indexedDbSync === 'syncing' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'} />
            <span className={`w-2 h-2 rounded-full ${indexedDbSync === 'synced' ? 'bg-emerald-500 animate-pulse' : indexedDbSync === 'syncing' ? 'bg-blue-500 animate-spin' : 'bg-rose-500'}`} />
            <span className="hidden 2xl:inline">{language === 'fr' ? 'Local' : language === 'ar' ? 'محلي' : 'Local'}</span>
          </button>

          {/* USB Hardware Button */}
          <button
            type="button"
            onClick={handlePhysicalUsbClick}
            className={`hidden md:flex h-9 px-2 xl:px-2.5 rounded-xl border text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 ${
              usbStatus === 'connected'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
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
              USB
              <span className="hidden 2xl:inline">
                {' '}• {usbStatus === 'connected' ? (usbDevice?.readerLabel ?? (language === 'fr' ? 'Prêt' : language === 'ar' ? 'جاهز' : 'Ready')) : (language === 'fr' ? 'Connecter' : language === 'ar' ? 'اتصال' : 'Connect')}
              </span>
            </span>
          </button>

          {/* Global Currency Switcher */}
          <div className="pms-app-topbar-currency hidden sm:flex h-9 items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 shadow-2xs shrink-0">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1 rtl:mr-0 rtl:ml-1 font-sans hidden 2xl:inline">
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
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            title={language === 'fr' ? 'Créer une nouvelle réservation' : language === 'ar' ? 'إنشاء حجز جديد' : 'Create new booking'}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="hidden lg:inline">{language === 'fr' ? 'Nouveau' : language === 'ar' ? 'حجز جديد' : 'New'}</span>
          </button>

          {/* More Menu [⋮] */}
          <div className="relative shrink-0 overflow-visible" ref={moreMenuRef}>
            <button
              type="button"
              onClick={toggleMoreMenu}
              className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
              title={language === 'fr' ? 'Options supplémentaires' : language === 'ar' ? 'خيارات إضافية' : 'More options'}
              aria-label={language === 'fr' ? 'Options' : language === 'ar' ? 'خيارات' : 'Options'}
            >
              <MoreVertical size={16} />
            </button>

            {isMoreMenuOpen && (
              <div
                dir={isRtl ? 'rtl' : 'ltr'}
                className="absolute top-full mt-1.5 right-0 rtl:right-auto rtl:left-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-[100] text-xs space-y-1 pms-dropdown pms-dropdown-end text-slate-700 dark:text-slate-200"
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

                {/* Force Supabase Cloud Sync (mobile + accessible menu entry) */}
                <button
                  type="button"
                  disabled={cloudSyncStatus.isSyncing || isOffline}
                  onClick={() => {
                    void forceSupabaseSync();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer text-left rtl:text-right"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Cloud size={14} className={cloudSyncStatus.phase === 'synced' ? 'text-emerald-500 shrink-0' : cloudSyncStatus.phase === 'error' ? 'text-rose-500 shrink-0' : 'text-blue-500 shrink-0'} />
                    <span className="truncate font-semibold">{getTranslation('supabaseForceSyncFullBtn', language)}</span>
                  </span>
                  {cloudSyncStatus.pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                      {cloudSyncStatus.pendingCount}
                    </span>
                  )}
                </button>

                {/* Mobile-only quick tools (hidden in Row 1 on <640px to prevent clipping) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsRefreshing(true);
                    window.dispatchEvent(new CustomEvent('appointment-refresh-request', { detail: { onComplete: () => setIsRefreshing(false) } }));
                    setIsMoreMenuOpen(false);
                  }}
                  className="sm:hidden w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left rtl:text-right"
                >
                  <RefreshCw size={14} className="text-slate-500 shrink-0" />
                  <span>{language === 'fr' ? 'Actualiser toutes les pages' : language === 'ar' ? 'تحديث جميع الصفحات' : 'Refresh all pages'}</span>
                </button>

                <div className="sm:hidden flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">
                    {language === 'fr' ? 'Devise' : language === 'ar' ? 'العملة' : 'Currency'}
                  </span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    aria-label={language === 'fr' ? 'Devise' : language === 'ar' ? 'العملة' : 'Currency'}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-amber-600 dark:text-amber-400 font-mono font-bold text-xs"
                  >
                    <option value="DZD">🇩🇿 DZD (DA)</option>
                    <option value="DA">🇩🇿 DA</option>
                    <option value="EUR">🇪🇺 EUR (€)</option>
                    <option value="USD">🇺🇸 USD ($)</option>
                    <option value="GBP">🇬🇧 GBP (£)</option>
                    <option value="SAR">🇸🇦 SAR (﷼)</option>
                    <option value="RMB">🇨🇳 RMB (¥)</option>
                    <option value="CAD">🇨🇦 CAD ($)</option>
                  </select>
                </div>

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
      </div>

      {/* ROW 2: Mobile Dedicated Search Row ("dans mobile design la barre de recherche sera dans une ligne seule") */}
      <div className="w-full flex md:hidden items-center min-w-0 pt-0.5">
        <div className="relative flex min-w-0 w-full items-center">
          <Search size={14} className="absolute left-2.5 rtl:left-auto rtl:right-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'fr' ? 'Rechercher un séjour, client, chambre...' : language === 'ar' ? 'بحث عن حجز أو نزيل أو غرفة...' : 'Search booking, guest, room...'}
            className="w-full h-9 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs pl-8 pr-7 rtl:pl-7 rtl:pr-8 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 rtl:right-auto rtl:left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
              title={language === 'fr' ? 'Effacer la recherche' : language === 'ar' ? 'مسح البحث' : 'Clear search'}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
