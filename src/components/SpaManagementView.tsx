/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Spa, Thalasso & Wellness Centre View
 * Comprehensive Hotel & Resort Spa Management suite:
 * - Daily appointment schedule with quick check-in, treatment progress & room folio billing
 * - Facility & treatment room management (Cabins, Hammam, Sauna, Jacuzzi with temperature & status)
 * - Treatment catalog with categories, durations, benefits & instant booking
 * - Therapist team roster with cabin assignments and workload tracking
 * - Real in-house guest linking with room folio charges & cash/card checkout
 */

import React, { useState, useMemo } from 'react';
import {
  Flower2,
  Calendar,
  Clock,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  Receipt,
  Bed,
  Check,
  X,
  Thermometer,
  Waves,
  HeartPulse,
  Flame,
  Printer,
  ChevronRight,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  SpaTreatment,
  SpaFacility,
  SpaTherapist,
  SpaAppointment,
  SpaCategory,
  SpaAppointmentStatus,
  SpaPaymentMethod,
} from '../types/spa';
import {
  initialSpaTreatments,
  initialSpaFacilities,
  initialSpaTherapists,
  initialSpaAppointments,
} from '../data/spaData';
import { playSuccessFeedback, playClickFeedback, playErrorFeedback } from '../utils/audioFeedback';

