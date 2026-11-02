import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Bed,
  Stethoscope,
  Sparkles,
  Calendar,
  Globe,
  User,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  X,
  Maximize2,
  Minimize2,
  ChevronsLeft,
  ChevronsRight,
  MoveLeft,
  MoveRight,
  SlidersHorizontal,
  CalendarDays,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ResourceGroup, ResourceItem, TimelineBooking, BookingStatus } from '../types/booking';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';
import { useTimelineSync } from '../hooks/useTimelineSync';

export const PlanningTimeline: React.FC = () => {
  const {
    language,
    currentBaseDate,
    setCurrentBaseDate,
    dateRangeMode,
    bookings,
    searchQuery,
    currentDomain,
    currentRole,
    resourceGroups,
    setSelectedBooking,
    setIsNewBookingModalOpen,
    setNewBookingInitialSlot,
    updateBookingStatus,
    selectedEstablishmentId,
    setSelectedEstablishmentId,
    establishments,
    currency,
  } = useApp();

  const isRTL = language === 'ar';
  const [showAvailabilityHelp, setShowAvailabilityHelp] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPanRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const onTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button,a,input,select,textarea,[role="button"],[data-booking-card="true"]')) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    dragPanRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  // Mouse drag pans horizontally only. Vertical movement remains native mouse-wheel scrolling.
  const onTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragPanRef.current;
    const el = scrollContainerRef.current;
    if (!d || !el || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) < 4) return;
    d.moved = true;
    suppressClickRef.current = true;
    e.preventDefault();
    el.scrollLeft = d.left - dx;
  };
  const onTimelinePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragPanRef.current;
    const el = scrollContainerRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragPanRef.current = null;
    if (d.moved) window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  };
  const onTimelineClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  };


  // Persist the user's last selected density and day-column width.
  const [columnZoomMode, setColumnZoomMode] = useState<'compact' | 'standard' | 'wide'>(() => {
    if (typeof window === 'undefined') return 'standard';
    const saved = window.localStorage.getItem('appointment.gantt.columnZoom');
    return saved === 'compact' || saved === 'wide' || saved === 'standard' ? saved : window.innerWidth < 768 ? 'compact' : 'standard';
  });
  const [leftBarMode, setLeftBarMode] = useState<'normal' | 'compact' | 'mini'>(() => {
    if (typeof window === 'undefined') return 'normal';
    const saved = window.localStorage.getItem('appointment.gantt.leftDensity');
    return saved === 'mini' || saved === 'compact' || saved === 'normal' ? saved : window.innerWidth < 768 ? 'compact' : 'normal';
  });
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isDayHeaderCollapsed, setIsDayHeaderCollapsed] = useState(false);
  useEffect(() => { window.localStorage.setItem('appointment.gantt.columnZoom', columnZoomMode); }, [columnZoomMode]);
  useEffect(() => { window.localStorage.setItem('appointment.gantt.leftDensity', leftBarMode); }, [leftBarMode]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    setIsMobileScreen(media.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsMobileScreen(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  const handleTimelineScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setIsDayHeaderCollapsed(event.currentTarget.scrollTop > 48);
  };

  // Dynamic day column width adapted to viewport
  const colWidth = useMemo(() => {
    if (isMobileScreen) {
      // Narrow mode: reduce each day cell width by 50%.
      return columnZoomMode === 'compact' ? 32 : columnZoomMode === 'wide' ? 96 : 76;
    }
    return columnZoomMode === 'compact' ? 38 : columnZoomMode === 'wide' ? 144 : 112;
  }, [columnZoomMode, isMobileScreen]);

  // Keep enough height for both weekday and date labels; collapse only after vertical scrolling.
  const dayHeaderHeightClass = isDayHeaderCollapsed
    ? 'h-9 min-h-[36px] max-h-[36px]'
    : columnZoomMode === 'compact'
      ? 'h-12 min-h-[48px] max-h-[48px]'
      : 'h-16 md:h-20 min-h-[64px] md:min-h-[80px] max-h-[64px] md:max-h-[80px]';

  // Collapsed state for resource groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Hovered / selected booking for floating preview or mobile touch sheet
  const [activePreviewBooking, setActivePreviewBooking] = useState<{
    booking: TimelineBooking;
    x?: number;
    y?: number;
    isMobileSheet?: boolean;
  } | null>(null);

  // Keep the hover preview alive while the pointer travels from a booking bar to its card.
  const previewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPreviewClose = () => {
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  };
  const schedulePreviewClose = () => {
    cancelPreviewClose();
    previewCloseTimerRef.current = setTimeout(() => {
      setActivePreviewBooking(null);
      previewCloseTimerRef.current = null;
    }, 300);
  };
  useEffect(() => () => cancelPreviewClose(), []);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Smooth scroll helpers
  const scrollTimeline = (delta: number) => {
    if (scrollContainerRef.current) {
      const dirMultiplier = language === 'ar' ? -1 : 1;
      scrollContainerRef.current.scrollBy({ left: delta * dirMultiplier, behavior: 'smooth' });
    }
  };

  const scrollToToday = () => {
    if (timelineSync.isTodayInRange) {
      timelineSync.scrollToNow();
    } else {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const targetBaseStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      setCurrentBaseDate(targetBaseStr);
      setTimeout(() => {
        timelineSync.scrollToNow();
      }, 80);
    }
  };

  // In narrow mode, show the complete calendar month instead of the 14-day range.
  const [baseYear, baseMonth] = currentBaseDate.split('-').map(Number);
  const timelineBaseDate = columnZoomMode === 'compact'
    ? `${baseYear}-${String(baseMonth).padStart(2, '0')}-01`
    : currentBaseDate;
  const totalDays = columnZoomMode === 'compact'
    ? new Date(baseYear, baseMonth, 0).getDate()
    : dateRangeMode === 'two_weeks' ? 14 : 28;

  // Global Timeline Sync Hook: observes date state changes globally to keep
  // the 'current time' red line and 'today' view header perfectly synchronized.
  const timelineSync = useTimelineSync({
    currentBaseDate: timelineBaseDate,
    totalDays,
    colWidth,
    scrollContainerRef,
    language,
    direction: language === 'ar' ? 'rtl' : 'ltr',
  });

  const timelineDays = useMemo(() => {
    const [y, m, d] = timelineBaseDate.split('-').map(Number);
    const dates: { dateStr: string; dayNum: number; dayName: string; isWeekend: boolean; isToday: boolean }[] = [];

    const realTodayStr = timelineSync.todayDateStr;

    const dayFormatter = new Intl.DateTimeFormat(
      language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US',
      { weekday: 'short' }
    );

    for (let i = 0; i < totalDays; i++) {
      const cur = new Date(y, m - 1, d);
      cur.setDate(cur.getDate() + i);
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(
        cur.getDate()
      ).padStart(2, '0')}`;

      const dayOfWeek = cur.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Real check against actual current calendar day
      const isToday = iso === realTodayStr;

      dates.push({
        dateStr: iso,
        dayNum: cur.getDate(),
        dayName: dayFormatter.format(cur),
        isWeekend,
        isToday,
      });
    }
    return dates;
  }, [timelineBaseDate, totalDays, language, timelineSync.todayDateStr]);

  const todayIndex = timelineSync.todayIndex;
  const currentTimeStr = timelineSync.currentTimeStr;
  const currentHourFraction = timelineSync.currentHourFraction;

  // Filter resource groups strictly by currentDomain (NEVER MIX) & searchQuery & establishment
  const filteredGroups = useMemo(() => {
    const groups = resourceGroups;
    return groups
      .filter((grp) => grp.sector === currentDomain)
      .map((grp) => {
        let matchingResources = grp.resources;
        if (currentDomain === 'hotel' && selectedEstablishmentId !== 'all') {
          matchingResources = matchingResources.filter(
            (r) => !r.establishmentId || r.establishmentId === selectedEstablishmentId
          );
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          matchingResources = matchingResources.filter(
            (r) =>
              r.name.toLowerCase().includes(q) ||
              r.type.toLowerCase().includes(q) ||
              bookings.some(
                (b) =>
                  b.resourceId === r.id &&
                  (b.guestName.toLowerCase().includes(q) || b.guestEmail.toLowerCase().includes(q))
              )
          );
        }
        return {
          ...grp,
          resources: matchingResources,
        };
      })
      .filter((grp) => grp.resources.length > 0);
  }, [currentDomain, resourceGroups, searchQuery, bookings, selectedEstablishmentId]);

  // Calculate day-by-day availability per group
  const groupAvailability = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};

    filteredGroups.forEach((grp) => {
      map[grp.id] = {};
      const totalInGrp = grp.resources.length;

      timelineDays.forEach((day) => {
        // Count bookings on this day in this group
        const occupied = grp.resources.filter((res) => {
          return bookings.some(
            (b) =>
              b.resourceId === res.id &&
              b.status !== 'cancelled' &&
              b.startDate <= day.dateStr &&
              b.endDate > day.dateStr
          );
        }).length;

        map[grp.id][day.dateStr] = Math.max(0, totalInGrp - occupied);
      });
    });

    return map;
  }, [filteredGroups, timelineDays, bookings]);

  // Get index of date in timelineDays
  const getDateIndex = (dateStr: string) => {
    return timelineDays.findIndex((d) => d.dateStr === dateStr);
  };

  // Housekeeping tag badge
  const renderHousekeepingTag = (status?: string) => {
    switch (status) {
      case 'clean':
        return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Propre / Clean" />;
      case 'cleaning':
        return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="En cours de nettoyage / Cleaning" />;
      case 'dirty':
        return <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="À nettoyer / Dirty" />;
      case 'out_of_order':
        return <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title="Hors service / Out of order" />;
      default:
        return null;
    }
  };

  const getSectorIcon = (sector: string) => {
    switch (sector) {
      case 'hotel':
        return <Bed size={14} className="text-blue-500 shrink-0" />;
      case 'clinic':
        return <Stethoscope size={14} className="text-emerald-500 shrink-0" />;
      default:
        return <Sparkles size={14} className="text-purple-500 shrink-0" />;
    }
  };

  // Left column width classes
  const leftColWidthClass = useMemo(() => {
    if (leftBarMode === 'mini') return 'w-12 sm:w-16';
    if (leftBarMode === 'compact') return 'w-28 sm:w-32';
    return 'w-44 sm:w-56 md:w-64';
  }, [leftBarMode]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 relative select-none">
      {/* Responsive Toolbar */}
      <div className="w-full min-w-0 min-h-10 py-2 px-2 md:py-1.5 md:px-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-1.5 bg-slate-50 dark:bg-slate-900 select-none text-xs shrink-0">
        {/* Left Column Mode Toggle: Normal / Compact / Mini */}
        <div className="w-full sm:w-auto grid grid-cols-[auto_minmax(0,1fr)] sm:flex sm:flex-row sm:items-center gap-2 sm:gap-1 min-w-0">
          <div className="w-fit max-w-full flex items-center justify-start bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setLeftBarMode('mini')}
              className={`min-h-9 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                leftBarMode === 'mini'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Mini (Icônes seules, gain max timeline)"
            >
              Mini
            </button>
            <button
              onClick={() => setLeftBarMode('compact')}
              className={`min-h-9 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                leftBarMode === 'compact'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Compact"
            >
              Compact
            </button>
            <button
              onClick={() => setLeftBarMode('normal')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors hidden sm:block ${
                leftBarMode === 'normal'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Complet (Largeur max)"
            >
              Complet
            </button>
          </div>

          {/* Hotel Establishment Switcher (ADEF Centre-ville / ADEF Plage) */}
          {currentDomain === 'hotel' && (
            <div className="w-full sm:w-auto flex items-center gap-1.5 sm:ml-1 min-w-0">
              <select
                value={selectedEstablishmentId}
                onChange={(e) => setSelectedEstablishmentId(e.target.value)}
                className="w-full min-w-0 h-9 px-2 py-1 text-[10px] sm:text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
              >
                <option value="all">🏨 {language === 'fr' ? 'Tous les complexes ADEF' : 'All ADEF Hotels'}</option>
                {establishments.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} – {h.name} ({'★'.repeat(h.stars)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Center / Right controls: Zoom & Fast Date Navigation */}
        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-1.5 sm:gap-1.5 sm:ml-auto min-w-0">
          {/* Quick Date Jump Input */}
          <div className="col-span-2 sm:col-span-1 min-w-0 w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 sm:px-2 h-9 sm:h-auto py-1 sm:py-0.5">
            <CalendarDays size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={currentBaseDate}
              onChange={(e) => {
                if (e.target.value) setCurrentBaseDate(e.target.value);
              }}
              className="w-full min-w-0 text-[10px] sm:text-[11px] font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              title="Aller directement à une date"
            />
          </div>

          {/* Day Column Zoom Selector */}
          <div className="w-full sm:w-auto flex items-center justify-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold h-9 sm:h-auto">
            <button
              onClick={() => setColumnZoomMode('compact')}
              className={`flex-1 min-h-8 px-2 py-1 rounded transition-colors ${
                columnZoomMode === 'compact'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Zoom Étroit (Voir plus de jours)"
            >
              Étroit
            </button>
            <button
              onClick={() => setColumnZoomMode('standard')}
              className={`flex-1 min-h-8 px-2 py-1 rounded transition-colors ${
                columnZoomMode === 'standard'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Zoom Normal"
            >
              Normal
            </button>
            <button
              onClick={() => setColumnZoomMode('wide')}
              className={`px-2 py-0.5 rounded transition-colors hidden md:block ${
                columnZoomMode === 'wide'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Zoom Large"
            >
              Large
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAvailabilityHelp(true)}
            className="min-h-9 px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors text-[10px] sm:text-[11px] font-semibold whitespace-nowrap"
            title={language === 'fr' ? 'Comprendre les chiffres de disponibilité' : language === 'ar' ? 'فهم أرقام التوفر' : 'Understand availability numbers'}
          >
            <Info size={14} />
            {language === 'fr' ? 'Disponibilités ?' : language === 'ar' ? 'التوفر ؟' : 'Availability?'}
          </button>

          {/* Horizontal scroll navigation buttons */}
          <div className="w-full sm:w-auto flex items-center justify-center gap-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-white dark:bg-slate-800 h-9 sm:h-auto">
            <button
              onClick={() => scrollTimeline(-colWidth * 2)}
              className="min-w-8 min-h-8 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
              title="Reculer de 2 jours"
            >
              <MoveLeft size={13} />
            </button>
            <button
              onClick={scrollToToday}
              className="min-h-8 px-2 py-1 text-[10px] sm:text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded transition-colors whitespace-nowrap"
              title="Aller à Aujourd'hui"
            >
              {language === 'fr' ? 'Aujourd\'hui' : language === 'ar' ? 'اليوم' : 'Today'}
            </button>
            <button
              onClick={() => scrollTimeline(colWidth * 2)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
              title="Avancer de 2 jours"
            >
              <MoveRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {showAvailabilityHelp && (
        <div
          className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAvailabilityHelp(false);
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-help-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                  <CalendarDays size={21} />
                </span>
                <div>
                  <h2 id="availability-help-title" className="text-base font-bold text-slate-900 dark:text-white">
                    {language === 'fr' ? 'Comprendre les disponibilités' : language === 'ar' ? 'فهم أرقام التوفر' : 'Understanding availability'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'fr' ? 'Les chiffres affichés au-dessus des chambres' : language === 'ar' ? 'الأرقام المعروضة فوق الغرف' : 'Numbers displayed above the rooms'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAvailabilityHelp(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {language === 'fr'
                ? 'Chaque chiffre indique combien de chambres ou d’unités restent disponibles dans ce groupe pour la date correspondante. Le calcul tient compte des réservations actives.'
                : language === 'ar'
                  ? 'كل رقم يوضح عدد الغرف أو الوحدات المتبقية والمتاحة في هذه المجموعة في التاريخ المحدد، بعد احتساب الحجوزات النشطة.'
                  : 'Each number shows how many rooms or units remain available in this group on that date, after counting active bookings.'}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-8 h-7 items-center justify-center rounded bg-emerald-600 text-white text-sm font-bold font-mono">5</span>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{language === 'fr' ? 'Vert' : language === 'ar' ? 'أخضر' : 'Green'}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {language === 'fr' ? '5 unités encore disponibles.' : language === 'ar' ? '5 وحدات لا تزال متاحة.' : '5 units are still available.'}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-8 h-7 items-center justify-center rounded bg-rose-600 text-white text-sm font-bold font-mono">0</span>
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300">{language === 'fr' ? 'Rouge' : language === 'ar' ? 'أحمر' : 'Red'}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {language === 'fr' ? 'Aucune unité disponible : tout est réservé.' : language === 'ar' ? 'لا توجد وحدات متاحة، جميعها محجوزة.' : 'No units available; all are booked.'}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {language === 'fr'
                ? 'Exemple : si le groupe contient 8 chambres et que 3 sont occupées ce jour-là, le chiffre affiché sera 5. Ce chiffre n’est ni un numéro de chambre ni un numéro de réservation.'
                : language === 'ar'
                  ? 'مثال: إذا كانت المجموعة تضم 8 غرف وكانت 3 مشغولة في ذلك اليوم، فسيظهر الرقم 5. هذا ليس رقم غرفة ولا رقم حجز.'
                  : 'Example: if the group has 8 rooms and 3 are occupied that day, the displayed number is 5. It is not a room number or a booking number.'}
            </p>

            <button type="button" onClick={() => setShowAvailabilityHelp(false)} className="mt-5 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold transition-colors">
              {language === 'fr' ? 'J’ai compris' : language === 'ar' ? 'فهمت' : 'Got it'}
            </button>
          </section>
        </div>
      )}

      {/* Subtle 'Today' pill indicator anchored to the top of the scrollable timeline container, remains visible even when scrolling horizontally */}
      {timelineSync.isTodayInRange && (
        <button
          type="button"
          onClick={scrollToToday}
          className="absolute top-[168px] sm:top-15 right-2 sm:right-6 z-40 px-3 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-slate-900/95 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/70 shadow-md backdrop-blur-md flex items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-all cursor-pointer select-none active:scale-95 group"
          title={language === 'fr' ? 'Centrer la vue sur Aujourd’hui' : language === 'ar' ? 'الانتقال إلى اليوم' : 'Scroll to Today'}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          <span className="font-bold tracking-tight">
            {language === 'fr' ? 'Aujourd’hui' : language === 'ar' ? 'اليوم' : 'Today'}
          </span>
          <span className="text-[11px] font-mono opacity-85 tabular-nums">
            {timelineSync.currentTimeStr}
          </span>
          <Clock size={12} className="opacity-60 group-hover:scale-110 transition-transform shrink-0" />
        </button>
      )}

      {/* Main Gantt Matrix: Left Sticky Resource Tree + Right Scrollable Day Matrix */}
      <div
        ref={scrollContainerRef}
        onPointerDown={onTimelinePointerDown}
        onPointerMove={onTimelinePointerMove}
        onPointerUp={onTimelinePointerEnd}
        onPointerCancel={onTimelinePointerEnd}
        onClickCapture={onTimelineClickCapture}
        onScroll={handleTimelineScroll}
        data-gantt-pan="true"
        className="flex-1 min-h-0 min-w-0 overflow-auto overscroll-contain flex scroll-smooth touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* LEFT COLUMN: Resource Tree */}
        <div
          className={`${leftColWidthClass} shrink-0 ${
            isRTL ? 'border-l sticky right-0' : 'border-r sticky left-0'
          } border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 z-[90] select-none shadow-xs transition-all duration-200 flex flex-col`}
        >
          {/* Header of Resources Column with STICKY TOP-0 */}
          <div className={`${dayHeaderHeightClass} shrink-0 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 flex flex-col justify-center bg-slate-100 dark:bg-slate-850 sticky top-0 z-[80] isolate transition-[height,min-height,max-height] duration-200`}>
            <span className="text-[11px] md:text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
              {leftBarMode === 'mini'
                ? 'Ress.'
                : currentDomain === 'hotel'
                ? (language === 'fr' ? 'Chambres & Suites' : language === 'ar' ? 'الغرف والأجنحة' : 'Rooms & Suites')
                : currentDomain === 'resort'
                ? (language === 'fr' ? 'Villas, Bungalows & Suites' : language === 'ar' ? 'فلل وشاليهات المنتجع' : 'Resort Villas & Bungalows')
                : (language === 'fr' ? 'Hébergements' : 'Accommodations')}
            </span>
            <span className={`${isDayHeaderCollapsed ? "hidden" : "block"} text-[9px] md:text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate mt-0.5`}>
              {currentDomain.toUpperCase()}
            </span>
          </div>

          {/* Resource Groups & Items */}
          <div className="flex flex-col">
            {filteredGroups.map((grp) => {
              const isCollapsed = collapsedGroups[grp.id];
              return (
                <div key={grp.id} className="flex flex-col">
                  {/* Group Header Row */}
                  <div
                    onClick={() => toggleGroup(grp.id)}
                    className="h-10 min-h-[40px] max-h-[40px] shrink-0 px-2 sm:px-2.5 bg-slate-200/80 dark:bg-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {isCollapsed ? <ChevronRight size={13} className="shrink-0 text-slate-500" /> : <ChevronDown size={13} className="shrink-0 text-slate-500" />}
                      {leftBarMode !== 'mini' && (
                        <span className="truncate text-[11px] sm:text-xs font-bold">
                          {grp.name[language] || grp.name.en}
                        </span>
                      )}
                    </div>
                    {getSectorIcon(grp.sector)}
                  </div>

                  {/* Resource Sub-Items */}
                  {!isCollapsed &&
                    grp.resources.map((res) => (
                      <div
                        key={res.id}
                        className="h-14 sm:h-12 min-h-[56px] sm:min-h-[48px] max-h-[56px] sm:max-h-[48px] shrink-0 px-1.5 sm:px-2.5 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                          {renderHousekeepingTag(res.housekeepingStatus)}
                          {leftBarMode !== 'mini' && (
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs sm:text-[13px]">
                              {res.name}
                            </span>
                          )}
                          {leftBarMode === 'mini' && (
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate">
                              {res.name.replace(/[^0-9]/g, '') || res.name.slice(0, 3)}
                            </span>
                          )}
                        </div>
                        {leftBarMode === 'normal' && (
                          <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0 hidden sm:inline">
                            {res.pricePerDay} {currency}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT AREA: Timeline Grid with Horizontal Scrolling */}
        <div className="flex-1 flex flex-col min-w-max relative">
          {/* Live Current Time Line Marker: Dynamic offset relative to timeline's scroll position and container width */}
          {timelineSync.isTodayInRange && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center transition-[left] duration-300"
              style={{
                left: `${timelineSync.absoluteGridX}px`,
                transform: 'translateX(-50%)',
              }}
            >
              {/* Floating Pill Time Badge */}
              <div className={`sticky ${isDayHeaderCollapsed ? "top-9" : "top-16 md:top-20"} -mt-3.5 z-40 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono text-white bg-rose-600 shadow-md shadow-rose-600/50 whitespace-nowrap flex items-center gap-1.5 border-2 border-white dark:border-slate-900 select-none`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{timelineSync.currentTimeStr}</span>
              </div>
              {/* Continuous vertical red line passing down through the whole grid */}
              <div className="w-0.5 flex-1 bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            </div>
          )}

          {/* Timeline Header: Days row + Availability badge */}
          <div className={`${dayHeaderHeightClass} shrink-0 border-b border-slate-200 dark:border-slate-800 flex bg-white dark:bg-slate-900 sticky top-0 z-[70] isolate select-none transition-[height,min-height,max-height] duration-200`}>
            {timelineDays.map((day) => (
              <div key={day.dateStr} style={{ width: `${colWidth}px` }} className={`shrink-0 border-r border-slate-200/70 dark:border-slate-800/70 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors relative h-full overflow-hidden ${day.isToday ? "bg-rose-50/40 dark:bg-rose-950/25 ring-1 ring-inset ring-rose-400/40" : day.isWeekend ? "bg-slate-50/50 dark:bg-slate-900/40" : ""}`}>
                {isDayHeaderCollapsed ? (
                  <span className={`text-[11px] font-bold tabular-nums ${day.isToday ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}`}>{day.dayNum}</span>
                ) : (
                  <>
                    <span className={`text-[10px] md:text-[11px] font-semibold uppercase tracking-wide ${day.isToday ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>{day.dayName}</span>
                    <span className={`text-sm md:text-base font-bold tabular-nums ${day.isToday ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100"}`}>{day.dayNum}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Resource Rows & Gantt Bars Matrix */}
          <div className="flex flex-col">
            {filteredGroups.map((grp) => {
              const isCollapsed = collapsedGroups[grp.id];

              return (
                <div key={grp.id} className="flex flex-col">
                  {/* Group Availability Row */}
                  <div className="h-10 min-h-[40px] max-h-[40px] shrink-0 flex bg-slate-200/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 select-none">
                    {timelineDays.map((day) => {
                      const avail = groupAvailability[grp.id]?.[day.dateStr] ?? 0;
                      const isFree = avail > 0;
                      return (
                        <div
                          key={day.dateStr}
                          style={{ width: `${colWidth}px` }}
                          className="shrink-0 border-r border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center p-1 h-full"
                        >
                          <span
                            className={`w-6 h-5 rounded text-[11px] font-bold font-mono flex items-center justify-center shadow-2xs tabular-nums ${
                              isFree ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}
                            title={`${avail} disponibilité(s) le ${day.dateStr}`}
                          >
                            {avail}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Individual Resource Rows */}
                  {!isCollapsed &&
                    grp.resources.map((res) => {
                      // Find bookings on this specific resource
                      const resBookings = bookings.filter((b) => b.resourceId === res.id);

                      return (
                        <div
                          key={res.id}
                          className="h-14 sm:h-12 min-h-[56px] sm:min-h-[48px] max-h-[56px] sm:max-h-[48px] shrink-0 flex relative border-b border-slate-200/80 dark:border-slate-800/80 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-colors bg-white dark:bg-slate-900"
                        >
                          {/* Background Grid Cells for clicking to add booking */}
                          {timelineDays.map((day) => (
                            <button
                              key={day.dateStr}
                              type="button"
                              style={{ width: `${colWidth}px` }}
                              onClick={() => {
                                setActivePreviewBooking(null);
                                setNewBookingInitialSlot({
                                  resourceId: res.id,
                                  date: day.dateStr,
                                });
                                setIsNewBookingModalOpen(true);
                              }}
                              aria-label={`Créer une réservation pour ${res.name} le ${day.dateStr}`}
                              title={`Créer une réservation • ${res.name} • ${day.dateStr}`}
                              className={`relative shrink-0 border-r border-slate-100 dark:border-slate-800/40 h-full cursor-pointer p-0 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 hover:bg-blue-50/70 dark:hover:bg-blue-950/35 active:bg-blue-100 dark:active:bg-blue-900/40 transition-colors ${
                                 day.isWeekend ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''
                               }`}
                             />
                          ))}

                          {/* Render Booking Gantt Bars overlaying the grid */}
                          {resBookings.map((bkg) => {
                            const firstVisibleDate = timelineDays[0]?.dateStr;
                            const lastVisibleDate = timelineDays[timelineDays.length - 1]?.dateStr;

                            // Skip if outside visible timeline range
                            if (bkg.endDate <= firstVisibleDate || bkg.startDate > lastVisibleDate) return null;

                            const startIndex = getDateIndex(bkg.startDate);
                            const endIndex = getDateIndex(bkg.endDate);

                            const visibleStart = startIndex === -1 ? 0 : startIndex;
                            const visibleEnd = endIndex === -1 ? totalDays : endIndex;

                            if (visibleEnd <= visibleStart) return null;

                            const daysSpan = visibleEnd - visibleStart;
                            const leftOffset = visibleStart * colWidth;
                            const barWidth = Math.max(daysSpan * colWidth - 6, 28);

                            const statusStyle = statusConfig[bkg.status] || statusConfig.confirmed;

                            const adults = bkg.adults ?? (bkg.customMetadata?.hotelAdults) ?? (bkg.customMetadata?.residenceOccupants) ?? 1;
                            const children = bkg.children ?? (bkg.customMetadata?.hotelChildren) ?? 0;
                            const occupantsCount = Math.max(1, adults + children);

                            // Detect if room has multiple active occupants: either > 1 guest in this booking
                            // OR overlapping active reservations on the same resource/room (shared room/dorm)
                            const overlappingBookings = resBookings.filter(
                              (other) =>
                                other.id !== bkg.id &&
                                other.status !== 'cancelled' &&
                                other.startDate < bkg.endDate &&
                                other.endDate > bkg.startDate
                            );
                            const hasMultipleOccupants = occupantsCount > 1 || overlappingBookings.length > 0;
                            const totalRoomGuests = occupantsCount + overlappingBookings.reduce((sum, b) => {
                              const a = b.adults ?? (b.customMetadata?.hotelAdults) ?? 1;
                              const c = b.children ?? (b.customMetadata?.hotelChildren) ?? 0;
                              return sum + a + c;
                            }, 0);

                            const isAlgerian = bkg.guestType === 'algerian' || bkg.nationality === 'Algérienne' || bkg.nationality === 'Algerian' || bkg.nationality === 'DZ';
                            const isForeigner = bkg.guestType === 'foreigner' || (!isAlgerian && !!bkg.nationality);
                            const nationalityBadge = isAlgerian ? '🇩🇿' : (isForeigner ? '🌐' : '');

                            const bookingCurrency = bkg.paymentCurrency || currency;
                            const currencySymbol = bookingCurrency === 'DA' || bookingCurrency === 'DZD' ? 'DA' : bookingCurrency === 'EUR' ? '€' : bookingCurrency === 'USD' ? '$' : bookingCurrency === 'RMB' ? '¥' : bookingCurrency === 'GBP' ? '£' : bookingCurrency === 'SAR' ? 'SAR' : bookingCurrency;
                            const displayPrice = bkg.originalCurrencyAmount || bkg.totalPrice;

                            const posStyle: React.CSSProperties = isRTL
                              ? { right: `${leftOffset + 3}px`, width: `${barWidth}px` }
                              : { left: `${leftOffset + 3}px`, width: `${barWidth}px` };

                            return (
                              <div
                                key={bkg.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMobileScreen) {
                                    setActivePreviewBooking({
                                      booking: bkg,
                                      isMobileSheet: true,
                                    });
                                  } else {
                                    setSelectedBooking(bkg);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  if (!isMobileScreen) {
                                    cancelPreviewClose();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActivePreviewBooking({
                                      booking: bkg,
                                      x: rect.left,
                                      y: rect.bottom + 6,
                                      isMobileSheet: false,
                                    });
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!isMobileScreen) schedulePreviewClose();
                                }}
                                style={posStyle}
                                className={`absolute top-2 sm:top-1.5 h-10 sm:h-9 rounded-md px-1.5 md:px-2 flex items-center justify-between cursor-pointer shadow-sm hover:brightness-105 active:scale-[0.98] transition-all z-10 border ${statusStyle.bg} ${statusStyle.border}`}
                              >
                                    <div className="flex items-center gap-1.5 truncate min-w-0">
                                      {/* Person icons: if multiple occupants occupy the room, render stacked group of person icons */}
                                      {hasMultipleOccupants ? (
                                        <div
                                          className="flex items-center -space-x-1.5 rtl:space-x-reverse shrink-0 select-none py-0.5"
                                          title={`${occupantsCount} occupant(s) pour cette réservation (${adults} adulte(s)${children > 0 ? `, ${children} enfant(s)` : ''})${
                                            overlappingBookings.length > 0
                                              ? ` • ${overlappingBookings.length} autre(s) réservation(s) active(s) dans cette même chambre (${totalRoomGuests} personnes au total)`
                                              : ''
                                          }`}
                                        >
                                          {/* First occupant icon */}
                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900/60 text-white ring-1 ring-white/50 shadow-2xs shrink-0">
                                            <User size={9} className="drop-shadow-2xs" />
                                          </span>
                                          {/* Second occupant icon (stacked cluster) */}
                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-slate-950 ring-1 ring-white/70 shadow-2xs shrink-0">
                                            <User size={9} className="font-bold" />
                                          </span>
                                          {/* Third or counter pill if > 2 occupants or co-occupancy */}
                                          {occupantsCount > 2 ? (
                                            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-slate-900/80 text-amber-300 text-[8px] font-bold font-mono ring-1 ring-white/40 shadow-2xs tabular-nums shrink-0">
                                              +{occupantsCount - 2}
                                            </span>
                                          ) : overlappingBookings.length > 0 ? (
                                            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[8px] font-bold font-mono ring-1 ring-white/50 shadow-2xs tabular-nums shrink-0" title="Chambre partagée / Multiple occupants">
                                              +{overlappingBookings.length}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div
                                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/25 text-white ring-1 ring-white/30 shrink-0 select-none"
                                          title="1 occupant (adulte)"
                                        >
                                          <User size={10} className="drop-shadow-2xs" />
                                        </div>
                                      )}

                                      {/* Nationality indicator */}
                                      {nationalityBadge && (
                                        <span className="text-[10px] shrink-0" title={isAlgerian ? 'Locataire Algérien (CNI)' : 'Locataire Étranger (Devises / Passeport)'}>
                                          {nationalityBadge}
                                        </span>
                                      )}

                                      <span className="text-[10px] md:text-[11px] font-semibold truncate tracking-tight">
                                        {bkg.guestName}
                                      </span>
                                    </div>
                                    <span className="text-[9px] md:text-[10px] opacity-90 font-mono shrink-0 ml-1 hidden sm:inline tabular-nums">
                                      {displayPrice} {currencySymbol}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Floating Tooltip Card for Desktop */}
          {activePreviewBooking && !activePreviewBooking.isMobileSheet && activePreviewBooking.x !== undefined && (
            <div
              style={{
                position: 'fixed',
                left: `${Math.min(window.innerWidth - 270, Math.max(10, activePreviewBooking.x))}px`,
                top: `${Math.min(window.innerHeight - 250, activePreviewBooking.y ?? 100)}px`,
              }}
              className="w-68 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 z-50 text-xs animate-in fade-in zoom-in-95 pointer-events-auto"
              onMouseEnter={cancelPreviewClose}
              onMouseLeave={schedulePreviewClose}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {activePreviewBooking.booking.resourceName}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    statusConfig[activePreviewBooking.booking.status]?.pillBg
                  }`}
                >
                  {statusConfig[activePreviewBooking.booking.status]?.label[language] ||
                    activePreviewBooking.booking.status}
                </span>
              </div>

              <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Locataire :</span>
                  <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 truncate">
                    <span>{activePreviewBooking.booking.guestType === 'algerian' ? '🇩🇿' : '🌐'}</span>
                    <span className="truncate">{activePreviewBooking.booking.guestName}</span>
                  </div>
                </div>

                {/* Occupants count with icons */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Occupants :</span>
                  <div className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                    <div className="flex items-center -space-x-1">
                      {Array.from({
                        length: Math.min(
                          (activePreviewBooking.booking.adults || 1) + (activePreviewBooking.booking.children || 0),
                          4
                        ),
                      }).map((_, i) => (
                        <User key={i} size={11} className={i > 0 ? 'text-amber-400' : 'text-blue-500'} />
                      ))}
                    </div>
                    <span>
                      {(activePreviewBooking.booking.adults || 1) + (activePreviewBooking.booking.children || 0)} pers.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-400 font-sans">Dates :</span>
                  <span>
                    {activePreviewBooking.booking.startDate} → {activePreviewBooking.booking.endDate}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Règlement :</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-xs tabular-nums">
                    {activePreviewBooking.booking.originalCurrencyAmount || activePreviewBooking.booking.totalPrice}{' '}
                    {activePreviewBooking.booking.paymentCurrency || currency}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setSelectedBooking(activePreviewBooking.booking);
                    setActivePreviewBooking(null);
                  }}
                  className="flex-1 py-1 bg-blue-600 text-white rounded text-center font-medium hover:bg-blue-700 transition-colors"
                >
                  Fiche & Police
                </button>
                <button
                  onClick={() => {
                    downloadICS(activePreviewBooking.booking);
                  }}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded transition-colors"
                  title="Exporter .ICS"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Mobile Touch Action Sheet for Smartphone Tap */}
          {activePreviewBooking && activePreviewBooking.isMobileSheet && (
            <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-2xs flex items-end justify-center p-0 sm:p-4">
              <div className="w-full sm:max-w-md max-h-[88dvh] overflow-y-auto bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl space-y-3 animate-in slide-in-from-bottom-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {activePreviewBooking.booking.resourceName}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        statusConfig[activePreviewBooking.booking.status]?.pillBg
                      }`}
                    >
                      {statusConfig[activePreviewBooking.booking.status]?.label[language] ||
                        activePreviewBooking.booking.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setActivePreviewBooking(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Locataire :</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {activePreviewBooking.booking.guestType === 'algerian' ? '🇩🇿 ' : '🌐 '}
                      {activePreviewBooking.booking.guestName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Règlement :</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 block tabular-nums">
                      {activePreviewBooking.booking.originalCurrencyAmount || activePreviewBooking.booking.totalPrice}{' '}
                      {activePreviewBooking.booking.paymentCurrency || currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Arrivée :</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 block">
                      {activePreviewBooking.booking.startDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Départ :</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 block">
                      {activePreviewBooking.booking.endDate}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Occupants chambre :</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(activePreviewBooking.booking.adults || 1) + (activePreviewBooking.booking.children || 0)} pers. ({activePreviewBooking.booking.adults || 1} adultes)
                    </span>
                  </div>
                </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedBooking(activePreviewBooking.booking);
                  setActivePreviewBooking(null);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-xs"
              >
                Ouvrir la Fiche Réservation
              </button>
              <button
                onClick={() => {
                  downloadICS(activePreviewBooking.booking);
                }}
                className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                title="Exporter .ICS"
              >
                <Download size={14} />
                <span>.ICS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
