import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { initialResourceGroups } from '../data/mockData';
import { ResourceGroup, ResourceItem, TimelineBooking, BookingStatus } from '../types/booking';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';

export const PlanningTimeline: React.FC = () => {
  const {
    language,
    currentBaseDate,
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
  } = useApp();

  // Collapsed state for resource groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Hovered booking for quick preview card
  const [hoveredBooking, setHoveredBooking] = useState<{
    booking: TimelineBooking;
    x: number;
    y: number;
  } | null>(null);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Generate date list based on currentBaseDate & mode
  const totalDays = dateRangeMode === 'two_weeks' ? 14 : 28;

  const timelineDays = useMemo(() => {
    const [y, m, d] = currentBaseDate.split('-').map(Number);
    const dates: { dateStr: string; dayNum: number; dayName: string; isWeekend: boolean; isToday: boolean }[] = [];

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

      // Base date Oct 27 considered "Today" in our demo simulation
      const isToday = i === 1;

      dates.push({
        dateStr: iso,
        dayNum: cur.getDate(),
        dayName: dayFormatter.format(cur),
        isWeekend,
        isToday,
      });
    }
    return dates;
  }, [currentBaseDate, totalDays, language]);

  // Filter resource groups strictly by currentDomain (NEVER MIX) & searchQuery
  const filteredGroups = useMemo(() => {
    const groups = resourceGroups.length > 0 ? resourceGroups : initialResourceGroups;
    return groups
      .filter((grp) => grp.sector === currentDomain)
      .map((grp) => {
        if (!searchQuery.trim()) return grp;
        const q = searchQuery.toLowerCase();
        const matchingResources = grp.resources.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            bookings.some(
              (b) =>
                b.resourceId === r.id &&
                (b.guestName.toLowerCase().includes(q) || b.guestEmail.toLowerCase().includes(q))
            )
        );
        return {
          ...grp,
          resources: matchingResources,
        };
      })
      .filter((grp) => grp.resources.length > 0);
  }, [currentDomain, resourceGroups, searchQuery, bookings]);

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
        return <span className="w-2 h-2 rounded-full bg-emerald-500" title="Propre / Clean" />;
      case 'cleaning':
        return <span className="w-2 h-2 rounded-full bg-amber-500" title="En cours de nettoyage / Cleaning" />;
      case 'dirty':
        return <span className="w-2 h-2 rounded-full bg-rose-500" title="À nettoyer / Dirty" />;
      case 'out_of_order':
        return <span className="w-2 h-2 rounded-full bg-slate-400" title="Hors service / Out of order" />;
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 relative">
      {/* Scrollable Container with horizontal scroll for days and vertical scroll for resources */}
      <div className="flex-1 overflow-auto flex">
        {/* LEFT COLUMN: Resource Tree */}
        <div className="w-56 md:w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 sticky left-0 z-20 select-none shadow-xs">
          {/* Header of Resources Column */}
          <div className="h-20 border-b border-slate-200 dark:border-slate-800 px-3 flex flex-col justify-center bg-slate-100 dark:bg-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
              {currentDomain === 'hotel'
                ? (language === 'fr' ? 'Chambres & Suites' : language === 'ar' ? 'الغرف والأجنحة' : 'Rooms & Suites')
                : currentDomain === 'residence'
                ? (language === 'fr' ? 'Logements & Villas' : language === 'ar' ? 'الشقق والفيلات' : 'Rentals & Villas')
                : currentDomain === 'restaurant'
                ? (language === 'fr' ? 'Plan de Salle & Tables' : language === 'ar' ? 'مخطط الصالة والطاولات' : 'Dining Tables')
                : currentDomain === 'clinic'
                ? (language === 'fr' ? 'Cabinets & Praticiens' : language === 'ar' ? 'العيادات والأطباء' : 'Doctor Cabinets')
                : currentDomain === 'administration'
                ? (language === 'fr' ? 'Guichets & Démarches' : language === 'ar' ? 'الشبابيك والمعاملات' : 'Service Desks')
                : (language === 'fr' ? 'Cabines & Soins' : language === 'ar' ? 'كابينات الاسترخاء' : 'Care Cabins')}
            </span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium truncate mt-0.5">
              {language === 'fr'
                ? `Domaine : ${currentDomain.toUpperCase()} · Rôle : ${currentRole}`
                : `Domain: ${currentDomain.toUpperCase()} · Role: ${currentRole}`}
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
                    className="h-10 px-3 bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-between cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      <span className="truncate">{grp.name[language] || grp.name.en}</span>
                    </div>
                    {getSectorIcon(grp.sector)}
                  </div>

                  {/* Resource Sub-Items */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/40 bg-white dark:bg-slate-900">
                      {grp.resources.map((res) => (
                        <div
                          key={res.id}
                          className="h-12 px-3 pl-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {renderHousekeepingTag(res.housekeepingStatus)}
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]">
                              {res.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                            {res.pricePerDay}€
                          </span>
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
        <div className="flex-1 flex flex-col min-w-max">
          {/* Timeline Header: Days row + Availability badge */}
          <div className="h-20 border-b border-slate-200 dark:border-slate-800 flex bg-white dark:bg-slate-900 sticky top-0 z-10 select-none">
            {timelineDays.map((day) => (
              <div
                key={day.dateStr}
                className={`w-28 shrink-0 border-r border-slate-200/70 dark:border-slate-800/70 flex flex-col justify-between p-1.5 transition-colors ${
                  day.isToday
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                    : day.isWeekend
                    ? 'bg-slate-50/50 dark:bg-slate-900/40'
                    : ''
                }`}
              >
                {/* Day Number and Weekday */}
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      day.isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      day.isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {day.dayName}
                  </span>
                </div>

                {/* Day status indicator / highlight */}
                {day.isToday && (
                  <span className="inline-block text-[9px] px-1 bg-emerald-500 text-white font-bold rounded text-center">
                    {language === 'fr' ? 'Aujourd\'hui' : language === 'ar' ? 'اليوم' : 'Today'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Resource Rows & Gantt Bars Matrix */}
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {filteredGroups.map((grp) => {
              const isCollapsed = collapsedGroups[grp.id];

              return (
                <div key={grp.id}>
                  {/* Group Availability Row: shows remaining count badge per day e.g. [2], [0], [1] */}
                  <div className="h-10 flex bg-slate-100/70 dark:bg-slate-850/50 border-b border-slate-200/50 dark:border-slate-800/50">
                    {timelineDays.map((day) => {
                      const avail = groupAvailability[grp.id]?.[day.dateStr] ?? 0;
                      const isFree = avail > 0;
                      return (
                        <div
                          key={day.dateStr}
                          className="w-28 shrink-0 border-r border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center p-1"
                        >
                          <span
                            className={`w-6 h-5 rounded text-[11px] font-bold font-mono flex items-center justify-center shadow-2xs ${
                              isFree
                                ? 'bg-emerald-500 text-white'
                                : 'bg-rose-500 text-white'
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
                              onClick={() => {
                                setNewBookingInitialSlot({
                                  resourceId: res.id,
                                  date: day.dateStr,
                                });
                                setIsNewBookingModalOpen(true);
                              }}
                              className={`w-28 shrink-0 border-r border-slate-100 dark:border-slate-800/40 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
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
                            const leftOffset = visibleStart * 112; // 112px width per day (w-28 = 7rem = 112px)
                            const barWidth = Math.max(daysSpan * 112 - 8, 48); // with 8px margin

                            const statusStyle = statusConfig[bkg.status] || statusConfig.confirmed;

                            return (
                              <div
                                key={bkg.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(bkg);
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredBooking({
                                    booking: bkg,
                                    x: rect.left,
                                    y: rect.bottom + 6,
                                  });
                                }}
                                onMouseLeave={() => setHoveredBooking(null)}
                                style={{
                                  left: `${leftOffset + 4}px`,
                                  width: `${barWidth}px`,
                                }}
                                className={`absolute top-1.5 h-9 rounded-md px-2.5 flex items-center justify-between cursor-pointer shadow-sm hover:brightness-105 active:scale-[0.99] transition-all z-10 border ${statusStyle.bg} ${statusStyle.border}`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <Globe size={13} className="shrink-0 opacity-80" />
                                  <span className="text-xs font-semibold truncate tracking-tight">
                                    {bkg.guestName}
                                  </span>
                                </div>
                                <span className="text-[10px] opacity-90 font-mono shrink-0 ml-1">
                                  {bkg.totalPrice}€
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

      {/* Floating Tooltip Card matching the screenshot */}
      {hoveredBooking && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 260, Math.max(10, hoveredBooking.x))}px`,
            top: `${Math.min(window.innerHeight - 240, hoveredBooking.y)}px`,
          }}
          className="w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 z-50 text-xs animate-in fade-in zoom-in-95 pointer-events-auto"
          onMouseEnter={() => {}}
          onMouseLeave={() => setHoveredBooking(null)}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
            <span className="font-bold text-slate-900 dark:text-white truncate">
              {hoveredBooking.booking.resourceName}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                statusConfig[hoveredBooking.booking.status]?.pillBg
              }`}
            >
              {statusConfig[hoveredBooking.booking.status]?.label[language] ||
                hoveredBooking.booking.status}
            </span>
          </div>

          <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                {language === 'fr' ? 'Invité :' : language === 'ar' ? 'النزيل:' : 'Guests:'}
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {hoveredBooking.booking.guestName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                {language === 'fr' ? 'Arrivée :' : language === 'ar' ? 'الوصول:' : 'Check in:'}
              </span>
              <span className="font-mono">{hoveredBooking.booking.startDate}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                {language === 'fr' ? 'Départ :' : language === 'ar' ? 'المغادرة:' : 'Check out:'}
              </span>
              <span className="font-mono">{hoveredBooking.booking.endDate}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                {language === 'fr' ? 'Paiement :' : language === 'ar' ? 'الدفع:' : 'Payments:'}
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {hoveredBooking.booking.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200">Total :</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {hoveredBooking.booking.totalPrice} €
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
            <button
              onClick={() => {
                setSelectedBooking(hoveredBooking.booking);
                setHoveredBooking(null);
              }}
              className="flex-1 py-1 bg-blue-600 text-white rounded text-center font-medium hover:bg-blue-700 transition-colors"
            >
              {language === 'fr' ? 'Détails' : language === 'ar' ? 'التفاصيل' : 'Details'}
            </button>
            <button
              onClick={() => {
                downloadICS(hoveredBooking.booking);
              }}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded transition-colors"
              title="Exporter .ICS"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
