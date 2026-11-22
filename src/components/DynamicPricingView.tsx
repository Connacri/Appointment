import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Coins,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  RotateCcw,
  MapPin,
  RefreshCw,
  Flag,
  Moon,
  Minus,
  Plus,
  TrendingUp,
  Tag,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ALGERIA_69_WILAYAS } from '../data/algeriaWilayas';
import { getHolidaysAndEvents, HolidayEvent } from '../services/holidaysService';

type MobileSubView = 'calendar' | 'list';
type AgendaFilter = 'all' | 'custom' | 'special';

function formatCompactPrice(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 10000 && value % 1000 === 0) {
    return `${Math.round(value / 1000)}k`;
  }
  if (value >= 10000 && value % 500 === 0) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return value.toLocaleString();
}

export const DynamicPricingView: React.FC = () => {
  const {
    dynamicRates,
    setDynamicRate,
    applyDynamicRatesBulk,
    clearDynamicRate,
    clearDynamicRatesMonth,
    currency,
    language,
    resourceGroups,
    currentDomain,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);

  const sectorRooms = useMemo(() => {
    const matching = resourceGroups
      .filter((g) => g.sector === currentDomain)
      .flatMap((g) => g.resources);
    if (matching.length > 0) return matching;
    return resourceGroups.flatMap((g) => g.resources);
  }, [resourceGroups, currentDomain]);

  const roomTypes = useMemo(() => {
    const types = Array.from(new Set(sectorRooms.map((r) => r.type).filter(Boolean)));
    return types;
  }, [sectorRooms]);

  const [selectedType, setSelectedType] = useState<string>(() => roomTypes[0] || 'Double Standard');

  useEffect(() => {
    if (roomTypes.length > 0 && !roomTypes.includes(selectedType)) {
      setSelectedType(roomTypes[0]);
    }
  }, [roomTypes, selectedType]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [currentYearMonth, setCurrentYearMonth] = useState<string>(() => todayIso.slice(0, 7));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => todayIso);
  const [mobileView, setMobileView] = useState<MobileSubView>('calendar');
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('all');

  const baseRate = useMemo(() => {
    return sectorRooms.find((r) => r.type === selectedType)?.pricePerDay || 9000;
  }, [sectorRooms, selectedType]);

  const [bulkPriceInput, setBulkPriceInput] = useState<number>(() => Math.max(1000, baseRate));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Geolocation & Holidays State
  const [selectedWilaya, setSelectedWilaya] = useState<string>('31');
  const [holidays, setHolidays] = useState<HolidayEvent[]>([]);
  const [isScrapingHolidays, setIsScrapingHolidays] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  const [year, month] = currentYearMonth.split('-').map(Number);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const firstDayOfWeek = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]);

  // Keep selectedDateStr inside active month when month switches
  useEffect(() => {
    if (!selectedDateStr.startsWith(`${currentYearMonth}-`)) {
      const targetDay = todayIso.startsWith(`${currentYearMonth}-`)
        ? todayIso
        : `${currentYearMonth}-01`;
      setSelectedDateStr(targetDay);
    }
  }, [currentYearMonth, selectedDateStr, todayIso]);

  const currentRatesForType = dynamicRates[selectedType] || {};

  // Fetch holidays when year or wilaya changes
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

  const holidaysMap = useMemo(() => {
    const map = new Map<string, HolidayEvent>();
    for (const h of holidays) {
      map.set(h.date, h);
    }
    return map;
  }, [holidays]);

  const monthHolidays = useMemo(() => {
    return holidays.filter((h) => h.date.startsWith(`${currentYearMonth}-`));
  }, [holidays, currentYearMonth]);

  // Compute monthly day records & KPIs cleanly
  const monthDays = useMemo(() => {
    const list: Array<{
      dayNum: number;
      dateStr: string;
      dayOfWeek: number;
      isWeekend: boolean;
      isToday: boolean;
      customPrice: number | undefined;
      effectivePrice: number;
      deltaPct: number;
      holiday: HolidayEvent | undefined;
    }> = [];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, dayNum);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Ven & Sam
      const customPrice = currentRatesForType[dateStr];
      const effectivePrice = customPrice !== undefined ? customPrice : baseRate;
      const deltaPct = baseRate > 0 ? Math.round(((effectivePrice - baseRate) / baseRate) * 100) : 0;
      const holiday = holidaysMap.get(dateStr);

      list.push({
        dayNum,
        dateStr,
        dayOfWeek,
        isWeekend,
        isToday: dateStr === todayIso,
        customPrice,
        effectivePrice,
        deltaPct,
        holiday,
      });
    }
    return list;
  }, [daysInMonth, currentYearMonth, year, month, currentRatesForType, baseRate, holidaysMap, todayIso]);

  const monthStats = useMemo(() => {
    let customCount = 0;
    let sum = 0;
    for (const d of monthDays) {
      if (d.customPrice !== undefined) customCount++;
      sum += d.effectivePrice;
    }
    const avgRate = monthDays.length > 0 ? Math.round(sum / monthDays.length) : baseRate;
    const avgDeltaPct = baseRate > 0 ? Math.round(((avgRate - baseRate) / baseRate) * 100) : 0;
    return {
      customCount,
      avgRate,
      avgDeltaPct,
      holidaysCount: monthHolidays.length,
    };
  }, [monthDays, monthHolidays, baseRate]);

  const filteredAgendaDays = useMemo(() => {
    if (agendaFilter === 'custom') return monthDays.filter((d) => d.customPrice !== undefined);
    if (agendaFilter === 'special') return monthDays.filter((d) => d.isWeekend || Boolean(d.holiday));
    return monthDays;
  }, [monthDays, agendaFilter]);

  const selectedDayRecord = useMemo(() => {
    return monthDays.find((d) => d.dateStr === selectedDateStr) || monthDays[0] || null;
  }, [monthDays, selectedDateStr]);

  const handleManualScrapeHolidays = async () => {
    setIsScrapingHolidays(true);
    try {
      const list = await getHolidaysAndEvents(year, selectedWilaya, 'DZ');
      setHolidays(list);
      const wilayaObj = ALGERIA_69_WILAYAS.find((w) => w.code === selectedWilaya);
      showToast(
        t(
          `Fériés et événements synchronisés (${wilayaObj ? wilayaObj.nameFr : 'Algérie'}).`,
          `Holidays and events synced (${wilayaObj ? wilayaObj.nameFr : 'Algeria'}).`,
          `تمت مزامنة العطل والفعاليات (${wilayaObj ? wilayaObj.nameAr : 'الجزائر'}).`
        )
      );
    } catch {
      showToast(t('Erreur de synchronisation', 'Sync error', 'خطأ في المزامنة'));
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

  const handleJumpToday = () => {
    setCurrentYearMonth(todayIso.slice(0, 7));
    setSelectedDateStr(todayIso);
  };

  const handleApplyAllMonth = () => {
    if (bulkPriceInput <= 0) return;
    const bulk: Record<string, number> = {};
    for (const d of monthDays) {
      bulk[d.dateStr] = bulkPriceInput;
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast(t('Tarif appliqué sur tout le mois.', 'Rate applied to entire month.', 'تم تطبيق السعر على كامل الشهر.'));
  };

  const handleApplyWeekendsOnly = () => {
    if (bulkPriceInput <= 0) return;
    const bulk: Record<string, number> = {};
    for (const d of monthDays) {
      if (d.isWeekend) bulk[d.dateStr] = bulkPriceInput;
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast(t('Tarif appliqué aux week-ends (Ven & Sam).', 'Weekend rate applied (Fri & Sat).', 'تم تطبيق سعر نهاية الأسبوع (الجمعة والسبت).'));
  };

  const handleApplyHolidaySurge = () => {
    const bulk: Record<string, number> = {};
    let count = 0;
    for (const d of monthDays) {
      if (d.holiday) {
        const multiplier = d.holiday.suggestedMultiplier || 1.3;
        bulk[d.dateStr] = Math.round(baseRate * multiplier);
        count++;
      }
    }
    if (count === 0) {
      showToast(t('Aucun jour férié ou événement sur ce mois.', 'No holidays or events this month.', 'لا توجد عطل أو فعاليات في هذا الشهر.'));
      return;
    }
    applyDynamicRatesBulk(selectedType, bulk);
    showToast(
      t(
        `Majoration appliquée sur ${count} jour(s) férié(s) / événement(s).`,
        `Surge pricing applied to ${count} holiday/event day(s).`,
        `تم تطبيق زيادة الأسعار على ${count} يوم(أيام) عطل وفعاليات.`
      )
    );
  };

  const handleClearMonth = () => {
    clearDynamicRatesMonth(selectedType, currentYearMonth);
    showToast(t('Tarifs du mois réinitialisés au tarif de base.', 'Month rates reset to base rate.', 'تمت إعادة ضبط أسعار الشهر للسعر الأساسي.'));
  };

  const stepSelectedRate = (dateStr: string, currentVal: number, delta: number) => {
    const nextVal = Math.max(0, currentVal + delta);
    setDynamicRate(selectedType, dateStr, nextVal);
  };

  const applyMultiplierToDay = (dateStr: string, multiplier: number) => {
    setDynamicRate(selectedType, dateStr, Math.round(baseRate * multiplier));
  };

  const monthLabel = useMemo(() => {
    return new Date(year, month - 1, 1).toLocaleDateString(
      isAr ? 'ar-DZ' : isFr ? 'fr-FR' : 'en-US',
      { month: 'long', year: 'numeric' }
    );
  }, [year, month, isAr, isFr]);

  const weekdays = useMemo(
    () => [
      { shortFr: 'Dim', shortEn: 'Sun', shortAr: 'ح', isWk: false },
      { shortFr: 'Lun', shortEn: 'Mon', shortAr: 'ن', isWk: false },
      { shortFr: 'Mar', shortEn: 'Tue', shortAr: 'ث', isWk: false },
      { shortFr: 'Mer', shortEn: 'Wed', shortAr: 'ر', isWk: false },
      { shortFr: 'Jeu', shortEn: 'Thu', shortAr: 'خ', isWk: false },
      { shortFr: 'Ven', shortEn: 'Fri', shortAr: 'ج', isWk: true },
      { shortFr: 'Sam', shortEn: 'Sat', shortAr: 'س', isWk: true },
    ],
    []
  );

  const renderHolidayBadgeIcon = (category: HolidayEvent['category']) => {
    if (category === 'religious') return <Moon size={11} className="shrink-0" />;
    if (category === 'national') return <Flag size={11} className="shrink-0" />;
    return <Sparkles size={11} className="shrink-0" />;
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 min-w-0 min-h-0 w-full max-w-full overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 p-3 sm:p-5 lg:p-6 space-y-4 pb-20 md:pb-8"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 end-4 start-4 sm:start-auto sm:max-w-sm z-50 bg-slate-900 dark:bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2.5 border border-slate-700"
        >
          <Check size={15} className="text-emerald-400 shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Coins size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('Tarifs & Yield Management', 'Yield & Dynamic Pricing', 'التسعير الديناميكي وإدارة العائد')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'Ajustement journalier, week-ends (Ven & Sam) et jours fériés par wilaya',
                'Daily rate overrides, Fri–Sat weekends, and regional holiday surge',
                'تعديل الأسعار اليومية وعطلات نهاية الأسبوع (الجمعة والسبت) والأعياد'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('Tarif standard', 'Base rate', 'السعر الأساسي')}
          </span>
          <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {baseRate.toLocaleString()} {currency}
            <span className="text-[11px] font-normal text-slate-400"> / {t('nuit', 'night', 'ليلة')}</span>
          </span>
        </div>
      </header>

      {/* Empty room types notice */}
      {roomTypes.length === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>
            {t(
              'Aucune catégorie de chambre configurée dans le secteur actuel. La grille utilise la catégorie « Double Standard » par défaut.',
              'No room categories configured in the active sector. Using default "Double Standard" profile.',
              'لا توجد فئات غرف في القطاع الحالي. يتم استخدام الفئة الافتراضية.'
            )}
          </span>
        </div>
      )}

      {/* 4-Card KPI Strip (Tabular Nums, Single 1px Border, No Gradients) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Tarif de base', 'Base Rate', 'السعر الأساسي')}</span>
            <Tag size={14} className="text-slate-400 shrink-0" />
          </div>
          <div className="mt-1.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {baseRate.toLocaleString()} <span className="text-xs font-semibold text-slate-400">{currency}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Moyenne du mois', 'Monthly Avg', 'معدل الشهر')}</span>
            <TrendingUp size={14} className="text-blue-500 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 min-w-0">
            <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
              {monthStats.avgRate.toLocaleString()} <span className="text-xs font-semibold text-slate-400">{currency}</span>
            </span>
            {monthStats.avgDeltaPct !== 0 && (
              <span
                className={`text-[11px] font-bold font-mono tabular-nums shrink-0 ${
                  monthStats.avgDeltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {monthStats.avgDeltaPct > 0 ? `+${monthStats.avgDeltaPct}%` : `${monthStats.avgDeltaPct}%`}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Jours personnalisés', 'Custom Days', 'أيام معدلة')}</span>
            <Coins size={14} className="text-amber-500 shrink-0" />
          </div>
          <div className="mt-1.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {monthStats.customCount} <span className="text-xs font-normal text-slate-400">/ {daysInMonth}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Fériés & Événements', 'Holidays & Events', 'أعياد وفعاليات')}</span>
            <Flag size={14} className="text-rose-500 shrink-0" />
          </div>
          <div className="mt-1.5 text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {monthStats.holidaysCount}
          </div>
        </div>
      </section>

      {/* Controls & Category Strip */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        {/* Row 1: Room Category Horizontal Selector + Month Navigator */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {t('Catégorie de chambre', 'Room Category', 'فئة الغرفة')}
            </span>
            {roomTypes.length > 0 ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 snap-x">
                {roomTypes.map((typeName) => {
                  const active = selectedType === typeName;
                  return (
                    <button
                      key={typeName}
                      type="button"
                      onClick={() => setSelectedType(typeName)}
                      aria-pressed={active}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 snap-start border transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {typeName}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{selectedType}</div>
            )}
          </div>

          {/* Month Stepper */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label={t('Mois précédent', 'Previous month', 'الشهر السابق')}
              className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              {isAr ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button
              type="button"
              onClick={handleJumpToday}
              className="min-h-[44px] px-3 text-sm font-bold text-slate-900 dark:text-white capitalize whitespace-nowrap hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              title={t('Revenir au mois en cours', 'Jump to current month', 'العودة إلى الشهر الحالي')}
            >
              {monthLabel}
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label={t('Mois suivant', 'Next month', 'الشهر التالي')}
              className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              {isAr ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>

        {/* Row 2: Geolocation Holidays + Bulk Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 items-end">
          {/* Geolocation & Holiday Surge */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,260px)_auto_auto] gap-2">
            <label className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <MapPin size={15} className="text-rose-500 shrink-0" />
              <select
                value={selectedWilaya}
                onChange={(e) => setSelectedWilaya(e.target.value)}
                aria-label={t('Wilaya / Zone', 'Region / Wilaya', 'الولاية')}
                className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {ALGERIA_69_WILAYAS.map((w) => (
                  <option key={w.code} value={w.code} className="dark:bg-slate-900">
                    {w.code} - {isAr ? w.nameAr : w.nameFr}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleManualScrapeHolidays}
              disabled={isScrapingHolidays}
              className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={14} className={isScrapingHolidays ? 'animate-spin text-blue-500' : 'text-slate-400'} />
              <span>{t('Synchroniser Fériés', 'Sync Holidays', 'مزامنة العطل')}</span>
            </button>

            <button
              type="button"
              onClick={handleApplyHolidaySurge}
              className="min-h-[44px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles size={14} />
              <span>{t('Majoration Fériés (+30%)', 'Holiday Surge (+30%)', 'زيادة العطل (+30%)')}</span>
            </button>
          </div>

          {/* Bulk Pricing Controls */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <div className="col-span-2 sm:col-span-1 relative flex items-center">
              <input
                type="number"
                inputMode="numeric"
                step="100"
                min="0"
                value={bulkPriceInput}
                onChange={(e) => setBulkPriceInput(Math.max(0, Number(e.target.value)))}
                aria-label={t('Tarif groupé', 'Bulk rate', 'سعر جماعي')}
                className="w-full sm:w-36 min-h-[44px] px-3 pe-11 text-xs font-mono font-bold tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute end-3 text-[11px] text-slate-400 font-mono pointer-events-none">
                {currency}
              </span>
            </div>

            <button
              type="button"
              onClick={handleApplyAllMonth}
              className="min-h-[44px] px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              {t('Tout le mois', 'Full Month', 'كامل الشهر')}
            </button>

            <button
              type="button"
              onClick={handleApplyWeekendsOnly}
              className="min-h-[44px] px-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              {t('Week-ends (Ven/Sam)', 'Weekends (Fri/Sat)', 'الجمعة والسبت')}
            </button>

            <button
              type="button"
              onClick={handleClearMonth}
              className="col-span-2 sm:col-span-1 min-h-[44px] px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title={t('Réinitialiser tout le mois', 'Reset month overrides', 'إعادة ضبط الشهر')}
            >
              <RotateCcw size={14} />
              <span className="sm:hidden lg:inline">{t('Réinitialiser', 'Reset', 'إعادة ضبط')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* MOBILE WORKSPACE (< md): Segmented Toggle + Touch Mini Calendar / Agenda List */}
      <div className="md:hidden space-y-3">
        {/* Mobile View Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMobileView('calendar')}
            aria-pressed={mobileView === 'calendar'}
            className={`min-h-[44px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              mobileView === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Calendar size={15} />
            <span>{t('Calendrier', 'Calendar', 'التقويم')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView('list')}
            aria-pressed={mobileView === 'list'}
            className={`min-h-[44px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              mobileView === 'list'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <List size={15} />
            <span>{t('Liste du mois', 'Month List', 'قائمة الشهر')}</span>
          </button>
        </div>

        {mobileView === 'calendar' ? (
          <>
            {/* Touch-First Compact 7-Column Calendar Grid (Tap to Select Day, No Inline Cramped Inputs) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5">
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {weekdays.map((col) => (
                  <div
                    key={col.shortFr}
                    className={`text-center text-[11px] font-bold py-1 rounded-md ${
                      col.isWk
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isAr ? col.shortAr : isFr ? col.shortFr : col.shortEn}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`m-spacer-${idx}`} className="min-h-[50px]" />
                ))}

                {monthDays.map((day) => {
                  const isSelected = day.dateStr === selectedDateStr;
                  const isCustom = day.customPrice !== undefined;
                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      onClick={() => setSelectedDateStr(day.dateStr)}
                      aria-pressed={isSelected}
                      className={`min-h-[52px] rounded-xl border p-1 flex flex-col items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : day.holiday
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/70 text-slate-900 dark:text-white'
                          : isCustom
                          ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/70 text-slate-900 dark:text-white'
                          : day.isWeekend
                          ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between px-0.5">
                        <span
                          className={`text-[11px] font-bold font-mono tabular-nums ${
                            isSelected
                              ? 'text-white'
                              : day.isToday
                              ? 'text-blue-600 dark:text-blue-400 underline'
                              : day.isWeekend
                              ? 'text-amber-600 dark:text-amber-400'
                              : ''
                          }`}
                        >
                          {day.dayNum}
                        </span>
                        {(day.holiday || isCustom) && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected
                                ? 'bg-white'
                                : day.holiday
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          />
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold tabular-nums leading-none truncate max-w-full ${
                          isSelected
                            ? 'text-blue-50'
                            : isCustom
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {formatCompactPrice(day.effectivePrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thumb-Zone Selected Day Editor Card */}
            {selectedDayRecord && (
              <SelectedDayInspectorCard
                day={selectedDayRecord}
                baseRate={baseRate}
                currency={currency}
                language={language}
                selectedType={selectedType}
                onSetRate={setDynamicRate}
                onClearRate={clearDynamicRate}
                onStepRate={stepSelectedRate}
                onApplyMultiplier={applyMultiplierToDay}
                renderHolidayBadgeIcon={renderHolidayBadgeIcon}
              />
            )}
          </>
        ) : (
          /* Mobile List / Agenda View */
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: 'all', label: t('Tous les jours', 'All days', 'كل الأيام') },
                  { id: 'custom', label: t('Modifiés', 'Custom', 'المعدلة') },
                  { id: 'special', label: t('Week-ends & Fériés', 'Weekends & Holidays', 'العطل والفعاليات') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAgendaFilter(tab.id)}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                    agendaFilter === tab.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredAgendaDays.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t('Aucun jour ne correspond à ce filtre.', 'No days match this filter.', 'لا توجد أيام مطابقة لهذا الفلتر.')}
                </div>
              ) : (
                filteredAgendaDays.map((day) => {
                  const formattedDayName = new Date(year, month - 1, day.dayNum).toLocaleDateString(
                    isAr ? 'ar-DZ' : isFr ? 'fr-FR' : 'en-US',
                    { weekday: 'short', day: 'numeric', month: 'short' }
                  );
                  return (
                    <div
                      key={day.dateStr}
                      className={`bg-white dark:bg-slate-900 border rounded-2xl p-3 flex flex-col gap-2.5 ${
                        day.holiday
                          ? 'border-rose-200 dark:border-rose-900/70'
                          : day.customPrice !== undefined
                          ? 'border-amber-300 dark:border-amber-800/70'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                              {formattedDayName}
                            </span>
                            {day.isWeekend && (
                              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                {t('Week-end', 'Weekend', 'عطلة أسبوع')}
                              </span>
                            )}
                          </div>
                          {day.holiday && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5 flex items-center gap-1">
                              {renderHolidayBadgeIcon(day.holiday.category)}
                              <span className="truncate">{isAr && day.holiday.nameAr ? day.holiday.nameAr : day.holiday.name}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-end shrink-0">
                          {day.deltaPct !== 0 && (
                            <span
                              className={`text-[11px] font-mono font-bold tabular-nums ${
                                day.deltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {day.deltaPct > 0 ? `+${day.deltaPct}%` : `${day.deltaPct}%`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stepSelectedRate(day.dateStr, day.effectivePrice, -500)}
                          aria-label="-500"
                          className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={16} />
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            step="100"
                            min="0"
                            value={day.effectivePrice}
                            onChange={(e) => setDynamicRate(selectedType, day.dateStr, Math.max(0, Number(e.target.value)))}
                            className="w-full min-h-[44px] px-3 pe-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold tabular-nums text-sm text-slate-900 dark:text-white text-center"
                          />
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 pointer-events-none">
                            {currency}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => stepSelectedRate(day.dateStr, day.effectivePrice, 500)}
                          aria-label="+500"
                          className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={16} />
                        </button>
                        {day.customPrice !== undefined && (
                          <button
                            type="button"
                            onClick={() => clearDynamicRate(selectedType, day.dateStr)}
                            aria-label={t('Réinitialiser ce jour', 'Reset day', 'إعادة ضبط اليوم')}
                            className="min-h-[44px] min-w-[44px] rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP / TABLET WORKSPACE (md+): 7-Col Grid + Sticky Day & Events Inspector */}
      <div className="hidden md:grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="grid grid-cols-7 gap-2">
            {weekdays.map((col) => (
              <div
                key={col.shortFr}
                className={`text-center font-bold text-xs py-2 rounded-xl border ${
                  col.isWk
                    ? 'text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-900/60'
                    : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'
                }`}
              >
                <span>{isAr ? col.shortAr : isFr ? col.shortFr : col.shortEn}</span>
                {col.isWk && (
                  <span className="text-[10px] block font-medium opacity-80">
                    {t('Week-end', 'Weekend', 'عطلة')}
                  </span>
                )}
              </div>
            ))}

            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`d-spacer-${idx}`} className="min-h-[104px] rounded-xl border border-transparent" />
            ))}

            {monthDays.map((day) => {
              const isSelected = day.dateStr === selectedDateStr;
              const isCustom = day.customPrice !== undefined;
              return (
                <div
                  key={day.dateStr}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors min-h-[104px] cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/40 dark:bg-blue-950/25'
                      : day.holiday
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/70 hover:border-rose-300'
                      : isCustom
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/70 hover:border-amber-400'
                      : day.isWeekend
                      ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/40 hover:border-amber-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`text-xs font-bold font-mono tabular-nums ${
                        day.isToday
                          ? 'px-1.5 py-0.5 rounded-md bg-blue-600 text-white'
                          : day.isWeekend
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    <div className="flex items-center gap-1">
                      {day.holiday && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shrink-0"
                          title={`${day.holiday.name} — ${day.holiday.description}`}
                        >
                          {renderHolidayBadgeIcon(day.holiday.category)}
                        </span>
                      )}
                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearDynamicRate(selectedType, day.dateStr);
                          }}
                          title={t('Réinitialiser au tarif standard', 'Reset to base rate', 'إعادة للسعر الأساسي')}
                          aria-label={t('Réinitialiser ce jour', 'Reset day', 'إعادة ضبط اليوم')}
                          className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {day.holiday && (
                    <p
                      className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 line-clamp-1 leading-tight my-1"
                      title={day.holiday.name}
                    >
                      {isAr && day.holiday.nameAr ? day.holiday.nameAr : day.holiday.name}
                    </p>
                  )}

                  <div className="mt-auto pt-1">
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={day.effectivePrice}
                      onFocus={() => setSelectedDateStr(day.dateStr)}
                      onChange={(e) => setDynamicRate(selectedType, day.dateStr, Math.max(0, Number(e.target.value)))}
                      aria-label={`${day.dateStr} ${selectedType}`}
                      className="w-full text-end font-mono font-bold tabular-nums text-xs py-1 px-1 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                    />
                    <div className="flex items-center justify-between mt-0.5 text-[10px] font-mono tabular-nums">
                      <span
                        className={
                          day.deltaPct > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : day.deltaPct < 0
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-slate-400'
                        }
                      >
                        {day.deltaPct !== 0 ? `${day.deltaPct > 0 ? '+' : ''}${day.deltaPct}%` : ''}
                      </span>
                      <span className="text-slate-400">{currency}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Inspector & Month Holidays List */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          {selectedDayRecord && (
            <SelectedDayInspectorCard
              day={selectedDayRecord}
              baseRate={baseRate}
              currency={currency}
              language={language}
              selectedType={selectedType}
              onSetRate={setDynamicRate}
              onClearRate={clearDynamicRate}
              onStepRate={stepSelectedRate}
              onApplyMultiplier={applyMultiplierToDay}
              renderHolidayBadgeIcon={renderHolidayBadgeIcon}
            />
          )}

          {/* Month Holidays / Events Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Flag size={13} className="text-rose-500" />
                <span>{t('Événements du mois', 'Month Events', 'فعاليات الشهر')}</span>
              </h2>
              <span className="text-xs font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300">
                {monthHolidays.length}
              </span>
            </div>

            {monthHolidays.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('Aucun jour férié ou événement détecté ce mois-ci.', 'No holidays or events detected this month.', 'لا توجد عطل أو فعاليات مسجلة هذا الشهر.')}
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                {monthHolidays.map((ev) => {
                  const suggestedPrice = Math.round(baseRate * (ev.suggestedMultiplier || 1.3));
                  return (
                    <div
                      key={`${ev.date}_${ev.name}`}
                      onClick={() => setSelectedDateStr(ev.date)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {isAr && ev.nameAr ? ev.nameAr : ev.name}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                          {ev.date.slice(5)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          +{Math.round(((ev.suggestedMultiplier || 1.3) - 1) * 100)}% ({suggestedPrice.toLocaleString()} {currency})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDynamicRate(selectedType, ev.date, suggestedPrice);
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          {t('Appliquer', 'Apply', 'تطبيق')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

interface SelectedDayInspectorProps {
  day: {
    dayNum: number;
    dateStr: string;
    isWeekend: boolean;
    customPrice: number | undefined;
    effectivePrice: number;
    deltaPct: number;
    holiday: HolidayEvent | undefined;
  };
  baseRate: number;
  currency: string;
  language: 'fr' | 'en' | 'ar';
  selectedType: string;
  onSetRate: (roomType: string, date: string, price: number) => void;
  onClearRate: (roomType: string, date: string) => void;
  onStepRate: (dateStr: string, currentVal: number, delta: number) => void;
  onApplyMultiplier: (dateStr: string, multiplier: number) => void;
  renderHolidayBadgeIcon: (category: HolidayEvent['category']) => React.ReactNode;
}

const SelectedDayInspectorCard: React.FC<SelectedDayInspectorProps> = ({
  day,
  baseRate,
  currency,
  language,
  selectedType,
  onSetRate,
  onClearRate,
  onStepRate,
  onApplyMultiplier,
  renderHolidayBadgeIcon,
}) => {
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);

  const [year, month, dNum] = day.dateStr.split('-').map(Number);
  const fullDateLabel = new Date(year, month - 1, dNum).toLocaleDateString(
    isAr ? 'ar-DZ' : isFr ? 'fr-FR' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
            {selectedType}
          </span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize mt-0.5">
            {fullDateLabel}
          </h3>
        </div>
        {day.customPrice !== undefined && (
          <button
            type="button"
            onClick={() => onClearRate(selectedType, day.dateStr)}
            className="min-h-[36px] px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw size={12} />
            <span>{t('Standard', 'Reset', 'افتراضي')}</span>
          </button>
        )}
      </div>

      {/* Holiday or Weekend Context */}
      {(day.holiday || day.isWeekend) && (
        <div className="space-y-1.5">
          {day.isWeekend && (
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Calendar size={13} />
              <span>{t('Jour de week-end (Ven / Sam)', 'Weekend night (Fri / Sat)', 'ليلة نهاية الأسبوع (جمعة / سبت)')}</span>
            </div>
          )}
          {day.holiday && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                {renderHolidayBadgeIcon(day.holiday.category)}
                <span>{isAr && day.holiday.nameAr ? day.holiday.nameAr : day.holiday.name}</span>
              </div>
              <p className="text-[11px] text-rose-600/90 dark:text-rose-300/80">{day.holiday.description}</p>
              <button
                type="button"
                onClick={() => onApplyMultiplier(day.dateStr, day.holiday?.suggestedMultiplier || 1.3)}
                className="w-full min-h-[38px] rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                {t(
                  `Appliquer tarif conseillé (+${Math.round(((day.holiday.suggestedMultiplier || 1.3) - 1) * 100)}%)`,
                  `Apply suggested (+${Math.round(((day.holiday.suggestedMultiplier || 1.3) - 1) * 100)}%)`,
                  `تطبيق السعر المقترح (+${Math.round(((day.holiday.suggestedMultiplier || 1.3) - 1) * 100)}%)`
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Big Touch Price Stepper */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{t('Tarif appliqué', 'Applied rate', 'السعر المطبق')}</span>
          {day.deltaPct !== 0 && (
            <span
              className={`font-mono font-bold tabular-nums ${
                day.deltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {day.deltaPct > 0 ? `+${day.deltaPct}%` : `${day.deltaPct}%`} vs base
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStepRate(day.dateStr, day.effectivePrice, -500)}
            aria-label="-500"
            className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Minus size={18} />
          </button>

          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              step="100"
              min="0"
              value={day.effectivePrice}
              onChange={(e) => onSetRate(selectedType, day.dateStr, Math.max(0, Number(e.target.value)))}
              aria-label={t('Tarif du jour', 'Day rate', 'سعر اليوم')}
              className="w-full min-h-[48px] px-3 pe-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold tabular-nums text-base text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
              {currency}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onStepRate(day.dateStr, day.effectivePrice, 500)}
            aria-label="+500"
            className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Quick Yield Presets */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => onClearRate(selectedType, day.dateStr)}
          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-blue-400 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          {t('Base', 'Base', 'أساسي')}
        </button>
        {[
          { label: '+15%', mult: 1.15 },
          { label: '+30%', mult: 1.3 },
          { label: '+50%', mult: 1.5 },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onApplyMultiplier(day.dateStr, preset.mult)}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-amber-400 text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};
