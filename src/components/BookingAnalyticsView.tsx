import React, { useMemo, useState } from 'react';
import {
  Building2, BedDouble, TrendingUp, Package, FileText, CheckCircle2,
  Boxes, Wallet, Activity, CalendarRange, Layers3, Flower2, Presentation,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvoiceRecord } from '../types/booking';

type RangeKey = '30d' | '90d' | '365d';

const dateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const dayDiff = (start: string, end: string) => {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86400000)) : 0;
};

const overlapNights = (start: string, end: string, from: string, toExclusive: string) => {
  const a = start > from ? start : from;
  const b = end < toExclusive ? end : toExclusive;
  return dayDiff(a, b);
};

type BookingTrendPoint = { label: string; occupancy: number; arrivals: number };

const BookingTrendPanel: React.FC<{
  points: BookingTrendPoint[];
  language: string;
  onExport: () => void;
}> = ({ points, language, onExport }) => {
  const [metric, setMetric] = useState<'occupancy' | 'arrivals'>('occupancy');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => isFr ? fr : isAr ? ar : en;
  const width = 900;
  const left = 58;
  const right = 872;
  const top = 26;
  const bottom = 238;
  const values = points.map(point => point[metric]);
  const maxValue = metric === 'occupancy' ? 100 : Math.max(1, ...values);
  const x = (index: number) => points.length <= 1 ? (left + right) / 2 : left + index * ((right - left) / (points.length - 1));
  const y = (value: number) => bottom - (Math.max(0, value) / maxValue) * (bottom - top);
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[metric])}`).join(' ');
  const areaPath = points.length ? `${linePath} L ${x(points.length - 1)} ${bottom} L ${x(0)} ${bottom} Z` : '';
  const active = hoveredIndex === null ? null : points[hoveredIndex];
  const activeValue = active ? active[metric] : null;
  const formatValue = (value: number) => metric === 'occupancy' ? `${value}%` : value.toLocaleString();

  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"><Activity size={18} /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('Évolution de l’activité & des réservations', 'Activity & booking trends', 'تطور النشاط والحجوزات')}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t('Analyse chronologique sur la période sélectionnée. Survolez les points pour les valeurs détaillées.', 'Timeline for the selected period. Hover points to inspect exact values.', 'التطور الزمني للفترة المحددة. مرر المؤشر فوق النقاط لعرض القيم.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button type="button" onClick={() => { setMetric('occupancy'); setHoveredIndex(null); }} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${metric === 'occupancy' ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-teal-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
              <span className="h-2 w-2 rounded-full bg-teal-500" />{t('Occupation', 'Occupancy', 'الإشغال')}
            </button>
            <button type="button" onClick={() => { setMetric('arrivals'); setHoveredIndex(null); }} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${metric === 'arrivals' ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
              <span className="h-2 w-2 rounded-full bg-violet-500" />{t('Arrivées', 'Arrivals', 'الوصول')}
            </button>
          </div>
          <button type="button" onClick={onExport} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
            <FileText size={14} /> CSV
          </button>
        </div>
      </div>
      {points.length ? (
        <>
          <div className="mb-1 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{metric === 'occupancy' ? t('Taux d’occupation moyen', 'Average occupancy', 'متوسط الإشغال') : t('Arrivées sur la période', 'Arrivals in period', 'الوصول خلال الفترة')}</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{metric === 'occupancy' ? `${Math.round(points.reduce((sum, point) => sum + point.occupancy, 0) / points.length)}%` : points.reduce((sum, point) => sum + point.arrivals, 0).toLocaleString()}</div>
            </div>
            <div className="text-right text-[10px] text-slate-400">{t('Points de mesure', 'Data points', 'نقاط القياس')}: {points.length}</div>
          </div>
          <div className="relative w-full" onMouseLeave={() => setHoveredIndex(null)} onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width;
            const rawIndex = points.length <= 1 ? 0 : Math.round((viewX - left) / (right - left) * (points.length - 1));
            setHoveredIndex(Math.max(0, Math.min(points.length - 1, rawIndex)));
          }}>
            <svg viewBox="0 0 900 280" role="img" aria-label={metric === 'occupancy' ? t('Courbe du taux d’occupation', 'Occupancy trend chart', 'مخطط نسبة الإشغال') : t('Courbe des arrivées', 'Arrival trend chart', 'مخطط الوصول')} className="h-56 w-full overflow-visible sm:h-72">
              <defs>
                <linearGradient id="booking-trend-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={metric === 'occupancy' ? '#0d9488' : '#7c3aed'} stopOpacity="0.24" />
                  <stop offset="100%" stopColor={metric === 'occupancy' ? '#0d9488' : '#7c3aed'} stopOpacity="0.015" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map(index => {
                const value = maxValue * (4 - index) / 4;
                const yy = top + index * ((bottom - top) / 4);
                return <g key={index}>
                  <line x1={left} x2={right} y1={yy} y2={yy} stroke="currentColor" opacity="0.10" strokeDasharray="4 5" />
                  <text x={left - 12} y={yy + 4} textAnchor="end" fill="currentColor" opacity="0.48" fontSize="11">{metric === 'occupancy' ? `${Math.round(value)}%` : Math.round(value)}</text>
                </g>;
              })}
              {points.length > 1 && <path d={areaPath} fill="url(#booking-trend-fill)" />}
              <path d={linePath} fill="none" stroke={metric === 'occupancy' ? '#0d9488' : '#7c3aed'} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              {active && hoveredIndex !== null && <line x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1={top} y2={bottom} stroke="currentColor" opacity="0.35" strokeDasharray="4 4" />}
              {points.map((point, index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point[metric])} r={hoveredIndex === index ? 6 : points.length > 24 ? 2.5 : 3.8} fill={metric === 'occupancy' ? '#0d9488' : '#7c3aed'} stroke="white" strokeWidth="2" />)}
              {points.filter((_, index) => index === 0 || index === points.length - 1 || index === Math.floor((points.length - 1) / 2)).map(point => {
                const index = points.indexOf(point);
                return <text key={`label-${index}`} x={x(index)} y="266" textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} fill="currentColor" opacity="0.55" fontSize="11">{point.label}</text>;
              })}
            </svg>
            {active && activeValue !== null && <div className="pointer-events-none absolute right-2 top-2 z-10 min-w-32 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-white shadow-xl sm:right-5">
              <div className="mb-1 border-b border-slate-700 pb-1 text-[10px] text-slate-300">{active.label}</div>
              <div className={`text-sm font-bold tabular-nums ${metric === 'occupancy' ? 'text-teal-300' : 'text-violet-300'}`}>{formatValue(activeValue)}</div>
              <div className="mt-0.5 text-[9px] text-slate-400">{metric === 'occupancy' ? t('Occupation moyenne', 'Average occupancy', 'متوسط الإشغال') : t('Arrivées enregistrées', 'Recorded arrivals', 'الوصول المسجل')}</div>
            </div>}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800">
            <span className="inline-flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${metric === 'occupancy' ? 'bg-teal-500' : 'bg-violet-500'}`} />{metric === 'occupancy' ? t('Taux d’occupation réel', 'Actual occupancy rate', 'نسبة الإشغال الفعلية') : t('Nombre d’arrivées', 'Arrival count', 'عدد الوصول')}</span>
            <span>{t('Données issues des réservations locales', 'Based on local booking records', 'البيانات من سجلات الحجوزات المحلية')}</span>
          </div>
        </>
      ) : <p className="py-12 text-center text-xs text-slate-500">{t('Aucune donnée disponible sur cette période.', 'No data available for this period.', 'لا توجد بيانات لهذه الفترة.')}</p>}
    </section>
  );
};

