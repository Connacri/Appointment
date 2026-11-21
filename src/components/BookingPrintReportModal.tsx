import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Edit3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  BookingPrintScope,
  buildPoliceSheetDataFromBooking,
  filterBookingsForPrintReport,
  getPoliceSheetMissingFields,
} from '../utils/bookingPrintReport';
import { PoliceSheetDocument } from './PoliceSheetModal';

interface BookingPrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'today' | 'range';
}

function addDaysIso(baseIso: string, delta: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + delta);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthRangeIso(baseIso: string): { start: string; end: string } {
  const [y, m] = baseIso.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIndex = (m || 1) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, '0');
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export const BookingPrintReportModal: React.FC<BookingPrintReportModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'today',
}) => {
  const {
    language,
    bookings,
    resourceGroups,
    selectedBuildingGroupId,
    currentDomain,
    currency,
    establishmentProfile,
    setSelectedBooking,
  } = useApp();

  const todayIso = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [mode, setMode] = useState<'today' | 'range'>(initialMode);
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [scope, setScope] = useState<BookingPrintScope>('all');
  const [buildingFilter, setBuildingFilter] = useState<string | 'all'>(selectedBuildingGroupId);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    if (initialMode === 'today') {
      setFromDate(todayIso);
      setToDate(todayIso);
    } else {
      setFromDate(todayIso);
      setToDate(addDaysIso(todayIso, 7));
    }
    setBuildingFilter(selectedBuildingGroupId);
  }, [isOpen, initialMode, todayIso, selectedBuildingGroupId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const effectiveFrom = mode === 'today' ? todayIso : fromDate;
  const effectiveTo = mode === 'today' ? todayIso : toDate;

  const report = useMemo(
    () =>
      filterBookingsForPrintReport({
        bookings,
        resourceGroups,
        fromDate: effectiveFrom,
        toDate: effectiveTo,
        scope,
        sector: currentDomain,
        buildingGroupId: buildingFilter,
        includeCancelled,
        language,
      }),
    [
      bookings,
      resourceGroups,
      effectiveFrom,
      effectiveTo,
      scope,
      currentDomain,
      buildingFilter,
      includeCancelled,
      language,
    ]
  );

  const sheets = useMemo(() => {
    return report.hits.map((hit) => {
      const mapped = buildPoliceSheetDataFromBooking({
        booking: hit.booking,
        resource: hit.resource,
        defaultCurrency: currency || 'DA',
      });
      const missingFields = getPoliceSheetMissingFields(mapped, language);
      return {
        hit,
        mapped,
        missingFields,
      };
    });
  }, [report.hits, currency, language]);

  const incompleteSheets = useMemo(
    () => sheets.filter((item) => item.missingFields.length > 0),
    [sheets]
  );

  if (!isOpen || typeof document === 'undefined') return null;

  const isRtl = language === 'ar';
  const domainBuildings = resourceGroups.filter((group) => group.sector === currentDomain);

  return createPortal(
    <div
      className="pms-bookings-print-portal fixed inset-0 z-[10002] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs pms-modal-backdrop overflow-y-auto print:static print:inset-auto print:bg-transparent print:p-0 print:block"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-print-report-title"
        dir={isRtl ? 'rtl' : 'ltr'}
        className="pms-dialog-panel bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] my-auto pms-modal print:block print:border-none print:shadow-none print:rounded-none print:max-h-none print:max-w-none print:bg-white print:overflow-visible"
      >
        {/* Top Toolbar (hidden on print) */}
        <header className="print:hidden px-3.5 sm:px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <h2
                id="booking-print-report-title"
                className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate"
              >
                {language === 'ar'
                  ? 'طباعة بطاقات الشرطة — اليوم والفترة'
                  : language === 'en'
                  ? "Police Sheets Batch Print — Today & Date Range"
                  : "Fiches de Police — Aujourd'hui & Intervalle"}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {language === 'ar'
                  ? 'اطبع جميع بطاقات الشرطة الفردية (DGSN) لنزلاء اليوم أو لفترة محددة (ورقة لكل نزيل).'
                  : language === 'en'
                  ? 'Print official individual DGSN police registration sheets (1 sheet per reservation).'
                  : "Imprimez en un lot les fiches individuelles de police DGSN du jour ou d'un intervalle."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
            className="min-w-11 min-h-11 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <X size={19} />
          </button>
        </header>

        {/* Interactive Controls (hidden on print) */}
        <section className="print:hidden px-3.5 sm:px-5 py-3 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Mode Switcher: Aujourd'hui vs Intervalle */}
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setMode('today');
                  setFromDate(todayIso);
                  setToDate(todayIso);
                }}
                aria-pressed={mode === 'today'}
                className={`min-h-9 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mode === 'today'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
                }`}
              >
                {language === 'ar' ? `اليوم (${todayIso})` : language === 'en' ? `Today (${todayIso})` : `Aujourd'hui (${todayIso})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('range');
                  if (fromDate === toDate) {
                    setToDate(addDaysIso(fromDate, 7));
                  }
                }}
                aria-pressed={mode === 'range'}
                className={`min-h-9 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mode === 'range'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
                }`}
              >
                {language === 'ar'
                  ? 'فترة محددة'
                  : language === 'en'
                  ? 'Date Interval'
                  : 'Intervalle de dates'}
              </button>
            </div>

            {/* Quick interval presets */}
            {mode === 'range' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFromDate(todayIso);
                    setToDate(addDaysIso(todayIso, 6));
                  }}
                  className="min-h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {language === 'ar' ? '7 أيام' : language === 'en' ? 'Next 7 days' : '7 prochains jours'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const month = monthRangeIso(todayIso);
                    setFromDate(month.start);
                    setToDate(month.end);
                  }}
                  className="min-h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {language === 'ar' ? 'هذا الشهر' : language === 'en' ? 'This month' : 'Ce mois'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {mode === 'range' && (
              <>
                <div className="min-w-0">
                  <label
                    htmlFor="print-report-from"
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    {language === 'ar' ? 'من تاريخ' : language === 'en' ? 'From date' : 'Du'}
                  </label>
                  <input
                    id="print-report-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="print-report-to"
                    className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    {language === 'ar' ? 'إلى تاريخ' : language === 'en' ? 'To date' : 'Au'}
                  </label>
                  <input
                    id="print-report-to"
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </>
            )}

            <div className="min-w-0">
              <label
                htmlFor="print-report-scope"
                className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
              >
                {language === 'ar' ? 'حالة الإقامة' : language === 'en' ? 'Stay filter' : 'Filtrer par mouvement'}
              </label>
              <select
                id="print-report-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as BookingPrintScope)}
                className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="all">
                  {language === 'ar'
                    ? 'جميع النزلاء في الفترة'
                    : language === 'en'
                    ? 'All active stays in range'
                    : 'Toutes actives sur la période'}
                </option>
                <option value="arrivals">
                  {language === 'ar'
                    ? 'الوصول فقط (Check-in)'
                    : language === 'en'
                    ? 'Arrivals only (Check-in)'
                    : 'Arrivées uniquement (Check-in)'}
                </option>
                <option value="departures">
                  {language === 'ar'
                    ? 'المغادرة فقط (Check-out)'
                    : language === 'en'
                    ? 'Departures only (Check-out)'
                    : 'Départs uniquement (Check-out)'}
                </option>
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="print-report-building"
                className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
              >
                {language === 'ar' ? 'المبنى' : language === 'en' ? 'Building' : 'Bâtiment / Building'}
              </label>
              <select
                id="print-report-building"
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="all">
                  {language === 'ar'
                    ? 'جميع المباني'
                    : language === 'en'
                    ? 'All buildings'
                    : 'Tous les bâtiments'}
                </option>
                {domainBuildings.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name[language] || group.name.fr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="min-h-10 w-full flex items-center gap-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={(e) => setIncludeCancelled(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>
                  {language === 'ar'
                    ? 'تضمين الملغاة'
                    : language === 'en'
                    ? 'Include cancelled'
                    : 'Inclure annulées'}
                </span>
              </label>
            </div>
          </div>

          {!report.isValidRange && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                {language === 'ar'
                  ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له.'
                  : language === 'en'
                  ? 'End date must be on or after the start date.'
                  : 'La date de fin doit être postérieure ou égale à la date de début.'}
              </span>
            </div>
          )}

          {report.isValidRange && incompleteSheets.length > 0 && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">
                  {language === 'ar'
                    ? `${incompleteSheets.length} بطاقة تحتاج إكمال بيانات (رقم الوثيقة / التأشيرة):`
                    : language === 'en'
                    ? `${incompleteSheets.length} sheet(s) missing ID or visa details:`
                    : `${incompleteSheets.length} fiche(s) à compléter (pièce d'identité / visa) :`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {incompleteSheets.slice(0, 3).map(({ hit }) => (
                  <button
                    key={hit.booking.id}
                    type="button"
                    onClick={() => {
                      setSelectedBooking(hit.booking);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/90 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>
                      {hit.booking.guestName || '—'} ({hit.booking.resourceName})
                    </span>
                  </button>
                ))}
                {incompleteSheets.length > 3 && (
                  <span className="text-[11px] font-bold">+{incompleteSheets.length - 3}</span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Preview & Batch Print Stage */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-5 bg-slate-200/75 dark:bg-slate-950 space-y-6 print:p-0 print:bg-white print:space-y-0 print:overflow-visible">
          {sheets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 py-12 px-4 text-center space-y-2 print:border-none">
              <CalendarDays size={30} className="mx-auto text-slate-400" />
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {language === 'ar'
                  ? 'لا توجد بطاقات شرطة مطابقة لهذه الفترة.'
                  : language === 'en'
                  ? 'No police registration sheets match this date range.'
                  : 'Aucune fiche de police ne correspond à cette date ou période.'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'جرّب تغيير نوع الحركة أو توسيع نطاق التواريخ.'
                  : language === 'en'
                  ? 'Try adjusting the date range, building filter, or stay movement scope.'
                  : "Essayez d'élargir l'intervalle de dates ou de changer le filtre de bâtiment."}
              </p>
            </div>
          ) : (
            sheets.map(({ hit, mapped, missingFields }, index) => (
              <div key={hit.booking.id} className="pms-police-batch-item space-y-2 print:space-y-0">
                {/* Per-sheet screen bar (hidden on print) */}
                <div className="print:hidden flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-[11px] tabular-nums">
                      {index + 1} / {sheets.length}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {hit.booking.guestName || '—'} · {hit.booking.resourceName}
                    </span>
                    {hit.buildingLabel && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        {hit.buildingLabel}
                      </span>
                    )}
                    {hit.isArrivalInPeriod && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                        {language === 'ar' ? 'وصول' : language === 'en' ? 'Arrival' : 'Arrivée'}
                      </span>
                    )}
                    {hit.isDepartureInPeriod && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                        {language === 'ar' ? 'مغادرة' : language === 'en' ? 'Departure' : 'Départ'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {missingFields.length === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                        <CheckCircle2 size={12} />
                        <span>
                          {language === 'ar' ? 'مكتملة' : language === 'en' ? 'Complete' : 'Complète'}
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBooking(hit.booking);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[10px] font-bold hover:bg-amber-200 cursor-pointer"
                      >
                        <Edit3 size={11} />
                        <span>
                          {language === 'ar'
                            ? `إكمال (${missingFields.join('، ')})`
                            : language === 'en'
                            ? `Complete (${missingFields.join(', ')})`
                            : `Compléter (${missingFields.join(', ')})`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Full Official Police Sheet */}
                <PoliceSheetDocument
                  {...mapped}
                  language={language}
                  establishmentProfile={establishmentProfile}
                  resourceGroups={resourceGroups}
                  selectedBuildingGroupId={buildingFilter}
                />
              </div>
            ))
          )}
        </div>

        {/* Sticky Footer (hidden on print) */}
        <footer className="print:hidden px-3.5 sm:px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <CheckCircle2 size={15} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>
              {language === 'ar'
                ? `${sheets.length} بطاقة شرطة للطباعة (${report.summary.arrivalsCount} وصول · ${report.summary.departuresCount} مغادرة)`
                : language === 'en'
                ? `${sheets.length} police sheet(s) ready (${report.summary.arrivalsCount} arrival(s) · ${report.summary.departuresCount} departure(s))`
                : `${sheets.length} fiche(s) de police à imprimer (${report.summary.arrivalsCount} arrivée(s) · ${report.summary.departuresCount} départ(s))`}
            </span>
          </div>

          <div className="flex flex-col-reverse min-[360px]:flex-row items-stretch min-[360px]:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
            >
              {language === 'ar' ? 'إغلاق' : language === 'en' ? 'Close' : 'Fermer'}
            </button>
            <button
              type="button"
              disabled={!report.isValidRange || sheets.length === 0}
              onClick={() => window.print()}
              className="min-h-11 px-5 py-2 bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Printer size={15} />
              <span>
                {language === 'ar'
                  ? `طباعة البطاقات (${sheets.length})`
                  : language === 'en'
                  ? `Print Police Sheets (${sheets.length})`
                  : `Imprimer les Fiches (${sheets.length})`}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};
