import React from 'react';
import { AlertTriangle, ChevronDown, Laptop, Radio, RefreshCw, Smartphone, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { indexedDb } from '../db/indexedDb';
import {
  LanDiscovery,
  startNativeLanDiscovery,
  supportsNativeLanDiscovery,
  type DiscoveredLanPeer,
} from '../services/p2p/LanDiscoveryBridge';

export const LanDiscoveryStatus: React.FC = () => {
  const { language } = useApp();
  const [peers, setPeers] = React.useState<Record<string, DiscoveredLanPeer>>({});
  const [active, setActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const compatibilityRecoveryAttempted = React.useRef(false);
  const nativeDiscoveryAvailable = supportsNativeLanDiscovery();

  const startDiscovery = React.useCallback(async () => {
    compatibilityRecoveryAttempted.current = false;
    setError(null);
    try {
      const nodeId = await indexedDb.getP2pNodeId();
      await startNativeLanDiscovery(nodeId);
      setActive(true);
    } catch (cause) {
      setActive(false);
      setError(cause instanceof Error ? cause.message : String(cause));
      await LanDiscovery.stopDiscovery().catch(() => undefined);
    }
  }, []);

  React.useEffect(() => {
    if (!nativeDiscoveryAvailable) return undefined;

    let cancelled = false;
    const subscriptions: Array<{ remove: () => Promise<void> }> = [];

    void Promise.all([
      LanDiscovery.addListener('peerFound', (peer: DiscoveredLanPeer) => {
        if (!cancelled) {
          setPeers((current) => ({ ...current, [peer.peerId]: peer }));
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
        if (cancelled) return;
        const message = detail.message || 'LAN discovery is unavailable.';
        setActive(false);
        setPeers({});
        setError(message);

        // Android 16 compatibility is requested only after a concrete socket denial.
        if (
          /eperm|operation not permitted/i.test(message)
          && !compatibilityRecoveryAttempted.current
        ) {
          compatibilityRecoveryAttempted.current = true;
          void LanDiscovery.requestAndroid16CompatibilityPermission()
            .then(() => {
              if (!cancelled) {
                setActive(true);
                setError(null);
              }
            })
            .catch(async (cause: unknown) => {
              await LanDiscovery.stopDiscovery().catch(() => undefined);
              if (!cancelled) {
                setActive(false);
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            });
        }
      }),
    ]).then(async (handles) => {
      subscriptions.push(...handles);
      if (cancelled) {
        await Promise.all(handles.map((handle) => handle.remove()));
        return;
      }
      await startDiscovery();
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setActive(false);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });

    return () => {
      cancelled = true;
      subscriptions.forEach((handle) => { void handle.remove(); });
      void LanDiscovery.stopDiscovery().catch(() => undefined);
    };
  }, [nativeDiscoveryAvailable, startDiscovery]);

  const isArabic = language === 'ar';
  const isFrench = language === 'fr';
  const count = Object.keys(peers).length;
  const browserMessage = isArabic
    ? 'متصفح الويب لا يتيح اكتشاف أجهزة LAN مباشرة. استخدم تطبيق Appointment الأصلي.'
    : isFrench
      ? 'Ce navigateur ne permet pas la découverte LAN native. Utilisez Appointment natif pour détecter les appareils.'
      : 'This browser cannot perform native LAN discovery. Use the native Appointment app to discover devices.';

  if (!nativeDiscoveryAvailable) {
    return (
      <div
        role="status"
        aria-live="polite"
        title={browserMessage}
        className="flex min-h-8 w-full items-center gap-2 border-t border-slate-200/70 bg-slate-50/80 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
      >
        <WifiOff size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {isFrench ? 'Pairs LAN : découverte native non disponible dans ce navigateur' : isArabic ? 'أجهزة الشبكة المحلية: الاكتشاف الأصلي غير متاح في هذا المتصفح' : 'LAN peers: native discovery unavailable in this browser'}
        </span>
      </div>
    );
  }

  const label = error
    ? isArabic ? 'أجهزة LAN — خطأ في الاكتشاف' : isFrench ? 'Pairs LAN — erreur de découverte' : 'LAN peers — discovery error'
    : !active
      ? isArabic ? 'أجهزة LAN — جارٍ البحث…' : isFrench ? 'Pairs LAN — recherche…' : 'LAN peers — searching…'
      : count === 0
        ? isArabic ? 'أجهزة LAN — لم يتم اكتشاف أي جهاز' : isFrench ? 'Pairs LAN — aucun appareil détecté' : 'LAN peers — no devices detected'
        : isArabic
          ? `أجهزة LAN — تم اكتشاف ${count} جهاز(أجهزة) · نقل البيانات غير مفعل`
          : isFrench
            ? `Pairs LAN — ${count} appareil(s) détecté(s) · transport métier non activé`
            : `LAN peers — ${count} device(s) detected · business transport not enabled`;

  const peerList = Object.values(peers).sort((a, b) =>
    a.peerName.localeCompare(b.peerName, undefined, { sensitivity: 'base' }),
  );
  const peerTitle = peerList
    .map((peer) => `${peer.peerName} — ${peer.address} — ${peer.peerId}`)
    .join('\n');

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex min-h-8 w-full shrink-0 items-center gap-2 border-t border-slate-200/70 bg-slate-50/80 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${error ? 'bg-rose-500' : active ? 'bg-emerald-500' : 'animate-pulse bg-slate-400'}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate" title={error || peerTitle || browserMessage}>{label}</span>
      {count > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="appointment-lan-peer-list"
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          title={peerTitle}
        >
          <Laptop size={13} />
          <span className="tabular-nums">{count}</span>
          <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
        </button>
      )}
      {error && (
        <button
          type="button"
          onClick={() => { void startDiscovery(); }}
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw size={12} />
          {isArabic ? 'إعادة المحاولة' : isFrench ? 'Réessayer' : 'Retry'}
        </button>
      )}
      {expanded && count > 0 && (
        <div
          id="appointment-lan-peer-list"
          role="region"
          aria-label={isFrench ? 'Appareils détectés sur le réseau local' : isArabic ? 'الأجهزة المكتشفة على الشبكة المحلية' : 'Discovered LAN devices'}
          className="absolute inset-x-2 top-full z-[160] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Radio size={13} />
            <span>{isFrench ? 'Appareils présents sur le LAN' : isArabic ? 'الأجهزة الموجودة على الشبكة المحلية' : 'Devices present on the LAN'}</span>
          </div>
          {peerList.map((peer) => (
            <div key={peer.peerId} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Laptop size={14} className="shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{peer.peerName}</div>
                <div className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{peer.address}</div>
              </div>
              <span className="shrink-0 rounded bg-amber-50 px-1.5 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {isFrench ? 'Détecté' : isArabic ? 'تم الاكتشاف' : 'Discovered'}
              </span>
            </div>
          ))}
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{isFrench
              ? 'La présence LAN est détectée, mais le transport P2P authentifié des données métier n’est pas encore activé. Ces appareils ne sont pas encore synchronisés.'
              : isArabic
                ? 'تم اكتشاف الأجهزة على الشبكة المحلية، لكن نقل بيانات العمل عبر P2P الموثق غير مفعل بعد. هذه الأجهزة ليست متزامنة بعد.'
                : 'LAN presence is detected, but authenticated P2P business-data transport is not enabled yet. These devices are not synchronized yet.'}</span>
          </p>
        </div>
      )}
    </div>
  );
};
