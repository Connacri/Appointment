import React, { useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  Info,
  RotateCw,
  Terminal,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import type { SyncLogLevel } from '../services/supabase/syncLog';

const LEVEL_META: Record<
  SyncLogLevel,
  { icon: LucideIcon; labelKey: 'syncLogLevelInfo' | 'syncLogLevelSuccess' | 'syncLogLevelWarn' | 'syncLogLevelError'; tone: string }
> = {
  info: { icon: Info, labelKey: 'syncLogLevelInfo', tone: 'text-sky-300' },
  success: { icon: CheckCircle2, labelKey: 'syncLogLevelSuccess', tone: 'text-emerald-400' },
  warn: { icon: AlertTriangle, labelKey: 'syncLogLevelWarn', tone: 'text-amber-400' },
  error: { icon: AlertCircle, labelKey: 'syncLogLevelError', tone: 'text-rose-400' },
};

const ACTION_BUTTON =
  'min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold ' +
  'text-slate-200 hover:bg-slate-800 active:bg-slate-700 cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

/**
 * Bottom-docked sync terminal. It only ever reports what the sync runner
 * actually observed: an acknowledged push, a fetched snapshot and the final
 * evidence-based phase. Nothing here can turn a pending or failed run green.
 */
export const SyncTerminal: React.FC = () => {
  const {
    language,
    cloudSyncStatus,
    syncLog,
    syncTerminalOpen,
    setSyncTerminalOpen,
    clearSyncLog,
    forceSupabaseSync,
  } = useApp();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo(
    () =>
      syncLog.map((entry) => {
        let text = getTranslation(entry.key, language);
        const hasDetailSlot = text.includes('{detail}');
        text = text.replace('{detail}', entry.detail ?? '');
        for (const [name, value] of Object.entries(entry.params ?? {})) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
        if (entry.detail && !hasDetailSlot) text = `${text} — ${entry.detail}`;
        return { ...entry, text };
      }),
    [syncLog, language],
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries, syncTerminalOpen]);

  const lastEntry = entries[entries.length - 1];
  const busy = cloudSyncStatus.isSyncing;
  const phase = cloudSyncStatus.phase;

  const phaseLabel = busy
    ? getTranslation('supabaseSyncing', language)
    : phase === 'synced'
      ? getTranslation('supabaseStatusSynced', language)
      : phase === 'offline'
        ? getTranslation('cloudStatusOffline', language)
        : phase === 'error'
          ? getTranslation('supabaseStatusError', language)
          : phase === 'pending'
            ? getTranslation('supabaseStatusPending', language).replace(
                '{count}',
                String(cloudSyncStatus.pendingCount),
              )
            : phase === 'no_workspace'
              ? getTranslation('supabaseStatusNoWorkspace', language)
              : phase === 'unauthenticated'
                ? getTranslation('supabaseStatusAuthRequired', language)
                : phase === 'unconfigured'
                  ? getTranslation('cloudStatusNotConfigured', language)
                  : getTranslation('supabaseForceSyncBtn', language);

  const PhaseIcon: LucideIcon = busy
    ? RotateCw
    : phase === 'synced'
      ? CheckCircle2
      : phase === 'offline'
        ? CloudOff
        : phase === 'error' || phase === 'pending'
          ? AlertTriangle
          : Cloud;

  if (!syncTerminalOpen) {
    if (syncLog.length === 0) return null;
    return (
      <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-2 pb-[env(safe-area-inset-bottom)] pt-1">
        <button
          type="button"
          onClick={() => setSyncTerminalOpen(true)}
          className={`${ACTION_BUTTON} w-full justify-start`}
          aria-expanded={false}
        >
          <ChevronUp size={16} className="shrink-0" aria-hidden="true" />
          <Terminal size={16} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{getTranslation('syncLogShowBtn', language)}</span>
          {lastEntry && (
            <span className="hidden min-w-0 truncate text-slate-400 sm:inline">· {lastEntry.text}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={getTranslation('syncLogTitle', language)}
      className="shrink-0 border-t border-slate-800 bg-slate-950 text-slate-100 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1">
        <button
          type="button"
          onClick={() => setSyncTerminalOpen(false)}
          className={ACTION_BUTTON}
          aria-expanded
          aria-controls="supabase-sync-log"
          aria-label={getTranslation('syncLogHideBtn', language)}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <div className="flex min-w-0 items-center gap-1.5">
          <Terminal size={16} className="shrink-0 text-sky-300" aria-hidden="true" />
          <h2 className="truncate text-xs font-bold">{getTranslation('syncLogTitle', language)}</h2>
        </div>
        <div
          className="flex min-w-0 items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold"
          role="status"
        >
          <PhaseIcon
            size={13}
            className={`shrink-0 ${busy ? 'animate-spin' : phase === 'synced' ? 'text-emerald-400' : phase === 'error' || phase === 'pending' ? 'text-amber-400' : 'text-sky-300'}`}
            aria-hidden="true"
          />
          <span className="truncate">{phaseLabel}</span>
          <span className="hidden truncate tabular-nums text-slate-400 lg:inline">
            {getTranslation('syncLogSummary', language)
              .replace('{pushed}', String(cloudSyncStatus.lastPushCount))
              .replace('{pulled}', String(cloudSyncStatus.lastPullCount))
              .replace('{pending}', String(cloudSyncStatus.pendingCount))
              .replace('{failed}', String(cloudSyncStatus.failedCount))}
          </span>
        </div>
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => void forceSupabaseSync()}
            disabled={busy}
            className={`${ACTION_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label={getTranslation('syncLogRetryBtn', language)}
          >
            <RotateCw size={15} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">{getTranslation('syncLogRetryBtn', language)}</span>
          </button>
          <button
            type="button"
            onClick={clearSyncLog}
            className={ACTION_BUTTON}
            aria-label={getTranslation('syncLogClearBtn', language)}
          >
            <Trash2 size={15} aria-hidden="true" />
            <span className="hidden sm:inline">{getTranslation('syncLogClearBtn', language)}</span>
          </button>
        </div>
      </div>

      <div
        id="supabase-sync-log"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={getTranslation('syncLogTitle', language)}
        className="max-h-[35vh] min-h-[4rem] overflow-y-auto overscroll-contain border-t border-slate-900 px-3 py-2 font-mono text-xs leading-relaxed"
      >
        {entries.length === 0 ? (
          <p className="text-slate-400">{getTranslation('syncLogEmpty', language)}</p>
        ) : (
          entries.map((entry) => {
            const meta = LEVEL_META[entry.level];
            const LevelIcon = meta.icon;
            return (
              <div
                key={entry.id}
                className="flex flex-wrap items-start gap-x-2 gap-y-0.5 border-b border-slate-900 py-0.5 last:border-b-0"
              >
                <time dateTime={entry.at} className="shrink-0 tabular-nums text-slate-500">
                  {new Date(entry.at).toLocaleTimeString()}
                </time>
                <span className={`inline-flex shrink-0 items-center gap-1 font-bold ${meta.tone}`}>
                  <LevelIcon size={12} aria-hidden="true" />
                  {getTranslation(meta.labelKey, language)}
                </span>
                <span className="min-w-0 flex-1 break-words text-slate-200 [overflow-wrap:anywhere]">
                  {entry.text}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
