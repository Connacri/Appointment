import React, { useMemo, useState } from 'react';
import {
  Building2, BedDouble, Users, TrendingUp, Package, ArrowDownRight,
  ArrowUpRight, FileText, CircleAlert, CheckCircle2, Clock3, Boxes,
  CalendarDays, Sparkles, Wallet, Ban, Activity,
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
  const periodRevenue = activeBookings.reduce((sum, booking) => {
    const totalNights = Math.max(1, dayDiff(booking.startDate, booking.endDate));
    const nightsInPeriod = overlapNights(booking.startDate, booking.endDate, from, toExclusive);
    return sum + (booking.totalPrice * nightsInPeriod / totalNights);
  }, 0);
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
  const invoicedTotal = issuedInvoices.reduce((sum, invoice) => sum + invoice.totalTTC, 0);
  const collectedTotal = issuedInvoices.reduce((sum, invoice) => sum + invoice.depositPaid, 0);
  const dueTotal = issuedInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
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

  const Card = ({ icon: Icon, label, value, detail, tone = 'blue' }: {
    icon: React.ElementType; label: string; value: string | number; detail: string; tone?: string;
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

  const Section = ({ title, subtitle, icon: Icon, children }: {
    title: string; subtitle: string; icon: React.ElementType; children: React.ReactNode;
  }) => (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon size={18} /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
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
    <div className="min-w-0 w-full flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 p-2.5 dark:bg-slate-950 sm:space-y-5 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Activity size={18} className="text-blue-600" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{t('Analytique de l’établissement', 'Property performance analytics', 'تحليلات أداء المؤسسة')}</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Pilotage opérationnel : bâtiments, chambres, consommation, stock et facturation.', 'Operational overview: buildings, rooms, consumption, inventory and billing.', 'نظرة تشغيلية: المباني والغرف والاستهلاك والمخزون والفوترة.')}</p>
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

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4 sm:gap-3">
        <Card icon={Building2} label={t('Bâtiments', 'Buildings', 'المباني')} value={activeGroups.length} detail={t('Groupes de chambres configurés', 'Configured room groups', 'مجموعات الغرف المهيأة')} />
        <Card icon={BedDouble} label={t('Chambres exploitables', 'Operational rooms', 'الغرف المتاحة للتشغيل')} value={validRooms.length} detail={t(`${occupiedToday} occupées aujourd’hui`, `${occupiedToday} occupied today`, `${occupiedToday} مشغولة اليوم`)} />
        <Card icon={TrendingUp} label={t('Occupation actuelle', 'Current occupancy', 'الإشغال الحالي')} value={`${occupancyToday}%`} detail={t(`${occupiedToday} / ${validRooms.length} chambres exploitables`, `${occupiedToday} / ${validRooms.length} operational rooms`, `${occupiedToday} / ${validRooms.length} غرفة قابلة للتشغيل`)} tone="green" />
        <Card icon={Wallet} label={t('CA réservations', 'Booking revenue', 'إيرادات الحجوزات')} value={fmtMoney(periodRevenue)} detail={t('Part estimée des séjours sur la période', 'Prorated booking value for selected period', 'قيمة الإقامات المقدرة خلال الفترة')} tone="purple" />
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
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="text-[10px] text-slate-500">{t('Total facturé TTC', 'Total invoiced', 'إجمالي الفواتير')}</div><div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{fmtMoney(invoicedTotal)}</div></div>
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="text-[10px] text-emerald-700 dark:text-emerald-300">{t('Acomptes encaissés', 'Collected deposits', 'التسبيقات المحصلة')}</div><div className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmtMoney(collectedTotal)}</div></div>
          <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30"><div className="text-[10px] text-rose-700 dark:text-rose-300">{t('Reste à encaisser', 'Outstanding balance', 'المبلغ المتبقي')}</div><div className="mt-1 text-sm font-bold text-rose-700 dark:text-rose-300">{fmtMoney(dueTotal)}</div></div>
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
