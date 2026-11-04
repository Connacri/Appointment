import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  X,
  Layers,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  LockKeyhole,
} from 'lucide-react';
import { indexedDb, IndexedDbStoreStats } from '../db/indexedDb';

type StoreName = 'bookings' | 'invoices' | 'resources';

const STORE_LABELS: Record<StoreName, string> = {
  bookings: 'Réservations',
  invoices: 'Factures',
  resources: 'Ressources',
};

export const IndexedDbInspectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<IndexedDbStoreStats | null>(null);
  const [activeStore, setActiveStore] = useState<StoreName>('bookings');
  const [storeData, setStoreData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 5;

  const loadStatsAndData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, result] = await Promise.all([
        indexedDb.getStats(),
        indexedDb.queryStore<any>(activeStore, { offset, limit }),
      ]);
      setStats(nextStats);
      setStoreData(result.data);
      setTotalCount(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire les données locales.');
      setStoreData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeStore, offset]);

  useEffect(() => {
    if (isOpen) void loadStatsAndData();
  }, [isOpen, loadStatsAndData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalRecords = stats
    ? stats.storeCounts.bookings + stats.storeCounts.invoices + stats.storeCounts.resources
    : 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const storageLabel = stats?.storageType === 'IndexedDB'
    ? 'IndexedDB natif'
    : stats?.storageType === 'LocalStorage_Fallback'
      ? 'Repli localStorage'
      : 'Détection en cours';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in overflow-y-auto"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="indexeddb-inspector-title"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh]"
      >
        <header className="min-h-16 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              <Database size={19} />
            </div>
            <div className="min-w-0">
              <h2 id="indexeddb-inspector-title" className="font-bold text-slate-900 dark:text-white text-sm">
                Inspecteur des données locales
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Consultation du stockage de cette application dans ce navigateur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’inspecteur"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Eye size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            <p>
              <strong>Mode lecture seule.</strong> Cet écran affiche un aperçu des réservations,
              factures et ressources enregistrées localement. Il ne permet ni de modifier ni de
              supprimer les enregistrements.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-3 min-w-0">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Stockage utilisé</span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{storageLabel}</span>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-3">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Version du schéma</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {stats ? `Version ${stats.version}` : '—'}
            </span>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Enregistrements locaux</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {stats ? totalRecords.toLocaleString('fr-FR') : '—'}
            </span>
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(['bookings', 'invoices', 'resources'] as StoreName[]).map((storeName) => (
            <button
              type="button"
              key={storeName}
              onClick={() => {
                setActiveStore(storeName);
                setOffset(0);
              }}
              className={`shrink-0 px-3 py-2.5 border-b-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeStore === storeName
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers size={14} />
              {STORE_LABELS[storeName]}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                {stats?.storeCounts[storeName] ?? '—'}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
            <span>
              {STORE_LABELS[activeStore]} · {totalCount.toLocaleString('fr-FR')} enregistrement(s)
            </span>
            <button
              type="button"
              onClick={() => void loadStatsAndData()}
              disabled={loading}
              className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!error && !loading && storeData.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500">
              Aucun enregistrement dans cette collection.
            </div>
          )}

          {storeData.map((item, index) => (
            <article
              key={item.id || index}
              className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100 break-all">
                  ID : {item.id ?? 'Non défini'}
                </span>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {STORE_LABELS[activeStore]}
                </span>
              </div>
              <pre className="text-[10px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all overflow-x-auto">
                {JSON.stringify(item, null, 2)}
              </pre>
            </article>
          ))}

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <button
              type="button"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-2 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Précédent
            </button>
            <span className="text-slate-500 tabular-nums">Page {currentPage} / {pageCount}</span>
            <button
              type="button"
              disabled={offset + limit >= totalCount || loading}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-2 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-40"
            >
              Suivant <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
            <LockKeyhole size={13} className="shrink-0 mt-0.5" />
            <p>
              Les lectures sont asynchrones via l’API du navigateur. Cet inspecteur ne mesure pas
              les performances du moteur et ne représente pas l’état de synchronisation avec Supabase.
            </p>
          </div>
        </footer>
      </section>
    </div>
  );
};
