import React, { useMemo, useState } from 'react';
import {
  TrendingUp, CreditCard, Bed, Palmtree, CalendarCheck, Activity,
  CheckCircle2, Clock3, XCircle, BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

type RangeKey = '30d' | '90d' | '365d';

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TrendChart: React.FC<{
  title: string;
  subtitle: string;
  points: { label: string; value: number }[];
  color?: string;
  suffix?: string;
  emptyLabel: string;
}> = ({ title, subtitle, points, color = '#2563eb', suffix = '', emptyLabel }) => {
  const max = Math.max(1, ...points.map(point => point.value));
  const x = (index: number) => points.length <= 1 ? 24 : 24 + index * (352 / (points.length - 1));
  const y = (value: number) => 112 - (value / max) * 88;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ');

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {points.length ? (
        <>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{points[points.length - 1].value.toLocaleString()}</strong>
            <span className="text-xs text-slate-500">{suffix}</span>
          </div>
          <svg viewBox="0 0 400 142" role="img" aria-label={title} className="mt-2 h-36 w-full overflow-visible">
            {[24, 68, 112].map(lineY => <line key={lineY} x1="24" x2="376" y1={lineY} y2={lineY} stroke="currentColor" opacity="0.10" strokeDasharray="3 4" />)}
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => <circle key={point.label} cx={x(index)} cy={y(point.value)} r={points.length > 24 ? 1.8 : 3} fill={color} />)}
          </svg>
          <div className="flex justify-between gap-2 text-[10px] text-slate-400">
            <span>{points[0].label}</span>
            {points.length > 2 && <span>{points[Math.floor((points.length - 1) / 2)].label}</span>}
            <span>{points[points.length - 1].label}</span>
          </div>
        </>
      ) : <p className="py-8 text-xs text-slate-500">{emptyLabel}</p>}
    </section>
  );
};