export const SpaManagementView: React.FC = () => {
  const { language, currency, bookings } = useApp();

  const [activeTab, setActiveTab] = useState<'appointments' | 'facilities' | 'treatments' | 'therapists'>('appointments');
  const [appointments, setAppointments] = useState<SpaAppointment[]>(initialSpaAppointments);
  const [facilities, setFacilities] = useState<SpaFacility[]>(initialSpaFacilities);
  const [therapists, setTherapists] = useState<SpaTherapist[]>(initialSpaTherapists);
  const [treatments] = useState<SpaTreatment[]>(initialSpaTreatments);

  // Filters
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'in_progress' | 'confirmed' | 'completed'>('all');
  const [treatmentCategoryFilter, setTreatmentCategoryFilter] = useState<SpaCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedTreatmentForBooking, setSelectedTreatmentForBooking] = useState<SpaTreatment | null>(null);
  const [receiptModalAppointment, setReceiptModalAppointment] = useState<SpaAppointment | null>(null);

  // Form State for New Appointment
  const [formGuestType, setFormGuestType] = useState<'hotel_guest' | 'external'>('hotel_guest');
  const [formSelectedBookingId, setFormSelectedBookingId] = useState<string>(bookings[0]?.id || '');
  const [formExternalName, setFormExternalName] = useState('');
  const [formExternalPhone, setFormExternalPhone] = useState('');
  const [formTreatmentId, setFormTreatmentId] = useState<string>(initialSpaTreatments[0].id);
  const [formFacilityId, setFormFacilityId] = useState<string>(initialSpaFacilities[0].id);
  const [formTherapistId, setFormTherapistId] = useState<string>(initialSpaTherapists[0].id);
  const [formDate, setFormDate] = useState('2026-10-26');
  const [formTime, setFormTime] = useState('15:00');
  const [formPaymentMethod, setFormPaymentMethod] = useState<SpaPaymentMethod>('room_charge');
  const [formNotes, setFormNotes] = useState('');

  // Daily Stats KPIs
  const dailyTotalRevenue = useMemo(() => {
    return appointments
      .filter((a) => a.status !== 'cancelled')
      .reduce((sum, a) => sum + a.price, 0);
  }, [appointments]);

  const activeTreatmentsCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'in_progress').length;
  }, [appointments]);

  const occupiedCabinsCount = useMemo(() => {
    return facilities.filter((f) => f.status === 'in_treatment').length;
  }, [facilities]);

  // Handle appointment status transitions
  const handleUpdateAppointmentStatus = (id: string, newStatus: SpaAppointmentStatus) => {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const updated = { ...a, status: newStatus };
        if (newStatus === 'completed') {
          updated.paymentSettled = true;
        }
        return updated;
      })
    );

    // Update facility status if linked
    const targetApt = appointments.find((a) => a.id === id);
    if (targetApt) {
      setFacilities((prev) =>
        prev.map((f) => {
          if (f.id !== targetApt.facilityId) return f;
          if (newStatus === 'in_progress') {
            return {
              ...f,
              status: 'in_treatment',
              currentGuest: targetApt.guestName,
              currentTreatment: targetApt.treatmentName,
            };
          } else if (newStatus === 'completed') {
            return {
              ...f,
              status: 'sanitizing',
              currentGuest: undefined,
              currentTreatment: undefined,
            };
          }
          return f;
        })
      );
    }

    playSuccessFeedback();
  };

  // Toggle Facility Status (e.g. mark clean or toggle maintenance)
  const handleFacilityCleaned = (facilityId: string) => {
    setFacilities((prev) =>
      prev.map((f) => (f.id === facilityId ? { ...f, status: 'available', currentGuest: undefined, currentTreatment: undefined } : f))
    );
    playSuccessFeedback();
  };

  // Toggle Therapist Availability
  const handleToggleTherapist = (therapistId: string) => {
    setTherapists((prev) =>
      prev.map((t) => (t.id === therapistId ? { ...t, isAvailable: !t.isAvailable } : t))
    );
    playClickFeedback();
  };

  // Create New Spa Booking
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedTreatment = treatments.find((t) => t.id === formTreatmentId) || treatments[0];
    const selectedFacility = facilities.find((f) => f.id === formFacilityId) || facilities[0];
    const selectedTherapist = therapists.find((t) => t.id === formTherapistId) || therapists[0];

    let guestName = formExternalName.trim();
    let guestRoom = 'Client Externe';
    let guestPhone = formExternalPhone.trim();

    if (formGuestType === 'hotel_guest') {
      const bkg = bookings.find((b) => b.id === formSelectedBookingId);
      if (bkg) {
        guestName = bkg.guestName;
        guestRoom = bkg.resourceName;
        guestPhone = bkg.guestPhone || '';
      }
    }

    if (!guestName) {
      playErrorFeedback();
      return;
    }

    // Calculate End Time based on duration
    const [startH, startM] = formTime.split(':').map(Number);
    const totalMinutes = startH * 60 + startM + selectedTreatment.durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const newApt: SpaAppointment = {
      id: `spa_apt_${Date.now()}`,
      guestName,
      guestRoom,
      guestPhone,
      treatmentId: selectedTreatment.id,
      treatmentName: `${selectedTreatment.name[language] || selectedTreatment.name.fr} (${selectedTreatment.durationMinutes} min)`,
      facilityId: selectedFacility.id,
      facilityName: selectedFacility.name[language] || selectedFacility.name.fr,
      therapistId: selectedTherapist.id,
      therapistName: selectedTherapist.name,
      date: formDate,
      startTime: formTime,
      endTime,
      durationMinutes: selectedTreatment.durationMinutes,
      price: selectedTreatment.price,
      status: 'confirmed',
      paymentMethod: formPaymentMethod,
      paymentSettled: formPaymentMethod === 'room_charge',
      notes: formNotes.trim() || undefined,
    };

    setAppointments((prev) => [newApt, ...prev]);

    // Update therapist count
    setTherapists((prev) =>
      prev.map((t) =>
        t.id === selectedTherapist.id
          ? { ...t, todayAppointmentsCount: t.todayAppointmentsCount + 1 }
          : t
      )
    );

    setIsNewBookingModalOpen(false);
    playSuccessFeedback();
  };

  // Open direct booking from catalog
  const handleOpenBookingForTreatment = (treatment: SpaTreatment) => {
    setSelectedTreatmentForBooking(treatment);
    setFormTreatmentId(treatment.id);
    setIsNewBookingModalOpen(true);
  };

  // Filtered Appointments
  const filteredAppointments = appointments.filter((a) => {
    if (appointmentFilter !== 'all' && a.status !== appointmentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.guestName.toLowerCase().includes(q) ||
        (a.guestRoom && a.guestRoom.toLowerCase().includes(q)) ||
        a.treatmentName.toLowerCase().includes(q) ||
        a.therapistName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered Treatments
  const filteredTreatments = treatments.filter((t) => {
    if (treatmentCategoryFilter !== 'all' && t.category !== treatmentCategoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (t.name[language] || t.name.fr).toLowerCase();
      const desc = (t.description[language] || t.description.fr).toLowerCase();
      return name.includes(q) || desc.includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 min-w-0 w-full max-w-full p-2.5 sm:p-4 md:p-6 overflow-y-auto overscroll-contain space-y-3 sm:space-y-4 md:space-y-6">
      {/* 1. TOP HEADER & KPI METRICS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flower2 className="text-rose-500 shrink-0" size={22} />
              <span>
                {language === 'fr'
                  ? 'Spa, Thalasso & Centre Bien-Être'
                  : language === 'ar'
                  ? 'السبا والمركز الصحي والعلاجي'
                  : 'Spa & Wellness Centre'}
              </span>
            </h1>
            <span className="text-[10px] font-bold font-mono text-rose-600 dark:text-rose-400 uppercase shrink-0">
              · Hydrothérapie & Rituels VIP
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? 'Gestion des soins, cabines de massages, hammam traditionnel et facturation sur chambre'
              : 'Appointments, wellness cabins, hammam rituals and direct room folio billing'}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedTreatmentForBooking(null);
              setIsNewBookingModalOpen(true);
            }}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus size={15} />
            <span>{language === 'fr' ? 'Nouveau Soin Spa' : language === 'ar' ? 'حجز موعد سبا' : 'New Spa Booking'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Imprimer le planning du jour"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Planning</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3">
        {/* Revenue */}
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase">{language === 'fr' ? 'CA Spa du Jour' : 'Daily Spa Revenue'}</span>
            <DollarSign size={14} className="text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {dailyTotalRevenue.toLocaleString()} {currency}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5 truncate">
            {appointments.length} soins réservés
          </span>
        </div>

        {/* In Treatment */}
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase">{language === 'fr' ? 'Soins en Cours' : 'In Treatment'}</span>
            <Sparkles size={14} className="text-rose-500 animate-pulse" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {activeTreatmentsCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5 truncate">
            Cabines actuellement actives
          </span>
        </div>

        {/* Cabins Occupancy */}
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase">{language === 'fr' ? 'Cabines Occupées' : 'Cabins Occupancy'}</span>
            <Waves size={14} className="text-blue-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {occupiedCabinsCount} / {facilities.length}
          </div>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block mt-0.5 truncate">
            Hammam & Sauna opérationnels
          </span>
        </div>

        {/* Available Therapists */}
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase">{language === 'fr' ? 'Équipe Praticiens' : 'Therapists On Duty'}</span>
            <HeartPulse size={14} className="text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
            {therapists.filter((t) => t.isAvailable).length} / {therapists.length}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
            Praticiennes disponibles
          </span>
        </div>
      </div>

      {/* 3. MAIN NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto text-xs font-semibold no-scrollbar">
        {[
          { id: 'appointments', label: '1. Agenda & Rendez-vous', short: 'Agenda', icon: Calendar, count: appointments.length },
          { id: 'facilities', label: '2. Cabines & Espaces Détente', short: 'Cabines', icon: Waves, count: facilities.length },
          { id: 'treatments', label: '3. Catalogue des Soins & Rituels', short: 'Catalogue', icon: Flower2, count: treatments.length },
          { id: 'therapists', label: '4. Thérapeutes & Praticiens', short: 'Équipe', icon: User, count: therapists.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 sm:py-2.5 px-2.5 sm:px-3.5 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'border-rose-600 text-rose-600 dark:text-rose-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="text-[10px] font-mono opacity-70">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENT 1: AGENDA & RENDEZ-VOUS */}
      {activeTab === 'appointments' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Status filters */}
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg text-xs font-medium overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'in_progress', label: 'En cours' },
                { id: 'confirmed', label: 'Confirmés' },
                { id: 'completed', label: 'Terminés' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAppointmentFilter(f.id as any)}
                  className={`h-7 px-2.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                    appointmentFilter === f.id
                      ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[260px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher client, chambre, soin..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Appointments List */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
            {filteredAppointments.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                Aucun rendez-vous ne correspond à ce filtre.
              </div>
            ) : (
              filteredAppointments.map((apt) => {
                const isCurrent = apt.status === 'in_progress';
                const isDone = apt.status === 'completed';

                return (
                  <div
                    key={apt.id}
                    className={`bg-white dark:bg-slate-900 border rounded-xl p-3 sm:p-4 shadow-xs flex flex-col justify-between space-y-3 transition ${
                      isCurrent
                        ? 'border-rose-400 dark:border-rose-600/80 ring-1 ring-rose-400/40'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Top status & timing */}
                      <div className="flex items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                          <Clock size={13} className="text-rose-500" />
                          <span>{apt.startTime} - {apt.endTime}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({apt.durationMinutes} min)</span>
                        </div>

                        {/* Status dot */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isCurrent
                                ? 'bg-rose-500 animate-pulse'
                                : isDone
                                ? 'bg-emerald-500'
                                : 'bg-blue-500'
                            }`}
                          />
                          <span className={isCurrent ? 'text-rose-600' : isDone ? 'text-emerald-600' : 'text-blue-600'}>
                            {isCurrent ? 'En cours' : isDone ? 'Terminé' : 'Confirmé'}
                          </span>
                        </div>
                      </div>

                      {/* Guest and room */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {apt.guestName}
                        </h3>
                        <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {apt.guestRoom}
                        </span>
                      </div>

                      {/* Treatment Title */}
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 leading-snug">
                        {apt.treatmentName}
                      </p>

                      {/* Details row: Facility & Therapist */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Cabine / Espace :</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{apt.facilityName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Praticien(ne) :</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{apt.therapistName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Règlement :</span>
                          <span className="font-medium text-slate-900 dark:text-white font-mono">
                            {apt.price} {currency} · {apt.paymentMethod === 'room_charge' ? 'Note de chambre' : apt.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
                          </span>
                        </div>
                      </div>

                      {apt.notes && (
                        <p className="mt-2 text-[10px] text-slate-400 italic bg-slate-50 dark:bg-slate-850 p-1.5 rounded">
                          "{apt.notes}"
                        </p>
                      )}
                    </div>

                    {/* Actions Strip */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReceiptModalAppointment(apt)}
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Receipt size={12} />
                        <span>Fiche Soin</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {!isDone && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAppointmentStatus(apt.id, 'in_progress')}
                            className="h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Démarrer
                          </button>
                        )}

                        {isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAppointmentStatus(apt.id, 'completed')}
                            className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Terminer Soin
                          </button>
                        )}

                        {isDone && (
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            <span>Réglé</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT 2: CABINES & ESPACES */}
      {activeTab === 'facilities' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {facilities.map((fac) => {
            const isBusy = fac.status === 'in_treatment';
            const isSanitizing = fac.status === 'sanitizing';
            const isReserved = fac.status === 'reserved';

            return (
              <div
                key={fac.id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3 ${
                  isBusy
                    ? 'border-rose-400 dark:border-rose-800'
                    : isSanitizing
                    ? 'border-amber-400 dark:border-amber-800'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Capacité : {fac.capacity} pers.
                    </span>

                    {/* Status dot */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isBusy
                            ? 'bg-rose-500 animate-pulse'
                            : isSanitizing
                            ? 'bg-amber-500 animate-bounce'
                            : isReserved
                            ? 'bg-purple-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span
                        className={
                          isBusy
                            ? 'text-rose-600'
                            : isSanitizing
                            ? 'text-amber-600'
                            : isReserved
                            ? 'text-purple-600'
                            : 'text-emerald-600'
                        }
                      >
                        {isBusy ? 'En soin' : isSanitizing ? 'Désinfection' : isReserved ? 'Réservé' : 'Disponible'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-1">
                    {fac.name[language] || fac.name.fr}
                  </h3>

                  {fac.temperature && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-2">
                      <Thermometer size={13} className="text-amber-500" />
                      <span>Température : {fac.temperature}</span>
                    </div>
                  )}

                  {fac.currentGuest ? (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 text-xs space-y-0.5">
                      <p className="font-bold text-rose-900 dark:text-rose-200">{fac.currentGuest}</p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">{fac.currentTreatment}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Cabine prête pour le prochain rendez-vous.
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Désinfection UV & Linges bio</span>
                  {isSanitizing ? (
                    <button
                      type="button"
                      onClick={() => handleFacilityCleaned(fac.id)}
                      className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Valider Désinfection (Prêt)
                    </button>
                  ) : isBusy ? (
                    <button
                      type="button"
                      onClick={() => handleFacilityCleaned(fac.id)}
                      className="h-7 px-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-[11px] font-semibold cursor-pointer"
                    >
                      Libérer Cabine
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTreatmentForBooking(null);
                        setFormFacilityId(fac.id);
                        setIsNewBookingModalOpen(true);
                      }}
                      className="h-7 px-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Affecter Soin
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. TAB CONTENT 3: CATALOGUE DES SOINS */}
      {activeTab === 'treatments' && (
        <div className="space-y-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
            {[
              { id: 'all', label: 'Tous les rituels' },
              { id: 'massage', label: 'Massages & Corps' },
              { id: 'hammam_hydro', label: 'Hammam & Balnéo' },
              { id: 'facial_beauty', label: 'Visage & Beauté' },
              { id: 'package', label: 'Forfaits & Cures Duo' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setTreatmentCategoryFilter(c.id as any)}
                className={`h-7 px-2.5 rounded-md transition-colors cursor-pointer shrink-0 font-medium ${
                  treatmentCategoryFilter === c.id
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Treatments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTreatments.map((trt) => (
              <div
                key={trt.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {trt.name[language] || trt.name.fr}
                    </h3>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-base font-mono text-slate-900 dark:text-white">
                        {trt.price} {currency}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {trt.durationMinutes} minutes
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                    {trt.description[language] || trt.description.fr}
                  </p>

                  <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p>
                      <strong className="text-slate-700 dark:text-slate-200">Bienfaits : </strong>
                      {trt.benefits[language] || trt.benefits.fr}
                    </p>
                    <p>
                      <strong className="text-slate-700 dark:text-slate-200">Idéal pour : </strong>
                      {trt.recommendedFor[language] || trt.recommendedFor.fr}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {trt.isSignature ? (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <Sparkles size={12} />
                      Rituel Signature Resort
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Produits certifiés bio</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenBookingForTreatment(trt)}
                    className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Réserver ce soin</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT 4: THÉRAPEUTES & ÉQUIPE */}
      {activeTab === 'therapists' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {therapists.map((th) => (
            <div
              key={th.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-bold flex items-center justify-center text-sm">
                    {th.name.split(' ').map((n) => n[0]).join('')}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        th.isAvailable ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    <span className={th.isAvailable ? 'text-emerald-600' : 'text-slate-400'}>
                      {th.isAvailable ? 'En service' : 'Pause / Absent'}
                    </span>
                  </div>
                </div>

                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{th.name}</h3>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mb-2">
                  {th.role[language] || th.role.fr}
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-200">Spécialités : </strong>
                  {th.specialties[language] || th.specialties.fr}
                </p>

                {th.assignedCabin && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Cabine assignée : <span className="font-semibold text-slate-800 dark:text-slate-200">{th.assignedCabin}</span>
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 font-semibold">
                  {th.todayAppointmentsCount} soins aujourd'hui
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleTherapist(th.id)}
                  className="h-7 px-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {th.isAvailable ? 'Passer en pause' : 'Prendre service'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8. MODAL NOUVEAU RENDEZ-VOUS SPA */}
      {isNewBookingModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto pms-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewBookingModalOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" className="pms-dialog-panel max-w-lg w-full flex flex-col max-h-[92dvh] my-auto pms-modal">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-600/10 text-rose-600 dark:text-rose-400">
                  <Flower2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    Nouveau Rendez-vous Spa & Soin
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Planification et imputation sur la note de chambre du client
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewBookingModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAppointment} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
              {/* Client Selection Type */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Bénéficiaire du soin :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormGuestType('hotel_guest')}
                    className={`h-8 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      formGuestType === 'hotel_guest'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Bed size={13} />
                    <span>Résident Hôtel / Resort</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormGuestType('external')}
                    className={`h-8 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      formGuestType === 'external'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <User size={13} />
                    <span>Client Externe</span>
                  </button>
                </div>
              </div>

              {/* Guest Choice */}
              {formGuestType === 'hotel_guest' ? (
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Sélectionner le résident et sa chambre :
                  </label>
                  <select
                    value={formSelectedBookingId}
                    onChange={(e) => setFormSelectedBookingId(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  >
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.guestName} — {b.resourceName} ({b.startDate} → {b.endDate})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Nom complet du client * :
                    </label>
                    <input
                      type="text"
                      required
                      value={formExternalName}
                      onChange={(e) => setFormExternalName(e.target.value)}
                      placeholder="Ex: Madame Nadia Cherif"
                      className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Téléphone mobile :
                    </label>
                    <input
                      type="tel"
                      value={formExternalPhone}
                      onChange={(e) => setFormExternalPhone(e.target.value)}
                      placeholder="+213 6..."
                      className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Treatment Selection */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Soin ou Rituel Spa :
                </label>
                <select
                  value={formTreatmentId}
                  onChange={(e) => setFormTreatmentId(e.target.value)}
                  className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                >
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name[language] || t.name.fr} ({t.durationMinutes} min) — {t.price} {currency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Facility & Therapist Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Cabine / Espace :
                  </label>
                  <select
                    value={formFacilityId}
                    onChange={(e) => setFormFacilityId(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name[language] || f.name.fr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Praticien(ne) :
                  </label>
                  <select
                    value={formTherapistId}
                    onChange={(e) => setFormTherapistId(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {therapists.map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.name} ({th.isAvailable ? 'Disponible' : 'Occupé'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Date du soin :
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Heure de début :
                  </label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mode de règlement :
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'room_charge', label: 'Note Chambre' },
                    { id: 'cash', label: 'Espèces' },
                    { id: 'card', label: 'Carte Bancaire' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setFormPaymentMethod(pm.id as any)}
                      className={`h-7 px-2 rounded-md font-semibold text-[11px] border cursor-pointer ${
                        formPaymentMethod === pm.id
                          ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Instructions particulières (allergies, pression, huiles) :
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Huile parfumée fleur d'oranger, insister trapèzes"
                  className="w-full h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewBookingModalOpen(false)}
                  className="h-8 px-3.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Confirmer le Rendez-vous</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL FICHE SOIN & REÇU FACTURATION */}
      {receiptModalAppointment && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-xs pms-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReceiptModalAppointment(null);
          }}
        >
          <div role="dialog" aria-modal="true" className="pms-dialog-panel max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 space-y-4 pms-modal">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Flower2 className="text-rose-500" size={18} />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Fiche de Prestation Spa #{receiptModalAppointment.id.slice(-6)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalAppointment(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Client :</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptModalAppointment.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chambre / Hébergement :</span>
                <span className="text-slate-800 dark:text-slate-200">{receiptModalAppointment.guestRoom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Soin :</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{receiptModalAppointment.treatmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Praticien(ne) :</span>
                <span className="text-slate-800 dark:text-slate-200">{receiptModalAppointment.therapistName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cabine :</span>
                <span className="text-slate-800 dark:text-slate-200">{receiptModalAppointment.facilityName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Horaire :</span>
                <span className="text-slate-800 dark:text-slate-200">{receiptModalAppointment.startTime} - {receiptModalAppointment.endTime}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm">
                <span>Montant Facturé :</span>
                <span className="text-emerald-600 dark:text-emerald-400">{receiptModalAppointment.price} {currency}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Règlement :</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {receiptModalAppointment.paymentMethod === 'room_charge'
                    ? 'Imputé au Room Folio PMS'
                    : receiptModalAppointment.paymentMethod === 'cash'
                    ? 'Espèces au comptoir'
                    : 'Carte bancaire'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-8 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer size={13} />
                <span>Imprimer Reçu</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptModalAppointment(null)}
                className="h-8 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
