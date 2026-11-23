import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface DiscoveredLanPeer {
  peerId: string;
  address: string;
  protocolVersion: 1;
}

export interface LanDiscoveryStartResult {
  nodeId: string;
  protocolVersion: 1;
  /** Discovery announces presence only; it does not imply an authenticated connection. */
  discoveryOnly: true;
}

export interface LanDiscoveryError {
  message: string;
}

interface LanDiscoveryPlugin {
  startDiscovery(options?: { nodeId?: string }): Promise<LanDiscoveryStartResult>;
  getNodeIdentity(): Promise<{ nodeId: string }>;
  resetNodeIdentity(): Promise<{ nodeId: string }>;
  stopDiscovery(): Promise<void>;
  requestAndroid16CompatibilityPermission(): Promise<LanDiscoveryStartResult>;
  addListener(
    eventName: 'peerFound',
    listener: (peer: DiscoveredLanPeer) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'peerExpired',
    listener: (event: { peerId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'discoveryError',
    listener: (error: LanDiscoveryError) => void,
  ): Promise<PluginListenerHandle>;
}

export const LanDiscovery = registerPlugin<LanDiscoveryPlugin>('LanDiscovery');

export function supportsNativeLanDiscovery(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

/**
 * The Android bridge owns a stable installation UUID in app-private noBackupFilesDir storage.
 * It shares only protocolVersion + peerId over IPv4 multicast; workspace data,
 * credentials and business records are never included in discovery packets.
 */
export async function getNativeLanNodeIdentity(): Promise<string> {
  if (!supportsNativeLanDiscovery()) {
    throw new Error('Native LAN identity is available only in the Android APK.');
  }
  return (await LanDiscovery.getNodeIdentity()).nodeId;
}

export async function resetNativeLanNodeIdentity(): Promise<string> {
  if (!supportsNativeLanDiscovery()) {
    throw new Error('Native LAN identity reset is available only in the Android APK.');
  }
  return (await LanDiscovery.resetNodeIdentity()).nodeId;
}

export async function startNativeLanDiscovery(nodeId?: string): Promise<LanDiscoveryStartResult> {
  if (!supportsNativeLanDiscovery()) {
    throw new Error('Native LAN discovery is available only in the Android APK.');
  }
  return LanDiscovery.startDiscovery(nodeId ? { nodeId } : undefined);
}
