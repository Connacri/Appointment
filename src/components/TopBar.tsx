import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  History,
  UserCog,
  Bell,
  Check,
  Sparkles,
  ClipboardList,
  Boxes,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { capitalizeFirstLetter } from '../utils/text';
import { lockManager, UsbConnectionStatus, UsbDeviceInfo } from '../locks/lockManager';
import { indexedDb, IndexedDbSyncState } from '../db/indexedDb';
import { ROLE_CATEGORY_META } from '../data/roles';
import type { RoleCategory } from '../types/roles';
import { getRoleUiCapabilities } from '../utils/rolePermissions';
import {
  deriveStaffNotifications,
  loadReadNotificationIds,
  saveReadNotificationIds,
  type StaffNotification,
} from '../utils/staffNotifications';
import { RoleIcon } from './RoleIcon';
import { LanDiscoveryStatus } from './LanDiscoveryStatus';

export const TopBar: React.FC = () => {
  const {
    language,
    currentDomain,
    setCurrentDomain,
    currentRole,
    setCurrentRole,
    roles,
    activeRoleDefinition,
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
    tasks,
    bookings,
    stockItems,
    purchaseOrders,
    activeOperatorName,
    setFocusedTaskId,
    setFocusedStockTab,
    updateTaskStatus,
  } = useApp();

  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [usbDevice, setUsbDevice] = useState<UsbDeviceInfo | null>(() => lockManager.getDeviceInfo());
  const [indexedDbSync, setIndexedDBSync] = useState<IndexedDbSyncState>(indexedDb.getSyncStatus());

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [isSectorMenuOpen, setIsSectorMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isMobileNotificationAnchor, setIsMobileNotificationAnchor] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => loadReadNotificationIds());
  const [usbNotice, setUsbNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const sectorMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const morePopoverRef = useRef<HTMLDivElement>(null);
  const rolePopoverRef = useRef<HTMLDivElement>(null);
  const sectorPopoverRef = useRef<HTMLDivElement>(null);
  const notifPopoverRef = useRef<HTMLDivElement>(null);

  type PopoverRect = { top: number; left: number; width: number; maxHeight: number };
  const [sectorMenuRect, setSectorMenuRect] = useState<PopoverRect | null>(null);
  const [roleMenuRect, setRoleMenuRect] = useState<PopoverRect | null>(null);
  const [notifMenuRect, setNotifMenuRect] = useState<PopoverRect | null>(null);
  const [moreMenuRect, setMoreMenuRect] = useState<PopoverRect | null>(null);

  const computeClampedPopoverRect = useCallback(
    (containerEl: HTMLElement | null, desiredWidth: number, alignEnd: boolean): PopoverRect | null => {
      if (!containerEl || typeof window === 'undefined') return null;
      const rect = containerEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 8;
      const width = Math.min(desiredWidth, Math.max(200, vw - margin * 2));
      const preferredLeft = alignEnd ? rect.right - width : rect.left;
      const left = Math.max(margin, Math.min(preferredLeft, vw - width - margin));
      const top = Math.min(rect.bottom + 6, Math.max(margin, vh - 200));
      const maxHeight = Math.max(180, vh - top - 12);
      return { top, left, width, maxHeight };
    },
    []
  );

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

  // Click outside + Escape listener for dropdowns (including portaled popovers)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(target) &&
        (!morePopoverRef.current || !morePopoverRef.current.contains(target))
      ) {
        setIsMoreMenuOpen(false);
      }
      if (
        roleMenuRef.current &&
        !roleMenuRef.current.contains(target) &&
        (!rolePopoverRef.current || !rolePopoverRef.current.contains(target))
      ) {
        setIsRoleMenuOpen(false);
      }
      if (
        sectorMenuRef.current &&
        !sectorMenuRef.current.contains(target) &&
        (!sectorPopoverRef.current || !sectorPopoverRef.current.contains(target))
      ) {
        setIsSectorMenuOpen(false);
      }
      if (
        notifMenuRef.current &&
        !notifMenuRef.current.contains(target) &&
        (!notifPopoverRef.current || !notifPopoverRef.current.contains(target))
      ) {
        setIsNotifMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreMenuOpen(false);
        setIsRoleMenuOpen(false);
        setIsSectorMenuOpen(false);
        setIsNotifMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isRtlDir = language === 'ar';

  // Keep open popover coordinates clamped within viewport on resize
  useEffect(() => {
    const updateOpenRects = () => {
      if (isSectorMenuOpen) setSectorMenuRect(computeClampedPopoverRect(sectorMenuRef.current, 232, isRtlDir));
      if (isRoleMenuOpen) setRoleMenuRect(computeClampedPopoverRect(roleMenuRef.current, 288, isRtlDir));
      if (isNotifMenuOpen) setNotifMenuRect(computeClampedPopoverRect(isMobileNotificationAnchor ? moreMenuRef.current : notifMenuRef.current, 320, !isRtlDir));
      if (isMoreMenuOpen) setMoreMenuRect(computeClampedPopoverRect(moreMenuRef.current, 256, !isRtlDir));
    };
    updateOpenRects();
    if (!isSectorMenuOpen && !isRoleMenuOpen && !isNotifMenuOpen && !isMoreMenuOpen) return;
    window.addEventListener('resize', updateOpenRects, { passive: true });
    return () => window.removeEventListener('resize', updateOpenRects);
  }, [isSectorMenuOpen, isRoleMenuOpen, isNotifMenuOpen, isMoreMenuOpen, isMobileNotificationAnchor, isRtlDir, computeClampedPopoverRect]);

  const toggleSectorMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isSectorMenuOpen;
    if (next) setSectorMenuRect(computeClampedPopoverRect(sectorMenuRef.current, 232, isRtlDir));
    setIsSectorMenuOpen(next);
    setIsRoleMenuOpen(false);
    setIsMoreMenuOpen(false);
    setIsNotifMenuOpen(false);
  };

  const toggleRoleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isRoleMenuOpen;
    if (next) setRoleMenuRect(computeClampedPopoverRect(roleMenuRef.current, 288, isRtlDir));
    setIsRoleMenuOpen(next);
    setIsSectorMenuOpen(false);
    setIsMoreMenuOpen(false);
    setIsNotifMenuOpen(false);
  };

  const toggleMoreMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMoreMenuOpen;
    if (next) setMoreMenuRect(computeClampedPopoverRect(moreMenuRef.current, 256, !isRtlDir));
    setIsMoreMenuOpen(next);
    setIsSectorMenuOpen(false);
    setIsRoleMenuOpen(false);
    setIsNotifMenuOpen(false);
  };

  const toggleNotifMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileNotificationAnchor(false);
    const next = !isNotifMenuOpen;
    if (next) setNotifMenuRect(computeClampedPopoverRect(notifMenuRef.current, 320, !isRtlDir));
    setIsNotifMenuOpen(next);
    setIsSectorMenuOpen(false);
    setIsRoleMenuOpen(false);
    setIsMoreMenuOpen(false);
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

  const currentRoleObj = activeRoleDefinition;
  const uiCaps = useMemo(() => getRoleUiCapabilities(currentRoleObj), [currentRoleObj]);

  const isRtl = language === 'ar';

  const domainRooms = useMemo(
    () => resourceGroups.filter((group) => group.sector === currentDomain).flatMap((group) => group.resources),
    [resourceGroups, currentDomain]
  );

  const domainBookings = useMemo(
    () => bookings.filter((b) => b.sector === currentDomain),
    [bookings, currentDomain]
  );

  const staffNotifications = useMemo(
    () =>
      deriveStaffNotifications({
        role: currentRoleObj,
        tasks,
        rooms: domainRooms,
        bookings: domainBookings,
        stockItems,
        purchaseOrders,
        language,
        activeOperatorName,
      }),
    [currentRoleObj, tasks, domainRooms, domainBookings, stockItems, purchaseOrders, language, activeOperatorName]
  );

  const unreadNotifCount = useMemo(
    () => staffNotifications.filter((n) => !readNotifIds.has(n.id)).length,
    [staffNotifications, readNotifIds]
  );

  const markNotificationRead = (id: string) => {
    setReadNotifIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadNotificationIds(next);
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    setReadNotifIds((prev) => {
      const next = new Set(prev);
      for (const n of staffNotifications) next.add(n.id);
      saveReadNotificationIds(next);
      return next;
    });
  };

  const handleOpenNotification = (notif: StaffNotification) => {
    markNotificationRead(notif.id);
    if (notif.taskId) {
      setFocusedTaskId(notif.taskId);
    }
    if (
      notif.kind === 'stock_rupture' ||
      notif.kind === 'stock_low' ||
      notif.kind === 'purchase_order_draft'
    ) {
      setFocusedStockTab('reorder');
    }
    setActiveView(notif.targetView);
    setIsNotifMenuOpen(false);
  };

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
      <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 min-w-0 overflow-visible">
        {/* LEFT SECTION: Hamburger (mobile), Secteur dropdown, Role dropdown */}
        <div className="pms-app-topbar-left flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0 overflow-visible">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarMobileOpen(!isSidebarMobileOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-2xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={language === 'fr' ? 'Menu' : language === 'ar' ? 'القائمة' : 'Menu'}
          >
            <Menu size={16} />
          </button>

          {/* SECTEUR label (Desktop) */}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 hidden xl:inline">
            {language === 'fr' ? 'SECTEUR :' : language === 'ar' ? 'القطاع :' : 'SECTOR :'}
          </span>

          {/* Sector dropdown seeded only from the real local building inventory */}
          <div className="relative min-w-0 shrink overflow-visible" ref={sectorMenuRef}>
            <button
              type="button"
              onClick={toggleSectorMenu}
              aria-haspopup="menu"
              aria-expanded={isSectorMenuOpen}
              className="h-9 max-w-full min-w-0 px-2 sm:px-2.5 md:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
              <span className="truncate min-w-0 max-w-[115px] sm:max-w-[140px] lg:max-w-[165px]">
                {selectedBuilding
                  ? capitalizeFirstLetter(selectedBuilding.name[language] || selectedBuilding.name.fr)
                  : currentDomain === 'hotel'
                    ? (language === 'fr' ? 'Hôtel' : language === 'ar' ? 'فندق' : 'Hotel')
                    : (language === 'fr' ? 'Resort' : language === 'ar' ? 'منتجع' : 'Resort')}
              </span>
              <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${isSectorMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSectorMenuOpen && sectorMenuRect && typeof document !== 'undefined' && createPortal(
              <div
                ref={sectorPopoverRef}
                role="menu"
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{
                  position: 'fixed',
                  top: `${sectorMenuRect.top}px`,
                  left: `${sectorMenuRect.left}px`,
                  width: `${sectorMenuRect.width}px`,
                  maxHeight: `${sectorMenuRect.maxHeight}px`,
                }}
                className="overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-[140] text-xs pms-dropdown"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                  {getTranslation('sectorSelectBuilding', language)}
                </div>
                {localBuildings.length === 0 ? (
                  <div className="px-2.5 py-3 space-y-2">
                    <p className="text-slate-600 dark:text-slate-300">
                      {getTranslation('topbarNoLocalBuildings', language)}
                    </p>
                    {uiCaps.canUseAdminSystemTools && (
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
                    )}
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
              </div>,
              document.body
            )}
          </div>

          {/* RÔLE ACTIF label (Desktop) */}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 ms-1 hidden xl:inline">
            {language === 'fr' ? 'RÔLE ACTIF :' : language === 'ar' ? 'الدور النشط :' : 'ACTIVE ROLE :'}
          </span>

          {/* Role Dropdown Menu */}
          <div className="relative min-w-0 shrink overflow-visible" ref={roleMenuRef}>
            <button
              type="button"
              onClick={toggleRoleMenu}
              aria-haspopup="menu"
              aria-expanded={isRoleMenuOpen}
              className="h-9 max-w-full min-w-0 px-2 sm:px-2.5 md:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === 'fr' ? 'Changer de rôle actif' : language === 'ar' ? 'تغيير الدور النشط' : 'Change active role'}
            >
              <RoleIcon iconName={currentRoleObj.iconName} size={14} className="text-amber-500 shrink-0" />
              <span className="truncate min-w-0 max-w-[115px] sm:max-w-[140px] lg:max-w-none">
                {currentRoleObj.label[language] || currentRoleObj.label.fr}
              </span>
              <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${isRoleMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isRoleMenuOpen && roleMenuRect && typeof document !== 'undefined' && createPortal(
              <div
                ref={rolePopoverRef}
                role="menu"
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{
                  position: 'fixed',
                  top: `${roleMenuRect.top}px`,
                  left: `${roleMenuRect.left}px`,
                  width: `${roleMenuRect.width}px`,
                  maxHeight: `${roleMenuRect.maxHeight}px`,
                }}
                className="overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-[140] text-xs pms-dropdown space-y-2"
              >
                <div className="px-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>{language === 'fr' ? 'Sélectionnez un rôle' : language === 'ar' ? 'اختر الدور' : 'Select a role'}</span>
                    <span className="text-slate-400">{roles.length}</span>
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 rtl:left-auto rtl:right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={language === 'fr' ? 'Filtrer les rôles...' : language === 'ar' ? 'تصفية الأدوار...' : 'Filter roles...'}
                      className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-7 pr-2 rtl:pl-2 rtl:pr-7 text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {(Object.keys(ROLE_CATEGORY_META) as RoleCategory[]).map((catKey) => {
                  const q = roleSearch.trim().toLowerCase();
                  const catRoles = roles.filter((r) => {
                    if (r.category !== catKey) return false;
                    if (!q) return true;
                    return `${r.label.fr} ${r.label.en} ${r.label.ar} ${r.id}`.toLowerCase().includes(q);
                  });
                  if (catRoles.length === 0) return null;
                  const catMeta = ROLE_CATEGORY_META[catKey];
                  return (
                    <div key={catKey} className="space-y-0.5">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {catMeta.label[language] || catMeta.label.fr}
                      </div>
                      {catRoles.map((role) => {
                        const isSelected = currentRole === role.id;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isSelected}
                            onClick={() => {
                              setCurrentRole(role.id);
                              setIsRoleMenuOpen(false);
                              setRoleSearch('');
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left rtl:text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              isSelected
                                ? 'bg-blue-600 text-white font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <RoleIcon
                              iconName={role.iconName}
                              size={14}
                              className={isSelected ? 'text-white shrink-0' : 'text-slate-500 dark:text-slate-400 shrink-0'}
                            />
                            <span className="flex-1 truncate">{role.label[language] || role.label.fr}</span>
                            {!role.isBuiltIn && (
                              <span
                                className={`text-[9px] px-1 rounded font-bold ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300'
                                }`}
                              >
                                {language === 'fr' ? 'Perso' : language === 'ar' ? 'مخصص' : 'Custom'}
                              </span>
                            )}
                            {isSelected && <CheckCircle2 size={13} className="text-white shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {activeRoleDefinition.allowedTabs.includes('roles') && (
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('roles');
                        setIsRoleMenuOpen(false);
                        setRoleSearch('');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-[11px] cursor-pointer transition-colors"
                    >
                      <UserCog size={14} />
                      <span>{getTranslation('navRolesPermissions', language)}</span>
                    </button>
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* RIGHT SECTION: Primary actions & More menu (streamlined per breakpoint to prevent overflow) */}
        <div className="pms-app-topbar-actions flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-visible">
          {/* Staff & Operational Notifications Bell */}
          {!currentRoleObj.permissions.isClientPortal && (
            <div className="relative hidden shrink-0 overflow-visible sm:block" ref={notifMenuRef}>
              <button
                type="button"
                data-testid="staff-notifications-btn"
                onClick={toggleNotifMenu}
                aria-haspopup="menu"
                aria-expanded={isNotifMenuOpen}
                aria-label={language === 'fr' ? 'Notifications opérationnelles' : language === 'ar' ? 'إشعارات العمل' : 'Operational notifications'}
                title={language === 'fr' ? 'Notifications & tâches à traiter' : language === 'ar' ? 'الإشعارات والمهام' : 'Notifications & open tasks'}
                className={`relative flex h-9 min-w-9 px-2 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  unreadNotifCount > 0
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Bell size={15} className={unreadNotifCount > 0 ? 'text-amber-600 dark:text-amber-300 shrink-0' : 'shrink-0'} />
                {unreadNotifCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold leading-none tabular-nums">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {isNotifMenuOpen && notifMenuRect && typeof document !== 'undefined' && createPortal(
                <div
                  ref={notifPopoverRef}
                  role="menu"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={{
                    position: 'fixed',
                    top: `${notifMenuRect.top}px`,
                    left: `${notifMenuRect.left}px`,
                    width: `${notifMenuRect.width}px`,
                    maxHeight: `${notifMenuRect.maxHeight}px`,
                  }}
                  className="overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 z-[140] text-xs space-y-2 pms-dropdown pms-dropdown-end"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <Bell size={14} className="text-amber-500" />
                      <span>{language === 'fr' ? 'Notifications & Tâches' : language === 'ar' ? 'الإشعارات والمهام' : 'Notifications & Tasks'}</span>
                      <span className="text-[10px] font-mono text-slate-400">({staffNotifications.length})</span>
                    </div>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {language === 'fr' ? 'Tout lu' : language === 'ar' ? 'قراءة الكل' : 'Mark all read'}
                      </button>
                    )}
                  </div>

                  {staffNotifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 space-y-1">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-500 opacity-80" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {language === 'fr' ? 'Aucune alerte en attente' : language === 'ar' ? 'لا توجد تنبيهات معلقة' : 'No pending notifications'}
                      </p>
                      <p className="text-[11px]">
                        {language === 'fr' ? 'Toutes les chambres et tâches sont à jour.' : language === 'ar' ? 'جميع الغرف والمهام مكتملة.' : 'All rooms and tasks are up to date.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {staffNotifications.slice(0, 14).map((notif) => {
                        const isRead = readNotifIds.has(notif.id);
                        return (
                          <div
                            key={notif.id}
                            className={`rounded-xl border p-2 transition-colors ${
                              notif.severity === 'urgent'
                                ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30'
                                : !isRead
                                ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20'
                                : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenNotification(notif)}
                              className="w-full text-left rtl:text-right cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white truncate">
                                  {notif.kind === 'room_dirty' || notif.kind === 'room_cleaning' ? (
                                    <Sparkles size={12} className="text-amber-500 shrink-0" />
                                  ) : notif.kind === 'stock_rupture' || notif.kind === 'stock_low' ? (
                                    <AlertTriangle size={12} className={notif.severity === 'urgent' ? 'text-rose-500 shrink-0' : 'text-amber-500 shrink-0'} />
                                  ) : notif.kind === 'purchase_order_draft' ? (
                                    <Boxes size={12} className="text-blue-500 shrink-0" />
                                  ) : (
                                    <ClipboardList size={12} className={notif.severity === 'urgent' ? 'text-rose-500 shrink-0' : 'text-blue-500 shrink-0'} />
                                  )}
                                  <span className="truncate">{notif.title}</span>
                                </span>
                                {!isRead && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                                {notif.description}
                              </p>
                            </button>
                            {notif.taskId && currentRoleObj.permissions.canManageTasks && (
                              <div className="mt-1.5 flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (await updateTaskStatus(notif.taskId!, 'done')) markNotificationRead(notif.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 text-[10px] font-bold cursor-pointer"
                                >
                                  <Check size={11} />
                                  <span>{language === 'fr' ? 'Achever' : language === 'ar' ? 'إتمام' : 'Complete'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}

          {/* Bidirectional Supabase Auto-Sync + Force Sync Button (Row 1 from sm+, Row 2 on <sm) */}
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
                className={`hidden sm:flex h-9 w-9 xl:w-auto xl:px-2.5 rounded-xl border text-xs font-semibold items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs shrink-0 whitespace-nowrap relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${toneClass}`}
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
                <span className="hidden xl:inline">
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

          <button type="button" disabled={isRefreshing} onClick={() => { setIsRefreshing(true); window.dispatchEvent(new CustomEvent('appointment-refresh-request', { detail: { onComplete: () => setIsRefreshing(false) } })); }} className="hidden lg:flex h-9 w-9 2xl:w-auto 2xl:px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-700 dark:text-slate-200 text-xs font-semibold items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" title={language === 'fr' ? 'Actualiser toutes les pages' : language === 'ar' ? 'تحديث جميع الصفحات' : 'Refresh all pages'} aria-label={language === 'fr' ? 'Actualiser' : language === 'ar' ? 'تحديث' : 'Refresh'}>
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/><span className="hidden 2xl:inline">{language === 'fr' ? 'Actualiser' : language === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>
          {/* Local database sync indicator (Admin / Manager / Reception only) */}
          {uiCaps.canUseAdminSystemTools && (
            <button
              type="button"
              onClick={() => setIsIndexedDBOpen(true)}
              className="hidden lg:flex h-9 px-2 2xl:px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          )}

          {/* USB Hardware Button (Key card / Lock roles only) */}
          {uiCaps.canUseUsbTools && (
            <button
              type="button"
              onClick={handlePhysicalUsbClick}
              className={`hidden lg:flex h-9 px-2 xl:px-2.5 rounded-xl border text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
              <span className="whitespace-nowrap hidden xl:inline">
                USB
                <span className="hidden 2xl:inline">
                  {' '}• {usbStatus === 'connected' ? (usbDevice?.readerLabel ?? (language === 'fr' ? 'Prêt' : language === 'ar' ? 'جاهز' : 'Ready')) : (language === 'fr' ? 'Connecter' : language === 'ar' ? 'اتصال' : 'Connect')}
                </span>
              </span>
            </button>
          )}

          {/* Global Currency Switcher (Finance / Booking roles only) */}
          {uiCaps.canUseCurrencySwitcher && (
            <div className="pms-app-topbar-currency hidden sm:flex h-9 items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 shadow-2xs shrink-0">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1 rtl:mr-0 rtl:ml-1 font-sans hidden 2xl:inline">
                {language === 'fr' ? 'Devise:' : language === 'ar' ? 'العملة:' : 'Currency:'}
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label={language === 'fr' ? 'Devise globale' : language === 'ar' ? 'العملة العامة' : 'Global currency'}
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
          )}

          {/* Primary Action Button: + Nouveau */}
          {(activeRoleDefinition.permissions.canManageBookings || activeRoleDefinition.permissions.isClientPortal) && (
            <button
              type="button"
              onClick={() => {
                setNewBookingInitialSlot(null);
                setIsNewBookingModalOpen(true);
              }}
              className="h-9 w-9 lg:w-auto lg:px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === 'fr' ? 'Créer une nouvelle réservation' : language === 'ar' ? 'إنشاء حجز جديد' : 'Create new booking'}
              aria-label={language === 'fr' ? 'Nouvelle réservation' : language === 'ar' ? 'حجز جديد' : 'New booking'}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span className="hidden lg:inline">{language === 'fr' ? 'Nouveau' : language === 'ar' ? 'حجز جديد' : 'New'}</span>
            </button>
          )}

          {/* More Menu [⋮] */}
          <div className="relative shrink-0 overflow-visible" ref={moreMenuRef}>
            <button
              type="button"
              onClick={toggleMoreMenu}
              aria-haspopup="menu"
              aria-expanded={isMoreMenuOpen}
              className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={language === 'fr' ? 'Options supplémentaires' : language === 'ar' ? 'خيارات إضافية' : 'More options'}
              aria-label={language === 'fr' ? 'Options' : language === 'ar' ? 'خيارات' : 'Options'}
            >
              <MoreVertical size={16} />
              {(cloudSyncStatus.phase === 'error' || cloudSyncStatus.pendingCount > 0) && (
                <span
                  className={`sm:hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                    cloudSyncStatus.phase === 'error' ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              )}
            </button>

            {isMoreMenuOpen && moreMenuRect && typeof document !== 'undefined' && createPortal(
              <div
                ref={morePopoverRef}
                role="menu"
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{
                  position: 'fixed',
                  top: `${moreMenuRect.top}px`,
                  left: `${moreMenuRect.left}px`,
                  width: `${moreMenuRect.width}px`,
                  maxHeight: `${moreMenuRect.maxHeight}px`,
                }}
                className="overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-[140] text-xs space-y-1 pms-dropdown pms-dropdown-end text-slate-700 dark:text-slate-200"
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

                {/* Operational notifications are nested in More on phones to keep the header compact. */}
                {!currentRoleObj.permissions.isClientPortal && (
                  <button
                    type="button"
                    data-testid="mobile-staff-notifications-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsMobileNotificationAnchor(true);
                      setNotifMenuRect(computeClampedPopoverRect(moreMenuRef.current, 320, !isRtlDir));
                      setIsNotifMenuOpen(true);
                      setIsMoreMenuOpen(false);
                      setIsSectorMenuOpen(false);
                      setIsRoleMenuOpen(false);
                    }}
                    className="sm:hidden w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left rtl:text-right"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Bell size={14} className="text-amber-500 shrink-0" />
                      <span className="truncate font-semibold">
                        {language === 'fr' ? 'Notifications opérationnelles' : language === 'ar' ? 'إشعارات العمل' : 'Operational notifications'}
                      </span>
                    </span>
                    {unreadNotifCount > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white tabular-nums">
                        {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                      </span>
                    )}
                  </button>
                )}

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

                {/* Tablet & Mobile quick tools (hidden in Row 1 below lg to prevent clipping) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsRefreshing(true);
                    window.dispatchEvent(new CustomEvent('appointment-refresh-request', { detail: { onComplete: () => setIsRefreshing(false) } }));
                    setIsMoreMenuOpen(false);
                  }}
                  className="lg:hidden w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left rtl:text-right"
                >
                  <RefreshCw size={14} className="text-slate-500 shrink-0" />
                  <span>{language === 'fr' ? 'Actualiser toutes les pages' : language === 'ar' ? 'تحديث جميع الصفحات' : 'Refresh all pages'}</span>
                </button>

                {uiCaps.canUseUsbTools && (
                  <button
                    type="button"
                    onClick={() => {
                      void handlePhysicalUsbClick();
                      setIsMoreMenuOpen(false);
                    }}
                    className="lg:hidden w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left rtl:text-right"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Usb size={14} className={usbStatus === 'connected' ? 'text-emerald-500 shrink-0' : 'text-slate-500 shrink-0'} />
                      <span className="truncate">
                        {usbStatus === 'connected'
                          ? (language === 'fr' ? 'Encodeur proUSB (Connecté)' : language === 'ar' ? 'مبرمج proUSB (متصل)' : 'proUSB Encoder (Connected)')
                          : (language === 'fr' ? 'Connecter Encodeur USB' : language === 'ar' ? 'توصيل مبرمج USB' : 'Connect USB Encoder')}
                      </span>
                    </span>
                  </button>
                )}

                {uiCaps.canUseCurrencySwitcher && (
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
                )}

                {/* Establishment Setup */}
                {uiCaps.canUseAdminSystemTools && (
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
                )}

                {/* Local data inspector */}
                {uiCaps.canUseAdminSystemTools && (
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
                )}

                {/* Event Log shortcut */}
                {activeRoleDefinition.allowedTabs.includes('events') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('events');
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left rtl:text-right"
                  >
                    <History size={14} className="text-indigo-500 shrink-0" />
                    <span>{getTranslation('navEventLog', language)}</span>
                  </button>
                )}

                {/* CI/CD & AGENTS.md Specs */}
                {uiCaps.canUseAdminSystemTools && (
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
                )}

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
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      <div className="hidden sm:block"><LanDiscoveryStatus /></div>

    </header>
  );
};
