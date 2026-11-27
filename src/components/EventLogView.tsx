import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Coins,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  KeyRound,
  Layers,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Warehouse,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import type { EventLogCategory, EventLogEntry, EventLogSeverity } from '../types/eventLog';
import {
  buildEventLogExportFilename,
  computeEventLogStats,
  countActiveEventLogFilters,
  detectEventLogDatePreset,
  filterEventLogs,
  formatEventLogsAsCsv,
  formatEventLogsAsJson,
  formatEventLogsAsText,
} from '../utils/eventLog';
import { exportEventLogPDF } from '../utils/pdfExport';

const CATEGORY_OPTIONS: Array<{
  id: EventLogCategory | 'all';
  labelKey:
    | 'eventLogCategoryAll'
    | 'eventLogCategoryBooking'
    | 'eventLogCategoryHousekeeping'
    | 'eventLogCategoryTask'
    | 'eventLogCategoryStock'
    | 'eventLogCategoryBilling'
    | 'eventLogCategoryLocks'
    | 'eventLogCategorySync'
    | 'eventLogCategorySystem';
}> = [
  { id: 'all', labelKey: 'eventLogCategoryAll' },
  { id: 'booking', labelKey: 'eventLogCategoryBooking' },
  { id: 'housekeeping', labelKey: 'eventLogCategoryHousekeeping' },
  { id: 'task', labelKey: 'eventLogCategoryTask' },
  { id: 'stock', labelKey: 'eventLogCategoryStock' },
  { id: 'billing', labelKey: 'eventLogCategoryBilling' },
  { id: 'locks', labelKey: 'eventLogCategoryLocks' },
  { id: 'sync', labelKey: 'eventLogCategorySync' },
  { id: 'system', labelKey: 'eventLogCategorySystem' },
];

function getTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revocation so Safari, mobile browsers, and Android WebView finish reading the Blob.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export const EventLogView: React.FC = () => {
  const {
    language,
    eventLogs,
    clearEventLogs,
    openBookingFromEvent,
    isOffline,
    establishmentProfile,
    logEvent,
    deviceMutationAvailability,
  } = useApp();

  const isRtl = language === 'ar';
  const locale = language === 'ar' ? 'ar-DZ' : language === 'en' ? 'en-GB' : 'fr-FR';

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EventLogCategory | 'all'>('all');
  const [severity, setSeverity] = useState<EventLogSeverity | 'all'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const [missingBookingNotice, setMissingBookingNotice] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const listItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Base set filtered by everything EXCEPT severity so KPI quick-filters always remain switchable
  const kpiBaseEvents = useMemo(
    () =>
      filterEventLogs(eventLogs, {
        query,
        category,
        severity: 'all',
        fromDate,
        toDate,
      }),
    [eventLogs, query, category, fromDate, toDate]
  );

  const filteredEvents = useMemo(
    () =>
      severity === 'all'
        ? kpiBaseEvents
        : kpiBaseEvents.filter((entry) => entry.severity === severity),
    [kpiBaseEvents, severity]
  );

  // Keep desktop selection aligned with the first visible item when nothing valid is selected
  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredEvents.some((e) => e.id === selectedId)) {
      setSelectedId(filteredEvents[0].id);
    }
  }, [filteredEvents, selectedId]);

  useEffect(() => {
    if (!isMobileDetailOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileDetailOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileDetailOpen]);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => setExportNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);

  const selectedEntry: EventLogEntry | null = useMemo(
    () => filteredEvents.find((e) => e.id === selectedId) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedId]
  );

  const stats = useMemo(() => computeEventLogStats(kpiBaseEvents), [kpiBaseEvents]);

  const activeFiltersCount = useMemo(
    () => countActiveEventLogFilters({ query, category, severity, fromDate, toDate }),
    [query, category, severity, fromDate, toDate]
  );

  const activeSecondaryFiltersCount = useMemo(
    () =>
      (severity !== 'all' ? 1 : 0) +
      (fromDate.trim().length > 0 || toDate.trim().length > 0 ? 1 : 0),
    [severity, fromDate, toDate]
  );

  const hasActiveFilters = activeFiltersCount > 0;
  const activeDatePreset = useMemo(
    () => detectEventLogDatePreset(fromDate, toDate),
    [fromDate, toDate]
  );

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setSeverity('all');
    setFromDate('');
    setToDate('');
  };

  const applyQuickRange = (preset: 'today' | '7d' | 'all') => {
    const today = getTodayIso();
    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (preset === '7d') {
      setFromDate(getDaysAgoIso(6));
      setToDate(today);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  const formatTimestampShort = (iso: string) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatTimestampFull = (iso: string) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getCategoryLabel = (cat: EventLogCategory): string => {
    const match = CATEGORY_OPTIONS.find((opt) => opt.id === cat);
    return match ? getTranslation(match.labelKey, language) : cat;
  };

  const getCategoryIcon = (cat: EventLogCategory) => {
    switch (cat) {
      case 'booking':
        return CalendarDays;
      case 'housekeeping':
        return Sparkles;
      case 'task':
        return ClipboardList;
      case 'stock':
        return Warehouse;
      case 'billing':
        return Coins;
      case 'locks':
        return KeyRound;
      case 'sync':
        return RefreshCw;
      case 'system':
      default:
        return Settings;
    }
  };

  const renderSeverityIndicator = (sev: EventLogSeverity) => {
    switch (sev) {
      case 'success':
        return {
          Icon: CheckCircle2,
          label: getTranslation('eventLogSeveritySuccess', language),
          iconClass: 'text-emerald-600 dark:text-emerald-400',
          badgeBgClass: 'bg-emerald-100/80 dark:bg-emerald-950/70',
          textClass: 'text-emerald-800 dark:text-emerald-300',
          bgClass: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70',
        };
      case 'warn':
        return {
          Icon: AlertTriangle,
          label: getTranslation('eventLogSeverityWarn', language),
          iconClass: 'text-amber-600 dark:text-amber-400',
          badgeBgClass: 'bg-amber-100/80 dark:bg-amber-950/70',
          textClass: 'text-amber-800 dark:text-amber-300',
          bgClass: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/70',
        };
      case 'error':
        return {
          Icon: AlertCircle,
          label: getTranslation('eventLogSeverityError', language),
          iconClass: 'text-rose-600 dark:text-rose-400',
          badgeBgClass: 'bg-rose-100/80 dark:bg-rose-950/70',
          textClass: 'text-rose-800 dark:text-rose-300',
          bgClass: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70',
        };
      case 'info':
      default:
        return {
          Icon: Info,
          label: getTranslation('eventLogSeverityInfo', language),
          iconClass: 'text-blue-600 dark:text-blue-400',
          badgeBgClass: 'bg-blue-100/80 dark:bg-blue-950/70',
          textClass: 'text-blue-800 dark:text-blue-300',
          bgClass: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/70',
        };
    }
  };

  const handleSelectEntry = (entry: EventLogEntry) => {
    setSelectedId(entry.id);
    setMissingBookingNotice(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileDetailOpen(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (filteredEvents.length === 0) return;
    let nextIndex = -1;
    if (e.key === 'ArrowDown') {
      nextIndex = Math.min(filteredEvents.length - 1, index + 1);
    } else if (e.key === 'ArrowUp') {
      nextIndex = Math.max(0, index - 1);
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = filteredEvents.length - 1;
    }
    if (nextIndex >= 0 && nextIndex !== index) {
      e.preventDefault();
      const target = filteredEvents[nextIndex];
      setSelectedId(target.id);
      setMissingBookingNotice(null);
      listItemRefs.current[target.id]?.focus();
    }
  };

  const handleOpenLinkedBooking = (bookingId: string) => {
    const opened = openBookingFromEvent(bookingId);
    if (!opened) {
      setMissingBookingNotice(getTranslation('eventLogBookingMissing', language));
    } else {
      setMissingBookingNotice(null);
      setIsMobileDetailOpen(false);
    }
  };

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (category !== 'all') parts.push(getCategoryLabel(category));
    if (severity !== 'all') parts.push(renderSeverityIndicator(severity).label);
    if (fromDate || toDate) {
      parts.push(`${fromDate || '…'} -> ${toDate || '…'}`);
    }
    if (query.trim()) {
      parts.push(`"${query.trim()}"`);
    }
    return parts.length > 0
      ? parts.join(' · ')
      : getTranslation('eventLogPrintNoFilter', language);
  }, [category, severity, fromDate, toDate, query, language]);

  const handleExport = (format: 'pdf' | 'csv' | 'json' | 'txt' | 'print') => {
    const snapshot = [...filteredEvents];
    if (snapshot.length === 0) return;

    const todayIso = getTodayIso();
    setIsExportMenuOpen(false);

    try {
      if (format === 'pdf') {
        exportEventLogPDF(snapshot, {
          language,
          establishmentProfile,
          filterSummary: activeFilterSummary,
          filename: buildEventLogExportFilename('pdf', todayIso),
        });
      } else if (format === 'csv') {
        triggerDownload(
          formatEventLogsAsCsv(snapshot),
          buildEventLogExportFilename('csv', todayIso),
          'text/csv;charset=utf-8;'
        );
      } else if (format === 'json') {
        triggerDownload(
          formatEventLogsAsJson(snapshot),
          buildEventLogExportFilename('json', todayIso),
          'application/json;charset=utf-8;'
        );
      } else if (format === 'txt') {
        triggerDownload(
          formatEventLogsAsText(snapshot, {
            hotelName: establishmentProfile?.name,
            filterSummary: activeFilterSummary,
          }),
          buildEventLogExportFilename('txt', todayIso),
          'text/plain;charset=utf-8;'
        );
      } else if (format === 'print') {
        window.print();
      }

      const formatLabel = format.toUpperCase();
      setExportNotice({
        kind: 'success',
        message: getTranslation('eventLogExportSuccess', language)
          .replace('{format}', formatLabel)
          .replace('{count}', String(snapshot.length)),
      });

      void logEvent({
        category: 'system',
        action: 'system.journal_exported',
        severity: 'info',
        title: `Export journal (${formatLabel}) · ${snapshot.length} événement(s)`,
        description: `Export ${formatLabel} du journal d'événements (${activeFilterSummary})`,
        metadata: {
          format: formatLabel,
          exportedCount: snapshot.length,
          filters: activeFilterSummary,
        },
      });
    } catch {
      setExportNotice({
        kind: 'error',
        message: getTranslation('eventLogExportError', language).replace(
          '{format}',
          format.toUpperCase()
        ),
      });
    }
  };

  const renderDetailContent = (entry: EventLogEntry, onClose?: () => void) => {
    const sev = renderSeverityIndicator(entry.severity);
    const SevIcon = sev.Icon;
    const CatIcon = getCategoryIcon(entry.category);
    const metaEntries = entry.metadata
      ? Object.entries(entry.metadata).filter(([, val]) => val !== null && val !== undefined && val !== '')
      : [];

    return (
      <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
        {/* Sticky Detail Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 shrink-0 bg-white dark:bg-slate-900">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${sev.bgClass} ${sev.textClass}`}
              >
                <SevIcon size={13} className="shrink-0" />
                {sev.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <CatIcon size={12} className="shrink-0" />
                <span>{getCategoryLabel(entry.category)}</span>
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {entry.source === 'live'
                  ? getTranslation('eventLogSourceLive', language)
                  : getTranslation('eventLogSourceHistory', language)}
              </span>
            </div>
            <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-white leading-snug break-words">
              {entry.title}
            </h2>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={getTranslation('eventLogCloseDetail', language)}
              className="min-h-11 min-w-11 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-5">
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 p-3.5">
            {entry.description}
          </p>

          {/* Structured Key/Value Facts */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3">
              <dt className="font-medium text-slate-500 dark:text-slate-400">
                {getTranslation('eventLogTimestamp', language)}
              </dt>
              <dd className="mt-1 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatTimestampFull(entry.timestamp)}
              </dd>
              <dd className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500 break-all">
                {entry.timestamp}
              </dd>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3">
              <dt className="font-medium text-slate-500 dark:text-slate-400">
                {getTranslation('eventLogActor', language)}
              </dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100 break-words">
                {typeof entry.actor === 'string' ? entry.actor : entry.actor?.label || '—'}
              </dd>
              {typeof entry.actor === 'object' && entry.actor?.role && (
                <dd className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 uppercase">
                  {entry.actor.role}
                </dd>
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3">
              <dt className="font-medium text-slate-500 dark:text-slate-400">
                {getTranslation('eventLogActionCode', language)}
              </dt>
              <dd className="mt-1 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 break-all">
                {entry.action}
              </dd>
            </div>

            {entry.target && (
              <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3">
                <dt className="font-medium text-slate-500 dark:text-slate-400">
                  {getTranslation('eventLogTarget', language)}
                </dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100 break-words">
                  {entry.target.label || entry.target.type}
                  {entry.target.secondaryLabel ? ` · ${entry.target.secondaryLabel}` : ''}
                </dd>
                {entry.target.id && (
                  <dd className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500 break-all">
                    {entry.target.id}
                  </dd>
                )}
              </div>
            )}
          </dl>

          {/* Structured Field Diff Comparison (cards on narrow phones, table on >= sm) */}
          {entry.changes && entry.changes.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {getTranslation('eventLogChangesHeading', language)}
              </h3>

              {/* Mobile Stacked Diff Cards */}
              <div className="sm:hidden space-y-2">
                {entry.changes.map((chg, idx) => (
                  <div
                    key={`${chg.field}-mob-${idx}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 text-xs space-y-1.5"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100">{chg.field}</div>
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="rounded bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-rose-700 dark:text-rose-300 line-through break-all">
                        {chg.before || '—'}
                      </span>
                      <ArrowRight size={12} className="text-slate-400 shrink-0 rtl:rotate-180" />
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 font-bold text-emerald-800 dark:text-emerald-300 break-all">
                        {chg.after || '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / Tablet 3-Column Diff Table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-xs text-start">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{getTranslation('eventLogField', language)}</th>
                      <th className="px-3 py-2 font-semibold">{getTranslation('eventLogBefore', language)}</th>
                      <th className="px-3 py-2 font-semibold">{getTranslation('eventLogAfter', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {entry.changes.map((chg, idx) => (
                      <tr key={`${chg.field}-${idx}`}>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          {chg.field}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400 break-words">
                          {chg.before || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-900 dark:text-white break-words">
                          <span className="inline-flex items-center gap-1">
                            <ArrowRight size={11} className="text-slate-400 shrink-0 rtl:rotate-180" />
                            <span>{chg.after || '—'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Technical Metadata Grid */}
          {metaEntries.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {getTranslation('eventLogMetadataHeading', language)}
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                {metaEntries.map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">{key}</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100 text-end break-all tabular-nums">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky Footer Action for Linked Booking */}
        {(() => {
          const linkedBookingId =
            entry.bookingId || (entry.target?.type === 'booking' ? entry.target.id : undefined);
          if (!linkedBookingId) return null;
          return (
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
              {missingBookingNotice && (
                <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {missingBookingNotice}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleOpenLinkedBooking(linkedBookingId)}
                className="min-h-11 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <ExternalLink size={15} />
                <span>{getTranslation('eventLogOpenBooking', language)}</span>
              </button>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex-1 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
    >
      {/* Header & Top Action Bar */}
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 px-3.5 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                <History size={18} />
              </span>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {getTranslation('eventLogTitle', language)}
                </h1>
                <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400 truncate">
                  {getTranslation('eventLogSubtitle', language)}
                </p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              <span>{getTranslation('eventLogLocalNotice', language)}</span>
              {isOffline && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <WifiOff size={13} />
                  <span>{getTranslation('bookingFinderOffline', language)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={filteredEvents.length === 0}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                onClick={() => setIsExportMenuOpen((v) => !v)}
                className="min-h-11 sm:min-h-9 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Download size={14} className="shrink-0" />
                <span>{getTranslation('eventLogExportMenuBtn', language)}</span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isExportMenuOpen && (
                <div
                  role="menu"
                  aria-label={getTranslation('eventLogExportMenuBtn', language)}
                  className="pms-dropdown pms-dropdown-end absolute right-0 rtl:right-auto rtl:left-0 top-full mt-1.5 z-50 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl text-xs"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('pdf')}
                    className="w-full min-h-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-start font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <FileText size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{getTranslation('eventLogExportPdf', language)}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('csv')}
                    className="w-full min-h-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-start font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{getTranslation('eventLogExportCsvItem', language)}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('json')}
                    className="w-full min-h-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-start font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <FileJson size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{getTranslation('eventLogExportJsonItem', language)}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('txt')}
                    className="w-full min-h-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-start font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <FileText size={15} className="text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>{getTranslation('eventLogExportTxtItem', language)}</span>
                  </button>

                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('print')}
                    className="w-full min-h-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-start font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Printer size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{getTranslation('eventLogPrint', language)}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsClearConfirmOpen((v) => !v)}
              disabled={!deviceMutationAvailability.canMutate}
              className="min-h-11 sm:min-h-9 inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/40 px-3 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 size={14} />
              <span>{getTranslation('eventLogClearLocal', language)}</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div
            role={exportNotice.kind === 'error' ? 'alert' : 'status'}
            className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              exportNotice.kind === 'error'
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              {exportNotice.kind === 'error' ? (
                <AlertCircle size={15} className="shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="shrink-0" />
              )}
              <span className="break-words">{exportNotice.message}</span>
            </span>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              aria-label={getTranslation('eventLogCloseDetail', language)}
              className="shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Inline Non-Modal Clear Confirmation */}
        {isClearConfirmOpen && (
          <div
            role="alertdialog"
            aria-label={getTranslation('eventLogClearConfirmTitle', language)}
            className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs"
          >
            <div>
              <p className="font-bold text-rose-900 dark:text-rose-200">
                {getTranslation('eventLogClearConfirmTitle', language)}
              </p>
              <p className="mt-0.5 text-rose-700 dark:text-rose-300">
                {getTranslation('eventLogClearConfirmNote', language)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="min-h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {getTranslation('eventLogCancelAction', language)}
              </button>
              <button
                type="button"
                onClick={() => {
                  void clearEventLogs()
                    .then(() => setIsClearConfirmOpen(false))
                    .catch((error) => {
                      setExportNotice({
                        kind: 'error',
                        message: error instanceof Error ? error.message : 'Suppression bloquée en mode lecture seule.',
                      });
                      setIsClearConfirmOpen(false);
                    });
                }}
                disabled={!deviceMutationAvailability.canMutate}
                className="min-h-10 rounded-lg bg-rose-600 px-3 font-semibold text-white hover:bg-rose-500 cursor-pointer"
              >
                {getTranslation('eventLogConfirmAction', language)}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Filters & Interactive Severity KPI Strip */}
      <div className="shrink-0 px-3.5 sm:px-6 pt-3 pb-2.5 space-y-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950">
        {/* Interactive Severity Filter KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            aria-pressed={severity === 'all'}
            onClick={() => setSeverity('all')}
            className={`min-h-11 rounded-xl border px-3 py-2 text-start transition-colors cursor-pointer ${
              severity === 'all'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-600/40'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="truncate">{getTranslation('eventLogTotalEvents', language)}</span>
              <Layers size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-0.5 text-base sm:text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {stats.total}
            </div>
          </button>

          <button
            type="button"
            aria-pressed={severity === 'success'}
            onClick={() => setSeverity((cur) => (cur === 'success' ? 'all' : 'success'))}
            className={`min-h-11 rounded-xl border px-3 py-2 text-start transition-colors cursor-pointer ${
              severity === 'success'
                ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-emerald-600/40'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="truncate">{getTranslation('eventLogSuccessCount', language)}</span>
              <CheckCircle2 size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-0.5 text-base sm:text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {stats.success}
            </div>
          </button>

          <button
            type="button"
            aria-pressed={severity === 'warn'}
            onClick={() => setSeverity((cur) => (cur === 'warn' ? 'all' : 'warn'))}
            className={`min-h-11 rounded-xl border px-3 py-2 text-start transition-colors cursor-pointer ${
              severity === 'warn'
                ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 ring-1 ring-amber-600/40'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="truncate">{getTranslation('eventLogWarnCount', language)}</span>
              <AlertTriangle size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-0.5 text-base sm:text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {stats.warn}
            </div>
          </button>

          <button
            type="button"
            aria-pressed={severity === 'error'}
            onClick={() => setSeverity((cur) => (cur === 'error' ? 'all' : 'error'))}
            className={`min-h-11 rounded-xl border px-3 py-2 text-start transition-colors cursor-pointer ${
              severity === 'error'
                ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 ring-1 ring-rose-600/40'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="truncate">{getTranslation('eventLogErrorCount', language)}</span>
              <AlertCircle size={13} className="shrink-0 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="mt-0.5 text-base sm:text-lg font-bold tabular-nums text-rose-700 dark:text-rose-400">
              {stats.error}
            </div>
          </button>
        </div>

        {/* Primary Search Row + Mobile Filters Disclosure Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={getTranslation('eventLogSearchPlaceholder', language)}
              aria-label={getTranslation('eventLogSearchPlaceholder', language)}
              className="min-h-11 md:min-h-9 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 ps-9 pe-9 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={getTranslation('eventLogResetFilters', language)}
                className="absolute top-1/2 -translate-y-1/2 end-2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-expanded={isMobileFiltersOpen}
            aria-controls="event-log-secondary-filters"
            onClick={() => setIsMobileFiltersOpen((v) => !v)}
            className={`md:hidden min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              isMobileFiltersOpen || activeSecondaryFiltersCount > 0
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>{getTranslation('eventLogFiltersToggle', language)}</span>
            {activeSecondaryFiltersCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white tabular-nums">
                {activeSecondaryFiltersCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="hidden md:inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <RotateCcw size={13} />
              <span>{getTranslation('eventLogResetFilters', language)}</span>
            </button>
          )}
        </div>

        {/* Secondary Filters (Collapsible on mobile, inline wrap on md+) */}
        <div
          id="event-log-secondary-filters"
          className={`${
            isMobileFiltersOpen ? 'grid' : 'hidden md:flex'
          } grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap md:items-center gap-2 rounded-xl md:rounded-none border md:border-0 border-slate-200 dark:border-slate-800 bg-white md:bg-transparent dark:bg-slate-900 md:dark:bg-transparent p-3 md:p-0`}
        >
          <label className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold md:font-medium shrink-0">
              {getTranslation('eventLogSeverityLabel', language)}
            </span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as EventLogSeverity | 'all')}
              aria-label={getTranslation('eventLogSeverityAll', language)}
              className="min-h-11 md:min-h-9 w-full md:w-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">{getTranslation('eventLogSeverityAll', language)}</option>
              <option value="info">{getTranslation('eventLogSeverityInfo', language)}</option>
              <option value="success">{getTranslation('eventLogSeveritySuccess', language)}</option>
              <option value="warn">{getTranslation('eventLogSeverityWarn', language)}</option>
              <option value="error">{getTranslation('eventLogSeverityError', language)}</option>
            </select>
          </label>

          <label className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold md:font-medium shrink-0">
              {getTranslation('eventLogFromDate', language)}
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="min-h-11 md:min-h-9 w-full md:w-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold md:font-medium shrink-0">
              {getTranslation('eventLogToDate', language)}
            </span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-h-11 md:min-h-9 w-full md:w-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </label>

          <div className="sm:col-span-2 md:col-span-1 flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 md:bg-white md:dark:bg-slate-900 p-0.5">
            {(
              [
                { id: 'today', labelKey: 'eventLogQuickToday' },
                { id: '7d', labelKey: 'eventLogQuick7Days' },
                { id: 'all', labelKey: 'eventLogQuickAll' },
              ] as const
            ).map((preset) => {
              const isPresetActive = activeDatePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isPresetActive}
                  onClick={() => applyQuickRange(preset.id)}
                  className={`flex-1 md:flex-none min-h-10 md:min-h-8 rounded-md px-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isPresetActive
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {getTranslation(preset.labelKey, language)}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="md:hidden sm:col-span-2 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>{getTranslation('eventLogResetFilters', language)}</span>
            </button>
          )}
        </div>

        {/* Functional Category Filter Tabs: 1-row horizontal swipe on phones, crisp wrap on tablet+ */}
        <div
          role="tablist"
          aria-label={getTranslation('eventLogTitle', language)}
          className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 sm:mx-0 sm:px-0"
        >
          {CATEGORY_OPTIONS.map((opt) => {
            const active = category === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(opt.id)}
                className={`min-h-10 sm:min-h-8 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {getTranslation(opt.labelKey, language)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Master Feed + Desktop Detail Inspector */}
      <div className="flex-1 min-h-[20rem] lg:min-h-0 px-3.5 sm:px-6 py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(23rem,1fr)] gap-4 lg:overflow-hidden">
        {/* Chronological Event Feed */}
        <section
          aria-label={getTranslation('eventLogTitle', language)}
          className="flex flex-col min-h-[18rem] lg:min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
        >
          <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-4 py-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="truncate">{activeFilterSummary}</span>
            <span className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 shrink-0">
              {filteredEvents.length}
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <History size={28} className="text-slate-400 dark:text-slate-500" />
              <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
                {eventLogs.length === 0
                  ? getTranslation('eventLogEmptyAll', language)
                  : getTranslation('eventLogEmptyFiltered', language)}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 min-h-10 inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>{getTranslation('eventLogResetFilters', language)}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 lg:overflow-y-auto overscroll-contain divide-y divide-slate-200 dark:divide-slate-800" role="list">
              {filteredEvents.map((entry, idx) => {
                const isSelected = selectedEntry?.id === entry.id;
                const sev = renderSeverityIndicator(entry.severity);
                const SevIcon = sev.Icon;
                const metaParts: string[] = [
                  getCategoryLabel(entry.category),
                  entry.actor.label,
                ];
                if (entry.target?.label) {
                  metaParts.push(
                    entry.target.secondaryLabel
                      ? `${entry.target.label} (${entry.target.secondaryLabel})`
                      : entry.target.label
                  );
                }

                return (
                  <button
                    key={entry.id}
                    ref={(el) => {
                      listItemRefs.current[entry.id] = el;
                    }}
                    type="button"
                    role="listitem"
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => handleSelectEntry(entry)}
                    onKeyDown={(e) => handleListKeyDown(e, idx)}
                    className={`w-full min-h-[56px] px-3.5 sm:px-4 py-3 text-start border-s-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                      isSelected
                        ? 'border-s-blue-600 bg-blue-50/75 dark:bg-blue-950/35'
                        : 'border-s-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span
                          className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${sev.badgeBgClass}`}
                        >
                          <SevIcon size={15} className={sev.iconClass} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words">
                            {entry.title}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 break-words">
                            {entry.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="truncate max-w-full">{metaParts.join(' · ')}</span>
                            {entry.changes && entry.changes.length > 0 && (
                              <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                {getTranslation('eventLogChangesCount', language).replace(
                                  '{count}',
                                  String(entry.changes.length)
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <time
                          dateTime={entry.timestamp}
                          className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap"
                        >
                          {formatTimestampShort(entry.timestamp)}
                        </time>
                        <ChevronRight
                          size={14}
                          className="lg:hidden text-slate-400 rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Desktop Detail Inspector Pane */}
        <aside
          aria-label={getTranslation('eventLogDetailHeading', language)}
          className="hidden lg:flex flex-col min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
        >
          {selectedEntry ? (
            renderDetailContent(selectedEntry)
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              <Info size={24} className="mb-2 text-slate-400" />
              <p>{getTranslation('eventLogSelectPrompt', language)}</p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile / Tablet Slide-over Detail Sheet (Portaled cleanly to document.body) */}
      {isMobileDetailOpen &&
        selectedEntry &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9992] lg:hidden flex justify-end pms-modal-backdrop"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <button
              type="button"
              aria-label={getTranslation('eventLogCloseDetail', language)}
              onClick={() => setIsMobileDetailOpen(false)}
              className="absolute inset-0 bg-slate-950/65"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={getTranslation('eventLogDetailHeading', language)}
              className="relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
              style={{
                paddingTop: 'var(--pms-safe-area-top, env(safe-area-inset-top, 0px))',
              }}
            >
              {renderDetailContent(selectedEntry, () => setIsMobileDetailOpen(false))}
            </div>
          </div>,
          document.body
        )}

      {/* Dedicated Print Ledger Portal (hidden on screen, crisp multi-page RTL/LTR on print) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="pms-eventlog-print-portal hidden print:block bg-white text-slate-900 text-xs"
          >
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {establishmentProfile?.logoUrl && (
                  <img
                    src={establishmentProfile.logoUrl}
                    alt={establishmentProfile.name}
                    className="h-12 w-12 object-contain border border-slate-200 rounded p-0.5"
                  />
                )}
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {establishmentProfile?.name || 'Appointment PMS'}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {[establishmentProfile?.city, establishmentProfile?.phone, establishmentProfile?.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>
              <div className="text-end">
                <div className="text-sm font-bold text-slate-900">
                  {getTranslation('eventLogTitle', language)}
                </div>
                <div className="text-[11px] text-slate-600 tabular-nums">
                  {getTranslation('eventLogPrintGeneratedAt', language)} :{' '}
                  {new Date().toLocaleString(locale, { hour12: false })}
                </div>
                <div className="text-[11px] text-slate-600">
                  {getTranslation('eventLogPrintFilters', language)} : {activeFilterSummary}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4 border border-slate-300 rounded p-2 bg-slate-50">
              <div>
                <div className="text-[10px] text-slate-500">
                  {getTranslation('eventLogTotalEvents', language)}
                </div>
                <div className="text-sm font-bold tabular-nums">{stats.total}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">
                  {getTranslation('eventLogSuccessCount', language)}
                </div>
                <div className="text-sm font-bold tabular-nums text-emerald-700">
                  {stats.success}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">
                  {getTranslation('eventLogWarnCount', language)}
                </div>
                <div className="text-sm font-bold tabular-nums text-amber-700">{stats.warn}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">
                  {getTranslation('eventLogErrorCount', language)}
                </div>
                <div className="text-sm font-bold tabular-nums text-rose-700">{stats.error}</div>
              </div>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 px-2 py-1.5 text-start w-[15%]">
                    {getTranslation('eventLogTimestamp', language)}
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-start w-[10%]">
                    {getTranslation('eventLogActionCode', language)}
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-start w-[51%]">
                    {getTranslation('eventLogDetailHeading', language)}
                  </th>
                  <th className="border border-slate-700 px-2 py-1.5 text-start w-[24%]">
                    {getTranslation('eventLogActor', language)} / {getTranslation('eventLogTarget', language)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((entry) => {
                  const sev = renderSeverityIndicator(entry.severity);
                  return (
                    <tr key={`print-${entry.id}`} className="break-inside-avoid">
                      <td className="border border-slate-300 px-2 py-1.5 align-top font-mono tabular-nums whitespace-nowrap">
                        <div>{formatTimestampFull(entry.timestamp)}</div>
                        <div className="text-[10px] font-semibold mt-0.5">{sev.label}</div>
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 align-top">
                        <div className="font-semibold">{getCategoryLabel(entry.category)}</div>
                        <div className="font-mono text-[10px] text-slate-600 break-all">
                          {entry.action}
                        </div>
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 align-top">
                        <div className="font-bold text-slate-900">{entry.title}</div>
                        <div className="text-slate-700 mt-0.5">{entry.description}</div>
                        {entry.changes && entry.changes.length > 0 && (
                          <div className="mt-1 text-[10px] text-slate-700 font-mono">
                            {entry.changes
                              .map((c) => `${c.field}: ${c.before ?? '—'} -> ${c.after ?? '—'}`)
                              .join(' | ')}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 align-top">
                        <div className="font-semibold">{entry.actor.label}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{entry.actor.role}</div>
                        {entry.target && (
                          <div className="mt-1 text-[10px] text-slate-700">
                            {entry.target.label || entry.target.type}
                            {entry.target.secondaryLabel ? ` · ${entry.target.secondaryLabel}` : ''}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 pt-2 border-t border-slate-300 text-[10px] text-slate-500 flex items-center justify-between">
              <span>{getTranslation('eventLogPrintPageNotice', language)}</span>
              <span>{establishmentProfile?.name || 'Appointment PMS'}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
