import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Plus,
  Bed,
  Stethoscope,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';
import { getTranslation } from '../i18n/translations';

export const MyBookingsView: React.FC = () => {
  const {
    language,
    bookings,
    setSelectedBooking,
    setIsNewBookingModalOpen,
    updateBookingStatus,
    deleteBooking,
    activeSector,
    setActiveSector,
  } = useApp();

  const [filterTab, setFilterTab] = useState<'all' | 'confirmed' | 'checked_in' | 'pending'>('all');

  const filtered = bookings.filter((b) => {
    if (activeSector !== 'all' && b.sector !== activeSector) return false;
    if (filterTab === 'all') return true;
    if (filterTab === 'confirmed') return b.status === 'confirmed';
    if (filterTab === 'checked_in') return b.status === 'checked_in';
    if (filterTab === 'pending') return b.status === 'new' || b.status === 'booking_offer' || b.status === 'due_in';
    return true;
  });

  const getSectorBadge = (sector: string) => {
    switch (sector) {
      case 'hotel':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded">
            <Bed size={12} />
            <span>Hôtel</span>
          </span>
        );
      case 'clinic':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded">
            <Stethoscope size={12} />
            <span>Clinique</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 rounded">
            <Sparkles size={12} />
            <span>Spa/RDV</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {getTranslation('myBookingsTitle', language)}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? 'Gestion des séjours hôteliers, rendez-vous médicaux et prestations'
              : language === 'ar'
              ? 'إدارة حجوزات الفنادق، المواعيد الطبية والخدمات'
              : 'Manage hotel stays, clinic visits, and wellness appointments'}
          </p>
        </div>

        <button
          onClick={() => setIsNewBookingModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>
            {language === 'fr' ? 'Nouveau Rendez-vous' : language === 'ar' ? 'حجز جديد' : 'New Booking'}
          </span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Tous ({bookings.length})
        </button>
        <button
          onClick={() => setFilterTab('confirmed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterTab === 'confirmed'
              ? 'bg-sky-500 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Confirmés
        </button>
        <button
          onClick={() => setFilterTab('checked_in')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterTab === 'checked_in'
              ? 'bg-emerald-500 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Enregistrés (Checked In)
        </button>
        <button
          onClick={() => setFilterTab('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterTab === 'pending'
              ? 'bg-amber-500 text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          En attente / Offres
        </button>
      </div>

      {/* Bookings List / Cards */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
            {getTranslation('noBookingsFound', language)}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {language === 'fr'
              ? 'Aucune réservation ne correspond à vos critères de recherche pour le moment.'
              : 'No bookings matching your criteria at this moment.'}
          </p>
          <button
            onClick={() => setIsNewBookingModalOpen(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {getTranslation('startBookingNow', language)}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((bkg) => {
            const st = statusConfig[bkg.status] || statusConfig.confirmed;
            return (
              <div
                key={bkg.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {getSectorBadge(bkg.sector)}
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.pillBg}`}>
                      {st.label[language] || bkg.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 truncate">
                    {bkg.resourceName}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium mb-3">
                    <User size={14} className="text-slate-400" />
                    <span>{bkg.guestName}</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span>Dates :</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                        {bkg.startDate} → {bkg.endDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Contact :</span>
                      <span className="truncate max-w-[160px]">{bkg.guestEmail}</span>
                    </div>

                    {bkg.notes && (
                      <div className="text-[11px] italic text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded mt-2">
                        « {bkg.notes} »
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                      {bkg.totalPrice} €
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadICS(bkg)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      title="Télécharger .ICS"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={() => setSelectedBooking(bkg)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Modifier / Détails
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
