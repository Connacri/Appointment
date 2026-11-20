/**
 * Evidence-based Supabase sync telemetry.
 *
 * Events are structured so the terminal can translate every line in the active
 * language. Raw provider errors stay in `detail`: they are not translatable and
 * must be shown verbatim instead of being replaced by a generic message.
 */

export type SyncLogLevel = 'info' | 'success' | 'warn' | 'error';

export type SyncLogKey =
  | 'syncLogStarted'
  | 'syncLogForceStarted'
  | 'cloudStatusOffline'
  | 'cloudStatusNotConfigured'
  | 'supabaseStatusAuthRequired'
  | 'supabaseStatusNoWorkspace'
  | 'syncLogOutbox'
  | 'syncLogBackfillSkipped'
  | 'syncLogBackfillDone'
  | 'syncLogBackfillFailed'
  | 'syncLogPushing'
  | 'syncLogPushed'
  | 'syncLogPushFailed'
  | 'syncLogPushDone'
  | 'syncLogPulling'
  | 'syncLogPulled'
  | 'syncLogPullFailed'
  | 'syncLogMerged'
  | 'syncLogVerifying'
  | 'syncLogSynced'
  | 'syncLogPending'
  | 'syncLogNothingToSync'
  | 'syncLogError';

export interface SyncProgressEvent {
  key: SyncLogKey;
  level: SyncLogLevel;
  params?: Record<string, string | number>;
  detail?: string;
}

export interface SyncLogEntry extends SyncProgressEvent {
  id: string;
  at: string;
}

export const SYNC_LOG_MAX_ENTRIES = 200;
