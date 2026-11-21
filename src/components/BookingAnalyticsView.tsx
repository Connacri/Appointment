import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  BedDouble,
  Package,
  FileText,
  CheckCircle2,
  Boxes,
  CalendarRange,
  Flower2,
  Presentation,
  ChevronDown,
  Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvoiceRecord } from '../types/booking';
import {
  buildSmoothSplinePath,
  computeRoundedPieWedges,
  computeSegmentedRingArcs,
  type RingSliceInput,
} from '../utils/analyticsCharts';

type RangeKey = '30d' | '90d' | '365d';
type RingDimension = 'status' | 'building' | 'roomType' | 'housekeeping';
type SplineMetric = 'occupancy' | 'arrivals' | 'revenue' | 'stockOut';
type SectionFilter = 'all' | 'inventory' | 'billing' | 'stock' | 'modules';

const RING_PALETTE = ['#87CEFA', '#7178FF', '#67C380', '#6E717A', '#FFA84B', '#FF7369'];

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
    bookings,
    resourceGroups,
    stockItems,
    stockMovements,
    tasks,
    language,
    currency,
    currentDomain,
    establishmentProfile,
    setActiveView,
  } = useApp();

  const [range, setRange] = useState<RangeKey>('30d');
  const [ringDimension, setRingDimension] = useState<RingDimension>('status');
  const [selectedRingKey, setSelectedRingKey] = useState<string | null>(null);
  const [selectedWedgeKey, setSelectedWedgeKey] = useState<string | null>(null);
  const [splineMetric, setSplineMetric] = useState<SplineMetric>('occupancy');
  const [hoveredSplineIndex, setHoveredSplineIndex] = useState<number | null>(null);
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');

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
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);
  const localeCode = isFr ? 'fr-DZ' : isAr ? 'ar-DZ' : 'en-US';

  const now = new Date();
  const today = dateKey(now);
  const periodDays = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - (periodDays - 1));
  const from = dateKey(fromDate);
  const toExclusiveDate = new Date(now);
  toExclusiveDate.setDate(toExclusiveDate.getDate() + 1);
  const toExclusive = dateKey(toExclusiveDate);

  const currentMonthHeadline = useMemo(() => {
    if (range === '30d') {
      const raw = new Intl.DateTimeFormat(localeCode, { month: 'long' }).format(now);
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    if (range === '90d') return t('90 derniers jours', 'Last 90 days', 'آخر 90 يوماً');
    return t('12 derniers mois', 'Last 12 months', 'آخر 12 شهراً');
  }, [range, localeCode, isFr, isAr]);

  const { activeGroups, rooms } = useMemo(() => {
    const groups = resourceGroups.filter((group) => group.sector === currentDomain);
    const groupRooms = groups.flatMap((group) =>
      group.resources.map((resource) => ({
        ...resource,
        groupId: group.id,
        groupName: typeof group.name === 'string' ? group.name : group.name[language] || group.name.fr,
      }))
    );
    return { activeGroups: groups, rooms: groupRooms };
  }, [resourceGroups, currentDomain, language]);

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.sector === currentDomain &&
          booking.status !== 'cancelled' &&
          booking.status !== 'out_of_order' &&
          booking.startDate < toExclusive &&
          booking.endDate > from
      ),
    [bookings, currentDomain, from, toExclusive]
  );

  const { validRooms, validRoomIds } = useMemo(() => {
    const available = rooms.filter((room) => room.housekeepingStatus !== 'out_of_order');
    return { validRooms: available, validRoomIds: new Set(available.map((room) => room.id)) };
  }, [rooms]);

  const occupiedTodayIds = useMemo(
    () =>
      new Set(
        bookings
          .filter(
            (booking) =>
              booking.sector === currentDomain &&
              booking.status !== 'cancelled' &&
              booking.status !== 'out_of_order' &&
              booking.startDate <= today &&
              booking.endDate > today
          )
          .map((booking) => booking.resourceId)
      ),
    [bookings, currentDomain, today]
  );

  const occupiedToday = validRooms.filter((room) => occupiedTodayIds.has(room.id)).length;
  const occupancyToday = validRooms.length ? Math.round((occupiedToday / validRooms.length) * 100) : 0;
  const roomNightsAvailable = validRooms.length * periodDays;

  const { occupiedRoomNights, periodRevenueByCurrency, primaryRevenueNumber } = useMemo(() => {
    let nights = 0;
    const revenue = activeBookings.reduce((totals, booking) => {
      const nightsInPeriod = overlapNights(booking.startDate, booking.endDate, from, toExclusive);
      nights += nightsInPeriod;
      const totalNights = Math.max(1, dayDiff(booking.startDate, booking.endDate));
      const code = booking.paymentCurrency || currency;
      totals[code] = (totals[code] || 0) + (booking.totalPrice * nightsInPeriod) / totalNights;
      return totals;
    }, {} as Record<string, number>);
    const primaryTotal = revenue[currency] ?? Object.values(revenue)[0] ?? 0;
    return {
      occupiedRoomNights: nights,
      periodRevenueByCurrency: revenue,
      primaryRevenueNumber: Math.round(primaryTotal),
    };
  }, [activeBookings, from, toExclusive, currency]);

  const periodOccupancy = roomNightsAvailable
    ? Math.min(100, Math.round((occupiedRoomNights / roomNightsAvailable) * 100))
    : 0;

  const fmtMoney = (amount: number, code = currency) => {
    const normalized = code === 'DA' ? 'DZD' : code;
    try {
      return new Intl.NumberFormat(localeCode, {
        style: 'currency',
        currency: normalized,
        maximumFractionDigits: 0,
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

  const buildingStats = useMemo(() => {
    const bookingsByResource = new Map<string, typeof activeBookings>();
    for (const booking of activeBookings) {
      const bucket = bookingsByResource.get(booking.resourceId);
      if (bucket) bucket.push(booking);
      else bookingsByResource.set(booking.resourceId, [booking]);
    }

    return activeGroups.map((group) => {
      const groupRooms = group.resources.filter((room) => room.housekeepingStatus !== 'out_of_order');
      const occupiedNow = groupRooms.filter((room) => occupiedTodayIds.has(room.id)).length;
      let nights = 0;
      let bookingCount = 0;
      for (const room of group.resources) {
        const roomBookings = bookingsByResource.get(room.id);
        if (!roomBookings) continue;
        bookingCount += roomBookings.length;
        for (const booking of roomBookings) {
          nights += overlapNights(booking.startDate, booking.endDate, from, toExclusive);
        }
      }
      const capacity = groupRooms.length * periodDays;
      return {
        id: group.id,
        name: typeof group.name === 'string' ? group.name : group.name[language] || group.name.fr,
        total: group.resources.length,
        available: groupRooms.length,
        outOfOrder: group.resources.length - groupRooms.length,
        occupiedNow,
        occupancy: capacity ? Math.min(100, Math.round((nights / capacity) * 100)) : 0,
        roomNights: nights,
        bookingCount,
      };
    });
  }, [activeGroups, activeBookings, occupiedTodayIds, from, toExclusive, periodDays, language]);

  const {
    lowStock,
    stockValue,
    periodMovements,
    consumption,
    received,
    consumedUnits,
    consumedValue,
    taskConsumedUnits,
  } = useMemo(() => {
    const low = stockItems.filter((item) => item.quantity <= item.minThreshold);
    const value = stockItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const movements = stockMovements.filter(
      (movement) => movement.timestamp.slice(0, 10) >= from && movement.timestamp.slice(0, 10) < toExclusive
    );
    const issues = movements.filter((movement) => movement.delta < 0);
    const receipts = movements.filter((movement) => movement.delta > 0);
    const units = issues.reduce((sum, movement) => sum + Math.abs(movement.delta), 0);
    const unitCostById = new Map(stockItems.map((item) => [item.id, item.unitCost]));
    const issueValue = issues.reduce(
      (sum, movement) => sum + Math.abs(movement.delta) * (unitCostById.get(movement.itemId) || 0),
      0
    );
    const taskUnits = tasks
      .filter((task) => task.date >= from && task.date < toExclusive)
      .reduce(
        (total, task) => total + (task.consumedItems ?? []).reduce((sum, item) => sum + item.quantity, 0),
        0
      );
    return {
      lowStock: low,
      stockValue: value,
      periodMovements: movements,
      consumption: issues,
      received: receipts,
      consumedUnits: units,
      consumedValue: issueValue,
      taskConsumedUnits: taskUnits,
    };
  }, [stockItems, stockMovements, tasks, from, toExclusive]);

  const {
    periodInvoices,
    issuedInvoices,
    quotes,
    paidInvoices,
    invoicedTotal,
    collectedTotal,
    dueTotal,
    unpaidCount,
  } = useMemo(() => {
    const invoices = invoiceDocs.filter(
      (invoice) => invoice.domain === currentDomain && invoice.issueDate >= from && invoice.issueDate < toExclusive
    );
    const issued = invoices.filter((invoice) => invoice.docType === 'invoice');
    const quoteDocs = invoices.filter((invoice) => invoice.docType === 'quote');
    const paid = issued.filter((invoice) => invoice.status === 'paid');
    const pending = issued.filter((invoice) => ['sent', 'overdue', 'accepted'].includes(invoice.status));
    const sumCurrencies = (field: 'totalTTC' | 'depositPaid' | 'balanceDue') =>
      issued.reduce((totals, invoice) => {
        const code = invoice.currency || currency;
        totals[code] = (totals[code] || 0) + invoice[field];
        return totals;
      }, {} as Record<string, number>);
    return {
      periodInvoices: invoices,
      issuedInvoices: issued,
      quotes: quoteDocs,
      paidInvoices: paid,
      invoicedTotal: formatBreakdown(sumCurrencies('totalTTC')),
      collectedTotal: formatBreakdown(sumCurrencies('depositPaid')),
      dueTotal: formatBreakdown(sumCurrencies('balanceDue')),
      unpaidCount: pending.length,
    };
  }, [invoiceDocs, currentDomain, from, toExclusive, currency, language]);

  const { housekeepingCounts, roomTypes } = useMemo(() => {
    const counts = rooms.reduce((result, room) => {
      const status = room.housekeepingStatus || 'clean';
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    const byType = new Map<string, { count: number; occupied: number }>();
    for (const room of rooms) {
      const entry = byType.get(room.type) ?? { count: 0, occupied: 0 };
      entry.count += 1;
      if (occupiedTodayIds.has(room.id)) entry.occupied += 1;
      byType.set(room.type, entry);
    }
    return {
      housekeepingCounts: counts,
      roomTypes: [...byType.entries()].map(([type, entry]) => ({ type, ...entry })),
    };
  }, [rooms, occupiedTodayIds]);

  const periodBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.sector === currentDomain && booking.startDate < toExclusive && booking.endDate > from
      ),
    [bookings, currentDomain, from, toExclusive]
  );

  // Left Segmented Ring Data based on selected dimension
  const ringSourceItems = useMemo<RingSliceInput[]>(() => {
    if (ringDimension === 'building') {
      return buildingStats
        .slice()
        .sort((a, b) => b.roomNights - a.roomNights || b.total - a.total)
        .slice(0, 5)
        .map((building, index) => ({
          key: building.id,
          label: building.name,
          value: building.roomNights > 0 ? building.roomNights : building.total,
          detail: `${building.occupancy}% · ${building.occupiedNow}/${building.total}`,
          color: RING_PALETTE[index % RING_PALETTE.length],
        }));
    }

    if (ringDimension === 'roomType') {
      return roomTypes
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((rt, index) => ({
          key: rt.type,
          label: rt.type,
          value: rt.count,
          detail: `${rt.occupied}/${rt.count}`,
          color: RING_PALETTE[index % RING_PALETTE.length],
        }));
    }

    if (ringDimension === 'housekeeping') {
      const statuses: Array<{ key: string; label: string; color: string }> = [
        { key: 'clean', label: t('Propres', 'Clean', 'نظيفة'), color: '#67C380' },
        { key: 'cleaning', label: t('En nettoyage', 'Cleaning', 'قيد التنظيف'), color: '#87CEFA' },
        { key: 'dirty', label: t('À nettoyer', 'Dirty', 'تحتاج تنظيفاً'), color: '#FFA84B' },
        { key: 'out_of_order', label: t('Hors service', 'Out of order', 'خارج الخدمة'), color: '#6E717A' },
      ];
      return statuses.map((item) => ({
        key: item.key,
        label: item.label,
        value: housekeepingCounts[item.key] || 0,
        detail: `${housekeepingCounts[item.key] || 0}`,
        color: item.color,
      }));
    }

    // Default: 'status' (Booking statuses)
    const statusBuckets = [
      {
        key: 'confirmed',
        label: t('Confirmées', 'Confirmed', 'مؤكدة'),
        color: '#87CEFA',
        value: periodBookings.filter((b) => ['confirmed', 'due_in', 'due_out'].includes(b.status)).length,
      },
      {
        key: 'active',
        label: t('En séjour', 'Checked in', 'مقيمون حالياً'),
        color: '#7178FF',
        value: periodBookings.filter((b) => b.status === 'checked_in' || b.status === 'checked_out').length,
      },
      {
        key: 'pending',
        label: t('En attente', 'Pending', 'قيد الانتظار'),
        color: '#67C380',
        value: periodBookings.filter((b) => ['new', 'booking_offer'].includes(b.status)).length,
      },
      {
        key: 'cancelled',
        label: t('Annulées', 'Cancelled', 'ملغاة'),
        color: '#6E717A',
        value: periodBookings.filter((b) => b.status === 'cancelled' || b.status === 'out_of_order').length,
      },
    ];
    return statusBuckets.map((item) => ({
      ...item,
      detail: `${item.value}`,
    }));
  }, [ringDimension, buildingStats, roomTypes, housekeepingCounts, periodBookings, isFr, isAr]);

  const computedRing = useMemo(
    () => computeSegmentedRingArcs(ringSourceItems, { cx: 90, cy: 90, r: 68, gapDeg: 18 }),
    [ringSourceItems]
  );

  const activeRingSlice =
    computedRing.slices.find((s) => s.key === selectedRingKey) ?? computedRing.slices[0] ?? null;

  // Right Rounded Pie Chart: Payment & Stay Financial Split
  const pieSourceItems = useMemo<RingSliceInput[]>(() => {
    const paidCount = periodBookings.filter(
      (b) => b.status !== 'cancelled' && b.paymentStatus === 'paid'
    ).length;
    const dueCount = periodBookings.filter(
      (b) => b.status !== 'cancelled' && b.paymentStatus !== 'paid'
    ).length;
    const cancelledOrOffersCount = periodBookings.filter(
      (b) => b.status === 'cancelled' || b.status === 'booking_offer'
    ).length;

    return [
      {
        key: 'paid',
        label: t('Réglées', 'Settled', 'مدفوعة'),
        value: paidCount,
        detail: `${paidCount}`,
        color: '#D9FF54',
      },
      {
        key: 'due',
        label: t('À encaisser', 'Balance due', 'قيد التحصيل'),
        value: dueCount,
        detail: `${dueCount}`,
        color: '#FF7369',
      },
      {
        key: 'cancelled',
        label: t('Annulées / Offres', 'Cancelled / Offers', 'ملغاة / عروض'),
        value: cancelledOrOffersCount,
        detail: `${cancelledOrOffersCount}`,
        color: '#FFA84B',
      },
    ];
  }, [periodBookings, isFr, isAr]);

  const computedPie = useMemo(
    () => computeRoundedPieWedges(pieSourceItems, { cx: 90, cy: 90, r: 58, radialOffset: 3.5 }),
    [pieSourceItems]
  );

  const activeWedge =
    computedPie.wedges.find((w) => w.key === selectedWedgeKey) ?? computedPie.wedges[0] ?? null;

  const floorStats = useMemo(() => {
    return rooms.reduce((stats, room) => {
      const building = room.building?.trim() || room.groupName;
      const floor = room.floor?.trim() || t('Étage non renseigné', 'Floor not specified', 'الطابق غير محدد');
      const key = `${building}::${floor}`;
      if (!stats[key]) stats[key] = { key, building, floor, total: 0, occupied: 0, outOfOrder: 0 };
      stats[key].total += 1;
      if (occupiedTodayIds.has(room.id)) stats[key].occupied += 1;
      if (room.housekeepingStatus === 'out_of_order') stats[key].outOfOrder += 1;
      return stats;
    }, {} as Record<string, { key: string; building: string; floor: string; total: number; occupied: number; outOfOrder: number }>);
  }, [rooms, occupiedTodayIds, language]);

  const trendPoints = useMemo(() => {
    const bucketCount = range === '30d' ? 8 : range === '90d' ? 9 : 12;

    const dayKeys: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    while (dateKey(cursor) < toExclusive) {
      dayKeys.push(dateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    const dayIndex = new Map(dayKeys.map((key, index) => [key, index]));
    const diff = new Int32Array(dayKeys.length + 1);
    const firstDay = dayKeys[0];
    const lastDay = dayKeys[dayKeys.length - 1];

    if (firstDay && lastDay) {
      const intervalsByResource = new Map<string, Array<{ start: number; end: number }>>();
      for (const booking of activeBookings) {
        if (!validRoomIds.has(booking.resourceId)) continue;
        if (['cancelled', 'out_of_order', 'booking_offer'].includes(booking.status)) continue;
        if (booking.endDate <= firstDay || booking.startDate > lastDay) continue;

        let start = dayIndex.get(booking.startDate);
        if (start === undefined) start = booking.startDate < firstDay ? 0 : -1;
        let end = dayIndex.get(booking.endDate);
        if (end === undefined) end = booking.endDate > lastDay ? dayKeys.length : -1;
        if (start < 0 || end < 0 || end <= start) continue;

        const list = intervalsByResource.get(booking.resourceId);
        if (list) list.push({ start, end });
        else intervalsByResource.set(booking.resourceId, [{ start, end }]);
      }

      for (const intervals of intervalsByResource.values()) {
        intervals.sort((a, b) => a.start - b.start);
        let currentStart = -1;
        let currentEnd = -1;
        for (const interval of intervals) {
          if (currentStart < 0) {
            currentStart = interval.start;
            currentEnd = interval.end;
            continue;
          }
          if (interval.start <= currentEnd) {
            if (interval.end > currentEnd) currentEnd = interval.end;
            continue;
          }
          diff[currentStart] += 1;
          diff[Math.min(currentEnd, dayKeys.length)] -= 1;
          currentStart = interval.start;
          currentEnd = interval.end;
        }
        if (currentStart >= 0) {
          diff[currentStart] += 1;
          diff[Math.min(currentEnd, dayKeys.length)] -= 1;
        }
      }
    }

    const occupiedByDay = new Int32Array(dayKeys.length);
    let occupied = 0;
    for (let index = 0; index < dayKeys.length; index += 1) {
      occupied += diff[index];
      occupiedByDay[index] = occupied;
    }

    const arrivalsByDay = new Map<string, number>();
    const revenueByDay = new Map<string, number>();
    for (const booking of activeBookings) {
      if (booking.startDate >= from && booking.startDate < toExclusive) {
        arrivalsByDay.set(booking.startDate, (arrivalsByDay.get(booking.startDate) || 0) + 1);
      }
      const nights = Math.max(1, dayDiff(booking.startDate, booking.endDate));
      const nightly = booking.totalPrice / nights;
      for (const dKey of dayKeys) {
        if (dKey >= booking.startDate && dKey < booking.endDate) {
          revenueByDay.set(dKey, (revenueByDay.get(dKey) || 0) + nightly);
        }
      }
    }

    const stockOutByDay = new Map<string, number>();
    for (const movement of periodMovements) {
      if (movement.delta >= 0) continue;
      const d = movement.timestamp.slice(0, 10);
      stockOutByDay.set(d, (stockOutByDay.get(d) || 0) + Math.abs(movement.delta));
    }

    return Array.from({ length: bucketCount }, (_, index) => {
      const startOffset = Math.floor((index * dayKeys.length) / bucketCount);
      const endOffset =
        index === bucketCount - 1
          ? dayKeys.length
          : Math.floor(((index + 1) * dayKeys.length) / bucketCount);
      let occupancyPercentTotal = 0;
      let arrivals = 0;
      let revenue = 0;
      let stockOut = 0;
      for (let day = startOffset; day < endOffset; day += 1) {
        const dKey = dayKeys[day];
        occupancyPercentTotal += validRooms.length
          ? Math.min(100, (occupiedByDay[day] / validRooms.length) * 100)
          : 0;
        arrivals += arrivalsByDay.get(dKey) || 0;
        revenue += revenueByDay.get(dKey) || 0;
        stockOut += stockOutByDay.get(dKey) || 0;
      }
      const measuredDays = Math.max(0, endOffset - startOffset);
      const labelDate = new Date(`${dayKeys[startOffset] ?? from}T00:00:00`);
      return {
        label: new Intl.DateTimeFormat(localeCode, {
          day: range === '365d' ? undefined : '2-digit',
          month: 'short',
        }).format(labelDate),
        occupancy: measuredDays ? Math.round(occupancyPercentTotal / measuredDays) : 0,
        arrivals,
        revenue: Math.round(revenue),
        stockOut,
      };
    });
  }, [range, from, toExclusive, activeBookings, periodMovements, validRoomIds, validRooms.length, localeCode]);

  const stockCategoryStats = useMemo(() => {
    const byCategory = new Map<string, { quantity: number; low: number }>();
    for (const item of stockItems) {
      const entry = byCategory.get(item.category) ?? { quantity: 0, low: 0 };
      entry.quantity += item.quantity;
      if (item.quantity <= item.minThreshold) entry.low += 1;
      byCategory.set(item.category, entry);
    }
    return [...byCategory.entries()]
      .map(([category, entry]) => ({ category, ...entry }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [stockItems]);

  const handleExportCsv = () => {
    const rows = [
      ['Période', 'Occupation (%)', 'Arrivées', `Revenus (${currency})`, 'Sorties stock'],
      ...trendPoints.map((point) => [
        point.label,
        String(point.occupancy),
        String(point.arrivals),
        String(point.revenue),
        String(point.stockOut),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `appointment-booking-analytics-${range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Spline coordinates calculation
  const splineWidth = 760;
  const splineHeight = 148;
  const splineLeft = 18;
  const splineRight = 742;
  const splineTop = 20;
  const splineBottom = 126;

  const activeSplineIndex =
    hoveredSplineIndex !== null && trendPoints[hoveredSplineIndex]
      ? hoveredSplineIndex
      : Math.max(0, trendPoints.length - 1);

  const splineValues = trendPoints.map((p) => p[splineMetric]);
  const splineMax = splineMetric === 'occupancy' ? 100 : Math.max(1, ...splineValues);

  const splineCoords = useMemo(() => {
    const count = trendPoints.length;
    return trendPoints.map((point, idx) => {
      const xPos =
        count <= 1 ? (splineLeft + splineRight) / 2 : splineLeft + (idx / (count - 1)) * (splineRight - splineLeft);
      const yPos =
        splineBottom - (Math.max(0, point[splineMetric]) / splineMax) * (splineBottom - splineTop);
      return { x: xPos, y: yPos };
    });
  }, [trendPoints, splineMetric, splineMax]);

  const splinePathD = useMemo(
    () => buildSmoothSplinePath(splineCoords, splineTop, splineBottom),
    [splineCoords]
  );

  const activeSplinePoint = trendPoints[activeSplineIndex] ?? null;
  const activeSplineCoord = splineCoords[activeSplineIndex] ?? null;

  const formatSplineValue = (value: number) => {
    if (splineMetric === 'occupancy') return `${value}%`;
    if (splineMetric === 'revenue') return fmtMoney(value, currency);
    if (splineMetric === 'stockOut') return `${value.toLocaleString()} ${t('u.', 'u.', 'و')}`;
    return value.toLocaleString();
  };

  const progress = (value: number, barClass = 'bg-sky-400') => (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${barClass}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );

  const showInventory = sectionFilter === 'all' || sectionFilter === 'inventory';
  const showBilling = sectionFilter === 'all' || sectionFilter === 'billing';
  const showStock = sectionFilter === 'all' || sectionFilter === 'stock';
  const showModules = sectionFilter === 'all' || sectionFilter === 'modules';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-w-0 w-full flex-1 overflow-y-auto overscroll-contain bg-[#F4F5F7] text-slate-900 dark:bg-[#141416] dark:text-[#F4F4F6]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-4 sm:px-6 sm:py-6">
        {/* Compact Top Bar matching the reference: [ Back ]  Statistics  [ CSV ] */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('planning')}
              aria-label={t('Retour au planning', 'Back to planning', 'العودة إلى التخطيط')}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-[#9E9EA8] dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <ArrowLeft size={20} className={isAr ? 'rotate-180' : ''} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-[#F4F4F6] sm:text-xl">
                {t('Statistiques', 'Statistics', 'الإحصائيات')}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-[#8E8E98]">
                {establishmentProfile?.name || t('Établissement', 'Property', 'المنشأة')} ·{' '}
                {currentDomain === 'resort' ? t('Resort', 'Resort', 'منتجع') : t('Hôtel', 'Hotel', 'فندق')} ·{' '}
                <span className="tabular-nums">{from} → {today}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-slate-300/90 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-white/[0.1] dark:bg-[#1E1E22] dark:text-[#F4F4F6] dark:hover:bg-[#27272C]"
          >
            <Download size={15} />
            <span className="whitespace-nowrap">CSV</span>
          </button>
        </header>

        {/* Primary Focal Zone: Hero Summary Card + Controls + Dual Charts + Spline Trend */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left Column (Hero Card + Breakdown Controls + Segmented Ring & Organic Pie) */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            {/* Hero Revenue & Property Summary Card (Inspired by top card of reference) */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                    {establishmentProfile?.name || t('Analyse globale', 'Global analytics', 'التحليل العام')}
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-[#8E8E98]">
                    {t('Revenus séjours proratisés', 'Prorated stay revenue', 'إيرادات الإقامات المحسوبة')} ·{' '}
                    {range === '30d' ? t('30 jours', '30 days', '30 يوماً') : range === '90d' ? t('90 jours', '90 days', '90 يوماً') : t('12 mois', '12 months', '12 شهراً')}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[clamp(1.65rem,4vw,2.35rem)] font-bold leading-none tracking-tight text-slate-950 tabular-nums dark:text-white">
                    {periodRevenue}
                  </div>
                  {primaryRevenueNumber === 0 && (
                    <div className="mt-1 text-[11px] text-slate-400 dark:text-[#787882]">
                      {t('Aucun revenu enregistré sur la période', 'No revenue recorded in period', 'لا توجد إيرادات في الفترة')}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-white/[0.06] sm:grid-cols-4">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Occupation aujourd’hui', 'Occupied today', 'إشغال اليوم')}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {occupiedToday} / {validRooms.length}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">({occupancyToday}%)</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Nuitées vendues', 'Room nights', 'الليالي المحجوزة')}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {occupiedRoomNights.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">({periodOccupancy}%)</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Réservations', 'Bookings', 'الحجوزات')}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {periodBookings.length.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Bâtiments', 'Buildings', 'المباني')}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {activeGroups.length}
                  </div>
                </div>
              </div>
            </section>

            {/* Controls Row: [ ● Breakdown Selector ▾ ]   [ 30 j | 90 j | 12 mois ] */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative inline-flex min-h-[44px] items-center rounded-full border border-slate-200/90 bg-white px-3.5 dark:border-white/[0.08] dark:bg-[#1E1E22]">
                <span
                  aria-hidden="true"
                  className="me-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF7369]"
                />
                <select
                  aria-label={t('Dimension d’analyse', 'Analytics breakdown', 'تصنيف التحليل')}
                  value={ringDimension}
                  onChange={(e) => {
                    setRingDimension(e.target.value as RingDimension);
                    setSelectedRingKey(null);
                  }}
                  className="min-h-[40px] cursor-pointer appearance-none bg-transparent pe-6 text-xs font-semibold text-slate-800 focus:outline-none dark:text-[#E8E8EC]"
                >
                  <option value="status" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                    {t('Statuts séjours', 'Stay status', 'حالات الحجز')}
                  </option>
                  <option value="building" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                    {t('Bâtiments', 'Buildings', 'المباني')}
                  </option>
                  <option value="roomType" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                    {t('Types de chambres', 'Room types', 'أنواع الغرف')}
                  </option>
                  <option value="housekeeping" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                    {t('État ménage', 'Housekeeping', 'حالة النظافة')}
                  </option>
                </select>
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3 text-slate-500 dark:text-[#8E8E98]"
                />
              </div>

              <div
                role="group"
                aria-label={t('Période d’analyse', 'Date range', 'الفترة الزمنية')}
                className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200/90 bg-white p-1 dark:border-white/[0.08] dark:bg-[#1E1E22]"
              >
                {(['30d', '90d', '365d'] as RangeKey[]).map((key) => {
                  const isActive = range === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setRange(key);
                        setHoveredSplineIndex(null);
                      }}
                      aria-pressed={isActive}
                      className={`min-h-[36px] whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-[#E8E8EC] dark:text-[#141416]'
                          : 'text-slate-500 hover:text-slate-900 dark:text-[#8E8E98] dark:hover:text-white'
                      }`}
                    >
                      {key === '30d'
                        ? t('30 j', '30d', '30 ي')
                        : key === '90d'
                        ? t('90 j', '90d', '90 ي')
                        : t('12 mois', 'Year', 'سنة')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dual Visual Charts Side-by-Side (Segmented Ring + Period Rounded Pie) */}
            <section className="grid grid-cols-1 gap-5 rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:grid-cols-2 sm:p-6">
              {/* Left Chart: Segmented Rounded-Cap Ring */}
              <div className="flex flex-col items-center">
                {computedRing.slices.length > 0 ? (
                  <>
                    <div className="relative h-44 w-44">
                      <svg
                        viewBox="0 0 180 180"
                        className="h-full w-full"
                        role="img"
                        aria-label={t('Répartition en anneau segmenté', 'Segmented breakdown ring chart', 'مخطط دائري مجزأ')}
                      >
                        <circle
                          cx="90"
                          cy="90"
                          r="68"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="15"
                          className="text-slate-100 dark:text-white/[0.05]"
                        />
                        {computedRing.slices.map((slice) => {
                          const isSelected = activeRingSlice?.key === slice.key;
                          return (
                            <path
                              key={slice.key}
                              d={slice.arcPath}
                              fill="none"
                              stroke={slice.color}
                              strokeWidth={isSelected ? 17 : 15}
                              strokeLinecap="round"
                              className="cursor-pointer transition-all duration-150"
                              opacity={selectedRingKey && !isSelected ? 0.45 : 1}
                              onClick={() =>
                                setSelectedRingKey((prev) => (prev === slice.key ? null : slice.key))
                              }
                            />
                          );
                        })}
                      </svg>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                        <span
                          className="text-3xl font-bold tracking-tight tabular-nums"
                          style={{ color: activeRingSlice?.color }}
                        >
                          {activeRingSlice?.percentage ?? 0}%
                        </span>
                        <span className="mt-1 max-w-[96px] truncate text-[11px] font-medium text-slate-500 dark:text-[#8E8E98]">
                          {activeRingSlice?.label}
                        </span>
                      </div>
                    </div>

                    <ul className="mt-5 w-full space-y-1.5">
                      {computedRing.slices.map((slice) => {
                        const isSelected = activeRingSlice?.key === slice.key;
                        return (
                          <li key={slice.key}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedRingKey((prev) => (prev === slice.key ? null : slice.key))
                              }
                              className={`flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                                isSelected
                                  ? 'bg-slate-100/90 dark:bg-white/[0.05]'
                                  : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: slice.color }}
                                />
                                <span className="truncate text-slate-700 dark:text-[#D4D4DC]">
                                  {slice.label}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                                {slice.percentage}%
                                {slice.detail ? (
                                  <span className="ms-1.5 font-normal text-slate-400 dark:text-[#787882]">
                                    ({slice.detail})
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-[#8E8E98]">
                      {t('Aucune donnée disponible pour cette catégorie.', 'No data available for this breakdown.', 'لا توجد بيانات متاحة لهذا التصنيف.')}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Chart: Active Month / Period + Rounded Organic 3-Wedge Pie */}
              <div className="flex flex-col items-center border-t border-slate-100 pt-5 dark:border-white/[0.06] sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0">
                <div className="mb-3 w-full text-center text-base font-semibold tracking-tight text-slate-900 dark:text-[#F4F4F6]">
                  {currentMonthHeadline}
                </div>

                {computedPie.wedges.length > 0 ? (
                  <>
                    <div className="relative h-40 w-40">
                      <svg
                        viewBox="0 0 180 180"
                        className="h-full w-full"
                        role="img"
                        aria-label={t('Répartition financière et règlements', 'Settlement & stay split chart', 'توزيع المدفوعات والحجوزات')}
                      >
                        {computedPie.wedges.map((wedge) => {
                          const isSelected = activeWedge?.key === wedge.key;
                          const scale = isSelected && !wedge.isFullCircle ? 1.04 : 1;
                          return (
                            <path
                              key={wedge.key}
                              d={wedge.wedgePath}
                              fill={wedge.color}
                              stroke={wedge.color}
                              strokeWidth="8"
                              strokeLinejoin="round"
                              transform={`translate(${wedge.offsetX}, ${wedge.offsetY}) scale(${scale})`}
                              style={{ transformOrigin: '90px 90px' }}
                              className="cursor-pointer transition-transform duration-150"
                              opacity={selectedWedgeKey && !isSelected ? 0.55 : 1}
                              onClick={() =>
                                setSelectedWedgeKey((prev) => (prev === wedge.key ? null : wedge.key))
                              }
                            />
                          );
                        })}
                      </svg>
                    </div>

                    <ul className="mt-5 w-full space-y-1.5">
                      {pieSourceItems.map((item) => {
                        const total = pieSourceItems.reduce((sum, x) => sum + x.value, 0);
                        const pct = total ? Math.round((item.value / total) * 100) : 0;
                        const isSelected = selectedWedgeKey === item.key;
                        return (
                          <li key={item.key}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedWedgeKey((prev) => (prev === item.key ? null : item.key))
                              }
                              className={`flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                                isSelected
                                  ? 'bg-slate-100/90 dark:bg-white/[0.05]'
                                  : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="truncate text-slate-700 dark:text-[#D4D4DC]">
                                  {item.label}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                                {pct}%{' '}
                                <span className="ms-1 font-normal text-slate-400 dark:text-[#787882]">
                                  ({item.value})
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-[#8E8E98]">
                      {t('Aucune réservation sur la période.', 'No bookings in this period.', 'لا توجد حجوزات في هذه الفترة.')}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column on Desktop (or Below on Mobile): Smooth Spline Trend with Lime Value Highlight Chip */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              {/* Header row: [ ● Income/Occupancy ▾ ]    [ Label ] [ #D9FF54 Value Chip ] */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative inline-flex min-h-[44px] items-center rounded-full border border-slate-200/90 bg-slate-50 px-3.5 dark:border-white/[0.08] dark:bg-[#26262B]">
                  <span
                    aria-hidden="true"
                    className="me-2.5 h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 bg-[#D9FF54]"
                  />
                  <select
                    aria-label={t('Indicateur de courbe', 'Trend chart metric', 'مؤشر المنحنى')}
                    value={splineMetric}
                    onChange={(e) => {
                      setSplineMetric(e.target.value as SplineMetric);
                      setHoveredSplineIndex(null);
                    }}
                    className="min-h-[40px] cursor-pointer appearance-none bg-transparent pe-6 text-xs font-semibold text-slate-800 focus:outline-none dark:text-[#F4F4F6]"
                  >
                    <option value="occupancy" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                      {t('Occupation', 'Occupancy', 'الإشغال')}
                    </option>
                    <option value="revenue" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                      {t('Revenus', 'Revenue', 'الإيرادات')}
                    </option>
                    <option value="arrivals" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                      {t('Arrivées', 'Arrivals', 'الوصول')}
                    </option>
                    <option value="stockOut" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                      {t('Sorties stock', 'Stock issues', 'صرف المخزون')}
                    </option>
                  </select>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute end-3 text-slate-500 dark:text-[#8E8E98]"
                  />
                </div>

                {activeSplinePoint && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-500 dark:text-[#8E8E98]">
                      {activeSplinePoint.label}
                    </span>
                    <span className="inline-flex min-h-[32px] items-center rounded-full border border-black/10 bg-[#D9FF54] px-3.5 text-xs font-bold text-[#141416] tabular-nums">
                      {formatSplineValue(activeSplinePoint[splineMetric])}
                    </span>
                  </div>
                )}
              </div>

              {/* Smooth Spline Curve */}
              {trendPoints.length > 0 ? (
                <div className="mt-5">
                  <div
                    className="relative w-full"
                    style={{ touchAction: 'pan-y' }}
                    onPointerLeave={() => setHoveredSplineIndex(null)}
                    onPointerMove={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * splineWidth;
                      const rawIndex =
                        trendPoints.length <= 1
                          ? 0
                          : Math.round(((viewX - splineLeft) / (splineRight - splineLeft)) * (trendPoints.length - 1));
                      setHoveredSplineIndex(Math.max(0, Math.min(trendPoints.length - 1, rawIndex)));
                    }}
                  >
                    <svg
                      viewBox={`0 0 ${splineWidth} ${splineHeight}`}
                      role="img"
                      aria-label={t('Courbe d’évolution lissée', 'Smooth trend curve', 'منحنى التطور الزمني')}
                      className="h-44 w-full overflow-visible sm:h-48"
                    >
                      <defs>
                        <linearGradient id="analytics-spline-glow" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#D9FF54" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#D9FF54" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Subtle vertical focus indicator */}
                      {activeSplineCoord && (
                        <line
                          x1={activeSplineCoord.x}
                          x2={activeSplineCoord.x}
                          y1={splineTop}
                          y2={splineBottom}
                          stroke="currentColor"
                          strokeDasharray="3 4"
                          className="text-slate-300 dark:text-white/15"
                        />
                      )}

                      {/* Smooth Spline Line */}
                      <path
                        d={splinePathD}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#4D7C0F] dark:text-[#D9FF54]"
                      />

                      {/* Active Point Anchor */}
                      {activeSplineCoord && (
                        <circle
                          cx={activeSplineCoord.x}
                          cy={activeSplineCoord.y}
                          r="6"
                          className="fill-[#D9FF54] stroke-[#141416] dark:stroke-[#1E1E22]"
                          strokeWidth="2.5"
                        />
                      )}
                    </svg>
                  </div>

                  {/* Interactive X-axis ticks (tap or click on mobile/desktop) */}
                  <div className="mt-2 flex items-center justify-between gap-1 overflow-x-auto pb-1">
                    {trendPoints.map((pt, idx) => {
                      const isCurrent = idx === activeSplineIndex;
                      return (
                        <button
                          key={`${pt.label}-${idx}`}
                          type="button"
                          onClick={() => setHoveredSplineIndex(idx)}
                          className={`min-h-[36px] min-w-0 shrink-0 rounded-md px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            isCurrent
                              ? 'font-bold text-[#4D7C0F] dark:text-[#D9FF54]'
                              : 'text-slate-400 hover:text-slate-700 dark:text-[#6E6E78] dark:hover:text-[#D4D4DC]'
                          }`}
                        >
                          {pt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                  {t('Aucune donnée disponible sur cette période.', 'No data available for this period.', 'لا توجد بيانات لهذه الفترة.')}
                </p>
              )}
            </section>

            {/* Quick Operational Snapshot Card (Real Housekeeping & Invoicing Summary) */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                  {t('Synthèse facturation & stock', 'Billing & stock summary', 'ملخص الفوترة والمخزون')}
                </h2>
                <span className="text-xs text-slate-500 dark:text-[#8E8E98]">
                  {issuedInvoices.length} {t('factures', 'invoices', 'فواتير')}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Encaissé', 'Collected', 'المحصل')}
                  </div>
                  <div className="mt-1 text-base font-bold text-emerald-700 tabular-nums dark:text-[#67C380]">
                    {collectedTotal}
                  </div>
                </div>
                <div className="border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Reste dû', 'Balance due', 'المتبقي')}
                  </div>
                  <div className="mt-1 text-base font-bold text-rose-600 tabular-nums dark:text-[#FF7369]">
                    {dueTotal}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Valeur du stock', 'Stock value', 'قيمة المخزون')}
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900 tabular-nums dark:text-[#F4F4F6]">
                    {fmtMoney(stockValue, 'DZD')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Articles sous seuil', 'Low stock items', 'أصناف تحت الحد')}
                  </div>
                  <div className="mt-1 text-base font-bold text-amber-600 tabular-nums dark:text-[#FFA84B]">
                    {lowStock.length}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Interactive Operational Section Filter Bar */}
        <nav
          aria-label={t('Filtrer les sections détaillées', 'Filter detailed sections', 'تصفية الأقسام التفصيلية')}
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {(
            [
              ['all', t('Tout afficher', 'All sections', 'عرض الكل')],
              ['inventory', t('Bâtiments & Chambres', 'Buildings & Rooms', 'المباني والغرف')],
              ['billing', t('Facturation', 'Billing', 'الفوترة')],
              ['stock', t('Stock & Consommables', 'Stock & Consumables', 'المخزون والمستهلكات')],
              ['modules', t('Spa & Événements', 'Spa & Events', 'السبا والفعاليات')],
            ] as Array<[SectionFilter, string]>
          ).map(([key, label]) => {
            const active = sectionFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSectionFilter(key)}
                aria-pressed={active}
                className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-[#F4F4F6] dark:text-[#141416]'
                    : 'border border-slate-200/90 bg-white text-slate-600 hover:text-slate-900 dark:border-white/[0.08] dark:bg-[#1E1E22] dark:text-[#8E8E98] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Detailed PMS Sections (Preserving All Real Operational Analytics Cleanly) */}
        {showInventory && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <Building2 size={18} className="shrink-0 text-sky-600 dark:text-[#87CEFA]" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Performance par bâtiment', 'Performance by building', 'الأداء حسب المبنى')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Capacité, occupation sur la période et chambres hors service.', 'Capacity, period occupancy and out-of-order rooms.', 'السعة والإشغال والغرف خارج الخدمة.')}
                  </p>
                </div>
              </div>
              {buildingStats.length ? (
                <div className="space-y-4">
                  {buildingStats.map((building) => (
                    <div key={building.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-[#E8E8EC]">
                          {building.name}
                        </span>
                        <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                          {building.occupancy}%
                        </span>
                      </div>
                      {progress(building.occupancy, 'bg-sky-500 dark:bg-[#87CEFA]')}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                        <span className="tabular-nums">{building.total} {t('chambres', 'rooms', 'غرف')}</span>
                        <span className="tabular-nums">{building.occupiedNow} {t('occupées aujourd’hui', 'occupied today', 'مشغولة اليوم')}</span>
                        <span className="tabular-nums">{building.roomNights} {t('nuitées vendues', 'room nights', 'ليالٍ محجوزة')}</span>
                        {building.outOfOrder > 0 && (
                          <span className="font-semibold text-rose-600 dark:text-[#FF7369]">
                            {building.outOfOrder} {t('hors service', 'out of order', 'خارج الخدمة')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                  {t('Aucun bâtiment ou groupe de chambres configuré.', 'No building or room group configured.', 'لا توجد مبانٍ أو مجموعات غرف مهيأة.')}
                </p>
              )}
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <BedDouble size={18} className="shrink-0 text-emerald-600 dark:text-[#67C380]" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Utilisation des chambres & étages', 'Room & floor utilization', 'استخدام الغرف والطوابق')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Occupation réelle aujourd’hui et répartition par type.', 'Actual occupancy today and breakdown by room type.', 'الإشغال الفعلي اليوم والتوزيع حسب نوع الغرفة.')}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {roomTypes.map((item) => (
                  <div key={item.type}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700 dark:text-[#D4D4DC]">{item.type}</span>
                      <span className="shrink-0 text-slate-500 tabular-nums dark:text-[#8E8E98]">
                        {item.occupied}/{item.count}
                      </span>
                    </div>
                    {progress(
                      item.count ? (item.occupied / item.count) * 100 : 0,
                      'bg-emerald-500 dark:bg-[#67C380]'
                    )}
                  </div>
                ))}
                {!roomTypes.length && (
                  <p className="py-4 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucune chambre enregistrée.', 'No rooms registered.', 'لا توجد غرف مسجلة.')}
                  </p>
                )}
              </div>

              {Object.values(floorStats).length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                  <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-[#D4D4DC]">
                    {t('Détail par étage', 'Floor breakdown', 'التفصيل حسب الطابق')}
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto pe-1">
                    {Object.values(floorStats).map((fl) => (
                      <div key={fl.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-slate-600 dark:text-[#9E9EA8]">
                          {fl.building} · {fl.floor}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                          {fl.occupied}/{fl.total}
                          {fl.outOfOrder > 0 ? ` (${fl.outOfOrder} HS)` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-white/[0.06] dark:text-[#8E8E98]">
                {[
                  ['clean', t('Propres', 'Clean', 'نظيفة'), '#67C380'],
                  ['cleaning', t('En nettoyage', 'Cleaning', 'قيد التنظيف'), '#87CEFA'],
                  ['dirty', t('À nettoyer', 'Dirty', 'تحتاج تنظيفاً'), '#FFA84B'],
                  ['out_of_order', t('Hors service', 'Out of order', 'خارج الخدمة'), '#6E717A'],
                ].map(([key, label, dotColor]) => (
                  <span key={key} className="inline-flex items-center gap-1.5 tabular-nums">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    {label}: {housekeepingCounts[key] || 0}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {showBilling && (
          <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <FileText size={18} className="shrink-0 text-indigo-600 dark:text-[#7178FF]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Facturation & encaissements', 'Billing & collections', 'الفوترة والتحصيل')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Factures émises, devis, montants encaissés et soldes clients.', 'Issued invoices, quotations, collected amounts and customer balances.', 'الفواتير الصادرة وعروض الأسعار والمبالغ المحصلة وأرصدة العملاء.')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-[#8E8E98]">
                <span className="tabular-nums">{paidInvoices.length} {t('soldées', 'paid', 'مسددة')}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{unpaidCount} {t('en attente', 'pending', 'معلقة')}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{quotes.length} {t('devis', 'quotes', 'عروض')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Factures émises', 'Invoices', 'الفواتير')}</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-white">{issuedInvoices.length}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Total facturé TTC', 'Total invoiced', 'إجمالي الفواتير')}</div>
                <div className="mt-1 text-base font-bold text-slate-900 tabular-nums dark:text-white">{invoicedTotal}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Acomptes encaissés', 'Collected', 'المحصل')}</div>
                <div className="mt-1 text-base font-bold text-emerald-700 tabular-nums dark:text-[#67C380]">{collectedTotal}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Reste à encaisser', 'Balance due', 'المتبقي')}</div>
                <div className="mt-1 text-base font-bold text-rose-600 tabular-nums dark:text-[#FF7369]">{dueTotal}</div>
              </div>
            </div>

            <div className="mt-4 max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-white/[0.06]">
              {periodInvoices
                .slice()
                .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
                .slice(0, 8)
                .map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800 dark:text-[#E8E8EC]">
                        {invoice.docNumber} · {invoice.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                        {invoice.issueDate} · {invoice.status}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                      {fmtMoney(invoice.totalTTC, invoice.currency || currency)}
                    </span>
                  </div>
                ))}
              {!periodInvoices.length && (
                <p className="pt-3 text-xs text-slate-500 dark:text-[#8E8E98]">
                  {t('Aucun document de facturation sur cette période.', 'No billing documents in this period.', 'لا توجد مستندات فوترة خلال هذه الفترة.')}
                </p>
              )}
            </div>
          </section>
        )}

        {showStock && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <Package size={18} className="shrink-0 text-amber-500 dark:text-[#FFA84B]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Consommables & mouvements', 'Consumables & movements', 'المستهلكات والحركات')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Sorties, entrées et consommation déclarée sur la période.', 'Stock issues, receipts and recorded consumption.', 'الصادرات والواردات والاستهلاك المسجل.')}
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Unités sorties', 'Issued', 'المصروف')}</div>
                  <div className="mt-1 text-lg font-bold text-rose-600 tabular-nums dark:text-[#FF7369]">{consumedUnits}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Entrées', 'Received', 'الوارد')}</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700 tabular-nums dark:text-[#67C380]">
                    {received.reduce((sum, movement) => sum + movement.delta, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">{t('Coût sorties', 'Issue cost', 'تكلفة الصرف')}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                    {fmtMoney(consumedValue, 'DZD')}
                  </div>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-[#8E8E98]">
                <span>{t('Consommation saisie dans les tâches', 'Consumption in tasks', 'الاستهلاك في المهام')}</span>
                <strong className="text-slate-900 tabular-nums dark:text-white">
                  {taskConsumedUnits} {t('unités', 'units', 'وحدات')}
                </strong>
              </div>

              <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto dark:divide-white/[0.06]">
                {consumption
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800 dark:text-[#E8E8EC]">{movement.itemName}</div>
                        <div className="truncate text-[11px] text-slate-500 dark:text-[#8E8E98]">
                          {movement.room || movement.reason} · {movement.timestamp.slice(0, 10)}
                        </div>
                      </div>
                      <span className="shrink-0 font-bold text-rose-600 tabular-nums dark:text-[#FF7369]">
                        −{Math.abs(movement.delta)}
                      </span>
                    </div>
                  ))}
                {!consumption.length && (
                  <p className="py-4 text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucune sortie de stock sur cette période.', 'No stock issues in this period.', 'لا توجد حركات صرف خلال هذه الفترة.')}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <Boxes size={18} className="shrink-0 text-amber-500 dark:text-[#FFA84B]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('État du stock & catégories', 'Inventory status & categories', 'حالة المخزون والفئات')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Valeur immobilisée, seuils d’alerte et répartition par catégorie.', 'Inventory value, low-stock alerts and breakdown.', 'قيمة المخزون وحدود التنبيه والتوزيع.')}
                  </p>
                </div>
              </div>

              {stockCategoryStats.length > 0 && (
                <div className="mb-4 space-y-2.5">
                  {stockCategoryStats.slice(0, 4).map((item) => (
                    <div key={item.category}>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-slate-700 dark:text-[#D4D4DC]">{item.category}</span>
                        <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                          {item.quantity} {item.low > 0 ? `(${item.low} !)` : ''}
                        </span>
                      </div>
                      {progress(
                        stockCategoryStats[0].quantity ? (item.quantity / stockCategoryStats[0].quantity) * 100 : 0,
                        'bg-amber-500 dark:bg-[#FFA84B]'
                      )}
                    </div>
                  ))}
                </div>
              )}

              {lowStock.length ? (
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                  {lowStock.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 dark:border-[#FFA84B]/25 dark:bg-[#FFA84B]/10"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-800 dark:text-[#F4F4F6]">{item.name}</div>
                        <div className="text-[11px] text-amber-700 dark:text-[#FFA84B]">
                          {item.category} · {t('Seuil', 'Threshold', 'الحد')}: {item.minThreshold}
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <div className="text-sm font-bold text-amber-700 tabular-nums dark:text-[#FFA84B]">
                          {item.quantity} {item.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-medium text-emerald-700 dark:border-white/[0.06] dark:text-[#67C380]">
                  <CheckCircle2 size={16} />
                  {t('Aucun article sous le seuil minimum.', 'No items below minimum threshold.', 'لا توجد مواد دون الحد الأدنى.')}
                </div>
              )}
            </section>
          </div>
        )}

        {showModules && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-3 flex items-center gap-3">
                <Flower2 size={18} className="shrink-0 text-slate-500 dark:text-[#8E8E98]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                  {t('Spa & bien-être', 'Spa & wellness', 'المنتجع الصحي والعافية')}
                </h2>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-[#D4D4DC]">
                {t('Source analytique non centralisée', 'Analytics source not centralized', 'مصدر التحليلات غير مركزي')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#8E8E98]">
                {t(
                  'Les rendez-vous Spa sont actuellement conservés dans l’état local de l’écran Spa. Aucun chiffre n’est affiché pour éviter de confondre les données de démonstration avec l’activité réelle.',
                  'Spa appointments live in the Spa screen local state and are not exposed here. No figures are shown to avoid presenting demo data as real activity.',
                  'مواعيد السبا محفوظة في الحالة المحلية لشاشة السبا ولا يتم عرض أرقام لتجنب الخلط مع بيانات العرض.'
                )}
              </p>
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-3 flex items-center gap-3">
                <Presentation size={18} className="shrink-0 text-slate-500 dark:text-[#8E8E98]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                  {t('Conférences & événements', 'Conferences & events', 'المؤتمرات والفعاليات')}
                </h2>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-[#D4D4DC]">
                {t('Module non disponible dans cette version', 'Module not available in this version', 'الوحدة غير متاحة في هذا الإصدار')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-[#8E8E98]">
                {t(
                  'Le dépôt ne contient pas encore de modèle de données ni de module de gestion des conférences. Ces indicateurs nécessiteront un vrai référentiel de salles, événements et réservations.',
                  'The repository does not yet contain a conference data model or management module. These metrics require a real source for venues, events and bookings.',
                  'لا يحتوي المشروع بعد على نموذج بيانات أو وحدة لإدارة المؤتمرات.'
                )}
              </p>
            </section>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[11px] text-slate-400 dark:text-[#6E6E78]">
          <span>
            {t(
              'Source : réservations, inventaire, mouvements de stock, tâches PMS et documents de facturation locaux.',
              'Sources: bookings, inventory, stock movements, PMS tasks and locally stored billing documents.',
              'المصادر: الحجوزات والمخزون وحركاته ومهام النظام ومستندات الفوترة المحلية.'
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarRange size={13} />
            {from} → {today}
          </span>
        </footer>
      </div>
    </div>
  );
};
