import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  CheckSquare,
  Square,
  Trash2,
  ArrowRightLeft,
  ListChecks,
  Check,
  Undo2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ResourceGroup, ResourceItem, TimelineBooking, BookingStatus } from '../types/booking';
import { statusConfig } from './LegendBar';
import { getTranslation } from '../i18n/translations';
import { downloadICS } from '../utils/icsExport';
import { useTimelineSync } from '../hooks/useTimelineSync';
import {
  shouldStartTimelineDrag,
  computeTimelineDragScroll,
  TimelineDragState,
} from '../utils/timelineDragPan';

export const PlanningTimeline: React.FC = () => {
  const {
    language,
    currentBaseDate,
    setCurrentBaseDate,
    dateRangeMode,
    bookings,
    setBookings,
    searchQuery,
    currentDomain,
    currentRole,
    resourceGroups,
    setSelectedBooking,
    setIsNewBookingModalOpen,
    setNewBookingInitialSlot,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    checkConflict,
    updateHousekeepingStatus,
    selectedEstablishmentId,
    setSelectedEstablishmentId,
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

  // The Gantt filter must reflect actual inventory: imported CardLock buildings
  // and buildings created locally in the establishment setup screen.
  const hotelBuildingOptions = useMemo(
    () => resourceGroups.filter((group) => group.sector === 'hotel'),
    [resourceGroups]
  );

  useEffect(() => {
    if (
      selectedEstablishmentId !== 'all' &&
      !hotelBuildingOptions.some((group) => group.id === selectedEstablishmentId)
    ) {
      setSelectedEstablishmentId('all');
    }
  }, [hotelBuildingOptions, selectedEstablishmentId, setSelectedEstablishmentId]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPanRef = useRef<TimelineDragState | null>(null);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);
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
  const [scrollVisibleDate, setScrollVisibleDate] = useState<string>(() => currentBaseDate);
  useEffect(() => { window.localStorage.setItem('appointment.gantt.columnZoom', columnZoomMode); }, [columnZoomMode]);
  useEffect(() => { window.localStorage.setItem('appointment.gantt.leftDensity', leftBarMode); }, [leftBarMode]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    setIsMobileScreen(media.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsMobileScreen(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  const lastScrollLeftRef = useRef(0);
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
  };

  // Dynamic day column width adapted to viewport
  const colWidth = useMemo(() => {
    if (isMobileScreen) {
      return columnZoomMode === 'compact' ? 34 : columnZoomMode === 'wide' ? 80 : 54;
    }
    return columnZoomMode === 'compact' ? 44 : columnZoomMode === 'wide' ? 144 : 100;
  }, [columnZoomMode, isMobileScreen]);

  // Stable day header height to prevent vertical jitter during scroll
  const dayHeaderHeightClass = isMobileScreen
    ? 'h-10 min-h-[40px] max-h-[40px]'
    : 'h-12 min-h-[48px] max-h-[48px]';

  // Collapsed state for resource groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedFloors, setCollapsedFloors] = useState<Record<string, boolean>>({});

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

  // Continuous stable 3-month window centered on the active month (prev month, active month, next month).
  // This completely eliminates runaway prepending and date skipping!
  const { timelineWindowStart, timelineWindowDays } = useMemo(() => {
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;
    // Start of previous month
    const prevMonthDate = new Date(safeYear, safeMonth - 2, 1);
    const startStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    // End of next month
    const nextMonthEndDate = new Date(safeYear, safeMonth + 1, 0);
    const diffTime = nextMonthEndDate.getTime() - prevMonthDate.getTime();
    const total = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return { timelineWindowStart: startStr, timelineWindowDays: Math.max(60, total) };
  }, [currentBaseDate]);

  const goToPreviousMonth = () => {
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;
    const prev = new Date(safeYear, safeMonth - 2, 1);
    const iso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
    setCurrentBaseDate(iso);
  };

  const goToNextMonth = () => {
    const [y, m] = currentBaseDate.split('-').map(Number);
    const safeYear = y || new Date().getFullYear();
    const safeMonth = m || new Date().getMonth() + 1;
    const next = new Date(safeYear, safeMonth, 1);
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
    const dates: { dateStr: string; dayNum: number; dayName: string; isWeekend: boolean; isToday: boolean }[] = [];

    const realTodayStr = timelineSync.todayDateStr;

    const dayFormatter = new Intl.DateTimeFormat(
      language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US',
      { weekday: 'short' }
    );

    for (let i = 0; i < timelineWindowDays; i++) {
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
  }, [timelineWindowStart, timelineWindowDays, language, timelineSync.todayDateStr]);

  // Center timeline on currentBaseDate when it changes (or on mount)
  const hasCenteredInitialDateRef = useRef(false);
  useEffect(() => {
    const idx = timelineDays.findIndex((day) => day.dateStr === currentBaseDate);
    if (idx >= 0 && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      const target = Math.max(0, idx * colWidth - (isMobileScreen ? 20 : 60));
      el.scrollTo({
        left: target * (isRTL ? -1 : 1),
        behavior: hasCenteredInitialDateRef.current ? 'smooth' : 'auto',
      });
      hasCenteredInitialDateRef.current = true;
    }
  }, [currentBaseDate, timelineDays, colWidth, isRTL, isMobileScreen]);

  // Derive the marker index from the exact date rendered in the day columns.
  // This keeps the red marker aligned even when the timeline window is extended/prepended.
  const currentTimeStr = timelineSync.currentTimeStr;
  const currentHourFraction = timelineSync.currentHourFraction;
  const realTodayStr = timelineSync.todayDateStr;
  const todayIndex = timelineDays.findIndex((day) => day.dateStr === realTodayStr);
  const isTodayInRange = todayIndex >= 0;

  // Filter resource groups strictly by currentDomain (NEVER MIX) & searchQuery & establishment
  const filteredGroups = useMemo(() => {
    return resourceGroups
      .filter((grp) =>
        grp.sector === currentDomain &&
        (currentDomain !== 'hotel' || selectedEstablishmentId === 'all' || grp.id === selectedEstablishmentId)
      )
      .map((grp) => {
        let matchingResources = grp.resources;
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
      .filter((grp) => grp.resources.length > 0 || (currentDomain === 'hotel' && !searchQuery.trim()));
  }, [currentDomain, resourceGroups, searchQuery, bookings, selectedEstablishmentId]);

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
        let floor = resource.floor?.trim() || '';
        if (!floor) {
          const pureDigits = resource.name.replace(/\D/g, '');
          if (pureDigits.length >= 3) {
            floor = pureDigits[0];
          } else if (pureDigits.length > 0) {
            floor = '1';
          } else {
            floor = '1';
          }
        }

        const rawWing = resource.wing?.trim();
        const wing = rawWing || (language === 'fr' ? 'Aile Principale' : language === 'ar' ? 'الجناح الرئيسي' : 'Main Wing');

        let subKey = floor;
        let subLabel = language === 'fr' ? `Étage ${floor}` : language === 'ar' ? `الطابق ${floor}` : `Floor ${floor}`;
        let shortLabel = language === 'ar' ? `ط${floor}` : `É${floor}`;
        let sortKey = floor.padStart(4, '0');

        if (groupingMode === 'wing') {
          subKey = wing;
          subLabel = wing;
          shortLabel = wing.substring(0, 4);
          sortKey = wing;
        } else if (groupingMode === 'floor_wing') {
          subKey = `${floor}_${wing}`;
          subLabel = `${language === 'fr' ? 'Étage' : language === 'ar' ? 'الطابق' : 'Floor'} ${floor} • ${wing}`;
          shortLabel = `${language === 'ar' ? 'ط' : 'É'}${floor} • ${wing.substring(0, 4)}`;
          sortKey = `${floor.padStart(4, '0')}_${wing}`;
        }

        const existing = subgroups.get(subKey) ?? { label: subLabel, shortLabel, sortKey, resources: [] };
        existing.resources.push(resource);
        subgroups.set(subKey, existing);
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

  // Batch selection mode state
  const [isBatchSelectionMode, setIsBatchSelectionMode] = useState<boolean>(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(() => new Set());
  const [isBatchShiftModalOpen, setIsBatchShiftModalOpen] = useState<boolean>(false);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState<boolean>(false);
  const [isBatchStatusMenuOpen, setIsBatchStatusMenuOpen] = useState<boolean>(false);
  const [isBatchStatusModalOpen, setIsBatchStatusModalOpen] = useState<boolean>(false);
  const [batchShiftDays, setBatchShiftDays] = useState<number>(1);
  const [batchFeedback, setBatchFeedback] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Undo history for batch move, deletion, or status change
  type BatchActionRecord =
    | {
        type: 'shift';
        description: string;
        items: Array<{ id: string; startDate: string; endDate: string }>;
      }
    | {
        type: 'delete';
        description: string;
        deletedBookings: TimelineBooking[];
      }
    | {
        type: 'status';
        description: string;
        items: Array<{ id: string; status: BookingStatus }>;
      };

  const [lastBatchAction, setLastBatchAction] = useState<BatchActionRecord | null>(null);

  // Toggle batch selection mode
  const toggleBatchMode = () => {
    setIsBatchSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedBookingIds(new Set());
        setIsBatchShiftModalOpen(false);
        setIsBatchDeleteConfirmOpen(false);
        setIsBatchStatusMenuOpen(false);
      }
      return next;
    });
  };

  const toggleBookingSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedBookingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Visible bookings in the current timeline view
  const visibleBookingsInTimeline = useMemo(() => {
    const visibleResourceIds = new Set(
      filteredGroups.flatMap((g) => g.resources).map((r) => r.id)
    );
    const firstDate = timelineDays[0]?.dateStr || '';
    const lastDate = timelineDays[timelineDays.length - 1]?.dateStr || '';
    return bookings.filter(
      (b) =>
        visibleResourceIds.has(b.resourceId) &&
        b.status !== 'cancelled' &&
        b.endDate > firstDate &&
        b.startDate <= lastDate
    );
  }, [bookings, filteredGroups, timelineDays]);

  const areAllVisibleSelected = useMemo(() => {
    if (visibleBookingsInTimeline.length === 0) return false;
    return visibleBookingsInTimeline.every((b) => selectedBookingIds.has(b.id));
  }, [visibleBookingsInTimeline, selectedBookingIds]);

  const selectAllVisibleBookings = () => {
    const next = new Set(selectedBookingIds);
    visibleBookingsInTimeline.forEach((b) => next.add(b.id));
    setSelectedBookingIds(next);
  };

  const deselectAllBookings = () => {
    setSelectedBookingIds(new Set());
  };

  const selectedBookingsList = useMemo(() => {
    return bookings.filter((b) => selectedBookingIds.has(b.id));
  }, [bookings, selectedBookingIds]);

  const shiftIsoDate = (dateStr: string, days: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    const newY = dt.getFullYear();
    const newM = String(dt.getMonth() + 1).padStart(2, '0');
    const newD = String(dt.getDate()).padStart(2, '0');
    return `${newY}-${newM}-${newD}`;
  };

  // Batch shift execution with conflict checking and undo recording
  const handleBatchShift = (days: number) => {
    if (selectedBookingIds.size === 0 || days === 0) return;
    let conflictCount = 0;
    const updatesToApply: Array<{ id: string; startDate: string; endDate: string }> = [];

    // Capture previous state for Undo
    const previousSlots = selectedBookingsList.map((b) => ({
      id: b.id,
      startDate: b.startDate,
      endDate: b.endDate,
    }));

    for (const bkg of selectedBookingsList) {
      const newStart = shiftIsoDate(bkg.startDate, days);
      const newEnd = shiftIsoDate(bkg.endDate, days);
      const hasConflict = checkConflict(bkg.resourceId, newStart, newEnd, bkg.id);
      if (hasConflict) {
        conflictCount++;
      }
      updatesToApply.push({ id: bkg.id, startDate: newStart, endDate: newEnd });
    }

    if (conflictCount > 0) {
      setBatchFeedback({
        message: getTranslation('ganttBatchConflictDetected', language).replace('{count}', String(conflictCount)),
        type: 'warning',
      });
    } else {
      setBatchFeedback({
        message: getTranslation('ganttBatchMoveSuccess', language)
          .replace('{count}', String(updatesToApply.length))
          .replace('{days}', String(days > 0 ? `+${days}` : days)),
        type: 'success',
      });
    }

    updatesToApply.forEach((u) => {
      updateBooking(u.id, { startDate: u.startDate, endDate: u.endDate });
    });

    setLastBatchAction({
      type: 'shift',
      description: `${updatesToApply.length} ${language === 'fr' ? 'réservations déplacées' : language === 'ar' ? 'حجوزات تم نقلها' : 'bookings shifted'} (${days > 0 ? `+${days}` : days}j)`,
      items: previousSlots,
    });

    setIsBatchShiftModalOpen(false);
    setTimeout(() => setBatchFeedback(null), 4000);
  };

  // Batch delete execution with undo recording
  const handleBatchDelete = () => {
    const count = selectedBookingIds.size;
    if (count === 0) return;

    // Capture snapshot for Undo
    const deletedSnapshot = [...selectedBookingsList];

    selectedBookingIds.forEach((id) => {
      deleteBooking(id);
    });

    setLastBatchAction({
      type: 'delete',
      description: `${deletedSnapshot.length} ${language === 'fr' ? 'réservations supprimées' : language === 'ar' ? 'حجوزات محذوفة' : 'deleted bookings'}`,
      deletedBookings: deletedSnapshot,
    });

    setSelectedBookingIds(new Set());
    setIsBatchDeleteConfirmOpen(false);
    setBatchFeedback({
      message: getTranslation('ganttBatchDeleteSuccess', language).replace('{count}', String(count)),
      type: 'success',
    });
    setTimeout(() => setBatchFeedback(null), 4000);
  };

  // Batch status change execution with undo recording
  const handleBatchStatusChange = (newStatus: BookingStatus) => {
    const count = selectedBookingIds.size;
    if (count === 0) return;

    // Capture previous status for Undo
    const previousStatuses = selectedBookingsList.map((b) => ({
      id: b.id,
      status: b.status,
    }));

    selectedBookingIds.forEach((id) => {
      updateBookingStatus(id, newStatus);
    });

    setLastBatchAction({
      type: 'status',
      description: `${count} ${language === 'fr' ? 'statuts modifiés' : language === 'ar' ? 'حالات تم تعديلها' : 'statuses updated'}`,
      items: previousStatuses,
    });

    setIsBatchStatusMenuOpen(false);
    setIsBatchStatusModalOpen(false);
    setBatchFeedback({
      message: getTranslation('ganttBatchStatusSuccess', language).replace('{count}', String(count)),
      type: 'success',
    });
    setTimeout(() => setBatchFeedback(null), 4000);
  };

  // Undo the last batch action (move, deletion, or status update)
  const handleUndoBatchAction = () => {
    if (!lastBatchAction) return;

    if (lastBatchAction.type === 'shift') {
      lastBatchAction.items.forEach((item) => {
        updateBooking(item.id, { startDate: item.startDate, endDate: item.endDate });
      });
      setSelectedBookingIds(new Set(lastBatchAction.items.map((i) => i.id)));
      setBatchFeedback({
        message: getTranslation('ganttBatchUndoSuccess', language),
        type: 'success',
      });
    } else if (lastBatchAction.type === 'delete') {
      const toRestore = lastBatchAction.deletedBookings;
      setBookings((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const filtered = toRestore.filter((b) => !existingIds.has(b.id));
        return [...filtered, ...prev];
      });
      setSelectedBookingIds(new Set(toRestore.map((b) => b.id)));
      setBatchFeedback({
        message: getTranslation('ganttBatchUndoSuccess', language),
        type: 'success',
      });
    } else if (lastBatchAction.type === 'status') {
      lastBatchAction.items.forEach((item) => {
        updateBookingStatus(item.id, item.status);
      });
      setSelectedBookingIds(new Set(lastBatchAction.items.map((i) => i.id)));
      setBatchFeedback({
        message: getTranslation('ganttBatchUndoSuccess', language),
        type: 'success',
      });
    }

    setLastBatchAction(null);
    setTimeout(() => setBatchFeedback(null), 4000);
  };

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
        <div className="flex min-w-0 flex-row items-center gap-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap px-1.5 py-1 sm:overflow-visible md:px-3 md:py-1 scrollbar-thin">
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

          {/* Day column zoom */}
          <div className="hidden sm:flex h-7 shrink-0 items-center rounded-md border border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-canvas))] p-0.5 text-[10px] font-semibold">
            <button
              onClick={() => setColumnZoomMode('compact')}
              className={`h-6 rounded px-2 transition-colors cursor-pointer ${columnZoomMode === 'compact' ? 'bg-[rgb(var(--pms-surface))] text-[var(--theme-primary)] shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400'}`}
              title={getTranslation('ganttZoomNarrow', language)}
              aria-pressed={columnZoomMode === 'compact'}
            >{getTranslation('ganttZoomNarrow', language)}</button>
            <button
              onClick={() => setColumnZoomMode('standard')}
              className={`h-6 rounded px-2 transition-colors cursor-pointer ${columnZoomMode === 'standard' ? 'bg-[rgb(var(--pms-surface))] text-[var(--theme-primary)] shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400'}`}
              title={getTranslation('ganttZoomNormal', language)}
              aria-pressed={columnZoomMode === 'standard'}
            >{getTranslation('ganttZoomNormal', language)}</button>
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

          {/* Batch Selection Mode Checkbox / Button */}
          <button
            type="button"
            onClick={toggleBatchMode}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isBatchSelectionMode
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/70 dark:text-blue-300 ring-1 ring-blue-500/40 font-bold'
                : 'border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] text-slate-700 dark:text-slate-300 hover:bg-[rgb(var(--pms-accent)/0.08)]'
            }`}
            title={getTranslation('ganttBatchMode', language)}
            aria-pressed={isBatchSelectionMode}
          >
            {isBatchSelectionMode ? (
              <CheckSquare size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
            ) : (
              <Square size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
            )}
            <span className="whitespace-nowrap">{getTranslation('ganttBatchMode', language)}</span>
            {isBatchSelectionMode && selectedBookingIds.size > 0 && (
              <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold bg-blue-600 text-white">
                {selectedBookingIds.size}
              </span>
            )}
          </button>

          {/* Undo Last Batch Action Button in Header Toolbar */}
          <button
            type="button"
            disabled={!lastBatchAction}
            onClick={handleUndoBatchAction}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold transition-all cursor-pointer shadow-2xs ${
              lastBatchAction
                ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500/80 dark:bg-amber-950/70 dark:text-amber-200 ring-1 ring-amber-500/40 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/80 active:scale-95'
                : 'border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
            }`}
            title={
              lastBatchAction
                ? `${getTranslation('ganttBatchUndoAction', language)}: ${lastBatchAction.description}`
                : getTranslation('ganttBatchUndoAction', language)
            }
            aria-label={getTranslation('ganttBatchUndoAction', language)}
          >
            <Undo2 size={13} className={lastBatchAction ? 'text-amber-600 dark:text-amber-400 shrink-0' : 'text-slate-400 dark:text-slate-600 shrink-0'} />
            <span className="whitespace-nowrap">{getTranslation('ganttBatchUndoAction', language)}</span>
          </button>
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

      {/* Subtle 'Today' pill indicator anchored to the top of the scrollable timeline container, remains visible even when scrolling horizontally */}
      {isTodayInRange && (
        <button
          type="button"
          onClick={scrollToToday}
          className="absolute top-[42px] sm:top-[42px] right-2 sm:right-6 z-[95] px-3 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-slate-900/95 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/70 shadow-md backdrop-blur-md flex items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer select-none active:scale-95 group"
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
              {isBatchSelectionMode && (
                <button
                  type="button"
                  onClick={areAllVisibleSelected ? deselectAllBookings : selectAllVisibleBookings}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer p-0.5 rounded transition-transform active:scale-95"
                  title={areAllVisibleSelected ? getTranslation('ganttBatchDeselectAll', language) : getTranslation('ganttBatchSelectAll', language)}
                  aria-label={areAllVisibleSelected ? getTranslation('ganttBatchDeselectAll', language) : getTranslation('ganttBatchSelectAll', language)}
                >
                  {areAllVisibleSelected ? <CheckSquare size={13} className="text-blue-600 dark:text-blue-400" /> : <Square size={13} className="text-slate-400" />}
                </button>
              )}
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
            {timelineDays.map((day) => (
              <div
                key={day.dateStr}
                style={{ width: `${colWidth}px` }}
                className={`shrink-0 border-r border-[rgb(var(--pms-border)/0.7)] flex flex-col items-center justify-center gap-0.5 px-1 transition-colors relative h-full overflow-hidden ${
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
                    <span className={`text-[10px] md:text-[11px] font-semibold uppercase tracking-wide ${day.isToday ? "text-[var(--theme-primary)] font-bold" : "text-slate-400"}`}>
                      {day.dayName}
                    </span>
                    <span className={`text-sm md:text-base font-bold tabular-nums ${day.isToday ? "text-[var(--theme-primary)] font-extrabold" : "text-slate-800 dark:text-slate-100"}`}>
                      {day.dayNum}
                    </span>
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
                  <div className="h-7 sm:h-8 min-h-[28px] sm:min-h-[32px] max-h-[28px] sm:max-h-[32px] shrink-0 flex pms-gantt-subsurface border-b border-[rgb(var(--pms-border))] select-none">
                    {timelineDays.map((day) => {
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
                            className={`w-5 h-4.5 rounded text-[10px] font-bold font-mono flex items-center justify-center shadow-2xs tabular-nums cursor-pointer hover:scale-110 active:scale-95 transition-transform focus:outline-none focus:ring-1 focus:ring-white ${
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
                  </div>

                  {/* Floor headers and individual room rows */}
                  {!isCollapsed && (floorGroupsByGroup.get(grp.id) ?? []).map((floorGroup) => (
                    <React.Fragment key={floorGroup.key}>
                      {floorGroup.label && (
                        <div className="h-7 min-h-[28px] max-h-[28px] shrink-0 flex pms-gantt-subsurface border-b border-[rgb(var(--pms-border))]">
                          {timelineDays.map((day) => {
                            const occupied = floorGroup.resources.filter((resource) =>
                              bookings.some((booking) =>
                                booking.resourceId === resource.id &&
                                booking.status !== 'cancelled' &&
                                booking.startDate <= day.dateStr &&
                                booking.endDate > day.dateStr
                              )
                            ).length;
                            const available = Math.max(0, floorGroup.resources.length - occupied);
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
                        </div>
                      )}
                      {!collapsedFloors[`${grp.id}:${floorGroup.key}`] && floorGroup.resources.map((res) => {
                        const isOutOfOrder = res.housekeepingStatus === 'out_of_order';
                        // Find bookings on this specific resource
                        const resBookings = bookings.filter((b) => b.resourceId === res.id);

                        return (
                          <div
                            key={res.id}
                            className={`h-10 sm:h-12 min-h-[40px] sm:min-h-[48px] max-h-[40px] sm:max-h-[48px] shrink-0 flex relative border-b border-[rgb(var(--pms-border)/0.8)] transition-colors ${
                              isOutOfOrder
                                ? 'bg-slate-200 dark:bg-slate-800/90 select-none cursor-not-allowed opacity-90'
                                : 'pms-gantt-surface pms-gantt-row-hover'
                            }`}
                          >
                            {/* Background Grid Cells for clicking to add booking */}
                            {timelineDays.map((day) => {
                              const isPast = day.dateStr < realTodayStr;
                              const isCellDisabled = isOutOfOrder || isPast;

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
                                    if (isPast) {
                                      setTimelineNotice({
                                        title: language === 'fr' ? 'Date déjà passée' : language === 'ar' ? 'التاريخ منقضٍ' : 'Date is in the past',
                                        message: language === 'fr'
                                          ? `Le ${day.dateStr} est antérieur à aujourd’hui. Choisissez une date actuelle ou future pour créer une réservation.`
                                          : language === 'ar'
                                          ? `التاريخ ${day.dateStr} يسبق تاريخ اليوم. اختر تاريخاً حالياً أو مستقبلياً لإنشاء الحجز.`
                                          : `${day.dateStr} is earlier than today. Choose today or a future date to create a booking.`,
                                        tone: 'info',
                                      });
                                      return;
                                    }
                                    setActivePreviewBooking(null);
                                    setNewBookingInitialSlot({
                                      resourceId: res.id,
                                      date: day.dateStr,
                                    });
                                    setIsNewBookingModalOpen(true);
                                  }}
                                  aria-label={
                                    isOutOfOrder
                                      ? `${res.name} ${getTranslation('ganttStatusOutOfOrder', language)}`
                                      : isPast
                                      ? `${day.dateStr}`
                                      : `${getTranslation('bookRoom', language)} • ${res.name} • ${day.dateStr}`
                                  }
                                  title={
                                    isOutOfOrder
                                      ? `${res.name} ${getTranslation('ganttStatusOutOfOrder', language)}`
                                      : isPast
                                      ? `${day.dateStr}`
                                      : `${getTranslation('bookRoom', language)} • ${res.name} • ${day.dateStr}`
                                  }
                                  className={`relative shrink-0 border-r border-[rgb(var(--pms-border)/0.45)] h-full p-0 transition-colors ${
                                    isOutOfOrder
                                      ? 'bg-slate-200/95 dark:bg-slate-800/90 cursor-not-allowed select-none opacity-80'
                                      : isPast
                                      ? 'bg-slate-100/90 dark:bg-slate-900/60 cursor-not-allowed opacity-40 select-none'
                                      : `cursor-pointer pms-gantt-cell-hover pms-gantt-cell-active ${
                                          day.isWeekend ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''
                                        }`
                                  }`}
                                />
                              );
                            })}

                          {/* Render Booking Gantt Bars overlaying the grid */}
                          {resBookings.map((bkg) => {
                            const firstVisibleDate = timelineDays[0]?.dateStr;
                            const lastVisibleDate = timelineDays[timelineDays.length - 1]?.dateStr;

                            // Skip if outside visible timeline range
                            if (bkg.endDate <= firstVisibleDate || bkg.startDate > lastVisibleDate) return null;

                            const startIndex = getDateIndex(bkg.startDate);
                            const endIndex = getDateIndex(bkg.endDate);

                            const visibleStart = startIndex === -1 ? 0 : startIndex;
                            const visibleEnd = endIndex === -1 ? timelineDays.length : endIndex;

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

                            const isConfirmed = bkg.status === 'confirmed';
                            const isSelected = selectedBookingIds.has(bkg.id);

                            return (
                              <div
                                key={bkg.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isBatchSelectionMode) {
                                    toggleBookingSelection(bkg.id, e);
                                  } else {
                                    setSelectedBooking(bkg);
                                    setIsNewBookingModalOpen(true);
                                    setActivePreviewBooking(null);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  if (!isMobileScreen && !isBatchSelectionMode) {
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
                                  if (!isMobileScreen && !isBatchSelectionMode) schedulePreviewClose();
                                }}
                                style={posStyle}
                                className={`pms-booking-bar ${isConfirmed ? 'pms-booking-bar-confirmed ' : ''}absolute top-1 sm:top-1.5 h-8 sm:h-9 rounded-md px-1 sm:px-1.5 md:px-2 flex items-center justify-between cursor-pointer shadow-xs hover:brightness-105 active:scale-[0.98] transition z-10 border ${statusStyle.bg} ${statusStyle.border} ${
                                  isSelected
                                    ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md brightness-110 z-20 scale-[1.01]'
                                    : ''
                                }`}
                              >
                                    <div className="flex items-center gap-1.5 truncate min-w-0">
                                      {/* Batch selection checkbox indicator on booking bar */}
                                      {isBatchSelectionMode && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleBookingSelection(bkg.id, e);
                                          }}
                                          className="shrink-0 flex items-center justify-center -ml-0.5 mr-0.5 rtl:-mr-0.5 rtl:ml-0.5 z-20 cursor-pointer focus:outline-none"
                                          title={isSelected ? getTranslation('ganttBatchDeselectAll', language) : getTranslation('ganttBatchSelectAll', language)}
                                          aria-label={isSelected ? getTranslation('ganttBatchDeselectAll', language) : getTranslation('ganttBatchSelectAll', language)}
                                        >
                                          {isSelected ? (
                                            <CheckSquare size={13} className="text-white drop-shadow-sm fill-blue-600" />
                                          ) : (
                                            <Square size={13} className="text-white/80 drop-shadow-xs" />
                                          )}
                                        </button>
                                      )}
                                      {/* Person icons: if multiple occupants occupy the room, render stacked group of person icons */}
                                      {hasMultipleOccupants ? (
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
                                      )}

                                      {/* Nationality indicator */}
                                      {nationalityBadge && (
                                        <span className="text-[10px] shrink-0" title={isAlgerian ? 'Algérien (DZ)' : 'International'}>
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
                    </React.Fragment>
                  ))}
                </div>
              );
            })}
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

          {/* Floating Tooltip Card for Desktop */}
          {activePreviewBooking && !activePreviewBooking.isMobileSheet && activePreviewBooking.x !== undefined && (
            <div
              style={{
                position: 'fixed',
                left: `${Math.min(window.innerWidth - 270, Math.max(10, activePreviewBooking.x))}px`,
                top: `${Math.min(window.innerHeight - 250, activePreviewBooking.y ?? 100)}px`,
              }}
              className="w-68 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 z-50 text-xs pointer-events-auto pms-pop"
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
                  <span className="text-slate-400">{getTranslation('ganttTenant', language)}</span>
                  <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 truncate">
                    <span>{activePreviewBooking.booking.guestType === 'algerian' ? '🇩🇿' : '🌐'}</span>
                    <span className="truncate">{activePreviewBooking.booking.guestName}</span>
                  </div>
                </div>

                {/* Occupants count with icons */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{getTranslation('ganttOccupants', language)}</span>
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
                  <span className="text-slate-400 font-sans">{getTranslation('ganttDates', language)}</span>
                  <span>
                    {activePreviewBooking.booking.startDate} → {activePreviewBooking.booking.endDate}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{getTranslation('ganttPayment', language)}</span>
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
                  {getTranslation('ganttOpenBooking', language)}
                </button>
                <button
                  onClick={() => {
                    downloadICS(activePreviewBooking.booking);
                  }}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded transition-colors"
                  title={getTranslation('ganttExportIcs', language)}
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Mobile Touch Action Sheet for Smartphone Tap */}
          {activePreviewBooking && activePreviewBooking.isMobileSheet && (
            <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-2xs flex items-end justify-center p-0 sm:p-4 pms-modal-backdrop">
              <div className="w-full sm:max-w-md max-h-[88dvh] overflow-y-auto bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl space-y-3 pms-slide-up pms-sheet">
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
                    <span className="text-[10px] text-slate-400 block">{getTranslation('ganttTenant', language)}</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {activePreviewBooking.booking.guestType === 'algerian' ? '🇩🇿 ' : '🌐 '}
                      {activePreviewBooking.booking.guestName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{getTranslation('ganttPayment', language)}</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 block tabular-nums">
                      {activePreviewBooking.booking.originalCurrencyAmount || activePreviewBooking.booking.totalPrice}{' '}
                      {activePreviewBooking.booking.paymentCurrency || currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{getTranslation('ganttCheckInLabel', language)}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 block">
                      {activePreviewBooking.booking.startDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{getTranslation('ganttCheckOutLabel', language)}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 block">
                      {activePreviewBooking.booking.endDate}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{getTranslation('ganttRoomOccupants', language)}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(activePreviewBooking.booking.adults || 1) + (activePreviewBooking.booking.children || 0)} pers. ({activePreviewBooking.booking.adults || 1} {language === 'fr' ? 'adultes' : language === 'ar' ? 'بالغين' : 'adults'})
                    </span>
                  </div>
                </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedBooking(activePreviewBooking.booking);
                  setActivePreviewBooking(null);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-xs cursor-pointer"
              >
                {getTranslation('ganttOpenFullBooking', language)}
              </button>
              <button
                onClick={() => {
                  downloadICS(activePreviewBooking.booking);
                }}
                className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title={getTranslation('ganttExportIcs', language)}
              >
                <Download size={14} />
                <span>.ICS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Operation Feedback Toast */}
      {batchFeedback && (
        <div
          role="alert"
          className={`fixed top-16 right-4 rtl:right-auto rtl:left-4 z-[140] max-w-sm rounded-xl px-4 py-3 shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
            batchFeedback.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-700/60 backdrop-blur-md'
              : batchFeedback.type === 'warning'
              ? 'bg-amber-950/95 text-amber-200 border-amber-700/60 backdrop-blur-md'
              : 'bg-rose-950/95 text-rose-200 border-rose-700/60 backdrop-blur-md'
          }`}
        >
          {batchFeedback.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-semibold flex-1 leading-snug">{batchFeedback.message}</span>
          <button
            type="button"
            onClick={() => setBatchFeedback(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Batch Actions Bar */}
      {isBatchSelectionMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] w-[95vw] max-w-3xl bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs font-mono shadow-xs">
              {selectedBookingIds.size}
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">
                {getTranslation('ganttBatchSelectedCount', language).replace('{count}', String(selectedBookingIds.size))}
              </div>
              <div className="text-[10px] text-slate-400">
                {selectedBookingIds.size === 0
                  ? (language === 'fr' ? 'Cliquez sur les réservations à sélectionner' : language === 'ar' ? 'انقر على الحجوزات لتحديدها' : 'Click bookings on the timeline to select')
                  : (language === 'fr' ? 'Déplacez, modifiez ou supprimez en 1 clic' : language === 'ar' ? 'انقل أو عدل أو احذف بنقرة واحدة' : 'Move, modify or delete in 1 click')}
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 relative">
            {/* Select all / Deselect all */}
            <button
              type="button"
              onClick={selectedBookingIds.size > 0 ? deselectAllBookings : selectAllVisibleBookings}
              className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title={selectedBookingIds.size > 0 ? getTranslation('ganttBatchDeselectAll', language) : getTranslation('ganttBatchSelectAll', language)}
            >
              {selectedBookingIds.size > 0 ? <Square size={13} /> : <CheckSquare size={13} />}
              <span className="hidden sm:inline">
                {selectedBookingIds.size > 0 ? getTranslation('ganttBatchDeselectAll', language) : getTranslation('ganttBatchSelectAll', language)}
              </span>
            </button>

            {/* Quick Shift buttons: -1j and +1j directly on bar */}
            <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5">
              <button
                type="button"
                disabled={selectedBookingIds.size === 0}
                onClick={() => handleBatchShift(-1)}
                className={`h-7 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedBookingIds.size === 0
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
                title={language === 'fr' ? 'Reculer de 1 jour' : language === 'ar' ? 'تأخير يوم واحد' : 'Shift back 1 day'}
              >
                -1j
              </button>
              <button
                type="button"
                disabled={selectedBookingIds.size === 0}
                onClick={() => handleBatchShift(1)}
                className={`h-7 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedBookingIds.size === 0
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
                title={language === 'fr' ? 'Avancer de 1 jour' : language === 'ar' ? 'تقديم يوم واحد' : 'Shift forward 1 day'}
              >
                +1j
              </button>
            </div>

            {/* Move Batch Dialog button */}
            <button
              type="button"
              disabled={selectedBookingIds.size === 0}
              onClick={() => setIsBatchShiftModalOpen(true)}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedBookingIds.size === 0
                  ? 'bg-slate-800/50 text-slate-600 border border-slate-800 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
              }`}
              title={getTranslation('ganttBatchMoveAction', language)}
            >
              <ArrowRightLeft size={13} />
              <span>{getTranslation('ganttBatchMoveAction', language)}</span>
            </button>

            {/* Batch Status dropdown button */}
            <div className="relative">
              <button
                type="button"
                disabled={selectedBookingIds.size === 0}
                onClick={() => setIsBatchStatusMenuOpen((prev) => !prev)}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selectedBookingIds.size === 0
                    ? 'bg-slate-800/50 text-slate-600 border border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-xs'
                }`}
                title={getTranslation('ganttBatchStatusAction', language)}
                aria-expanded={isBatchStatusMenuOpen}
              >
                <ListChecks size={13} />
                <span className="hidden sm:inline">{getTranslation('ganttBatchStatusAction', language)}</span>
                <ChevronDown size={11} className={`transition-transform ${isBatchStatusMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isBatchStatusMenuOpen && (
                <div className="absolute bottom-full mb-1.5 right-0 w-52 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-[130] flex flex-col gap-1 max-h-72 overflow-y-auto">
                  <span className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {language === 'fr' ? 'Changer statut simultanément' : language === 'ar' ? 'تعديل الحالة بالتزامن' : 'Update status simultaneously'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('confirmed')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-blue-400 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusConfirmed', language)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('new')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-amber-300 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusPending', language)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('checked_in')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-emerald-400 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusCheckedIn', language)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('checked_out')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusCheckedOut', language)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('due_in')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-teal-300 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusDueIn', language)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('due_out')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-orange-300 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusDueOut', language)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchStatusChange('cancelled')}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg text-rose-400 hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <span>{getTranslation('ganttBatchStatusCancelled', language)}</span>
                  </button>
                  <div className="border-t border-slate-700/80 my-0.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBatchStatusMenuOpen(false);
                        setIsBatchStatusModalOpen(true);
                      }}
                      className="w-full text-center py-1 text-[11px] font-semibold text-blue-400 hover:underline cursor-pointer"
                    >
                      {language === 'fr' ? 'Vue détaillée des statuts...' : language === 'ar' ? 'عرض تفصيلي للحالات...' : 'Detailed status view...'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Undo Last Batch Action button in floating bar */}
            <button
              type="button"
              disabled={!lastBatchAction}
              onClick={handleUndoBatchAction}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                !lastBatchAction
                  ? 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs active:scale-95 border border-amber-500/80 ring-1 ring-amber-400/40'
              }`}
              title={
                lastBatchAction
                  ? `${getTranslation('ganttBatchUndoAction', language)}: ${lastBatchAction.description}`
                  : getTranslation('ganttBatchUndoAction', language)
              }
              aria-label={getTranslation('ganttBatchUndoAction', language)}
            >
              <Undo2 size={13} className={lastBatchAction ? 'text-white' : 'text-slate-600'} />
              <span>{getTranslation('ganttBatchUndoAction', language)}</span>
            </button>

            {/* Delete Batch button */}
            <button
              type="button"
              disabled={selectedBookingIds.size === 0}
              onClick={() => setIsBatchDeleteConfirmOpen(true)}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedBookingIds.size === 0
                  ? 'bg-slate-800/50 text-slate-600 border border-slate-800 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
              }`}
              title={getTranslation('ganttBatchDeleteAction', language)}
            >
              <Trash2 size={13} />
              <span>{getTranslation('ganttBatchDeleteAction', language)}</span>
            </button>

            {/* Exit Batch Mode button */}
            <button
              type="button"
              onClick={toggleBatchMode}
              className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
              title={getTranslation('ganttBatchExitAction', language)}
              aria-label={getTranslation('ganttBatchExitAction', language)}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Batch Status Selection Modal */}
      {isBatchStatusModalOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsBatchStatusModalOpen(false);
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-status-modal-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl text-slate-900 dark:text-white"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <ListChecks size={20} />
                </span>
                <div>
                  <h2 id="batch-status-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                    {getTranslation('ganttBatchStatusModalTitle', language)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getTranslation('ganttBatchStatusModalSubtitle', language).replace('{count}', String(selectedBookingIds.size))}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchStatusModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-2">
              {[
                { status: 'confirmed' as BookingStatus, label: getTranslation('ganttBatchStatusConfirmed', language), color: 'bg-blue-600 text-white', dot: 'bg-blue-500' },
                { status: 'new' as BookingStatus, label: getTranslation('ganttBatchStatusPending', language), color: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200', dot: 'bg-amber-500' },
                { status: 'checked_in' as BookingStatus, label: getTranslation('ganttBatchStatusCheckedIn', language), color: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
                { status: 'checked_out' as BookingStatus, label: getTranslation('ganttBatchStatusCheckedOut', language), color: 'bg-rose-200 text-rose-950 dark:bg-rose-950 dark:text-rose-200', dot: 'bg-rose-500' },
                { status: 'due_in' as BookingStatus, label: getTranslation('ganttBatchStatusDueIn', language), color: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200', dot: 'bg-teal-500' },
                { status: 'due_out' as BookingStatus, label: getTranslation('ganttBatchStatusDueOut', language), color: 'bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200', dot: 'bg-orange-500' },
                { status: 'cancelled' as BookingStatus, label: getTranslation('ganttBatchStatusCancelled', language), color: 'bg-rose-100 text-rose-900 dark:bg-rose-950/90 dark:text-rose-200', dot: 'bg-rose-600' },
              ].map((item) => (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => handleBatchStatusChange(item.status)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${item.dot} ring-2 ring-white/50 shrink-0`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {item.label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.color}`}>
                    {selectedBookingIds.size}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchStatusModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Batch Shift Modal */}
      {isBatchShiftModalOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsBatchShiftModalOpen(false);
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-shift-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl text-slate-900 dark:text-white"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <ArrowRightLeft size={20} />
                </span>
                <div>
                  <h2 id="batch-shift-title" className="text-base font-bold text-slate-900 dark:text-white">
                    {getTranslation('ganttBatchShiftTitle', language)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getTranslation('ganttBatchShiftDescription', language)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchShiftModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Quick shift presets */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'fr' ? 'Décalage rapide :' : language === 'ar' ? 'إزاحة سريعة :' : 'Quick shift presets:'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[-7, -1, 1, 7].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBatchShiftDays(preset)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        batchShiftDays === preset
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {preset > 0 ? `+${preset}j` : `${preset}j`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom day stepper */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'fr' ? 'Nombre de jours personnalisé :' : language === 'ar' ? 'عدد الأيام المخصص :' : 'Custom day amount:'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchShiftDays((d) => d - 1)}
                    className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    aria-label="Diminuer d'un jour"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={batchShiftDays}
                    onChange={(e) => setBatchShiftDays(Number(e.target.value) || 0)}
                    className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 text-center text-sm font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchShiftDays((d) => d + 1)}
                    className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    aria-label="Augmenter d'un jour"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Selected bookings preview */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-3 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <span>{selectedBookingIds.size} {language === 'fr' ? 'réservations concernées' : language === 'ar' ? 'حجوزات معنية' : 'affected bookings'}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {batchShiftDays > 0 ? `+${batchShiftDays}` : batchShiftDays} {language === 'fr' ? 'jour(s)' : language === 'ar' ? 'يوم' : 'day(s)'}
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pr-1">
                  {selectedBookingsList.map((b) => {
                    const newStart = shiftIsoDate(b.startDate, batchShiftDays);
                    const newEnd = shiftIsoDate(b.endDate, batchShiftDays);
                    const conflict = checkConflict(b.resourceId, newStart, newEnd, b.id);
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {b.guestName} <span className="text-[10px] text-slate-400">({b.resourceName})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                          <span className="text-slate-500 line-through">{b.startDate}</span>
                          <span>→</span>
                          <span className={`font-bold ${conflict ? 'text-rose-500' : 'text-emerald-500'}`}>{newStart}</span>
                          {conflict && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-rose-500 text-white font-bold" title="Conflit de chambre">!</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchShiftModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={batchShiftDays === 0}
                onClick={() => handleBatchShift(batchShiftDays)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  batchShiftDays === 0
                    ? 'bg-indigo-400 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs'
                }`}
              >
                <ArrowRightLeft size={13} />
                <span>
                  {language === 'fr'
                    ? `Appliquer le déplacement (${batchShiftDays > 0 ? `+${batchShiftDays}` : batchShiftDays}j)`
                    : language === 'ar'
                    ? `تطبيق الإزاحة (${batchShiftDays > 0 ? `+${batchShiftDays}` : batchShiftDays} يوم)`
                    : `Apply Shift (${batchShiftDays > 0 ? `+${batchShiftDays}` : batchShiftDays}d)`}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {isBatchDeleteConfirmOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsBatchDeleteConfirmOpen(false);
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-delete-title"
            className="w-full max-w-md rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-5 shadow-2xl text-slate-900 dark:text-white"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 size={20} />
                </span>
                <div>
                  <h2 id="batch-delete-title" className="text-base font-bold text-slate-900 dark:text-white">
                    {getTranslation('ganttBatchConfirmDeleteTitle', language).replace('{count}', String(selectedBookingIds.size))}
                  </h2>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                    {language === 'fr' ? 'Action irréversible' : language === 'ar' ? 'إجراء لا يمكن التراجع عنه' : 'Irreversible action'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchDeleteConfirmOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                {getTranslation('ganttBatchConfirmDeleteMsg', language)}
              </div>

              {/* List of bookings to be deleted */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedBookingsList.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {b.guestName} <span className="text-[10px] text-slate-400">({b.resourceName})</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {b.startDate} → {b.endDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                <span>
                  {language === 'fr'
                    ? `Supprimer définitivement (${selectedBookingIds.size})`
                    : language === 'ar'
                    ? `حذف نهائي (${selectedBookingIds.size})`
                    : `Delete Permanently (${selectedBookingIds.size})`}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};