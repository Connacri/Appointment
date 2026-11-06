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

  const statusLabels: Record<string, { fr: string; en: string; ar: string; color: string; dot: string }> = {
    clean: {
      fr: 'Propre',
      en: 'Clean',
      ar: 'جاهزة',
      color: 'text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    },
    cleaning: {
      fr: 'En cours',
      en: 'Cleaning',
      ar: 'قيد التنظيف',
      color: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
    dirty: {
      fr: 'À nettoyer',
      en: 'Dirty',
      ar: 'تحتاج تنظيف',
      color: 'text-rose-700 dark:text-rose-400',
      dot: 'bg-rose-500',
    },
    out_of_order: {
      fr: 'Hors service',
      en: 'Out of Order',
      ar: 'صيانة',
      color: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-400',
    },
  };

  return (
    <div className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain space-y-3 sm:space-y-4">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles size={18} className="text-emerald-500 shrink-0" />
          <span>
            {language === 'fr'
              ? `Gouvernance & Entretien (${unitLabel})`
              : language === 'ar'
              ? `إدارة نظافة وتجهيز (${unitLabel})`
              : `Housekeeping & Turnover (${unitLabel})`}
          </span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
          {isResort
            ? (language === 'fr'
                ? 'Gestion des rotations de villas, contrôle et certification propreté'
                : language === 'ar'
                ? 'إدارة دوران الفلل، ومراقبة النظافة واعتماد الجاهزية'
                : 'Villa turnaround control and cleanliness certification')
            : (language === 'fr'
                ? 'Gestion des rotations de chambres et contrôle qualité'
                : language === 'ar'
                ? 'إدارة دوران الغرف ومراقبة جودة النظافة'
                : 'Room turnover control and quality assurance')}
        </p>
      </div>

      {/* Overview Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {language === 'fr' ? 'Propres' : language === 'ar' ? 'جاهزة' : 'Clean'}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {cleanCount}
            </span>
          </div>
          <CheckCircle2 size={20} className="text-emerald-500 opacity-80 shrink-0" />
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {language === 'fr' ? 'En Nettoyage' : language === 'ar' ? 'تنظيف' : 'Cleaning'}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-500">
              {cleaningCount}
            </span>
          </div>
          <Clock size={20} className="text-amber-500 opacity-80 shrink-0" />
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {language === 'fr' ? 'À Nettoyer' : language === 'ar' ? 'غير جاهزة' : 'Dirty'}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-rose-500">
              {dirtyCount}
            </span>
          </div>
          <AlertTriangle size={20} className="text-rose-500 opacity-80 shrink-0" />
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {language === 'fr' ? 'Hors Service' : language === 'ar' ? 'صيانة' : 'Out of Order'}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-400">
              {oooCount}
            </span>
          </div>
          <RotateCcw size={20} className="text-slate-400 opacity-80 shrink-0" />
        </div>
      </div>

      {/* Room Turnover Matrix */}
      <div className="space-y-3">
        {activeGroups.map((grp) => (
          <div
            key={grp.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3.5 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bed size={15} className="text-blue-500 shrink-0" />
                <span>{grp.name[language] || grp.name.en}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {grp.resources.length} {isResort ? (language === 'fr' ? 'unités' : language === 'ar' ? 'وحدة' : 'units') : (language === 'fr' ? 'chambres' : language === 'ar' ? 'غرفة' : 'rooms')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {grp.resources.map((res) => {
                const status = res.housekeepingStatus || 'clean';
                const currentSt = statusLabels[status] || statusLabels.clean;
                return (
                  <div
                    key={res.id}
                    className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-xs text-slate-900 dark:text-white">
                        {res.name}
                      </span>
                      {/* Zero-pill unboxed status label with subtle dot */}
                      <span className={`flex items-center gap-1 text-[11px] font-semibold ${currentSt.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentSt.dot}`} />
                        <span>{currentSt[language] || currentSt.en}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'clean')}
                        className={`h-8 rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'clean'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                        }`}
                        title={language === 'fr' ? 'Marquer comme Propre' : language === 'ar' ? 'تحديد كجاهزة' : 'Mark as Clean'}
                      >
                        {language === 'fr' ? 'Propre' : language === 'ar' ? 'جاهز' : 'Clean'}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'cleaning')}
                        className={`h-8 rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'cleaning'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950'
                        }`}
                        title={language === 'fr' ? 'Marquer comme En nettoyage' : language === 'ar' ? 'تحديد كقيد التنظيف' : 'Mark as Cleaning'}
                      >
                        {language === 'fr' ? 'Lavage' : language === 'ar' ? 'غسيل' : 'Wash'}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'dirty')}
                        className={`h-8 rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'dirty'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950'
                        }`}
                        title={language === 'fr' ? 'Marquer comme Sale' : language === 'ar' ? 'تحديد كغير جاهزة' : 'Mark as Dirty'}
                      >
                        {language === 'fr' ? 'Sale' : language === 'ar' ? 'غير جاهز' : 'Dirty'}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'out_of_order')}
                        className={`h-8 rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'out_of_order'
                            ? 'bg-slate-700 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={language === 'fr' ? 'Marquer comme Hors Service / Maintenance' : language === 'ar' ? 'تحديد كصيانة / خارج الخدمة' : 'Mark as Out of Order'}
                      >
                        {language === 'fr' ? 'HS' : language === 'ar' ? 'صيانة' : 'OOO'}
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
