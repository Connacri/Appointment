import React, { useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Bed,
  ClipboardList,
  Bell,
  PackageCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RoomReplenishmentModal } from './RoomReplenishmentModal';

function normalizeRoomToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const HousekeepingView: React.FC = () => {
  const {
    resourceGroups,
    updateHousekeepingStatus,
    language,
    currentDomain,
    tasks,
    bookings,
    setActiveView,
    setFocusedTaskId,
    activeRoleDefinition,
    deviceMutationAvailability,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);
  const [replenishRoom, setReplenishRoom] = React.useState<{ id: string; name: string } | null>(null);
  const [isReplenishOpen, setIsReplenishOpen] = React.useState(false);

  const activeGroups = resourceGroups.filter((g) => g.sector === currentDomain);
  const allRooms = activeGroups.flatMap((g) => g.resources);

  const cleanCount = allRooms.filter((r) => r.housekeepingStatus === 'clean').length;
  const cleaningCount = allRooms.filter((r) => r.housekeepingStatus === 'cleaning').length;
  const dirtyCount = allRooms.filter((r) => r.housekeepingStatus === 'dirty').length;
  const oooCount = allRooms.filter((r) => r.housekeepingStatus === 'out_of_order').length;

  const isResort = currentDomain === 'resort';
  const unitLabel = isResort
    ? t('Villas & Bungalows', 'Villas & Bungalows', 'الفلل والشاليهات')
    : t('Chambres & Étages', 'Rooms & Floors', 'الغرف والطوابق');

  const canOpenTasks = activeRoleDefinition.allowedTabs.includes('tasks');

  const alertsByRoomId = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.status === 'cancelled' || !b.guestAlerts?.length) continue;
      map.set(b.resourceId, (map.get(b.resourceId) || 0) + b.guestAlerts.length);
    }
    return map;
  }, [bookings]);

  const getOpenTasksForRoom = (roomId: string, roomName: string) => {
    const normName = normalizeRoomToken(roomName);
    const normId = normalizeRoomToken(roomId);
    return tasks.filter((task) => {
      if (task.status === 'done' || task.status === 'cancel') return false;
      const normTask = normalizeRoomToken(task.room);
      if (!normTask) return false;
      if (normTask === normName || normTask === normId) return true;
      const suffix = normTask.split(/[-_\s]/).pop();
      return Boolean(suffix && suffix.length >= 2 && (normName === suffix || normName.startsWith(`${suffix} `)));
    });
  };

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
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain space-y-3 sm:space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-500 shrink-0" />
            <span>
              {t(`Gouvernance & Entretien (${unitLabel})`, `Housekeeping & Turnover (${unitLabel})`, `إدارة نظافة وتجهيز (${unitLabel})`)}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
            {isResort
              ? t('Gestion des rotations de villas, contrôle et certification propreté', 'Villa turnaround control and cleanliness certification', 'إدارة دوران الفلل، ومراقبة النظافة واعتماد الجاهزية')
              : t('Gestion des rotations de chambres et contrôle qualité', 'Room turnover control and quality assurance', 'إدارة دوران الغرف ومراقبة جودة النظافة')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setReplenishRoom(allRooms[0] ? { id: allRooms[0].id, name: allRooms[0].name } : null);
            setIsReplenishOpen(true);
          }}
          className="min-h-[44px] sm:min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
        >
          <PackageCheck size={15} />
          <span>{t('Réalimentation chambre', 'Room Replenish', 'تزويد الغرفة')}</span>
        </button>
      </div>

      {/* Overview Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {t('Propres', 'Clean', 'جاهزة')}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {cleanCount}
            </span>
          </div>
          <CheckCircle2 size={20} className="text-emerald-500 opacity-80 shrink-0" />
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {t('En Nettoyage', 'Cleaning', 'تنظيف')}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-500 tabular-nums">
              {cleaningCount}
            </span>
          </div>
          <Clock size={20} className="text-amber-500 opacity-80 shrink-0" />
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {t('À Nettoyer', 'Dirty', 'غير جاهزة')}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-rose-500 tabular-nums">
              {dirtyCount}
            </span>
          </div>
          <AlertTriangle size={20} className="text-rose-500 opacity-80 shrink-0" />
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase">
              {t('Hors Service', 'Out of Order', 'صيانة')}
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-400 tabular-nums">
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
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {grp.resources.length} {isResort ? t('unités', 'units', 'وحدة') : t('chambres', 'rooms', 'غرفة')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {grp.resources.map((res) => {
                const status = res.housekeepingStatus || 'clean';
                const currentSt = statusLabels[status] || statusLabels.clean;
                const openRoomTasks = getOpenTasksForRoom(res.id, res.name);
                const urgentRoomTask = openRoomTasks.find((tk) => tk.priority === 'urgent');
                const roomAlertsCount = alertsByRoomId.get(res.id) || 0;

                return (
                  <div
                    key={res.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-xs text-slate-900 dark:text-white">
                        {res.name}
                      </span>
                      <span className={`flex items-center gap-1 text-[11px] font-semibold shrink-0 ${currentSt.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentSt.dot}`} />
                        <span>{currentSt[language] || currentSt.en}</span>
                      </span>
                    </div>

                    {/* Linked tasks & alerts row */}
                    {(openRoomTasks.length > 0 || roomAlertsCount > 0) && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {openRoomTasks.length > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold tabular-nums ${
                                urgentRoomTask
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              <ClipboardList size={10} />
                              <span>
                                {openRoomTasks.length} {t('tâche(s)', 'task(s)', 'مهام')}
                              </span>
                            </span>
                          )}
                          {roomAlertsCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                              <Bell size={10} />
                              <span>{roomAlertsCount}</span>
                            </span>
                          )}
                        </div>

                        {canOpenTasks && openRoomTasks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedTaskId(openRoomTasks[0].id);
                              setActiveView('tasks');
                            }}
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            {t('Voir tâches →', 'Open tasks →', 'عرض المهام ←')}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'clean')}
                        disabled={!deviceMutationAvailability.canMutate}
                        className={`min-h-[44px] sm:min-h-[36px] rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'clean'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                        }`}
                        title={t('Marquer comme Propre', 'Mark as Clean', 'تحديد كجاهزة')}
                      >
                        {t('Propre', 'Clean', 'جاهز')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'cleaning')}
                        disabled={!deviceMutationAvailability.canMutate}
                        className={`min-h-[44px] sm:min-h-[36px] rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'cleaning'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950'
                        }`}
                        title={t('Marquer comme En nettoyage', 'Mark as Cleaning', 'تحديد كقيد التنظيف')}
                      >
                        {t('Lavage', 'Wash', 'غسيل')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'dirty')}
                        disabled={!deviceMutationAvailability.canMutate}
                        className={`min-h-[44px] sm:min-h-[36px] rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'dirty'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950'
                        }`}
                        title={t('Marquer comme Sale', 'Mark as Dirty', 'تحديد كغير جاهزة')}
                      >
                        {t('Sale', 'Dirty', 'غير جاهز')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateHousekeepingStatus(res.id, 'out_of_order')}
                        disabled={!deviceMutationAvailability.canMutate}
                        className={`min-h-[44px] sm:min-h-[36px] rounded-lg text-center font-bold transition-colors cursor-pointer ${
                          status === 'out_of_order'
                            ? 'bg-slate-700 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={t('Marquer comme Hors Service / Maintenance', 'Mark as Out of Order', 'تحديد كصيانة / خارج الخدمة')}
                      >
                        {t('HS', 'OOO', 'صيانة')}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReplenishRoom({ id: res.id, name: res.name });
                        setIsReplenishOpen(true);
                      }}
                      className="w-full min-h-[38px] rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <PackageCheck size={13} />
                      <span>{t('Réalimenter consommables', 'Replenish supplies', 'تزويد المستهلكات')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <RoomReplenishmentModal
        isOpen={isReplenishOpen}
        onClose={() => setIsReplenishOpen(false)}
        rooms={allRooms}
        initialRoomId={replenishRoom?.id}
        initialRoomName={replenishRoom?.name}
      />
    </div>
  );
};
