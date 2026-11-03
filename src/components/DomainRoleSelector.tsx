import React from 'react';
import {
  Hotel,
  Palmtree,
  UserCheck,
  Shield,
  Crown,
  Briefcase,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DomainType, UserRole } from '../types/booking';
import { domainConfigs } from '../data/mockData';

export const DomainRoleSelector: React.FC = () => {
  const { currentDomain, setCurrentDomain, currentRole, setCurrentRole, language } = useApp();

  const domainIcons: Record<DomainType, any> = {
    hotel: Hotel,
    resort: Palmtree,
  };

  const roles: { id: UserRole; label: { fr: string; en: string; ar: string }; shortLabel: string; icon: any }[] = [
    { id: 'admin', label: { fr: 'Administrateur', en: 'Administrator', ar: 'مدير النظام' }, shortLabel: 'Admin', icon: Crown },
    {
      id: 'manager',
      label: { fr: 'Directeur / Gérant', en: 'General Manager', ar: 'المدير العام' },
      shortLabel: 'Gérant',
      icon: Shield,
    },
    {
      id: 'receptionist',
      label: { fr: 'Réception / Accueil', en: 'Front Desk Reception', ar: 'الاستقبال' },
      shortLabel: 'Réception',
      icon: Briefcase,
    },
    {
      id: 'staff',
      label: { fr: 'Personnel / Étage / Maintenance', en: 'Staff & Operations', ar: 'الخدمة' },
      shortLabel: 'Étage',
      icon: UserCheck,
    },
    {
      id: 'client',
      label: { fr: 'Client / Guest (Pass QR Code)', en: 'Guest (QR Pass)', ar: 'النزيل' },
      shortLabel: 'Client',
      icon: Users,
    },
  ];

  return (
    <div className="workspace-contextbar relative z-[500] bg-slate-950 border-b border-slate-800/80 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
      {/* Domains Strip */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
          {language === 'fr' ? 'Secteur :' : language === 'ar' ? 'القطاع:' : 'Sector:'}
        </span>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(Object.keys(domainConfigs) as DomainType[]).map((dom) => {
            const cfg = domainConfigs[dom];
            const Icon = domainIcons[dom] || Hotel;
            const isActive = currentDomain === dom;

            return (
              <button
                key={dom}
                type="button"
                onClick={() => setCurrentDomain(dom)}
                aria-pressed={isActive}
                className={`min-h-10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                  isActive
                    ? dom === 'resort'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon size={14} />
                <span>{cfg.label[language] || cfg.label.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role Strip */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 hidden sm:inline">
          {language === 'fr' ? 'Rôle Actif :' : language === 'ar' ? 'الدور:' : 'Role:'}
        </span>

        <div className="flex max-w-full items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1 overflow-x-auto">
          {roles.map((r) => {
            const Icon = r.icon;
            const isRoleActive = currentRole === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setCurrentRole(r.id)}
                aria-pressed={isRoleActive}
                className={`min-h-10 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isRoleActive
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title={r.label[language] || r.label.en}
              >
                <Icon size={13} />
                <span className="hidden md:inline">{r.label[language] || r.label.en}</span>
                <span className="md:hidden">{r.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
