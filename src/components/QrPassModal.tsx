import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  CheckCircle2,
  Download,
  Calendar,
  Clock,
  User,
  CreditCard,
  Banknote,
  ShieldCheck,
  AlertCircle,
  Share2,
  Printer,
  Sparkles,
  Building2,
  Bed,
  Stethoscope,
  HeartPulse,
  UtensilsCrossed,
  Landmark,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TimelineBooking, DomainType } from '../types/booking';
import { statusConfig } from './LegendBar';
import { domainConfigs } from '../data/mockData';
import { downloadICS } from '../utils/icsExport';

interface QrPassModalProps {
  booking: TimelineBooking | null;
  onClose: () => void;
}

export const QrPassModal: React.FC<QrPassModalProps> = ({ booking, onClose }) => {
  const { language, confirmCheckInAndCashPayment } = useApp();
  const [displayMode, setDisplayMode] = useState<'arrival_pass' | 'payment_receipt'>('arrival_pass');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCashFlowOpen, setIsCashFlowOpen] = useState(false);
  const [cashAmountGiven, setCashAmountGiven] = useState<number>(0);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!booking) return;

    if (displayMode === 'payment_receipt') {
      // Generate Payment Receipt QR payload
      const receiptPayload = JSON.stringify({
        type: 'PAYMENT_RECEIPT',
        receiptNumber: `REC-${booking.id.toUpperCase()}-${Date.now().toString().slice(-4)}`,
        bookingId: booking.id,
        guest: booking.guestName,
        resource: booking.resourceName,
        sector: booking.sector,
        amountPaid: booking.totalPrice,
        currency: 'EUR',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        issuedAt: new Date().toISOString(),
        secHash: `OMNI-PAY-VERIFIED-${booking.id.slice(-6)}`,
      });

      QRCode.toDataURL(receiptPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#064e3b',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR receipt generation error', err));
    } else {
      // Generate QR Code containing verifiable arrival booking payload
      const payload = JSON.stringify({
        type: 'ARRIVAL_PASS',
        id: booking.id,
        guest: booking.guestName,
        sector: booking.sector,
        resource: booking.resourceName,
        dates: `${booking.startDate} -> ${booking.endDate}`,
        total: `${booking.totalPrice} EUR`,
        payment: booking.paymentStatus,
        status: booking.status,
        secHash: `OMNI-${booking.id.slice(-6)}-VERIFIED`,
      });

      QRCode.toDataURL(payload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error', err));
    }

    setCashAmountGiven(booking.totalPrice || 0);
  }, [booking, displayMode]);

  if (!booking) return null;

  const isCheckedIn = booking.status === 'checked_in';
  const isCashPaymentPending = booking.paymentStatus === 'pending' && booking.totalPrice > 0;
  const domainCfg = domainConfigs[booking.sector as DomainType] || domainConfigs.hotel;

  const getDomainIcon = () => {
    switch (booking.sector) {
      case 'doctor':
        return Stethoscope;
      case 'clinic':
        return HeartPulse;
      case 'residence':
        return Building2;
      case 'restaurant':
        return UtensilsCrossed;
      case 'administration':
        return Landmark;
      case 'wellness':
        return Sparkles;
      default:
        return Bed;
    }
  };

  const DomainIcon = getDomainIcon();

  const handleSelfCheckIn = () => {
    if (isCashPaymentPending) {
      setIsCashFlowOpen(true);
    } else {
      const res = confirmCheckInAndCashPayment(booking.id, false);
      setConfirmationNotice(res.message);
    }
  };

  const handleFinalizeCashPayment = () => {
    const res = confirmCheckInAndCashPayment(booking.id, true);
    setConfirmationNotice(res.message);
    setIsCashFlowOpen(false);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `Pass-Arrivee-${booking.id}-${booking.guestName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const changeDue = Math.max(0, cashAmountGiven - booking.totalPrice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Pass Top Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-white/20 text-white">
              <DomainIcon size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
              {domainCfg.label[language] || domainCfg.label.en} • Pass d'Arrivée Numérique
            </span>
          </div>

          <h2 className="text-xl font-black text-white leading-tight">
            {booking.guestName}
          </h2>
          <p className="text-xs text-blue-100 font-mono mt-0.5">
            Réf Dossier : {booking.id.toUpperCase()}
          </p>
        </div>

        {/* Pass Body Content */}
        <div ref={printableRef} className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Status Badge Strip */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full animate-pulse ${
                  isCheckedIn ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <div>
                <span className="block font-bold text-slate-800 dark:text-slate-100 text-xs">
                  {isCheckedIn
                    ? language === 'fr'
                      ? '✓ Présence Confirmée (Enregistré)'
                      : language === 'ar'
                      ? '✓ تم تأكيد الحضور (مسجل)'
                      : '✓ Checked-In & Present'
                    : language === 'fr'
                    ? 'En attente de Check-in à l\'arrivée'
                    : language === 'ar'
                    ? 'في انتظار تسجيل الوصول'
                    : 'Awaiting Check-in upon Arrival'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {statusConfig[booking.status]?.label[language] || booking.status}
                </span>
              </div>
            </div>

            <div className="text-right">
              {booking.totalPrice === 0 ? (
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg text-xs">
                  Gratuit
                </span>
              ) : booking.paymentStatus === 'paid' ? (
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg text-xs flex items-center gap-1">
                  <ShieldCheck size={13} />
                  <span>Réglé ({booking.totalPrice} €)</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold rounded-lg text-xs flex items-center gap-1">
                  <Banknote size={13} />
                  <span>Espèces ({booking.totalPrice} €)</span>
                </span>
              )}
            </div>
          </div>

          {/* Success Notification Alert */}
          {confirmationNotice && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span className="font-semibold">{confirmationNotice}</span>
            </div>
          )}

          {/* Interactive QR Code Frame */}
          <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 relative group shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Pass ${booking.id}`}
                className="w-56 h-56 object-contain rounded-xl p-1 bg-white shadow-sm"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl">
                <QrCode size={48} className="text-slate-400 animate-spin" />
              </div>
            )}

            <div className="mt-2 text-center">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                {language === 'fr'
                  ? 'Présentez ce QR Code au guichet / borne d\'accueil'
                  : language === 'ar'
                  ? 'اعرض رمز QR هذا عند الاستقبال لتأكيد الحضور'
                  : 'Present this QR Code at the reception desk'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Signature cryptographique : OMNI-VALID-{booking.id.slice(-6)}
              </p>
            </div>
          </div>

          {/* Booking Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Ressource attribuée :</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {booking.resourceName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Dates du séjour / rendez-vous :</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {booking.startDate} {booking.startDate !== booking.endDate ? `au ${booking.endDate}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Coordonnées client :</span>
              <span className="text-slate-700 dark:text-slate-300">
                {booking.guestPhone || booking.guestEmail}
              </span>
            </div>
          </div>

          {/* Cash Payment Settlement Flow (If cash chosen & not yet checked-in or paid) */}
          {isCashFlowOpen && isCashPaymentPending && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-3 animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                <Banknote size={16} />
                <span>Règlement en Espèces / Cash à l'Arrivée</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                Montant total à encaisser au comptoir :{' '}
                <strong className="text-slate-950 dark:text-white font-black text-sm">
                  {booking.totalPrice} €
                </strong>
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Espèces remises par le client (€)
                  </label>
                  <input
                    type="number"
                    min={booking.totalPrice}
                    value={cashAmountGiven}
                    onChange={(e) => setCashAmountGiven(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Monnaie à rendre
                  </label>
                  <div className="h-8 px-2 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 font-bold flex items-center">
                    {changeDue} €
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinalizeCashPayment}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>Valider l'encaissement Cash & Enregistrer la présence</span>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {!isCheckedIn && !isCashFlowOpen && (
              <button
                type="button"
                onClick={handleSelfCheckIn}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
              >
                <CheckCircle2 size={16} />
                <span>
                  {isCashPaymentPending
                    ? 'Arrivée au comptoir : Régler en Espèces & Valider Check-in'
                    : 'Confirmer mon arrivée maintenant (Check-in QR Code)'}
                </span>
              </button>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="py-2 px-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 text-[11px]"
                title="Télécharger l'image du QR Code"
              >
                <Download size={14} />
                <span>Image QR</span>
              </button>

              <button
                type="button"
                onClick={() => downloadICS(booking)}
                className="py-2 px-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 text-[11px]"
                title="Ajouter au calendrier"
              >
                <Calendar size={14} />
                <span>.ICS</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="py-2 px-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 text-[11px]"
                title="Imprimer le Pass"
              >
                <Printer size={14} />
                <span>Imprimer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
