import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  Users,
  Wrench,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { BookingStatus, ResourceItem, TimelineBooking } from '../types/booking';

type Period = 7 | 30 | 90;

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'new', 'confirmed', 'due_in', 'checked_in', 'due_out',
];
const IN_HOUSE_STATUSES: BookingStatus[] = ['checked_in', 'due_out'];

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isBookingActiveOn = (booking: TimelineBooking, dateKey: string) =>
  ACTIVE_BOOKING_STATUSES.includes(booking.status) &&
  booking.startDate <= dateKey &&
  dateKey < booking.endDate;

const StatCard: React.FC<{
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'rose';
}> = ({ label, value, detail, icon, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}>{icon}</span>
      </div>
    </article>
  );
};

export const ResourceUsageDashboard: React.FC = () => {
  const {
    language,
    resourceGroups,
    bookings,
    tasks,
    establishments,
    selectedEstablishmentId,
    setSelectedEstablishmentId,
    activeSector,
    setActiveSector,
  } = useApp();
  const [period, setPeriod] = useState<Period>(30);

  const copy = {
    fr: {
      title: 'Pilotage des ressources métier',
      subtitle: 'Occupation, disponibilité et charge opérationnelle de vos établissements.',
      establishment: 'Établissement',
      allEstablishments: 'Tous les établissements',
      sector: 'Périmètre',
      all: 'Tous',
      hotel: 'Hébergement',
      resort: 'Resort',
      period: 'Période',
      days7: '7 jours',
      days30: '30 jours',
      days90: '90 jours',
      inventory: 'Ressources suivies',
      inventoryDetail: 'Unités et espaces configurés',
      occupied: 'Occupées maintenant',
      occupiedDetail: 'Séjours actuellement en cours',
      planned: 'Réservées aujourd’hui',
      plannedDetail: 'Unités engagées sur la date du jour',
      unavailable: 'Indisponibles',
      unavailableDetail: 'Hors service ou bloquées',
      occupancy: 'Occupation prévisionnelle',
      occupancySubtitle: 'Part des ressources réservées par jour, sur la période sélectionnée.',
      distribution: 'Répartition des ressources',
      distributionSubtitle: 'Inventaire réel par secteur et catégorie configurés.',
      buildings: 'Bâtiments et étages',
      noBuilding: 'Sans bâtiment renseigné',
      operations: 'Charge opérationnelle',
      operationsSubtitle: 'Tâches issues du planning opérationnel.',
      maintenance: 'Maintenance à traiter',
      maintenanceDetail: 'Tâches de maintenance en attente ou en cours',
      openTasks: 'Tâches ouvertes',
      openTasksDetail: 'Toutes catégories confondues',
      team: 'Charge par intervenant',
      noAssignee: 'Non affecté',
      resourceState: 'État des unités',
      clean: 'Prêtes',
      cleaning: 'En nettoyage',
      dirty: 'À nettoyer',
      outOfOrder: 'Hors service',
      noData: 'Aucune donnée opérationnelle disponible pour ces filtres.',
      noTasks: 'Aucune tâche ouverte.',
      noResources: 'Aucune ressource configurée.',
      today: 'Aujourd’hui',
      reserved: 'réservées',
      unit: 'unités',
      tasks: 'tâches',
      sourceNote: 'Indicateurs calculés à partir des ressources, réservations et tâches enregistrées. Aucune télémétrie matérielle ni donnée simulée.',
      actual: 'Réservations',
      capacity: 'Capacité',
      floor: 'étage',
    },
    en: {
      title: 'Operational resource management',
      subtitle: 'Occupancy, availability and operational workload across your properties.',
      establishment: 'Property',
      allEstablishments: 'All properties',
      sector: 'Scope',
      all: 'All',
      hotel: 'Accommodation',
      resort: 'Resort',
      period: 'Period',
      days7: '7 days',
      days30: '30 days',
      days90: '90 days',
      inventory: 'Tracked resources',
      inventoryDetail: 'Configured units and spaces',
      occupied: 'Occupied now',
      occupiedDetail: 'Currently checked-in stays',
      planned: 'Reserved today',
      plannedDetail: 'Units committed for today',
      unavailable: 'Unavailable',
      unavailableDetail: 'Out of order or blocked',
      occupancy: 'Forecast occupancy',
      occupancySubtitle: 'Share of resources booked per day in the selected period.',
      distribution: 'Resource distribution',
      distributionSubtitle: 'Actual inventory by configured sector and category.',
      buildings: 'Buildings and floors',
      noBuilding: 'No building specified',
      operations: 'Operational workload',
      operationsSubtitle: 'Tasks recorded in the operations planner.',
      maintenance: 'Maintenance to address',
      maintenanceDetail: 'Pending or in-progress maintenance tasks',
      openTasks: 'Open tasks',
      openTasksDetail: 'All task categories',
      team: 'Workload by assignee',
      noAssignee: 'Unassigned',
      resourceState: 'Unit status',
      clean: 'Ready',
      cleaning: 'Being cleaned',
      dirty: 'Needs cleaning',
      outOfOrder: 'Out of order',
      noData: 'No operational data is available for these filters.',
      noTasks: 'No open tasks.',
      noResources: 'No resources configured.',
      today: 'Today',
      reserved: 'reserved',
      unit: 'units',
      tasks: 'tasks',
      sourceNote: 'Metrics are calculated from saved resources, bookings and tasks. No hardware telemetry or simulated data.',
      actual: 'Bookings',
      capacity: 'Capacity',
      floor: 'floor',
    },
    ar: {
      title: 'إدارة الموارد التشغيلية',
      subtitle: 'الإشغال والتوفر وحجم العمل التشغيلي في منشآتك.',
      establishment: 'المنشأة',
      allEstablishments: 'كل المنشآت',
      sector: 'النطاق',
      all: 'الكل',
      hotel: 'الإقامة',
      resort: 'المنتجع',
      period: 'الفترة',
      days7: '7 أيام',
      days30: '30 يوماً',
      days90: '90 يوماً',
      inventory: 'الموارد المسجلة',
      inventoryDetail: 'الوحدات والمساحات المعرّفة',
      occupied: 'مشغولة حالياً',
      occupiedDetail: 'الإقامات المسجلة حالياً',
      planned: 'محجوزة اليوم',
      plannedDetail: 'الوحدات المحجوزة لهذا اليوم',
      unavailable: 'غير متاحة',
      unavailableDetail: 'خارج الخدمة أو محجوبة',
      occupancy: 'الإشغال المتوقع',
      occupancySubtitle: 'نسبة الموارد المحجوزة يومياً خلال الفترة المحددة.',
      distribution: 'توزيع الموارد',
      distributionSubtitle: 'المخزون الفعلي حسب القطاع والفئة.',
      buildings: 'المباني والطوابق',
      noBuilding: 'دون مبنى محدد',
      operations: 'حجم العمل التشغيلي',
      operationsSubtitle: 'المهام المسجلة في مخطط التشغيل.',
      maintenance: 'الصيانة المطلوب تنفيذها',
      maintenanceDetail: 'مهام الصيانة المعلقة أو الجارية',
      openTasks: 'المهام المفتوحة',
      openTasksDetail: 'جميع فئات المهام',
      team: 'حجم العمل حسب المسؤول',
      noAssignee: 'غير مسندة',
      resourceState: 'حالة الوحدات',
      clean: 'جاهزة',
      cleaning: 'قيد التنظيف',
      dirty: 'تحتاج إلى تنظيف',
      outOfOrder: 'خارج الخدمة',
      noData: 'لا توجد بيانات تشغيلية لهذه المرشحات.',
      noTasks: 'لا توجد مهام مفتوحة.',
      noResources: 'لم يتم إعداد أي موارد.',
      today: 'اليوم',
      reserved: 'محجوزة',
      unit: 'وحدات',
      tasks: 'مهام',
      sourceNote: 'المؤشرات محسوبة من الموارد والحجوزات والمهام المسجلة. لا توجد بيانات أجهزة أو بيانات محاكاة.',
      actual: 'الحجوزات',
      capacity: 'السعة',
      floor: 'طابق',
    },
  }[language];
  const isRtl = language === 'ar';

  const resources = useMemo(() => {
    const seen = new Set<string>();
    return resourceGroups
      .filter((group) => activeSector === 'all' || group.sector === activeSector)
      .flatMap((group) => group.resources)
      .filter((resource) => {
        if (selectedEstablishmentId !== 'all' && resource.establishmentId !== selectedEstablishmentId) return false;
        if (seen.has(resource.id)) return false;
        seen.add(resource.id);
        return true;
      });
  }, [resourceGroups, activeSector, selectedEstablishmentId]);

  const scopedBookings = useMemo(() => {
    const resourceIds = new Set(resources.map((resource) => resource.id));
    return bookings.filter((booking) =>
      resourceIds.has(booking.resourceId) &&
      (activeSector === 'all' || booking.sector === activeSector),
    );
  }, [bookings, resources, activeSector]);

  const todayKey = localDateKey(new Date());
  const usableResources = resources.filter((resource) => resource.housekeepingStatus !== 'out_of_order');
  const unavailableResources = resources.length - usableResources.length;
  const occupiedNow = scopedBookings.filter((booking) =>
    IN_HOUSE_STATUSES.includes(booking.status) && isBookingActiveOn(booking, todayKey),
  );
  const reservedToday = scopedBookings.filter((booking) => isBookingActiveOn(booking, todayKey));
  const occupiedResourceIds = new Set(occupiedNow.map((booking) => booking.resourceId));
  const reservedResourceIds = new Set(reservedToday.map((booking) => booking.resourceId));
  const openTasks = tasks.filter((task) =>
    task.status === 'pending' || task.status === 'doing',
  );
  const maintenanceTasks = openTasks.filter((task) => task.category === 'Maintenance');

  const occupancySeries = useMemo(() => {
    return Array.from({ length: period }, (_, index) => {
      const date = addDays(new Date(), index);
      const key = localDateKey(date);
      const bookedIds = new Set(
        scopedBookings
          .filter((booking) => isBookingActiveOn(booking, key))
          .map((booking) => booking.resourceId),
      );
      const capacity = usableResources.length;
      return {
        key,
        label: date.toLocaleDateString(language === 'ar' ? 'ar-DZ' : language === 'en' ? 'en-GB' : 'fr-FR', {
          day: '2-digit',
          month: period === 7 ? 'short' : undefined,
        }),
        count: bookedIds.size,
        capacity,
        rate: capacity ? Math.min(100, (bookedIds.size / capacity) * 100) : 0,
      };
    });
  }, [period, scopedBookings, usableResources.length, language]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    resources.forEach((resource) => counts.set(resource.type || 'Autre', (counts.get(resource.type || 'Autre') || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [resources]);

  const buildingCounts = useMemo(() => {
    const counts = new Map<string, { total: number; floors: Set<string> }>();
    resources.forEach((resource) => {
      const name = resource.building?.trim() || copy.noBuilding;
      const entry = counts.get(name) || { total: 0, floors: new Set<string>() };
      entry.total += 1;
      if (resource.floor?.trim()) entry.floors.add(resource.floor.trim());
      counts.set(name, entry);
    });
    return [...counts.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [resources, copy.noBuilding]);

  const assigneeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    openTasks.forEach((task) => {
      const name = task.assignee?.trim() || copy.noAssignee;
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [openTasks, copy.noAssignee]);

  const stateCounts = [
    { label: copy.clean, count: resources.filter((resource) => resource.housekeepingStatus === 'clean').length, color: 'bg-emerald-500' },
    { label: copy.cleaning, count: resources.filter((resource) => resource.housekeepingStatus === 'cleaning').length, color: 'bg-blue-500' },
    { label: copy.dirty, count: resources.filter((resource) => resource.housekeepingStatus === 'dirty').length, color: 'bg-amber-500' },
    { label: copy.outOfOrder, count: unavailableResources, color: 'bg-rose-500' },
  ];
  const maxCategory = Math.max(1, ...categoryCounts.map(([, count]) => count));
  const maxBuilding = Math.max(1, ...buildingCounts.map(([, entry]) => entry.total));
  const maxAssignee = Math.max(1, ...assigneeCounts.map(([, count]) => count));
  const totalReservedToday = reservedResourceIds.size;
  const averageForecast = occupancySeries.length
    ? Math.round(occupancySeries.reduce((sum, item) => sum + item.rate, 0) / occupancySeries.length)
    : 0;

  const formatDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString(
    language === 'ar' ? 'ar-DZ' : language === 'en' ? 'en-GB' : 'fr-FR',
    { day: '2-digit', month: 'short' },
  );

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 pb-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-xl bg-indigo-50 p-3 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Activity size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{copy.title}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="resource-dashboard-establishment">{copy.establishment}</label>
          <select
            id="resource-dashboard-establishment"
            value={selectedEstablishmentId}
            onChange={(event) => setSelectedEstablishmentId(event.target.value)}
            className="h-9 min-w-0 max-w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{copy.allEstablishments}</option>
            {establishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id}>{establishment.name}</option>
            ))}
          </select>
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800" aria-label={copy.sector}>
            {(['all', 'hotel', 'resort'] as const).map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => setActiveSector(sector)}
                className={`rounded-md px-2.5 py-1.5 font-semibold transition-colors ${activeSector === sector ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
              >
                {sector === 'all' ? copy.all : sector === 'hotel' ? copy.hotel : copy.resort}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={copy.inventory} value={resources.length} detail={copy.inventoryDetail} icon={<Layers3 size={19} />} tone="blue" />
        <StatCard label={copy.occupied} value={occupiedResourceIds.size} detail={copy.occupiedDetail} icon={<BedDouble size={19} />} tone="emerald" />
        <StatCard label={copy.planned} value={totalReservedToday} detail={copy.plannedDetail} icon={<CalendarDays size={19} />} tone="amber" />
        <StatCard label={copy.unavailable} value={unavailableResources} detail={copy.unavailableDetail} icon={<AlertTriangle size={19} />} tone="rose" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{copy.occupancy}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.occupancySubtitle}</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800">
              {([7, 30, 90] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`rounded-md px-2.5 py-1.5 font-semibold ${period === value ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {value === 7 ? copy.days7 : value === 30 ? copy.days30 : copy.days90}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{averageForecast}%</span>
              <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">{copy.actual} · {period} {language === 'fr' ? 'jours' : language === 'ar' ? 'يوماً' : 'days'}</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{copy.today}: {formatDate(todayKey)}</span>
          </div>
          {resources.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">{copy.noResources}</p>
          ) : (
            <div className="mt-4 flex h-44 items-end gap-1 overflow-x-auto border-b border-slate-200 pb-1 dark:border-slate-700">
              {occupancySeries.map((point) => (
                <div key={point.key} className="group flex h-full min-w-[9px] flex-1 flex-col items-center justify-end gap-1" title={`${point.key}: ${point.count}/${point.capacity} (${Math.round(point.rate)}%)`}>
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      className={`w-full max-w-5 rounded-t-sm ${point.rate >= 90 ? 'bg-rose-500' : point.rate >= 65 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                      style={{ height: `${Math.max(point.rate > 0 ? 3 : 0, point.rate)}%` }}
                    />
                  </div>
                  {(period === 7 || point.key.endsWith('-01') || point.key === todayKey) && (
                    <span className="whitespace-nowrap text-[9px] text-slate-400">{point.label}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-indigo-500" /> 0–64%</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" /> 65–89%</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-500" /> 90–100%</span>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold text-slate-900 dark:text-white">{copy.resourceState}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.distributionSubtitle}</p>
          <div className="mt-5 space-y-4">
            {stateCounts.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                  <strong className="text-slate-900 dark:text-white">{item.count}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${resources.length ? (item.count / resources.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{copy.capacity}</span>
              <strong className="text-slate-900 dark:text-white">{usableResources.length} / {resources.length}</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${resources.length ? (usableResources.length / resources.length) * 100 : 0}%` }} />
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Layers3 size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">{copy.distribution}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.distributionSubtitle}</p>
          {categoryCounts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{copy.noResources}</p> : (
            <div className="mt-4 space-y-3">
              {categoryCounts.slice(0, 8).map(([name, count]) => (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-600 dark:text-slate-300">{name}</span>
                    <strong className="shrink-0 text-slate-900 dark:text-white">{count}</strong>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(count / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">{copy.buildings}</h3>
          </div>
          {buildingCounts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{copy.noResources}</p> : (
            <div className="mt-4 space-y-3">
              {buildingCounts.slice(0, 8).map(([name, entry]) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{entry.floors.size} {copy.floor}{entry.floors.size > 1 ? 's' : ''}</p>
                  </div>
                  <strong className="shrink-0 text-sm text-slate-900 dark:text-white">{entry.total} {copy.unit}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">{copy.operations}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.operationsSubtitle}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 dark:text-amber-300">{copy.maintenance}</p>
              <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-200">{maintenanceTasks.length}</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">{copy.maintenanceDetail}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/30">
              <p className="text-xs text-indigo-800 dark:text-indigo-300">{copy.openTasks}</p>
              <p className="mt-1 text-2xl font-bold text-indigo-900 dark:text-indigo-200">{openTasks.length}</p>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-400">{copy.openTasksDetail}</p>
            </div>
          </div>
          {maintenanceTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              {maintenanceTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{task.room} · {task.typeName}</p>
                    <p className="text-[10px] text-slate-500">{task.assignee || copy.noAssignee} · {task.date}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${task.priority === 'urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {task.priority === 'urgent' ? (language === 'fr' ? 'Urgent' : language === 'ar' ? 'عاجل' : 'Urgent') : task.status === 'doing' ? (language === 'fr' ? 'En cours' : language === 'ar' ? 'قيد التنفيذ' : 'In progress') : (language === 'fr' ? 'En attente' : language === 'ar' ? 'معلقة' : 'Pending')}
                  </span>
                </div>
              ))}
            </div>
          )}
          {openTasks.length === 0 && <p className="py-5 text-center text-xs text-slate-500">{copy.noTasks}</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">{copy.team}</h3>
          </div>
          {assigneeCounts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{copy.noTasks}</p> : (
            <div className="mt-4 space-y-4">
              {assigneeCounts.map(([name, count]) => (
                <div key={name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-600 dark:text-slate-300">{name}</span>
                    <strong className="text-slate-900 dark:text-white">{count} {copy.tasks}</strong>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(count / maxAssignee) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <footer className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
        <span>{copy.sourceNote}</span>
      </footer>
    </div>
  );
};
