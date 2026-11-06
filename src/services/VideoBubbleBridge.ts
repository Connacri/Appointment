import { registerPlugin } from '@capacitor/core';

export interface VideoBubbleStatus {
  overlayPermission: boolean;
  bubbleEnabled: boolean;
}

export interface PendingVideoShare {
  url?: string | null;
  openQuickAdd: boolean;
}

interface VideoBubblePlugin {
  getStatus(): Promise<VideoBubbleStatus>;
  requestOverlayPermission(): Promise<{ granted: boolean; settingsOpened?: boolean }>;
  startBubble(): Promise<void>;
  stopBubble(): Promise<void>;
  getPendingShare(): Promise<PendingVideoShare>;
}

export const VideoBubble = registerPlugin<VideoBubblePlugin>('VideoBubble');
