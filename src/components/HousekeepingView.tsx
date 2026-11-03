import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Bed,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const HousekeepingView: React.FC = () => {
  const { resourceGroups, updateHousekeepingStatus, language, currentDomain } = useApp();

  const activeGroups = resourceGroups.filter((g) => g.sector === currentDomain);
  const allRooms = activeGroups.flatMap((g) => g.resources);

  const cleanCount = allRooms.filter((r) => r.housekeepingStatus === 'clean').length;
  const cleaningCount = allRooms.filter((r) => r.housekeepingStatus === 'cleaning').length;
  const dirtyCount = allRooms.filter((r) => r.housekeepingStatus === 'dirty').length;
  const oooCount = allRooms.filter((r) => r.housekeepingStatus === 'out_of_order').length;

  const isResort = currentDomain === 'resort';
  const unitLabel = isResort
    ? (language === 'fr' ? 'Villas & Bungalows' : language === 'ar' ? 'الفلل والشاليهات' : 'Villas & Bungalows')
    : (language === 'fr' ? 'Chambres & Étages' : language === 'ar' ? 'الغرف والطوابق' : 'Rooms & Floors');

  return (
    <div className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles size={20} className="text-emerald-500" />
          <span>
            {language === 'fr'
              ? `Gouvernance & Entretien (${unitLabel})`
              : language === 'ar'
              ? `إدارة نظافة وتجهيز (${unitLabel})`
              : `Housekeeping & Turnover (${unitLabel})`}
          </span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {isResort
            ? (language === 'fr'
                ? 'Gestion des rotations de villas, contrôle des piscines privées et certification propreté'
                : 'Villa turnaround control, private pool checks, and luxury cleanliness certification')
            : (language === 'fr'
                ? 'Gestion des rotations de chambres, fenêtres de désinfection et contrôle qualité'
                : 'Room turnover control, sanitation windows, and housekeeping quality assurance')}
        </p>
      </div>

      {/* Overview Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Prêtes & Propres</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {cleanCount}
            </span>
          </div>
          <CheckCircle2 size={24} className="text-emerald-500 opacity-80" />
        </div>

        <div className="min-w-0 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">En Nettoyage</span>
            <span className="text-2xl font-bold font-mono text-amber-500">
              {cleaningCount}
            </span>
          </div>
          <Clock size={24} className="text-amber-500 opacity-80" />
        </div>

        <div className="min-w-0 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">À Nettoyer</span>
            <span className="text-2xl font-bold font-mono text-rose-500">
              {dirtyCount}
            </span>
          </div>
          <AlertTriangle size={24} className="text-rose-500 opacity-80" />
        </div>

        <div className="min-w-0 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Hors Service</span>
            <span className="text-2xl font-bold font-mono text-slate-400">
              {oooCount}
            </span>
          </div>
          <RotateCcw size={24} className="text-slate-400 opacity-80" />
        </div>
      </div>

      {/* Room Turnover Matrix */}
      <div className="space-y-4">
        {activeGroups.map((grp) => (
          <div
            key={grp.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-3 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Bed size={16} className="text-blue-500" />
                <span>{grp.name[language] || grp.name.en}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {grp.resources.length} {isResort ? 'unités' : 'chambres'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {grp.resources.map((res) => {
                const status = res.housekeepingStatus || 'clean';
                return (
                  <div
                    key={res.id}
                    className="min-w-0 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate font-bold text-xs text-slate-800 dark:text-slate-200">
                        {res.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          status === 'clean'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : status === 'cleaning'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : status === 'dirty'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {status === 'clean'
                          ? 'Propre'
                          : status === 'cleaning'
                          ? 'En cours'
                          : status === 'dirty'
                          ? 'À nettoyer'
                          : 'Maintenance'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[10px] sm:text-[11px] pt-1">
                      <button
                        onClick={() => updateHousekeepingStatus(res.id, 'clean')}
                        className={`min-h-9 px-1 rounded-lg text-center font-semibold transition-colors ${
                          status === 'clean'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100'
                        }`}
                      >
                        Propre
                      </button>
                      <button
                        onClick={() => updateHousekeepingStatus(res.id, 'cleaning')}
                        className={`min-h-9 px-1 rounded-lg text-center font-semibold transition-colors ${
                          status === 'cleaning'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100'
                        }`}
                      >
                        Lavage
                      </button>
                      <button
                        onClick={() => updateHousekeepingStatus(res.id, 'dirty')}
                        className={`min-h-9 px-1 rounded-lg text-center font-semibold transition-colors ${
                          status === 'dirty'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100'
                        }`}
                      >
                        Sale
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
