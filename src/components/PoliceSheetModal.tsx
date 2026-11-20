import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  ShieldCheck,
  Building2,
  Star,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  CreditCard,
  FileBadge2,
} from 'lucide-react';
import { DomainType, ResourceItem } from '../types/booking';
import { EstablishmentProfile } from '../types/establishment';

export interface PoliceCompanionGuest {
  fullName: string;
  phone: string;
  email: string;
  documentType: string;
  documentNumber: string;
  documentExpiryDate?: string;
}

export interface PoliceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'fr' | 'en' | 'ar';
  establishmentProfile: EstablishmentProfile;
  bookingId?: string;
  activeDomain: DomainType;
  currentResource?: ResourceItem;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestType: 'algerian' | 'foreigner';
  foreignNationality: string;
  idPieceType:
    | 'cni'
    | 'passport'
    | 'driving_license'
    | 'special_authorization'
    | 'diplomatic_passport'
    | 'special_passport'
    | 'official_document';
  idPieceNumber: string;
  algerianIdType: 'cni' | 'nin';
  algerianIdNumber: string;
  passportNumber: string;
  idDocumentExpiryDate?: string;
  specialAuthorizationDesc?: string;
  wilayaOfOrigin: string;
  visaNumber?: string;
  visaExpiryDate?: string;
  entryDateInCountry?: string;
  startDate: string;
  endDate: string;
  checkInTime: string;
  checkOutTime: string;
  calculatedDays: number;
  hotelAdults: number;
  hotelChildren: number;
  resortOccupants: number;
  adultGuests: PoliceCompanionGuest[];
  paymentCurrency: string;
  currencySymbol: string;
  priceInPaymentCurrency: number;
  priceInDzd: number;
  paymentMethodType:
    | 'cash_dzd'
    | 'cib'
    | 'edahabia'
    | 'cash_forex'
    | 'card_international'
    | 'bank_transfer';
}

const ID_PIECE_LABELS: Record<
  PoliceSheetModalProps['idPieceType'],
  { fr: string; en: string; ar: string }
> = {
  cni: {
    fr: "Carte Nationale d'Identité (CNI)",
    en: 'National ID Card (CNI)',
    ar: 'بطاقة التعريف الوطنية',
  },
  passport: {
    fr: 'Passeport Ordinaire',
    en: 'Ordinary Passport',
    ar: 'جواز سفر عادي',
  },
  driving_license: {
    fr: 'Permis de Conduire',
    en: 'Driving License',
    ar: 'رخصة السياقة',
  },
  special_authorization: {
    fr: 'Autorisation Spéciale',
    en: 'Special Authorization',
    ar: 'ترخيص خاص',
  },
  diplomatic_passport: {
    fr: 'Passeport Diplomatique',
    en: 'Diplomatic Passport',
    ar: 'جواز سفر دبلوماسي',
  },
  special_passport: {
    fr: 'Passeport Spécial / Service',
    en: 'Special / Service Passport',
    ar: 'جواز سفر خاص / خدمة',
  },
  official_document: {
    fr: "Document Officiel d'État",
    en: 'Official State Document',
    ar: 'وثيقة رسمية للدولة',
  },
};

const PAYMENT_METHOD_LABELS: Record<
  PoliceSheetModalProps['paymentMethodType'],
  { fr: string; en: string; ar: string }
> = {
  cash_dzd: { fr: 'Espèces (DZD)', en: 'Cash (DZD)', ar: 'نقداً (دج)' },
  cib: { fr: 'Carte CIB', en: 'CIB Card', ar: 'بطاقة CIB' },
  edahabia: { fr: 'Carte Edahabia', en: 'Edahabia Card', ar: 'البطاقة الذهبية' },
  cash_forex: { fr: 'Espèces Devises', en: 'Foreign Cash', ar: 'عملة صعبة نقداً' },
  card_international: {
    fr: 'Carte Internationale',
    en: 'International Card',
    ar: 'بطاقة دولية',
  },
  bank_transfer: { fr: 'Virement Bancaire', en: 'Bank Transfer', ar: 'تحويل بنكي' },
};

