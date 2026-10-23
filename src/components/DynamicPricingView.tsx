import React, { useState } from 'react';
import {
  Coins,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const DynamicPricingView: React.FC = () => {
  const {
    dynamicRates,
    setDynamicRate,
    applyDynamicRatesBulk,
    currency,
    language,
    resourceGroups,
  } = useApp();

  const hotelRooms = resourceGroups
    .filter((g) => g.sector === 'hotel')
    .flatMap((g) => g.resources);

  const roomTypes = Array.from(new Set(hotelRooms.map((r) => r.type)));
  const [selectedType, setSelectedType] = useState<string>(roomTypes[0] || 'Double Standard');
  const [currentYearMonth, setCurrentYearMonth] = useState('2026-10');
  const [bulkPriceInput, setBulkPriceInput] = useState<number>(12000);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [year, month] = currentYearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const currentRatesForType = dynamicRates[selectedType] || {};

  const handlePrevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleApplyAllMonth = () => {
    if (bulkPriceInput <= 0) return;
    const bulk: Record<string, number> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
      bulk[dateStr] = bulkPriceInput;
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast('Tarif appliqué sur l’ensemble du mois avec succès !');
  };

  const handleApplyWeekendsOnly = () => {
    if (bulkPriceInput <= 0) return;
    const bulk: Record<string, number> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      // Friday & Saturday in Algeria / Arab world, or Sat/Sun
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        const dateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
        bulk[dateStr] = bulkPriceInput;
      }
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast('Tarif week-end appliqué avec succès !');
  };

  const handleClearMonth = () => {
    const bulk: Record<string, number> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
      delete currentRatesForType[dateStr];
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast('Surcharges du mois réinitialisées au tarif standard.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const baseRate = hotelRooms.find((r) => r.type === selectedType)?.pricePerDay || 9000;

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins size={22} className="text-amber-500" />
            <span>
              {language === 'fr'
                ? 'Gestion des Tarifs par Date & Yield Management'
                : language === 'ar'
                ? 'إدارة الأسعار حسب التاريخ والعائد'
                : 'Dynamic Pricing & Yield Management'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? 'Surcharges saisonnières, tarification événementielle et yield sur mesure'
              : 'Seasonal multipliers, weekend surges, and bespoke yield strategies'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Tarif standard de base :</span>
          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {baseRate.toLocaleString()} {currency} / nuit
          </span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
        {/* Room Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Catégorie :</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
          >
            {roomTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white px-2">
            {new Date(year, month - 1).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="100"
            value={bulkPriceInput}
            onChange={(e) => setBulkPriceInput(Number(e.target.value))}
            placeholder="Prix DA"
            className="w-28 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
          />
          <button
            onClick={handleApplyAllMonth}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Tout le mois
          </button>
          <button
            onClick={handleApplyWeekendsOnly}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Week-ends
          </button>
          <button
            onClick={handleClearMonth}
            className="px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
            title="Réinitialiser"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Calendar Grid for Pricing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-7 gap-2">
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((dayName, idx) => (
            <div
              key={dayName}
              className={`text-center font-bold text-xs py-1.5 rounded-lg ${
                idx === 5 || idx === 6
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'text-slate-400'
              }`}
            >
              {dayName}
            </div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
            const dateObj = new Date(year, month - 1, dayNum);
            const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;
            const customPrice = currentRatesForType[dateStr];
            const currentPrice = customPrice !== undefined ? customPrice : baseRate;

            return (
              <div
                key={dateStr}
                className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors ${
                  customPrice !== undefined
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                    : isWeekend
                    ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isWeekend ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {customPrice !== undefined && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Tarif personnalisé" />
                  )}
                </div>

                <div className="mt-2">
                  <input
                    type="number"
                    step="100"
                    value={currentPrice}
                    onChange={(e) => setDynamicRate(selectedType, dateStr, Number(e.target.value))}
                    className="w-full text-right font-mono font-bold text-xs py-1 px-1.5 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                    {currency}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
