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
  Building2,
  UtensilsCrossed,
  Stethoscope,
  HeartPulse,
  Landmark,
  Sparkles,
  QrCode,
  Camera,
  Banknote,
  ShieldCheck,
  Award,
  CreditCard,
  Edit3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';
import { getTranslation } from '../i18n/translations';
import { DomainType } from '../types/booking';

export const MyBookingsView: React.FC = () => {
  const {
    language,
    bookings,
    setSelectedBooking,
    setIsNewBookingModalOpen,
    activeSector,
    setActiveSector,
    currentRole,
    clientProfile,
    setClientProfile,
    setActiveQrPassBooking,
    setIsQrScannerOpen,
    currentDomain,
  } = useApp();

  const isClientRole = currentRole === 'client';
  const [filterTab, setFilterTab] = useState<'all' | 'confirmed' | 'checked_in' | 'cash_pending'>('all');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(clientProfile.name);
  const [editEmail, setEditEmail] = useState(clientProfile.email);
  const [editPhone, setEditPhone] = useState(clientProfile.phone);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setClientProfile({
      ...clientProfile,
      name: editName,
      email: editEmail,
      phone: editPhone,
    });
    setIsEditingProfile(false);
  };

  const filtered = bookings.filter((b) => {
    if (activeSector !== 'all' && b.sector !== activeSector) return false;
    if (filterTab === 'all') return true;
    if (filterTab === 'confirmed') return b.status === 'confirmed';
    if (filterTab === 'checked_in') return b.status === 'checked_in';
    if (filterTab === 'cash_pending') return b.paymentStatus === 'pending' && b.totalPrice > 0;
    return true;
  });

  const getSectorBadge = (sector: string) => {
    switch (sector) {
      case 'doctor':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800">
            <Stethoscope size={12} />
            <span>Médecin</span>
          </span>
        );
      case 'clinic':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800">
            <HeartPulse size={12} />
            <span>Clinique</span>
          </span>
        );
      case 'hotel':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
            <Bed size={12} />
            <span>Hôtel</span>
          </span>
        );
      case 'residence':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
            <Building2 size={12} />
            <span>Résidence</span>
          </span>
        );
      case 'restaurant':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800">
            <UtensilsCrossed size={12} />
            <span>Restaurant</span>
          </span>
        );
      case 'administration':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <Landmark size={12} />
            <span>Administration</span>
          </span>
        );
      case 'wellness':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
            <Sparkles size={12} />
            <span>Bien-être / Spa</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-lg">
            <span>{sector}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      {/* 1. CLIENT ACCOUNT DASHBOARD CARD (When in client role) */}
      {isClientRole && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-emerald-600 rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 flex items-center justify-center pointer-events-none">
            <QrCode size={180} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-white">
                <Award size={14} />
                <span>Espace Compte Client & Pass Numérique VIP</span>
              </div>

              <h2 className="text-2xl font-black tracking-tight">{clientProfile.name}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-blue-100 font-medium">
                <span className="font-mono bg-black/20 px-2 py-0.5 rounded-md">
                  N° Membre : {clientProfile.memberNumber}
                </span>
                <span>•</span>
                <span>{clientProfile.email}</span>
                <span>•</span>
                <span>{clientProfile.phone}</span>
                <span>•</span>
                <span className="bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-md font-bold">
                  {clientProfile.loyaltyPoints} points fidélité
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditName(clientProfile.name);
                  setEditEmail(clientProfile.email);
                  setEditPhone(clientProfile.phone);
                  setIsEditingProfile(!isEditingProfile);
                }}
                className="px-3.5 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Edit3 size={14} />
                <span>Modifier mon profil</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNewBookingModalOpen(true)}
                className="px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 hover:scale-102"
              >
                <Plus size={16} strokeWidth={3} />
                <span>Réserver en ligne maintenant</span>
              </button>
            </div>
          </div>

          {/* Quick inline profile editor */}
          {isEditingProfile && (
            <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nom complet"
                className="h-8 px-3 rounded-lg bg-white/20 text-white placeholder-white/60 text-xs border border-white/30 focus:outline-none"
              />
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email"
                className="h-8 px-3 rounded-lg bg-white/20 text-white placeholder-white/60 text-xs border border-white/30 focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Téléphone"
                  className="h-8 px-3 rounded-lg bg-white/20 text-white placeholder-white/60 text-xs border border-white/30 flex-1 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 h-8 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-lg text-xs"
                >
                  OK
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 2. HEADER & ACTION STRIP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>
              {isClientRole
                ? 'Mes Réservations & Pass QR Code d\'Arrivée'
                : getTranslation('myBookingsTitle', language)}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isClientRole
              ? 'Consultez vos réservations, téléchargez votre QR Code et présentez-le à votre arrivée'
              : 'Gestion centralisée des arrivées, scans QR code et encaissements'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isClientRole && (
            <button
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Camera size={15} />
              <span>Scanner un QR Pass d'Arrivée</span>
            </button>
          )}

          <button
            onClick={() => setIsNewBookingModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus size={16} />
            <span>
              {isClientRole ? 'Nouvelle Réservation en Ligne' : 'Ajouter une Réservation'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. FILTER TABS */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto text-xs">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Tous les dossiers ({bookings.length})
        </button>
        <button
          onClick={() => setFilterTab('confirmed')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            filterTab === 'confirmed'
              ? 'bg-sky-600 text-white font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Confirmés (En attente d'arrivée)
        </button>
        <button
          onClick={() => setFilterTab('checked_in')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            filterTab === 'checked_in'
              ? 'bg-emerald-600 text-white font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Présence Validée (Checked-in)
        </button>
        <button
          onClick={() => setFilterTab('cash_pending')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            filterTab === 'cash_pending'
              ? 'bg-amber-600 text-white font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          À régler en Espèces au comptoir
        </button>
      </div>

      {/* 4. BOOKINGS CARDS GRID */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
          <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
            Aucun dossier trouvé dans cette vue
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {isClientRole
              ? 'Vous n\'avez pas encore de réservation active. Effectuez votre réservation en ligne en un clic !'
              : 'Aucune réservation ne correspond à ce filtre.'}
          </p>
          <button
            onClick={() => setIsNewBookingModalOpen(true)}
            className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Réserver maintenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((bkg) => {
            const st = statusConfig[bkg.status] || statusConfig.confirmed;
            const isCashPending = bkg.paymentStatus === 'pending' && bkg.totalPrice > 0;
            const isCheckedIn = bkg.status === 'checked_in';

            return (
              <div
                key={bkg.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Sector Badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {getSectorBadge(bkg.sector)}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isCheckedIn
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : st.pillBg
                      }`}
                    >
                      {isCheckedIn ? '✓ Présent (Enregistré)' : st.label[language] || bkg.status}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1 truncate">
                    {bkg.resourceName}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold mb-3">
                    <User size={14} className="text-slate-400" />
                    <span>{bkg.guestName}</span>
                  </div>

                  {/* Dates & Details */}
                  <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Dates :</span>
                      <span className="font-mono text-slate-900 dark:text-white font-bold">
                        {bkg.startDate} {bkg.startDate !== bkg.endDate ? `→ ${bkg.endDate}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">Paiement :</span>
                      {bkg.totalPrice === 0 ? (
                        <span className="text-emerald-600 font-bold">Gratuit</span>
                      ) : isCashPending ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <Banknote size={13} />
                          <span>Espèces à l'arrivée ({bkg.totalPrice} €)</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <ShieldCheck size={13} />
                          <span>Payé en ligne ({bkg.totalPrice} €)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Button: Open QR Pass Modal */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => setActiveQrPassBooking(bkg)}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2 group"
                  >
                    <QrCode size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Présenter mon Pass QR Code d'Arrivée</span>
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => downloadICS(bkg)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors font-medium text-[11px]"
                      title="Ajouter au calendrier .ICS"
                    >
                      <Download size={13} />
                      <span>Calendrier .ICS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBooking(bkg)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold text-[11px]"
                    >
                      Détails / Modifier
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
