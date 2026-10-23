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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { initialResourceGroups } from '../data/mockData';
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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Responsive mode: compact (phone), standard, or wide
  const [columnZoomMode, setColumnZoomMode] = useState<'compact' | 'standard' | 'wide'>('standard');
  const [leftBarMode, setLeftBarMode] = useState<'normal' | 'compact' | 'mini'>('normal');
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Detect small screen on mount & resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 640;
      setIsMobileScreen(isMobile);
      if (isMobile && leftBarMode === 'normal') {
        setLeftBarMode('compact');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dynamic day column width adapted to viewport
  const colWidth = useMemo(() => {
    if (isMobileScreen) {
      return columnZoomMode === 'compact' ? 62 : columnZoomMode === 'wide' ? 120 : 88;
    }
    return columnZoomMode === 'compact' ? 76 : columnZoomMode === 'wide' ? 144 : 112;
  }, [columnZoomMode, isMobileScreen]);

  // Collapsed state for resource groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Hovered / selected booking for floating preview or mobile touch sheet
  const [activePreviewBooking, setActivePreviewBooking] = useState<{
    booking: TimelineBooking;
    x?: number;
    y?: number;
    isMobileSheet?: boolean;
  } | null>(null);

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

  // Generate date list based on currentBaseDate & mode
  const totalDays = dateRangeMode === 'two_weeks' ? 14 : 28;

  // Global Timeline Sync Hook: observes date state changes globally to keep
  // the 'current time' red line and 'today' view header perfectly synchronized.
  const timelineSync = useTimelineSync({
    currentBaseDate,
    totalDays,
    colWidth,
    scrollContainerRef,
    language,
    direction: language === 'ar' ? 'rtl' : 'ltr',
  });

  const timelineDays = useMemo(() => {
    const [y, m, d] = currentBaseDate.split('-').map(Number);
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
  }, [currentBaseDate, totalDays, language, timelineSync.todayDateStr]);

  const todayIndex = timelineSync.todayIndex;
  const currentTimeStr = timelineSync.currentTimeStr;
  const currentHourFraction = timelineSync.currentHourFraction;

  // Filter resource groups strictly by currentDomain (NEVER MIX) & searchQuery & establishment
  const filteredGroups = useMemo(() => {
    const groups = resourceGroups.length > 0 ? resourceGroups : initialResourceGroups;
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
    if (leftBarMode === 'compact') return 'w-24 sm:w-32';
    return 'w-44 sm:w-56 md:w-64';
  }, [leftBarMode]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 relative select-none">
      {/* Responsive Toolbar */}
      <div className="min-h-10 py-1.5 px-2 md:px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-slate-900 select-none text-xs shrink-0 flex-wrap">
        {/* Left Column Mode Toggle: Normal / Compact / Mini */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setLeftBarMode('mini')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
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
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
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
            <div className="flex items-center gap-1.5 ml-2">
              <select
                value={selectedEstablishmentId}
                onChange={(e) => setSelectedEstablishmentId(e.target.value)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
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
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          {/* Quick Date Jump Input */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5">
            <CalendarDays size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={currentBaseDate}
              onChange={(e) => {
                if (e.target.value) setCurrentBaseDate(e.target.value);
              }}
              className="text-[11px] font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer w-24 sm:w-28"
              title="Aller directement à une date"
            />
          </div>

          {/* Day Column Zoom Selector */}
          <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              onClick={() => setColumnZoomMode('compact')}
              className={`px-2 py-0.5 rounded transition-colors ${
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
              className={`px-2 py-0.5 rounded transition-colors ${
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

          {/* Horizontal scroll navigation buttons */}
          <div className="flex items-center gap-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-white dark:bg-slate-800">
            <button
              onClick={() => scrollTimeline(-colWidth * 2)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
              title="Reculer de 2 jours"
            >
              <MoveLeft size={13} />
            </button>
            <button
              onClick={scrollToToday}
              className="px-2 py-0.5 text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded transition-colors"
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

      {/* Main Gantt Matrix: Left Sticky Resource Tree + Right Scrollable Day Matrix */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto flex scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* LEFT COLUMN: Resource Tree */}
        <div
          className={`${leftColWidthClass} shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 sticky left-0 z-20 select-none shadow-xs transition-all duration-200 backdrop-blur-xs`}
        >
          {/* Header of Resources Column with STICKY TOP-0 */}
          <div className="h-16 md:h-20 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 flex flex-col justify-center bg-slate-100 dark:bg-slate-800 sticky top-0 left-0 z-30">
            <span className="text-[11px] md:text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
              {leftBarMode === 'mini'
                ? 'Ress.'
                : currentDomain === 'doctor'
                ? (language === 'fr' ? 'Médecins & Cabinets' : language === 'ar' ? 'الأطباء والعيادات' : 'Doctors & Practices')
                : currentDomain === 'clinic'
                ? (language === 'fr' ? 'Plateau Clinique & Soins' : language === 'ar' ? 'أقسام المصحة' : 'Clinic Units')
                : currentDomain === 'hotel'
                ? (language === 'fr' ? 'Chambres & Suites' : language === 'ar' ? 'الغرف والأجنحة' : 'Rooms & Suites')
                : currentDomain === 'restaurant'
                ? (language === 'fr' ? 'Plan de Salle & Tables' : language === 'ar' ? 'مخطط الصالة والطاولات' : 'Dining Tables')
                : (language === 'fr' ? 'Ressources' : 'Resources')}
            </span>
            <span className="text-[9px] md:text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate mt-0.5">
              {currentDomain.toUpperCase()}
            </span>
          </div>

          {/* Resource Groups & Items */}
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {filteredGroups.map((grp) => {
              const isCollapsed = collapsedGroups[grp.id];
              return (
                <div key={grp.id} className="text-xs">
                  {/* Group Header Row */}
                  <div
                    onClick={() => toggleGroup(grp.id)}
                    className="h-10 px-1.5 sm:px-2.5 bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-between cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {isCollapsed ? <ChevronRight size={13} className="shrink-0" /> : <ChevronDown size={13} className="shrink-0" />}
                      {leftBarMode !== 'mini' && (
                        <span className="truncate text-[11px] sm:text-xs">
                          {grp.name[language] || grp.name.en}
                        </span>
                      )}
                    </div>
                    {getSectorIcon(grp.sector)}
                  </div>

                  {/* Resource Sub-Items */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/40 bg-white dark:bg-slate-900">
                      {grp.resources.map((res) => (
                        <div
                          key={res.id}
                          className="h-12 px-1.5 sm:px-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {renderHousekeepingTag(res.housekeepingStatus)}
                            {leftBarMode !== 'mini' && (
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]">
                                {res.name}
                              </span>
                            )}
                            {leftBarMode === 'mini' && (
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[10px] truncate">
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
                  )}
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
              {/* Floating Pill Time Badge: Positioned at header-grid threshold (top-16 md:top-20 -mt-3.5) with live pulse */}
              <div className="sticky top-16 md:top-20 -mt-3.5 z-40 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono text-white bg-rose-600 shadow-md shadow-rose-600/50 whitespace-nowrap flex items-center gap-1.5 border-2 border-white dark:border-slate-900 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{timelineSync.currentTimeStr}</span>
              </div>
              {/* Continuous vertical red line passing down through the whole grid */}
              <div className="w-0.5 flex-1 bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            </div>
          )}

          {/* Timeline Header: Days row + Availability badge */}
          <div className="h-16 md:h-20 border-b border-slate-200 dark:border-slate-800 flex bg-white dark:bg-slate-900 sticky top-0 z-10 select-none">
            {timelineDays.map((day) => (
              <div
                key={day.dateStr}
                style={{ width: `${colWidth}px` }}
                className={`shrink-0 border-r border-slate-200/70 dark:border-slate-800/70 flex flex-col justify-between p-1 md:p-1.5 transition-colors relative ${
                  day.isToday
                    ? 'bg-rose-50/40 dark:bg-rose-950/25 ring-1 ring-inset ring-rose-400/40'
                    : day.isWeekend
                    ? 'bg-slate-50/50 dark:bg-slate-900/40'
                    : ''
                }`}
              >
                {/* Day status indicator: Simple icon indicating today in the table */}
                {day.isToday ? (
                  <div
                    className="flex items-center justify-center py-0.5"
                    title={`${language === 'fr' ? 'Aujourd’hui' : language === 'ar' ? 'اليوم' : 'Today'} • ${currentTimeStr}`}
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700/60 shadow-2xs">
                      <Clock size={12} className="animate-pulse" />
                    </span>
                  </div>
                ) : (
                  <div className="h-5" />
                )}

                {/* Day Number and Weekday */}
                <div className="flex items-baseline justify-between mt-auto">
                  <span
                    className={`text-xs md:text-sm font-bold tabular-nums ${
                      day.isToday ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  <span
                    className={`text-[9px] md:text-[10px] font-semibold uppercase ${
                      day.isToday ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {day.dayName}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resource Rows & Gantt Bars Matrix */}
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {filteredGroups.map((grp) => {
              const isCollapsed = collapsedGroups[grp.id];

              return (
                <div key={grp.id}>
                  {/* Group Availability Row */}
                  <div className="h-10 flex bg-slate-100/70 dark:bg-slate-850/50 border-b border-slate-200/50 dark:border-slate-800/50">
                    {timelineDays.map((day) => {
                      const avail = groupAvailability[grp.id]?.[day.dateStr] ?? 0;
                      const isFree = avail > 0;
                      return (
                        <div
                          key={day.dateStr}
                          style={{ width: `${colWidth}px` }}
                          className="shrink-0 border-r border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center p-1"
                        >
                          <span
                            className={`w-6 h-5 rounded text-[11px] font-bold font-mono flex items-center justify-center shadow-2xs tabular-nums ${
                              isFree ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
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
                          className="h-12 flex relative hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          {/* Background Grid Cells for clicking to add booking */}
                          {timelineDays.map((day) => (
                            <div
                              key={day.dateStr}
                              style={{ width: `${colWidth}px` }}
                              onClick={() => {
                                setNewBookingInitialSlot({
                                  resourceId: res.id,
                                  date: day.dateStr,
                                });
                                setIsNewBookingModalOpen(true);
                              }}
                              className={`shrink-0 border-r border-slate-100 dark:border-slate-800/40 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                                day.isWeekend ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''
                              }`}
                              title={`Cliquez pour réserver le ${day.dateStr}`}
                            />
                          ))}

                          {/* Render Booking Gantt Bars overlaying the grid */}
                          {resBookings.map((bkg) => {
                            const startIndex = getDateIndex(bkg.startDate);
                            const endIndex = getDateIndex(bkg.endDate);

                            // Skip if outside current visible range
                            if (endIndex === -1 && startIndex === -1) return null;

                            const visibleStart = Math.max(0, startIndex);
                            const visibleEnd =
                              endIndex === -1 ? totalDays : Math.min(totalDays, endIndex);

                            if (visibleEnd <= visibleStart) return null;

                            const daysSpan = visibleEnd - visibleStart;
                            const leftOffset = visibleStart * colWidth;
                            const barWidth = Math.max(daysSpan * colWidth - 6, 28);

                            const statusStyle = statusConfig[bkg.status] || statusConfig.confirmed;

                            const adults = bkg.adults ?? (bkg.customMetadata?.hotelAdults) ?? (bkg.customMetadata?.residenceOccupants) ?? 1;
                            const children = bkg.children ?? (bkg.customMetadata?.hotelChildren) ?? 0;
                            const occupantsCount = adults + children;

                            const isAlgerian = bkg.guestType === 'algerian' || bkg.nationality === 'Algérienne' || bkg.nationality === 'Algerian' || bkg.nationality === 'DZ';
                            const isForeigner = bkg.guestType === 'foreigner' || (!isAlgerian && !!bkg.nationality);
                            const nationalityBadge = isAlgerian ? '🇩🇿' : (isForeigner ? '🌐' : '');

                            const bookingCurrency = bkg.paymentCurrency || currency;
                            const currencySymbol = bookingCurrency === 'DA' || bookingCurrency === 'DZD' ? 'DA' : bookingCurrency === 'EUR' ? '€' : bookingCurrency === 'USD' ? '$' : bookingCurrency === 'RMB' ? '¥' : bookingCurrency === 'GBP' ? '£' : bookingCurrency === 'SAR' ? 'SAR' : bookingCurrency;
                            const displayPrice = bkg.originalCurrencyAmount || bkg.totalPrice;

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
                                  if (!isMobileScreen) {
                                    setActivePreviewBooking(null);
                                  }
                                }}
                                style={{
                                  left: `${leftOffset + 3}px`,
                                  width: `${barWidth}px`,
                                }}
                                    className={`absolute top-1.5 h-9 rounded-md px-1.5 md:px-2 flex items-center justify-between cursor-pointer shadow-sm hover:brightness-105 active:scale-[0.98] transition-all z-10 border ${statusStyle.bg} ${statusStyle.border}`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate min-w-0">
                                      {/* Person icons: if multiple occupants in the room, render multiple person icons */}
                                      <div
                                        className="flex items-center -space-x-1 shrink-0"
                                        title={`${occupantsCount} occupant(s) : ${adults} adulte(s)${children > 0 ? `, ${children} enfant(s)` : ''}`}
                                      >
                                        {Array.from({ length: Math.min(occupantsCount, 4) }).map((_, idx) => (
                                          <User
                                            key={idx}
                                            size={11}
                                            className={`shrink-0 ${
                                              idx > 0 ? 'opacity-90 text-amber-300' : 'opacity-100'
                                            }`}
                                          />
                                        ))}
                                        {occupantsCount > 4 && (
                                          <span className="text-[8px] font-bold font-mono pl-0.5">+{occupantsCount - 4}</span>
                                        )}
                                      </div>

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
              onMouseEnter={() => {}}
              onMouseLeave={() => setActivePreviewBooking(null)}
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
              <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom-5">
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
