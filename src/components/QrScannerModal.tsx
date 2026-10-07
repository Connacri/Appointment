import React, { useState } from 'react';
import {
  X,
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Receipt,
  User,
  ShieldCheck,
  Sparkles,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TimelineBooking } from '../types/booking';
import { statusConfig } from './LegendBar';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose }) => {
  const { language, bookings, confirmCheckInAndCashPayment } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScannedBooking, setSelectedScannedBooking] = useState<TimelineBooking | null>(null);
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);
  const [cashAmountReceived, setCashAmountReceived] = useState<number>(0);
  const [successReceipt, setSuccessReceipt] = useState<{
    booking: TimelineBooking;
    cashSettled: boolean;
    changeGiven: number;
    timestamp: string;
  } | null>(null);

  if (!isOpen) return null;

  // Filter bookings to help staff find or select a guest presenting their QR Pass
  const pendingArrivals = bookings.filter((b) => b.status !== 'checked_out' && b.status !== 'cancelled');
  const searchResults = searchQuery.trim()
    ? pendingArrivals.filter(
        (b) =>
          b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.resourceName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingArrivals;

  const handleSimulateCameraScan = (bkg: TimelineBooking) => {
    setIsScanningSimulated(true);
    setTimeout(() => {
      setSelectedScannedBooking(bkg);
      setCashAmountReceived(bkg.totalPrice || 0);
      setIsScanningSimulated(false);
      setSuccessReceipt(null);
    }, 600);
  };

  const handleValidateCheckIn = () => {
    if (!selectedScannedBooking) return;

    const isCashPending = selectedScannedBooking.paymentStatus === 'pending' && selectedScannedBooking.totalPrice > 0;
    const res = confirmCheckInAndCashPayment(selectedScannedBooking.id, isCashPending);

    const change = Math.max(0, cashAmountReceived - selectedScannedBooking.totalPrice);
    setSuccessReceipt({
      booking: res.booking || selectedScannedBooking,
      cashSettled: isCashPending,
      changeGiven: change,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    setSelectedScannedBooking(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {language === 'fr'
                  ? 'Scanner d\'Arrivée & Contrôle QR Code'
                  : language === 'ar'
                  ? 'ماسح رمز QR لتأكيد الحضور'
                  : 'QR Check-in & Arrival Scanner'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'fr'
                  ? 'Validation de présence et encaissement des règlements cash au comptoir'
                  : 'Validate client presence and finalize cash payments upon arrival'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Success Receipt View */}
          {successReceipt && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span>Enregistrement & Check-in Confirmé !</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Client :</span>
                  <span className="font-bold text-slate-900 dark:text-white">{successReceipt.booking.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ressource :</span>
                  <span className="text-slate-800 dark:text-slate-200">{successReceipt.booking.resourceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Heure de validation :</span>
                  <span className="text-slate-800 dark:text-slate-200">{successReceipt.timestamp}</span>
                </div>
                {successReceipt.cashSettled && (
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex justify-between text-emerald-600 font-bold">
                    <span>Espèces encaissées :</span>
                    <span>{successReceipt.booking.totalPrice} € (Monnaie : {successReceipt.changeGiven} €)</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSuccessReceipt(null)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
              >
                Scanner un autre client
              </button>
            </div>
          )}

          {/* Active Scanned Client Card */}
          {selectedScannedBooking && (
            <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-blue-600" />
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {selectedScannedBooking.guestName}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                  {selectedScannedBooking.id}
                </span>
              </div>

              <div className="text-slate-600 dark:text-slate-300 space-y-1 text-xs">
                <p>
                  <strong>Ressource :</strong> {selectedScannedBooking.resourceName} ({selectedScannedBooking.sector})
                </p>
                <p>
                  <strong>Dates :</strong> {selectedScannedBooking.startDate} au {selectedScannedBooking.endDate}
                </p>
              </div>

              {/* Cash payment handling */}
              {selectedScannedBooking.paymentStatus === 'pending' && selectedScannedBooking.totalPrice > 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                    <span className="flex items-center gap-1.5">
                      <Banknote size={15} />
                      <span>Montant Cash à Encaisser :</span>
                    </span>
                    <span className="text-base font-black">{selectedScannedBooking.totalPrice} €</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-0.5">Espèces reçues (€)</label>
                      <input
                        type="number"
                        min={selectedScannedBooking.totalPrice}
                        value={cashAmountReceived}
                        onChange={(e) => setCashAmountReceived(Number(e.target.value))}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-0.5">Monnaie rendue</label>
                      <div className="h-8 px-2 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 rounded-lg font-bold flex items-center text-emerald-800 dark:text-emerald-300">
                        {Math.max(0, cashAmountReceived - selectedScannedBooking.totalPrice)} €
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <ShieldCheck size={16} />
                  <span>Dossier déjà entièrement payé en ligne (0 € dû)</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedScannedBooking(null)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleValidateCheckIn}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Valider la Présence & Finaliser l'Entrée</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanner Simulation Zone */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col items-center justify-center min-h-[140px] text-center">
            <div className="absolute inset-0 bg-radial from-blue-500/10 via-transparent to-transparent pointer-events-none" />
            <QrCode size={36} className={`text-blue-400 mb-2 ${isScanningSimulated ? 'animate-bounce' : ''}`} />
            <h4 className="font-bold text-sm text-white">
              {isScanningSimulated ? 'Décodage du QR Code client...' : 'Lecteur Optique & Caméra Prêt'}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-xs mt-1">
              Pointez la caméra vers le smartphone du client ou sélectionnez un dossier ci-dessous pour simuler le scan instantané.
            </p>
          </div>

          {/* Quick Search & Client List */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom client, ID réservation ou chambre/médecin..."
                className="w-full h-8 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {searchResults.slice(0, 6).map((bkg) => (
                <div
                  key={bkg.id}
                  onClick={() => handleSimulateCameraScan(bkg)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-850 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      {bkg.guestName.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block leading-tight">
                        {bkg.guestName}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {bkg.resourceName} • {bkg.startDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {bkg.paymentStatus === 'pending' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Cash {bkg.totalPrice}€
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Payé
                      </span>
                    )}
                    <span className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
