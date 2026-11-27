import React, { useEffect, useMemo, useState } from 'react';
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
  TrendingUp,
  AlertTriangle,
  Wrench,
  Users,
  Sparkles,
  ShieldAlert,
  Lightbulb,
  Layers,
  MessageSquareWarning,
  UtensilsCrossed,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InvoiceRecord, TimelineBooking } from '../types/booking';
import { indexedDb } from '../db/indexedDb';
import { useWorkspace } from '../services/supabase/WorkspaceContext';
import { listBookingsWindow } from '../services/supabase/pmsRepository';
import {
  buildSmoothSplinePath,
  computeRoundedPieWedges,
  computeSegmentedRingArcs,
  type RingSliceInput,
} from '../utils/analyticsCharts';
import {
  computeBookingAnalyticsSnapshot,
  type AnalyticsRangeKey,
  type MetricDelta,
} from '../utils/bookingAnalyticsEngine';

type RingDimension = 'status' | 'building' | 'roomType' | 'housekeeping' | 'segment' | 'mealPlan';
type SplineMetric = 'occupancy' | 'arrivals' | 'revenue' | 'stockOut';
type SectionFilter =
  | 'all'
  | 'forecast'
  | 'inventory'
  | 'guests'
  | 'extras'
  | 'tasks_team'
  | 'prevention'
  | 'billing_stock';
type RoomSortMode = 'most_used' | 'least_used' | 'maintenance';

const RING_PALETTE = ['#87CEFA', '#7178FF', '#67C380', '#FFA84B', '#FF7369', '#6E717A'];

