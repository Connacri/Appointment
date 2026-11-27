import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
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
  SearchX,
  Search,
  ChevronUp,
  Crosshair,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ResourceGroup, ResourceItem, TimelineBooking } from '../types/booking';
import { statusConfig } from './LegendBar';
import { getTranslation } from '../i18n/translations';

import { computeTimelineBarGeometry } from '../utils/timelineBarGeometry';
import { useTimelineSync } from '../hooks/useTimelineSync';
import {
  shouldStartTimelineDrag,
  computeTimelineDragScroll,
  TimelineDragState,
} from '../utils/timelineDragPan';
import {
  TimelineScaleView,
  TIMELINE_ZOOM_STORAGE_KEY,
  getColumnWidthFromZoomLevel,
  getPresetZoomLevel,
  getScaleViewFromZoomLevel,
  readInitialZoomLevel,
} from '../utils/timelineZoom';
import {
  TimelineBookingMatch,
  computeQuickCreateCheckInTime,
  doesResourceMatchQuery,
  findMatchingTimelineBookings,
  getResourceSubgroupMeta,
  isTimelineCellAvailableForQuickCreate,
} from '../utils/timelineSearch';
import { computeAvailabilityByDay } from '../utils/availability';

const BookingPrintReportModal = React.lazy(() =>
  import('./BookingPrintReportModal').then((m) => ({ default: m.BookingPrintReportModal })),
);

/**
 * Gantt timeline with day-by-day availability and quick-create booking cells.
 */
