export type TimelineScaleView = 'day' | 'week' | 'month';

export const TIMELINE_ZOOM_STORAGE_KEY = 'appointment.gantt.zoomLevel';
export const LEGACY_COLUMN_ZOOM_STORAGE_KEY = 'appointment.gantt.columnZoom';

export const SCALE_VIEW_PRESETS: Record<TimelineScaleView, number> = {
  month: 12,
  week: 50,
  day: 84,
};

export function clampZoomLevel(value: number): number {
  if (!Number.isFinite(value)) return SCALE_VIEW_PRESETS.week;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getScaleViewFromZoomLevel(level: number): TimelineScaleView {
  const clamped = clampZoomLevel(level);
  if (clamped < 34) return 'month';
  if (clamped < 68) return 'week';
  return 'day';
}

export function getPresetZoomLevel(view: TimelineScaleView): number {
  return SCALE_VIEW_PRESETS[view];
}

export function getColumnWidthFromZoomLevel(level: number, isMobile: boolean): number {
  const t = clampZoomLevel(level) / 100;
  const minWidth = isMobile ? 24 : 28;
  const maxWidth = isMobile ? 112 : 180;
  return Math.round(minWidth + t * (maxWidth - minWidth));
}

export function readInitialZoomLevel(storage?: Pick<Storage, 'getItem'> | null): number {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!targetStorage) return SCALE_VIEW_PRESETS.week;

  try {
    const saved = targetStorage.getItem(TIMELINE_ZOOM_STORAGE_KEY);
    if (saved !== null && saved.trim() !== '') {
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        return clampZoomLevel(parsed);
      }
    }

    const legacy = targetStorage.getItem(LEGACY_COLUMN_ZOOM_STORAGE_KEY);
    if (legacy === 'compact') return SCALE_VIEW_PRESETS.month;
    if (legacy === 'wide') return SCALE_VIEW_PRESETS.day;
    if (legacy === 'standard') return SCALE_VIEW_PRESETS.week;
  } catch {
    // Ignore storage read errors in restricted contexts
  }

  return SCALE_VIEW_PRESETS.week;
}