export const BookingAnalyticsView: React.FC = () => {
  const { activeWorkspaceId } = useWorkspace();
  const {
    bookings,
    resourceGroups,
    stockItems,
    stockMovements,
    tasks,
    eventLogs,
    language,
    currency,
    currentDomain,
    establishmentProfile,
    setActiveView,
  } = useApp();

  const [range, setRange] = useState<AnalyticsRangeKey>('30d');
  const [archivedBookings, setArchivedBookings] = useState<TimelineBooking[]>([]);
  const [archiveLoadState, setArchiveLoadState] = useState<'idle' | 'loading' | 'remote' | 'local' | 'partial' | 'unavailable'>('idle');
  const [ringDimension, setRingDimension] = useState<RingDimension>('status');
  const [selectedRingKey, setSelectedRingKey] = useState<string | null>(null);
  const [selectedWedgeKey, setSelectedWedgeKey] = useState<string | null>(null);
  const [splineMetric, setSplineMetric] = useState<SplineMetric>('occupancy');
  const [showPreviousCurve, setShowPreviousCurve] = useState<boolean>(true);
  const [hoveredSplineIndex, setHoveredSplineIndex] = useState<number | null>(null);
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [roomSortMode, setRoomSortMode] = useState<RoomSortMode>('most_used');

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

  const now = useMemo(() => new Date(), []);

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

  const analyticsBookings = useMemo(() => {
    const byId = new Map<string, TimelineBooking>();
    for (const booking of archivedBookings) byId.set(booking.id, booking);
    // Operational records always win over their archived historical projection.
    for (const booking of bookings) byId.set(booking.id, booking);
    return [...byId.values()];
  }, [bookings, archivedBookings]);

  const snapshot = useMemo(
    () =>
      computeBookingAnalyticsSnapshot({
        bookings: analyticsBookings,
        rooms,
        groups: activeGroups,
        tasks,
        stockItems,
        stockMovements,
        eventLogs,
        invoiceDocs,
        range,
        currency,
        domain: currentDomain,
        language,
        now,
      }),
    [
      analyticsBookings,
      rooms,
      activeGroups,
      tasks,
      stockItems,
      stockMovements,
      eventLogs,
      invoiceDocs,
      range,
      currency,
      currentDomain,
      language,
      now,
    ]
  );

  const { current, previous, deltas, trendPoints } = snapshot;

  // The 365-day view is the only screen that requests historical data. It reads
  // the local archive by date index and supplements it from Supabase on demand.
  useEffect(() => {
    if (range !== '365d') {
      setArchivedBookings([]);
      setArchiveLoadState('idle');
      return undefined;
    }
    let cancelled = false;
    setArchiveLoadState('loading');
    const startDate = previous.from;
    const endDate = current.toInclusive;
    void (async () => {
      const workspaceId = activeWorkspaceId || 'local';
      const localRows: TimelineBooking[] = [];
      try {
        let offset = 0;
        while (offset < 10000) {
          const page = await indexedDb.getArchivedBookingsWindow(
            workspaceId, startDate, endDate, 1000, offset,
          );
          localRows.push(...page);
          offset += page.length;
          if (page.length < 1000) break;
        }
      } catch (error) {
        console.warn('[BookingAnalytics] Local archive query failed:', error);
      }

      const remoteRows: TimelineBooking[] = [];
      let remoteLoaded = false;
      let remotePartial = false;
      if (activeWorkspaceId) {
        try {
          let offset = 0;
          while (offset < 10000) {
            const page = await listBookingsWindow(activeWorkspaceId, startDate, endDate, {
              offset,
              limit: 500,
              withCount: offset === 0,
            });
            remoteRows.push(...page.data);
            offset += page.data.length;
            if (page.data.length < 500) break;
            if (offset >= 10000) remotePartial = true;
          }
          remoteLoaded = true;
        } catch (error) {
          console.warn('[BookingAnalytics] Remote historical window unavailable:', error);
        }
      }

      if (cancelled) return;
      const byId = new Map<string, TimelineBooking>();
      for (const booking of localRows) byId.set(booking.id, booking);
      for (const booking of remoteRows) byId.set(booking.id, booking);
      setArchivedBookings([...byId.values()]);
      setArchiveLoadState(remotePartial ? 'partial' : remoteLoaded ? 'remote' : localRows.length ? 'local' : 'unavailable');
    })().catch((error) => {
      if (!cancelled) {
        console.warn('[BookingAnalytics] Historical archive load failed:', error);
        setArchiveLoadState('unavailable');
      }
    });
    return () => { cancelled = true; };
  }, [range, activeWorkspaceId, previous.from, current.toInclusive]);

  const from = current.from;
  const toExclusive = current.toExclusive;
  const today = snapshot.today;

  const currentMonthHeadline = useMemo(() => {
    if (range === '7d') return t('7 derniers jours', 'Last 7 days', 'آخر 7 أيام');
    if (range === '30d') {
      const raw = new Intl.DateTimeFormat(localeCode, { month: 'long' }).format(now);
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    if (range === '90d') return t('90 derniers jours', 'Last 90 days', 'آخر 90 يوماً');
    return t('12 derniers mois', 'Last 12 months', 'آخر 12 شهراً');
  }, [range, localeCode, isFr, isAr, now]);

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

  const periodRevenue = formatBreakdown(current.revenueByCurrency);

  const { validRooms, occupiedTodayIds } = useMemo(() => {
    const available = rooms.filter((room) => room.housekeepingStatus !== 'out_of_order');
    const occIds = new Set(
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
    );
    return { validRooms: available, occupiedTodayIds: occIds };
  }, [rooms, bookings, currentDomain, today]);

  const occupiedToday = validRooms.filter((room) => occupiedTodayIds.has(room.id)).length;
  const occupancyToday = validRooms.length ? Math.round((occupiedToday / validRooms.length) * 100) : 0;

  const periodBookings = useMemo(
    () =>
      analyticsBookings.filter(
        (booking) =>
          booking.sector === currentDomain && booking.startDate < toExclusive && booking.endDate > from
      ),
    [analyticsBookings, currentDomain, from, toExclusive]
  );

  const buildingStats = useMemo(() => {
    const activeBookings = periodBookings.filter(
      (b) => b.status !== 'cancelled' && b.status !== 'out_of_order'
    );
    const revByRoom = new Map<string, { nights: number; revenue: number; stays: number }>();
    for (const rStat of snapshot.roomFrequencies) {
      revByRoom.set(rStat.roomId, {
        nights: rStat.nightsSold,
        revenue: rStat.revenue,
        stays: rStat.staysCount,
      });
    }

    return activeGroups.map((group) => {
      const groupRooms = group.resources.filter((room) => room.housekeepingStatus !== 'out_of_order');
      const occupiedNow = groupRooms.filter((room) => occupiedTodayIds.has(room.id)).length;
      let nights = 0;
      let revenue = 0;
      let bookingCount = 0;
      for (const room of group.resources) {
        const rs = revByRoom.get(room.id);
        if (rs) {
          nights += rs.nights;
          revenue += rs.revenue;
          bookingCount += rs.stays;
        }
      }
      const capacity = groupRooms.length * current.days;
      return {
        id: group.id,
        name: typeof group.name === 'string' ? group.name : group.name[language] || group.name.fr,
        total: group.resources.length,
        available: groupRooms.length,
        outOfOrder: group.resources.length - groupRooms.length,
        occupiedNow,
        occupancy: capacity ? Math.min(100, Math.round((nights / capacity) * 100)) : 0,
        roomNights: nights,
        revenue,
        bookingCount: bookingCount || activeBookings.filter((b) => group.resources.some((r) => r.id === b.resourceId)).length,
      };
    });
  }, [activeGroups, periodBookings, snapshot.roomFrequencies, occupiedTodayIds, current.days, language]);

  const { housekeepingCounts, roomTypes } = useMemo(() => {
    const counts = rooms.reduce((result, room) => {
      const status = room.housekeepingStatus || 'clean';
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    const byType = new Map<string, { count: number; occupied: number; nights: number }>();
    const freqMap = new Map(snapshot.roomFrequencies.map((r) => [r.roomId, r]));
    for (const room of rooms) {
      const entry = byType.get(room.type) ?? { count: 0, occupied: 0, nights: 0 };
      entry.count += 1;
      if (occupiedTodayIds.has(room.id)) entry.occupied += 1;
      entry.nights += freqMap.get(room.id)?.nightsSold || 0;
      byType.set(room.type, entry);
    }
    return {
      housekeepingCounts: counts,
      roomTypes: [...byType.entries()].map(([type, entry]) => ({ type, ...entry })),
    };
  }, [rooms, occupiedTodayIds, snapshot.roomFrequencies]);

  const {
    lowStock,
    stockValue,
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

  // Segmented Ring Source Items (including Client Segment & Meal Plans!)
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
        .sort((a, b) => b.nights - a.nights || b.count - a.count)
        .slice(0, 5)
        .map((rt, index) => ({
          key: rt.type,
          label: rt.type,
          value: rt.nights > 0 ? rt.nights : rt.count,
          detail: `${rt.nights}n · ${rt.occupied}/${rt.count}`,
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

    if (ringDimension === 'segment') {
      return snapshot.clientSegments.slice(0, 6).map((seg, index) => ({
        key: seg.id,
        label: seg.label[language] || seg.label.fr,
        value: seg.count,
        detail: `${seg.count} · ${seg.nightsSold}n`,
        color: RING_PALETTE[index % RING_PALETTE.length],
      }));
    }

    if (ringDimension === 'mealPlan') {
      return snapshot.mealPlanStats.slice(0, 6).map((mp, index) => ({
        key: mp.id,
        label: `${mp.code} · ${mp.label}`,
        value: mp.count,
        detail: `${mp.count}`,
        color: RING_PALETTE[index % RING_PALETTE.length],
      }));
    }

    const statusBuckets = [
      {
        key: 'confirmed',
        label: t('Confirmées', 'Confirmed', 'مؤكدة'),
        color: '#87CEFA',
        value: periodBookings.filter((b) => ['confirmed', 'due_in', 'due_out'].includes(b.status)).length,
      },
      {
        key: 'active',
        label: t('En séjour / Clôturées', 'Checked in / out', 'مقيمون / مكتمل'),
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
        label: t('Annulées / HS', 'Cancelled / OOO', 'ملغاة / معطلة'),
        color: '#6E717A',
        value: periodBookings.filter((b) => b.status === 'cancelled' || b.status === 'out_of_order').length,
      },
    ];
    return statusBuckets.map((item) => ({
      ...item,
      detail: `${item.value}`,
    }));
  }, [
    ringDimension,
    buildingStats,
    roomTypes,
    housekeepingCounts,
    snapshot.clientSegments,
    snapshot.mealPlanStats,
    periodBookings,
    language,
    isFr,
    isAr,
  ]);

  const computedRing = useMemo(
    () => computeSegmentedRingArcs(ringSourceItems, { cx: 90, cy: 90, r: 68, gapDeg: 18 }),
    [ringSourceItems]
  );

  const activeRingSlice =
    computedRing.slices.find((s) => s.key === selectedRingKey) ?? computedRing.slices[0] ?? null;

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

  // Spline Chart with Optional Previous Period Comparison Curve
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

  const prevMetricKey =
    splineMetric === 'occupancy'
      ? 'prevOccupancy'
      : splineMetric === 'revenue'
      ? 'prevRevenue'
      : splineMetric === 'arrivals'
      ? 'prevArrivals'
      : 'prevStockOut';

  const splineValues = trendPoints.map((p) => p[splineMetric]);
  const prevSplineValues = trendPoints.map((p) => p[prevMetricKey]);
  const splineMax =
    splineMetric === 'occupancy'
      ? 100
      : Math.max(1, ...splineValues, ...(showPreviousCurve ? prevSplineValues : [0]));

  const { splineCoords, prevSplineCoords } = useMemo(() => {
    const count = trendPoints.length;
    const curC = trendPoints.map((point, idx) => {
      const xPos =
        count <= 1 ? (splineLeft + splineRight) / 2 : splineLeft + (idx / (count - 1)) * (splineRight - splineLeft);
      const yPos = splineBottom - (Math.max(0, point[splineMetric]) / splineMax) * (splineBottom - splineTop);
      return { x: xPos, y: yPos };
    });
    const prevC = trendPoints.map((point, idx) => {
      const xPos =
        count <= 1 ? (splineLeft + splineRight) / 2 : splineLeft + (idx / (count - 1)) * (splineRight - splineLeft);
      const yPos = splineBottom - (Math.max(0, point[prevMetricKey]) / splineMax) * (splineBottom - splineTop);
      return { x: xPos, y: yPos };
    });
    return { splineCoords: curC, prevSplineCoords: prevC };
  }, [trendPoints, splineMetric, prevMetricKey, splineMax]);

  const splinePathD = useMemo(
    () => buildSmoothSplinePath(splineCoords, splineTop, splineBottom),
    [splineCoords]
  );
  const prevSplinePathD = useMemo(
    () => buildSmoothSplinePath(prevSplineCoords, splineTop, splineBottom),
    [prevSplineCoords]
  );

  const activeSplinePoint = trendPoints[activeSplineIndex] ?? null;
  const activeSplineCoord = splineCoords[activeSplineIndex] ?? null;
  const activePrevSplineCoord = prevSplineCoords[activeSplineIndex] ?? null;

  const formatSplineValue = (value: number) => {
    if (splineMetric === 'occupancy') return `${value}%`;
    if (splineMetric === 'revenue') return fmtMoney(value, currency);
    if (splineMetric === 'stockOut') return `${value.toLocaleString()} ${t('u.', 'u.', 'و')}`;
    return value.toLocaleString();
  };

  const renderDeltaBadge = (
    delta: MetricDelta,
    options?: { unit?: string; invertGood?: boolean; isPts?: boolean }
  ) => {
    const { unit = '', invertGood = false, isPts = false } = options || {};
    const isNeutral = delta.diff === 0;
    const isPositive = delta.diff > 0;
    const isGood = invertGood ? !isPositive : isPositive;
    const arrow = isNeutral ? '•' : isPositive ? '▲' : '▼';
    const text = isPts
      ? `${delta.diff > 0 ? '+' : ''}${delta.diff} pts`
      : delta.pctChange !== null
      ? `${delta.pctChange > 0 ? '+' : ''}${delta.pctChange}%`
      : `${delta.diff > 0 ? '+' : ''}${delta.diff}${unit}`;

    const badgeCls = isNeutral
      ? 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-[#9E9EA8]'
      : isGood
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-[#67C380]'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-[#FF7369]';

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${badgeCls}`}
        title={`${t('Période précédente', 'Previous period', 'الفترة السابقة')}: ${delta.previous}${unit}`}
      >
        <span aria-hidden="true">{arrow}</span>
        <span>{text}</span>
      </span>
    );
  };

  const progress = (value: number, barClass = 'bg-sky-400') => (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${barClass}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );

  const sortedRooms = useMemo(() => {
    if (roomSortMode === 'least_used') {
      return snapshot.roomFrequencies
        .slice()
        .sort((a, b) => a.utilizationPct - b.utilizationPct || a.staysCount - b.staysCount);
    }
    if (roomSortMode === 'maintenance') {
      return snapshot.roomFrequencies
        .slice()
        .sort(
          (a, b) =>
            b.maintenanceCount - a.maintenanceCount ||
            b.alertsCount - a.alertsCount ||
            (b.housekeepingStatus === 'out_of_order' ? 1 : 0) -
              (a.housekeepingStatus === 'out_of_order' ? 1 : 0)
        );
    }
    return snapshot.roomFrequencies;
  }, [snapshot.roomFrequencies, roomSortMode]);

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
      ['=== TENDANCES & COMPARAISON N vs N-1 ===', '', '', '', '', '', '', ''],
      [
        'Période',
        'Occupation (%)',
        'Occupation N-1 (%)',
        'Arrivées',
        'Arrivées N-1',
        `Revenus (${currency})`,
        `Revenus N-1 (${currency})`,
        'Sorties stock',
      ],
      ...trendPoints.map((point) => [
        point.label,
        String(point.occupancy),
        String(point.prevOccupancy),
        String(point.arrivals),
        String(point.prevArrivals),
        String(point.revenue),
        String(point.prevRevenue),
        String(point.stockOut),
      ]),
      ['', '', '', '', '', '', '', ''],
      ['=== FRÉQUENCE DES CHAMBRES ===', '', '', '', '', '', '', ''],
      ['Chambre', 'Type', 'Bâtiment', 'Étage', 'Séjours', 'Nuitées', 'Utilisation (%)', `Revenus (${currency})`],
      ...snapshot.roomFrequencies.map((r) => [
        r.roomName,
        r.roomType,
        r.building,
        r.floor,
        String(r.staysCount),
        String(r.nightsSold),
        String(r.utilizationPct),
        String(r.revenue),
      ]),
      ['', '', '', '', '', '', '', ''],
      ['=== PRÉVISIONS ===', '', '', '', '', '', '', ''],
      ['Horizon', 'Occ. Confirmée (%)', 'Occ. Projetée (%)', `Rev. Confirmé (${currency})`, `Rev. Projeté (${currency})`, 'Arrivées prévues', 'Départs prévus', 'Confiance (%)'],
      ...snapshot.forecasts.map((f) => [
        f.label[language] || f.label.fr,
        String(f.confirmedOccupancyPct),
        String(f.projectedOccupancyPct),
        String(f.confirmedRevenue),
        String(f.projectedRevenue),
        String(f.expectedArrivals),
        String(f.expectedCheckouts),
        String(f.confidencePct),
      ]),
      ['', '', '', '', '', '', '', ''],
      ['=== PRODUCTIVITÉ TÂCHES & ÉQUIPE (QUI A FAIT QUOI) ===', '', '', '', '', '', '', ''],
      ['Agent', 'Assignées', 'Achevées', 'Achevées N-1', 'En cours / À faire', 'Achèvement (%)', 'Part charge (%)', 'Équilibre'],
      ...snapshot.tasksAnalytics.staffWorkload.map((st) => [
        st.staffName,
        String(st.assignedTotal),
        String(st.completedCount),
        String(st.prevCompletedCount),
        String(st.doingCount + st.pendingCount),
        String(st.completionRatePct),
        String(st.workloadSharePct),
        st.balanceStatus,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `appointment-manager-analytics-${range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const showForecast = sectionFilter === 'all' || sectionFilter === 'forecast';
  const showInventory = sectionFilter === 'all' || sectionFilter === 'inventory';
  const showGuests = sectionFilter === 'all' || sectionFilter === 'guests';
  const showExtras = sectionFilter === 'all' || sectionFilter === 'extras';
  const showTasksTeam = sectionFilter === 'all' || sectionFilter === 'tasks_team';
  const showPrevention = sectionFilter === 'all' || sectionFilter === 'prevention';
  const showBillingStock = sectionFilter === 'all' || sectionFilter === 'billing_stock';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-w-0 w-full flex-1 overflow-y-auto overscroll-contain bg-[#F4F5F7] text-slate-900 dark:bg-[#141416] dark:text-[#F4F4F6]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-4 sm:px-6 sm:py-6">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3">
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
                {t('Centre Analytique & Prédictions Gérant', 'Manager Analytics & Forecasting', 'مركز التحليلات والتوقعات للمدير')}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-[#8E8E98]">
                {establishmentProfile?.name || t('Établissement', 'Property', 'المنشأة')} ·{' '}
                {currentDomain === 'resort' ? t('Resort', 'Resort', 'منتجع') : t('Hôtel', 'Hotel', 'فندق')} ·{' '}
                <span className="tabular-nums">
                  {from} → {today}
                </span>{' '}
                ·{' '}
                <span className="text-slate-400 dark:text-[#6E6E78] tabular-nums">
                  {t('vs', 'vs', 'مقابل')} {previous.from} → {previous.toInclusive}
                </span>
                {range === '365d' && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                    {archiveLoadState === 'loading'
                      ? t('Chargement des archives…', 'Loading archives…', 'جارٍ تحميل الأرشيف…')
                      : archiveLoadState === 'remote'
                        ? t('Historique synchronisé', 'Synced history', 'سجل متزامن')
                        : archiveLoadState === 'local'
                          ? t('Historique local', 'Local history', 'سجل محلي')
                          : archiveLoadState === 'partial'
                            ? t('Historique partiel', 'Partial history', 'سجل جزئي')
                            : archiveLoadState === 'unavailable'
                              ? t('Archives indisponibles', 'Archives unavailable', 'الأرشيف غير متاح')
                              : ''}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-slate-300/90 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-white/[0.1] dark:bg-[#1E1E22] dark:text-[#F4F4F6] dark:hover:bg-[#27272C]"
          >
            <Download size={15} />
            <span className="whitespace-nowrap">{t('Exporter CSV', 'Export CSV', 'تصدير CSV')}</span>
          </button>
        </header>

        {/* Primary Focal Zone: Hero Card + Comparison Deltas + Dual Charts + Comparative Spline */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left Column */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                    {establishmentProfile?.name || t('Analyse globale', 'Global analytics', 'التحليل العام')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#8E8E98]">
                    <span>
                      {t('Revenus séjours proratisés', 'Prorated stay revenue', 'إيرادات الإقامات المحسوبة')} ·{' '}
                      {range === '7d'
                        ? t('7 jours', '7 days', '7 أيام')
                        : range === '30d'
                        ? t('30 jours', '30 days', '30 يوماً')
                        : range === '90d'
                        ? t('90 jours', '90 days', '90 يوماً')
                        : t('12 mois', '12 months', '12 شهراً')}
                    </span>
                    {renderDeltaBadge(deltas.revenue)}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[clamp(1.65rem,4vw,2.35rem)] font-bold leading-none tracking-tight text-slate-950 tabular-nums dark:text-white">
                    {periodRevenue}
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400 tabular-nums dark:text-[#787882]">
                    {t('Période préc.', 'Prev. period', 'الفترة السابقة')}: {fmtMoney(previous.revenuePrimary, currency)}
                  </div>
                </div>
              </div>

              {/* 8 Comparative Manager KPIs */}
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
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Occupation période', 'Period occ.', 'إشغال الفترة')}</span>
                    {renderDeltaBadge(deltas.occupancyPct, { isPts: true })}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {current.occupancyPct}%{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">
                      ({current.occupiedRoomNights}n)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>ADR / RevPAR</span>
                    {renderDeltaBadge(deltas.adr)}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {fmtMoney(current.adr, currency)}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">
                      / {fmtMoney(current.revPar, currency)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Séjours / ALOS', 'Stays / ALOS', 'الإقامات / المعدل')}</span>
                    {renderDeltaBadge(deltas.bookingsCount)}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {current.bookingsCount}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">
                      · {current.alos} {t('j/séjour', 'd/stay', 'ي')}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Étage phare', 'Top floor', 'الأكثر طلباً')}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-[#E8E8EC]">
                    {snapshot.mostFrequentFloor
                      ? `${snapshot.mostFrequentFloor.floor} (${snapshot.mostFrequentFloor.nightsSold}n)`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Prise extras', 'Extras attach', 'الإضافات')}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {snapshot.extrasAttachRatePct}%{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">
                      ({fmtMoney(snapshot.totalEstimatedExtrasRevenue, currency)})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Taux annulation', 'Cancel rate', 'الإلغاء')}</span>
                    {renderDeltaBadge(deltas.cancelRatePct, { invertGood: true, isPts: true })}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {current.cancelRatePct}%{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-[#8E8E98]">
                      ({current.cancellationsCount})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Pannes & Doléances', 'Issues & Alerts', 'الأعطال والشكاوى')}</span>
                    {renderDeltaBadge(deltas.alertsCount, { invertGood: true })}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums dark:text-[#E8E8EC]">
                    {current.maintenanceTasksCount} / {snapshot.complaintsAndAlerts.length}
                  </div>
                </div>
              </div>

              {/* Tasks & Team Quick Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={15} className="text-emerald-600 dark:text-[#67C380]" />
                  <span className="font-semibold text-slate-700 dark:text-[#D4D4DC]">
                    {t('Tâches & Exécution équipe', 'Tasks & Team Execution', 'المهام وأداء الفريق')}:
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                    {snapshot.tasksAnalytics.completedTasks} / {snapshot.tasksAnalytics.totalTasks}{' '}
                    ({snapshot.tasksAnalytics.completionRatePct}%)
                  </span>
                  {renderDeltaBadge(deltas.tasksCompletionRate, { isPts: true })}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                  {snapshot.tasksAnalytics.staffWorkload[0] && (
                    <span>
                      {t('Top', 'Top', 'الأكثر إنجازاً')}:{' '}
                      <strong className="text-slate-800 dark:text-white">
                        {snapshot.tasksAnalytics.staffWorkload[0].staffName} (
                        {snapshot.tasksAnalytics.staffWorkload[0].completedCount})
                      </strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSectionFilter('tasks_team')}
                    className="font-bold text-sky-600 hover:underline dark:text-[#87CEFA] cursor-pointer"
                  >
                    {t('Voir répartition →', 'View split →', 'عرض التوزيع ←')}
                  </button>
                </div>
              </div>
            </section>

            {/* Controls Row: [ ● Breakdown Selector ▾ ]   [ 7 j | 30 j | 90 j | 12 mois ] */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative inline-flex min-h-[44px] items-center rounded-full border border-slate-200/90 bg-white px-3.5 dark:border-white/[0.08] dark:bg-[#1E1E22]">
                <span aria-hidden="true" className="me-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF7369]" />
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
                  <option value="segment" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                    {t('Typologie clients', 'Client typology', 'أنواع العملاء')}
                  </option>
                  <option value="mealPlan" className="bg-white text-slate-900 dark:bg-[#1E1E22] dark:text-white">
                    {t('Formules de pension', 'Meal plans', 'أنظمة الوجبات')}
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
                {(['7d', '30d', '90d', '365d'] as AnalyticsRangeKey[]).map((key) => {
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
                      className={`min-h-[36px] whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-[#E8E8EC] dark:text-[#141416]'
                          : 'text-slate-500 hover:text-slate-900 dark:text-[#8E8E98] dark:hover:text-white'
                      }`}
                    >
                      {key === '7d'
                        ? t('7 j', '7d', '7 ي')
                        : key === '30d'
                        ? t('30 j', '30d', '30 ي')
                        : key === '90d'
                        ? t('90 j', '90d', '90 ي')
                        : t('12 mois', 'Year', 'سنة')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dual Visual Charts Side-by-Side */}
            <section className="grid grid-cols-1 gap-5 rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:grid-cols-2 sm:p-6">
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
                                <span className="truncate text-slate-700 dark:text-[#D4D4DC]">{slice.label}</span>
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
                                <span className="truncate text-slate-700 dark:text-[#D4D4DC]">{item.label}</span>
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

          {/* Right Column: Comparative Spline Trend (N vs N-1) + Quick Forecast Card */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
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

                <button
                  type="button"
                  onClick={() => setShowPreviousCurve((v) => !v)}
                  aria-pressed={showPreviousCurve}
                  className={`min-h-[36px] rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                    showPreviousCurve
                      ? 'border-sky-400/50 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-[#87CEFA]'
                      : 'border-slate-200 text-slate-500 dark:border-white/[0.08] dark:text-[#8E8E98]'
                  }`}
                >
                  {t('Comparer N-1', 'Compare Prev.', 'مقارنة N-1')}
                </button>
              </div>

              {activeSplinePoint && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3.5 py-2 dark:bg-white/[0.03]">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-700 dark:text-[#D4D4DC]">{activeSplinePoint.label}</span>
                    {showPreviousCurve && activeSplinePoint.prevLabel && (
                      <span className="ms-2 text-[11px] text-slate-400 dark:text-[#787882]">
                        vs {activeSplinePoint.prevLabel}: {formatSplineValue(activeSplinePoint[prevMetricKey])}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex min-h-[28px] items-center rounded-full border border-black/10 bg-[#D9FF54] px-3 text-xs font-bold text-[#141416] tabular-nums">
                    {formatSplineValue(activeSplinePoint[splineMetric])}
                  </span>
                </div>
              )}

              {trendPoints.length > 0 ? (
                <div className="mt-4">
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
                      aria-label={t('Courbe comparative N vs N-1', 'Comparative trend curve', 'منحنى المقارنة الزمني')}
                      className="h-44 w-full overflow-visible sm:h-48"
                    >
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

                      {/* Previous Period Dashed Spline */}
                      {showPreviousCurve && prevSplinePathD && (
                        <path
                          d={prevSplinePathD}
                          fill="none"
                          stroke="#87CEFA"
                          strokeWidth="2.5"
                          strokeDasharray="6 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.75"
                        />
                      )}

                      {/* Current Period Smooth Spline */}
                      <path
                        d={splinePathD}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#4D7C0F] dark:text-[#D9FF54]"
                      />

                      {showPreviousCurve && activePrevSplineCoord && (
                        <circle
                          cx={activePrevSplineCoord.x}
                          cy={activePrevSplineCoord.y}
                          r="4.5"
                          className="fill-[#87CEFA] stroke-[#141416] dark:stroke-[#1E1E22]"
                          strokeWidth="2"
                        />
                      )}

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

            {/* Quick Forward Forecast Summary Card */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp size={17} className="text-emerald-600 dark:text-[#67C380]" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Radar Prévisions (J+7 · J+14 · J+30)', 'Forward Radar (+7d · +14d · +30d)', 'رادار التوقعات القادمة')}
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-[#8E8E98]">
                  {snapshot.recommendations.length} {t('actions', 'actions', 'توصيات')}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {snapshot.forecasts.map((f) => (
                  <div
                    key={f.horizonDays}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
                  >
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8E8E98]">
                      J+{f.horizonDays}
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums dark:text-white">
                      {f.projectedOccupancyPct}%
                    </div>
                    <div className="text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                      {t('Confirmé', 'Booked', 'مؤكد')}: {f.confirmedOccupancyPct}%
                    </div>
                    <div className="mt-1 truncate text-[11px] font-semibold text-emerald-700 tabular-nums dark:text-[#67C380]">
                      {fmtMoney(f.projectedRevenue, currency)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Interactive Operational Section Filter Bar */}
        <nav
          aria-label={t('Filtrer les sections analytiques', 'Filter analytics sections', 'تصفية أقسام التحليل')}
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {(
            [
              ['all', t('Tout afficher', 'All sections', 'عرض الكل')],
              ['forecast', t('Prédictions & Recommandations', 'Forecast & Actions', 'التوقعات والتوصيات')],
              ['inventory', t('Chambres & Étages', 'Rooms & Floors', 'الغرف والطوابق')],
              ['guests', t('Clients, Âges & Besoins', 'Guests, Ages & Needs', 'العملاء والأعمار والاحتياجات')],
              ['extras', t('Extras, Formules & Additifs', 'Extras & Additives', 'الإضافات والوجبات')],
              ['tasks_team', t('Tâches & Productivité Équipe', 'Tasks & Staff Workload', 'المهام وإنتاجية الفريق')],
              ['prevention', t('Pannes, Prévention & Doléances', 'Failures & Complaints', 'الأعطال والوقاية والشكاوى')],
              ['billing_stock', t('Facturation & Stock', 'Billing & Stock', 'الفوترة والمخزون')],
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

        {/* SECTION 1: PRÉDICTIONS, COMPARAISON & RECOMMANDATIONS GÉRANT */}
        {showForecast && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-6">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0">
                  <TrendingUp size={18} className="shrink-0 text-emerald-600 dark:text-[#67C380]" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                      {t('Prévisions d’occupation, CA & flux opérationnels', 'Occupancy, Revenue & Flow Forecasts', 'توقعات الإشغال والإيرادات والحركة')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t(
                        'Combinaison du carnet confirmé (On-Books) et de la vélocité historique récente.',
                        'Combines confirmed on-books reservations with recent occupancy momentum.',
                        'دمج الحجوزات المؤكدة مع وتيرة الإشغال التاريخية الحديثة.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {snapshot.forecasts.map((f) => (
                  <div
                    key={f.horizonDays}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {f.label[language] || f.label.fr}
                        </span>
                        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 tabular-nums dark:bg-white/[0.08] dark:text-[#D4D4DC]">
                          {t('Confiance', 'Confidence', 'الثقة')} {f.confidencePct}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-emerald-700 tabular-nums dark:text-[#67C380]">
                        {fmtMoney(f.projectedRevenue, currency)}{' '}
                        <span className="font-normal text-slate-500 dark:text-[#8E8E98]">
                          ({t('confirmé', 'booked', 'مؤكد')}: {fmtMoney(f.confirmedRevenue, currency)})
                        </span>
                      </div>
                    </div>

                    {/* Stacked Confirmé + Projeté bar */}
                    <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-white/[0.08]">
                      <div className="relative flex h-full w-full">
                        <div
                          className="h-full bg-sky-500 dark:bg-[#87CEFA]"
                          style={{ width: `${f.confirmedOccupancyPct}%` }}
                        />
                        <div
                          className="h-full bg-[#D9FF54]/90"
                          style={{ width: `${Math.max(0, f.projectedOccupancyPct - f.confirmedOccupancyPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-[#9E9EA8] tabular-nums">
                      <span>
                        {t('Confirmé', 'Confirmed', 'مؤكد')}: <strong>{f.confirmedOccupancyPct}%</strong> ({f.confirmedNights}n) ·{' '}
                        {t('Projeté', 'Projected', 'متوقع')}: <strong>{f.projectedOccupancyPct}%</strong> ({f.projectedNights}n)
                      </span>
                      <span>
                        {f.expectedArrivals} {t('arrivées', 'arrivals', 'وصول')} · {f.expectedCheckouts}{' '}
                        {t('départs', 'checkouts', 'مغادرة')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-6">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0">
                  <Lightbulb size={18} className="shrink-0 text-amber-500 dark:text-[#FFA84B]" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                      {t('Recommandations Gérant & Plan d’action', 'Manager Recommendations & Actions', 'توصيات المدير وخطة العمل')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t(
                        'Priorisées selon le rendement, les pannes récurrentes, les doléances et le stock.',
                        'Prioritized across yield, recurring failures, guest complaints and stock runway.',
                        'مرتبة حسب الأولوية: التسعير، الصيانة الوقائية، الشكاوى والمخزون.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {snapshot.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {snapshot.recommendations.map((rec) => {
                    const prioStyle =
                      rec.priority === 'high'
                        ? 'border-rose-200/80 bg-rose-50/70 dark:border-[#FF7369]/25 dark:bg-[#FF7369]/10'
                        : rec.priority === 'medium'
                        ? 'border-amber-200/80 bg-amber-50/70 dark:border-[#FFA84B]/25 dark:bg-[#FFA84B]/10'
                        : 'border-emerald-200/80 bg-emerald-50/60 dark:border-[#67C380]/25 dark:bg-[#67C380]/10';
                    const badgeStyle =
                      rec.priority === 'high'
                        ? 'bg-rose-600 text-white dark:bg-[#FF7369] dark:text-[#141416]'
                        : rec.priority === 'medium'
                        ? 'bg-amber-500 text-white dark:bg-[#FFA84B] dark:text-[#141416]'
                        : 'bg-emerald-600 text-white dark:bg-[#67C380] dark:text-[#141416]';
                    return (
                      <article key={rec.id} className={`rounded-2xl border p-3.5 ${prioStyle}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                            {rec.title[language] || rec.title.fr}
                          </h3>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tabular-nums ${badgeStyle}`}>
                            {rec.metricBadge}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-700 dark:text-[#D4D4DC]">
                          {rec.rationale[language] || rec.rationale.fr}
                        </p>
                        <p className="mt-1.5 text-[11px] font-semibold text-slate-900 dark:text-[#F4F4F6]">
                          → {rec.action[language] || rec.action.fr}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-8 text-xs font-medium text-emerald-700 dark:text-[#67C380]">
                  <CheckCircle2 size={16} />
                  {t(
                    'Aucun risque critique détecté. Exploitation équilibrée sur la période.',
                    'No critical issues detected. Operations balanced across the period.',
                    'لا توجد مخاطر حرجة. التشغيل متوازن في هذه الفترة.'
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* SECTION 2: CHAMBRES UTILISÉES, FRÉQUENCES & ÉTAGE LE PLUS FRÉQUENTÉ */}
        {showInventory && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Room-by-Room Usage & Frequency */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0">
                  <BedDouble size={18} className="shrink-0 text-sky-600 dark:text-[#87CEFA]" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                      {t('Chambres utilisées & fréquences d’occupation', 'Room Usage & Frequency Ranking', 'الغرف المستخدمة ومعدلات تكرارها')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t('Séjours, nuitées, taux d’utilisation vs N-1, revenus et alertes par chambre.', 'Stays, nights, utilization vs prev. period, revenue & alerts per room.', 'الإقامات والليالي ومعدل الاستخدام مقابل الفترة السابقة.')}
                    </p>
                  </div>
                </div>
                <div className="inline-flex rounded-full border border-slate-200/90 p-0.5 dark:border-white/[0.08]">
                  {(
                    [
                      ['most_used', t('Top utilisées', 'Most used', 'الأكثر استخداماً')],
                      ['least_used', t('Sous-utilisées', 'Underused', 'الأقل استخداماً')],
                      ['maintenance', t('Pannes/Alertes', 'Issues', 'الأعطال')],
                    ] as Array<[RoomSortMode, string]>
                  ).map(([mode, lbl]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRoomSortMode(mode)}
                      className={`min-h-[32px] rounded-full px-3 text-[11px] font-semibold transition-colors ${
                        roomSortMode === mode
                          ? 'bg-slate-900 text-white dark:bg-[#E8E8EC] dark:text-[#141416]'
                          : 'text-slate-500 hover:text-slate-900 dark:text-[#8E8E98] dark:hover:text-white'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-96 space-y-2.5 overflow-y-auto pe-1">
                {sortedRooms.map((rm) => {
                  const deltaPts = rm.utilizationPct - rm.prevUtilizationPct;
                  return (
                    <div
                      key={rm.roomId}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/[0.05] dark:bg-white/[0.02]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white">{rm.roomName}</span>
                          <span className="ms-2 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                            {rm.roomType} · {t('Étage', 'Floor', 'طابق')} {rm.floor}
                          </span>
                          {rm.housekeepingStatus === 'out_of_order' && (
                            <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-[#FF7369]">
                              HS / OOO
                            </span>
                          )}
                          {rm.maintenanceCount > 0 && (
                            <span className="ms-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-[#FFA84B]">
                              {rm.maintenanceCount} {t('maint.', 'maint.', 'صيانة')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                            {rm.staysCount} {t('séj.', 'stays', 'إقامة')} · {rm.nightsSold}n
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{rm.utilizationPct}%</span>
                          <span
                            className={`text-[10px] font-bold ${
                              deltaPts > 0
                                ? 'text-emerald-600 dark:text-[#67C380]'
                                : deltaPts < 0
                                ? 'text-rose-600 dark:text-[#FF7369]'
                                : 'text-slate-400'
                            }`}
                          >
                            {deltaPts > 0 ? `+${deltaPts}` : deltaPts}pts
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        {progress(
                          rm.utilizationPct,
                          rm.utilizationPct >= 65
                            ? 'bg-emerald-500 dark:bg-[#67C380]'
                            : rm.utilizationPct >= 25
                            ? 'bg-sky-500 dark:bg-[#87CEFA]'
                            : 'bg-amber-500 dark:bg-[#FFA84B]'
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                        <span>{rm.building}</span>
                        <span>
                          {t('CA généré', 'Revenue', 'الإيراد')}: <strong className="text-slate-800 dark:text-[#E8E8EC]">{fmtMoney(rm.revenue, currency)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!sortedRooms.length && (
                  <p className="py-8 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucune chambre enregistrée.', 'No rooms registered.', 'لا توجد غرف مسجلة.')}
                  </p>
                )}
              </div>
            </section>

            {/* Floor Frequency & Building Performance */}
            <div className="flex flex-col gap-5 xl:col-span-5">
              <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3 min-w-0">
                    <Layers size={18} className="shrink-0 text-indigo-600 dark:text-[#7178FF]" />
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                        {t('Étage le plus fréquenté & comparatif étages', 'Most Frequented Floor & Floor Mix', 'الطابق الأكثر إقبالاً وتوزيع الطوابق')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                        {t('Classement par nuitées vendues et évolution vs N-1.', 'Ranked by nights sold with period-over-period delta.', 'مرتب حسب الليالي المباعة والتطور.')}
                      </p>
                    </div>
                  </div>
                </div>

                {snapshot.mostFrequentFloor && (
                  <div className="mb-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 p-3.5 dark:border-[#7178FF]/30 dark:bg-[#7178FF]/10">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-[#87CEFA]">
                      {t('Étage n°1 de la période', '#1 Most Frequented Floor', 'الطابق الأكثر تردداً')}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {snapshot.mostFrequentFloor.building} · {t('Étage', 'Floor', 'طابق')} {snapshot.mostFrequentFloor.floor}
                      </span>
                      <span className="text-sm font-bold text-indigo-700 tabular-nums dark:text-[#D9FF54]">
                        {snapshot.mostFrequentFloor.nightsSold} {t('nuitées', 'nights', 'ليالٍ')} ({snapshot.mostFrequentFloor.occupancyPct}%)
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {snapshot.floorFrequencies.map((fl) => (
                    <div key={fl.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-medium text-slate-800 dark:text-[#E8E8EC]">
                          {fl.building} · {t('Étage', 'Fl.', 'طابق')} {fl.floor}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                          {fl.occupancyPct}% · {fl.nightsSold}n{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            ({fl.deltaPts > 0 ? `+${fl.deltaPts}` : fl.deltaPts}pts)
                          </span>
                        </span>
                      </div>
                      {progress(
                        fl.occupancyPct,
                        fl.isMostFrequent ? 'bg-indigo-600 dark:bg-[#7178FF]' : 'bg-sky-500 dark:bg-[#87CEFA]'
                      )}
                    </div>
                  ))}
                  {!snapshot.floorFrequencies.length && (
                    <p className="py-4 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t('Aucun étage renseigné.', 'No floors recorded.', 'لا توجد طوابق مسجلة.')}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
                <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                  <Building2 size={18} className="shrink-0 text-emerald-600 dark:text-[#67C380]" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Performance par bâtiment', 'Performance by building', 'الأداء حسب المبنى')}
                  </h2>
                </div>
                <div className="space-y-3">
                  {buildingStats.map((b) => (
                    <div key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-slate-800 dark:text-[#E8E8EC]">{b.name}</span>
                        <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                          {b.occupancy}% · {fmtMoney(b.revenue, currency)}
                        </span>
                      </div>
                      {progress(b.occupancy, 'bg-emerald-500 dark:bg-[#67C380]')}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* SECTION 3: TYPES DE CLIENTS, TRANCHES D'ÂGE & BESOINS / DEMANDES */}
        {showGuests && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Client Typology & Correlated Needs */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <Users size={18} className="shrink-0 text-indigo-600 dark:text-[#7178FF]" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Typologie des clients & besoins par profil', 'Client Typology & Profile Needs', 'تصنيف العملاء واحتياجات كل فئة')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Part des séjours, dépense moyenne et demandes fréquentes.', 'Stay share, average spend and recurring requests.', 'نسبة الحجوزات ومتوسط الإنفاق والطلبات.')}
                  </p>
                </div>
              </div>

              {snapshot.clientSegments.length > 0 ? (
                <div className="space-y-3.5">
                  {snapshot.clientSegments.map((seg) => (
                    <div
                      key={seg.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/[0.05] dark:bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {seg.label[language] || seg.label.fr}
                        </span>
                        <span className="font-semibold text-slate-800 tabular-nums dark:text-[#E8E8EC]">
                          {seg.sharePct}% ({seg.count} · {t('N-1', 'Prev', 'السابق')}: {seg.prevCount})
                        </span>
                      </div>
                      <div className="mt-1.5">{progress(seg.sharePct, 'bg-indigo-500 dark:bg-[#7178FF]')}</div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                        <span>
                          {seg.nightsSold}n · {t('Moy.', 'Avg', 'المتوسط')}: {seg.avgStayNights}j
                        </span>
                        <span>
                          {t('Panier moy.', 'Avg spend', 'معدل الإنفاق')}: {fmtMoney(seg.avgSpend, currency)}
                        </span>
                      </div>
                      {seg.topNeeds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {seg.topNeeds.map((n) => (
                            <span
                              key={n.id}
                              className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#D4D4DC]"
                            >
                              {n.label} ({n.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                  {t('Aucune donnée client sur la période.', 'No guest data in this period.', 'لا توجد بيانات عملاء.')}
                </p>
              )}
            </section>

            {/* Age Brackets */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-3">
              <div className="mb-4 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                  {t('Tranches d’âge des voyageurs', 'Guest Age Brackets', 'الفئات العمرية للنزلاء')}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[#8E8E98]">
                  {t('Total', 'Total', 'الإجمالي')}: {snapshot.totalGuestsCount} {t('pers.', 'guests', 'شخص')} ·{' '}
                  {snapshot.declaredAgeSharePct}% {t('renseigné', 'declared', 'محدد')}
                </p>
              </div>

              <div className="space-y-3">
                {snapshot.ageBrackets.map((ab) => (
                  <div key={ab.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-800 dark:text-[#E8E8EC]">
                        {ab.label[language] || ab.label.fr}
                      </span>
                      <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                        {ab.peopleCount} ({ab.sharePct}%)
                      </span>
                    </div>
                    {progress(
                      ab.sharePct,
                      ab.isEstimatedOrMissing
                        ? 'bg-slate-400 dark:bg-[#6E717A]'
                        : ab.id === '0-17'
                        ? 'bg-emerald-500 dark:bg-[#67C380]'
                        : 'bg-sky-500 dark:bg-[#87CEFA]'
                    )}
                    {ab.topNeeds.length > 0 && (
                      <div className="text-[10px] text-slate-500 dark:text-[#8E8E98]">
                        {t('Besoins', 'Needs', 'الاحتياجات')}: {ab.topNeeds.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
                {!snapshot.ageBrackets.length && (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucun voyageur comptabilisé.', 'No travelers recorded.', 'لا يوجد مسافرون.')}
                  </p>
                )}
              </div>
              <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-white/[0.06] dark:text-[#787882]">
                {t(
                  'Les enfants sont comptés automatiquement ; les tranches adultes proviennent du sélecteur optionnel du dossier.',
                  'Children are counted automatically; adult brackets come from the optional booking age selector.',
                  'يُحتسب الأطفال تلقائياً وتُستمد فئات البالغين من الحقل الاختياري في الحجز.'
                )}
              </p>
            </section>

            {/* Needs, Channels & Nationalities */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-4">
              <div className="mb-4 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                  {t('Demandes, besoins, canaux & origines', 'Requests, Needs, Channels & Origins', 'الطلبات والقنوات والجنسيات')}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[#8E8E98]">
                  {t('Options demandées, notes séjours et provenance.', 'Requested options, stay notes and booking sources.', 'الخيارات المطلوبة ومصادر الحجز.')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#8E8E98]">
                    {t('Besoins & préférences exprimés', 'Expressed needs & preferences', 'الاحتياجات والتفضيلات')}
                  </div>
                  {snapshot.guestNeeds.length > 0 ? (
                    <div className="space-y-2">
                      {snapshot.guestNeeds.slice(0, 6).map((need) => (
                        <div key={need.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-slate-700 dark:text-[#D4D4DC]">
                            {need.label[language] || need.label.fr}
                          </span>
                          <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                            {need.count} ({need.sharePct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-[#787882]">
                      {t('Aucune demande particulière détectée.', 'No special requests recorded.', 'لا توجد طلبات خاصة.')}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#8E8E98]">
                    {t('Canaux d’acquisition', 'Acquisition channels', 'قنوات الحجز')}
                  </div>
                  <div className="space-y-1.5">
                    {snapshot.channelBreakdown.slice(0, 4).map((ch) => (
                      <div key={ch.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-slate-700 dark:text-[#D4D4DC]">{ch.label}</span>
                        <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-white">
                          {ch.sharePct}% · {fmtMoney(ch.revenue, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#8E8E98]">
                    {t('Nationalités principales', 'Top nationalities', 'الجنسيات الرئيسية')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {snapshot.nationalityBreakdown.slice(0, 6).map((nat) => (
                      <span
                        key={nat.label}
                        className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 tabular-nums dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#D4D4DC]"
                      >
                        {nat.label} · {nat.count} ({nat.sharePct}%)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* SECTION 4: EXTRAS, FORMULES DE PENSION & ADDITIFS ALIMENTAIRES */}
        {showExtras && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Meal Plans */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <UtensilsCrossed size={18} className="shrink-0 text-amber-500 dark:text-[#FFA84B]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Formules de pension', 'Meal plans mix', 'أنظمة الإقامة والوجبات')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Comparaison N vs N-1', 'Current vs previous period', 'مقارنة بالفترة السابقة')}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {snapshot.mealPlanStats.map((mp) => (
                  <div key={mp.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-800 dark:text-[#E8E8EC]">
                        {mp.code} · {mp.label}
                      </span>
                      <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                        {mp.count} ({mp.sharePct}%) · {t('N-1', 'Prev', 'السابق')}: {mp.prevCount}
                      </span>
                    </div>
                    {progress(mp.sharePct, 'bg-amber-500 dark:bg-[#FFA84B]')}
                  </div>
                ))}
                {!snapshot.mealPlanStats.length && (
                  <p className="py-4 text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucune formule enregistrée.', 'No meal plans recorded.', 'لا توجد بيانات وجبات.')}
                  </p>
                )}
              </div>
            </section>

            {/* Paid Extras & Stay Add-ons */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <Sparkles size={18} className="shrink-0 text-emerald-600 dark:text-[#67C380]" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                      {t('Extras & options payantes', 'Paid Extras & Add-ons', 'الإضافات والخدمات المدفوعة')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t('Taux de prise', 'Attach rate', 'نسبة الإقبال')}: {snapshot.extrasAttachRatePct}%
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 tabular-nums dark:bg-emerald-500/15 dark:text-[#67C380]">
                  {fmtMoney(snapshot.totalEstimatedExtrasRevenue, currency)}
                </span>
              </div>

              <div className="max-h-64 space-y-2.5 overflow-y-auto pe-1">
                {snapshot.paidExtrasStats.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs dark:border-white/[0.05] dark:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800 dark:text-[#E8E8EC]">{ex.label}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                        {ex.count} {t('séj.', 'stays', 'إقامة')} ({ex.attachRatePct}%) · {t('N-1', 'Prev', 'السابق')}: {ex.prevCount}
                      </div>
                    </div>
                    <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                      {fmtMoney(ex.estimatedRevenue, currency)}
                    </span>
                  </div>
                ))}
                {!snapshot.paidExtrasStats.length && (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucun extra payant enregistré sur la période.', 'No paid extras recorded in this period.', 'لا توجد إضافات مدفوعة في هذه الفترة.')}
                  </p>
                )}
              </div>
            </section>

            {/* Dietary Additives & Special Menus */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <Sparkles size={18} className="shrink-0 text-sky-600 dark:text-[#87CEFA]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Additifs & régimes alimentaires', 'Dietary Additives & Special Menus', 'الإضافات الغذائية والأنظمة الخاصة')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Préférences cuisine & menus spéciaux.', 'Kitchen preferences and special dietary needs.', 'تفضيلات المطبخ والوجبات الخاصة.')}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {snapshot.dietaryAdditivesStats.map((diet) => (
                  <div key={diet.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-800 dark:text-[#E8E8EC]">{diet.label}</span>
                      <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                        {diet.count} ({diet.attachRatePct}%) · {t('N-1', 'Prev', 'السابق')}: {diet.prevCount}
                      </span>
                    </div>
                    {progress(diet.attachRatePct, 'bg-sky-500 dark:bg-[#87CEFA]')}
                  </div>
                ))}
                {!snapshot.dietaryAdditivesStats.length && (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucun régime ou additif spécifique saisi.', 'No specific dietary additives recorded.', 'لا توجد تفضيلات غذائية مسجلة.')}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* SECTION 4B: TÂCHES & RÉPARTITION DU TRAVAIL ("QUI A FAIT QUOI ET COMBIEN") */}
        {showTasksTeam && (
          <section className="space-y-5">
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0">
                  <UserCheck size={18} className="shrink-0 text-emerald-600 dark:text-[#67C380]" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                      {t(
                        'Tâches & Productivité Équipe — Qui a fait quoi et combien',
                        'Tasks & Staff Productivity — Who Did What & How Much',
                        'المهام وإنتاجية الفريق — من أنجز ماذا وكم'
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t(
                        'Mesure des réalisations individuelles, répartition de la charge par agent et comparaison N vs N-1.',
                        'Tracks individual task completions, workload share per staff member, and N vs N-1 progress.',
                        'قياس الإنجازات الفردية وتوزيع أعباء العمل والمقارنة مع الفترة السابقة.'
                      )}
                    </p>
                  </div>
                </div>

                {snapshot.tasksAnalytics.imbalanceDetected ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-[#FFA84B]">
                    {t('Déséquilibre de charge détecté', 'Workload imbalance detected', 'عدم توازن في توزيع المهام')}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-[#67C380]">
                    {t('Répartition équilibrée', 'Balanced workload', 'توزيع متوازن')}
                  </span>
                )}
              </div>

              {/* 4 Tasks KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Tâches période', 'Total tasks', 'إجمالي المهام')}</span>
                    {renderDeltaBadge(deltas.tasksTotal)}
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-white">
                    {snapshot.tasksAnalytics.totalTasks}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                    {t('N-1', 'Prev', 'السابق')}: {snapshot.tasksAnalytics.prevTotalTasks}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    <span>{t('Achevées', 'Completed', 'المكتملة')}</span>
                    {renderDeltaBadge(deltas.tasksCompletionRate, { isPts: true })}
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-700 tabular-nums dark:text-[#67C380]">
                    {snapshot.tasksAnalytics.completionRatePct}%
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                    {snapshot.tasksAnalytics.completedTasks} / {snapshot.tasksAnalytics.totalTasks}{' '}
                    {t('tâches', 'tasks', 'مهمة')}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('En cours / À faire', 'Doing / Pending', 'قيد التنفيذ / معلقة')}
                  </div>
                  <div className="mt-1 text-xl font-bold text-amber-600 tabular-nums dark:text-[#FFA84B]">
                    {snapshot.tasksAnalytics.doingTasks + snapshot.tasksAnalytics.pendingTasks}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                    {snapshot.tasksAnalytics.urgentOpenTasks} {t('urgentes ouvertes', 'urgent open', 'عاجلة مفتوحة')}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <div className="text-[11px] text-slate-500 dark:text-[#8E8E98]">
                    {t('Charge moy. / agent', 'Avg tasks / staff', 'المعدل لكل موظف')}
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-white">
                    {snapshot.tasksAnalytics.avgTasksPerStaff}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                    {snapshot.tasksAnalytics.staffWorkload.length}{' '}
                    {t('intervenant(s) actif(s)', 'active staff', 'موظف نشط')}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
                {/* Staff Leaderboard: Qui a fait quoi et combien */}
                <div className="space-y-3 xl:col-span-7">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
                    <span>
                      {t('Performance & Répartition par personnel', 'Staff Output & Workload Split', 'الأداء وتوزيع العمل حسب الموظف')}
                    </span>
                    <span className="text-[11px] font-normal text-slate-500 dark:text-[#8E8E98]">
                      {t('Classement par tâches achevées', 'Ranked by completed tasks', 'مرتب حسب المهام المنجزة')}
                    </span>
                  </div>

                  {snapshot.tasksAnalytics.staffWorkload.length > 0 ? (
                    <div className="max-h-[420px] space-y-2.5 overflow-y-auto pe-1">
                      {snapshot.tasksAnalytics.staffWorkload.map((st, idx) => {
                        const statusPill =
                          st.balanceStatus === 'overloaded'
                            ? {
                                lbl: t('Surcharge', 'Overloaded', 'ضغط مرتفع'),
                                cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-[#FF7369]',
                                bar: 'bg-rose-500 dark:bg-[#FF7369]',
                              }
                            : st.balanceStatus === 'available'
                            ? {
                                lbl: t('Disponible', 'Available', 'متاح للتكليف'),
                                cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-[#87CEFA]',
                                bar: 'bg-sky-500 dark:bg-[#87CEFA]',
                              }
                            : {
                                lbl: t('Équilibré', 'Balanced', 'متوازن'),
                                cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-[#67C380]',
                                bar: 'bg-emerald-500 dark:bg-[#67C380]',
                              };

                        return (
                          <div
                            key={st.staffName}
                            className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-[#141416] tabular-nums">
                                  {idx + 1}
                                </span>
                                <span className="truncate font-bold text-slate-900 dark:text-white">
                                  {st.staffName}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusPill.cls}`}>
                                  {statusPill.lbl}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] tabular-nums">
                                <span className="font-bold text-emerald-700 dark:text-[#67C380]">
                                  {st.completedCount} {t('achevée(s)', 'done', 'منجزة')}
                                </span>
                                <span className="text-slate-400">
                                  / {st.assignedTotal} ({st.completionRatePct}%)
                                </span>
                                {st.prevCompletedCount > 0 && (
                                  <span className="text-slate-400 dark:text-[#787882]">
                                    · N-1: {st.prevCompletedCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2">
                              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                                <span>
                                  {t('Part de charge', 'Workload share', 'نسبة العبء')}: {st.workloadSharePct}%
                                </span>
                                <span>
                                  {st.roomsCount} {t('chambre(s)', 'room(s)', 'غرف')}
                                  {st.doingCount + st.pendingCount > 0
                                    ? ` · ${st.doingCount + st.pendingCount} ${t('en attente/cours', 'open', 'مفتوحة')}`
                                    : ''}
                                  {st.consumedUnits > 0 ? ` · ${st.consumedUnits} ${t('u. stock', 'stock u.', 'وحدات')}` : ''}
                                </span>
                              </div>
                              {progress(st.workloadSharePct, statusPill.bar)}
                            </div>

                            {st.categoryBreakdown.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {st.categoryBreakdown.map((cb) => (
                                  <span
                                    key={cb.category}
                                    className="rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 tabular-nums dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#D4D4DC]"
                                  >
                                    {cb.category}: {cb.done}/{cb.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t('Aucune tâche enregistrée sur la période.', 'No tasks recorded in this period.', 'لا توجد مهام مسجلة في هذه الفترة.')}
                    </p>
                  )}
                </div>

                {/* Right Column: Tasks by Category + Recent Execution Feed */}
                <div className="space-y-5 xl:col-span-5">
                  <div>
                    <div className="mb-2.5 text-xs font-bold text-slate-800 dark:text-white">
                      {t('Volume & achèvement par catégorie', 'Volume & Completion by Category', 'الحجم والإنجاز حسب الفئة')}
                    </div>
                    {snapshot.tasksAnalytics.byCategory.length > 0 ? (
                      <div className="space-y-2.5">
                        {snapshot.tasksAnalytics.byCategory.map((cat) => (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate font-medium text-slate-800 dark:text-[#E8E8EC]">
                                {cat.label[language] || cat.label.fr}
                              </span>
                              <span className="shrink-0 font-bold text-slate-900 tabular-nums dark:text-white">
                                {cat.done}/{cat.total} ({cat.completionRatePct}%){' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  · N-1: {cat.prevTotal}
                                </span>
                              </span>
                            </div>
                            {progress(
                              cat.completionRatePct,
                              cat.completionRatePct >= 75
                                ? 'bg-emerald-500 dark:bg-[#67C380]'
                                : cat.completionRatePct >= 40
                                ? 'bg-sky-500 dark:bg-[#87CEFA]'
                                : 'bg-amber-500 dark:bg-[#FFA84B]'
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-4 text-xs text-slate-500 dark:text-[#8E8E98]">
                        {t('Aucune catégorie active.', 'No active categories.', 'لا توجد فئات نشطة.')}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                    <div className="mb-2.5 text-xs font-bold text-slate-800 dark:text-white">
                      {t('Dernières interventions & validations', 'Recent Executions & Sign-offs', 'أحدث المهام والاعتمادات')}
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pe-1">
                      {snapshot.tasksAnalytics.recentExecutions.slice(0, 8).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs dark:border-white/[0.05] dark:bg-white/[0.02]"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900 dark:text-white">
                              {item.room} · {item.typeName}
                            </div>
                            <div className="truncate text-[10px] text-slate-500 dark:text-[#8E8E98]">
                              {item.executor} · {item.category} · {item.completedAt || item.date}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.status === 'done'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-[#67C380]'
                                : item.status === 'doing'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-[#FFA84B]'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-[#D4D4DC]'
                            }`}
                          >
                            {item.status === 'done'
                              ? t('Achevée', 'Done', 'منجزة')
                              : item.status === 'doing'
                              ? t('En cours', 'Doing', 'جارية')
                              : t('À faire', 'Open', 'معلقة')}
                          </span>
                        </div>
                      ))}
                      {!snapshot.tasksAnalytics.recentExecutions.length && (
                        <p className="py-4 text-xs text-slate-500 dark:text-[#8E8E98]">
                          {t('Aucune exécution récente.', 'No recent executions.', 'لا توجد عمليات حديثة.')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5: PRÉVENTION, PANNES TECHNIQUES, DOLÉANCES & RUPTURES STOCK */}
        {showPrevention && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Failures by Technical Trade & Recurring Risk Rooms */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <Wrench size={18} className="shrink-0 text-amber-500 dark:text-[#FFA84B]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Pannes par corps de métier & prévention', 'Failures by Trade & Prevention', 'الأعطال حسب التخصص والوقاية')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('CVC, Plomberie, Électricité/Serrures, Menuiserie vs N-1.', 'HVAC, Plumbing, Electrical/Locks, Carpentry vs prev. period.', 'التكييف والسباكة والكهرباء والنجارة.')}
                  </p>
                </div>
              </div>

              {snapshot.failuresByTrade.length > 0 ? (
                <div className="space-y-3">
                  {snapshot.failuresByTrade.map((tr) => (
                    <div
                      key={tr.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/[0.05] dark:bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {tr.label[language] || tr.label.fr}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                          {tr.count}{' '}
                          <span className="font-normal text-slate-500 dark:text-[#8E8E98]">
                            ({t('N-1', 'Prev', 'السابق')}: {tr.prevCount})
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
                        {tr.openCount > 0 && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-[#FFA84B]">
                            {tr.openCount} {t('en cours', 'open', 'قيد المعالجة')}
                          </span>
                        )}
                        {tr.urgentCount > 0 && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-[#FF7369]">
                            {tr.urgentCount} {t('urgentes', 'urgent', 'عاجلة')}
                          </span>
                        )}
                        {tr.sampleRooms.length > 0 && (
                          <span className="text-slate-500 dark:text-[#8E8E98]">
                            {tr.sampleRooms.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-4 text-xs font-medium text-emerald-700 dark:text-[#67C380]">
                  <CheckCircle2 size={16} />
                  {t('Aucune panne technique enregistrée sur la période.', 'No technical failures recorded in this period.', 'لا توجد أعطال تقنية مسجلة.')}
                </div>
              )}

              {/* Recurring Risk Rooms */}
              <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <ShieldAlert size={15} className="text-rose-500 dark:text-[#FF7369]" />
                  <span>{t('Chambres à surveiller (risque récurrent)', 'Recurring Risk Rooms', 'غرف تتطلب مراقبة وقائية')}</span>
                </div>
                {snapshot.recurringRiskRooms.length > 0 ? (
                  <div className="space-y-2">
                    {snapshot.recurringRiskRooms.slice(0, 5).map((rr) => (
                      <div
                        key={rr.roomKey}
                        className="rounded-xl border border-rose-200/70 bg-rose-50/50 px-3 py-2 text-xs dark:border-[#FF7369]/25 dark:bg-[#FF7369]/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{rr.roomLabel}</span>
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums dark:bg-[#FF7369] dark:text-[#141416]">
                            {rr.riskLevel === 'high' ? t('Risque élevé', 'High risk', 'خطر مرتفع') : t('À inspecter', 'Watch', 'للمتابعة')}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600 dark:text-[#D4D4DC]">
                          {rr.reasons.join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Aucune chambre en récurrence de pannes.', 'No rooms with recurring issues.', 'لا توجد غرف بأعطال متكررة.')}
                  </p>
                )}
              </div>
            </section>

            {/* Complaints, Guest Alerts & Forgotten Items */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-4">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <MessageSquareWarning size={18} className="shrink-0 text-rose-500 dark:text-[#FF7369]" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                      {t('Doléances, alertes & incidents', 'Complaints, Alerts & Incidents', 'الشكاوى والتنبيهات والحوادث')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                      {t('Retours clients, erreurs serrures & objets consignés.', 'Guest alerts, lock errors & stored lost items.', 'تنبيهات النزلاء وأخطاء الأقفال والمفقودات.')}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800 tabular-nums dark:bg-white/[0.08] dark:text-white">
                  {snapshot.complaintsAndAlerts.length}
                </span>
              </div>

              <div className="max-h-80 space-y-2.5 overflow-y-auto pe-1">
                {snapshot.complaintsAndAlerts.slice(0, 12).map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      c.severity === 'high'
                        ? 'border-rose-200/80 bg-rose-50/70 dark:border-[#FF7369]/30 dark:bg-[#FF7369]/10'
                        : c.severity === 'medium'
                        ? 'border-amber-200/80 bg-amber-50/60 dark:border-[#FFA84B]/25 dark:bg-[#FFA84B]/10'
                        : 'border-slate-200/80 bg-slate-50/70 dark:border-white/[0.06] dark:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-slate-900 dark:text-white">
                        {c.roomName} · {c.guestName}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                        {c.date}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-700 dark:text-[#D4D4DC]">{c.text}</p>
                  </div>
                ))}
                {!snapshot.complaintsAndAlerts.length && (
                  <div className="flex items-center gap-2 py-8 text-xs font-medium text-emerald-700 dark:text-[#67C380]">
                    <CheckCircle2 size={16} />
                    {t('Aucune doléance ni alerte client sur la période.', 'No complaints or guest alerts in this period.', 'لا توجد شكاوى أو تنبيهات للنزلاء.')}
                  </div>
                )}
              </div>
            </section>

            {/* Stock Runway Prevention */}
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-[#1E1E22] dark:shadow-none sm:p-6 xl:col-span-3">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
                <AlertTriangle size={18} className="shrink-0 text-amber-500 dark:text-[#FFA84B]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F6]">
                    {t('Prévention ruptures stock', 'Stockout Prevention', 'توقعات نفاذ المخزون')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#8E8E98]">
                    {t('Autonomie estimée (j)', 'Estimated days left', 'الأيام المتبقية')}
                  </p>
                </div>
              </div>

              <div className="max-h-80 space-y-2.5 overflow-y-auto pe-1">
                {snapshot.stockRunway.slice(0, 8).map((sr) => (
                  <div
                    key={sr.itemId}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      sr.riskLevel === 'critical'
                        ? 'border-rose-200/80 bg-rose-50/70 dark:border-[#FF7369]/30 dark:bg-[#FF7369]/10'
                        : sr.riskLevel === 'warning'
                        ? 'border-amber-200/80 bg-amber-50/60 dark:border-[#FFA84B]/25 dark:bg-[#FFA84B]/10'
                        : 'border-slate-100 bg-slate-50/60 dark:border-white/[0.05] dark:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-slate-900 dark:text-white">{sr.name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-white">
                        {sr.daysRemaining !== null ? `${sr.daysRemaining}j` : `${sr.quantity} ${sr.unit}`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 tabular-nums dark:text-[#8E8E98]">
                      <span>
                        {sr.quantity}/{sr.minThreshold} {sr.unit}
                      </span>
                      <span>
                        {sr.avgDailyBurn > 0 ? `-${sr.avgDailyBurn}/${t('j', 'd', 'ي')}` : sr.category}
                      </span>
                    </div>
                  </div>
                ))}
                {!snapshot.stockRunway.length && (
                  <div className="flex items-center gap-2 py-8 text-xs font-medium text-emerald-700 dark:text-[#67C380]">
                    <CheckCircle2 size={16} />
                    {t('Tous les stocks sont confortables.', 'All stock levels are healthy.', 'جميع مستويات المخزون آمنة.')}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* SECTION 6: FACTURATION & MOUVEMENTS DE STOCK + MODULES */}
        {showBillingStock && (
          <>
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
                      {t('Valeur', 'Value', 'القيمة')}: {fmtMoney(stockValue, 'DZD')} · {lowStock.length}{' '}
                      {t('sous seuil', 'low stock', 'تحت الحد')}
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
                        <div className="shrink-0 text-end text-sm font-bold text-amber-700 tabular-nums dark:text-[#FFA84B]">
                          {item.quantity} {item.unit}
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

            {/* External / Non-centralized Modules Transparency */}
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
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[11px] text-slate-400 dark:text-[#6E6E78]">
          <span>
            {t(
              'Source : réservations, chambres & étages, tâches PMS, mouvements de stock, journal d’audit et facturation locale.',
              'Sources: bookings, rooms & floors, PMS tasks, stock movements, audit logs and local billing documents.',
              'المصادر: الحجوزات والغرف والطوابق ومهام النظام وحركات المخزون وسجل الأحداث والفوترة المحلية.'
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
