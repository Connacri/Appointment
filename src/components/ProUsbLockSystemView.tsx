import React, { useState, useEffect } from 'react';
import {
  Usb,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Volume2,
  ShieldCheck,
  CreditCard,
  DoorClosed,
  Clock,
  Sparkles,
  Search,
  Filter,
  Trash2,
  Radio,
  FileCheck,
} from 'lucide-react';
import {
  lockManager,
  UsbConnectionStatus,
  UsbDeviceInfo,
  IssuedLockCard,
} from '../locks/lockManager';
import { useApp } from '../context/AppContext';

export const ProUsbLockSystemView: React.FC = () => {
  const { resourceGroups, bookings, language } = useApp();
  const [status, setStatus] = useState<UsbConnectionStatus>(lockManager.getStatus());
  const [device, setDevice] = useState<UsbDeviceInfo | null>(lockManager.getDeviceInfo());
  const [cards, setCards] = useState<IssuedLockCard[]>(lockManager.getCards());
  const [isInitializing, setIsInitializing] = useState(false);
  const [hardwareFeedback, setHardwareFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Form states for manual card issuance
  const [selectedRoom, setSelectedRoom] = useState<string>('CV-101');
  const [guestName, setGuestName] = useState<string>('M. Amine Mansouri');
  const [validFromDate, setValidFromDate] = useState<string>(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [validUntilDate, setValidUntilDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().substring(0, 10);
  });
  const [cardType, setCardType] = useState<'guest' | 'staff' | 'master'>('guest');
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to WebHID changes and cards updates
  useEffect(() => {
    const unsubConn = lockManager.subscribeConnection((newStatus, newDev) => {
      setStatus(newStatus);
      setDevice(newDev);
    });
    const unsubCards = lockManager.subscribeCards((updatedCards) => {
      setCards(updatedCards);
    });
    return () => {
      unsubConn();
      unsubCards();
    };
  }, []);

  // Handle Hardware Initialization with navigator.hid.requestDevice
  const handleInitializeHardware = async () => {
    setIsInitializing(true);
    setHardwareFeedback(null);
    try {
      const res = await lockManager.initializeHardware();
      if (res.success) {
        setHardwareFeedback({ type: 'success', text: res.message });
      } else {
        setHardwareFeedback({ type: 'error', text: res.message });
      }
    } catch (e: any) {
      setHardwareFeedback({
        type: 'error',
        text: e.message || 'Échec de communication avec le périphérique USB.',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleDisconnectHardware = async () => {
    await lockManager.disconnectHardware();
    setHardwareFeedback({
      type: 'info',
      text: 'Encodeur ProUSB déconnecté manuellement.',
    });
  };

  const handleTestBeep = async () => {
    await lockManager.sendEncoderBeep();
    setHardwareFeedback({
      type: 'success',
      text: 'Signal sonore (Beep) & LED transmis avec succès à l’encodeur ProUSB !',
    });
  };

  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      const newCard = await lockManager.issueGuestCard({
        roomNumber: selectedRoom,
        guestName,
        validFrom: `${validFromDate} 14:00`,
        validUntil: `${validUntilDate} 12:00`,
        issuedBy: 'Front Desk PMS',
      });
      setHardwareFeedback({
        type: 'success',
        text: `Carte RFID N° ${newCard.cardNumber} gravée et associée à la chambre ${selectedRoom} pour ${guestName}.`,
      });
    } catch (err: any) {
      setHardwareFeedback({
        type: 'error',
        text: err.message || 'Erreur lors de la programmation de la carte.',
      });
    }
  };

  const handleRevokeCard = (cardId: string) => {
    lockManager.revokeCard(cardId);
    setHardwareFeedback({
      type: 'info',
      text: 'La carte RFID sélectionnée a été révoquée immédiatement.',
    });
  };

  // Filter cards by search
  const filteredCards = cards.filter(
    (c) =>
      c.guestName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.cardNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-6">
      {/* Top Banner: WebHID Hardware Status & Prominent 'Initialize Hardware' Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                status === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : status === 'connecting'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Usb size={24} />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  Gestionnaire Serrures & Encodeur ProUSB (WebHID)
                </h1>

                {/* Connection Status Pill */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    status === 'connected'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : status === 'connecting'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      status === 'connected'
                        ? 'bg-emerald-500'
                        : status === 'connecting'
                        ? 'bg-blue-500 animate-ping'
                        : 'bg-rose-500'
                    }`}
                  />
                  {status === 'connected'
                    ? 'Connecté (Hardware Actif)'
                    : status === 'connecting'
                    ? 'Connexion en cours...'
                    : status === 'unsupported'
                    ? 'WebHID non supporté'
                    : 'Déconnecté'}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pilote direct de communication USB matériel pour encodeurs de serrures d’hôtel ProUSB / Mifare / IC Card sans logiciel tiers.
              </p>

              {device && status === 'connected' && (
                <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 font-mono mt-2 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 w-fit">
                  <span><strong>Modèle :</strong> {device.productName}</span>
                  <span>·</span>
                  <span><strong>VID/PID :</strong> 0x{device.vendorId.toString(16).toUpperCase()} / 0x{device.productId.toString(16).toUpperCase()}</span>
                  <span>·</span>
                  <span><strong>Port :</strong> Ouvert</span>
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs: Prominent Initialize Hardware Button */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {status !== 'connected' ? (
              <button
                onClick={handleInitializeHardware}
                disabled={isInitializing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                title="Déclenche la boîte de dialogue native du navigateur pour autoriser l'accès au port USB"
              >
                {isInitializing ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    <span>Demande d'autorisation USB...</span>
                  </>
                ) : (
                  <>
                    <Usb size={17} />
                    <span>Initialize Hardware (Demande USB WebHID)</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTestBeep}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Envoyer un signal sonore de test à l'encodeur"
                >
                  <Volume2 size={15} />
                  <span>Tester Beep</span>
                </button>

                <button
                  onClick={handleDisconnectHardware}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                >
                  <span>Déconnecter</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feedback message banner if present */}
        {hardwareFeedback && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in duration-200 ${
              hardwareFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : hardwareFeedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
            }`}
          >
            {hardwareFeedback.type === 'success' && <CheckCircle2 size={16} className="shrink-0" />}
            {hardwareFeedback.type === 'error' && <AlertTriangle size={16} className="shrink-0" />}
            {hardwareFeedback.type === 'info' && <Radio size={16} className="shrink-0" />}
            <span>{hardwareFeedback.text}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Card Encoding Station + Issued Cards Database */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Gravure de Carte RFID */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <CreditCard size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Graver une Nouvelle Carte ProUSB
            </h2>
          </div>

          <form onSubmit={handleIssueCard} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Type de Carte :
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['guest', 'staff', 'master'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCardType(t)}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition-colors capitalize ${
                      cardType === t
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t === 'guest' ? 'Client' : t === 'staff' ? 'Personnel' : 'Passe-Partout'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Chambre / Ressource Assignée :
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full h-9 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {resourceGroups.map((g) =>
                  g.resources.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({typeof g.name === 'string' ? g.name : g.name[language] || g.name.fr})
                    </option>
                  ))
                )}
                <option value="Tous les étages">Tous les étages (Master)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Nom du Client / Porteur :
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ex: Karim Benali"
                className="w-full h-9 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Valide du :
                </label>
                <input
                  type="date"
                  value={validFromDate}
                  onChange={(e) => setValidFromDate(e.target.value)}
                  className="w-full h-9 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Jusqu'au (Check-out) :
                </label>
                <input
                  type="date"
                  value={validUntilDate}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  className="w-full h-9 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound size={16} />
              <span>Graver la Carte RFID / Mifare</span>
            </button>
          </form>

          {/* Quick Info Box */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">
              💡 Protocole ProUSB Intégré :
            </span>
            <p>
              L’encodeur encode le secteur 4 des puces Mifare Classic 1K avec le code bâtiment, numéro de chambre et clé de chiffrement temporaire.
            </p>
          </div>
        </div>

        {/* Right Column (2 spans): Registered Cards Database */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Cartes ProUSB Actives & Journal d’Accès
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-xs font-semibold">
                {cards.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par chambre, client..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cards Table */}
          <div className="flex-1 overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-2 px-3">UID Carte</th>
                  <th className="py-2 px-3">Chambre</th>
                  <th className="py-2 px-3">Titulaire</th>
                  <th className="py-2 px-3">Validité</th>
                  <th className="py-2 px-3">Statut</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucune carte trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredCards.map((card) => (
                    <tr
                      key={card.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {card.cardNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                        {card.roomNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {card.guestName || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {card.validUntil}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            card.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {card.status === 'active' ? 'Active' : 'Révoquée'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {card.status === 'active' && (
                          <button
                            onClick={() => handleRevokeCard(card.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded"
                            title="Révoquer / Désactiver la carte"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
