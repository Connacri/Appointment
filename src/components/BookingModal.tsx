import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  CreditCard,
  CheckCircle2,
  Download,
  Trash2,
  Bed,
  Stethoscope,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { initialResourceGroups } from '../data/mockData';
import { BookingStatus, SectorType, TimelineBooking } from '../types/booking';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';

export const BookingModal: React.FC = () => {
  const {
    language,
    isNewBookingModalOpen,
    setIsNewBookingModalOpen,
    newBookingInitialSlot,
    selectedBooking,
    setSelectedBooking,
    addBooking,
    updateBookingStatus,
    deleteBooking,
    currentBaseDate,
  } = useApp();

  const isEditing = !!selectedBooking;
  const isOpen = isNewBookingModalOpen || isEditing;

  // Flatten all available resources
  const allResources = initialResourceGroups.flatMap((g) => g.resources);

  // Form State
  const [sector, setSector] = useState<SectorType>('hotel');
  const [resourceId, setResourceId] = useState<string>(allResources[0]?.id || 'rm_101');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [startDate, setStartDate] = useState(currentBaseDate);
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<BookingStatus>('confirmed');
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partial'>('paid');

  // Populate when opening modal
  useEffect(() => {
    if (selectedBooking) {
      setSector(selectedBooking.sector);
      setResourceId(selectedBooking.resourceId);
      setGuestName(selectedBooking.guestName);
      setGuestEmail(selectedBooking.guestEmail);
      setGuestPhone(selectedBooking.guestPhone);
      setStartDate(selectedBooking.startDate);
      setEndDate(selectedBooking.endDate);
      setStatus(selectedBooking.status);
      setNotes(selectedBooking.notes || '');
      setPaymentStatus(selectedBooking.paymentStatus);
    } else {
      // New booking initialization
      if (newBookingInitialSlot?.resourceId) {
        setResourceId(newBookingInitialSlot.resourceId);
        const res = allResources.find((r) => r.id === newBookingInitialSlot.resourceId);
        if (res) setSector(res.sector);
      }
      if (newBookingInitialSlot?.date) {
        setStartDate(newBookingInitialSlot.date);
        const [y, m, d] = newBookingInitialSlot.date.split('-').map(Number);
        const next = new Date(y, m - 1, d + 3);
        setEndDate(
          `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
            next.getDate()
          ).padStart(2, '0')}`
        );
      } else {
        setStartDate(currentBaseDate);
        const [y, m, d] = currentBaseDate.split('-').map(Number);
        const next = new Date(y, m - 1, d + 3);
        setEndDate(
          `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
            next.getDate()
          ).padStart(2, '0')}`
        );
      }
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setStatus('confirmed');
      setNotes('');
      setPaymentStatus('paid');
    }
  }, [selectedBooking, newBookingInitialSlot, currentBaseDate]);

  if (!isOpen) return null;

  const currentResource = allResources.find((r) => r.id === resourceId) || allResources[0];

  // Calculate nights & price
  const calcDays = () => {
    if (!startDate || !endDate) return 1;
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24);
    return Math.max(1, Math.round(diff));
  };

  const calculatedDays = calcDays();
  const totalPrice = calculatedDays * (currentResource?.pricePerDay || 85);

  const [conflictError, setConflictError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setConflictError(null);

    if (isEditing && selectedBooking) {
      updateBookingStatus(selectedBooking.id, status);
      setSelectedBooking(null);
    } else {
      const res = addBooking({
        resourceId,
        resourceName: currentResource?.name || 'Resource',
        sector,
        guestName,
        guestEmail: guestEmail || 'guest@example.com',
        guestPhone: guestPhone || '+33 6 00 00 00 00',
        startDate,
        endDate: endDate || startDate,
        status,
        totalPrice,
        paymentStatus,
        notes,
      });

      if (!res.success && res.error) {
        setConflictError(res.error);
        return;
      }
      setIsNewBookingModalOpen(false);
    }
  };

  const closeModal = () => {
    setIsNewBookingModalOpen(false);
    setSelectedBooking(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-base">
              {isEditing
                ? language === 'fr'
                  ? 'Détails de la Réservation'
                  : language === 'ar'
                  ? 'تفاصيل الحجز'
                  : 'Booking Details'
                : language === 'fr'
                ? 'Nouvelle Réservation'
                : language === 'ar'
                ? 'إضافة حجز جديد'
                : 'New Booking'}
            </span>
            {isEditing && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  statusConfig[selectedBooking.status]?.pillBg
                }`}
              >
                {statusConfig[selectedBooking.status]?.label[language] || selectedBooking.status}
              </span>
            )}
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Sector selection (only when creating new) */}
          {!isEditing && (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'fr' ? 'Département / Secteur :' : language === 'ar' ? 'القسم / النشاط:' : 'Department:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSector('hotel');
                    const first = allResources.find((r) => r.sector === 'hotel');
                    if (first) setResourceId(first.id);
                  }}
                  className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-colors ${
                    sector === 'hotel'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Bed size={15} />
                  <span>Hôtel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSector('clinic');
                    const first = allResources.find((r) => r.sector === 'clinic');
                    if (first) setResourceId(first.id);
                  }}
                  className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-colors ${
                    sector === 'clinic'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Stethoscope size={15} />
                  <span>Clinique</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSector('wellness');
                    const first = allResources.find((r) => r.sector === 'wellness' || r.sector === 'other');
                    if (first) setResourceId(first.id);
                  }}
                  className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-colors ${
                    sector === 'wellness' || (sector as any) === 'other'
                      ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Sparkles size={15} />
                  <span>Spa / RDV</span>
                </button>
              </div>
            </div>
          )}

          {/* Resource Selection */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fr' ? 'Chambre ou Médecin / Praticien :' : language === 'ar' ? 'الغرفة أو الطبيب المعالج:' : 'Room / Doctor / Resource:'}
            </label>
            <select
              value={resourceId}
              onChange={(e) => {
                setResourceId(e.target.value);
                const r = allResources.find((res) => res.id === e.target.value);
                if (r) setSector(r.sector);
              }}
              className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {allResources
                .filter((r) => isEditing || r.sector === sector)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.pricePerDay}€ / jour)
                  </option>
                ))}
            </select>
          </div>

          {/* Guest / Patient Details */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr' ? 'Nom complet de l\'invité / patient *' : language === 'ar' ? 'اسم النزيل أو المريض الكامل *' : 'Full Guest / Patient Name *'}
              </label>
              <div className="relative">
                <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ex: Alexander Kaufmann"
                  className="w-full h-9 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'fr' ? 'E-mail :' : language === 'ar' ? 'البريد الإلكتروني:' : 'Email Address:'}
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full h-9 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'fr' ? 'Téléphone :' : language === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full h-9 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dates Selection */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr' ? 'Date d\'arrivée / Début' : language === 'ar' ? 'تاريخ الوصول / البداية' : 'Check-in / Start Date'}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr' ? 'Date de départ / Fin' : language === 'ar' ? 'تاريخ المغادرة / النهاية' : 'Check-out / End Date'}
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status & Payment Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr' ? 'Statut du dossier :' : language === 'ar' ? 'حالة الحجز:' : 'Booking Status:'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(Object.keys(statusConfig) as BookingStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {statusConfig[st].label[language] || statusConfig[st].label.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr' ? 'Règlement :' : language === 'ar' ? 'حالة الدفع:' : 'Payment:'}
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="paid">{language === 'fr' ? 'Payé intégralement' : 'Paid in full'}</option>
                <option value="pending">{language === 'fr' ? 'En attente' : 'Pending'}</option>
                <option value="partial">{language === 'fr' ? 'Acompte versé' : 'Deposit partial'}</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fr' ? 'Remarques / Instructions particulières :' : language === 'ar' ? 'ملاحظات خاصة:' : 'Notes / Requests:'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Clé en réception tardive, régime sans gluten..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Price Calculation Box */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] text-slate-500 block">
                {calculatedDays} {language === 'fr' ? 'jour(s) / nuit(s)' : 'day(s) / night(s)'} × {currentResource?.pricePerDay}€
              </span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                Total : {totalPrice} €
              </span>
            </div>

            {isEditing && selectedBooking && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => downloadICS(selectedBooking)}
                  className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 flex items-center gap-1 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  title="Télécharger l'événement .ICS"
                >
                  <Download size={14} />
                  <span>.ICS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Voulez-vous supprimer cette réservation ?')) {
                      deleteBooking(selectedBooking.id);
                    }
                  }}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
            >
              {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
            >
              {isEditing
                ? language === 'fr'
                  ? 'Enregistrer les modifications'
                  : language === 'ar'
                  ? 'حفظ التعديلات'
                  : 'Save Changes'
                : language === 'fr'
                ? 'Confirmer la réservation'
                : language === 'ar'
                ? 'تأكيد الحجز'
                : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
