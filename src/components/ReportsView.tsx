import React from 'react';
import {
  TrendingUp,
  CreditCard,
  Bed,
  Stethoscope,
  Sparkles,
  Users,
  CalendarCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ReportsView: React.FC = () => {
  const { bookings, language } = useApp();

  const totalRevenue = bookings.reduce((acc, b) => acc + (b.totalPrice || 0), 0);
  const totalBookings = bookings.length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'checked_in').length;
  const hotelRevenue = bookings.filter((b) => b.sector === 'hotel').reduce((acc, b) => acc + b.totalPrice, 0);
  const clinicRevenue = bookings.filter((b) => b.sector === 'clinic').reduce((acc, b) => acc + b.totalPrice, 0);
  const otherRevenue = bookings.filter((b) => b.sector === 'wellness' || b.sector === 'other').reduce((acc, b) => acc + b.totalPrice, 0);

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {language === 'fr' ? 'Rapports & Indicateurs d\'Activité' : language === 'ar' ? 'التقارير ومؤشرات الأداء' : 'Reports & Performance Metrics'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {language === 'fr'
            ? 'Vue analytique des revenus, du taux d\'occupation et des réservations par secteur'
            : 'Revenue analytics, occupancy rates, and multi-sector booking distribution'}
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Revenu Global Estimé</span>
            <CreditCard size={18} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {totalRevenue.toLocaleString()} €
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            +18.4% ce mois
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Réservations Totales</span>
            <CalendarCheck size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {totalBookings} dossiers
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {confirmedCount} confirmés & enregistrés
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Taux d'Occupation Hôtel</span>
            <Bed size={18} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            84.2 %
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            Optimal (Chambres 101-303)
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Patients & Praticiens</span>
            <Stethoscope size={18} className="text-teal-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            92.0 %
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Cabinets occupés sur la période
          </span>
        </div>
      </div>

      {/* Sector Revenue Distribution */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <h2 className="font-bold text-slate-900 dark:text-white text-sm">
          Répartition des Recettes par Secteur d'Activité
        </h2>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Bed size={14} /> Hôtellerie & Séjours
              </span>
              <span className="font-mono">{hotelRevenue} €</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${totalRevenue ? (hotelRevenue / totalRevenue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Stethoscope size={14} /> Clinique Médicale & Consultations
              </span>
              <span className="font-mono">{clinicRevenue} €</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${totalRevenue ? (clinicRevenue / totalRevenue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                <Sparkles size={14} /> Espace Bien-être, Spa & Autres RDV
              </span>
              <span className="font-mono">{otherRevenue} €</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${totalRevenue ? (otherRevenue / totalRevenue) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
