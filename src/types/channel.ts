import { DomainType } from './booking';

export type ChannelSyncStatus = 'connected' | 'syncing' | 'error' | 'paused';
export type ChannelSyncType = '2_way_xml' | 'ical' | 'rest_api';

export interface ChannelConnection {
  id: string;
  name: string;
  domain: DomainType;
  logo: string;
  syncType: ChannelSyncType;
  status: ChannelSyncStatus;
  isActive: boolean;
  lastSyncAt: string;
  latencyMs: number;
  mappedUnitsCount: number;
  totalUnitsCount: number;
  markupPercent: number; // e.g. +15% OTA commission markup
  autoStopSellThreshold: number; // threshold when 1 room remains
  apiUrl?: string;
  webhookStatus: 'active' | 'degraded' | 'offline';
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'overbooking'
  | 'rate_disparity'
  | 'sync_failure'
  | 'stop_sell'
  | 'unmapped_unit'
  | 'ota_commission_spike';

export interface ChannelAlert {
  id: string;
  domain: DomainType;
  severity: AlertSeverity;
  type: AlertType;
  channelId: string;
  channelName: string;
  unitName?: string;
  bookingRef?: string;
  title: { fr: string; en: string; ar?: string };
  description: { fr: string; en: string; ar?: string };
  recommendedAction: { fr: string; en: string };
  timestamp: string;
  isResolved: boolean;
}

export interface SyncLogEvent {
  id: string;
  timestamp: string;
  channelName: string;
  direction: 'inbound' | 'outbound';
  action: string;
  status: 'success' | 'warn' | 'error';
  payloadSummary: string;
  durationMs: number;
}
