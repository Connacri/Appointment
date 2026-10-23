import { useState, useEffect, useMemo, useCallback } from 'react';

export interface TimelineSyncOptions {
  currentBaseDate: string;
  totalDays: number;
  colWidth: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  language?: string;
  direction?: 'ltr' | 'rtl';
}

export interface TimelineSyncResult {
  todayIndex: number;
  isTodayInRange: boolean;
  todayDateStr: string;
  currentTimeStr: string;
  currentHourFraction: number;
  absoluteGridX: number;
  scrollOffset: number;
  containerWidth: number;
  relativeViewportX: number;
  isWithinVisibleViewport: boolean;
  scrollToNow: (smooth?: boolean) => void;
  syncTimestamp: number;
}

/**
 * Custom hook that observes date state changes globally to ensure the 'current time'
 * red line and the 'today' view header remain synchronized across all navigation events.
 *
 * Calculates the red line position using a dynamic offset relative to the timeline's
 * scroll position and container width, ensuring it aligns perfectly with the current date/time
 * on the horizontal axis.
 */
export function useTimelineSync({
  currentBaseDate,
  totalDays,
  colWidth,
  scrollContainerRef,
  language = 'fr',
  direction = 'ltr',
}: TimelineSyncOptions): TimelineSyncResult {
  const [syncTimestamp, setSyncTimestamp] = useState<number>(Date.now());
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Real today ISO string YYYY-MM-DD
  const todayDateStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [syncTimestamp]);

  // Formatted current time string e.g. "10:45"
  const currentTimeStr = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [syncTimestamp]);

  // Current fraction of the 24h day (from 0.000 to 0.999...)
  const currentHourFraction = useMemo(() => {
    const now = new Date();
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return seconds / 86400;
  }, [syncTimestamp]);

  // Compute today's index relative to currentBaseDate and totalDays
  const todayIndex = useMemo(() => {
    if (!currentBaseDate) return -1;
    const [baseY, baseM, baseD] = currentBaseDate.split('-').map(Number);
    const baseDate = new Date(baseY, baseM - 1, baseD);
    baseDate.setHours(0, 0, 0, 0);

    const [todayY, todayM, todayD] = todayDateStr.split('-').map(Number);
    const todayDate = new Date(todayY, todayM - 1, todayD);
    todayDate.setHours(0, 0, 0, 0);

    const diffMs = todayDate.getTime() - baseDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < totalDays) {
      return diffDays;
    }
    return -1;
  }, [currentBaseDate, totalDays, todayDateStr]);

  const isTodayInRange = todayIndex >= 0;

  // Absolute horizontal position on the timeline grid canvas in pixels
  const absoluteGridX = useMemo(() => {
    if (!isTodayInRange) return -9999;
    return (todayIndex + currentHourFraction) * colWidth;
  }, [isTodayInRange, todayIndex, currentHourFraction, colWidth]);

  // Relative dynamic offset to viewport (taking horizontal scroll into account)
  const relativeViewportX = useMemo(() => {
    if (!isTodayInRange) return -9999;
    return absoluteGridX - scrollOffset;
  }, [isTodayInRange, absoluteGridX, scrollOffset]);

  const isWithinVisibleViewport = useMemo(() => {
    if (!isTodayInRange) return false;
    return relativeViewportX >= -colWidth && relativeViewportX <= containerWidth + colWidth;
  }, [isTodayInRange, relativeViewportX, containerWidth, colWidth]);

  // Scroll listener to keep dynamic offset synchronized
  const updateScrollMetrics = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollOffset(scrollContainerRef.current.scrollLeft);
      setContainerWidth(scrollContainerRef.current.clientWidth);
    }
  }, [scrollContainerRef]);

  // Attach scroll & resize listeners
  useEffect(() => {
    updateScrollMetrics();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollMetrics, { passive: true });
    }
    window.addEventListener('resize', updateScrollMetrics);

    return () => {
      if (container) {
        container.removeEventListener('scroll', updateScrollMetrics);
      }
      window.removeEventListener('resize', updateScrollMetrics);
    };
  }, [scrollContainerRef, updateScrollMetrics, currentBaseDate, totalDays, colWidth]);

  // Global time tick interval (every 10 seconds to keep minute & fractional position accurate)
  useEffect(() => {
    const timer = setInterval(() => {
      setSyncTimestamp(Date.now());
    }, 10000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setSyncTimestamp(Date.now());
        updateScrollMetrics();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateScrollMetrics]);

  // Smooth scroll to current time red line
  const scrollToNow = useCallback(
    (smooth: boolean = true) => {
      if (scrollContainerRef.current && isTodayInRange) {
        const cWidth = scrollContainerRef.current.clientWidth || 800;
        // Center the red line in the middle of the viewport
        const targetScroll = Math.max(0, absoluteGridX - cWidth / 2);
        const dirMultiplier = direction === 'rtl' || language === 'ar' ? -1 : 1;

        scrollContainerRef.current.scrollTo({
          left: targetScroll * dirMultiplier,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    },
    [scrollContainerRef, isTodayInRange, absoluteGridX, direction, language]
  );

  return {
    todayIndex,
    isTodayInRange,
    todayDateStr,
    currentTimeStr,
    currentHourFraction,
    absoluteGridX,
    scrollOffset,
    containerWidth,
    relativeViewportX,
    isWithinVisibleViewport,
    scrollToNow,
    syncTimestamp,
  };
}
