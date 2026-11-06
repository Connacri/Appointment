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
  CheckSquare,
  Square,
  FileDown,
  Percent,
  X,
  XCircle,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
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
    currency,
    updateBooking,
    updateBookingStatus,
  } = useApp();

  const isClientRole = currentRole === 'client';
  const [filterTab, setFilterTab] = useState<'all' | 'confirmed' | 'checked_in' | 'cash_pending'>('all');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(clientProfile.name);
  const [editEmail, setEditEmail] = useState(clientProfile.email);
  const [editPhone, setEditPhone] = useState(clientProfile.phone);

  // Bulk actions states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

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

  const isAllSelected = filtered.length > 0 && filtered.every((b) => selectedIds.includes(b.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((b) => b.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Batch 1: Cancel selected bookings
  const handleBatchCancel = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    selectedIds.forEach((id) => {
      updateBookingStatus(id, 'cancelled');
    });
    setSelectedIds([]);
    setIsCancelConfirmOpen(false);
    setBulkNotice(
      language === 'fr'
        ? `${count} réservation(s) annulée(s) avec succès.`
        : language === 'ar'
        ? `تم إلغاء ${count} حجز بنجاح.`
        : `${count} booking(s) cancelled successfully.`
    );
    setTimeout(() => setBulkNotice(null), 4000);
  };

  // Batch 2: Export selected bookings to PDF
  const handleBatchExportPdf = () => {
    if (selectedIds.length === 0) return;
    const selectedBookings = bookings.filter((b) => selectedIds.includes(b.id));

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(
      language === 'fr'
        ? 'Rapport des Réservations Sélectionnées'
        : language === 'ar'
        ? 'تقرير الحجوزات المحددة'
        : 'Selected Bookings Summary Report',
      14,
      18
    );

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const nowStr = new Date().toLocaleString();
    doc.text(
      `Date d'export : ${nowStr} | Total : ${selectedBookings.length} dossier(s)`,
      14,
      25
    );

    let y = 35;
    selectedBookings.forEach((b, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 4, 182, 18, 'F');

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${idx + 1}. ${b.guestName} — ${b.resourceName}`, 16, y + 2);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Dates: ${b.startDate} -> ${b.endDate} | Statut: ${b.status} | Montant: ${b.totalPrice} ${currency} (${b.paymentStatus})`,
        16,
        y + 8
      );

      y += 22;
    });

    doc.save(`reservations-selection-${new Date().toISOString().slice(0, 10)}.pdf`);
    setBulkNotice(
      language === 'fr'
        ? `${selectedBookings.length} réservation(s) exportée(s) en PDF.`
        : language === 'ar'
        ? `تم تصدير ${selectedBookings.length} حجز إلى PDF.`
        : `${selectedBookings.length} booking(s) exported to PDF.`
    );
    setTimeout(() => setBulkNotice(null), 4000);
  };

  // Batch 3: Apply Discount to selected bookings
  const handleApplyDiscount = () => {
    if (selectedIds.length === 0 || discountValue <= 0) return;
    const count = selectedIds.length;
    selectedIds.forEach((id) => {
      const bkg = bookings.find((b) => b.id === id);
      if (!bkg) return;
      let newPrice = bkg.totalPrice;
      if (discountType === 'percent') {
        newPrice = Math.max(0, Math.round(bkg.totalPrice * (1 - discountValue / 100)));
      } else {
        newPrice = Math.max(0, Math.round(bkg.totalPrice - discountValue));
      }
      updateBooking(id, {
        totalPrice: newPrice,
        notes:
          (bkg.notes || '') +
          (bkg.notes ? ' | ' : '') +
          `[Remise ${discountValue}${discountType === 'percent' ? '%' : ` ${currency}`}]`,
      });
    });
    setSelectedIds([]);
    setIsDiscountModalOpen(false);
    setBulkNotice(
      language === 'fr'
        ? `Remise de ${discountValue}${discountType === 'percent' ? '%' : ` ${currency}`} appliquée à ${count} réservation(s).`
        : language === 'ar'
        ? `تم تطبيق خصم ${discountValue}${discountType === 'percent' ? '%' : ` ${currency}`} على ${count} حجز.`
        : `Discount of ${discountValue}${discountType === 'percent' ? '%' : ` ${currency}`} applied to ${count} booking(s).`
    );
    setTimeout(() => setBulkNotice(null), 4000);
  };

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
    <div className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-4 lg:p-6 overflow-y-auto overscroll-contain space-y-4 sm:space-y-5 relative">
      {/* Bulk action feedback toast */}
      {bulkNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-blue-500/50 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          <span>{bulkNotice}</span>
        </div>
      )}
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
                className="px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 hover:scale-102"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>
              {isClientRole
                ? (language === 'fr' ? "Mes Réservations & Pass QR Code d'Arrivée" : language === 'ar' ? 'حجوزاتي ورمز QR للوصول' : 'My Bookings & QR Arrival Pass')
                : getTranslation('myBookingsTitle', language)}
            </span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isClientRole
              ? (language === 'fr' ? 'Consultez vos réservations, téléchargez votre QR Code et présentez-le à votre arrivée' : language === 'ar' ? 'اطلع على حجوزاتك، حمّل رمز QR وقدّمه فور وصولك للمنشأة' : 'Check your bookings, download your QR pass and present it upon arrival')
              : (language === 'fr' ? 'Gestion centralisée des arrivées, scans QR code et encaissements' : language === 'ar' ? 'إدارة مركزية للوصول، مسح رموز QR والتحصيلات النقدية' : 'Centralized arrivals, QR code check-ins and payments')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {!isClientRole && (
            <button
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Camera size={14} />
              <span>{language === 'fr' ? 'Scanner QR Pass' : language === 'ar' ? 'مسح الرمز' : 'Scan Pass'}</span>
            </button>
          )}

          <button
            onClick={() => setIsNewBookingModalOpen(true)}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>
              {isClientRole
                ? (language === 'fr' ? 'Réserver en ligne' : language === 'ar' ? 'حجز عبر الإنترنت' : 'Book Online')
                : (language === 'fr' ? 'Ajouter Réservation' : language === 'ar' ? 'إضافة حجز' : 'Add Booking')}
            </span>
          </button>
        </div>
      </div>

      {/* 3. FILTER TABS & BULK SELECT ALL */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <button
            onClick={() => setFilterTab('all')}
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'fr' ? 'Tous' : language === 'ar' ? 'الكل' : 'All'} ({bookings.length})
          </button>
          <button
            onClick={() => setFilterTab('confirmed')}
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              filterTab === 'confirmed'
                ? 'bg-sky-600 text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'fr' ? 'Confirmés' : language === 'ar' ? 'مؤكدة' : 'Confirmed'}
          </button>
          <button
            onClick={() => setFilterTab('checked_in')}
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              filterTab === 'checked_in'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'fr' ? 'Présents' : language === 'ar' ? 'حاضرون' : 'Checked-in'}
          </button>
          <button
            onClick={() => setFilterTab('cash_pending')}
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              filterTab === 'cash_pending'
                ? 'bg-amber-600 text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'fr' ? 'Espèces au comptoir' : language === 'ar' ? 'نقد عند الاستقبال' : 'Cash on arrival'}
          </button>
        </div>

        {/* Bulk Select All Button */}
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors shrink-0 cursor-pointer shadow-2xs ${
              isAllSelected
                ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 text-blue-700 dark:text-blue-300 font-bold'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
            title={isAllSelected ? 'Désélectionner tout' : 'Sélectionner tout'}
          >
            {isAllSelected ? <CheckSquare size={14} className="text-blue-600 dark:text-blue-400" /> : <Square size={14} className="text-slate-400" />}
            <span className="hidden sm:inline">
              {isAllSelected
                ? (language === 'fr' ? 'Tout désélectionner' : language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect all')
                : (language === 'fr' ? 'Tout sélectionner' : language === 'ar' ? 'تحديد الكل' : 'Select all')}
            </span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
              {selectedIds.length}/{filtered.length}
            </span>
          </button>
        )}
      </div>

      {/* 4. BOOKINGS CARDS GRID */}
      {filtered.length === 0 ? (
        <div className="p-8 sm:p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900">
          <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2 sm:mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
            {language === 'fr'
              ? 'Aucun dossier trouvé dans cette vue'
              : language === 'ar'
              ? 'لم يتم العثور على أي حجز في هذا العرض'
              : 'No bookings found in this view'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {isClientRole
              ? (language === 'fr'
                  ? "Vous n'avez pas encore de réservation active. Effectuez votre réservation en ligne en un clic !"
                  : language === 'ar'
                  ? 'لا توجد لديك حجوزات نشطة حالياً. احجز إقامتك أونلاين بنقرة واحدة!'
                  : 'You have no active bookings yet. Book online in a single click!')
              : (language === 'fr'
                  ? 'Aucune réservation ne correspond à ce filtre.'
                  : language === 'ar'
                  ? 'لا توجد حجوزات مطابقة لهذا الفلتر.'
                  : 'No bookings match this filter.')}
          </p>
          <button
            onClick={() => setIsNewBookingModalOpen(true)}
            className="mt-3 sm:mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            {language === 'fr' ? 'Réserver maintenant' : language === 'ar' ? 'احجز الآن' : 'Book now'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2.5 sm:gap-4">
          {filtered.map((bkg) => {
            const st = statusConfig[bkg.status] || statusConfig.confirmed;
            const isCashPending = bkg.paymentStatus === 'pending' && bkg.totalPrice > 0;
            const isCheckedIn = bkg.status === 'checked_in';

            const isSelected = selectedIds.includes(bkg.id);

            return (
              <div
                key={bkg.id}
                className={`border rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3 sm:space-y-4 relative ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/30 ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Sector Badge, Checkbox & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-2">
                      {/* Checkbox for Bulk Actions */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelectOne(bkg.id)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-blue-600 bg-blue-100 dark:bg-blue-950 ring-1 ring-blue-500'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={isSelected ? 'Désélectionner' : 'Sélectionner pour actions groupées'}
                        aria-label="Sélectionner la réservation"
                      >
                        {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                      </button>
                      {getSectorBadge(bkg.sector)}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        isCheckedIn
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      {isCheckedIn ? (language === 'fr' ? 'Présent' : language === 'ar' ? 'حاضر' : 'Checked-in') : st.label[language] || bkg.status}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base mb-1 truncate">
                    {bkg.resourceName}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold mb-2.5 sm:mb-3">
                    <User size={13} className="text-slate-400" />
                    <span>{bkg.guestName}</span>
                  </div>

                  {/* Dates & Details */}
                  <div className="space-y-1.5 sm:space-y-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{language === 'fr' ? 'Dates :' : language === 'ar' ? 'التواريخ :' : 'Dates:'}</span>
                      <span className="font-mono text-slate-900 dark:text-white font-bold">
                        {bkg.startDate} {bkg.startDate !== bkg.endDate ? `→ ${bkg.endDate}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">{language === 'fr' ? 'Paiement :' : language === 'ar' ? 'الدفع :' : 'Payment:'}</span>
                      {bkg.totalPrice === 0 ? (
                        <span className="text-emerald-600 font-bold">{language === 'fr' ? 'Gratuit' : language === 'ar' ? 'مجاني' : 'Free'}</span>
                      ) : isCashPending ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <Banknote size={13} />
                          <span>{language === 'fr' ? 'Espèces' : language === 'ar' ? 'نقداً' : 'Cash'} ({bkg.totalPrice} {currency})</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <ShieldCheck size={13} />
                          <span>{language === 'fr' ? 'Payé' : language === 'ar' ? 'مدفوع' : 'Paid'} ({bkg.totalPrice} {currency})</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Button: Open QR Pass Modal */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 sm:space-y-2">
                  <button
                    type="button"
                    onClick={() => setActiveQrPassBooking(bkg)}
                    className="w-full h-9 sm:h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl sm:rounded-2xl text-xs shadow-xs transition flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <QrCode size={15} className="group-hover:scale-110 transition-transform" />
                    <span>{language === 'fr' ? "Pass QR Code d'Arrivée" : language === 'ar' ? 'رمز QR السريع للوصول' : 'Arrival QR Code Pass'}</span>
                  </button>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <button
                      type="button"
                      onClick={() => downloadICS(bkg)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors font-medium text-[11px] cursor-pointer"
                      title={language === 'fr' ? 'Ajouter au calendrier .ICS' : language === 'ar' ? 'إضافة إلى تقويم .ICS' : 'Add to .ICS calendar'}
                    >
                      <Download size={12} />
                      <span>{language === 'fr' ? 'Calendrier .ICS' : language === 'ar' ? 'التقويم .ICS' : 'Calendar .ICS'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBooking(bkg)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold text-[11px] cursor-pointer"
                    >
                      {language === 'fr' ? 'Détails / Modifier' : language === 'ar' ? 'التفاصيل / التعديل' : 'Details / Edit'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. FLOATING / STICKY BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <aside
          aria-label={language === 'fr' ? 'Actions groupées' : language === 'ar' ? 'إجراءات جماعية' : 'Bulk actions'}
          className="sticky bottom-3 z-40 w-full rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white p-3 sm:p-3.5 shadow-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              <CheckSquare size={16} />
            </div>
            <div>
              <div className="text-xs font-extrabold flex items-center gap-1.5">
                <span>{selectedIds.length}</span>
                <span>{language === 'fr' ? 'réservation(s) sélectionnée(s)' : language === 'ar' ? 'حجوزات محددة' : 'booking(s) selected'}</span>
              </div>
              <span className="text-[10px] text-slate-300">
                {language === 'fr' ? 'Actions rapides en un clic' : language === 'ar' ? 'إجراءات بنقرة واحدة' : 'Single-click actions'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Batch Cancel */}
            <button
              type="button"
              onClick={() => setIsCancelConfirmOpen(true)}
              className="h-8 px-2.5 sm:px-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title={language === 'fr' ? 'Annuler les réservations sélectionnées' : language === 'ar' ? 'إلغاء الحجوزات المحددة' : 'Batch Cancel'}
            >
              <Trash2 size={13} />
              <span>{language === 'fr' ? 'Annulation groupée' : language === 'ar' ? 'إلغاء جماعي' : 'Batch Cancel'}</span>
            </button>

            {/* Export to PDF */}
            <button
              type="button"
              onClick={handleBatchExportPdf}
              className="h-8 px-2.5 sm:px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title={language === 'fr' ? 'Exporter la sélection en PDF' : language === 'ar' ? 'تصدير التحديد إلى PDF' : 'Export selection to PDF'}
            >
              <FileDown size={13} />
              <span>{language === 'fr' ? 'Exporter en PDF' : language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
            </button>

            {/* Apply Discount */}
            <button
              type="button"
              onClick={() => setIsDiscountModalOpen(true)}
              className="h-8 px-2.5 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title={language === 'fr' ? 'Appliquer une remise aux réservations sélectionnées' : language === 'ar' ? 'تطبيق خصم على الحجوزات المحددة' : 'Apply Discount'}
            >
              <Percent size={13} />
              <span>{language === 'fr' ? 'Appliquer remise' : language === 'ar' ? 'تطبيق خصم' : 'Apply Discount'}</span>
            </button>

            {/* Deselect All */}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="h-8 px-2 sm:px-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title={language === 'fr' ? 'Tout désélectionner' : language === 'ar' ? 'إلغاء التحديد' : 'Deselect all'}
            >
              <X size={13} />
              <span className="hidden sm:inline">{language === 'fr' ? 'Désélectionner' : language === 'ar' ? 'إلغاء' : 'Deselect'}</span>
            </button>
          </div>
        </aside>
      )}

      {/* Confirmation Modal: Batch Cancel */}
      {isCancelConfirmOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {language === 'fr' ? 'Confirmer l’annulation groupée' : language === 'ar' ? 'تأكيد الإلغاء الجماعي' : 'Confirm Batch Cancellation'}
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedIds.length} {language === 'fr' ? 'dossier(s) concerné(s)' : language === 'ar' ? 'حجز محدد' : 'booking(s)'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'fr'
                ? `Voulez-vous vraiment annuler les ${selectedIds.length} réservations sélectionnées ? Leur statut passera à "Annulé".`
                : language === 'ar'
                ? `هل أنت متأكد من رغبتك في إلغاء ${selectedIds.length} حجز محدد؟ سيتم تحويل حالتها إلى "ملغاة".`
                : `Are you sure you want to cancel the ${selectedIds.length} selected bookings? Their status will be set to "Cancelled".`}
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(false)}
                className="flex-1 h-9 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {language === 'fr' ? 'Retour' : language === 'ar' ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleBatchCancel}
                className="flex-1 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                {language === 'fr' ? 'Oui, Annuler tout' : language === 'ar' ? 'نعم، إلغاء الكل' : 'Yes, Cancel All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Apply Discount */}
      {isDiscountModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 flex items-center justify-center">
                <Percent size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {language === 'fr' ? 'Appliquer une Remise Groupée' : language === 'ar' ? 'تطبيق خصم جماعي' : 'Apply Bulk Discount'}
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedIds.length} {language === 'fr' ? 'réservation(s) sélectionnée(s)' : language === 'ar' ? 'حجز محدد' : 'booking(s)'}
                </span>
              </div>
            </div>

            {/* Type selector: % vs Fixed */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`h-8 rounded-xl border transition-colors cursor-pointer ${
                  discountType === 'percent'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {language === 'fr' ? 'Pourcentage (%)' : language === 'ar' ? 'نسبة مئوية (%)' : 'Percentage (%)'}
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`h-8 rounded-xl border transition-colors cursor-pointer ${
                  discountType === 'fixed'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {language === 'fr' ? `Montant fixe (${currency})` : language === 'ar' ? `مبلغ ثابت (${currency})` : `Fixed (${currency})`}
              </button>
            </div>

            {/* Quick Presets */}
            {discountType === 'percent' ? (
              <div className="flex items-center gap-1.5">
                {[5, 10, 15, 20, 25].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDiscountValue(val)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      discountValue === val
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-400'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    -{val}%
                  </button>
                ))}
              </div>
            ) : null}

            {/* Input Value */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {discountType === 'percent'
                  ? (language === 'fr' ? 'Valeur du rabais (%) :' : language === 'ar' ? 'قيمة الخصم (%) :' : 'Discount Value (%):')
                  : (language === 'fr' ? `Montant du rabais (${currency}) :` : language === 'ar' ? `قيمة الخصم (${currency}) :` : `Discount Value (${currency}):`)}
              </label>
              <input
                type="number"
                min={1}
                max={discountType === 'percent' ? 100 : 999999}
                value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(1, Number(e.target.value) || 0))}
                className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="flex-1 h-9 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                {language === 'fr' ? 'Appliquer' : language === 'ar' ? 'تطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
