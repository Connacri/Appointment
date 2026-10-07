import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Globe,
  BarChart3,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Hotel,
  Stethoscope,
  Sparkles,
  Database,
  Receipt,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { domainConfigs } from '../data/mockData';

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
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Strictly filter navigation items by Role to never mix responsibilities
  const allNavItems = [
    {
      id: 'planning',
      label: language === 'fr' ? 'Planning Gantt' : language === 'ar' ? 'مخطط الحجوزات' : 'Gantt Planning',
      icon: CalendarDays,
      view: 'planning' as const,
      roles: ['manager', 'receptionist', 'staff', 'client'],
    },
    {
      id: 'analytics',
      label: language === 'fr' ? 'Booking Analytics (D3)' : language === 'ar' ? 'تحليلات الحجوزات D3' : 'Booking Analytics (D3)',
      icon: BarChart3,
      view: 'analytics' as const,
      roles: ['manager'],
    },
    {
      id: 'billing',
      label: language === 'fr' ? 'Facturation & Devis' : language === 'ar' ? 'الفواتير والعروض' : 'Billing & Quotes',
      icon: Receipt,
      view: 'billing' as const,
      roles: ['manager', 'receptionist', 'client'],
    },
    {
      id: 'my_bookings',
      label: getTranslation('navMyBookings', language),
      icon: LayoutDashboard,
      view: 'my_bookings' as const,
      roles: ['manager', 'receptionist', 'client'],
    },
    {
      id: 'housekeeping',
      label:
        currentDomain === 'clinic'
          ? (language === 'fr' ? 'Salles & Stérilisation' : 'Rooms & Sterilization')
          : currentDomain === 'restaurant'
          ? (language === 'fr' ? 'Tables & Mise en Place' : 'Tables & Setup')
          : (language === 'fr' ? 'Housekeeping & Étages' : 'Housekeeping & Rooms'),
      icon: Sparkles,
      view: 'housekeeping' as const,
      roles: ['manager', 'staff'],
    },
    {
      id: 'channels',
      label: language === 'fr' ? 'Channel Manager (OTA)' : language === 'ar' ? 'إدارة القنوات' : 'Channel Manager (OTA)',
      icon: Globe,
      view: 'channels' as const,
      roles: ['manager', 'receptionist'],
    },
    {
      id: 'reports',
      label: language === 'fr' ? 'Rapports & Chiffres' : language === 'ar' ? 'التقارير المالية' : 'Financial Reports',
      icon: CreditCard,
      view: 'reports' as const,
      roles: ['manager'],
    },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(currentRole));

  return (
    <aside
      className={`bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-14 border-b border-slate-800 flex items-center justify-between px-3">
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm tracking-tighter">
              OB
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm tracking-tight leading-none">
                {getTranslation('brandName', language)}
              </span>
              <span className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5">
                Front Desk & Clinic
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-auto"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Sector Quick Switcher inside Sidebar */}
      {!isCollapsed && (
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 block mb-2 px-1">
            {language === 'fr' ? 'Départements' : language === 'ar' ? 'الأقسام' : 'Departments'}
          </span>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => {
                setActiveSector('hotel');
                setCurrentDomain('hotel');
              }}
              className={`p-1.5 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                currentDomain === 'hotel'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Hôtellerie"
            >
              <Hotel size={14} />
              <span className="text-[9px] truncate">Hôtel</span>
            </button>

            <button
              onClick={() => {
                setActiveSector('clinic');
                setCurrentDomain('clinic');
              }}
              className={`p-1.5 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                currentDomain === 'clinic'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Clinique"
            >
              <Stethoscope size={14} />
              <span className="text-[9px] truncate">Clinique</span>
            </button>

            <button
              onClick={() => {
                setActiveSector('wellness');
                setCurrentDomain('wellness');
              }}
              className={`p-1.5 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                currentDomain === 'wellness'
                  ? 'bg-purple-600 text-white font-medium'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Spa & Wellness"
            >
              <Sparkles size={14} />
              <span className="text-[9px] truncate">Spa / RDV</span>
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
              onClick={() => setActiveView(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Secondary mock items matching the screenshot */}
        <div className="pt-2 mt-2 border-t border-slate-800/60 space-y-1">
          <button
            onClick={() => setActiveView('billing')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeView === 'billing'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <CreditCard size={18} className="shrink-0" />
            {!isCollapsed && <span>{language === 'fr' ? 'Facturation & Devis' : language === 'ar' ? 'الفواتير والعروض' : 'Billing & Quotes'}</span>}
          </button>

          <button
            onClick={() => setActiveView('channels')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeView === 'channels'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Globe size={18} className="shrink-0" />
            {!isCollapsed && <span>{language === 'fr' ? 'Channel Manager' : language === 'ar' ? 'إدارة القنوات' : 'Channel Manager'}</span>}
          </button>

          <button
            onClick={() => setActiveView('channels')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell size={18} className="shrink-0" />
              {!isCollapsed && <span>{language === 'fr' ? 'Alertes OTA' : language === 'ar' ? 'التنبيهات' : 'OTA Alerts'}</span>}
            </div>
            {!isCollapsed && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                4
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Sidebar Footer: ObjectBox DB, AGENTS.md Cockpit & Legal */}
      <div className="p-2 border-t border-slate-800 space-y-1 bg-slate-950/60">
        <button
          onClick={() => setIsObjectBoxOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/50 transition-colors"
          title="ObjectBox Embedded DB Engine"
        >
          <Database size={16} className="text-cyan-400 shrink-0" />
          {!isCollapsed && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">ObjectBox DB</span>
              <span className="px-1.5 py-0.2 bg-cyan-500 text-slate-950 font-bold rounded text-[10px]">
                Sync
              </span>
            </div>
          )}
        </button>

        <button
          onClick={() => setIsCockpitOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50 transition-colors"
          title="AGENTS.md Health Scorecard"
        >
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          {!isCollapsed && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">AGENTS.md</span>
              <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-bold rounded text-[10px]">
                98/100
              </span>
            </div>
          )}
        </button>

        <button
          onClick={() => setIsLegalModalOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Privacy & Data Deletion (§19.3)"
        >
          <FileText size={16} className="shrink-0" />
          {!isCollapsed && (
            <span className="truncate">
              {language === 'fr' ? 'Légal & Compte' : language === 'ar' ? 'الخصوصية والحساب' : 'Legal & Account'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
