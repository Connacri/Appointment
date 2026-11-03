import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  BarChart3,
  Hotel,
  Palmtree,
  Sparkles,
  Database,
  ClipboardList,
  Boxes,
  KeyRound,
  ShieldCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Coins,
  Globe,
  Flower2,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { domainConfigs } from '../data/mockData';
import { DomainType } from '../types/booking';

export const Sidebar: React.FC = () => {
  const {
    language,
    activeView,
    setActiveView,
    currentDomain,
    setCurrentDomain,
    currentRole,
    setCurrentRole,
    activeSector,
    setActiveSector,
    setIsCockpitOpen,
    setIsLegalModalOpen,
    setIsObjectBoxOpen,
    setIsAboutModalOpen,
    isSidebarMobileOpen,
    setIsSidebarMobileOpen,
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const isRtl = language === 'ar';

  // Keep the page fixed while the mobile navigation drawer is open.
  useEffect(() => {
    if (!isSidebarMobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarMobileOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSidebarMobileOpen, setIsSidebarMobileOpen]);

  // Strictly filter navigation items by Role AND Domain for Hotel & Resort
  const allNavItems = [
    {
      id: 'planning',
      label: language === 'fr' ? 'Planning Gantt' : language === 'ar' ? 'مخطط الحجوزات' : 'Gantt Planning',
      icon: CalendarDays,
      view: 'planning' as const,
      roles: ['manager', 'receptionist', 'staff', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'analytics',
      label: currentDomain === 'resort'
        ? (language === 'fr' ? 'Analytics Resort & Villas (D3)' : 'Resort Analytics (D3)')
        : (language === 'fr' ? 'Booking Analytics (D3)' : 'Booking Analytics (D3)'),
      icon: BarChart3,
      view: 'analytics' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'billing',
      label: language === 'fr' ? 'Facturation & Devis' : language === 'ar' ? 'الفواتير وعروض الأسعار' : 'Billing & Quotes',
      icon: Receipt,
      view: 'billing' as const,
      roles: ['manager', 'receptionist', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'my_bookings',
      label: currentDomain === 'resort'
        ? (language === 'fr' ? 'Séjours & Villas Resort' : 'Resort Bookings')
        : (language === 'fr' ? 'Séjours & Réservations' : 'My Bookings'),
      icon: LayoutDashboard,
      view: 'my_bookings' as const,
      roles: ['manager', 'receptionist', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'housekeeping',
      label: currentDomain === 'resort'
        ? (language === 'fr' ? 'Gouvernance & Entretien Villas' : 'Resort Housekeeping')
        : (language === 'fr' ? 'Housekeeping & Étages' : 'Housekeeping & Rooms'),
      icon: Sparkles,
      view: 'housekeeping' as const,
      roles: ['manager', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'tasks',
      label: language === 'fr' ? 'Tâches PMS & Remise en État' : language === 'ar' ? 'مهام التشغيل والصيانة' : 'PMS Tasks',
      icon: ClipboardList,
      view: 'tasks' as const,
      roles: ['manager', 'receptionist', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'stock',
      label: language === 'fr' ? 'Stock & Équipements' : language === 'ar' ? 'المخزون والمستلزمات' : 'Inventory & Supplies',
      icon: Boxes,
      view: 'stock' as const,
      roles: ['manager', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'pricing',
      label: language === 'fr' ? 'Yield & Tarifs Dynamiques' : language === 'ar' ? 'التسعير الديناميكي' : 'Yield & Pricing',
      icon: Coins,
      view: 'pricing' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'channels',
      label: language === 'fr' ? 'Channel Manager (OTA)' : language === 'ar' ? 'مدير القنوات الموزعة' : 'Channel Manager',
      icon: Globe,
      view: 'channels' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'prousb',
      label: 'Serrures proUSB (WebHID)',
      icon: KeyRound,
      view: 'prousb' as const,
      roles: ['manager', 'receptionist'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'spa',
      label: language === 'fr' ? 'Spa & Espace Bien-Être' : language === 'ar' ? 'السبا والعافية' : 'Spa & Wellness',
      icon: Flower2,
      view: 'spa' as const,
      roles: ['manager', 'receptionist', 'client', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'reports',
      label: language === 'fr' ? 'Rapports d\'Activité' : language === 'ar' ? 'التقارير والإحصائيات' : 'Performance Reports',
      icon: FileText,
      view: 'reports' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
  ];

  const navItems = allNavItems.filter(
    (item) => (currentRole === 'admin' || item.roles.includes(currentRole)) && item.domains.includes(currentDomain)
  );

  const handleNavClick = (view: any) => {
    setActiveView(view);
    setIsSidebarMobileOpen(false);
  };

  const renderContent = (isMobileView: boolean) => (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Brand Header */}
      <div className="min-h-[68px] border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0 bg-slate-950">
        {(!isCollapsed || isMobileView) && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              AP
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-sm tracking-tight leading-none truncate">
                {getTranslation('brandName', language)}
              </span>
              <span className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                Front Desk & Resort PMS
              </span>
            </div>
          </div>
        )}

        {isMobileView ? (
          <button
            type="button"
            onClick={() => setIsSidebarMobileOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-auto"
            title="Fermer le menu"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-auto cursor-pointer"
            title={isCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
          >
            {isCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        )}
      </div>

      {/* Mobile Domain & Role Switcher inside Drawer */}
      {isMobileView && (
        <div className="px-3 py-2.5 border-b border-slate-800/80 bg-slate-950/60 space-y-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              {language === 'fr' ? 'Secteur :' : language === 'ar' ? 'القطاع:' : 'Sector:'}
            </span>
            <div className="flex-1 grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentDomain('hotel')}
                className={`py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentDomain === 'hotel'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Hotel size={13} />
                <span>{language === 'fr' ? 'Hôtel' : language === 'ar' ? 'فندق' : 'Hotel'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentDomain('resort')}
                className={`py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currentDomain === 'resort'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palmtree size={13} />
                <span>Resort</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              {language === 'fr' ? 'Rôle :' : language === 'ar' ? 'الدور:' : 'Role:'}
            </span>
            <div className="flex-1 flex gap-1 overflow-x-auto p-0.5 bg-slate-900 rounded-lg border border-slate-800">
              {[
                { id: 'admin', label: 'Admin' },
                { id: 'manager', label: language === 'fr' ? 'Gérant' : 'Manager' },
                { id: 'receptionist', label: language === 'fr' ? 'Réception' : 'Front' },
                { id: 'staff', label: language === 'fr' ? 'Étage' : 'Staff' },
                { id: 'client', label: language === 'fr' ? 'Client' : 'Guest' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCurrentRole(r.id as any)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded whitespace-nowrap cursor-pointer transition-colors ${
                    currentRole === r.id
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav aria-label={language === "fr" ? "Navigation principale" : language === "ar" ? "التنقل الرئيسي" : "Main navigation"} className="flex-1 py-3 px-2.5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.view)}
              aria-current={isActive ? "page" : undefined}
              className={`workspace-nav-item w-full flex items-center gap-3 px-3 min-h-11 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
              title={item.label}
            >
              <Icon size={18} className="shrink-0" />
              {(!isCollapsed || isMobileView) && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer: ObjectBox DB, AGENTS.md Cockpit & Legal */}
      <div className="p-3 border-t border-slate-800/80 space-y-1.5 bg-slate-950 shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsObjectBoxOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
          title="Inspecteur ObjectBox Embedded DB Engine"
        >
          <Database size={16} className="text-cyan-400 shrink-0" />
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">Base ObjectBox</span>
              <span className="text-[10px] text-slate-400 font-mono">Embarquée</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsCockpitOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
          title="Contrat de développement & Spécifications AGENTS.md"
        >
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">Spécifications CI/CD</span>
              <span className="text-[10px] text-emerald-400 font-mono">AGENTS.md</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsLegalModalOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
          title="Politique de Confidentialité et Suppression de Compte (AGENTS.md §19.3)"
        >
          <FileText size={16} className="shrink-0" />
          {(!isCollapsed || isMobileView) && (
            <span className="truncate">
              {language === 'fr' ? 'Légal & Confidentialité' : language === 'ar' ? 'الخصوصية والحساب' : 'Legal & Privacy'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsAboutModalOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-cyan-400 hover:text-cyan-200 bg-cyan-950/40 border border-cyan-800/40 hover:bg-cyan-900/40 transition-colors cursor-pointer"
          title="À Propos de FORSLOG LTD et du Développeur S.M. Ramzi Guedouar"
        >
          <Info size={16} className="shrink-0 text-cyan-400" />
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{language === 'fr' ? 'À Propos' : language === 'ar' ? 'حول النظام' : 'About'}</span>
              <span className="text-[10px] text-cyan-300 font-mono bg-cyan-900/60 px-1.5 py-0.5 rounded">FORSLOG</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`workspace-sidebar hidden md:flex bg-slate-950 text-slate-300 flex-col shrink-0 border-r border-slate-800/80 transition-[width] duration-200 ease-out z-30 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer (Modal Overlay) */}
      {isSidebarMobileOpen && (
        <div
          className="fixed inset-0 z-[9990] md:hidden flex animate-in fade-in"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <button
            type="button"
            aria-label={language === 'fr' ? 'Fermer le menu' : language === 'ar' ? 'إغلاق القائمة' : 'Close navigation'}
            className="absolute inset-0 w-full h-full bg-slate-950/70 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsSidebarMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={language === 'fr' ? 'Navigation principale' : language === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}
            className={`relative z-10 flex h-[100dvh] w-[min(20rem,88vw)] max-w-[88vw] flex-col bg-slate-900 text-slate-300 shadow-2xl overscroll-contain animate-in duration-200 ${
              isRtl ? 'mr-auto slide-in-from-right' : 'ml-0 slide-in-from-left'
            }`}
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
