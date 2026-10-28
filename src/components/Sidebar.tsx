import React, { useState } from 'react';
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
    activeSector,
    setActiveSector,
    setIsCockpitOpen,
    setIsLegalModalOpen,
    setIsObjectBoxOpen,
    isSidebarMobileOpen,
    setIsSidebarMobileOpen,
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState(false);

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
      id: 'reports',
      label: language === 'fr' ? 'Rapports d\'Activité' : language === 'ar' ? 'التقارير والإحصائيات' : 'Performance Reports',
      icon: FileText,
      view: 'reports' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
  ];

  const navItems = allNavItems.filter(
    (item) => item.roles.includes(currentRole) && item.domains.includes(currentDomain)
  );

  const handleNavClick = (view: any) => {
    setActiveView(view);
    setIsSidebarMobileOpen(false);
  };

  const renderContent = (isMobileView: boolean) => (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Brand Header */}
      <div className="min-h-14 border-b border-slate-800 px-3.5 flex items-center justify-between shrink-0 bg-slate-950/60">
        {(!isCollapsed || isMobileView) && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              OB
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

      {/* Sector Quick Switcher inside Sidebar */}
      {(!isCollapsed || isMobileView) && (
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block mb-2 px-1">
            {language === 'fr' ? 'Département Actif' : language === 'ar' ? 'القطاع النشط' : 'Department'}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveSector('hotel');
                setCurrentDomain('hotel');
              }}
              className={`min-h-[38px] p-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
                currentDomain === 'hotel'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Hôtellerie & Séjours"
            >
              <Hotel size={15} />
              <span className="text-xs truncate">Hôtel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSector('resort');
                setCurrentDomain('resort');
              }}
              className={`min-h-[38px] p-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
                currentDomain === 'resort'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Resort, Complexe & Villas"
            >
              <Palmtree size={15} />
              <span className="text-xs truncate">Resort</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.view)}
              className={`w-full flex items-center gap-3 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
      <div className="p-2.5 border-t border-slate-800 space-y-1.5 bg-slate-950/80 shrink-0">
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
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 transition-all duration-200 z-30 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer (Modal Overlay) */}
      {isSidebarMobileOpen && (
        <div className="fixed inset-0 z-[9990] md:hidden flex animate-in fade-in">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-300 h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
