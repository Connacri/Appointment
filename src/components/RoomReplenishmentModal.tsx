import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Minus,
  Search,
  X,
  PackageCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ResourceItem, StockItem } from '../types/booking';

export interface RoomReplenishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: ResourceItem[];
  initialRoomId?: string;
  initialRoomName?: string;
  initialQuantities?: Record<string, number>;
}

const PRESET_DEPART: Array<{ keys: string[]; keywords: string[]; qty: number }> = [
  { keys: ['savon', 'std_savon'], keywords: ['savon'], qty: 1 },
  { keys: ['gel', 'std_gel'], keywords: ['gel douche'], qty: 1 },
  { keys: ['shamp', 'std_shamp'], keywords: ['shampooing'], qty: 1 },
  { keys: ['pt', 'std_pt'], keywords: ['papier toilette'], qty: 2 },
  { keys: ['sac', 'std_sac'], keywords: ['sac poubelle'], qty: 2 },
  { keys: ['draps', 'std_draps'], keywords: ['draps'], qty: 1 },
  { keys: ['taie', 'std_taie'], keywords: ['taie'], qty: 2 },
  { keys: ['sdb', 'std_sdb'], keywords: ['serviette de bain'], qty: 2 },
  { keys: ['eau', 'std_eau'], keywords: ['eau minérale naturelle'], qty: 2 },
  { keys: ['cap', 'std_cap'], keywords: ['capsule café'], qty: 2 },
];

const PRESET_RECOUCH: Array<{ keys: string[]; keywords: string[]; qty: number }> = [
  { keys: ['savon', 'std_savon'], keywords: ['savon'], qty: 1 },
  { keys: ['gel', 'std_gel'], keywords: ['gel douche'], qty: 1 },
  { keys: ['pt', 'std_pt'], keywords: ['papier toilette'], qty: 1 },
  { keys: ['sdb', 'std_sdb'], keywords: ['serviette de bain'], qty: 1 },
  { keys: ['eau', 'std_eau'], keywords: ['eau minérale naturelle'], qty: 2 },
  { keys: ['cap', 'std_cap'], keywords: ['capsule café'], qty: 2 },
];

function findMatchingStockItem(
  stockItems: StockItem[],
  keys: string[],
  keywords: string[]
): StockItem | undefined {
  for (const key of keys) {
    const exact = stockItems.find((s) => s.id === key);
    if (exact) return exact;
  }
  for (const kw of keywords) {
    const low = kw.toLowerCase();
    const byName = stockItems.find((s) => s.name.toLowerCase().includes(low));
    if (byName) return byName;
  }
  return undefined;
}

