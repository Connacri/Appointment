import React from 'react';
import { useApp } from '../context/AppContext';
import { supportsNativeLanDiscovery } from '../services/p2p/LanDiscoveryBridge';

interface PeerDetail {
  peerId: string;
  address: string;
}

export const LanDiscoveryStatus: React.FC = () => {
  const { language } = useApp();
  const [peers, setPeers] = React.useState<Record<string, string>>({});
  const [active, setActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!supportsNativeLanDiscovery()) return;

    const onStarted = () => {
      setActive(true);
      setError(null);
    };
    const onPeerFound = (event: Event) => {
      const peer = (event as CustomEvent<PeerDetail>).detail;
      if (!peer?.peerId || !peer.address) return;
      setPeers((current) => ({ ...current, [peer.peerId]: peer.address }));
    };
    const onPeerExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ peerId: string }>).detail;
      if (!detail?.peerId) return;
      setPeers((current) => {
        const next = { ...current };
        delete next[detail.peerId];
        return next;
      });
    };
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setActive(false);
      setError(detail?.message || 'LAN discovery is unavailable.');
    };

    window.addEventListener('appointment-p2p-discovery-started', onStarted);
    window.addEventListener('appointment-p2p-peer-found', onPeerFound);
    window.addEventListener('appointment-p2p-peer-expired', onPeerExpired);
    window.addEventListener('appointment-p2p-discovery-error', onError);

    return () => {
      window.removeEventListener('appointment-p2p-discovery-started', onStarted);
      window.removeEventListener('appointment-p2p-peer-found', onPeerFound);
      window.removeEventListener('appointment-p2p-peer-expired', onPeerExpired);
      window.removeEventListener('appointment-p2p-discovery-error', onError);
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