export const PlanningTimeline: React.FC = () => {
  const {
    language,
    currentBaseDate,
    setCurrentBaseDate,
    dateRangeMode,
    setDateRangeMode,
    bookings,
    searchQuery,
    setSearchQuery,
    currentDomain,
    currentRole,
    activeRoleDefinition,
    resourceGroups,
    setSelectedBooking,
    setIsNewBookingModalOpen,
    setNewBookingInitialSlot,
    updateHousekeepingStatus,
    selectedBuildingGroupId,
    setSelectedBuildingGroupId,
    currency,
    establishmentProfile,
    setEstablishmentProfile,
  } = useApp();

  const isRTL = language === 'ar';
  const [groupingMode, setGroupingMode] = useState<'floor' | 'wing' | 'floor_wing'>(
    () => establishmentProfile?.roomGroupingMode || 'floor'
  );

  useEffect(() => {
    if (establishmentProfile?.roomGroupingMode && establishmentProfile.roomGroupingMode !== groupingMode) {
      setGroupingMode(establishmentProfile.roomGroupingMode);
    }
  }, [establishmentProfile?.roomGroupingMode]);

  const changeGroupingMode = (mode: 'floor' | 'wing' | 'floor_wing') => {
    setGroupingMode(mode);
    if (establishmentProfile && setEstablishmentProfile) {
      setEstablishmentProfile({
        ...establishmentProfile,
        roomGroupingMode: mode,
      });
    }
  };
  const [showAvailabilityHelp, setShowAvailabilityHelp] = useState(false);
  const [selectedHousekeepingRoom, setSelectedHousekeepingRoom] = useState<{ id: string; name: string; status: string } | null>(null);
  const [timelineNotice, setTimelineNotice] = useState<{ title: string; message: string; tone: 'danger' | 'warning' | 'info'; roomName?: string; roomStatus?: string } | null>(null);

  // The Gantt filter must reflect actual local inventory: imported CardLock buildings
  // and buildings created locally in the establishment setup screen. A stale selection
  // is cleared when the local inventory changes.
  useEffect(() => {
    if (
      selectedBuildingGroupId !== 'all' &&
      !resourceGroups.some((group) => group.id === selectedBuildingGroupId && group.sector === currentDomain)
    ) {
      setSelectedBuildingGroupId('all');
    }
  }, [currentDomain, resourceGroups, selectedBuildingGroupId, setSelectedBuildingGroupId]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPanRef = useRef<TimelineDragState | null>(null);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);
  const [isPoliceBatchPrintOpen, setIsPoliceBatchPrintOpen] = useState(false);
  const suppressClickRef = useRef(false);

  const cleanupDrag = useCallback(() => {
    const d = dragPanRef.current;
    if (!d) return;
    try {
      if (d.capturingEl && d.capturingEl.hasPointerCapture(d.pointerId)) {
        d.capturingEl.releasePointerCapture(d.pointerId);
      }
    } catch {
      // Ignore if pointer capture was already released or unsupported
    }
    const moved = d.moved;
    dragPanRef.current = null;
    setIsHeaderDragging(false);
    if (moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 50);
    }
  }, []);

  const onTimelinePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isInteractive = Boolean(
      target.closest(
        'button,a,input,select,textarea,[role="button"],[data-booking-card="true"],[data-gantt-group-toggle="true"]'
      )
    );

    if (
      !shouldStartTimelineDrag({
        pointerType: e.pointerType,
        button: e.button,
        buttons: e.buttons,
        isInteractiveTarget: isInteractive,
      })
    ) {
      return;
    }

    const el = scrollContainerRef.current;
    if (!el) return;

    const headerEl = e.currentTarget;
    try {
      headerEl.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }

    dragPanRef.current = {
      pointerId: e.pointerId,
      capturingEl: headerEl,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    setIsHeaderDragging(true);
  }, []);

  // Mouse drag pans horizontally ONLY while user actively holds the primary click down.
  // Hovering or moving cursor without click never triggers horizontal scroll.
  const onTimelinePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragPanRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const result = computeTimelineDragScroll({
      dragState: d,
      pointerId: e.pointerId,
      clientX: e.clientX,
      buttons: e.buttons,
      minDistanceThreshold: 4,
    });

    if (result.shouldCancel) {
      cleanupDrag();
      return;
    }

    if (!result.shouldScroll) return;

    d.moved = true;
    suppressClickRef.current = true;
    e.preventDefault();

    const el = scrollContainerRef.current;
    if (el) {
      el.scrollLeft = result.newScrollLeft;
    }
  }, [cleanupDrag]);

  const onTimelinePointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPanRef.current || dragPanRef.current.pointerId !== e.pointerId) return;
    cleanupDrag();
  }, [cleanupDrag]);

  const onTimelineClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  // Window-level failsafe to cancel drag if mouse is released anywhere outside the header
  useEffect(() => {
    const handleGlobalRelease = () => {
      if (dragPanRef.current) {
        cleanupDrag();
      }
    };
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalRelease);
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('blur', handleGlobalRelease);

    return () => {
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('blur', handleGlobalRelease);
    };
  }, [cleanupDrag]);


  // Persist the user's last selected density and zoom level (Day / Week / Month).
  const [zoomLevel, setZoomLevel] = useState<number>(() => readInitialZoomLevel());
  const scaleView = getScaleViewFromZoomLevel(zoomLevel);

  const selectScaleView = useCallback((view: TimelineScaleView) => {
    setZoomLevel(getPresetZoomLevel(view));
  }, []);

  const [leftBarMode, setLeftBarMode] = useState<'normal' | 'compact' | 'mini'>(() => {
    if (typeof window === 'undefined') return 'normal';
    const saved = window.localStorage.getItem('appointment.gantt.leftDensity');
    return saved === 'mini' || saved === 'compact' || saved === 'normal' ? saved : window.innerWidth < 768 ? 'compact' : 'normal';
  });
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isDayHeaderCollapsed, setIsDayHeaderCollapsed] = useState(false);
  const [isGanttToolsOpen, setIsGanttToolsOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [scrollVisibleDate, setScrollVisibleDate] = useState<string>(() => currentBaseDate);
  const [visibleDayRange, setVisibleDayRange] = useState({ start: 0, end: 64 });
  useEffect(() => {
    try {
      window.localStorage.setItem(TIMELINE_ZOOM_STORAGE_KEY, String(zoomLevel));
    } catch {
      // Ignore storage errors
    }
  }, [zoomLevel]);
  useEffect(() => {
    const desiredRange = scaleView === 'month' ? 'one_month' : 'two_weeks';
    if (dateRangeMode !== desiredRange) {
      setDateRangeMode(desiredRange);
    }
  }, [scaleView, dateRangeMode, setDateRangeMode]);
  useEffect(() => { window.localStorage.setItem('appointment.gantt.leftDensity', leftBarMode); }, [leftBarMode]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    setIsMobileScreen(media.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsMobileScreen(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  const lastScrollLeftRef = useRef(0);
  const isShiftingWindowRef = useRef(false);

  const handleTimelineScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const currentScrollLeft = el.scrollLeft;
    lastScrollLeftRef.current = currentScrollLeft;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const raw = currentScrollLeft;
    const position = isRTL ? Math.max(0, Math.min(maxScroll, Math.abs(raw))) : Math.max(0, Math.min(maxScroll, raw));

    // Update the scroll-driven visible date and month smoothly
    const visibleDayIndex = Math.max(
      0,
      Math.min(timelineDays.length - 1, Math.floor((position + Math.min(el.clientWidth / 2, 200)) / colWidth))
    );
    const visibleDay = timelineDays[visibleDayIndex];
    if (visibleDay && visibleDay.dateStr) {
      setScrollVisibleDate(visibleDay.dateStr);
    }
    updateVisibleDayRange(el);

    // Infinite scroll: when the user reaches the edge of the visible window,
    // shift the base date so the window slides and new dates appear.
    if (isShiftingWindowRef.current) return;
    const edgeThreshold = colWidth * 14; // ~2 weeks from edge
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;

    if (position > maxScroll - edgeThreshold) {
      // Near right edge → shift forward by 3 months
      isShiftingWindowRef.current = true;
      const savedScroll = el.scrollLeft;
      const next = new Date(safeYear, safeMonth + 3, 1);
      const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      setCurrentBaseDate(iso);
      // After re-render, restore an equivalent scroll position
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const newMax = Math.max(0, scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth);
          const shift = maxScroll - newMax;
          scrollContainerRef.current.scrollLeft = Math.max(0, savedScroll + shift);
        }
        isShiftingWindowRef.current = false;
      });
    } else if (position < edgeThreshold) {
      // Near left edge → shift backward by 3 months
      isShiftingWindowRef.current = true;
      const savedScroll = el.scrollLeft;
      const prev = new Date(safeYear, safeMonth - 4, 1);
      const iso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
      setCurrentBaseDate(iso);
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const newMax = Math.max(0, scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth);
          const shift = newMax - maxScroll;
          scrollContainerRef.current.scrollLeft = Math.max(0, savedScroll + shift);
        }
        isShiftingWindowRef.current = false;
      });
    }
  };

  // Dynamic day column width driven by continuous zoom slider + Day/Week/Month scale presets
  const colWidth = useMemo(
    () => getColumnWidthFromZoomLevel(zoomLevel, isMobileScreen),
    [zoomLevel, isMobileScreen]
  );

  // Stable day header height to prevent vertical jitter during scroll
  const dayHeaderHeightClass = isMobileScreen
    ? 'h-10 min-h-[40px] max-h-[40px]'
    : 'h-12 min-h-[48px] max-h-[48px]';

  // Collapsed state for resource groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedFloors, setCollapsedFloors] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleFloor = (groupId: string, floorKey: string) => {
    const key = `${groupId}:${floorKey}`;
    setCollapsedFloors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Smooth scroll helpers
  const scrollTimeline = (delta: number) => {
    if (scrollContainerRef.current) {
      const dirMultiplier = language === 'ar' ? -1 : 1;
      scrollContainerRef.current.scrollBy({ left: delta * dirMultiplier, behavior: 'smooth' });
    }
  };

  const scrollToToday = () => {
    const today = new Date();
    const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const index = timelineDays.findIndex((day) => day.dateStr === todayIso);
    if (index >= 0 && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      const visibleWidth = Math.max(0, el.clientWidth - (el.querySelector('[data-gantt-resource-column="true"]') as HTMLElement | null)?.offsetWidth! || 0);
      const target = Math.max(0, index * colWidth - visibleWidth / 2 + colWidth / 2);
      el.scrollTo({ left: target * (isRTL ? -1 : 1), behavior: 'smooth' });
      return;
    }
    setCurrentBaseDate(todayIso);
  };

  // Continuous stable window: 12 months before + current month + 12 months after.
  // This gives a very large scrolling range (24 months total) so the user
  // can scroll freely without hitting the edge of the window.
  const { timelineWindowStart, timelineWindowDays } = useMemo(() => {
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;
    // Start of 12 months before
    const prevMonthDate = new Date(safeYear, safeMonth - 13, 1);
    const startStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    // End of 12 months after
    const nextMonthEndDate = new Date(safeYear, safeMonth + 12, 0);
    const diffTime = nextMonthEndDate.getTime() - prevMonthDate.getTime();
    const total = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return { timelineWindowStart: startStr, timelineWindowDays: Math.max(60, total) };
  }, [currentBaseDate]);

  const goToPreviousMonth = () => {
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;
    const prev = new Date(safeYear, safeMonth - 7, 1);
    const iso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
    setCurrentBaseDate(iso);
  };

  const goToNextMonth = () => {
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;
    const next = new Date(safeYear, safeMonth + 6, 1);
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    setCurrentBaseDate(iso);
  };

  // Global Timeline Sync Hook: observes the expanding date window.
  const timelineSync = useTimelineSync({
    currentBaseDate: timelineWindowStart,
    totalDays: timelineWindowDays,
    colWidth,
    scrollContainerRef,
    language,
    direction: language === 'ar' ? 'rtl' : 'ltr',
  });

  const timelineDays = useMemo(() => {
    const [y, m, d] = timelineWindowStart.split('-').map(Number);
    const dates: {
      dateStr: string;
      dayNum: number;
      dayName: string;
      monthShort: string;
      isFirstOfMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
    }[] = [];

    const realTodayStr = timelineSync.todayDateStr;
    const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US';

    const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short' });

    for (let i = 0; i < timelineWindowDays; i++) {
      const cur = new Date(y, m - 1, d);
      cur.setDate(cur.getDate() + i);
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(
        cur.getDate()
      ).padStart(2, '0')}`;

      const dayOfWeek = cur.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayNum = cur.getDate();

      // Real check against actual current calendar day
      const isToday = iso === realTodayStr;

      dates.push({
        dateStr: iso,
        dayNum,
        dayName: dayFormatter.format(cur),
        monthShort: monthFormatter.format(cur),
        isFirstOfMonth: dayNum === 1,
        isWeekend,
        isToday,
      });
    }
    return dates;
  }, [timelineWindowStart, timelineWindowDays, language, timelineSync.todayDateStr]);

  // Keep the 24-month navigation range without mounting hundreds of off-screen
  // day cells for every room. A bounded overscan avoids blank edges during scroll.
  const updateVisibleDayRange = useCallback((element: HTMLDivElement) => {
    const resourceColumn = element.querySelector('[data-gantt-resource-column="true"]') as HTMLElement | null;
    const viewportWidth = Math.max(0, element.clientWidth - (resourceColumn?.offsetWidth ?? 0));
    const scrollPosition = Math.max(0, Math.abs(element.scrollLeft));
    const overscanDays = isMobileScreen ? 8 : 12;
    const firstVisible = Math.floor(scrollPosition / colWidth);
    const start = Math.max(0, firstVisible - overscanDays);
    const end = Math.min(
      timelineDays.length,
      Math.max(start + 1, Math.ceil((scrollPosition + viewportWidth) / colWidth) + overscanDays),
    );
    setVisibleDayRange((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, [colWidth, isMobileScreen, timelineDays.length]);

  const renderedTimelineDays = useMemo(
    () => timelineDays.slice(visibleDayRange.start, visibleDayRange.end),
    [timelineDays, visibleDayRange.start, visibleDayRange.end],
  );
  const timelineLeadingSpacerWidth = visibleDayRange.start * colWidth;
  const timelineTrailingSpacerWidth = Math.max(0, timelineDays.length - visibleDayRange.end) * colWidth;

  // O(1) per-resource booking index: replaces O(bookings) .filter/.some scans
  // inside every day cell and floor/row availability calculation.
  const bookingsByResource = useMemo(() => {
    const map = new Map<string, TimelineBooking[]>();
    for (const b of bookings) {
      const bucket = map.get(b.resourceId) ?? [];
      bucket.push(b);
      map.set(b.resourceId, bucket);
    }
    return map;
  }, [bookings]);

  // Center timeline on currentBaseDate on initial mount or base date navigation,
  // and preserve the currently centered viewport day when zooming via slider or presets.
  const hasCenteredInitialDateRef = useRef(false);
  const prevColWidthRef = useRef(colWidth);
  const prevBaseDateRef = useRef(currentBaseDate);
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const baseDateChanged = prevBaseDateRef.current !== currentBaseDate;
    const prevColWidth = prevColWidthRef.current;
    const colWidthChanged = prevColWidth !== colWidth;

    if (!hasCenteredInitialDateRef.current || baseDateChanged) {
      const idx = timelineDays.findIndex((day) => day.dateStr === currentBaseDate);
      if (idx >= 0) {
        const target = Math.max(0, idx * colWidth - (isMobileScreen ? 20 : 60));
        el.scrollTo({
          left: target * (isRTL ? -1 : 1),
          behavior: hasCenteredInitialDateRef.current ? 'smooth' : 'auto',
        });
        hasCenteredInitialDateRef.current = true;
      }
    } else if (colWidthChanged && prevColWidth > 0) {
      const resourceColEl = el.querySelector('[data-gantt-resource-column="true"]') as HTMLElement | null;
      const resourceColWidth = resourceColEl?.offsetWidth ?? 0;
      const gridViewportWidth = Math.max(0, el.clientWidth - resourceColWidth);
      const centerDayFloat = (Math.abs(el.scrollLeft) + gridViewportWidth / 2) / prevColWidth;
      const targetScroll = Math.max(0, centerDayFloat * colWidth - gridViewportWidth / 2);
      el.scrollLeft = targetScroll * (isRTL ? -1 : 1);
    }

    prevColWidthRef.current = colWidth;
    prevBaseDateRef.current = currentBaseDate;
    updateVisibleDayRange(el);
  }, [currentBaseDate, timelineDays, colWidth, isRTL, isMobileScreen, updateVisibleDayRange]);

  // Derive the marker index from the exact date rendered in the day columns.
  // This keeps the red marker aligned even when the timeline window is extended/prepended.
  const currentTimeStr = timelineSync.currentTimeStr;
  const currentHourFraction = timelineSync.currentHourFraction;
  const realTodayStr = timelineSync.todayDateStr;
  const todayIndex = timelineDays.findIndex((day) => day.dateStr === realTodayStr);
  const isTodayInRange = todayIndex >= 0;

  // Dedicated timeline search & quick-locate state (combines seamlessly with global TopBar searchQuery)
  const [timelineSearchQuery, setTimelineSearchQuery] = useState('');
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [locatedBookingId, setLocatedBookingId] = useState<string | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const locateScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveSearchQuery = timelineSearchQuery.trim()
    ? timelineSearchQuery
    : searchQuery;

  useEffect(() => {
    if (!isGanttToolsOpen) return undefined;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsGanttToolsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsGanttToolsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isGanttToolsOpen]);

  // Close search results popover on outside click / touch
  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsSearchResultsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (locateScrollTimerRef.current) clearTimeout(locateScrollTimerRef.current);
    };
  }, []);

  // Matching guest bookings across the active domain & establishment (by guest name, reservation ID, or room number)
  const matchingBookingResults = useMemo(
    () =>
      findMatchingTimelineBookings({
        bookings,
        resourceGroups,
        query: effectiveSearchQuery,
        currentDomain,
        selectedBuildingGroupId,
        groupingMode,
        language,
      }),
    [
      bookings,
      resourceGroups,
      effectiveSearchQuery,
      currentDomain,
      selectedBuildingGroupId,
      groupingMode,
      language,
    ]
  );

  useEffect(() => {
    setActiveMatchIndex(0);
    if (!effectiveSearchQuery.trim()) {
      setLocatedBookingId(null);
    }
  }, [effectiveSearchQuery]);

  // Filter resource groups strictly by currentDomain (NEVER MIX) & effectiveSearchQuery & establishment
  const filteredGroups = useMemo(() => {
    return resourceGroups
      .filter((grp) =>
        grp.sector === currentDomain &&
        (selectedBuildingGroupId === 'all' || grp.id === selectedBuildingGroupId)
      )
      .map((grp) => {
        let matchingResources = grp.resources;
        if (effectiveSearchQuery.trim()) {
          matchingResources = matchingResources.filter((r) =>
            doesResourceMatchQuery(
              r,
              bookingsByResource.get(r.id) ?? [],
              effectiveSearchQuery
            )
          );
        }
        return {
          ...grp,
          resources: matchingResources,
        };
      })
      .filter((grp) => grp.resources.length > 0 || (currentDomain === 'hotel' && !effectiveSearchQuery.trim()));
  }, [currentDomain, resourceGroups, effectiveSearchQuery, bookingsByResource, selectedBuildingGroupId]);

  // Gantt hierarchy: building (resource group) > floor / wing / floor_wing > room.
  // The room type remains visible on each room row.
  const floorGroupsByGroup = useMemo(() => {
    const result = new Map<string, Array<{ key: string; label: string; shortLabel: string; resources: ResourceItem[] }>>();
    for (const group of filteredGroups) {
      if (group.sector !== 'hotel') {
        result.set(group.id, [{ key: 'all', label: '', shortLabel: '', resources: group.resources }]);
        continue;
      }
      const subgroups = new Map<string, { label: string; shortLabel: string; sortKey: string; resources: ResourceItem[] }>();
      for (const resource of group.resources) {
        const meta = getResourceSubgroupMeta(resource, groupingMode, language);
        const existing = subgroups.get(meta.key) ?? {
          label: meta.label,
          shortLabel: meta.shortLabel,
          sortKey: meta.sortKey,
          resources: [],
        };
        existing.resources.push(resource);
        subgroups.set(meta.key, existing);
      }

      result.set(
        group.id,
        [...subgroups.entries()]
          .sort(([, a], [, b]) => a.sortKey.localeCompare(b.sortKey, language, { numeric: true, sensitivity: 'base' }))
          .map(([key, item]) => ({
            key,
            label: item.label,
            shortLabel: item.shortLabel,
            resources: item.resources,
          }))
      );
    }
    return result;
  }, [filteredGroups, language, groupingMode]);

  const allFloorsCollapsed = useMemo(() => {
    let totalFloors = 0;
    let collapsedCount = 0;
    for (const [grpId, floors] of floorGroupsByGroup.entries()) {
      for (const flr of floors) {
        if (flr.label) {
          totalFloors++;
          if (collapsedFloors[`${grpId}:${flr.key}`]) {
            collapsedCount++;
          }
        }
      }
    }
    return totalFloors > 0 && collapsedCount === totalFloors;
  }, [floorGroupsByGroup, collapsedFloors]);

  const toggleAllFloors = () => {
    const next: Record<string, boolean> = {};
    const shouldCollapse = !allFloorsCollapsed;
    for (const [grpId, floors] of floorGroupsByGroup.entries()) {
      for (const flr of floors) {
        if (flr.label) {
          next[`${grpId}:${flr.key}`] = shouldCollapse;
        }
      }
    }
    setCollapsedFloors(next);
  };

  // Scroll & focus onto a matched booking (auto-expands collapsed groups/floors, scrolls horizontally to startDate and vertically to the room row)
  const locateBookingMatch = useCallback(
    (match: TimelineBookingMatch, indexInResults?: number) => {
      if (typeof indexInResults === 'number') {
        setActiveMatchIndex(indexInResults);
      }
      setLocatedBookingId(match.booking.id);
      setCollapsedGroups((prev) =>
        prev[match.groupId] ? { ...prev, [match.groupId]: false } : prev
      );
      if (match.floorKey && match.floorKey !== 'all') {
        const floorStateKey = `${match.groupId}:${match.floorKey}`;
        setCollapsedFloors((prev) =>
          prev[floorStateKey] ? { ...prev, [floorStateKey]: false } : prev
        );
      }

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const scrollBehavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

      const dayIndex = timelineDays.findIndex((d) => d.dateStr === match.booking.startDate);
      if (dayIndex === -1) {
        setCurrentBaseDate(match.booking.startDate);
      }

      if (locateScrollTimerRef.current) clearTimeout(locateScrollTimerRef.current);
      locateScrollTimerRef.current = setTimeout(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        if (dayIndex >= 0) {
          const resourceColEl = el.querySelector('[data-gantt-resource-column="true"]') as HTMLElement | null;
          const resourceColWidth = resourceColEl?.offsetWidth ?? 0;
          const gridViewportWidth = Math.max(0, el.clientWidth - resourceColWidth);
          const targetX = Math.max(0, dayIndex * colWidth - Math.min(gridViewportWidth * 0.25, 160));
          el.scrollTo({ left: targetX * (isRTL ? -1 : 1), behavior: scrollBehavior });
        }

        const rowEl = el.querySelector(
          `[data-gantt-resource-row="${match.booking.resourceId}"]`
        ) as HTMLElement | null;
        if (rowEl) {
          rowEl.scrollIntoView({ block: 'nearest', behavior: scrollBehavior });
        }
      }, 40);
    },
    [timelineDays, colWidth, isRTL, setCurrentBaseDate]
  );

  const cycleBookingMatch = useCallback(
    (direction: -1 | 1) => {
      if (matchingBookingResults.length === 0) return;
      const total = matchingBookingResults.length;
      const nextIndex = (activeMatchIndex + direction + total) % total;
      locateBookingMatch(matchingBookingResults[nextIndex], nextIndex);
    },
    [matchingBookingResults, activeMatchIndex, locateBookingMatch]
  );

  const openQuickCreateForCell = useCallback(
    (res: ResourceItem, dateStr: string, resBookings: TimelineBooking[]) => {
      const suggestedCheckIn = computeQuickCreateCheckInTime(dateStr, resBookings);
      setSelectedBooking(null);
      setNewBookingInitialSlot({
        resourceId: res.id,
        date: dateStr,
        time: suggestedCheckIn,
      });
      setIsNewBookingModalOpen(true);
    },
    [setSelectedBooking, setNewBookingInitialSlot, setIsNewBookingModalOpen]
  );

  // Recovery action when no room row can be rendered: the workspace must never stay
  // blank behind a dialog, and clearing the filters must not require a page reload.
  const resetTimelineFilters = () => {
    setTimelineSearchQuery('');
    setSearchQuery('');
    setLocatedBookingId(null);
    setIsSearchResultsOpen(false);
    setSelectedBuildingGroupId('all');
    setCollapsedGroups({});
    setCollapsedFloors({});
  };

  const hasDomainInventory = useMemo(
    () => resourceGroups.some((grp) => grp.sector === currentDomain),
    [resourceGroups, currentDomain]
  );

  // Day-by-day availability per building and per floor. The difference-array
  // helper keeps this O(bookings + days) instead of scanning every booking for
  // every resource on every day of the 24-month window.
  const groupAvailability = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const group of filteredGroups) {
      map[group.id] = computeAvailabilityByDay(
        group.resources,
        bookingsByResource,
        timelineDays,
      );
    }
    return map;
  }, [filteredGroups, timelineDays, bookingsByResource]);

  const floorAvailability = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const [groupId, floors] of floorGroupsByGroup) {
      // A collapsed building or floor has no visible availability cells. Avoid
      // scanning its reservations until the user expands that section.
      if (collapsedGroups[groupId]) continue;
      for (const floor of floors) {
        if (floor.label && collapsedFloors[`${groupId}:${floor.key}`]) continue;
        map.set(
          `${groupId}:${floor.key}`,
          computeAvailabilityByDay(floor.resources, bookingsByResource, timelineDays),
        );
      }
    }
    return map;
  }, [floorGroupsByGroup, collapsedGroups, collapsedFloors, timelineDays, bookingsByResource]);

  // Open an explicit status selector instead of silently cycling through statuses.
  const renderHousekeepingTag = (status?: string, resourceId?: string, resourceName?: string) => {
    const isOutOfOrder = status === 'out_of_order';
    const colorClass =
      status === 'clean'
        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]'
        : status === 'cleaning'
        ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.45)]'
        : status === 'dirty'
        ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]'
        : 'bg-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.45)]';

    const label =
      status === 'clean'
        ? (language === 'fr' ? 'Propre' : language === 'ar' ? 'جاهزة ونظيفة' : 'Clean')
        : status === 'cleaning'
        ? (language === 'fr' ? 'En cours de nettoyage' : language === 'ar' ? 'قيد التنظيف' : 'Cleaning')
        : status === 'dirty'
        ? (language === 'fr' ? 'À nettoyer' : language === 'ar' ? 'تحتاج تنظيف' : 'Needs cleaning')
        : (language === 'fr' ? 'HORS SERVICE (HS)' : language === 'ar' ? 'خارج الخدمة' : 'OUT OF ORDER');

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (resourceId) {
            setSelectedHousekeepingRoom({ id: resourceId, name: resourceName || '', status: status || 'clean' });
          }
        }}
        className="relative z-20 w-3.5 h-3.5 flex items-center justify-center shrink-0 cursor-pointer rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 pointer-events-auto"
        title={`${language === 'fr' ? 'État :' : language === 'ar' ? 'الحالة :' : 'Status:'} ${label} — ${language === 'fr' ? 'Cliquer pour modifier' : language === 'ar' ? 'اضغط للتعديل' : 'Click to change'}`}
        aria-label={`${language === 'fr' ? 'État de la chambre :' : language === 'ar' ? 'حالة الغرفة :' : 'Room status:'} ${label}`}
      >
        <span className={`w-2 h-2 rounded-full ${colorClass} ring-1 ring-black/15 dark:ring-white/25 transition-transform hover:scale-125`} />
      </button>
    );
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

  // Left column width classes: carefully proportioned so room text never overflows in mini, compact or complet
  const leftColWidthClass = useMemo(() => {
    if (isMobileScreen) {
      return leftBarMode === 'mini' ? 'w-24' : leftBarMode === 'compact' ? 'w-36' : 'w-48';
    }
    if (leftBarMode === 'mini') return 'w-24 sm:w-28';
    if (leftBarMode === 'compact') return 'w-36 sm:w-44';
    return 'w-52 sm:w-60 md:w-64';
  }, [leftBarMode, isMobileScreen]);

  const scrollVisibleMonthYear = useMemo(() => {
    const targetDate = scrollVisibleDate || currentBaseDate;
    const [y, m] = targetDate.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return new Intl.DateTimeFormat(
      language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US',
      { month: 'long', year: 'numeric' }
    ).format(d);
  }, [scrollVisibleDate, currentBaseDate, language]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden pms-gantt-root bg-[rgb(var(--pms-canvas))] relative select-none">
      {/* Responsive Toolbar: one compact, horizontally scrollable row on phones */}
      <div className="w-full min-w-0 shrink-0 border-b border-[rgb(var(--pms-border))] pms-gantt-surface select-none">
        <div ref={toolbarRef} className={`flex min-w-0 flex-col gap-1.5 px-1.5 py-1.5 md:px-3 md:py-1.5 ${isMobileScreen && isGanttToolsOpen ? 'max-h-[min(68vh,560px)] overflow-y-auto overscroll-contain' : ''}`}>

          <button
            type="button"
            className="md:hidden flex min-h-9 w-full items-center justify-between rounded-lg border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] px-3 text-xs font-semibold text-slate-700 shadow-2xs dark:text-slate-200"
            onClick={() => setIsGanttToolsOpen((open) => !open)}
            aria-expanded={isGanttToolsOpen}
            aria-controls="gantt-toolbar-tools"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[var(--theme-primary)]" />
              {language === 'fr' ? 'Outils & recherche' : language === 'ar' ? 'الأدوات والبحث' : 'Tools & search'}
            </span>
            <ChevronDown size={15} className={isGanttToolsOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          <div
            id="gantt-toolbar-tools"
            className={`${isMobileScreen ? (isGanttToolsOpen ? 'flex' : 'hidden') : 'flex'} w-full min-w-0 flex-col items-stretch gap-2 rounded-lg md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-1.5 md:rounded-none ${isMobileScreen && isGanttToolsOpen ? 'border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-2 shadow-sm' : ''}`}
          >
          {/* Quick Date Stepper Navigation with sequential Month & Day navigation */}
          <div className="flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-0.5 shadow-2xs">
            <button
              onClick={goToPreviousMonth}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition-colors hover:bg-[rgb(var(--pms-accent)/0.1)] active:scale-95 dark:text-slate-300 cursor-pointer"
              title={language === 'fr' ? 'Mois précédent (sans saut)' : language === 'ar' ? 'الشهر السابق' : 'Previous Month'}
              aria-label={language === 'fr' ? 'Mois précédent' : language === 'ar' ? 'الشهر السابق' : 'Previous Month'}
            ><ChevronsLeft size={13} /></button>
            <button
              onClick={() => scrollTimeline(-colWidth * 2)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition-colors hover:bg-[rgb(var(--pms-accent)/0.1)] active:scale-95 dark:text-slate-300 cursor-pointer"
              title={getTranslation('ganttBackTwoDays', language)}
              aria-label={getTranslation('ganttBackTwoDays', language)}
            ><MoveLeft size={12} /></button>
            <button
              onClick={scrollToToday}
              className="h-6 rounded px-2 text-[10px] sm:text-[11px] font-bold text-[var(--theme-primary)] transition-colors hover:bg-[rgb(var(--pms-accent)/0.1)] cursor-pointer capitalize flex items-center gap-1 select-none"
              title={language === 'fr' ? `Mois visible : ${scrollVisibleMonthYear} • Cliquer pour aller à Aujourd’hui` : language === 'ar' ? `الشهر المعروض: ${scrollVisibleMonthYear} • اضغط للانتقال إلى اليوم` : `Visible: ${scrollVisibleMonthYear} • Click to center on Today`}
            >
              <span>{scrollVisibleMonthYear}</span>
            </button>
            <button
              onClick={() => scrollTimeline(colWidth * 2)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition-colors hover:bg-[rgb(var(--pms-accent)/0.1)] active:scale-95 dark:text-slate-300 cursor-pointer"
              title={getTranslation('ganttForwardTwoDays', language)}
              aria-label={getTranslation('ganttForwardTwoDays', language)}
            ><MoveRight size={12} /></button>
            <button
              onClick={goToNextMonth}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition-colors hover:bg-[rgb(var(--pms-accent)/0.1)] active:scale-95 dark:text-slate-300 cursor-pointer"
              title={language === 'fr' ? 'Mois suivant (sans saut)' : language === 'ar' ? 'الشهر التالي' : 'Next Month'}
              aria-label={language === 'fr' ? 'Mois suivant' : language === 'ar' ? 'الشهر التالي' : 'Next Month'}
            ><ChevronsRight size={13} /></button>
          </div>

          {/* Date Picker Input styled with same theme tokens */}
          <div className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] px-1.5 shadow-2xs focus-within:ring-1 focus-within:ring-[var(--theme-primary)]">
            <CalendarDays size={12} className="shrink-0 text-[var(--theme-primary)]" />
            <input
              type="date"
              value={currentBaseDate}
              onChange={(e) => { if (e.target.value) setCurrentBaseDate(e.target.value); }}
              className="w-[110px] sm:w-[124px] min-w-0 bg-transparent text-[10px] font-mono text-slate-800 focus:outline-none dark:text-slate-200"
              title={getTranslation('ganttDatePick', language)}
              aria-label={getTranslation('ganttDatePick', language)}
            />
          </div>

          {/* Room Grouping Selector: Floor / Wing / Floor & Wing */}
          {currentDomain === 'hotel' && (
            <div className="flex h-7 shrink-0 items-center rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-0.5 shadow-2xs text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => changeGroupingMode('floor')}
                className={`h-6 rounded px-1.5 transition-colors cursor-pointer ${groupingMode === 'floor' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                title={language === 'fr' ? 'Grouper par Étage' : language === 'ar' ? 'تجميع حسب الطابق' : 'Group by Floor'}
                aria-pressed={groupingMode === 'floor'}
              >
                {language === 'fr' ? 'Étage' : language === 'ar' ? 'الطابق' : 'Floor'}
              </button>
              <button
                type="button"
                onClick={() => changeGroupingMode('wing')}
                className={`h-6 rounded px-1.5 transition-colors cursor-pointer ${groupingMode === 'wing' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                title={language === 'fr' ? 'Grouper par Aile' : language === 'ar' ? 'تجميع حسب الجناح' : 'Group by Wing'}
                aria-pressed={groupingMode === 'wing'}
              >
                {language === 'fr' ? 'Aile' : language === 'ar' ? 'الجناح' : 'Wing'}
              </button>
              <button
                type="button"
                onClick={() => changeGroupingMode('floor_wing')}
                className={`h-6 rounded px-1.5 transition-colors cursor-pointer ${groupingMode === 'floor_wing' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                title={language === 'fr' ? 'Grouper par Étage & Aile' : language === 'ar' ? 'تجميع حسب الطابق والجناح' : 'Group by Floor & Wing'}
                aria-pressed={groupingMode === 'floor_wing'}
              >
                {language === 'fr' ? 'Étage & Aile' : language === 'ar' ? 'طابق وجناح' : 'Floor & Wing'}
              </button>
            </div>
          )}

          {/* Resource label density */}
          <div className="flex shrink-0 items-center gap-1">
            <div className="flex items-center rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-0.5 shadow-2xs">
              <button
                onClick={() => setLeftBarMode('mini')}
                className={`h-6 rounded px-1.5 text-[9px] sm:text-[10px] font-semibold transition-colors cursor-pointer ${leftBarMode === 'mini' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                title={getTranslation('ganttDensityMini', language)}
                aria-pressed={leftBarMode === 'mini'}
              >{getTranslation('ganttDensityMini', language)}</button>
              <button
                onClick={() => setLeftBarMode('compact')}
                className={`h-6 rounded px-1.5 text-[9px] sm:text-[10px] font-semibold transition-colors cursor-pointer ${leftBarMode === 'compact' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                title={getTranslation('ganttDensityCompact', language)}
                aria-pressed={leftBarMode === 'compact'}
              >{getTranslation('ganttDensityCompact', language)}</button>
              <button
                onClick={() => setLeftBarMode('normal')}
                className={`h-6 rounded px-1.5 text-[9px] sm:text-[10px] font-semibold transition-colors cursor-pointer ${leftBarMode === 'normal' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                title={getTranslation('ganttDensityFull', language)}
                aria-pressed={leftBarMode === 'normal'}
              >{getTranslation('ganttDensityFull', language)}</button>
            </div>
          </div>

          {/* Timeline Scale Controls: Day / Week / Month */}
          <div
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-0.5 shadow-2xs"
            role="group"
            aria-label={getTranslation('ganttZoomGroupLabel', language)}
          >
            <div className="flex items-center gap-0.5">
              {(['day', 'week', 'month'] as const).map((view) => {
                const isActive = scaleView === view;
                const label =
                  view === 'day'
                    ? getTranslation('ganttViewDay', language)
                    : view === 'week'
                    ? getTranslation('ganttViewWeek', language)
                    : getTranslation('ganttViewMonth', language);
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => selectScaleView(view)}
                    aria-pressed={isActive}
                    title={label}
                    className={`h-6 rounded px-2 text-[10px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
                      isActive
                        ? 'bg-[var(--theme-primary)] text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:bg-[rgb(var(--pms-accent)/0.1)] hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

          </div>

          {/* Toggle all subgroups button (Hotel sector) */}
          {currentDomain === 'hotel' && (
            <button
              type="button"
              onClick={toggleAllFloors}
              className="flex h-7 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] px-2 text-[10px] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-[rgb(var(--pms-accent)/0.08)] transition-colors cursor-pointer gap-1"
              title={allFloorsCollapsed ? getTranslation('ganttExpandFloors', language) : getTranslation('ganttCollapseFloors', language)}
            >
              <SlidersHorizontal size={12} className="text-[var(--theme-primary)] shrink-0" />
              <span className="hidden sm:inline">
                {allFloorsCollapsed
                  ? getTranslation('ganttExpandFloors', language)
                  : getTranslation('ganttCollapseFloors', language)}
              </span>
            </button>
          )}

          {/* Batch Police Sheets Print Button (Today & Date Interval) */}
          {!activeRoleDefinition.permissions.isClientPortal && (
            <button
              type="button"
              onClick={() => setIsPoliceBatchPrintOpen(true)}
              className="flex h-7 shrink-0 items-center justify-center rounded-md border border-emerald-600/35 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/50 px-2 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              title={
                language === 'fr'
                  ? "Imprimer les fiches de police d'aujourd'hui ou d'un intervalle de dates"
                  : language === 'ar'
                  ? 'طباعة بطاقات الشرطة لليوم أو لفترة زمنية محددة'
                  : "Print today's or date-interval police sheets"
              }
            >
              <Printer size={12} className="shrink-0" />
              <span>
                {language === 'fr'
                  ? 'Fiches Police'
                  : language === 'ar'
                  ? 'بطاقات الشرطة'
                  : 'Police Sheets'}
              </span>
            </button>
          )}
          </div>
        </div>

        {/* Dedicated Timeline Search & Quick-Locate Row */}
        <div
          ref={searchBoxRef}
          className={`${isMobileScreen && !isGanttToolsOpen ? 'hidden' : 'relative flex'} min-w-0 flex-wrap items-center gap-1.5 border-t border-[rgb(var(--pms-border)/0.7)] px-2 py-1.5 md:px-3 ${isMobileScreen ? 'border-t-0 pt-1' : ''}`}
        >
          <div className="relative flex min-w-0 flex-1 items-center sm:max-w-md">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute start-2.5 text-slate-400 dark:text-slate-500"
            />
            <input
              type="search"
              value={timelineSearchQuery}
              onChange={(e) => {
                setTimelineSearchQuery(e.target.value);
                setIsSearchResultsOpen(true);
              }}
              onFocus={() => {
                if (timelineSearchQuery.trim()) {
                  setIsSearchResultsOpen(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matchingBookingResults.length > 0) {
                  e.preventDefault();
                  const targetIdx = e.shiftKey
                    ? (activeMatchIndex - 1 + matchingBookingResults.length) % matchingBookingResults.length
                    : activeMatchIndex;
                  locateBookingMatch(matchingBookingResults[targetIdx], targetIdx);
                  setIsSearchResultsOpen(true);
                } else if (e.key === 'Escape') {
                  if (isSearchResultsOpen) {
                    setIsSearchResultsOpen(false);
                  } else if (timelineSearchQuery) {
                    setTimelineSearchQuery('');
                    setLocatedBookingId(null);
                  }
                }
              }}
              placeholder={getTranslation('ganttSearchPlaceholder', language)}
              aria-label={getTranslation('ganttSearchLabel', language)}
              aria-expanded={Boolean(timelineSearchQuery.trim() && isSearchResultsOpen)}
              aria-controls="gantt-booking-search-results"
              className="h-9 sm:h-8 w-full min-w-0 rounded-lg border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] ps-8 pe-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {timelineSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setTimelineSearchQuery('');
                  setLocatedBookingId(null);
                  setIsSearchResultsOpen(false);
                }}
                aria-label={getTranslation('ganttSearchClear', language)}
                title={getTranslation('ganttSearchClear', language)}
                className="absolute end-1.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {effectiveSearchQuery.trim() && (
            <div className="flex items-center gap-1 shrink-0" role="status" aria-live="polite">
              <span className="inline-flex h-8 sm:h-7 items-center gap-1 rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] px-2 text-[11px] font-semibold font-mono tabular-nums text-slate-700 dark:text-slate-200">
                <Crosshair size={12} className="text-[var(--theme-primary)] shrink-0" />
                {matchingBookingResults.length > 0
                  ? `${Math.min(activeMatchIndex + 1, matchingBookingResults.length)} / ${matchingBookingResults.length}`
                  : getTranslation('ganttSearchMatchesCount', language).replace('{count}', '0')}
              </span>
              {matchingBookingResults.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => cycleBookingMatch(-1)}
                    aria-label={getTranslation('ganttSearchPrevMatch', language)}
                    title={getTranslation('ganttSearchPrevMatch', language)}
                    className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] text-slate-700 hover:bg-[rgb(var(--pms-accent)/0.1)] dark:text-slate-200 cursor-pointer"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleBookingMatch(1)}
                    aria-label={getTranslation('ganttSearchNextMatch', language)}
                    title={getTranslation('ganttSearchNextMatch', language)}
                    className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] text-slate-700 hover:bg-[rgb(var(--pms-accent)/0.1)] dark:text-slate-200 cursor-pointer"
                  >
                    <ChevronDown size={14} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Quick-Locate Booking Results Dropdown */}
          {timelineSearchQuery.trim() && isSearchResultsOpen && (
            <div
              id="gantt-booking-search-results"
              role="listbox"
              aria-label={getTranslation('ganttSearchLabel', language)}
              className="absolute start-2 end-2 sm:end-auto top-full z-[115] mt-1 sm:w-full sm:max-w-lg max-h-72 overflow-y-auto rounded-xl border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-1.5 shadow-2xl pms-dropdown"
            >
              {matchingBookingResults.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                  {getTranslation('ganttSearchNoBookings', language).replace('{query}', timelineSearchQuery.trim())}
                </div>
              ) : (
                matchingBookingResults.slice(0, 12).map((match, idx) => {
                  const isFocusedResult =
                    locatedBookingId === match.booking.id || idx === activeMatchIndex;
                  const pillStyle =
                    statusConfig[match.booking.status]?.pillBg ||
                    'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
                  const statusLabel =
                    statusConfig[match.booking.status]?.label[language] || match.booking.status;
                  return (
                    <button
                      key={match.booking.id}
                      type="button"
                      role="option"
                      aria-selected={isFocusedResult}
                      onClick={() => {
                        locateBookingMatch(match, idx);
                        setIsSearchResultsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-xs transition-colors cursor-pointer ${
                        isFocusedResult
                          ? 'bg-[rgb(var(--pms-accent)/0.12)] text-slate-900 dark:text-white ring-1 ring-[var(--theme-primary)]'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold truncate text-slate-900 dark:text-white">
                            {match.booking.guestName}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                            #{match.booking.id}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-[var(--theme-primary)]">
                            {match.resource.name}
                          </span>
                          <span className="font-mono tabular-nums">
                            {match.booking.startDate} → {match.booking.endDate}
                          </span>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${pillStyle}`}>
                        {statusLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
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
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl pms-modal"
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

      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Subtle 'Today' pill indicator anchored to the top of the scrollable timeline container, remains visible even when scrolling horizontally */}
      {isTodayInRange && (
        <button
          type="button"
          onClick={scrollToToday}
          className="hidden sm:flex absolute top-12 right-2 sm:right-6 z-[95] px-3 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-slate-900/95 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/70 shadow-md backdrop-blur-md items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer select-none active:scale-95 group"
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
      {/* Empty state: an active filter must never leave the workspace blank */}
      {filteredGroups.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[85] flex items-center justify-center p-4 pt-16">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] p-5 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <SearchX size={20} />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {hasDomainInventory
                ? language === 'fr'
                  ? 'Aucune chambre ne correspond aux filtres actifs'
                  : language === 'ar'
                    ? 'لا توجد غرفة تطابق عوامل التصفية النشطة'
                    : 'No room matches the active filters'
                : language === 'fr'
                  ? 'Aucune chambre importée'
                  : language === 'ar'
                    ? 'لم يتم استيراد أي غرفة'
                    : 'No room imported yet'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {hasDomainInventory
                ? language === 'fr'
                  ? 'La recherche, le bâtiment sélectionné ou les groupes repliés masquent tout l’inventaire.'
                  : language === 'ar'
                    ? 'البحث أو المبنى المحدد أو المجموعات المطوية يخفي كل المخزون.'
                    : 'The search, the selected building or the collapsed groups hide the whole inventory.'
                : language === 'fr'
                  ? 'Importez la base de l’établissement pour afficher le planning.'
                  : language === 'ar'
                    ? 'استورد قاعدة المؤسسة لعرض المخطط الزمني.'
                    : 'Import the property database to display the timeline.'}
            </p>
            {hasDomainInventory && (
              <button
                type="button"
                onClick={resetTimelineFilters}
                className="mt-4 min-h-10 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                {language === 'fr' ? 'Réinitialiser les filtres' : language === 'ar' ? 'إعادة تعيين عوامل التصفية' : 'Reset filters'}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onClickCapture={onTimelineClickCapture}
        onScroll={handleTimelineScroll}
        data-gantt-pan="true"
        className="flex-1 min-h-0 min-w-0 overflow-auto overscroll-contain flex touch-pan-x touch-pan-y [scrollbar-gutter:stable]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* LEFT COLUMN: Resource Tree */}
        <div
          data-gantt-resource-column="true"
          className={`${leftColWidthClass} shrink-0 ${
            isRTL ? 'border-l sticky right-0' : 'border-r sticky left-0'
          } border-[rgb(var(--pms-border))] pms-gantt-surface z-[90] select-none shadow-xs transition-all duration-200 flex flex-col`}
        >
          {/* Header of Resources Column with STICKY TOP-0 */}
          <div className={`${dayHeaderHeightClass} shrink-0 border-b border-[rgb(var(--pms-border))] px-2 sm:px-3 flex flex-col justify-center pms-gantt-surface sticky top-0 z-[80] isolate transition-[height,min-height,max-height] duration-200`}>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] md:text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
                {leftBarMode === 'mini'
                  ? (language === 'fr' ? 'Ress.' : language === 'ar' ? 'الموارد' : 'Res.')
                  : currentDomain === 'hotel'
                  ? getTranslation('ganttResourceColTitle', language)
                  : currentDomain === 'resort'
                  ? getTranslation('ganttResortResourceColTitle', language)
                  : getTranslation('ganttAccommodations', language)}
              </span>
            </div>
            <span className={`${isDayHeaderCollapsed ? "hidden" : "block"} text-[9px] md:text-[10px] text-[var(--theme-primary)] font-bold truncate mt-0.5`}>
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
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.id)}
                    data-gantt-group-toggle="true"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? (language === 'fr' ? 'Développer' : language === 'ar' ? 'توسيع' : 'Expand') : (language === 'fr' ? 'Réduire' : language === 'ar' ? 'طي' : 'Collapse')} ${grp.name[language] || grp.name.en}`}
                    className="w-full h-7 sm:h-8 min-h-[28px] sm:min-h-[32px] max-h-[28px] sm:max-h-[32px] shrink-0 px-2 sm:px-2.5 pms-gantt-subsurface flex items-center justify-between cursor-pointer hover:bg-[rgb(var(--pms-accent)/0.08)] transition-colors border-b border-[rgb(var(--pms-border))] text-left"
                  >
                    <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 truncate min-w-0 flex-1 mr-1 overflow-hidden">
                      {isCollapsed ? <ChevronRight size={13} className="shrink-0 text-slate-500" /> : <ChevronDown size={13} className="shrink-0 text-slate-500" />}
                      <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 min-w-0">
                        {grp.name[language] || grp.name.en}
                      </span>
                    </div>
                    {getSectorIcon(grp.sector)}
                  </button>

                  {/* Floor hierarchy and room details */}
                  {!isCollapsed && (floorGroupsByGroup.get(grp.id) ?? []).map((floorGroup) => (
                    <React.Fragment key={floorGroup.key}>
                      {floorGroup.label && (
                        <button
                          type="button"
                          onClick={() => toggleFloor(grp.id, floorGroup.key)}
                          aria-expanded={!collapsedFloors[`${grp.id}:${floorGroup.key}`]}
                          aria-label={`${collapsedFloors[`${grp.id}:${floorGroup.key}`] ? (language === 'fr' ? 'Développer' : language === 'ar' ? 'توسيع' : 'Expand') : (language === 'fr' ? 'Réduire' : language === 'ar' ? 'طي' : 'Collapse')} ${floorGroup.label}`}
                          className="h-7 min-h-[28px] max-h-[28px] w-full shrink-0 px-2 flex items-center justify-between bg-[rgb(var(--pms-surface)/0.9)] border-b border-[rgb(var(--pms-border)/0.7)] hover:bg-[rgb(var(--pms-accent)/0.06)] text-left cursor-pointer overflow-hidden"
                        >
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 truncate min-w-0">
                            {collapsedFloors[`${grp.id}:${floorGroup.key}`] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                            <span className="truncate">{floorGroup.label}</span>
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 shrink-0 ml-1">{floorGroup.resources.length}</span>
                        </button>
                      )}
                      {!collapsedFloors[`${grp.id}:${floorGroup.key}`] && floorGroup.resources.map((res) => {
                        const isOutOfOrder = res.housekeepingStatus === 'out_of_order';
                        return (
                          <div
                            key={res.id}
                            data-gantt-resource-row={res.id}
                            className={`h-10 sm:h-12 min-h-[40px] sm:min-h-[48px] max-h-[40px] sm:max-h-[48px] shrink-0 px-2 flex items-center justify-between border-b transition-colors overflow-hidden max-w-full ${
                              isOutOfOrder
                                ? 'bg-slate-200/90 dark:bg-slate-800/90 border-[rgb(var(--pms-border))] text-slate-400 opacity-80'
                                : 'pms-gantt-surface border-[rgb(var(--pms-border)/0.6)] hover:bg-[rgb(var(--pms-accent)/0.05)]'
                            }`}
                            title={`${res.name} · ${res.type || getTranslation('ganttRoom', language)} · ${floorGroup.label}${isOutOfOrder ? (language === 'fr' ? ' · HORS SERVICE (HS)' : language === 'ar' ? ' · خارج الخدمة' : ' · OUT OF ORDER') : ''}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                              {renderHousekeepingTag(res.housekeepingStatus, res.id, res.name)}
                              <div className="flex flex-col min-w-0 flex-1 overflow-hidden leading-tight">
                                <span
                                  className={`text-xs font-bold truncate ${
                                    isOutOfOrder
                                      ? 'line-through text-slate-500 dark:text-slate-400'
                                      : 'text-slate-800 dark:text-slate-100'
                                  }`}
                                  title={res.name}
                                >
                                  {res.name}
                                </span>
                                {leftBarMode !== 'mini' && (
                                  <span
                                    className="text-[10px] text-slate-500 dark:text-slate-400 truncate"
                                    title={res.type || getTranslation('ganttRoom', language)}
                                  >
                                    {res.type || getTranslation('ganttRoom', language)}
                                  </span>
                                )}
                              </div>
                              {isOutOfOrder && (
                                <span className="px-1 py-0.5 rounded text-[8px] font-bold font-mono bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                                  HS
                                </span>
                              )}
                            </div>
                            {leftBarMode === 'normal' && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0 hidden sm:inline ml-1">
                                {res.pricePerDay} {currency}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT AREA: Timeline Grid with Horizontal Scrolling */}
        <div className="flex-1 flex flex-col min-w-max min-h-max relative">
          {/* Live Current Time Line Marker: Exact coordinate on timeline canvas */}
          {isTodayInRange && (
            <div
              className="absolute top-0 bottom-0 min-h-full pointer-events-none z-30 flex flex-col items-center"
              style={{
                ...(isRTL
                  // In RTL, both the day columns and time within the day progress right-to-left.
                  ? { right: `${(todayIndex + (1 - currentHourFraction)) * colWidth}px` }
                  : { left: `${(todayIndex + currentHourFraction) * colWidth}px` }),
                transform: 'translateX(-50%)',
              }}
            >
              {/* Floating Pill Time Badge anchored smoothly */}
              <div className="sticky top-1 z-40 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono text-white bg-rose-600 shadow-md shadow-rose-600/50 whitespace-nowrap flex items-center gap-1.5 border-2 border-white dark:border-slate-900 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{timelineSync.currentTimeStr}</span>
              </div>
              {/* Continuous vertical red line passing down through the whole grid */}
              <div className="w-0.5 flex-1 bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            </div>
          )}

          {/* Timeline Header: Days row (Drag horizontally only when holding click) */}
          <div
            onPointerDown={onTimelinePointerDown}
            onPointerMove={onTimelinePointerMove}
            onPointerUp={onTimelinePointerEnd}
            onPointerCancel={onTimelinePointerEnd}
            data-gantt-day-header="true"
            className={`${dayHeaderHeightClass} shrink-0 border-b border-slate-200 dark:border-slate-800 flex bg-white dark:bg-slate-900 sticky top-0 z-[70] isolate select-none transition-[height,min-height,max-height] duration-200 ${
              isHeaderDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title={getTranslation('ganttScrollDragTip', language)}
          >
            {timelineLeadingSpacerWidth > 0 && (
              <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineLeadingSpacerWidth}px` }} />
            )}
            {renderedTimelineDays.map((day) => {
              const isCompactCols = colWidth < 46;
              const isDetailedCols = colWidth >= 115;
              const monthStartBorder = day.isFirstOfMonth
                ? isRTL
                  ? 'border-r-2 border-r-[var(--theme-primary)]/50'
                  : 'border-l-2 border-l-[var(--theme-primary)]/50'
                : '';

              return (
                <div
                  key={day.dateStr}
                  style={{ width: `${colWidth}px` }}
                  className={`shrink-0 border-r border-[rgb(var(--pms-border)/0.7)] ${monthStartBorder} flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors relative h-full overflow-hidden ${
                    day.isToday
                      ? "pms-gantt-today-col ring-1 ring-inset ring-[var(--theme-primary)]"
                      : day.isWeekend
                      ? "bg-slate-50/50 dark:bg-slate-900/40"
                      : ""
                  }`}
                >
                  {isDayHeaderCollapsed ? (
                    <span className={`text-[11px] font-bold tabular-nums ${day.isToday ? "text-[var(--theme-primary)] font-extrabold" : "text-slate-700 dark:text-slate-200"}`}>
                      {day.dayNum}
                    </span>
                  ) : (
                    <>
                      <span
                        className={`font-semibold uppercase tracking-wide truncate max-w-full ${
                          isCompactCols ? 'text-[9px]' : 'text-[10px] md:text-[11px]'
                        } ${day.isToday ? "text-[var(--theme-primary)] font-bold" : "text-slate-400"}`}
                      >
                        {day.isFirstOfMonth && isCompactCols
                          ? day.monthShort
                          : isCompactCols
                          ? day.dayName.slice(0, isRTL ? 2 : 1)
                          : day.dayName}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`font-bold tabular-nums leading-none ${
                            isCompactCols ? 'text-xs' : 'text-sm md:text-base'
                          } ${day.isToday ? "text-[var(--theme-primary)] font-extrabold" : "text-slate-800 dark:text-slate-100"}`}
                        >
                          {day.dayNum}
                        </span>
                        {(isDetailedCols || (day.isFirstOfMonth && !isCompactCols)) && (
                          <span className="text-[9px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                            {day.monthShort}
                          </span>
                        )}
                      </div>
                      {isDetailedCols && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 text-[8px] font-mono text-slate-400/80 dark:text-slate-500/80 tabular-nums">
                          <span>00h</span>
                          <span>12h</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {timelineTrailingSpacerWidth > 0 && (
              <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineTrailingSpacerWidth}px` }} />
            )}
          </div>

          {/* Resource Rows & Gantt Bars Matrix */}
          <div className="flex flex-col">
            {filteredGroups.map((grp) => {
              const isCollapsed = collapsedGroups[grp.id];

              return (
                <div key={grp.id} className="flex flex-col">
                  {/* Group Availability Row */}
                  <div className="h-7 sm:h-8 min-h-[28px] sm:min-h-[32px] max-h-[28px] sm:max-h-[32px] shrink-0 flex pms-gantt-subsurface border-b border-[rgb(var(--pms-border))] select-none">
                    {timelineLeadingSpacerWidth > 0 && (
                      <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineLeadingSpacerWidth}px` }} />
                    )}
                    {renderedTimelineDays.map((day) => {
                      const avail = groupAvailability[grp.id]?.[day.dateStr] ?? 0;
                      const isFree = avail > 0;
                      return (
                        <div
                          key={day.dateStr}
                          style={{ width: `${colWidth}px` }}
                          className="shrink-0 border-r border-[rgb(var(--pms-border)/0.6)] flex items-center justify-center p-0.5 h-full"
                        >
                          <button
                            type="button"
                            onClick={() => setShowAvailabilityHelp(true)}
                            className={`${colWidth < 36 ? 'w-4 h-4 text-[9px]' : 'w-5 h-4.5 text-[10px]'} rounded font-bold font-mono flex items-center justify-center shadow-2xs tabular-nums cursor-pointer hover:scale-110 active:scale-95 transition-transform focus:outline-none focus:ring-1 focus:ring-white ${
                              isFree ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'
                            }`}
                            title={`${avail} ${getTranslation('kpiAvailableRooms', language)} (${day.dateStr}) - ${language === 'fr' ? 'Cliquer pour comprendre le calcul' : language === 'ar' ? 'انقر لفهم الحساب' : 'Click to understand calculation'}`}
                            aria-label={`${avail} ${getTranslation('kpiAvailableRooms', language)}`}
                          >
                            {avail}
                          </button>
                        </div>
                      );
                    })}
                    {timelineTrailingSpacerWidth > 0 && (
                      <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineTrailingSpacerWidth}px` }} />
                    )}
                  </div>

                  {/* Floor headers and individual room rows */}
                  {!isCollapsed && (floorGroupsByGroup.get(grp.id) ?? []).map((floorGroup) => (
                    <React.Fragment key={floorGroup.key}>
                      {floorGroup.label && (
                        <div className="h-7 min-h-[28px] max-h-[28px] shrink-0 flex pms-gantt-subsurface border-b border-[rgb(var(--pms-border))]">
                          {timelineLeadingSpacerWidth > 0 && (
                            <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineLeadingSpacerWidth}px` }} />
                          )}
                          {renderedTimelineDays.map((day) => {
                            const available =
                              floorAvailability.get(`${grp.id}:${floorGroup.key}`)?.[day.dateStr] ??
                              floorGroup.resources.length;
                            return (
                              <div
                                key={day.dateStr}
                                style={{ width: `${colWidth}px` }}
                                className="shrink-0 border-r border-[rgb(var(--pms-border)/0.6)] flex items-center justify-center hover:bg-slate-200/80 dark:hover:bg-slate-700/70"
                              >
                                <button
                                  type="button"
                                  onClick={() => setShowAvailabilityHelp(true)}
                                  className={`text-[9px] font-mono font-semibold cursor-pointer hover:underline px-0.5 rounded transition-colors ${available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                                  title={`${available} ${getTranslation('kpiAvailableRooms', language)} - ${language === 'fr' ? 'Cliquer pour comprendre le calcul' : language === 'ar' ? 'انقر لفهم الحساب' : 'Click to understand calculation'}`}
                                  aria-label={`${available}/${floorGroup.resources.length} ${getTranslation('kpiAvailableRooms', language)}`}
                                >
                                  {available}/{floorGroup.resources.length}
                                </button>
                              </div>
                            );
                          })}
                          {timelineTrailingSpacerWidth > 0 && (
                            <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineTrailingSpacerWidth}px` }} />
                          )}
                        </div>
                      )}
                      {!collapsedFloors[`${grp.id}:${floorGroup.key}`] && floorGroup.resources.map((res) => {
                        const isOutOfOrder = res.housekeepingStatus === 'out_of_order';
                        // Find bookings on this specific resource (O(1) via precomputed index)
                        const resBookings = bookingsByResource.get(res.id) ?? [];

                        return (
                          <div
                            key={res.id}
                            className={`h-10 sm:h-12 min-h-[40px] sm:min-h-[48px] max-h-[40px] sm:max-h-[48px] shrink-0 flex relative border-b border-[rgb(var(--pms-border)/0.8)] transition-colors ${
                              isOutOfOrder
                                ? 'bg-slate-200 dark:bg-slate-800/90 select-none cursor-not-allowed opacity-90'
                                : 'pms-gantt-surface pms-gantt-row-hover'
                            }`}
                            style={{
                              contentVisibility: 'auto',
                              containIntrinsicSize: `1000px ${isMobileScreen ? 48 : 40}px`,
                            }}
                          >
                            {/* Background Grid Cells (clicking an empty bookable cell opens pre-filled booking modal) */}
                             {timelineLeadingSpacerWidth > 0 && (
                              <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineLeadingSpacerWidth}px` }} />
                            )}
                            {renderedTimelineDays.map((day) => {
                              const isPast = day.dateStr < realTodayStr;
                              const isEmptyBookable = isTimelineCellAvailableForQuickCreate(
                                res,
                                day.dateStr,
                                realTodayStr,
                                resBookings
                              );

                              if (isEmptyBookable) {
                                return (
                                  <button
                                    key={day.dateStr}
                                    type="button"
                                    data-quick-create="true"
                                    style={{ width: `${colWidth}px` }}
                                    onClick={() => openQuickCreateForCell(res, day.dateStr, resBookings)}
                                    aria-label={`${getTranslation('ganttQuickCreateLabel', language)} • ${res.name} • ${day.dateStr}`}
                                    title={`${getTranslation('ganttQuickCreateLabel', language)} • ${res.name} • ${day.dateStr}`}
                                    className={`relative shrink-0 border-r border-[rgb(var(--pms-border)/0.45)] h-full p-0 cursor-pointer pms-gantt-cell-hover pms-gantt-cell-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-primary)] ${
                                      day.isWeekend ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''
                                    }`}
                                  />
                                );
                              }

                              if (isOutOfOrder || isPast) {
                                return (
                                  <button
                                    key={day.dateStr}
                                    type="button"
                                    style={{ width: `${colWidth}px` }}
                                    onClick={() => {
                                      if (isOutOfOrder) {
                                        setTimelineNotice({
                                          title: language === 'fr' ? 'Chambre indisponible' : language === 'ar' ? 'الغرفة غير متاحة' : 'Room unavailable',
                                          message: language === 'fr'
                                            ? `La chambre ${res.name} est hors service. Aucune réservation ne peut être créée tant que son statut n’a pas été rétabli.`
                                            : language === 'ar'
                                            ? `الغرفة ${res.name} خارج الخدمة. لا يمكن إنشاء حجز قبل إعادة تفعيلها.`
                                            : `Room ${res.name} is out of service. A booking cannot be created until its status is restored.`,
                                          tone: 'danger',
                                          roomName: res.name,
                                          roomStatus: res.housekeepingStatus || 'out_of_order',
                                        });
                                        return;
                                      }
                                      setTimelineNotice({
                                        title: language === 'fr' ? 'Date déjà passée' : language === 'ar' ? 'التاريخ منقضٍ' : 'Date is in the past',
                                        message: language === 'fr'
                                          ? `Le ${day.dateStr} est antérieur à aujourd’hui. Choisissez une date actuelle ou future pour créer une réservation.`
                                          : language === 'ar'
                                          ? `التاريخ ${day.dateStr} يسبق تاريخ اليوم. اختر تاريخاً حالياً أو مستقبلياً لإنشاء الحجز.`
                                          : `${day.dateStr} is earlier than today. Choose today or a future date to create a booking.`,
                                        tone: 'info',
                                      });
                                    }}
                                    aria-label={
                                      isOutOfOrder
                                        ? `${res.name} ${getTranslation('ganttStatusOutOfOrder', language)}`
                                        : `${day.dateStr}`
                                    }
                                    title={
                                      isOutOfOrder
                                        ? `${res.name} ${getTranslation('ganttStatusOutOfOrder', language)}`
                                        : `${day.dateStr}`
                                    }
                                    className={`relative shrink-0 border-r border-[rgb(var(--pms-border)/0.45)] h-full p-0 transition-colors ${
                                      isOutOfOrder
                                        ? 'bg-slate-200/95 dark:bg-slate-800/90 cursor-not-allowed select-none opacity-80'
                                        : 'bg-slate-100/90 dark:bg-slate-900/60 cursor-not-allowed opacity-40 select-none'
                                    }`}
                                  />
                                );
                              }

                              return (
                                <div
                                  key={day.dateStr}
                                  style={{ width: `${colWidth}px` }}
                                  className={`relative shrink-0 border-r border-[rgb(var(--pms-border)/0.45)] h-full ${
                                    day.isWeekend ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''
                                  }`}
                                />
                              );
                            })}
                            {timelineTrailingSpacerWidth > 0 && (
                              <div aria-hidden="true" className="shrink-0 pointer-events-none" style={{ width: `${timelineTrailingSpacerWidth}px` }} />
                            )}

                          {/* Render Booking Gantt Bars overlaying the grid */}
                          {resBookings.map((bkg) => {
                            const geometry = computeTimelineBarGeometry({
                              startDate: bkg.startDate,
                              endDate: bkg.endDate,
                              windowStartDate: timelineWindowStart,
                              windowDays: timelineWindowDays,
                              colWidth,
                              checkInTime: bkg.checkInTime,
                              checkOutTime: bkg.checkOutTime,
                              isTimedStay: bkg.sector === 'hotel',
                            });
                            if (!geometry.visible) return null;

                            const { leftOffset, barWidth } = geometry;

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

                            const isConfirmed = bkg.status === 'confirmed';
                            const isLocated = locatedBookingId === bkg.id;

                            return (
                              <div
                                key={bkg.id}
                                data-booking-card="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(bkg);
                                  setIsNewBookingModalOpen(true);
                                }}
                                style={posStyle}
                                className={`pms-booking-bar ${isConfirmed ? 'pms-booking-bar-confirmed ' : ''}absolute top-1 sm:top-1.5 h-8 sm:h-9 rounded-md px-1 sm:px-1.5 md:px-2 flex items-center justify-between cursor-pointer shadow-xs hover:brightness-105 active:scale-[0.98] transition z-10 border ${statusStyle.bg} ${statusStyle.border} ${
                                  isLocated
                                    ? 'ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-slate-900 shadow-lg brightness-110 z-20'
                                    : ''
                                }`}
                              >
                                    <div className="flex items-center gap-1.5 truncate min-w-0">
                                      {/* Person icons: collapse when monthly bar is very narrow to keep guest name legible */}
                                      {barWidth >= 56 && (hasMultipleOccupants ? (
                                        <div
                                          className="flex items-center -space-x-1.5 rtl:space-x-reverse shrink-0 select-none py-0.5"
                                          title={`${occupantsCount} ${getTranslation('ganttOccupants', language)} (${adults} ${language === 'fr' ? 'adulte(s)' : language === 'ar' ? 'بالغ' : 'adult(s)'}${children > 0 ? `, ${children} ${language === 'fr' ? 'enfant(s)' : language === 'ar' ? 'طفل' : 'child(ren)'}` : ''})${
                                            overlappingBookings.length > 0
                                              ? ` • ${overlappingBookings.length} ${getTranslation('ganttSharedRoomBadge', language)}`
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
                                            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[8px] font-bold font-mono ring-1 ring-white/50 shadow-2xs tabular-nums shrink-0" title={getTranslation('ganttSharedRoomBadge', language)}>
                                              +{overlappingBookings.length}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div
                                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/25 text-white ring-1 ring-white/30 shrink-0 select-none"
                                          title={`1 ${language === 'fr' ? 'occupant (adulte)' : language === 'ar' ? 'نزيل بالغ' : 'occupant (adult)'}`}
                                        >
                                          <User size={10} className="drop-shadow-2xs" />
                                        </div>
                                      ))}

                                      {/* Nationality indicator */}
                                      {nationalityBadge && barWidth >= 48 && (
                                        <span className="text-[10px] shrink-0" title={isAlgerian ? 'Algérien (DZ)' : 'International'}>
                                          {nationalityBadge}
                                        </span>
                                      )}

                                      {isLocated && (
                                        <Crosshair size={11} className="shrink-0 text-amber-200" aria-hidden="true" />
                                      )}
                                      <span className="text-[10px] md:text-[11px] font-semibold truncate tracking-tight">
                                        {bkg.guestName}
                                      </span>
                                    </div>
                                    {barWidth >= 88 && (
                                      <span className="text-[9px] md:text-[10px] opacity-90 font-mono shrink-0 ml-1 hidden sm:inline tabular-nums">
                                        {displayPrice} {currencySymbol}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                    </React.Fragment>
                  ))}
                </div>
              );
            })}
              </div>
            </div>
          </div>
          </div>

          {selectedHousekeepingRoom && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-3"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedHousekeepingRoom(null);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="housekeeping-status-title"
                className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 id="housekeeping-status-title" className="text-base font-bold text-slate-900 dark:text-white">
                      {language === 'fr' ? 'Modifier le statut' : language === 'ar' ? 'تغيير الحالة' : 'Change status'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 truncate">
                      {selectedHousekeepingRoom.name}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedHousekeepingRoom(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}>
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    { value: 'clean', fr: 'Propre', en: 'Clean', ar: 'جاهزة', style: 'border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40', dot: 'bg-emerald-500' },
                    { value: 'cleaning', fr: 'En cours de nettoyage', en: 'Cleaning', ar: 'قيد التنظيف', style: 'border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950/40', dot: 'bg-amber-500' },
                    { value: 'dirty', fr: 'À nettoyer', en: 'Dirty', ar: 'تحتاج تنظيف', style: 'border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40', dot: 'bg-rose-500' },
                    { value: 'out_of_order', fr: 'Hors service / Maintenance', en: 'Out of order / Maintenance', ar: 'خارج الخدمة / صيانة', style: 'border-rose-300 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40', dot: 'bg-rose-600' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        updateHousekeepingStatus(selectedHousekeepingRoom.id, option.value);
                        setSelectedHousekeepingRoom(null);
                      }}
                      className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors ${option.style} ${selectedHousekeepingRoom.status === option.value ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                    >
                      <span className={`h-3 w-3 shrink-0 rounded-full ${option.dot}`} />
                      <span>{language === 'fr' ? option.fr : language === 'ar' ? option.ar : option.en}</span>
                      {selectedHousekeepingRoom.status === option.value && <CheckCircle2 size={16} className="ml-auto text-blue-600" />}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {timelineNotice && (() => {
            const isRoomAlert = Boolean(timelineNotice.roomName);
            const roomStatus = timelineNotice.roomStatus || 'out_of_order';
            const roomStyle = roomStatus === 'clean'
              ? { panel: 'border-emerald-300 dark:border-emerald-800', icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', accent: 'bg-emerald-500', statusLabel: language === 'fr' ? 'Propre' : language === 'ar' ? 'نظيفة' : 'Clean' }
              : roomStatus === 'cleaning'
              ? { panel: 'border-amber-300 dark:border-amber-800', icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', accent: 'bg-amber-500', statusLabel: language === 'fr' ? 'Nettoyage en cours' : language === 'ar' ? 'قيد التنظيف' : 'Cleaning' }
              : roomStatus === 'dirty'
              ? { panel: 'border-rose-300 dark:border-rose-800', icon: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', accent: 'bg-rose-500', statusLabel: language === 'fr' ? 'À nettoyer' : language === 'ar' ? 'تحتاج تنظيف' : 'Needs cleaning' }
              : { panel: 'border-rose-400 dark:border-rose-800', icon: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', accent: 'bg-rose-600', statusLabel: language === 'fr' ? 'Hors service' : language === 'ar' ? 'خارج الخدمة' : 'Out of service' };
            const severity = isRoomAlert || timelineNotice.tone === 'danger'
              ? { label: language === 'fr' ? 'Critique' : language === 'ar' ? 'حرج' : 'Critical', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' }
              : timelineNotice.tone === 'warning'
              ? { label: language === 'fr' ? 'Attention' : language === 'ar' ? 'تنبيه' : 'Warning', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' }
              : { label: language === 'fr' ? 'Information' : language === 'ar' ? 'معلومة' : 'Information', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
            const panel = isRoomAlert
              ? roomStyle
              : { panel: 'border-blue-300 dark:border-blue-800', icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', accent: 'bg-blue-500', statusLabel: language === 'fr' ? 'Règle de réservation' : language === 'ar' ? 'قاعدة الحجز' : 'Booking rule' };
            return (
              <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4 pms-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTimelineNotice(null); }}>
                <section role="alertdialog" aria-modal="true" aria-labelledby="timeline-notice-title" className={`w-full max-w-sm overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-slate-900 ${panel.panel} pms-modal`}>
                  <div className={`h-1.5 w-full ${panel.accent}`} />
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${panel.icon}`}>
                        {isRoomAlert ? <Bed size={21} /> : <CalendarDays size={21} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${severity.badge}`}>{severity.label}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${panel.icon}`}>{panel.statusLabel}</span>
                        </div>
                        <h2 id="timeline-notice-title" className="text-base font-bold text-slate-900 dark:text-white">{timelineNotice.title}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{timelineNotice.message}</p>
                      </div>
                      <button type="button" onClick={() => setTimelineNotice(null)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}><X size={18} /></button>
                    </div>
                    {isRoomAlert && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 dark:border-rose-900/70 dark:bg-rose-950/30">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600" />
                        <span className="text-xs font-semibold text-rose-900 dark:text-rose-200">{language === 'fr' ? 'Chambre concernée' : language === 'ar' ? 'الغرفة المعنية' : 'Affected room'}</span>
                        <span className="ml-auto truncate text-sm font-bold text-rose-900 dark:text-rose-100">{timelineNotice.roomName}</span>
                      </div>
                    )}
                    <div className="mt-5 flex justify-end">
                      <button type="button" autoFocus onClick={() => setTimelineNotice(null)} className="min-h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">{language === 'fr' ? 'Compris' : language === 'ar' ? 'حسناً' : 'Got it'}</button>
                    </div>
                  </div>
                </section>
              </div>
            );
          })()}

      {isPoliceBatchPrintOpen && (
        <React.Suspense fallback={null}>
          <BookingPrintReportModal
            isOpen
            onClose={() => setIsPoliceBatchPrintOpen(false)}
            initialMode="today"
          />
        </React.Suspense>
      )}
    </div>
  );
};