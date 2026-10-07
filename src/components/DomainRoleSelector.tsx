import React from 'react';
import {
  Hotel,
  Building2,
  UtensilsCrossed,
  Stethoscope,
  Landmark,
  Sparkles,
  UserCheck,
  Shield,
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
    residence: Building2,
    restaurant: UtensilsCrossed,
    clinic: Stethoscope,
    administration: Landmark,
    wellness: Sparkles,
    other: Sparkles,
  };

  const roles: { id: UserRole; label: { fr: string; en: string; ar: string }; icon: any }[] = [
    {
      id: 'manager',
      label: { fr: 'Directeur / Gérant', en: 'General Manager', ar: 'المدير العام' },
      icon: Shield,
    },
    {
      id: 'receptionist',
      label: { fr: 'Réception / Accueil', en: 'Front Desk Reception', ar: 'الاستقبال ومكتب الدخول' },
      icon: Briefcase,
    },
    {
      id: 'staff',
      label: { fr: 'Personnel / Étage / Praticien', en: 'Staff & Operations', ar: 'فريق العمل والخدمة' },
      icon: UserCheck,
    },
    {
      id: 'client',
      label: { fr: 'Portail Client / Patient', en: 'Customer / Patient Portal', ar: 'بوابة العميل / المريض' },
      icon: Users,
    },
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs select-none z-30">
      {/* Domains Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
          {language === 'fr' ? 'Domaine :' : language === 'ar' ? 'القطاع:' : 'Domain:'}
        </span>

        {(Object.keys(domainConfigs) as DomainType[]).map((dom) => {
          const cfg = domainConfigs[dom];
          const Icon = domainIcons[dom] || Hotel;
          const isActive = currentDomain === dom;

          return (
            <button
              key={dom}
              onClick={() => setCurrentDomain(dom)}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold shrink-0 transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs scale-102 ring-1 ring-blue-400'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{cfg.label[language] || cfg.label.en}</span>
            </button>
          );
        })}
      </div>

      {/* Role Strip */}
      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
          {language === 'fr' ? 'Rôle Actif :' : language === 'ar' ? 'الدور:' : 'Role:'}
        </span>

        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          {roles.map((r) => {
            const Icon = r.icon;
            const isRoleActive = currentRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setCurrentRole(r.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  isRoleActive
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={r.label[language] || r.label.en}
              >
                <Icon size={12} />
                <span className="hidden lg:inline">{r.label[language] || r.label.en}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