export const RoomReplenishmentModal: React.FC<RoomReplenishmentModalProps> = ({
  isOpen,
  onClose,
  rooms,
  initialRoomId,
  initialRoomName,
  initialQuantities,
}) => {
  const {
    stockItems,
    recordRoomReplenishment,
    seedStandardStockCatalog,
    activeOperatorName,
    activeRoleDefinition,
    language,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);

  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || '');
  const [customRoomName, setCustomRoomName] = useState<string>(initialRoomName || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [markRoomClean, setMarkRoomClean] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeedingCatalog, setIsSeedingCatalog] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    roomName: string;
    deductedCount: number;
    lowStockTriggered: StockItem[];
    rupturedItems: StockItem[];
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const matchedRoom =
      rooms.find((r) => r.id === initialRoomId) ||
      (initialRoomName
        ? rooms.find((r) => r.name.toLowerCase().includes(initialRoomName.toLowerCase()))
        : undefined) ||
      rooms[0];

    setSelectedRoomId(matchedRoom?.id || '');
    setCustomRoomName(initialRoomName || matchedRoom?.name || '');
    setQuantities(initialQuantities ? { ...initialQuantities } : {});
    setCategoryFilter('all');
    setSearchTerm('');
    setMarkRoomClean(true);
    setNote('');
    setSubmissionResult(null);
    setSubmissionError(null);
    setIsSubmitting(false);
  }, [isOpen, initialRoomId, initialRoomName, initialQuantities, rooms]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const categories = useMemo(() => {
    const unique = new Set(stockItems.map((item) => item.category));
    return ['all', ...Array.from(unique)];
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return stockItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [stockItems, categoryFilter, searchTerm]);

  const selectedLines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) })),
    [quantities]
  );

  const totalUnitsSelected = selectedLines.reduce((sum, l) => sum + l.quantity, 0);

  if (!isOpen) return null;

  const selectedRoomObj = rooms.find((r) => r.id === selectedRoomId);
  const resolvedRoomName =
    selectedRoomObj?.name || customRoomName.trim() || t('Chambre', 'Room', 'غرفة');

  const applyPreset = (preset: Array<{ keys: string[]; keywords: string[]; qty: number }>) => {
    const next: Record<string, number> = {};
    for (const rule of preset) {
      const matched = findMatchingStockItem(stockItems, rule.keys, rule.keywords);
      if (matched) {
        next[matched.id] = rule.qty;
      }
    }
    setQuantities(next);
  };

  const adjustQty = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const nextVal = Math.max(0, (Number(prev[itemId]) || 0) + delta);
      const copy = { ...prev };
      if (nextVal === 0) delete copy[itemId];
      else copy[itemId] = nextVal;
      return copy;
    });
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLines.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const res = await recordRoomReplenishment({
        roomId: selectedRoomObj?.id, roomName: resolvedRoomName, items: selectedLines,
        markRoomClean, note, operatorName: activeOperatorName.trim() || undefined,
      });
      setSubmissionResult({ roomName: resolvedRoomName, ...res });
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Échec de la réalimentation du stock.');
    } finally { setIsSubmitting(false); }
  };

  const canSeedCatalog =
    activeRoleDefinition.permissions.canManageStock ||
    activeRoleDefinition.category === 'management' ||
    activeRoleDefinition.id === 'gouvernante';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      onClick={onClose}
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 pms-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-replenishment-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92dvh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden pms-modal"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="room-replenishment-title"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate"
            >
              <PackageCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                {t(
                  'Réalimentation & Consommables Chambre',
                  'Room Replenishment & Consumables',
                  'تزويد الغرفة بالمستهلكات'
                )}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {t(
                'La validation déduit automatiquement les quantités du stock et alerte en cas de seuil bas.',
                'Validating automatically deducts quantities from stock and notifies on low stock.',
                'يتم خصم الكميات تلقائياً من المخزون وإرسال تنبيه عند النقص.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Fermer', 'Close', 'إغلاق')}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {submissionResult ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  {t(
                    `Réalimentation validée pour ${submissionResult.roomName}`,
                    `Replenishment confirmed for ${submissionResult.roomName}`,
                    `تم تأكيد التزويد للغرفة ${submissionResult.roomName}`
                  )}
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {t(
                    `${submissionResult.deductedCount} article(s) déduit(s) automatiquement du stock central.`,
                    `${submissionResult.deductedCount} item(s) automatically deducted from central inventory.`,
                    `تم خصم ${submissionResult.deductedCount} أصناف تلقائياً من المخزون.`
                  )}
                </p>
              </div>
            </div>

            {submissionResult.lowStockTriggered.length > 0 && (
              <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
                  <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>
                    {t(
                      `Alerte rupture / seuil bas envoyée au Gérant (${submissionResult.lowStockTriggered.length} article(s))`,
                      `Low-stock / out-of-stock alert sent to Manager (${submissionResult.lowStockTriggered.length} item(s))`,
                      `تم إرسال تنبيه نقص / نفاد المخزون للمدير (${submissionResult.lowStockTriggered.length})`
                    )}
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-300">
                  {submissionResult.lowStockTriggered.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 tabular-nums">
                      <span className="font-semibold">{item.name}</span>
                      <span className="font-mono font-bold">
                        {item.quantity === 0
                          ? t('RUPTURE (0)', 'OUT OF STOCK (0)', 'نفد (0)')
                          : `${item.quantity} ${item.unit} (${t('min', 'min', 'الحد')}: ${item.minThreshold})`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setQuantities({});
                  setNote('');
                  setSubmissionResult(null);
                }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t('Réalimenter une autre chambre', 'Replenish another room', 'تزويد غرفة أخرى')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                {t('Terminer', 'Done', 'إنهاء')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirm} className="flex-1 min-h-0 flex flex-col">
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Room + Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="replenish-room-select"
                    className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {t('Chambre / Unité concernée', 'Room / Unit', 'الغرفة / الوحدة')}
                  </label>
                  {rooms.length > 0 ? (
                    <select
                      id="replenish-room-select"
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="replenish-room-select"
                      type="text"
                      value={customRoomName}
                      onChange={(e) => setCustomRoomName(e.target.value)}
                      placeholder={t('Ex: Chambre 101', 'e.g. Room 101', 'مثال: غرفة 101')}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {t('Dotations rapides', 'Quick Presets', 'تجهيز سريع')}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={stockItems.length === 0}
                      onClick={() => applyPreset(PRESET_DEPART)}
                      className="min-h-[44px] px-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-40 text-blue-700 dark:text-blue-300 text-xs font-bold cursor-pointer"
                    >
                      {t('Kit Départ', 'Turnover Kit', 'طقم مغادرة')}
                    </button>
                    <button
                      type="button"
                      disabled={stockItems.length === 0}
                      onClick={() => applyPreset(PRESET_RECOUCH)}
                      className="min-h-[44px] px-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer"
                    >
                      {t('Kit Recouche', 'Stayover Kit', 'طقم يومي')}
                    </button>
                  </div>
                </div>
              </div>

              {stockItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center space-y-3">
                  <Boxes size={30} className="mx-auto text-slate-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t(
                        'Aucun consommable configuré dans le stock',
                        'No consumables configured in stock',
                        'لا توجد مستلزمات مضافة في المخزون'
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'Chargez la dotation hôtelière standard ou ajoutez vos articles dans Stock & Économat.',
                        'Load the standard hotel consumables catalog or add items in Stock & Supplies.',
                        'قم بتحميل القائمة القياسية أو أضف الأصناف من تبويب المخزون.'
                      )}
                    </p>
                  </div>
                  {canSeedCatalog && (
                    <button
                      type="button"
                      disabled={isSeedingCatalog}
                      onClick={() => {
                        if (isSeedingCatalog) return;
                        setIsSeedingCatalog(true);
                        setSubmissionError(null);
                        void seedStandardStockCatalog()
                          .catch((error) => setSubmissionError(error instanceof Error ? error.message : 'Échec du chargement du catalogue.'))
                          .finally(() => setIsSeedingCatalog(false));
                      }}
                      className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                    >
                      {t(
                        'Charger la dotation hôtelière standard (25 articles)',
                        'Load standard hotel catalog (25 items)',
                        'تحميل القائمة الفندقية القياسية (25 صنف)'
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Search & Category Filter */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('Rechercher savon, draps, eau...', 'Search soap, linen, water...', 'ابحث عن صابون، بياضات، ماء...')}
                        className="w-full min-h-[40px] ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`min-h-[40px] px-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                            categoryFilter === cat
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {cat === 'all' ? t('Tous', 'All', 'الكل') : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Consumables list */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    {filteredItems.map((item) => {
                      const chosenQty = Number(quantities[item.id]) || 0;
                      const projected = Math.max(0, item.quantity - chosenQty);
                      const willTriggerLow = chosenQty > 0 && projected <= item.minThreshold;
                      const isCurrentlyLow = item.quantity <= item.minThreshold;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                            chosenQty > 0
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                              : 'bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-slate-400">· {item.category}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
                              <span
                                className={
                                  isCurrentlyLow
                                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                                    : 'text-slate-500 dark:text-slate-400'
                                }
                              >
                                {t('En stock', 'In stock', 'المتوفر')}: {item.quantity} {item.unit}
                              </span>
                              {willTriggerLow && (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  → {projected} ({t('Alerte seuil!', 'Low alert!', 'تنبيه نفاد!')})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => adjustQty(item.id, -1)}
                              aria-label={`${t('Diminuer', 'Decrease', 'تقليل')} ${item.name}`}
                              className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                            >
                              <Minus size={15} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={chosenQty || ''}
                              placeholder="0"
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setQuantities((prev) => {
                                  const copy = { ...prev };
                                  if (val === 0) delete copy[item.id];
                                  else copy[item.id] = val;
                                  return copy;
                                });
                              }}
                              aria-label={item.name}
                              className="w-14 min-h-[44px] text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => adjustQty(item.id, 1)}
                              aria-label={`${t('Augmenter', 'Increase', 'زيادة')} ${item.name}`}
                              className="min-h-[44px] min-w-[44px] rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center cursor-pointer"
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Optional Note & Mark Clean toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t('Note optionnelle (ex: Demande VIP)...', 'Optional note...', 'ملاحظة اختيارية...')}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {selectedRoomObj && (
                      <label className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={markRoomClean}
                          onChange={(e) => setMarkRoomClean(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <Sparkles size={14} className="text-emerald-500 shrink-0" />
                        <span className="truncate">
                          {t('Marquer la chambre Propre', 'Mark room Clean', 'تحديد الغرفة جاهزة')}
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}
            </div>

            {submissionError && (
              <div role="alert" className="mx-4 sm:mx-5 mb-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {submissionError}
              </div>
            )}
            {/* Footer CTA */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                <span className="font-bold text-slate-900 dark:text-white">{selectedLines.length}</span>{' '}
                {t('réf.', 'items', 'أصناف')} ·{' '}
                <span className="font-bold text-slate-900 dark:text-white">{totalUnitsSelected}</span>{' '}
                {t('unités', 'units', 'وحدات')}
              </div>

              <div className="flex items-center gap-2 ms-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('Annuler', 'Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={selectedLines.length === 0 || isSubmitting}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>
                    {t(
                      isSubmitting ? 'Validation…' : 'Valider réalimentation & Déduire du stock',
                      isSubmitting ? 'Validating…' : 'Validate & Deduct Stock',
                      isSubmitting ? 'جارٍ التحقق…' : 'تأكيد التزويد والخصم'
                    )}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
