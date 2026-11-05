import React, { useState, useEffect, useMemo } from 'react';
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
  Globe,
  MapPin,
  RefreshCw,
  PartyPopper,
  Flame,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ALGERIA_69_WILAYAS } from '../data/algeriaWilayas';
import { getHolidaysAndEvents, HolidayEvent } from '../services/holidaysService';

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

  // Geolocation & Holidays Scraping State
  const [selectedWilaya, setSelectedWilaya] = useState<string>('31'); // Default Oran
  const [holidays, setHolidays] = useState<HolidayEvent[]>([]);
  const [isScrapingHolidays, setIsScrapingHolidays] = useState(false);

  const [year, month] = currentYearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Dimanche, 1 = Lundi, ... 5 = Vendredi, 6 = Samedi

  const currentRatesForType = dynamicRates[selectedType] || {};

  // Fetch / Scrape holidays and local events when year or wilaya changes
  useEffect(() => {
    let active = true;
    const fetchHolidays = async () => {
      setIsScrapingHolidays(true);
      try {
        const list = await getHolidaysAndEvents(year, selectedWilaya, 'DZ');
        if (active) setHolidays(list);
      } catch (err) {
        console.error('Error fetching holidays:', err);
      } finally {
        if (active) setIsScrapingHolidays(false);
      }
    };
    fetchHolidays();
    return () => {
      active = false;
    };
  }, [year, selectedWilaya]);

  const handleManualScrapeHolidays = async () => {
    setIsScrapingHolidays(true);
    try {
      const list = await getHolidaysAndEvents(year, selectedWilaya, 'DZ');
      setHolidays(list);
      const wilayaObj = ALGERIA_69_WILAYAS.find((w) => w.code === selectedWilaya);
      showToast(
        `Fêtes nationales, religieuses et événements synchronisés pour ${wilayaObj ? wilayaObj.nameFr : 'Algérie'} !`
      );
    } catch (err) {
      showToast('Erreur de synchronisation des événements');
    } finally {
      setIsScrapingHolidays(false);
    }
  };

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

  // Weekends in Algeria / MENA are Friday (5) and Saturday (6)
  const handleApplyWeekendsOnly = () => {
    if (bulkPriceInput <= 0) return;
    const bulk: Record<string, number> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      // Vendredi = 5, Samedi = 6
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        const dateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
        bulk[dateStr] = bulkPriceInput;
      }
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast('Tarif week-end (Vendredi & Samedi) appliqué avec succès !');
  };

  // Automatically apply surge price (+30% by default) to all holiday and event dates of this month
  const handleApplyHolidaySurge = () => {
    const base = hotelRooms.find((r) => r.type === selectedType)?.pricePerDay || 9000;
    const bulk: Record<string, number> = {};
    let count = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
      const holiday = holidays.find((h) => h.date === dateStr);
      if (holiday) {
        const multiplier = holiday.suggestedMultiplier || 1.3;
        bulk[dateStr] = Math.round(base * multiplier);
        count++;
      }
    }

    if (count === 0) {
      showToast('Aucun jour férié ou événement détecté sur ce mois.');
      return;
    }

    applyDynamicRatesBulk(selectedType, bulk);
    showToast(`Tarif majoré appliqué sur ${count} jour(s) férié(s) / événement(s) du mois !`);
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
    setTimeout(() => setToastMessage(null), 3500);
  };

  const baseRate = hotelRooms.find((r) => r.type === selectedType)?.pricePerDay || 9000;

  // Map of holidays by dateStr
  const holidaysMap = useMemo(() => {
    const map = new Map<string, HolidayEvent>();
    for (const h of holidays) {
      map.set(h.date, h);
    }
    return map;
  }, [holidays]);

  return (
    <div className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain space-y-3 sm:space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 pms-slide-up">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins size={18} className="text-amber-500 shrink-0" />
            <span>
              {language === 'fr'
                ? 'Tarifs par Date & Yield Management'
                : language === 'ar'
                ? 'إدارة الأسعار حسب التاريخ والفعاليات'
                : 'Dynamic Pricing & Yield Management'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
            {language === 'fr'
              ? 'Week-ends (Vendredi & Samedi), jours fériés nationaux/religieux et événements par géolocalisation'
              : 'Algerian weekend surge (Friday & Saturday), holidays, and localized event yield optimization'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400">Tarif de base :</span>
          <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {baseRate.toLocaleString()} {currency} / nuit
          </span>
        </div>
      </div>

      {/* Geolocation Scraping & Yield Control Panel */}
      <div className="bg-gradient-to-r from-blue-900/10 via-amber-900/10 to-emerald-900/10 dark:from-blue-950/40 dark:via-amber-950/30 dark:to-emerald-950/30 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
            <MapPin size={14} className="text-rose-500 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Géolocalisation :</span>
            <select
              value={selectedWilaya}
              onChange={(e) => setSelectedWilaya(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {ALGERIA_69_WILAYAS.map((w) => (
                <option key={w.code} value={w.code} className="dark:bg-slate-900">
                  {w.code} - {w.nameFr} ({w.nameAr})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleManualScrapeHolidays}
            disabled={isScrapingHolidays}
            className="px-3 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Scraper et synchroniser les jours fériés et événements officiels"
          >
            <RefreshCw size={13} className={isScrapingHolidays ? 'animate-spin text-blue-500' : 'text-slate-400'} />
            <span>
              {isScrapingHolidays
                ? 'Scraping en cours...'
                : 'Scraper Fériés & Événements'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApplyHolidaySurge}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Appliquer automatiquement les tarifs majorés sur les jours fériés et festivals détectés"
          >
            <PartyPopper size={14} />
            <span>Appliquer Majorations Fériés (+30%)</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Categories, Month Navigation, Bulk Price */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 rounded-2xl shadow-2xs">
        {/* Room Type Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Catégorie :</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
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
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Mois précédent"
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
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Mois suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <input
              type="number"
              step="100"
              value={bulkPriceInput}
              onChange={(e) => setBulkPriceInput(Number(e.target.value))}
              placeholder={`Prix ${currency}`}
              className="w-32 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white pr-7"
            />
            <span className="absolute right-2 text-[10px] text-slate-400 font-mono pointer-events-none">
              {currency}
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplyAllMonth}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          >
            Tout le mois
          </button>
          <button
            type="button"
            onClick={handleApplyWeekendsOnly}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            title="Appliquer sur les Vendredis et Samedis"
          >
            Week-ends (Ven & Sam)
          </button>
          <button
            type="button"
            onClick={handleClearMonth}
            className="px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer"
            title="Réinitialiser tous les tarifs personnalisés du mois"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Calendar Grid for Pricing: Weekends are Friday and Saturday */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        {/* Weekday Headers: Dim, Lun, Mar, Mer, Jeu, Ven (Weekend), Sam (Weekend) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {[
            { name: 'Dim', isWk: false },
            { name: 'Lun', isWk: false },
            { name: 'Mar', isWk: false },
            { name: 'Mer', isWk: false },
            { name: 'Jeu', isWk: false },
            { name: 'Ven', isWk: true }, // Friday: Weekend
            { name: 'Sam', isWk: true }, // Saturday: Weekend
          ].map((col) => (
            <div
              key={col.name}
              className={`text-center font-bold text-xs py-1.5 rounded-lg ${
                col.isWk
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/50'
                  : 'text-slate-400'
              }`}
            >
              <span>{col.name}</span>
              {col.isWk && <span className="text-[9px] block font-normal opacity-80">(Week-end)</span>}
            </div>
          ))}

          {/* Empty spacer slots for correct first day alignment */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`spacer-${idx}`} className="p-2.5 rounded-xl border border-transparent opacity-20" />
          ))}

          {/* Days of the Month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
            const dateObj = new Date(year, month - 1, dayNum);
            // Vendredi = 5, Samedi = 6
            const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;
            const customPrice = currentRatesForType[dateStr];
            const currentPrice = customPrice !== undefined ? customPrice : baseRate;
            const holiday = holidaysMap.get(dateStr);

            return (
              <div
                key={dateStr}
                className={`p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between transition-colors relative min-h-[96px] ${
                  holiday
                    ? 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-300 dark:border-rose-900'
                    : customPrice !== undefined
                    ? 'bg-amber-50/50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                    : isWeekend
                    ? 'bg-amber-50/20 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-900/40'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isWeekend ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayNum}
                  </span>

                  <div className="flex items-center gap-1">
                    {holiday && (
                      <span
                        className="px-1 py-0.2 rounded text-[8px] font-bold bg-rose-600 text-white shrink-0"
                        title={`${holiday.name} — ${holiday.description}`}
                      >
                        {holiday.category === 'religious' ? '🕌 Fête' : holiday.category === 'national' ? '🇩🇿 Férié' : '🎪 Event'}
                      </span>
                    )}
                    {customPrice !== undefined && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Tarif personnalisé actif" />
                    )}
                  </div>
                </div>

                {/* Holiday label snippet */}
                {holiday && (
                  <p className="text-[9px] font-medium text-rose-700 dark:text-rose-300 line-clamp-1 leading-tight my-1" title={holiday.name}>
                    {holiday.name}
                  </p>
                )}

                <div className="mt-auto pt-1">
                  <input
                    type="number"
                    step="100"
                    value={currentPrice}
                    onChange={(e) => setDynamicRate(selectedType, dateStr, Number(e.target.value))}
                    className="w-full text-right font-mono font-bold text-xs py-1 px-1 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                  <span className="text-[9px] text-slate-400 block text-right mt-0.5 font-mono">
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