export const ReportsView: React.FC = () => {
  const { bookings, language, resourceGroups, currency } = useApp();
  const [range, setRange] = useState<RangeKey>('30d');
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => isFr ? fr : isAr ? ar : en;
  const periodDays = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (periodDays - 1));
  const from = dateKey(fromDate);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 1);
  const toExclusive = dateKey(toDate);

  const periodBookings = bookings.filter(booking =>
    booking.startDate < toExclusive && booking.endDate > from
  );
  const activeBookings = periodBookings.filter(booking =>
    !['cancelled', 'booking_offer', 'out_of_order', 'checked_out'].includes(booking.status)
  );
  const totalBookingValue = activeBookings.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
  const totalBookings = activeBookings.length;
  const confirmedCount = activeBookings.filter(booking =>
    ['confirmed', 'due_in', 'checked_in', 'due_out'].includes(booking.status)
  ).length;
  const hotelBookingValue = activeBookings.filter(booking => booking.sector === 'hotel')
    .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
  const resortBookingValue = activeBookings.filter(booking => booking.sector === 'resort')
    .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
  const hotelUnits = resourceGroups.filter(group => group.sector === 'hotel').reduce((sum, group) => sum + group.resources.length, 0);
  const resortUnits = resourceGroups.filter(group => group.sector === 'resort').reduce((sum, group) => sum + group.resources.length, 0);
  const cancelledCount = periodBookings.filter(booking => booking.status === 'cancelled').length;
  const confirmationRate = periodBookings.length ? Math.round(confirmedCount / periodBookings.length * 100) : 0;

  const trendPoints = useMemo(() => {
    const bucketCount = range === '30d' ? 15 : range === '90d' ? 13 : 12;
    return Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(fromDate);
      start.setDate(start.getDate() + Math.floor(index * periodDays / bucketCount));
      const end = new Date(fromDate);
      end.setDate(end.getDate() + Math.floor((index + 1) * periodDays / bucketCount));
      const startKey = dateKey(start);
      const endKey = index === bucketCount - 1 ? toExclusive : dateKey(end);
      const count = activeBookings.filter(booking => booking.startDate >= startKey && booking.startDate < endKey).length;
      const label = new Intl.DateTimeFormat(isFr ? 'fr-DZ' : isAr ? 'ar-DZ' : 'en', {
        day: range === '365d' ? undefined : '2-digit',
        month: 'short',
      }).format(start);
      return { label, value: count };
    });
  }, [activeBookings, from, range, periodDays, toExclusive, isFr, isAr]);

  const statusStats = [
    { key: 'new', label: t('Nouvelles', 'New', 'جديدة'), color: 'bg-sky-500' },
    { key: 'confirmed', label: t('Confirmées', 'Confirmed', 'مؤكدة'), color: 'bg-blue-500' },
    { key: 'due_in', label: t('Arrivées prévues', 'Due in', 'وصول متوقع'), color: 'bg-indigo-500' },
    { key: 'checked_in', label: t('En séjour', 'Checked in', 'تم تسجيل الوصول'), color: 'bg-emerald-500' },
    { key: 'due_out', label: t('Départs prévus', 'Due out', 'مغادرة متوقعة'), color: 'bg-amber-500' },
    { key: 'checked_out', label: t('Clôturées', 'Checked out', 'تم تسجيل المغادرة'), color: 'bg-slate-400' },
    { key: 'cancelled', label: t('Annulées', 'Cancelled', 'ملغاة'), color: 'bg-rose-500' },
  ].map(status => ({
    ...status,
    count: periodBookings.filter(booking => booking.status === status.key).length,
  })).filter(status => status.count > 0);
  const statusTotal = statusStats.reduce((sum, status) => sum + status.count, 0);

  const Card = ({ icon: Icon, label, value, detail, tone = 'blue' }: {
    icon: React.ElementType; label: string; value: string | number; detail: string; tone?: 'blue' | 'green' | 'amber' | 'purple';
  }) => (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`rounded-lg p-2 ${tone === 'green' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : tone === 'amber' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' : tone === 'purple' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="truncate text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{value}</div>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );

  return (
    <div className="min-w-0 w-full flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 p-2.5 dark:bg-slate-950 sm:space-y-5 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Activity size={18} className="text-blue-600" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{t('Rapports & indicateurs', 'Reports & performance metrics', 'التقارير ومؤشرات الأداء')}</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Analyse des réservations, capacités et répartition des activités.', 'Analysis of bookings, configured capacity and activity distribution.', 'تحليل الحجوزات والطاقة الاستيعابية وتوزيع الأنشطة.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold text-slate-500">{t('Période', 'Period', 'الفترة')}</span>
          {(['30d', '90d', '365d'] as RangeKey[]).map(key => (
            <button key={key} type="button" onClick={() => setRange(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${range === key ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
              {key === '30d' ? t('30 jours', '30 days', '30 يوماً') : key === '90d' ? t('90 jours', '90 days', '90 يوماً') : t('12 mois', '12 months', '12 شهراً')}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Card icon={CreditCard} label={t('Valeur active', 'Active value', 'القيمة النشطة')} value={`${totalBookingValue.toLocaleString()} ${currency || 'DA'}`} detail={t('Montant contractuel des dossiers actifs', 'Contract value of active bookings', 'القيمة التعاقدية للحجوزات النشطة')} />
        <Card icon={CalendarCheck} label={t('Réservations', 'Bookings', 'الحجوزات')} value={totalBookings} detail={t(`${confirmedCount} confirmées ou en cours`, `${confirmedCount} confirmed or in progress`, `${confirmedCount} مؤكدة أو قيد التنفيذ`)} tone="green" />
        <Card icon={Bed} label={t('Unités hôtel', 'Hotel units', 'وحدات الفندق')} value={hotelUnits} detail={t('Capacité configurée', 'Configured capacity', 'السعة المهيأة')} tone="purple" />
        <Card icon={Palmtree} label={t('Unités resort', 'Resort units', 'وحدات المنتجع')} value={resortUnits} detail={t('Capacité configurée', 'Configured capacity', 'السعة المهيأة')} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <TrendChart title={t('Évolution des réservations', 'Booking activity trend', 'اتجاه الحجوزات')} subtitle={t('Nombre de dossiers dont le début de séjour tombe dans chaque intervalle', 'Bookings whose stay starts within each interval', 'عدد الحجوزات التي يبدأ إقامتها ضمن كل فترة')} points={trendPoints} suffix={t('dossiers', 'bookings', 'حجوزات')} emptyLabel={t('Aucune donnée sur cette période', 'No data for this period', 'لا توجد بيانات خلال هذه الفترة')} />
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('Statut des réservations', 'Booking status distribution', 'توزيع حالات الحجوزات')}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t('Répartition des dossiers sur la période sélectionnée', 'Booking records in the selected period', 'توزيع الحجوزات خلال الفترة المحددة')}</p>
          </div>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {statusStats.map(status => <div key={status.key} className={status.color} style={{ width: `${statusTotal ? status.count / statusTotal * 100 : 0}%` }} title={`${status.label}: ${status.count}`} />)}
          </div>
          <div className="space-y-3">
            {statusStats.map(status => (
              <div key={status.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${status.color}`} />{status.label}</span>
                  <strong className="tabular-nums text-slate-900 dark:text-white">{status.count} <span className="font-normal text-slate-400">· {statusTotal ? Math.round(status.count / statusTotal * 100) : 0}%</span></strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${status.color}`} style={{ width: `${statusTotal ? status.count / statusTotal * 100 : 0}%` }} /></div>
              </div>
            ))}
            {!statusStats.length && <p className="py-8 text-xs text-slate-500">{t('Aucune réservation sur cette période.', 'No bookings in this period.', 'لا توجد حجوزات خلال هذه الفترة.')}</p>}
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><BarChart3 size={18} /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('Répartition de la valeur des réservations', 'Booking value by sector', 'توزيع قيمة الحجوزات حسب القطاع')}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t('Montants contractuels des dossiers actifs, sans mélange de métriques de capacité', 'Contract values for active bookings', 'القيم التعاقدية للحجوزات النشطة')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: t('Hôtellerie & séjours', 'Hotel & stays', 'الفندق والإقامات'), value: hotelBookingValue, icon: Bed, color: 'bg-blue-600', tone: 'text-blue-600 dark:text-blue-400' },
            { label: t('Resort, complexe & villas', 'Resort, complex & villas', 'المنتجع والمجمع والفلل'), value: resortBookingValue, icon: Palmtree, color: 'bg-amber-500', tone: 'text-amber-600 dark:text-amber-400' },
          ].map(item => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className={`flex items-center gap-1.5 font-semibold ${item.tone}`}><item.icon size={14} />{item.label}</span>
                <strong className="font-mono text-slate-900 dark:text-white">{item.value.toLocaleString()} {currency || 'DA'}</strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${totalBookingValue ? Math.min(100, item.value / totalBookingValue * 100) : 0}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div><div className="text-[10px] font-semibold uppercase text-slate-500">{t('Taux de confirmation', 'Confirmation rate', 'معدل التأكيد')}</div><div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{confirmationRate}%</div></div>
          <div><div className="text-[10px] font-semibold uppercase text-slate-500">{t('Annulations', 'Cancellations', 'الإلغاءات')}</div><div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{cancelledCount}</div></div>
        </div>
      </section>
    </div>
  );
};