const TrendLine: React.FC<{
  title: string;
  subtitle: string;
  points: Array<{ label: string; value: number }>;
  suffix: string;
  color: string;
  emptyLabel: string;
}> = ({ title, subtitle, points, suffix, color, emptyLabel }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxValue = Math.max(1, ...points.map(point => point.value));
  const left = 48;
  const right = 872;
  const top = 18;
  const bottom = 190;
  const x = (index: number) => points.length <= 1 ? (left + right) / 2 : left + index * ((right - left) / (points.length - 1));
  const y = (value: number) => bottom - (value / maxValue) * (bottom - top);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ');
  const active = activeIndex === null ? null : points[activeIndex];
  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {points.length ? (
        <div className="relative" onMouseLeave={() => setActiveIndex(null)} onMouseMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 900;
          const index = points.length <= 1 ? 0 : Math.round((px - left) / (right - left) * (points.length - 1));
          setActiveIndex(Math.max(0, Math.min(points.length - 1, index)));
        }}>
          <svg viewBox="0 0 900 225" className="h-48 w-full sm:h-56" role="img" aria-label={title}>
            {[0,1,2,3].map(index => {
              const yy = top + index * ((bottom - top) / 3);
              return <g key={index}>
                <line x1={left} x2={right} y1={yy} y2={yy} stroke="currentColor" opacity=".12" strokeDasharray="4 5" />
                <text x={left - 10} y={yy + 4} textAnchor="end" fill="currentColor" opacity=".5" fontSize="11">{Math.round(maxValue * (3-index) / 3)}</text>
              </g>;
            })}
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {activeIndex !== null && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={bottom} stroke="currentColor" opacity=".35" strokeDasharray="4 4" />}
            {points.map((point,index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r={activeIndex === index ? 6 : 3.5} fill={color} stroke="white" strokeWidth="2" />)}
            {points.filter((_,index) => index === 0 || index === points.length-1 || index === Math.floor((points.length-1)/2)).map(point => {
              const index = points.indexOf(point);
              return <text key={index} x={x(index)} y="216" textAnchor={index === 0 ? 'start' : index === points.length-1 ? 'end' : 'middle'} fill="currentColor" opacity=".55" fontSize="11">{point.label}</text>;
            })}
          </svg>
          {active && <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-white shadow-xl">
            <div className="text-[10px] text-slate-300">{active.label}</div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">{active.value.toLocaleString()} {suffix}</div>
          </div>}
        </div>
      ) : <p className="py-10 text-center text-xs text-slate-500">{emptyLabel}</p>}
    </section>
  );
};

