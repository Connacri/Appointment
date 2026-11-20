/**
 * BookingFinderModal — global, searchable reservation list.
 *
 * Opens from the top bar. Every guest and room detail is searchable with a
 * token-based, diacritic-insensitive "elastic" query; status, payment, period
 * and sector filters narrow the results. Selecting a row opens the existing
 * BookingModal, so no booking editing logic is duplicated here.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CloudOff, Mail, Phone, RotateCcw, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { domainConfigs } from '../data/mockData';
import { statusConfig } from './LegendBar';
import {
  BookingStatus,
  DomainType,
} from '../types/booking';
import {
  DEFAULT_BOOKING_FINDER_FILTERS,
  findBookings,
  type BookingFinderFilters,
  type BookingFinderPayment,
  type BookingFinderPeriod,
  type BookingFinderStatus,
} from '../utils/bookingFinder';

interface BookingFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BookingFinderModal: React.FC<BookingFinderModalProps> = ({ isOpen, onClose }) => {
  const {
    language,
    bookings,
    resourceGroups,
    setSelectedBooking,
    currency,
    isOffline,
  } = useApp();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<BookingFinderFilters>(DEFAULT_BOOKING_FINDER_FILTERS);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setFilters(DEFAULT_BOOKING_FINDER_FILTERS);
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  const hits = useMemo(
    () => findBookings({ bookings, resourceGroups, query, filters, todayIso }),
    [bookings, resourceGroups, query, filters, todayIso],
  );

  if (!isOpen || typeof document === 'undefined') return null;

  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, language);
  const statusOptions = Object.keys(statusConfig) as BookingStatus[];
  const sectorOptions = Object.keys(domainConfigs) as DomainType[];
  const hasActiveFilters =
    query.trim().length > 0 ||
    filters.status !== 'all' ||
    filters.payment !== 'all' ||
    filters.period !== 'all' ||
    filters.sector !== 'all';

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-stretch justify-center bg-black/60 backdrop-blur-xs pms-modal-backdrop sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-finder-title"
        className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 pms-modal sm:h-[min(90dvh,52rem)] sm:rounded-2xl sm:border"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="booking-finder-title" className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('bookingFinderTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('bookingFinderSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <label htmlFor="booking-finder-search" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {t('bookingFinderSearchLabel')}
            </label>
            <div className="relative mt-1">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="booking-finder-search"
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('bookingFinderSearchPlaceholder')}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white ps-9 pe-10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label={t('bookingFinderClearSearch')}
                  className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="min-w-0">
              <label htmlFor="booking-finder-status" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {t('bookingFinderStatus')}
              </label>
              <select
                id="booking-finder-status"
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as BookingFinderStatus }))}
                className="mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">{t('bookingFinderAll')}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusConfig[status].label[language]}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="booking-finder-payment" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {t('bookingFinderPayment')}
              </label>
              <select
                id="booking-finder-payment"
                value={filters.payment}
                onChange={(event) => setFilters((prev) => ({ ...prev, payment: event.target.value as BookingFinderPayment }))}
                className="mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">{t('bookingFinderAll')}</option>
                <option value="paid">{t('bookingFinderPaid')}</option>
                <option value="pending">{t('bookingFinderPending')}</option>
                <option value="partial">{t('bookingFinderPartial')}</option>
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="booking-finder-period" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {t('bookingFinderPeriod')}
              </label>
              <select
                id="booking-finder-period"
                value={filters.period}
                onChange={(event) => setFilters((prev) => ({ ...prev, period: event.target.value as BookingFinderPeriod }))}
                className="mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">{t('bookingFinderAll')}</option>
                <option value="current">{t('bookingFinderCurrent')}</option>
                <option value="upcoming">{t('bookingFinderUpcoming')}</option>
                <option value="past">{t('bookingFinderPast')}</option>
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="booking-finder-sector" className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {t('bookingFinderSector')}
              </label>
              <select
                id="booking-finder-sector"
                value={filters.sector}
                onChange={(event) => setFilters((prev) => ({ ...prev, sector: event.target.value as DomainType | 'all' }))}
                className="mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">{t('bookingFinderAll')}</option>
                {sectorOptions.map((sector) => (
                  <option key={sector} value={sector}>
                    {domainConfigs[sector]?.label[language] ?? sector}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200" aria-live="polite">
            {t('bookingFinderResults').replace('{count}', String(hits.length))}
          </p>
          <div className="flex items-center gap-2">
            {isOffline && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <CloudOff size={11} />
                {t('bookingFinderOffline')}
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilters(DEFAULT_BOOKING_FINDER_FILTERS);
                  searchInputRef.current?.focus();
                }}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40 cursor-pointer"
              >
                <RotateCcw size={12} />
                {t('bookingFinderReset')}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {hits.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
              <CalendarDays size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
                {bookings.length === 0 ? t('bookingFinderEmptyAll') : t('bookingFinderEmptyFiltered')}
              </p>
              {hasActiveFilters && bookings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_BOOKING_FINDER_FILTERS)}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('bookingFinderReset')}
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {hits.map((hit) => {
                const { booking, resource, groupLabel } = hit;
                const status = statusConfig[booking.status];
                const roomDetail = [booking.resourceName, resource?.type, groupLabel]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={booking.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBooking(booking);
                        onClose();
                      }}
                      aria-label={`${t('bookingFinderOpenBooking')} — ${booking.guestName}`}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-start transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold text-slate-900 dark:text-white">
                            {booking.guestName || '—'}
                          </p>
                          <p className="break-words text-xs text-slate-500 dark:text-slate-400">
                            {roomDetail || booking.resourceId}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${status.pillBg}`}>
                          {status.label[language]}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="tabular-nums">
                          {booking.startDate} → {booking.endDate}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1 break-all">
                          <Phone size={11} className="shrink-0" />
                          {booking.guestPhone || '—'}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1 break-all">
                          <Mail size={11} className="shrink-0" />
                          {booking.guestEmail || '—'}
                        </span>
                        <span className="tabular-nums">
                          {t('bookingFinderTotal')} {booking.totalPrice} {currency}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
