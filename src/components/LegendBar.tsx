import React from 'react';
import { useApp } from '../context/AppContext';
import { BookingStatus } from '../types/booking';

export const statusConfig: Record<
  BookingStatus,
  { label: { fr: string; en: string; ar: string }; bg: string; text: string; border: string; pillBg: string }
> = {
  new: {
    label: { fr: 'Nouveau', en: 'New', ar: 'جديد' },
    bg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200',
    text: 'text-amber-900 dark:text-amber-200',
    border: 'border-amber-300 dark:border-amber-700',
    pillBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800',
  },
  confirmed: {
    label: { fr: 'Confirmé', en: 'Confirmed', ar: 'مؤكد' },
    bg: 'pms-booking-bar-confirmed bg-blue-600 text-white',
    text: 'text-white',
    border: 'border-blue-700',
    pillBg: 'pms-booking-bar-confirmed bg-blue-600 text-white shadow-2xs border border-blue-700',
  },
  due_in: {
    label: { fr: 'Arrivée prévue (Due In)', en: 'Due In', ar: 'وصول متوقع' },
    bg: 'bg-teal-400/90 text-slate-900 dark:bg-teal-600 dark:text-white',
    text: 'text-slate-900 dark:text-white',
    border: 'border-teal-500',
    pillBg: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border border-teal-300 dark:border-teal-800',
  },
  checked_in: {
    label: { fr: 'Enregistré (Checked In)', en: 'Checked In', ar: 'تم التسجيل' },
    bg: 'bg-emerald-500 text-white',
    text: 'text-white',
    border: 'border-emerald-600',
    pillBg: 'bg-emerald-600 text-white border border-emerald-700 shadow-2xs',
  },
  due_out: {
    label: { fr: 'Départ prévu (Due Out)', en: 'Due Out', ar: 'مغادرة متوقعة' },
    bg: 'bg-orange-200 text-orange-950 dark:bg-orange-900/80 dark:text-orange-100',
    text: 'text-orange-950 dark:text-orange-100',
    border: 'border-orange-300 dark:border-orange-800',
    pillBg: 'bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-800',
  },
  checked_out: {
    label: { fr: 'Départ effectué (Checked Out)', en: 'Checked Out', ar: 'تمت المغادرة' },
    bg: 'bg-rose-200 text-rose-950 dark:bg-rose-950 dark:text-rose-200',
    text: 'text-rose-950 dark:text-rose-200',
    border: 'border-rose-300 dark:border-rose-800',
    pillBg: 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-800',
  },
  booking_offer: {
    label: { fr: 'Offre / Devis (Booking Offer)', en: 'Booking Offer', ar: 'عرض حجز' },
    bg: 'bg-violet-300 text-violet-950 dark:bg-violet-900 dark:text-violet-100',
    text: 'text-violet-950 dark:text-violet-100',
    border: 'border-violet-400 dark:border-violet-800',
    pillBg: 'bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-200 border border-violet-300 dark:border-violet-800',
  },
  out_of_order: {
    label: { fr: 'Indisponible / Maintenance', en: 'Out of Order', ar: 'خارج الخدمة' },
    bg: 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    text: 'text-slate-800 dark:text-slate-200',
    border: 'border-slate-400 dark:border-slate-600',
    pillBg: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
  },
  cancelled: {
    label: { fr: 'Annulé', en: 'Cancelled', ar: 'ملغى' },
    bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-800',
    pillBg: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
  },
};

import { ChevronUp, ChevronDown, X, Info } from 'lucide-react';

export const LegendBar: React.FC = () => {
  const { language } = useApp();
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);

  return (
    <>
      {/* Mobile Floating Mini-Toggle Button (accessible touch target >= 44x44px) */}
      <div className="sm:hidden fixed bottom-3 right-3 rtl:right-auto rtl:left-3 z-40">
        <button
          type="button"
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-lg border border-slate-200 dark:border-slate-800 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
          aria-expanded={isMobileExpanded}
          aria-label={language === 'fr' ? 'Afficher la légende des statuts' : language === 'ar' ? 'عرض دليل الحالات' : 'Show status legend'}
        >
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-[11px] font-bold">{language === 'fr' ? 'Légende' : language === 'ar' ? 'الدليل' : 'Legend'}</span>
          {isMobileExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
        </button>
      </div>

      {/* Desktop Persistent Legend & Mobile Expanded Drawer */}
      <footer
        className={`${
          isMobileExpanded
            ? 'fixed bottom-0 inset-x-0 z-50 p-3.5 rounded-t-2xl shadow-2xl pms-slide-up flex flex-col gap-2 max-h-56 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800'
            : 'hidden sm:flex h-9'
        } bg-[rgb(var(--pms-surface))] border-t border-[rgb(var(--pms-border))] px-3 items-center gap-2 overflow-x-auto shrink-0 select-none text-[11px] transition-colors`}
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] mr-2 shrink-0">
            <Info size={12} className="text-blue-500" />
            <span>{language === 'fr' ? 'Légende :' : language === 'ar' ? 'دليل الحالات:' : 'Status:'}</span>
          </div>
          {isMobileExpanded && (
            <button
              type="button"
              onClick={() => setIsMobileExpanded(false)}
              className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label={language === 'fr' ? 'Fermer la légende' : language === 'ar' ? 'إغلاق الدليل' : 'Close legend'}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap overflow-x-auto scrollbar-none pb-0.5">
          {(Object.keys(statusConfig) as BookingStatus[]).map((st) => {
            const item = statusConfig[st];
            return (
              <div
                key={st}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 flex items-center gap-1.5 border ${item.pillBg}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90" />
                <span>{item.label[language] || item.label.en}</span>
              </div>
            );
          })}
        </div>
      </footer>
    </>
  );
};
