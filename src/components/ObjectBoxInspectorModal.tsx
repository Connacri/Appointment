import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  Server,
  Layers,
  Cpu,
  Search,
  CheckCircle,
  RefreshCw,
  HardDrive,
  FileCode,
} from 'lucide-react';
import { objectBox, ObjectBoxStoreStats } from '../db/objectbox';
import { useApp } from '../context/AppContext';

export const ObjectBoxInspectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { language } = useApp();
  const [stats, setStats] = useState<ObjectBoxStoreStats | null>(null);
  const [activeBox, setActiveBox] = useState<'bookings' | 'invoices' | 'resources'>('bookings');
  const [boxData, setBoxData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 5;

  const loadStatsAndData = async () => {
    const s = await objectBox.getStats();
    setStats(s);

    const res = await objectBox.queryBox<any>(activeBox, {
      offset,
      limit,
    });
    setBoxData(res.data);
    setTotalCount(res.total);
  };

  useEffect(() => {
    if (isOpen) {
      loadStatsAndData();
    }
  }, [isOpen, activeBox, offset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <Database size={20} className="text-emerald-500" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                ObjectBox Embedded Engine Inspector
              </span>
              <span className="text-[11px] text-slate-400 block">
                Conforme aux exigences d'architecture locale AGENTS.md §11
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono">
              v2.0 IndexedDB Store
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Engine Specs Bar */}
        <div className="p-4 bg-slate-950 text-slate-300 grid grid-cols-3 gap-3 text-xs border-b border-slate-800">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Stockage Local</span>
            <span className="font-mono text-emerald-400 font-bold">
              {stats?.storageType || 'IndexedDB Engine'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Règle §11 Lazy Query</span>
            <span className="font-mono text-sky-400 font-bold">
              Offset & Limit Actifs
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Champs Indexés</span>
            <span className="font-mono text-purple-400 font-bold truncate block">
              domain, date, status
            </span>
          </div>
        </div>

        {/* Box Switcher Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 bg-slate-100/50 dark:bg-slate-850/50 text-xs font-semibold gap-2">
          {(['bookings', 'invoices', 'resources'] as const).map((box) => (
            <button
              key={box}
              onClick={() => {
                setActiveBox(box);
                setOffset(0);
              }}
              className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeBox === box
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers size={14} />
              <span className="capitalize">Box : {box}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded">
                {stats?.boxCounts[box] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Query Output View */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs font-mono">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Affichage paginé des entités (Offset: {offset}, Limit: {limit}) — Total : {totalCount}
            </span>
            <button
              onClick={loadStatsAndData}
              className="flex items-center gap-1 text-blue-600 hover:underline"
            >
              <RefreshCw size={12} />
              <span>Rafraîchir</span>
            </button>
          </div>

          <div className="space-y-2">
            {boxData.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-[11px] overflow-x-auto"
              >
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>ID : {item.id}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                    @Entity {activeBox.slice(0, -1).toUpperCase()}
                  </span>
                </div>
                <pre className="text-slate-700 dark:text-slate-300 text-[10px] whitespace-pre-wrap">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-sans">
            <button
              disabled={offset <= 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-40"
            >
              ← Précédent
            </button>
            <span className="text-slate-500 text-xs">
              Page {Math.floor(offset / limit) + 1} / {Math.max(1, Math.ceil(totalCount / limit))}
            </span>
            <button
              disabled={offset + limit >= totalCount}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850 text-xs">
          <span className="text-slate-400 text-[11px]">
            Toutes les écritures sont exécutées hors du thread principal d'affichage.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
