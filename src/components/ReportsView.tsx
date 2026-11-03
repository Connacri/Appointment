import React from 'react';
import {
  TrendingUp,
  CreditCard,
  Bed,
  Palmtree,
  Sparkles,
  Users,
  CalendarCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ReportsView: React.FC = () => {
  const { bookings, language, resourceGroups, currency } = useApp();

  const activeBookings = bookings.filter((booking) =>
    !['cancelled', 'booking_offer', 'out_of_order', 'checked_out'].includes(booking.status)
  );
  const totalBookingValue = activeBookings.reduce((acc, booking) => acc + (booking.totalPrice || 0), 0);
  const totalBookings = activeBookings.length;
  const confirmedCount = activeBookings.filter((booking) =>
    ['confirmed', 'due_in', 'checked_in', 'due_out'].includes(booking.status)
  ).length;
  const hotelBookingValue = activeBookings.filter((booking) => booking.sector === 'hotel')
    .reduce((acc, booking) => acc + booking.totalPrice, 0);
  const resortBookingValue = activeBookings.filter((booking) => booking.sector === 'resort')
    .reduce((acc, booking) => acc + booking.totalPrice, 0);
  const hotelUnits = resourceGroups.filter((group) => group.sector === 'hotel').reduce((sum, group) => sum + group.resources.length, 0);
  const resortUnits = resourceGroups.filter((group) => group.sector === 'resort').reduce((sum, group) => sum + group.resources.length, 0);

  return (
    <div className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 space-y-3 sm:space-y-4">
      <div>
        <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">
          {language === 'fr' ? 'Rapports & Indicateurs d\'Activité' : language === 'ar' ? 'التقارير ومؤشرات الأداء' : 'Reports & Performance Metrics'}
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {language === 'fr'
            ? 'Vue analytique des revenus, des capacités configurées et des réservations Hôtel & Resort'
            : 'Active booking value and distribution for Hotel & Resort'}
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <div className="min-w-0 p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase">Valeur active</span>
            <CreditCard size={15} className="text-blue-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white truncate">
            {totalBookingValue.toLocaleString()} {currency || 'DA'}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
            Montant contractuel
          </span>
        </div>

        <div className="min-w-0 p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase">Réservations</span>
            <CalendarCheck size={15} className="text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white truncate">
            {totalBookings} dossiers
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
            {confirmedCount} confirmés
          </span>
        </div>

        <div className="min-w-0 p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase">Unités Hôtel</span>
            <Bed size={15} className="text-indigo-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white truncate">
            {hotelUnits}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
            Unités configurées
          </span>
        </div>

        <div className="min-w-0 p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase">Unités Resort</span>
            <Palmtree size={15} className="text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white truncate">
            {resortUnits}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block truncate">
            Unités configurées
          </span>
        </div>
      </div>

      {/* Sector Revenue Distribution */}
      <div className="p-3 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <h2 className="font-bold text-slate-900 dark:text-white text-sm">
          Répartition de la valeur des réservations
        </h2>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Bed size={14} /> Hôtellerie & Séjours
              </span>
              <span className="font-mono">{hotelBookingValue.toLocaleString()} {currency || 'DA'}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${totalBookingValue ? (hotelBookingValue / totalBookingValue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Palmtree size={14} /> Resort, Complexe & Villas
              </span>
              <span className="font-mono">{resortBookingValue.toLocaleString()} {currency || 'DA'}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${totalBookingValue ? (resortBookingValue / totalBookingValue) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