export const BookingAnalyticsView: React.FC = () => {
  const {
    bookings, resourceGroups, stockItems, stockMovements, tasks,
    language, currency, currentDomain,
  } = useApp();
  const [range, setRange] = useState<RangeKey>('30d');
  const [invoiceDocs] = useState<InvoiceRecord[]>(() => {
    try {
      const stored = localStorage.getItem('omnibook_invoices');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => isFr ? fr : isAr ? ar : en;
  const today = dateKey(new Date());
  const periodDays = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (periodDays - 1));
  const from = dateKey(fromDate);
  const toExclusiveDate = new Date();
  toExclusiveDate.setDate(toExclusiveDate.getDate() + 1);
  const toExclusive = dateKey(toExclusiveDate);
  const activeGroups = resourceGroups.filter(group => group.sector === currentDomain);
  const rooms = activeGroups.flatMap(group => group.resources.map(resource => ({
    ...resource,
    groupId: group.id,
    groupName: typeof group.name === 'string' ? group.name : group.name[language] || group.name.fr,
  })));
  const activeBookings = bookings.filter(booking =>
    booking.sector === currentDomain &&
    booking.status !== 'cancelled' &&
    booking.status !== 'out_of_order' &&
    booking.startDate < toExclusive &&
    booking.endDate > from
  );
  const validRooms = rooms.filter(room => room.housekeepingStatus !== 'out_of_order');
  const validRoomIds = new Set(validRooms.map(room => room.id));
  const occupiedTodayIds = new Set(bookings.filter(booking =>
    booking.sector === currentDomain &&
    booking.status !== 'cancelled' &&
    booking.status !== 'out_of_order' &&
    booking.startDate <= today &&
    booking.endDate > today
  ).map(booking => booking.resourceId));
  const occupiedToday = validRooms.filter(room => occupiedTodayIds.has(room.id)).length;
  const occupancyToday = validRooms.length ? Math.round(occupiedToday / validRooms.length * 100) : 0;
  const roomNightsAvailable = validRooms.length * periodDays;
  const occupiedRoomNights = activeBookings.reduce((sum, booking) =>
    sum + overlapNights(booking.startDate, booking.endDate, from, toExclusive), 0);
  const periodOccupancy = roomNightsAvailable ? Math.min(100, Math.round(occupiedRoomNights / roomNightsAvailable * 100)) : 0;
  const periodRevenueByCurrency = activeBookings.reduce((totals, booking) => {
    const totalNights = Math.max(1, dayDiff(booking.startDate, booking.endDate));
    const nightsInPeriod = overlapNights(booking.startDate, booking.endDate, from, toExclusive);
    const code = booking.paymentCurrency || currency;
    totals[code] = (totals[code] || 0) + (booking.totalPrice * nightsInPeriod / totalNights);
    return totals;
  }, {} as Record<string, number>);
  const fmtMoney = (amount: number, code = currency) => {
    const normalized = code === 'DA' ? 'DZD' : code;
    try {
      return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : language === 'ar' ? 'ar-DZ' : 'en', {
        style: 'currency', currency: normalized, maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${Math.round(amount).toLocaleString()} ${code}`;
    }
  };
  const formatBreakdown = (totals: Record<string, number>) => {
    const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);
    return entries.length ? entries.map(([code, amount]) => fmtMoney(amount, code)).join(' · ') : fmtMoney(0);
  };
  const periodRevenue = formatBreakdown(periodRevenueByCurrency);

  const buildingStats = activeGroups.map(group => {
    const groupRooms = group.resources.filter(room => room.housekeepingStatus !== 'out_of_order');
    const groupRoomIds = new Set(group.resources.map(room => room.id));
    const occupiedNow = groupRooms.filter(room => occupiedTodayIds.has(room.id)).length;
    const nights = activeBookings.filter(booking => groupRoomIds.has(booking.resourceId))
      .reduce((sum, booking) => sum + overlapNights(booking.startDate, booking.endDate, from, toExclusive), 0);
    const capacity = groupRooms.length * periodDays;
    return {
      id: group.id,
      name: typeof group.name === 'string' ? group.name : group.name[language] || group.name.fr,
      total: group.resources.length,
      available: groupRooms.length,
      outOfOrder: group.resources.length - groupRooms.length,
      occupiedNow,
      occupancy: capacity ? Math.min(100, Math.round(nights / capacity * 100)) : 0,
      roomNights: nights,
      bookingCount: activeBookings.filter(booking => groupRoomIds.has(booking.resourceId)).length,
    };
  });

  const lowStock = stockItems.filter(item => item.quantity <= item.minThreshold);
  const stockValue = stockItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const periodMovements = stockMovements.filter(movement => movement.timestamp.slice(0, 10) >= from && movement.timestamp.slice(0, 10) < toExclusive);
  const consumption = periodMovements.filter(movement => movement.delta < 0);
  const received = periodMovements.filter(movement => movement.delta > 0);
  const consumedUnits = consumption.reduce((sum, movement) => sum + Math.abs(movement.delta), 0);
  const consumedValue = consumption.reduce((sum, movement) => {
    const item = stockItems.find(stock => stock.id === movement.itemId);
    return sum + Math.abs(movement.delta) * (item?.unitCost || 0);
  }, 0);
  const taskConsumptions = tasks.filter(task => task.date >= from && task.date < toExclusive)
    .flatMap(task => task.consumedItems || []);
  const taskConsumedUnits = taskConsumptions.reduce((sum, item) => sum + item.quantity, 0);

  const periodInvoices = invoiceDocs.filter(invoice =>
    invoice.domain === currentDomain && invoice.issueDate >= from && invoice.issueDate < toExclusive
  );
  const issuedInvoices = periodInvoices.filter(invoice => invoice.docType === 'invoice');
  const quotes = periodInvoices.filter(invoice => invoice.docType === 'quote');
  const paidInvoices = issuedInvoices.filter(invoice => invoice.status === 'paid');
  const outstanding = issuedInvoices.filter(invoice => ['sent', 'overdue', 'accepted'].includes(invoice.status));
  const sumInvoiceCurrencies = (field: 'totalTTC' | 'depositPaid' | 'balanceDue') =>
    issuedInvoices.reduce((totals, invoice) => {
      const code = invoice.currency || currency;
      totals[code] = (totals[code] || 0) + invoice[field];
      return totals;
    }, {} as Record<string, number>);
  const invoicedTotal = formatBreakdown(sumInvoiceCurrencies('totalTTC'));
  const collectedTotal = formatBreakdown(sumInvoiceCurrencies('depositPaid'));
  const dueTotal = formatBreakdown(sumInvoiceCurrencies('balanceDue'));
  const unpaidCount = outstanding.length;
  const housekeepingCounts = rooms.reduce((counts, room) => {
    const status = room.housekeepingStatus || 'clean';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const roomTypes = Array.from(new Set(rooms.map(room => room.type))).map(type => ({
    type,
    count: rooms.filter(room => room.type === type).length,
    occupied: rooms.filter(room => room.type === type && occupiedTodayIds.has(room.id)).length,
  }));

  const periodBookings = bookings.filter(booking =>
    booking.sector === currentDomain &&
    booking.startDate < toExclusive &&
    booking.endDate > from
  );
  const bookingStatusStats = [
    { key: 'new', label: t('Nouvelles', 'New', 'جديدة') },
    { key: 'confirmed', label: t('Confirmées', 'Confirmed', 'مؤكدة') },
    { key: 'due_in', label: t('Arrivées prévues', 'Due in', 'وصول متوقع') },
    { key: 'checked_in', label: t('En séjour', 'Checked in', 'تم تسجيل الوصول') },
    { key: 'due_out', label: t('Départs prévus', 'Due out', 'مغادرة متوقعة') },
    { key: 'checked_out', label: t('Clôturées', 'Checked out', 'تم تسجيل المغادرة') },
    { key: 'booking_offer', label: t('Offres', 'Offers', 'عروض') },
    { key: 'cancelled', label: t('Annulées', 'Cancelled', 'ملغاة') },
    { key: 'out_of_order', label: t('Hors service', 'Out of order', 'خارج الخدمة') },
  ].map(status => ({
    ...status,
    count: periodBookings.filter(booking => booking.status === status.key).length,
  })).filter(status => status.count > 0);

  const floorStats = rooms.reduce((stats, room) => {
    const building = room.building?.trim() || room.groupName;
    const floor = room.floor?.trim() || t('Étage non renseigné', 'Floor not specified', 'الطابق غير محدد');
    const key = `${building}::${floor}`;
    if (!stats[key]) stats[key] = { key, building, floor, total: 0, occupied: 0, outOfOrder: 0 };
    stats[key].total += 1;
    if (occupiedTodayIds.has(room.id)) stats[key].occupied += 1;
    if (room.housekeepingStatus === 'out_of_order') stats[key].outOfOrder += 1;
    return stats;
  }, {} as Record<string, { key: string; building: string; floor: string; total: number; occupied: number; outOfOrder: number }>);

  const trendPoints = (() => {
    const bucketCount = range === '30d' ? 15 : range === '90d' ? 13 : 12;
    return Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(fromDate);
      start.setDate(start.getDate() + Math.floor(index * periodDays / bucketCount));
      const end = new Date(fromDate);
      end.setDate(end.getDate() + Math.floor((index + 1) * periodDays / bucketCount));
      const startKey = dateKey(start);
      const endKey = index === bucketCount - 1 ? toExclusive : dateKey(end);
      let occupiedPercentTotal = 0;
      let measuredDays = 0;
      const cursor = new Date(start);
      while (dateKey(cursor) < endKey) {
        const key = dateKey(cursor);
        const occupiedIds = new Set(bookings.filter(booking =>
          booking.sector === currentDomain &&
          !['cancelled', 'out_of_order', 'booking_offer'].includes(booking.status) &&
          booking.startDate <= key && booking.endDate > key && validRoomIds.has(booking.resourceId)
        ).map(booking => booking.resourceId));
        occupiedPercentTotal += validRooms.length ? Math.min(100, occupiedIds.size / validRooms.length * 100) : 0;
        measuredDays += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
      const arrivals = activeBookings.filter(booking => booking.startDate >= startKey && booking.startDate < endKey).length;
      const labelDate = new Date(`${startKey}T00:00:00`);
      return {
        label: new Intl.DateTimeFormat(language === 'fr' ? 'fr-DZ' : language === 'ar' ? 'ar-DZ' : 'en', {
          day: range === '365d' ? undefined : '2-digit',
          month: 'short',
        }).format(labelDate),
        occupancy: measuredDays ? Math.round(occupiedPercentTotal / measuredDays) : 0,
        arrivals,
      };
    });
  })();

  const stockCategoryStats = Array.from(new Set(stockItems.map(item => item.category))).map(category => ({
    category,
    quantity: stockItems.filter(item => item.category === category).reduce((sum, item) => sum + item.quantity, 0),
    low: stockItems.filter(item => item.category === category && item.quantity <= item.minThreshold).length,
  })).sort((a, b) => b.quantity - a.quantity);

  const stockMovementTrend = trendPoints.map((point, index) => {
    const bucketCount = trendPoints.length;
    const start = new Date(fromDate);
    start.setDate(start.getDate() + Math.floor(index * periodDays / bucketCount));
    const end = new Date(fromDate);
    end.setDate(end.getDate() + Math.floor((index + 1) * periodDays / bucketCount));
    const startKey = dateKey(start);
    const endKey = index === bucketCount - 1 ? toExclusive : dateKey(end);
    const movements = periodMovements.filter(movement => {
      const day = movement.timestamp.slice(0, 10);
      return day >= startKey && day < endKey;
    });
    return {
      label: point.label,
      value: movements.filter(movement => movement.delta < 0).reduce((sum, movement) => sum + Math.abs(movement.delta), 0),
    };
  });

  const Card = ({ icon: Icon, label, value, detail, tone = 'blue' }: {
    icon: React.ElementType; label: string; value: string | number; detail: string; tone?: string;
  }) => {
    const tones: Record<string, string> = {
      green: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
      amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
      purple: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
      blue: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900/60',
    };
    const accent = tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'purple' ? 'bg-violet-500' : 'bg-sky-500';
    return (
      <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <span className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 sm:text-[11px]">{label}</span>
          <span className={`shrink-0 rounded-xl p-2 ring-1 ${tones[tone] || tones.blue}`}><Icon size={17} strokeWidth={1.9} /></span>
        </div>
        <div className="mt-2 min-w-0 truncate text-[clamp(1.2rem,2vw,1.65rem)] font-bold leading-tight tracking-tight text-slate-950 dark:text-white tabular-nums">{value}</div>
        <p className="mt-1.5 min-h-4 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[11px]">{detail}</p>
      </article>
    );
  };

  const Section = ({ title, subtitle, icon: Icon, children }: {
    title: string; subtitle: string; icon: React.ElementType; children: React.ReactNode;
  }) => (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <span className="shrink-0 rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon size={17} strokeWidth={1.9} /></span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white sm:text-sm">{title}</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[11px]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );

  const progress = (value: number, color = 'bg-blue-500') => (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );

  return (
    <div className="min-w-0 w-full flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#f4f7fb] p-2.5 dark:bg-[#080f1c] sm:space-y-5 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"><Activity size={18} /></span>
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Appointment · {t('Pilotage métier', 'Business intelligence', 'ذكاء الأعمال')}</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white sm:text-xl">{t('Analytique des réservations', 'Booking & property analytics', 'تحليلات الحجوزات والمؤسسة')}</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('Occupation, activité commerciale et performance opérationnelle de l’établissement.', 'Occupancy, booking activity and property operations performance.', 'الإشغال ونشاط الحجوزات والأداء التشغيلي للمؤسسة.')}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('Période analysée', 'Analysis period', 'الفترة المحددة')}</span>
          <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:w-auto">
            {(['30d', '90d', '365d'] as RangeKey[]).map(key => (
              <button key={key} type="button" onClick={() => setRange(key)} aria-pressed={range === key} className={`min-h-9 flex-1 rounded-lg px-3 text-[11px] font-bold transition-all sm:flex-none ${range === key ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
                {key === '30d' ? t('30 jours', '30 days', '30 يوماً') : key === '90d' ? t('90 jours', '90 days', '90 يوماً') : t('12 mois', '12 months', '12 شهراً')}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6 sm:gap-3">
        <Card icon={Building2} label={t('Bâtiments', 'Buildings', 'المباني')} value={activeGroups.length} detail={t('Groupes configurés', 'Configured groups', 'المجموعات المهيأة')} />
        <Card icon={BedDouble} label={t('Chambres', 'Rooms', 'الغرف')} value={validRooms.length} detail={t('Hors service exclues', 'Out of order excluded', 'باستثناء خارج الخدمة')} />
        <Card icon={Activity} label={t('Occupées', 'Occupied', 'مشغولة')} value={occupiedToday} detail={t('Aujourd’hui', 'Today', 'اليوم')} tone="green" />
        <Card icon={TrendingUp} label={t('Occupation', 'Occupancy', 'الإشغال')} value={`${occupancyToday}%`} detail={t('Taux actuel', 'Current rate', 'النسبة الحالية')} tone="green" />
        <Card icon={CalendarRange} label={t('Réservations', 'Bookings', 'الحجوزات')} value={periodBookings.length} detail={t('Sur la période', 'In selected period', 'خلال الفترة')} tone="amber" />
        <Card icon={Wallet} label={t('CA réservations', 'Booking revenue', 'إيرادات الحجوزات')} value={periodRevenue} detail={t('Montant proratisé', 'Prorated value', 'القيمة المحسوبة')} tone="purple" />
      </div>

      <BookingTrendPanel
        points={trendPoints.map(point => ({ label: point.label, occupancy: point.occupancy, arrivals: point.arrivals }))}
        language={language}
        onExport={() => {
          const rows = [
            ['Période', 'Occupation (%)', 'Arrivées'],
            ...trendPoints.map(point => [point.label, String(point.occupancy), String(point.arrivals)]),
          ];
          const csv = rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
          const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `appointment-booking-analytics-${range}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
        }}
      />

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2 sm:gap-4">
        <Section icon={CalendarRange} title={t('Réservations par état', 'Bookings by status', 'الحجوزات حسب الحالة')} subtitle={t('Répartition des dossiers qui chevauchent la période, annulations comprises.', 'Distribution of bookings overlapping the period, including cancellations.', 'توزيع الحجوزات المتداخلة مع الفترة، بما فيها الملغاة.')}>
          {bookingStatusStats.length ? <div className="space-y-3">
            {bookingStatusStats.map(item => {
              const ratio = periodBookings.length ? item.count / periodBookings.length * 100 : 0;
              return <div key={item.key}>
                <div className="mb-1 flex justify-between gap-3 text-xs">
                  <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                  <strong className="tabular-nums text-slate-900 dark:text-white">{item.count} <span className="font-normal text-slate-400">({Math.round(ratio)}%)</span></strong>
                </div>
                {progress(ratio, item.key === 'cancelled' || item.key === 'out_of_order' ? 'bg-rose-500' : item.key === 'checked_in' ? 'bg-emerald-500' : 'bg-blue-500')}
              </div>;
            })}
          </div> : <p className="text-xs text-slate-500">{t('Aucune réservation sur la période.', 'No bookings in this period.', 'لا توجد حجوزات خلال هذه الفترة.')}</p>}
        </Section>

        <Section icon={Layers3} title={t('Occupation par bâtiment et étage', 'Occupancy by building and floor', 'الإشغال حسب المبنى والطابق')} subtitle={t('Capacité, occupation actuelle et chambres hors service par niveau.', 'Capacity, current occupancy and out-of-order rooms by level.', 'السعة والإشغال الحالي والغرف خارج الخدمة حسب الطابق.')}>
          {Object.values(floorStats).length ? <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {Object.values(floorStats).sort((a, b) => a.building.localeCompare(b.building) || a.floor.localeCompare(b.floor)).map(item => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{item.building} · {item.floor}</span>
                  <strong className="shrink-0 tabular-nums text-slate-700 dark:text-slate-200">{item.occupied}/{item.total}</strong>
                </div>
                {progress(item.total ? item.occupied / item.total * 100 : 0, 'bg-teal-500')}
                <div className="text-[10px] text-slate-500">{item.outOfOrder} {t('hors service', 'out of order', 'خارج الخدمة')}</div>
              </div>
            ))}
          </div> : <p className="text-xs text-slate-500">{t('Aucune donnée de bâtiment ou d’étage.', 'No building or floor data.', 'لا توجد بيانات مبانٍ أو طوابق.')}</p>}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendLine
          title={t('Sorties de stock dans le temps', 'Inventory issues over time', 'حركات صرف المخزون عبر الزمن')}
          subtitle={t('Unités sorties selon les mouvements de stock enregistrés.', 'Units issued from recorded stock movements.', 'الوحدات المصروفة وفق حركات المخزون المسجلة.')}
          points={periodMovements.length ? stockMovementTrend : []}
          suffix={t('unités', 'units', 'وحدات')}
          color="#d97706"
          emptyLabel={t('Aucun mouvement de stock enregistré.', 'No stock movements recorded.', 'لا توجد حركات مخزون مسجلة.')}
        />
        <Section icon={Boxes} title={t('Stock par catégorie', 'Stock by category', 'المخزون حسب الفئة')} subtitle={t('Quantités disponibles et références sous seuil.', 'Available quantities and items below threshold.', 'الكميات المتاحة والأصناف دون الحد الأدنى.')}>
          {stockCategoryStats.length ? <div className="space-y-3">
            {stockCategoryStats.map(item => (
              <div key={item.category}>
                <div className="mb-1 flex justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{item.category}</span>
                  <strong className="shrink-0 tabular-nums text-slate-900 dark:text-white">{item.quantity}</strong>
                </div>
                {progress(stockCategoryStats[0].quantity ? item.quantity / stockCategoryStats[0].quantity * 100 : 0, 'bg-amber-500')}
                <div className="mt-1 text-[10px] text-slate-500">{item.low} {t('référence(s) sous seuil', 'item(s) below threshold', 'أصناف دون الحد')}</div>
              </div>
            ))}
          </div> : <p className="text-xs text-slate-500">{t('Aucun article de stock enregistré.', 'No inventory items recorded.', 'لا توجد أصناف مخزون مسجلة.')}</p>}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section icon={Flower2} title={t('Spa & bien-être', 'Spa & wellness', 'المنتجع الصحي والعافية')} subtitle={t('Indicateurs à connecter aux rendez-vous, prestations, cabines et praticiens.', 'Metrics awaiting connection to appointments, treatments, facilities and therapists.', 'مؤشرات بانتظار ربطها بالمواعيد والخدمات والمرافق والمعالجين.')}>
          <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('Source analytique non centralisée', 'Analytics source not centralized', 'مصدر التحليلات غير مركزي')}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('Les rendez-vous Spa sont actuellement conservés dans l’état local de l’écran Spa. Ils ne sont pas encore exposés à ce tableau de bord. Aucun chiffre n’est affiché pour éviter de confondre les données de démonstration avec l’activité réelle.', 'Spa appointments currently live in the Spa screen local state and are not exposed to this dashboard. No figures are shown to avoid presenting demo data as real activity.', 'مواعيد السبا محفوظة حالياً في الحالة المحلية لشاشة السبا ولا تتوفر لهذا التقرير. لا يتم عرض أرقام لتجنب الخلط بين بيانات العرض والنشاط الفعلي.')}</p>
          </div>
        </Section>
        <Section icon={Presentation} title={t('Conférences & événements', 'Conferences & events', 'المؤتمرات والفعاليات')} subtitle={t('Capacité, occupation des salles, sessions et revenus événementiels.', 'Room capacity, venue utilization, sessions and event revenue.', 'سعة القاعات واستخدامها والجلسات وإيرادات الفعاليات.')}>
          <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('Module non disponible dans cette version', 'Module not available in this version', 'الوحدة غير متاحة في هذا الإصدار')}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('Le dépôt ne contient pas encore de modèle de données ni de module de gestion des conférences. Ces indicateurs nécessiteront un vrai référentiel de salles, événements, sessions et réservations.', 'The repository does not yet contain a conference data model or management module. These metrics require a real source for venues, events, sessions and bookings.', 'لا يحتوي المشروع بعد على نموذج بيانات أو وحدة لإدارة المؤتمرات. تتطلب هذه المؤشرات مصدراً فعلياً للقاعات والفعاليات والجلسات والحجوزات.')}</p>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section icon={Building2} title={t('Performance par bâtiment', 'Performance by building', 'الأداء حسب المبنى')} subtitle={t('Capacité, occupation sur la période et chambres hors service.', 'Capacity, period occupancy and out-of-order rooms.', 'السعة والإشغال والغرف خارج الخدمة.')}>
          {buildingStats.length ? <div className="space-y-4">
            {buildingStats.map(building => (
              <div key={building.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{building.name}</span>
                  <span className="shrink-0 font-mono font-bold text-slate-700 dark:text-slate-200">{building.occupancy}%</span>
                </div>
                {progress(building.occupancy)}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span>{building.total} {t('chambres', 'rooms', 'غرف')}</span>
                  <span>{building.occupiedNow} {t('occupées', 'occupied', 'مشغولة')} {t('aujourd’hui', 'today', 'اليوم')}</span>
                  <span>{building.roomNights} {t('nuitées vendues', 'room nights sold', 'ليالٍ محجوزة')}</span>
                  {building.outOfOrder > 0 && <span className="font-semibold text-rose-500">{building.outOfOrder} {t('hors service', 'out of order', 'خارج الخدمة')}</span>}
                </div>
              </div>
            ))}
          </div> : <p className="text-xs text-slate-500">{t('Aucun bâtiment ou groupe de chambres configuré.', 'No building or room group configured.', 'لا توجد مبانٍ أو مجموعات غرف مهيأة.')}</p>}
        </Section>

        <Section icon={BedDouble} title={t('Utilisation des chambres', 'Room utilization', 'استخدام الغرف')} subtitle={t('Occupation réelle aujourd’hui et répartition par type.', 'Actual occupancy today and breakdown by room type.', 'الإشغال الفعلي اليوم والتوزيع حسب نوع الغرفة.')}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Nuitées vendues', 'Room nights sold', 'الليالي المباعة')}</div><div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{occupiedRoomNights.toLocaleString()}</div></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Occupation période', 'Period occupancy', 'إشغال الفترة')}</div><div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{periodOccupancy}%</div></div>
          </div>
          <div className="space-y-3">
            {roomTypes.map(item => (
              <div key={item.type}>
                <div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="truncate text-slate-700 dark:text-slate-200">{item.type}</span><span className="shrink-0 text-slate-500">{item.occupied}/{item.count}</span></div>
                {progress(item.count ? item.occupied / item.count * 100 : 0, 'bg-emerald-500')}
              </div>
            ))}
            {!roomTypes.length && <p className="text-xs text-slate-500">{t('Aucune chambre enregistrée.', 'No rooms registered.', 'لا توجد غرف مسجلة.')}</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {[
              ['clean', t('Propres', 'Clean', 'نظيفة'), 'bg-emerald-500'],
              ['cleaning', t('En nettoyage', 'Cleaning', 'قيد التنظيف'), 'bg-amber-500'],
              ['dirty', t('À nettoyer', 'Dirty', 'تحتاج تنظيفاً'), 'bg-rose-500'],
              ['out_of_order', t('Hors service', 'Out of order', 'خارج الخدمة'), 'bg-slate-500'],
            ].map(([key, label, color]) => <span key={key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><i className={`h-2 w-2 rounded-full ${color}`} />{label}: {housekeepingCounts[key] || 0}</span>)}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section icon={Package} title={t('Consommables & mouvements', 'Consumables & movements', 'المستهلكات والحركات')} subtitle={t('Sorties, entrées et consommation déclarée sur la période.', 'Stock issues, receipts and recorded consumption for the period.', 'الصادرات والواردات والاستهلاك المسجل خلال الفترة.')}>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30"><div className="text-[10px] text-rose-700 dark:text-rose-300">{t('Unités consommées', 'Units consumed', 'الوحدات المستهلكة')}</div><div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{consumedUnits}</div></div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="text-[10px] text-emerald-700 dark:text-emerald-300">{t('Entrées stock', 'Stock received', 'الوارد إلى المخزون')}</div><div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{received.reduce((sum, movement) => sum + movement.delta, 0)}</div></div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70 sm:col-span-1"><div className="text-[10px] text-slate-500">{t('Coût estimé des sorties', 'Estimated issue cost', 'التكلفة التقديرية للصرف')}</div><div className="mt-1 text-base font-bold text-slate-900 dark:text-white">{fmtMoney(consumedValue, 'DZD')}</div></div>
          </div>
          <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500"><span>{t('Consommation saisie dans les tâches', 'Consumption recorded in tasks', 'الاستهلاك المسجل في المهام')}</span><strong className="text-slate-800 dark:text-slate-200">{taskConsumedUnits} {t('unités', 'units', 'وحدات')}</strong></div>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {consumption.slice().reverse().slice(0, 8).map(movement => (
              <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-[11px] last:border-0 dark:border-slate-800">
                <div className="min-w-0"><div className="truncate font-semibold text-slate-800 dark:text-slate-200">{movement.itemName}</div><div className="truncate text-[10px] text-slate-500">{movement.room || movement.reason} · {movement.timestamp.slice(0, 10)}</div></div>
                <span className="shrink-0 font-mono font-bold text-rose-600">−{Math.abs(movement.delta)}</span>
              </div>
            ))}
            {!consumption.length && <p className="text-xs text-slate-500">{t('Aucune sortie de stock sur cette période.', 'No stock issues in this period.', 'لا توجد حركات صرف خلال هذه الفترة.')}</p>}
          </div>
        </Section>

        <Section icon={Boxes} title={t('État du stock', 'Inventory status', 'حالة المخزون')} subtitle={t('Valeur immobilisée, seuils d’alerte et articles à réapprovisionner.', 'Inventory value, low-stock thresholds and replenishment needs.', 'قيمة المخزون وحدود التنبيه والمواد المطلوب تجديدها.')}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Références', 'Items', 'الأصناف')}</div><div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{stockItems.length}</div></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Valeur du stock', 'Stock value', 'قيمة المخزون')}</div><div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{fmtMoney(stockValue, 'DZD')}</div></div>
          </div>
          {lowStock.length ? <div className="space-y-2">
            {lowStock.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/20"><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name}</div><div className="text-[10px] text-amber-700 dark:text-amber-300">{item.category} · {t('Seuil', 'Threshold', 'الحد')}: {item.minThreshold}</div></div><div className="shrink-0 text-right"><div className="text-sm font-bold text-amber-700 dark:text-amber-300">{item.quantity} {item.unit}</div><div className="text-[10px] text-slate-500">{t('Restant', 'Remaining', 'المتبقي')}</div></div></div>)}
          </div> : <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 size={16} />{t('Aucun article sous le seuil minimum.', 'No items below minimum threshold.', 'لا توجد مواد دون الحد الأدنى.')}</div>}
        </Section>
      </div>

      <Section icon={FileText} title={t('Facturation & encaissements', 'Billing & collections', 'الفوترة والتحصيل')} subtitle={t('Factures émises, devis, montants encaissés et soldes clients.', 'Issued invoices, quotations, collected amounts and customer balances.', 'الفواتير الصادرة وعروض الأسعار والمبالغ المحصلة وأرصدة العملاء.')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Factures', 'Invoices', 'الفواتير')}</div><div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{issuedInvoices.length}</div></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Total facturé TTC', 'Total invoiced', 'إجمالي الفواتير')}</div><div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{invoicedTotal}</div></div>
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="text-[10px] text-emerald-700 dark:text-emerald-300">{t('Acomptes encaissés', 'Collected deposits', 'التسبيقات المحصلة')}</div><div className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">{collectedTotal}</div></div>
          <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30"><div className="text-[10px] text-rose-700 dark:text-rose-300">{t('Reste à encaisser', 'Outstanding balance', 'المبلغ المتبقي')}</div><div className="mt-1 text-sm font-bold text-rose-700 dark:text-rose-300">{dueTotal}</div></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <span>{paidInvoices.length} {t('factures soldées', 'paid invoices', 'فواتير مسددة')}</span>
          <span>·</span><span>{unpaidCount} {t('en attente / en retard', 'pending / overdue', 'معلقة / متأخرة')}</span>
          <span>·</span><span>{quotes.length} {t('devis émis', 'quotes issued', 'عروض أسعار')}</span>
        </div>
        <div className="mt-4 max-h-56 overflow-y-auto">
          {periodInvoices.slice().sort((a,b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 8).map(invoice => (
            <div key={invoice.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5 text-xs dark:border-slate-800">
              <div className="min-w-0"><div className="truncate font-semibold text-slate-800 dark:text-slate-200">{invoice.docNumber} · {invoice.customerName}</div><div className="text-[10px] text-slate-500">{invoice.issueDate} · {invoice.status}</div></div>
              <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-200">{fmtMoney(invoice.totalTTC, invoice.currency || currency)}</span>
            </div>
          ))}
          {!periodInvoices.length && <p className="pt-2 text-xs text-slate-500">{t('Aucun document de facturation sur cette période.', 'No billing documents in this period.', 'لا توجد مستندات فوترة خلال هذه الفترة.')}</p>}
        </div>
      </Section>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
        <span>{t('Source : réservations, inventaire, mouvements de stock, tâches PMS et documents de facturation locaux.', 'Sources: bookings, inventory, stock movements, PMS tasks and locally stored billing documents.', 'المصادر: الحجوزات والمخزون وحركاته ومهام النظام ومستندات الفوترة المحلية.')}</span>
        <span>{from} → {today}</span>
      </footer>
    </div>
  );
};
