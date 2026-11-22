import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LanDiscovery,
  startNativeLanDiscovery,
  supportsNativeLanDiscovery,
  type DiscoveredLanPeer,
} from '../services/p2p/LanDiscoveryBridge';

export const LanDiscoveryStatus: React.FC = () => {
  const { language } = useApp();
  const [peers, setPeers] = React.useState<Record<string, string>>({});
  const [active, setActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!supportsNativeLanDiscovery()) return;

    let cancelled = false;
    const subscriptions: Array<{ remove: () => Promise<void> }> = [];

    void Promise.all([
      LanDiscovery.addListener('peerFound', (peer: DiscoveredLanPeer) => {
        if (!cancelled) {
          setPeers((current) => ({ ...current, [peer.peerId]: peer.address }));
        }
      }),
      LanDiscovery.addListener('peerExpired', (event) => {
        if (!cancelled) {
          setPeers((current) => {
            const next = { ...current };
            delete next[event.peerId];
            return next;
          });
        }
      }),
      LanDiscovery.addListener('discoveryError', (detail) => {
        if (!cancelled) {
          setActive(false);
          setError(detail.message || 'LAN discovery is unavailable.');
        }
      }),
    ]).then(async (handles) => {
      subscriptions.push(...handles);
      if (cancelled) {
        await Promise.all(handles.map((handle) => handle.remove()));
        return;
      }
      try {
        await startNativeLanDiscovery();
        if (!cancelled) {
          setActive(true);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setActive(false);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setActive(false);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });

    return () => {
      cancelled = true;
      subscriptions.forEach((handle) => { void handle.remove(); });
      void LanDiscovery.stopDiscovery().catch(() => {
        // The native plugin may already be shutting down with the Android activity.
      });
    };
  }, []);


  if (!supportsNativeLanDiscovery()) return null;

  const isArabic = language === 'ar';
  const isFrench = language === 'fr';
  const count = Object.keys(peers).length;
  const label = error
    ? isArabic ? 'اكتشاف الشبكة المحلية غير متاح' : isFrench ? 'Découverte LAN indisponible' : 'LAN discovery unavailable'
    : !active
      ? isArabic ? 'جارٍ بدء اكتشاف الشبكة المحلية…' : isFrench ? 'Démarrage de la découverte LAN…' : 'Starting LAN discovery…'
      : count === 0
        ? isArabic ? 'الشبكة المحلية نشطة — لم يُكتشف أي جهاز' : isFrench ? 'Réseau local actif — aucun appareil détecté' : 'LAN active — no devices found'
        : isArabic ? `تم اكتشاف ${count} جهاز(أجهزة) Appointment` : isFrench ? `${count} appareil(s) Appointment détecté(s)` : `${count} Appointment device(s) discovered`;

  return (
    <div
      role="status"
      aria-live="polite"
      title={error || Object.entries(peers).map(([id, address]) => `${id} — ${address}`).join('\n')}
      className="flex min-h-7 shrink-0 items-center gap-2 border-t border-slate-200/70 bg-slate-50/80 px-3 py-1 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${error ? 'bg-amber-500' : active ? 'bg-emerald-500' : 'animate-pulse bg-slate-400'}`} aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      {count > 0 && <span className="ms-auto shrink-0 font-semibold tabular-nums">{count}</span>}
    </div>
  );
};
