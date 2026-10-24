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
  ClipboardList,
  Boxes,
  Coins,
  KeyRound,
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
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Strictly filter navigation items by Role AND Domain to NEVER mix establishment screens
  const allNavItems = [
    {
      id: 'planning',
      label: language === 'fr' ? 'Planning Gantt' : language === 'ar' ? 'مخطط الحجوزات' : 'Gantt Planning',
      icon: CalendarDays,
      view: 'planning' as const,
      roles: ['manager', 'receptionist', 'staff', 'client'],
      domains: ['hotel', 'residence', 'restaurant', 'clinic', 'doctor', 'administration', 'wellness', 'other'] as DomainType[],
    },
    {
      id: 'analytics',
      label:
        currentDomain === 'clinic' || currentDomain === 'doctor'
          ? (language === 'fr' ? 'Analytique Médicale (D3)' : 'Clinical Analytics (D3)')
          : currentDomain === 'restaurant'
          ? (language === 'fr' ? 'Analytique Restauration (D3)' : 'Restaurant Analytics (D3)')
          : (language === 'fr' ? 'Booking Analytics (D3)' : 'Booking Analytics (D3)'),
      icon: BarChart3,
      view: 'analytics' as const,
      roles: ['manager'],
      domains: ['hotel', 'residence', 'restaurant', 'clinic', 'doctor', 'wellness'] as DomainType[],
    },
    {
      id: 'billing',
      label:
        currentDomain === 'clinic' || currentDomain === 'doctor'
          ? (language === 'fr' ? 'Honoraires & Factures' : 'Medical Billing')
          : currentDomain === 'restaurant'
          ? (language === 'fr' ? 'Additions & Encaissement' : 'Dining Checks & Billing')
          : (language === 'fr' ? 'Facturation & Devis' : 'Billing & Quotes'),
      icon: Receipt,
      view: 'billing' as const,
      roles: ['manager', 'receptionist', 'client'],
      domains: ['hotel', 'residence', 'restaurant', 'clinic', 'doctor', 'wellness', 'administration', 'other'] as DomainType[],
    },
    {
      id: 'my_bookings',
      label:
        currentDomain === 'clinic' || currentDomain === 'doctor'
          ? (language === 'fr' ? 'Dossiers Patients & RDV' : 'Patient Appointments')
          : currentDomain === 'restaurant'
          ? (language === 'fr' ? 'Réservations de Tables' : 'Table Reservations')
          : currentDomain === 'administration'
          ? (language === 'fr' ? 'Rendez-vous Usagers' : 'Public Appointments')
          : (language === 'fr' ? 'Séjours & Réservations' : 'My Bookings'),
      icon: LayoutDashboard,
      view: 'my_bookings' as const,
      roles: ['manager', 'receptionist', 'client'],
      domains: ['hotel', 'residence', 'restaurant', 'clinic', 'doctor', 'wellness', 'administration', 'other'] as DomainType[],
    },
    {
      id: 'housekeeping',
      label: language === 'fr' ? 'Housekeeping & Étages' : 'Housekeeping & Rooms',
      icon: Sparkles,
      view: 'housekeeping' as const,
      roles: ['manager', 'staff'],
      domains: ['hotel', 'residence'] as DomainType[], // Strictly for hotel & residence!
    },
    {
      id: 'tasks',
      label:
        currentDomain === 'clinic' || currentDomain === 'doctor'
          ? (language === 'fr' ? 'Protocoles & Stérilisation' : 'Clinical Protocols')
          : currentDomain === 'restaurant'
          ? (language === 'fr' ? 'Mise en Place & Salle' : 'Mise en Place')
          : (language === 'fr' ? 'Tâches PMS & Remise en État' : 'PMS Tasks'),
      icon: ClipboardList,
      view: 'tasks' as const,
      roles: ['manager', 'receptionist', 'staff'],
      domains: ['hotel', 'residence', 'clinic', 'doctor', 'restaurant', 'wellness'] as DomainType[],
    },
    {
      id: 'stock',
      label:
        currentDomain === 'clinic' || currentDomain === 'doctor'
          ? (language === 'fr' ? 'Pharmacie & Matériel' : 'Medical Supplies')
          : currentDomain === 'restaurant'
          ? (language === 'fr' ? 'Économat & Ingrédients' : 'F&B Inventory')
          : (language === 'fr' ? 'Stock Linge & Minibar' : 'Linen & Minibar Stock'),
      icon: Boxes,
      view: 'stock' as const,
      roles: ['manager', 'staff'],
      domains: ['hotel', 'residence', 'clinic', 'doctor', 'restaurant', 'wellness'] as DomainType[],
    },
    {
      id: 'pricing',
      label:
        currentDomain === 'wellness'
          ? (language === 'fr' ? 'Tarifs Spa & Forfaits' : 'Spa Dynamic Rates')
          : (language === 'fr' ? 'Yield & Dynamic Pricing' : 'Dynamic Pricing'),
      icon: Coins,
      view: 'pricing' as const,
      roles: ['manager'],
      domains: ['hotel', 'residence', 'wellness'] as DomainType[], // Strictly hotel, residence, wellness!
    },
    {
      id: 'channels',
      label: language === 'fr' ? 'Channel Manager (OTA)' : language === 'ar' ? 'إدارة القنوات' : 'Channel Manager (OTA)',
      icon: Globe,
      view: 'channels' as const,
      roles: ['manager', 'receptionist'],
      domains: ['hotel', 'residence'] as DomainType[], // Strictly hotel & residence!
    },
    {
      id: 'reports',
      label: language === 'fr' ? 'Rapports & Chiffres' : language === 'ar' ? 'التقارير المالية' : 'Financial Reports',
      icon: CreditCard,
      view: 'reports' as const,
      roles: ['manager'],
      domains: ['hotel', 'residence', 'clinic', 'doctor', 'restaurant', 'wellness', 'administration'] as DomainType[],
    },
  ];

  const navItems = allNavItems.filter(
    (item) => item.roles.includes(currentRole) && item.domains.includes(currentDomain)
  );

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
