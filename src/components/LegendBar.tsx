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
    bg: 'bg-sky-500 text-white',
    text: 'text-white',
    border: 'border-sky-600',
    pillBg: 'bg-[#0284c7] text-white',
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

  return (
    <footer className="h-10 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 px-3 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none text-[11px]">
      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mr-2 shrink-0">
        {language === 'fr' ? 'Légende :' : language === 'ar' ? 'دليل الحالات:' : 'Status:'}
      </span>

      {(Object.keys(statusConfig) as BookingStatus[]).map((st) => {
        const item = statusConfig[st];
        return (
          <div
            key={st}
            className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 flex items-center gap-1.5 border border-black/5 dark:border-white/5 ${item.pillBg}`}
          >
            <span className="w-2 h-2 rounded-full bg-current opacity-80" />
            <span>{item.label[language] || item.label.en}</span>
          </div>
        );
      })}
    </footer>
  );
};
