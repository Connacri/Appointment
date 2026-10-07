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
  const { resourceGroups, updateHousekeepingStatus, language } = useApp();

  const hotelGroups = resourceGroups.filter((g) => g.sector === 'hotel');
  const allRooms = hotelGroups.flatMap((g) => g.resources);

  const cleanCount = allRooms.filter((r) => r.housekeepingStatus === 'clean').length;
  const cleaningCount = allRooms.filter((r) => r.housekeepingStatus === 'cleaning').length;
  const dirtyCount = allRooms.filter((r) => r.housekeepingStatus === 'dirty').length;
  const oooCount = allRooms.filter((r) => r.housekeepingStatus === 'out_of_order').length;

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles size={20} className="text-emerald-500" />
          <span>
            {language === 'fr'
              ? 'Gouvernance & Statuts d\'Entretien (Housekeeping)'
              : language === 'ar'
              ? 'إدارة نظافة وتجهيز الغرف'
              : 'Housekeeping & Turnaround Management'}
          </span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {language === 'fr'
            ? 'Gestion des rotations de chambres, fenêtres de désinfection et contrôle qualité'
            : 'Room turnover control, sanitation windows, and housekeeping quality assurance'}
        </p>
      </div>

      {/* Overview Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Prêtes & Propres</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {cleanCount}
            </span>
          </div>
          <CheckCircle2 size={24} className="text-emerald-500 opacity-80" />
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">En Nettoyage</span>
            <span className="text-2xl font-bold font-mono text-amber-500">
              {cleaningCount}
            </span>
          </div>
          <Clock size={24} className="text-amber-500 opacity-80" />
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">À Nettoyer</span>
            <span className="text-2xl font-bold font-mono text-rose-500">
              {dirtyCount}
            </span>
          </div>
          <AlertTriangle size={24} className="text-rose-500 opacity-80" />
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
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
        {hotelGroups.map((grp) => (
          <div
            key={grp.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Bed size={16} className="text-blue-500" />
                <span>{grp.name[language] || grp.name.en}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {grp.resources.length} chambres
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {grp.resources.map((res) => {
                const status = res.housekeepingStatus || 'clean';
                return (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
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

                    <div className="flex items-center gap-1 text-[11px] pt-1">
                      <button
                        onClick={() => updateHousekeepingStatus(res.id, 'clean')}
                        className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                          status === 'clean'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100'
                        }`}
                      >
                        Propre
                      </button>
                      <button
                        onClick={() => updateHousekeepingStatus(res.id, 'cleaning')}
                        className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                          status === 'cleaning'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100'
                        }`}
                      >
                        Lavage
                      </button>
                      <button
                        onClick={() => updateHousekeepingStatus(res.id, 'dirty')}
                        className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
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