export const PoliceSheetModal: React.FC<PoliceSheetModalProps> = ({
  isOpen,
  onClose,
  language,
  establishmentProfile,
  bookingId,
  activeDomain,
  currentResource,
  guestName,
  guestPhone,
  guestEmail,
  guestType,
  foreignNationality,
  idPieceType,
  idPieceNumber,
  algerianIdType,
  algerianIdNumber,
  passportNumber,
  idDocumentExpiryDate,
  specialAuthorizationDesc,
  wilayaOfOrigin,
  visaNumber,
  visaExpiryDate,
  entryDateInCountry,
  startDate,
  endDate,
  checkInTime,
  checkOutTime,
  calculatedDays,
  hotelAdults,
  hotelChildren,
  resortOccupants,
  adultGuests,
  paymentCurrency,
  currencySymbol,
  priceInPaymentCurrency,
  priceInDzd,
  paymentMethodType,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isRtl = language === 'ar';
  const effectiveDocNumber =
    idPieceNumber.trim() ||
    (guestType === 'algerian' ? algerianIdNumber.trim() : passportNumber.trim());

  const idLabel =
    ID_PIECE_LABELS[idPieceType]?.[language] ||
    ID_PIECE_LABELS[idPieceType]?.fr ||
    algerianIdType.toUpperCase();

  const paymentLabel =
    PAYMENT_METHOD_LABELS[paymentMethodType]?.[language] ||
    PAYMENT_METHOD_LABELS[paymentMethodType]?.fr ||
    paymentMethodType;

  const missingFields: string[] = [];
  if (!guestName.trim()) {
    missingFields.push(
      language === 'ar' ? 'اسم النزيل' : language === 'en' ? 'Guest name' : 'Nom du client'
    );
  }
  if (!effectiveDocNumber) {
    missingFields.push(
      language === 'ar' ? 'رقم الوثيقة' : language === 'en' ? 'ID number' : 'N° de pièce'
    );
  }
  if (guestType === 'foreigner' && !visaNumber?.trim()) {
    missingFields.push(
      language === 'ar' ? 'رقم التأشيرة' : language === 'en' ? 'Visa number' : 'N° visa'
    );
  }

  const companions =
    activeDomain === 'hotel' && hotelAdults > 1
      ? adultGuests
          .slice(1, hotelAdults)
          .filter((g) => g.fullName.trim() || g.documentNumber.trim())
      : [];

  const todayFormatted = new Date().toLocaleDateString(
    language === 'ar' ? 'ar-DZ' : language === 'en' ? 'en-GB' : 'fr-FR'
  );
  const folioRef = bookingId
    ? bookingId.toUpperCase()
    : `FP-${(startDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '')}`;

  const hotelName =
    establishmentProfile.name?.trim() ||
    (language === 'ar'
      ? 'المؤسسة الفندقية'
      : language === 'en'
      ? 'Hospitality Establishment'
      : 'Établissement Hôtelier');

  return createPortal(
    <div
      className="pms-police-print-portal fixed inset-0 z-[10002] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs pms-modal-backdrop overflow-y-auto print:static print:inset-auto print:bg-transparent print:p-0 print:block"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="police-sheet-dialog-title"
        dir={isRtl ? 'rtl' : 'ltr'}
        className="pms-dialog-panel bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] my-auto pms-modal print:border-none print:shadow-none print:rounded-none print:max-h-none print:max-w-none print:bg-white print:overflow-visible"
      >
        {/* Top Control Bar (hidden when printing) */}
        <header className="print:hidden px-3.5 sm:px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4
                  id="police-sheet-dialog-title"
                  className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight truncate"
                >
                  {language === 'ar'
                    ? 'بطاقة الشرطة الفردية • Fiche de Police'
                    : language === 'en'
                    ? 'Official Police Registration Sheet'
                    : 'Fiche Individuelle de Police • بطاقة الشرطة'}
                </h4>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                    guestType === 'algerian'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {guestType === 'algerian'
                    ? language === 'ar'
                      ? 'وطني'
                      : language === 'en'
                      ? 'National'
                      : 'National DZ'
                    : language === 'ar'
                    ? 'أجنبي'
                    : language === 'en'
                    ? 'Foreign'
                    : 'Étranger'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {language === 'ar'
                  ? 'التصريح التنظيمي للإقامة الفندقية (المديرية العامة للأمن الوطني)'
                  : language === 'en'
                  ? 'Algerian Hospitality Regulation — DGSN / Tourism Declaration'
                  : 'Réglementation Hôtelière Algérienne — Déclaration DGSN / Tourisme'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-11 min-h-11 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X size={19} />
          </button>
        </header>

        {/* Preview Stage */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-5 bg-slate-200/75 dark:bg-slate-950 print:p-0 print:bg-white print:overflow-visible">
          {/* Official White Paper Document */}
          <article
            id="printable-police-sheet"
            dir="ltr"
            className="mx-auto w-full bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-lg overflow-hidden print:rounded-none print:border-none print:shadow-none"
          >
            {/* Top Institutional Strip */}
            <div className="h-2 bg-gradient-to-r from-emerald-800 via-emerald-700 to-slate-900 print:bg-emerald-800" />

            <div className="p-4 sm:p-7 space-y-5 text-xs leading-relaxed">
              {/* Bilingual Republic & Ministry Header */}
              <div className="border-b-2 border-slate-900 pb-4">
                <div className="text-center space-y-0.5 pb-3 border-b border-slate-200">
                  <p className="font-bold text-[13px] sm:text-sm text-slate-950 tracking-wide" dir="rtl">
                    الجمهورية الجزائرية الديمقراطية الشعبية
                  </p>
                  <p className="font-black text-[11px] sm:text-xs tracking-[0.14em] text-slate-800 uppercase">
                    RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE
                  </p>
                  <p className="text-[11px] font-semibold text-slate-600 pt-0.5">
                    وزارة السياحة والصناعة التقليدية • المديرية العامة للأمن الوطني (DGSN)
                  </p>
                </div>

                {/* Hotel Identity + Official Document Box */}
                <div className="pt-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Establishment Identity */}
                  <div className="flex items-start gap-3 min-w-0">
                    {establishmentProfile.logoUrl ? (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={establishmentProfile.logoUrl}
                          alt={hotelName}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                        <Building2 size={22} />
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="font-black text-sm text-slate-950 uppercase tracking-tight break-words">
                          {hotelName}
                        </h2>
                        {establishmentProfile.stars > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-500">
                            {Array.from({ length: Math.min(5, establishmentProfile.stars) }).map(
                              (_, i) => (
                                <Star
                                  key={i}
                                  size={10}
                                  className="fill-amber-400 text-amber-400"
                                />
                              )
                            )}
                          </span>
                        )}
                      </div>
                      {(establishmentProfile.address || establishmentProfile.city) && (
                        <p className="text-[11px] text-slate-600 flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="break-words">
                            {[
                              establishmentProfile.address,
                              establishmentProfile.postalCode,
                              establishmentProfile.city,
                              establishmentProfile.region,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </p>
                      )}
                      {establishmentProfile.phone && (
                        <p className="text-[11px] text-slate-600 flex items-center gap-1">
                          <Phone size={11} className="text-slate-400 shrink-0" />
                          <span className="tabular-nums">{establishmentProfile.phone}</span>
                        </p>
                      )}
                      {(establishmentProfile.tradeRegisterNumber ||
                        establishmentProfile.taxNumber) && (
                        <p className="text-[10px] font-mono text-slate-500">
                          {[
                            establishmentProfile.tradeRegisterNumber
                              ? `RC: ${establishmentProfile.tradeRegisterNumber}`
                              : null,
                            establishmentProfile.taxNumber
                              ? `NIF: ${establishmentProfile.taxNumber}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Official Dossier Reference Box */}
                  <div className="sm:text-right border border-slate-300 rounded-xl bg-slate-50 px-3 py-2 shrink-0 space-y-1">
                    <div className="flex sm:justify-end items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-800 text-white font-black text-[10px] tracking-wider uppercase">
                        FICHE INDIVIDUELLE DE POLICE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      <span className="text-slate-500">N° Dossier :</span>{' '}
                      <strong className="font-mono text-slate-950 tabular-nums">
                        {folioRef}
                      </strong>
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      Éditée le {todayFormatted} ·{' '}
                      <span dir="rtl" className="font-semibold text-slate-700">
                        بطاقة الشرطة الفردية
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Formal Document Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                <div>
                  <h3 className="font-black text-xs sm:text-[13px] uppercase tracking-wider text-emerald-950">
                    DÉCLARATION DU SÉJOURNANT EN ÉTABLISSEMENT D'HÉBERGEMENT
                  </h3>
                  <p className="text-[11px] text-emerald-800 font-medium" dir="rtl">
                    تصريح بالإقامة في مؤسسة فندقية — خاص بالرقابة الأمنية والسياحية
                  </p>
                </div>
                <span
                  className={`self-start sm:self-center px-2.5 py-1 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                    guestType === 'algerian'
                      ? 'bg-white border-emerald-300 text-emerald-900'
                      : 'bg-slate-900 border-slate-900 text-white'
                  }`}
                >
                  {guestType === 'algerian'
                    ? '🇩🇿 Citoyen National'
                    : '🌐 Ressortissant Étranger'}
                </span>
              </div>

              {/* SECTION 01: Guest Identity & ID Document */}
              <section className="border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between gap-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <UserCheck size={13} className="text-emerald-400 shrink-0" />
                    <span>01 · Identité du Voyageur & Pièce Officielle</span>
                  </span>
                  <span className="text-[11px] text-slate-300 font-semibold" dir="rtl">
                    هوية النزيل ووثيقة الإثبات
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                  <div className="divide-y divide-slate-200">
                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        <span>Nom & Prénom</span>
                        <span dir="rtl">الاسم واللقب</span>
                      </div>
                      <p className="mt-0.5 font-extrabold text-sm text-slate-950 break-words">
                        {guestName.trim() || 'Non renseigné'}
                      </p>
                    </div>

                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        <span>Type de Pièce Officielle</span>
                        <span dir="rtl">نوع الوثيقة</span>
                      </div>
                      <p className="mt-0.5 font-bold text-slate-900 flex items-center gap-1.5">
                        <FileBadge2 size={13} className="text-emerald-700 shrink-0" />
                        <span>{idLabel}</span>
                      </p>
                    </div>

                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        <span>
                          {guestType === 'algerian'
                            ? 'Wilaya de Résidence'
                            : "N° Visa & Date d'Entrée"}
                        </span>
                        <span dir="rtl">
                          {guestType === 'algerian' ? 'ولاية الإقامة' : 'التأشيرة والدخول'}
                        </span>
                      </div>
                      {guestType === 'algerian' ? (
                        <p className="mt-0.5 font-bold text-slate-900 break-words">
                          {wilayaOfOrigin || '—'}
                        </p>
                      ) : (
                        <p className="mt-0.5 font-semibold text-slate-900 tabular-nums break-words">
                          Visa : <span className="font-mono font-bold">{visaNumber || '—'}</span>
                          {entryDateInCountry ? ` · Entrée : ${entryDateInCountry}` : ''}
                          {visaExpiryDate ? ` · Exp : ${visaExpiryDate}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200">
                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        <span>Nationalité</span>
                        <span dir="rtl">الجنسية</span>
                      </div>
                      <p className="mt-0.5 font-bold text-slate-900">
                        {guestType === 'algerian'
                          ? 'Algérienne (Citoyen National)'
                          : foreignNationality || 'Étrangère'}
                      </p>
                    </div>

                    <div className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        <span>N° Pièce d'Identité</span>
                        <span dir="rtl">رقم الوثيقة</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-black text-sm text-slate-950 tracking-wide break-all tabular-nums">
                          {effectiveDocNumber || 'Non renseigné'}
                        </span>
                        {idDocumentExpiryDate && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600 tabular-nums">
                            Exp: {idDocumentExpiryDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-3.5 py-2.5 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                          Téléphone / الهاتف
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums break-all">
                          {guestPhone.trim() || '—'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                          E-mail / البريد
                        </span>
                        <span className="font-medium text-slate-800 break-all">
                          {guestEmail.trim() || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {idPieceType === 'special_authorization' && (
                  <div className="border-t border-slate-200 bg-amber-50/70 px-3.5 py-2.5">
                    <span className="text-[10px] font-bold uppercase text-amber-900 block">
                      Descriptif Autorisation Spéciale / تفاصيل الترخيص الخاص :
                    </span>
                    <p className="text-slate-900 font-medium mt-0.5 break-words">
                      {specialAuthorizationDesc?.trim() || 'Non précisé'}
                    </p>
                  </div>
                )}
              </section>

              {/* SECTION 02: Stay & Co-occupants */}
              <section className="border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-white px-3.5 py-2 flex items-center justify-between gap-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Calendar size={13} className="text-sky-300 shrink-0" />
                    <span>02 · Modalités de Séjour & Occupants</span>
                  </span>
                  <span className="text-[11px] text-slate-300 font-semibold" dir="rtl">
                    تفاصيل الإقامة والمرافقون
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-slate-200">
                  <div className="px-3.5 py-2.5 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Chambre / الغرفة
                    </span>
                    <p className="font-extrabold text-slate-950 mt-0.5 break-words">
                      {currentResource?.name || 'Chambre'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {currentResource?.type || 'Hébergement'}
                    </p>
                  </div>

                  <div className="px-3.5 py-2.5">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Arrivée / الوصول
                    </span>
                    <p className="font-bold text-slate-950 mt-0.5 tabular-nums">{startDate}</p>
                    <p className="text-[10px] text-slate-500 tabular-nums">{checkInTime}</p>
                  </div>

                  <div className="px-3.5 py-2.5">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Départ / المغادرة
                    </span>
                    <p className="font-bold text-slate-950 mt-0.5 tabular-nums">
                      {endDate || startDate}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">{checkOutTime}</p>
                  </div>

                  <div className="px-3.5 py-2.5 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Effectif & Durée
                    </span>
                    <p className="font-bold text-slate-950 mt-0.5 tabular-nums">
                      {activeDomain === 'hotel'
                        ? `${hotelAdults} ad.${hotelChildren > 0 ? ` + ${hotelChildren} enf.` : ''}`
                        : `${resortOccupants} pers.`}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {calculatedDays} nuit(s)
                    </p>
                  </div>
                </div>

                {companions.length > 0 && (
                  <div className="border-t border-slate-200 bg-slate-50/80 px-3.5 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-600">
                      <span>Accompagnants Adultes Enregistrés ({companions.length})</span>
                      <span dir="rtl">المرافقون البالغون</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {companions.map((companion, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="font-bold text-slate-900 truncate">
                            {companion.fullName || `Adulte ${idx + 2}`}
                          </span>
                          <span className="font-mono text-slate-600 shrink-0 tabular-nums">
                            {companion.documentType?.toUpperCase()}:{' '}
                            {companion.documentNumber || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* SECTION 03: Payment Summary */}
              <section className="border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between gap-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-amber-600 shrink-0" />
                    <span>03 · Règlement & Devises</span>
                  </span>
                  <span className="text-[11px] text-slate-600 font-semibold" dir="rtl">
                    التسوية والعملة
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-slate-200">
                  <div className="px-3.5 py-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Mode
                    </span>
                    <span className="font-bold text-slate-900">{paymentLabel}</span>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Devise
                    </span>
                    <span className="font-bold text-slate-900">
                      {paymentCurrency} ({currencySymbol})
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Montant Facturé
                    </span>
                    <span className="font-extrabold text-slate-950 tabular-nums">
                      {priceInPaymentCurrency.toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 bg-emerald-50/50">
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold block">
                      Contre-valeur DZD
                    </span>
                    <span className="font-black text-emerald-800 tabular-nums">
                      {priceInDzd.toLocaleString()} DA
                    </span>
                  </div>
                </div>
              </section>

              {/* SECTION 04: Official Signatures & Hotel Stamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="min-h-24 rounded-xl border border-slate-300 bg-slate-50/40 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-700">
                    <span>Signature du Séjournant</span>
                    <span dir="rtl">إمضاء النزيل</span>
                  </div>
                  <div className="border-b border-dotted border-slate-400 my-3" />
                  <span className="text-[10px] text-slate-500 italic">
                    Mention « Lu et approuvé » — قُرِئ وصُودِق عليه
                  </span>
                </div>

                <div className="min-h-24 rounded-xl border border-slate-300 bg-slate-50/40 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-700">
                    <span>Cachet & Visa Réception</span>
                    <span dir="rtl">خاتم المؤسسة وتأشيرة الاستقبال</span>
                  </div>
                  <div className="border-b border-dotted border-slate-400 my-3" />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate font-semibold text-slate-700">{hotelName}</span>
                    <span className="tabular-nums shrink-0">{todayFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Legal Regulatory Footer */}
              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-slate-500">
                <span>
                  Document conforme au Décret exécutif n° 08-364 relatif aux établissements
                  hôteliers.
                </span>
                <span className="font-mono">Réf. {folioRef}</span>
              </div>
            </div>
          </article>
        </div>

        {/* Sticky Responsive Action Footer (hidden when printing) */}
        <footer className="print:hidden px-3.5 sm:px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 min-w-0">
            {missingFields.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>
                  {language === 'ar'
                    ? 'البطاقة مكتملة وجاهزة للطباعة'
                    : language === 'en'
                    ? 'Sheet complete and ready to print'
                    : 'Fiche complète et prête à imprimer'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="truncate">
                  {language === 'ar'
                    ? `ينقص: ${missingFields.join('، ')}`
                    : language === 'en'
                    ? `Missing: ${missingFields.join(', ')}`
                    : `À compléter : ${missingFields.join(', ')}`}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-col-reverse min-[360px]:flex-row items-stretch min-[360px]:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
            >
              {language === 'ar' ? 'إغلاق' : language === 'en' ? 'Close' : 'Fermer'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-11 px-5 py-2 bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Printer size={15} />
              <span>
                {language === 'ar'
                  ? 'طباعة / حفظ PDF'
                  : language === 'en'
                  ? 'Print / Save PDF'
                  : 'Imprimer / PDF'}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};
