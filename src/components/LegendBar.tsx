import React from 'react';
import { useApp } from '../context/AppContext';
import { BookingStatus } from '../types/booking';

export const statusConfig: Record<
  BookingStatus,
  { label: { fr: string; en: string; ar: string }; bg: string; text: string; border: string; pillBg: string }
> = {
  new: {
    label: { fr: 'Nouveau', en: 'New', ar: 'جديد' },
    bg: 'bg-amber-100 dark:bg-amber-950/80',
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-300 dark:border-amber-700',
    pillBg: 'bg-[#fef3c7] text-[#92400e]',
  },
  confirmed: {
    label: { fr: 'Confirmé', en: 'Confirmed', ar: 'مؤكد' },
    bg: 'pms-booking-bar-confirmed bg-blue-600 text-white',
    text: 'text-white',
    border: 'border-blue-700',
    pillBg: 'pms-booking-bar-confirmed bg-blue-600 text-white shadow-2xs',
  },
  due_in: {
    label: { fr: 'Arrivée prévue (Due In)', en: 'Due In', ar: 'وصول متوقع' },
    bg: 'bg-teal-400/90 text-slate-900',
    text: 'text-slate-900',
    border: 'border-teal-500',
    pillBg: 'bg-[#5eead4] text-[#134e4a]',
  },
  checked_in: {
    label: { fr: 'Enregistré (Checked In)', en: 'Checked In', ar: 'تم التسجيل' },
    bg: 'bg-emerald-500 text-white',
    text: 'text-white',
    border: 'border-emerald-600',
    pillBg: 'bg-[#10b981] text-white',
  },
  due_out: {
    label: { fr: 'Départ prévu (Due Out)', en: 'Due Out', ar: 'مغادرة متوقعة' },
    bg: 'bg-orange-200 text-orange-950 dark:bg-orange-900/80 dark:text-orange-100',
    text: 'text-orange-950 dark:text-orange-100',
    border: 'border-orange-300',
    pillBg: 'bg-[#fed7aa] text-[#7c2d12]',
  },
  checked_out: {
    label: { fr: 'Départ effectué (Checked Out)', en: 'Checked Out', ar: 'تمت المغادرة' },
    bg: 'bg-rose-200 text-rose-950 dark:bg-rose-950 dark:text-rose-200',
    text: 'text-rose-950 dark:text-rose-200',
    border: 'border-rose-300',
    pillBg: 'bg-[#fecdd3] text-[#881337]',
  },
  booking_offer: {
    label: { fr: 'Offre / Devis (Booking Offer)', en: 'Booking Offer', ar: 'عرض حجز' },
    bg: 'bg-violet-300 text-violet-950 dark:bg-violet-900 dark:text-violet-100',
    text: 'text-violet-950 dark:text-violet-100',
    border: 'border-violet-400',
    pillBg: 'bg-[#ddd6fe] text-[#4c1d95]',
  },
  out_of_order: {
    label: { fr: 'Indisponible / Maintenance', en: 'Out of Order', ar: 'خارج الخدمة' },
    bg: 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    text: 'text-slate-800 dark:text-slate-200',
    border: 'border-slate-400',
    pillBg: 'bg-[#e2e8f0] text-[#334155]',
  },
  cancelled: {
    label: { fr: 'Annulé', en: 'Cancelled', ar: 'ملغى' },
    bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-300',
    pillBg: 'bg-[#ffe4e6] text-[#9f1239]',
  },
};

export const LegendBar: React.FC = () => {
  const { language } = useApp();
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);

  return (
    <>
      {/* Mobile Floating Mini-Toggle Button */}
      <div className="sm:hidden fixed bottom-2 right-2 rtl:right-auto rtl:left-2 z-40">
        <button
          type="button"
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-900/90 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md backdrop-blur border border-white/20 transition cursor-pointer flex items-center gap-1.5"
          aria-expanded={isMobileExpanded}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{language === 'fr' ? 'Légende' : language === 'ar' ? 'الدليل' : 'Legend'}</span>
          <span className="text-[9px] opacity-75">{isMobileExpanded ? '✕' : '▲'}</span>
        </button>
      </div>

      {/* Desktop Persistent Legend & Mobile Expanded Drawer */}
      <footer
        className={`${
          isMobileExpanded
            ? 'fixed bottom-0 inset-x-0 z-50 p-2.5 shadow-2xl pms-slide-up flex flex-wrap max-h-48'
            : 'hidden sm:flex h-8'
        } pms-gantt-surface border-t border-[rgb(var(--pms-border))] px-3 items-center gap-1.5 overflow-x-auto shrink-0 select-none text-[11px] backdrop-blur`}
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mr-2 shrink-0">
            {language === 'fr' ? 'Légende :' : language === 'ar' ? 'دليل الحالات:' : 'Status:'}
          </span>
          {isMobileExpanded && (
            <button
              type="button"
              onClick={() => setIsMobileExpanded(false)}
              className="sm:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Fermer la légende"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap overflow-x-auto">
          {(Object.keys(statusConfig) as BookingStatus[]).map((st) => {
            const item = statusConfig[st];
            return (
              <div
                key={st}
                className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 flex items-center gap-1.5 border border-black/5 dark:border-white/5 ${item.pillBg}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                <span>{item.label[language] || item.label.en}</span>
              </div>
            );
          })}
        </div>
      </footer>
    </>
  );
};
