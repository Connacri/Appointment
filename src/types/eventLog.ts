export type EventLogCategory =
  | 'booking'
  | 'housekeeping'
  | 'task'
  | 'stock'
  | 'billing'
  | 'locks'
  | 'sync'
  | 'system';

export type EventLogSeverity = 'info' | 'success' | 'warn' | 'error';

export type EventLogSource = 'live' | 'history';

export interface EventLogChange {
  field: string;
  before?: string;
  after?: string;
}

export interface EventLogActor {
  role: string;
  label: string;
}

export interface EventLogTarget {
  type: string;
  id?: string;
  label?: string;
  secondaryLabel?: string;
}

export type EventLogMetadataValue = string | number | boolean | null;

export interface EventLogEntry {
  id: string;
  timestamp: string;
  category: EventLogCategory;
  action: string;
  severity: EventLogSeverity;
  title: string;
  description: string;
  actor: EventLogActor;
  target?: EventLogTarget;
  changes?: EventLogChange[];
  metadata?: Record<string, EventLogMetadataValue>;
  bookingId?: string;
  resourceId?: string;
  workspaceId?: string;
  source: EventLogSource;
}

export type NewEventLogInput = Omit<
  EventLogEntry,
  'id' | 'timestamp' | 'actor' | 'workspaceId' | 'source'
> & {
  id?: string;
  timestamp?: string;
  actor?: EventLogActor;
  workspaceId?: string;
  source?: EventLogSource;
};

export interface EventLogFilterOptions {
  query?: string;
  category?: EventLogCategory | 'all';
  severity?: EventLogSeverity | 'all';
  fromDate?: string;
  toDate?: string;
}
