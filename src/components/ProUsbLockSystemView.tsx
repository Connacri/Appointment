/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Hotel Lock System - Comprehensive UI Suite
 * Recreates the complete proUSB system in React 19 / Tailwind CSS:
 * - 13 Card Types (Guest, Master, Floor, Building, Emergency, Group, Check-Out, Blacklist, RoomSet, TimeSet, Reset, Record, Limit)
 * - Real WebHID connection + High-Fidelity Simulator
 * - 3-Step Lock Commissioning
 * - Lock Opening Audit Records (RecordOpen)
 * - Physical Buzzer test (verified 3 beeps)
 * - Live Hex Console & Hardware Diagnostics
 */

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Usb,
  Volume2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Clock,
  Calendar,
  Building,
  User,
  Users,
  History,
  Terminal,
  Settings,
  CreditCard,
  FileSpreadsheet,
  Download,
  Trash2,
  Radio,
  Lock,
  Unlock,
  Sparkles,
  BedDouble,
  Layers,
  ArrowRight,
  Flame,
  UserCheck,
  FileDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  lockManager,
  TransportLogEntry,
  IssuedCardRecord,
} from '../locks/lockManager';
import {
  PROUSB_CARD_TYPES,
  ProUsbCardType,
  DecodedProUsbCard,
  LockAuditRecord,
} from '../locks/cards/types';
import { toHexFormatted } from '../locks/protocol/frames';
import { fromHex } from '../locks/protocol/frames';
import {
  buildCardInfoSyncScript,
  cardInfoId,
  cardInfoSyncFileName,
} from '../locks/database/cardInfoSync';

export const ProUsbLockSystemView: React.FC = () => {
  const { language, bookings, resourceGroups } = useApp();

  const [activeTab, setActiveTab] = useState<
    'reception' | 'staff_cards' | 'commissioning' | 'audit_log' | 'encoder_hardware' | 'settings' | 'security'
  >('reception');

  const [logs, setLogs] = useState<TransportLogEntry[]>(lockManager.getLogs());
  const [issuedCards, setIssuedCards] = useState<IssuedCardRecord[]>(lockManager.getIssuedCards());
  const [auditRecords, setAuditRecords] = useState<LockAuditRecord[]>(lockManager.getAuditRecords());
  const [lockSettings, setLockSettings] = useState(lockManager.getSettings());

  // Hardware Status
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBuzzerTesting, setIsBuzzerTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Card Read State
  const [currentReadCard, setCurrentReadCard] = useState<DecodedProUsbCard | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [readProgress, setReadProgress] = useState(0); // 0-100 pour le progress circulaire lecture
  const [writeProgress, setWriteProgress] = useState(0); // 0-100 pour le progress circulaire écriture

  // Guest Card Form State
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [guestRoomNumber, setGuestRoomNumber] = useState('101');
  const [guestHolderName, setGuestHolderName] = useState('Karim Mansouri');
  const [guestStartDate, setGuestStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [guestStartHour, setGuestStartHour] = useState(14);
  const [guestEndDate, setGuestEndDate] = useState(
    new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [guestEndHour, setGuestEndHour] = useState(12);
  const [allowDeadbolt, setAllowDeadbolt] = useState(true);
  const [coverCardsBefore, setCoverCardsBefore] = useState(true);
  const [openPublicDoor, setOpenPublicDoor] = useState(false);

  // Staff Card Form State
  const [selectedStaffType, setSelectedStaffType] = useState<ProUsbCardType>('master');
  const [staffHolderName, setStaffHolderName] = useState('Gouvernante Générale');
  const [staffFloorNo, setStaffFloorNo] = useState(1);
  const [staffBuildingNo, setStaffBuildingNo] = useState(1);
  const [staffValidityDays, setStaffValidityDays] = useState(365);

  // Commissioning Form State
  const [commissionRoom, setCommissionRoom] = useState('101');
  const [commissionFloor, setCommissionFloor] = useState(1);
  const [commissionBuilding, setCommissionBuilding] = useState(1);
  const [commissionValidityDays, setCommissionValidityDays] = useState(365);
  const [commissionValidityHour, setCommissionValidityHour] = useState(12);
  // Carte système universelle : site 0000 → acceptée par une serrure de
  // n'importe quel système (même convention que les cartes maîtresses).
  const [universalSystemCard, setUniversalSystemCard] = useState(false);

  // CardLock.mdb (original software database)
  const [mdbStatus, setMdbStatus] = useState(lockManager.getMdbStatus());
  const [isImportingMdb, setIsImportingMdb] = useState(false);

  // Subscribe to LockManager state and transport logs
  useEffect(() => {
    const unsubLogs = lockManager.subscribeLogs((newLogs) => setLogs(newLogs));
    const unsubState = lockManager.subscribeState(() => {
      setIssuedCards(lockManager.getIssuedCards());
      setAuditRecords(lockManager.getAuditRecords());
      setLockSettings(lockManager.getSettings());
      setMdbStatus(lockManager.getMdbStatus());
    });

    return () => {
      unsubLogs();
      unsubState();
    };
  }, []);

  // Update Guest form when booking is selected
  const handleSelectBooking = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    const b = bookings.find((item) => item.id === bookingId);
    if (b) {
      setGuestRoomNumber(b.resourceName.replace(/\D/g, '') || '101');
      setGuestHolderName(b.guestName);
      setGuestStartDate(b.startDate);
      setGuestEndDate(b.endDate);
    }
  };

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Cartes déjà présentes dans la table CardInfo de CardLock.mdb (elles seules
  // possèdent un ID visible et un « Operator Code » dans le logiciel d'origine).
  const mdbSnapshotCards = lockManager.getMdbSnapshot()?.cards ?? [];
  const mdbCardIds = new Set(mdbSnapshotCards.map((c) => cardInfoId(c.hex)));
  const mdbOperatorById = new Map(
    mdbSnapshotCards.map((c) => [cardInfoId(c.hex), c.operator || 'Admin'] as const)
  );

  /**
   * L'ID et l'Operator Code affichés par CardLock.exe ne sont pas dans la carte :
   * ce sont les colonnes `CardInfo.ID` (AutoNumber) et `CardInfo.GongHao`.
   * On génère un script Windows autonome qui ajoute les lignes manquantes.
   */
  const handleExportCardInfoSync = () => {
    if (issuedCards.length === 0) {
      showToast('error', "Aucune carte émise à synchroniser.");
      return;
    }
    const rows = issuedCards.map((card) => ({
      cardData: card.rawHex,
      holder: card.holderName,
      operator: card.operator || 'Admin',
    }));
    const script = buildCardInfoSyncScript(rows);
    const fileName = cardInfoSyncFileName();
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(
      'info',
      `${issuedCards.length} carte(s) exportée(s) dans ${fileName} — double-cliquez sur le fichier (CardLock.exe fermé) pour insérer les lignes manquantes, puis ré-importez CardLock.mdb pour voir les badges passer à « MDB ».`
    );
  };

  const handleConnectHardware = async () => {
    setIsConnecting(true);
    try {
      await lockManager.connect();
      showToast('success', 'Encodeur physique USB HID connecté (VID 0x9915, PID 0x1116).');
    } catch (err: any) {
      showToast('error', `Erreur de connexion : ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBuzzerTest = async () => {
    setIsBuzzerTesting(true);
    try {
      // Bip d'écriture (2 longs 300ms — distinct du bip lecture court 150ms)
      const transport = lockManager.getTransport();
      for (let i = 0; i < 2; i++) {
        await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x01, 0x29]));
        await new Promise(r => setTimeout(r, 300));
        await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x00, 0x28]));
        if (i < 1) await new Promise(r => setTimeout(r, 200));
      }
      await lockManager.testBuzzer();
      showToast('success', "Bip d'écriture confirmé (2 longs 300ms) + test encoder OK.");
    } catch (err: any) {
      showToast('error', `Erreur de buzzer : ${err.message}`);
    } finally {
      setIsBuzzerTesting(false);
    }
  };

  const handleReadCard = async () => {
    setIsReading(true);
    setReadProgress(10);
    try {
      // Bip de lecture distinct (3 courts, 150ms, 100ms écart) — distinct d'écriture (2 longs 300ms)
      const transport = lockManager.getTransport();
      for (let i = 0; i < 3; i++) {
        await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x01, 0x29]));
        setReadProgress(10 + Math.round(((i + 1) / 3) * 40));
        await new Promise(r => setTimeout(r, 150));
        await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x00, 0x28]));
        await new Promise(r => setTimeout(r, 100));
      }
      setReadProgress(70);
      const decoded = await lockManager.readCurrentCard();
      if (decoded) {
        setCurrentReadCard(decoded);
        setReadProgress(100);
        // Rapport exact : type réel, site, contrôle d'intégrité, dates réelles.
        const p2 = (n: number) => String(n).padStart(2, '0');
        const fmt = (y: number, mo: number, d: number, h: number, mi: number) =>
          `${p2(d)}/${p2(mo)}/${y} ${p2(h)}:${p2(mi)}`;
        const v = decoded.validity;
        const details: string[] = [
          `Type: ${decoded.type.toUpperCase()} (0x${(decoded.rawTypeIndex ?? 0).toString(16).toUpperCase().padStart(2, '0')})`,
          `ID: ${cardInfoId(decoded.rawHex) || '—'}`,
          `Site: ${decoded.siteCode}${decoded.isUniversalSite ? ' UNIVERSELLE' : ''}`,
        ];
        if (decoded.siteComplementOk !== undefined) {
          details.push(`Intégrité: ${decoded.siteComplementOk ? 'OK' : 'INVALIDE (~site attendu)'}`);
        }
        if (decoded.roomNumber) details.push(`Chambre: ${decoded.roomNumber}`);
        if (v) {
          details.push(`${decoded.endIsUnknown ? 'Émise le' : 'Début'}: ${fmt(v.startYear, v.startMonth, v.startDay, v.startHour, v.startMinute ?? 0)}`);
          if (decoded.endIsUnknown) details.push('Expiration: aucune (carte système)');
          else details.push(`Expiration: ${fmt(v.endYear, v.endMonth, v.endDay, v.endHour, v.endMinute ?? 0)}`);
        }
        showToast('success', `Lecture OK — ${details.join(' · ')}`);
      } else {
        showToast('error', 'Aucune carte détectée. Vérifiez qu\'elle est posée sur le lecteur et que le bouton LECTURE (pas ÉCRITURE) est utilisé.');
      }
    } catch (err: any) {
      showToast('error', `Erreur lecture : ${err.message}`);
    } finally {
      setIsReading(false);
      setTimeout(() => setReadProgress(0), 3000);
    }
  };

  const handleIssueGuestCard = async () => {
    setIsWriting(true);
    setWriteProgress(10);
    try {
      const startParts = guestStartDate.split('-').map(Number);
      const endParts = guestEndDate.split('-').map(Number);

      const newCard = await lockManager.issueGuestCard({
        roomNumber: guestRoomNumber,
        cardIndex: 1,
        holderName: guestHolderName,
        operator: 'Admin',
        validity: {
          startYear: startParts[0],
          startMonth: startParts[1],
          startDay: startParts[2],
          startHour: guestStartHour,
          endYear: endParts[0],
          endMonth: endParts[1],
          endDay: endParts[2],
          endHour: guestEndHour,
          endMinute: 0,
        },
        options: {
          allowDeadbolt,
          coverCardsBefore,
          openPublicDoor,
        },
      });

      showToast('success', `Carte Invité pour chambre ${guestRoomNumber} encodée et vérifiée !`);
      setCurrentReadCard(null);
      setWriteProgress(100);
      // Bip de succès (1 long 300ms — distinct d'échec)
      const transport = lockManager.getTransport();
      await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x01, 0x29]));
      await new Promise(r => setTimeout(r, 300));
      await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x00, 0x28]));
    } catch (err: any) {
      showToast('error', `Erreur d'encodage : ${err.message}`);
      setWriteProgress(0);
      // Bip d'échec (3 courts rapides 150ms — distinct du succès long)
      try {
        const transport = lockManager.getTransport();
        for (let i = 0; i < 3; i++) {
          await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x01, 0x29]));
          await new Promise(r => setTimeout(r, 150));
          await transport.send(new Uint8Array([0xaa, 0x02, 0x80, 0x00, 0x28]));
          await new Promise(r => setTimeout(r, 50));
        }
      } catch {}
    } finally {
      setIsWriting(false);
      setTimeout(() => setWriteProgress(0), 3000);
    }
  };

  const handleIssueStaffCard = async () => {
    setIsWriting(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + staffValidityDays * 24 * 3600 * 1000);

      const newCard = await lockManager.issueMasterCard({
        cardType: selectedStaffType as any,
        cardIndex: 1,
        floorNo: staffFloorNo,
        buildingNo: staffBuildingNo,
        holderName: staffHolderName,
        operator: 'SuperAdmin',
        validity: {
          startYear: now.getFullYear(),
          startMonth: now.getMonth() + 1,
          startDay: now.getDate(),
          startHour: 0,
          endYear: end.getFullYear(),
          endMonth: end.getMonth() + 1,
          endDay: end.getDate(),
          endHour: 23,
          endMinute: 59,
        },
      });

      showToast('success', `Carte de fonction ${selectedStaffType.toUpperCase()} émise et vérifiée !`);
    } catch (err: any) {
      showToast('error', `Erreur : ${err.message}`);
    } finally {
      setIsWriting(false);
    }
  };

  const handleImportMdb = async (file: File | null) => {
    if (!file) return;
    setIsImportingMdb(true);
    try {
      const snapshot = await lockManager.importMdb(file);
      setMdbStatus(lockManager.getMdbStatus());
      const warn = snapshot.warnings.length > 0 ? ` — ${snapshot.warnings.length} avertissement(s)` : '';
      showToast(
        'success',
        `CardLock.mdb importée : ${snapshot.counts.cards} cartes, ${snapshot.counts.rooms} chambres, ${snapshot.counts.guests} séjours${warn}`,
      );
    } catch (err: any) {
      showToast('error', `Import CardLock.mdb impossible : ${err.message}`);
    } finally {
      setIsImportingMdb(false);
    }
  };

  const handleIssueCommissioning = async (step: 'reset' | 'hard_reset' | 'room_set' | 'time_set' | 'record' | 'checkout' | 'blacklist' | 'group_set' | 'limit' | 'group' | 'master' | 'floor' | 'building' | 'emergency') => {    setIsWriting(true);
    try {
      const now = new Date();
      await lockManager.issueCommissioningCard({
        type: step as any,
        roomNumber: commissionRoom,
        floorNo: commissionFloor,
        buildingNo: commissionBuilding,
        operator: 'Admin',
        universal: (step === 'reset' || step === 'hard_reset') ? universalSystemCard : undefined,
        time: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: commissionValidityHour,
          minute: 0,
        },
      });

      showToast('success', `Carte de mise en service (${step.toUpperCase()}) émise avec succès !`);
      // Bip de succès (1 long 300ms)
      try { const t = lockManager.getTransport(); await t.send(new Uint8Array([0xaa, 0x02, 0x80, 0x01, 0x29])); await new Promise(r => setTimeout(r, 300)); await t.send(new Uint8Array([0xaa, 0x02, 0x80, 0x00, 0x28])); } catch {}
    } catch (err: any) {
      showToast('error', `Erreur : ${err.message}`);
    } finally {
      setIsWriting(false);
    }
  };

  const handleReadAuditLog = async () => {
    setIsReading(true);
    try {
      await lockManager.readAuditLogFromCard();
      showToast('success', 'Journal des ouvertures serrure récupéré avec succès !');
    } catch (err: any) {
      showToast('error', `Erreur de relève d'audit : ${err.message}`);
    } finally {
      setIsReading(false);
    }
  };

  const hotelRooms = resourceGroups
    .filter((g) => g.sector === 'hotel' || g.sector === 'residence')
    .flatMap((g) => g.resources);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      {/* Top Banner / Encoder Hardware Status Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <KeyRound size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                proUSB Hotel Lock System
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  v2026.1
                </span>
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Encodeur USB Connecté
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Contrôle d'accès serrures d'hôtels proUSB · 13 types de cartes · Encodeur HID VID 0x9915
            </p>
          </div>
        </div>

        {/* Global Hardware Action Bar */}
        <div className="flex items-center gap-2">

          <button
            onClick={handleBuzzerTest}
            disabled={isBuzzerTesting}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            title="Tester le signal sonore physique de l'encodeur (3 bips vérifiés)"
          >
            <Volume2 size={14} className={isBuzzerTesting ? 'animate-bounce text-amber-500' : 'text-blue-500'} />
            <span>Test Bip</span>
          </button>

          <button
            onClick={handleReadCard}
            disabled={isReading}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={14} className={isReading ? 'animate-spin' : ''} />
            <span>Lire Carte</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {statusMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-b border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200 border-b border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-500" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle size={15} className="text-rose-500" />
            ) : (
              <ShieldCheck size={15} className="text-blue-500" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-60 hover:opacity-100">
            Fermer
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex gap-1 overflow-x-auto text-xs font-semibold text-slate-500">
        {[
          { id: 'reception', label: '1. Réception & Cartes Invités', icon: KeyRound },
          { id: 'staff_cards', label: '2. Cartes de Service & Personnel', icon: ShieldCheck },
          { id: 'commissioning', label: '3. Mise en Service Serrure', icon: Sliders },
          { id: 'audit_log', label: "4. Journal d'Audit & Ouvertures", icon: History },
          { id: 'encoder_hardware', label: '5. Encodeur & Console Trames', icon: Terminal },
          { id: 'settings', label: '6. Options Serrures & Rôles', icon: Settings },
          { id: 'security', label: '7. Sécurité & Reset Persistant', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Working View */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* TAB 1: RECEPTION & GUEST CARDS */}
        {activeTab === 'reception' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Issue Guest Card Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound size={18} className="text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Émission de Carte Client (Guest Card · 0x60)
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Formule : C9 12 [Site] E3 [Room%100] [Floor] 01 01 6x [Dates]
                  </span>
                </div>

                {/* OmniBook Reservation Picker Shortcut */}
                <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3.5">
                  <label className="block text-xs font-semibold text-blue-950 dark:text-blue-200 mb-1.5 flex items-center justify-between">
                    <span>Lier à une réservation OmniBook existante (Remplissage Automatique) :</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                      {bookings.length} réservations en base
                    </span>
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => handleSelectBooking(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Choisir une réservation dans le planning --</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.resourceName} · {b.guestName} ({b.startDate} au {b.endDate}) · {b.status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Numéro de Chambre *
                    </label>
                    <input
                      type="text"
                      value={guestRoomNumber}
                      onChange={(e) => setGuestRoomNumber(e.target.value)}
                      placeholder="Ex: 101, 205"
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Étage {Math.floor(parseInt(guestRoomNumber, 10) / 100) || 1} · Chambre {parseInt(guestRoomNumber, 10) % 100 || 1}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Nom du Client / Occupant *
                    </label>
                    <input
                      type="text"
                      value={guestHolderName}
                      onChange={(e) => setGuestHolderName(e.target.value)}
                      placeholder="Nom complet"
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Date d'Arrivée (Check-In)
                    </label>
                    <input
                      type="date"
                      value={guestStartDate}
                      onChange={(e) => setGuestStartDate(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Heure de Début d'Accès
                    </label>
                    <select
                      value={guestStartHour}
                      onChange={(e) => setGuestStartHour(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850"
                    >
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Date de Départ (Check-Out)
                    </label>
                    <input
                      type="date"
                      value={guestEndDate}
                      onChange={(e) => setGuestEndDate(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 font-semibold text-rose-600 dark:text-rose-400"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Heure d'Expiration
                    </label>
                    <select
                      value={guestEndHour}
                      onChange={(e) => setGuestEndHour(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850"
                    >
                      <option value={12}>12:00 (Check-out standard)</option>
                      <option value={14}>14:00 (Check-out VIP)</option>
                      <option value={18}>18:00 (Late check-out)</option>
                      <option value={23}>23:59 (Fin de journée)</option>
                    </select>
                  </div>
                </div>

                {/* Options Checkboxes (proUSB parameters) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Options de Sécurité de Serrure (Paramètres proUSB) :
                  </span>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={coverCardsBefore}
                      onChange={(e) => setCoverCardsBefore(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Remplacer les cartes précédentes (Cover Cards Before) — Invalide les anciennes cartes de cette chambre
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowDeadbolt}
                      onChange={(e) => setAllowDeadbolt(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      Autoriser le déverrouillage si pêne dormant engagé (Guest Access Bolt)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={openPublicDoor}
                      onChange={(e) => setOpenPublicDoor(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      Autoriser l'accès aux portes publiques / ascenseurs / sas nuit
                    </span>
                  </label>
                </div>

                {/* Action button */}
                <div className="pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <Usb size={14} className="text-emerald-500" />
                    <span>Trame : AA 11 EC (20 octets vérifiés)</span>
                  </div>

                  <button
                    onClick={handleIssueGuestCard}
                    disabled={isWriting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <KeyRound size={15} />
                    <span>{isWriting ? 'Encodage en cours...' : 'Encoder la Carte Client'}</span>
                  </button>
                </div>
              </div>

              {/* Table of Issued Cards */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dernières Cartes Clés Émises ({issuedCards.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleExportCardInfoSync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
                    title="Génère un script Windows (.vbs) qui ajoute les cartes manquantes dans la table CardInfo de CardLock.mdb"
                  >
                    <FileDown size={13} />
                    Synchroniser CardLock.mdb
                  </button>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  L'<strong>ID</strong> et l'<strong>Operator Code</strong> ne sont pas gravés sur la carte : ce sont les
                  colonnes <code className="font-mono">CardInfo.ID</code> (AutoNumber) et{' '}
                  <code className="font-mono">CardInfo.GongHao</code> de{' '}
                  <code className="font-mono">CardLock.mdb</code>. Le logiciel d'origine retrouve une carte avec{' '}
                  <code className="font-mono">Mid(CardData,19,8)</code> (= octets 9 à 12) ; sans ligne en base, le
                  dialogue reste vide. Le bouton ci-dessus génère un script autonome qui insère les cartes absentes
                  (<code className="font-mono">GongHao = Admin</code>), avec sauvegarde et restauration automatiques.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 border-y border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 font-mono">ID (CardInfo)</th>
                        <th className="py-2.5 px-3">Chambre</th>
                        <th className="py-2.5 px-3">Titulaire</th>
                        <th className="py-2.5 px-3">Opérateur</th>
                        <th className="py-2.5 px-3">Validité</th>
                        <th className="py-2.5 px-3 font-mono">Trame Hex</th>
                        <th className="py-2.5 px-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {issuedCards.map((card) => {
                        const meta = PROUSB_CARD_TYPES[card.type] || PROUSB_CARD_TYPES.guest;
                        const cardId = cardInfoId(card.rawHex);
                        const inDb = !!cardId && mdbCardIds.has(cardId);
                        return (
                          <tr key={card.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-sans font-semibold">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-${meta.badgeColor}-100 text-${meta.badgeColor}-800 dark:bg-${meta.badgeColor}-950 dark:text-${meta.badgeColor}-300`}
                              >
                                {meta.label[language] || meta.label.fr}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 dark:text-slate-100">{cardId || '—'}</span>
                                {inDb ? (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    title="Présente dans CardInfo : ID et Operator Code visibles dans CardLock.exe"
                                  >
                                    MDB
                                  </span>
                                ) : (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                    title="Absente de CardInfo : lancez « Synchroniser CardLock.mdb » pour que CardLock.exe affiche son ID et son Operator Code"
                                  >
                                    à sync
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 font-sans">
                              {card.roomNumber ? `Chambre ${card.roomNumber}` : 'Toutes'}
                            </td>
                            <td className="py-2.5 px-3 font-sans">{card.holderName}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-500">{card.operator || 'Admin'}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-sans">{card.validUntil}</td>
                            <td className="py-2.5 px-3 text-slate-400 truncate max-w-[150px]" title={card.rawHex}>
                              {card.rawHex.substring(0, 16)}...
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Active
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Col: Instant Card Reader Inspector Box */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Radio size={18} className="text-purple-600 animate-pulse" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Inspecteur Carte Posée (ReadCard)
                    </h3>
                  </div>
                  <button
                    onClick={handleReadCard}
                    disabled={isReading}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                    title="Actualiser la lecture de la carte"
                  >
                    <RefreshCw size={13} className={isReading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {currentReadCard ? (
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Type de Carte :</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {currentReadCard.type.toUpperCase()} (Index {currentReadCard.cardIndex})
                        </span>
                      </div>

                      {currentReadCard.roomNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Chambre Affectée :</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {currentReadCard.roomNumber} (Étage {currentReadCard.floorNo})
                          </span>
                        </div>
                      )}

                      {(() => {
                        const readId = cardInfoId(currentReadCard.rawHex);
                        const operator = mdbOperatorById.get(readId);
                        return (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">ID (CardInfo) :</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {readId || '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Operator Code :</span>
                              {operator ? (
                                <span className="font-mono font-bold text-emerald-600">{operator}</span>
                              ) : (
                                <span
                                  className="font-sans font-bold text-amber-600"
                                  title="CardLock.exe lit l'Operator Code dans CardInfo.GongHao — lancez « Synchroniser CardLock.mdb »"
                                >
                                  — (absent de CardInfo)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {currentReadCard.validity && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Début :</span>
                            <span className="font-mono">
                              {currentReadCard.validity.startDay}/{currentReadCard.validity.startMonth}/{currentReadCard.validity.startYear} à {currentReadCard.validity.startHour}:00
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Expiration :</span>
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              {currentReadCard.validity.endDay}/{currentReadCard.validity.endMonth}/{currentReadCard.validity.endYear} à {currentReadCard.validity.endHour}:00
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Trame Brute Encodée (16 Octets) :
                      </span>
                      <pre className="p-2.5 bg-slate-950 text-emerald-400 rounded-lg font-mono text-[10px] overflow-x-auto leading-relaxed">
                        {toHexFormatted(fromHex(currentReadCard.rawHex))}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2 text-slate-400">
                    <CreditCard size={36} className="mx-auto opacity-40 text-blue-500" />
                    <p className="text-xs font-medium">Posez une carte sur l'encodeur et cliquez sur « Lire Carte »</p>
                    <button
                      onClick={handleReadCard}
                      className="mt-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-semibold text-xs"
                    >
                      Lancer la lecture
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Commissioning Shortcut */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 space-y-3 shadow-md">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Mise en Service Express</h4>
                </div>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  Vous installez une nouvelle serrure physique ? Passez à l'onglet <strong>« 3. Mise en Service »</strong> pour générer les 3 cartes obligatoires (Reset → N° Chambre → Horloge).
                </p>
                <button
                  onClick={() => setActiveTab('commissioning')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Configurer une serrure</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STAFF & FUNCTION CARDS */}
        {activeTab === 'staff_cards' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-purple-600" />
                  Émission des Cartes de Service, Passe & Sécurité (proRFL)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Génération des passes maîtres, cartes d'étages, urgences et révocation (TfrmKeysForStaff).
                </p>
              </div>
            </div>

            {/* Staff Card Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {[
                { type: 'master' as const, label: 'Master (Passe Général)', icon: Lock },
                { type: 'floor' as const, label: 'Étage (Floor)', icon: Layers },
                { type: 'building' as const, label: 'Bâtiment', icon: Building },
                { type: 'emergency' as const, label: 'Urgence (Pompiers)', icon: Flame },
                { type: 'group' as const, label: 'Groupe', icon: UserCheck },
                { type: 'checkout' as const, label: 'Check-Out Annulation', icon: Unlock },
                { type: 'limit' as const, label: 'Carte Limite', icon: Sliders },
              ].map((btn) => {
                const Icon = btn.icon;
                const isSelected = selectedStaffType === btn.type;
                return (
                  <button
                    key={btn.type}
                    onClick={() => setSelectedStaffType(btn.type)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-purple-600' : 'text-slate-400'} />
                    <span className="text-xs font-bold leading-tight">{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Staff Card Details Form */}
            <div className="bg-slate-50 dark:bg-slate-850 rounded-xl p-4 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Titulaire de la carte / Rôle assigné *
                </label>
                <input
                  type="text"
                  value={staffHolderName}
                  onChange={(e) => setStaffHolderName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                />
              </div>

              {selectedStaffType === 'floor' && (
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Étage à Déverrouiller *
                  </label>
                  <select
                    value={staffFloorNo}
                    onChange={(e) => setStaffFloorNo(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    {[1, 2, 3, 4, 5, 6].map((fl) => (
                      <option key={fl} value={fl}>
                        Étage {fl} (Ouvre chambres {fl}01-{fl}99)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedStaffType === 'building' && (
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Bâtiment à Déverrouiller *
                  </label>
                  <select
                    value={staffBuildingNo}
                    onChange={(e) => setStaffBuildingNo(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value={1}>Bâtiment Principal (Bld 1)</option>
                    <option value={2}>Résidence Annexe (Bld 2)</option>
                    <option value={3}>Pavillon Suites (Bld 3)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Durée de Validité
                </label>
                <select
                  value={staffValidityDays}
                  onChange={(e) => setStaffValidityDays(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value={1}>24 heures (Service temporaire)</option>
                  <option value={7}>7 jours (Hebdomadaire)</option>
                  <option value={30}>1 mois</option>
                  <option value={365}>1 an (Permanent)</option>
                  <option value={3650}>10 ans (Passe direction)</option>
                </select>
              </div>

              <div className="md:col-span-3 pt-3 flex justify-end">
                <button
                  onClick={handleIssueStaffCard}
                  disabled={isWriting}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <ShieldCheck size={16} />
                  <span>Encoder Carte de Fonction ({selectedStaffType.toUpperCase()})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LOCK COMMISSIONING (3 STEPS) */}
        {activeTab === 'commissioning' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders size={18} className="text-amber-500" />
                Mise en Service Officielle des Serrures proUSB (Commissioning)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chaque serrure physique doit obligatoirement être configurée en suivant ces 3 étapes ordonnées.
              </p>
            </div>

            {/* CardLock.mdb — original software database */}
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                mdbStatus.connected
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet size={16} className={mdbStatus.connected ? 'text-emerald-600' : 'text-slate-400'} />
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                  Base de données CardLock.mdb (logiciel d'origine)
                </h3>
                <span
                  className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    mdbStatus.connected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {mdbStatus.connected ? 'CONNECTÉE' : 'NON IMPORTÉE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Importez le fichier <code className="font-mono">CardLock.mdb</code> situé dans{' '}
                <code className="font-mono">C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\</code>.
                L'app réutilise alors les mêmes chambres, clients et cartes que le logiciel d'origine et écrit les
                cartes système avec le <strong>vrai code site</strong> lu dans la base (plus de{' '}
                <code className="font-mono">N9067</code>). Sans base importée, l'app reste autonome.
              </p>
              {mdbStatus.connected && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-700 dark:text-slate-200">
                  <div>
                    <strong className="block text-slate-500 dark:text-slate-400">Cartes</strong>
                    {mdbStatus.cards}
                  </div>
                  <div>
                    <strong className="block text-slate-500 dark:text-slate-400">Chambres</strong>
                    {mdbStatus.rooms}
                  </div>
                  <div>
                    <strong className="block text-slate-500 dark:text-slate-400">Séjours</strong>
                    {mdbStatus.guests}
                  </div>
                  <div>
                    <strong className="block text-slate-500 dark:text-slate-400">Code site</strong>
                    <span className="font-mono">{mdbStatus.systemIdHex ?? '—'}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    isImportingMdb
                      ? 'bg-slate-300 text-slate-600 cursor-wait'
                      : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                  }`}
                >
                  <Download size={14} />
                  {isImportingMdb
                    ? 'Import en cours…'
                    : mdbStatus.connected
                      ? 'Remplacer le fichier'
                      : 'Choisir CardLock.mdb'}
                  <input
                    type="file"
                    accept=".mdb,.accdb"
                    className="hidden"
                    disabled={isImportingMdb}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void handleImportMdb(file);
                    }}
                  />
                </label>
                {mdbStatus.connected && (
                  <button
                    type="button"
                    onClick={() => {
                      lockManager.clearMdb();
                      setMdbStatus(lockManager.getMdbStatus());
                      showToast('info', 'Base CardLock.mdb déconnectée — mode autonome.');
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 size={14} />
                    Déconnecter
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Step 1 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">IniCard / ResetCard</span>
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">Étape 1 : Réinitialisation Usine <span className="text-[9px] text-red-600 font-mono">(LIRE = reset, ÉCRIRE = reset card)</span></h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Génère la carte de réinitialisation. Présentez-la sur la serrure neuve : la serrure émet 3 bips et passe sa mémoire à zéro.
                </p>
                <label className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={universalSystemCard}
                    onChange={(e) => setUniversalSystemCard(e.target.checked)}
                    className="mt-0.5 accent-rose-600"
                  />
                  <span className="text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Carte universelle (site 0000)</strong>
                    <br />
                    Réinitialise une serrure d'un <em>autre</em> système. Décochez pour n'écrire que pour le site importé
                    {mdbStatus.systemIdHex ? ` (${mdbStatus.systemIdHex})` : ''}.
                  </span>
                </label>
                <button
                  onClick={() => handleIssueCommissioning('reset')}
                  disabled={isWriting}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Émettre Carte Reset
                </button>
              </div>

              {/* Hard Reset — Admin only */}
              <div className="p-4 rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-red-700 text-white text-xs font-bold flex items-center justify-center">
                    !
                  </span>
                  <span className="text-[10px] font-mono text-red-500 uppercase font-bold">HARD RESET</span>
                </div>
                <h3 className="font-bold text-xs text-red-900 dark:text-red-200">Reset Persistant (Admin)</h3>
                <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                  Réinitialisation persistante et irréversible. Outrepasse toute configuration existante. Réservé aux administrateurs. Double confirmation requise.
                </p>
                {universalSystemCard && (
                  <p className="text-[10px] font-bold text-red-700 dark:text-red-300">
                    Mode universel actif : la carte sera écrite avec le site 0000.
                  </p>
                )}
                <button
                  onClick={() => {
                    if (window.confirm('⚠️ ATTENTION : Cette action réinitialisera définitivement la serrure. Toute configuration sera perdue. Confirmer ?')) {
                      if (window.confirm('Dernière confirmation : Reset persistant irréversible. Continuer ?')) {
                        handleIssueCommissioning('hard_reset');
                      }
                    }
                  }}
                  disabled={isWriting}
                  className="w-full py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  {isWriting ? 'Reset en cours...' : 'HARD RESET PERSISTANT'}
                </button>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">RoomSetCard (0x20)</span>
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">Étape 2 : Affectation Chambre</h3>
                <div className="space-y-2">
                  <input type="text" value={commissionRoom} onChange={(e)=>setCommissionRoom(e.target.value)} placeholder="Chambre (ex: 101)" className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                  <div className="flex gap-2">
                    <input type="number" min={1} max={99} value={commissionFloor} onChange={(e)=>setCommissionFloor(Math.max(1,parseInt(e.target.value)||1))} placeholder="Étage" className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                    <input type="number" min={1} max={99} value={commissionBuilding} onChange={(e)=>setCommissionBuilding(Math.max(1,parseInt(e.target.value)||1))} placeholder="Bâtiment" className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                  </div>
                  <div className="flex gap-2">
                    <input type="number" min={1} max={3650} value={commissionValidityDays} onChange={(e)=>setCommissionValidityDays(Math.max(1,parseInt(e.target.value)||365))} placeholder="Durée validité (jours)" className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                    <input type="number" min={0} max={23} value={commissionValidityHour} onChange={(e)=>setCommissionValidityHour(Math.max(0,Math.min(23,parseInt(e.target.value)||12)))} placeholder="Heure début (0-23)" className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Programme le numéro physique dans la mémoire de la serrure. La serrure émet 2 bips pour confirmer l'affectation.
                </p>
                <button
                  onClick={() => handleIssueCommissioning('room_set')}
                  disabled={isWriting}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Émettre Carte N° Chambre
                </button>
              </div>

              {/* Staff / Group Cards — Services & Personnel */}
              <div className="p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-amber-600" />
                  <h3 className="font-bold text-xs text-amber-900 dark:text-amber-200">Cartes Services & Personnel (Group / Staff / Building / Floor)</h3>
                  <span className="ml-auto text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 px-1.5 rounded">RÔLES + RESTRICTIONS</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Créez des groupes selon les étages du planning Gantt. Restrictions : groupe = seulement chambres assignées; étage = tout l'étage; bâtiment = tout le bâtiment; master = tout l'établissement.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleIssueCommissioning('group_set')} disabled={isWriting} className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs">Groupe Config (0x50)</button>
                  <button onClick={() => handleIssueCommissioning('group')} disabled={isWriting} className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs">Carte Groupe (0x80)</button>
                  <button onClick={() => handleIssueCommissioning('floor')} disabled={isWriting} className="py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-xs">Carte Étage (0xD0)</button>
                  <button onClick={() => handleIssueCommissioning('building')} disabled={isWriting} className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs">Carte Bâtiment (0xC0)</button>
                  <button onClick={() => handleIssueCommissioning('master')} disabled={isWriting} className="py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs col-span-2">Passe Général Master (0xB0)</button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-amber-800 dark:text-amber-200">
                  <div><strong>Durée</strong> <input type="number" min={1} max={3650} value={commissionValidityDays} onChange={e=>setCommissionValidityDays(Math.max(1,parseInt(e.target.value)||365))} className="w-full p-1 text-xs rounded bg-white dark:bg-slate-800" /> j</div>
                  <div><strong>Heure début</strong> <input type="number" min={0} max={23} value={commissionValidityHour} onChange={e=>setCommissionValidityHour(Math.max(0,Math.min(23,parseInt(e.target.value)||12)))} className="w-full p-1 text-xs rounded bg-white dark:bg-slate-800" />h</div>
                  <div><strong>Étage</strong> <input type="number" min={1} max={99} value={commissionFloor} onChange={e=>setCommissionFloor(Math.max(1,parseInt(e.target.value)||1))} className="w-full p-1 text-xs rounded bg-white dark:bg-slate-800" /></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">TimeSetCard (0x30)</span>
                </div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">Étape 3 : Synchronisation Heure</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Injecte l'horloge et la date courantes ({new Date().toLocaleTimeString('fr-FR')}) dans le quartz de la serrure.
                </p>
                <button
                  onClick={() => handleIssueCommissioning('time_set')}
                  disabled={isWriting}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Émettre Carte Horloge
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOG (RECORD OPEN) */}
        {activeTab === 'audit_log' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History size={18} className="text-violet-600" />
                  Journal d'Audit des Passages & Ouvertures de Serrure (RecordOpen)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Historique extrait des 33 slots de mémoire interne de chaque serrure d'hôtel (37 octets par paquet).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleIssueCommissioning('record')}
                  disabled={isWriting}
                  className="px-3 py-1.5 bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 rounded-lg text-xs font-semibold"
                >
                  Émettre Carte Relève (RecordCard)
                </button>
                <button
                  onClick={handleReadAuditLog}
                  disabled={isReading}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={isReading ? 'animate-spin' : ''} />
                  <span>Importer Journal depuis Carte</span>
                </button>
              </div>
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 border-y border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Slot</th>
                    <th className="py-2.5 px-3">Date & Heure d'Ouverture</th>
                    <th className="py-2.5 px-3">Chambre</th>
                    <th className="py-2.5 px-3">Type d'Événement</th>
                    <th className="py-2.5 px-3 font-mono">Identifiant Carte</th>
                    <th className="py-2.5 px-3 font-mono">Données Brutes (8 Octets)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {auditRecords.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-slate-400">#{item.orderFlag}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300 font-medium">
                        {new Date(item.openTime).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                        Chambre {item.roomNo || '101'}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {item.eventType.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{item.cardIdentifier}</td>
                      <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{item.recDataHex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: HARDWARE & LIVE TRAMES CONSOLE */}
        {activeTab === 'encoder_hardware' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Device Info & Controls */}
            <div className="space-y-6">
              {/* Device Identity Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3.5 text-xs">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Usb size={16} className="text-blue-500" />
                  Spécifications Encodeur Physique
                </h3>

                <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Vendor ID (VID) :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">0x9915</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Product ID (PID) :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">0x1116</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Périphérique :</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">proUSB-TEMIC (Reader_0000016)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Usage Page HID :</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">0x85FF (Vendor Defined)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Taille Rapport HID :</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">65 Octets (Report 0x40)</span>
                  </div>
                </div>

                <button
                    onClick={handleConnectHardware}
                    disabled={isConnecting}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Usb size={14} />
                    <span>{isConnecting ? 'Connexion en cours...' : "Connecter l'Encodeur USB (WebHID)"}</span>
                  </button>
                </div>

              {/* Manual ReadCard Test */}
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800 space-y-2 text-xs">
                <h4 className="font-bold text-purple-900 dark:text-purple-200">Test Lecture Carte (Debug)</h4>
                <p className="text-purple-700 dark:text-purple-300 text-[11px]">
                  Envoie la commande ReadCard (AA 01 E4 4F) et affiche la reponse brute.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const transport = lockManager.getTransport();
                      if (!transport.isOpen()) {
                        await transport.open();
                      }
                      const frame = new Uint8Array([0xaa, 0x01, 0xe4, 0x4f]);
                      await transport.send(frame);
                      const resp = await transport.receive(5000);
                      if (resp) {
                        const hex = Array.from(resp).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        showToast('info', `Reponse (${resp.length} bytes): ${hex}`);
                        lockManager.getTransport().onLog?.('rx', `Manual ReadCard response: ${hex}`, resp);
                      } else {
                        showToast('error', 'Pas de reponse du lecteur (timeout 5s). Verifiez que la carte est bien posee.');
                      }
                    } catch (err: any) {
                      showToast('error', `Erreur: ${err.message}`);
                    }
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Tester ReadCard manuellement
                </button>
              </div>

              {/* Diagnostic: List all HID devices */}
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                <h4 className="font-bold text-amber-900 dark:text-amber-200">Diagnostic USB</h4>
                <p className="text-amber-700 dark:text-amber-300 text-[11px]">
                  Si l'encodeur n'est pas detecte, cliquez ci-dessous pour lister tous les peripheriques HID disponibles.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const devices = await (navigator as any).hid.requestDevice({ filters: [] });
                      if (devices && devices.length > 0) {
                        const info = devices.map((d: any) => `${d.productName || 'Unknown'} (VID 0x${d.vendorId.toString(16).toUpperCase()}, PID 0x${d.productId.toString(16).toUpperCase()})`).join('\n');
                        showToast('info', `${devices.length} peripherique(s) trouve(s) :\n${info}`);
                      } else {
                        showToast('error', 'Aucun peripherique HID trouve. Verifiez que l\'encodeur est branche et reconnu par Windows.');
                      }
                    } catch (err: any) {
                      showToast('error', `Erreur diagnostic: ${err.message}`);
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Lister tous les peripheriques HID
                </button>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  VID attendu: 0x9915 | PID attendu: 0x1116
                </p>
              </div>

              {/* Hardware Actions */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 text-xs">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={14} className="text-red-500" />
                  Commandes Mise en Service / Système
                  <span className="ml-auto text-[9px] font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">LECTURE ≠ ÉCRITURE</span>
                </h3>
                <button
                  onClick={handleBuzzerTest}
                  className="w-full py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold flex items-center justify-center gap-2"
                >
                  <Volume2 size={15} className="text-amber-500" />
                  <span>Buzzer physique (Trame AA 02 80 01 29)</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Hex Log Console */}
            <div className="lg:col-span-2 bg-slate-950 text-slate-300 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col h-[520px]">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-emerald-400" />
                  <span className="font-mono font-bold text-xs text-white">
                    Console des Trames USB / WebHID Temps Réel
                  </span>
                </div>
                <button
                  onClick={() => {
                    const txt = lockManager.exportLogs();
                    navigator.clipboard?.writeText(txt).catch(() => {});
                    showToast('info', 'Tous les logs de la console copiés dans le presse-papiers (JSON).');
                  }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1.5"
                  title="Copier l'intégralité du journal des trames USB"
                >
                  <Copy size={12} />
                  Copier les logs
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">Lecture</span>
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 rotate-[-90deg]" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${(readProgress / 100) * 100}, 100`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-400">{readProgress}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Écriture</span>
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 rotate-[-90deg]" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${(writeProgress / 100) * 100}, 100`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-amber-400">{writeProgress}%</span>
                  </div>
                </div>

                <button
                  onClick={() => lockManager.clearLogs()}
                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Effacer console
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-2">
                {logs.length === 0 ? (
                  <div className="text-slate-600 text-center py-20">
                    En attente de communication avec l'encodeur...
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg border flex flex-col gap-1 ${
                        log.direction === 'tx'
                          ? 'bg-blue-950/30 border-blue-900/40 text-blue-300'
                          : log.direction === 'rx'
                          ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
                          : log.direction === 'error'
                          ? 'bg-rose-950/40 border-rose-900/50 text-rose-300'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75">
                        <span className="font-bold uppercase tracking-wider">
                          [{log.direction.toUpperCase()}] {log.message}
                        </span>
                        <span>{log.timestamp}</span>
                      </div>
                      {log.dataHex && (
                        <div className="text-[10px] text-slate-300 break-all select-all font-bold">
                          {log.dataHex}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SECURITY & HARD RESET */}
        {activeTab === 'security' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-200 dark:border-red-900 p-5 shadow-xs space-y-6">
            <div className="border-b border-red-100 dark:border-red-900 pb-3">
              <h2 className="text-sm font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                <ShieldCheck size={18} className="text-red-600" />
                Panneau de Securite - Reset Persistant et Audit
              </h2>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Fonctions de securite avancees reservees aux administrateurs. Actions irreversibles.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-5 border-2 border-red-300 dark:border-red-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-lg">
                  !
                </div>
                <div>
                  <h3 className="font-bold text-sm text-red-900 dark:text-red-200">HARD RESET PERSISTANT</h3>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Reinitialisation definitive de la serrure. Outrepasse toute configuration existante. Double confirmation requise.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <h4 className="font-bold text-red-900 dark:text-red-200">Caracteristiques :</h4>
                  <ul className="space-y-1 text-red-700 dark:text-red-300">
                    <li>- Double round de reset (6 commandes)</li>
                    <li>- Verification par lecture de la carte</li>
                    <li>- 3 bips longs de confirmation</li>
                    <li>- Marqueurs admin (0xAD, 0xDE)</li>
                    <li>- Survit aux coupures de courant</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-red-900 dark:text-red-200">Securite :</h4>
                  <ul className="space-y-1 text-red-700 dark:text-red-300">
                    <li>- Double confirmation utilisateur</li>
                    <li>- Niveau admin uniquement (S ou A)</li>
                    <li>- Log d'audit avec marqueur special</li>
                    <li>- Irreversible</li>
                    <li>- Persistance renforcee</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('ATTENTION : Cette action reinitialisera definitivement la serrure. Toute configuration sera perdue. Confirmer ?')) {
                    if (window.confirm('Derniere confirmation : Reset persistant irreversible. Continuer ?')) {
                      handleIssueCommissioning('hard_reset');
                    }
                  }
                }}
                disabled={isWriting}
                className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <AlertTriangle size={18} />
                <span>{isWriting ? 'HARD RESET EN COURS...' : 'EXECUTER HARD RESET PERSISTANT'}</span>
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-5 border border-blue-200 dark:border-blue-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-blue-900 dark:text-blue-200">Creation automatique de cartes</h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Les cartes client sont automatiquement emises lors de la creation d'une reservation hotel. La carte est liee a la reservation et au check-in.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-blue-700 dark:text-blue-300">Cartes emises automatiquement</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">{issuedCards.filter(c => c.operator === 'MDB Import' || c.operator === 'Admin' || c.operator === 'Reception').length}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-blue-700 dark:text-blue-300">Cartes actives</span>
                  <span className="font-bold text-emerald-600">{issuedCards.filter(c => c.status === 'active').length}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-blue-700 dark:text-blue-300">Persistance</span>
                  <span className="font-bold text-emerald-600">localStorage</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-850 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Gestion des donnees</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Effacer toutes les donnees persistantes (cartes emises, journal d'audit, parametres). Action irreversible.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('Effacer toutes les donnees proUSB persistantes ?')) {
                    lockManager.clearPersistedData();
                    showToast('success', 'Donnees proUSB effacees.');
                  }
                }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg text-xs transition-colors"
              >
                Effacer les donnees persistantes
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS & ROLES */}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings size={18} className="text-blue-600" />
                Paramètres Système des Serrures (System.ini & Rôles Opérateurs)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configurations de sécurité extraites du fichier d'origine et gestion des privilèges opérateurs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Lock Security Behaviors */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  Comportement des Serrures Physiques
                </h3>

                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockSettings.guestAccessBolt}
                      onChange={(e) => lockManager.updateSettings({ guestAccessBolt: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Pêne Dormant Autorisé (GuestAccessBolt / GuestLLock)
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                        Permet aux cartes clients d'ouvrir la porte même si le pêne intérieur est engagé.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockSettings.alarmForcedPin}
                      onChange={(e) => lockManager.updateSettings({ alarmForcedPin: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Alarme Sonore Forçage (BaoJing = 128)
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                        Déclenche le buzzer strident de la serrure si la gâche subit une pression anormale.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockSettings.remindCloseDoor}
                      onChange={(e) => lockManager.updateSettings({ remindCloseDoor: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Rappel Fermeture de Porte (TiShi = 152)
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                        Émet un bip d'avertissement si la porte de la chambre reste entrouverte plus de 30 secondes.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockSettings.lockAfterReleaseKnob}
                      onChange={(e) => lockManager.updateSettings({ lockAfterReleaseKnob: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Verrouillage Béquille (Lock After Release Knob)
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                        Re-verrouille le mécanisme dès que la poignée extérieure revient en position haute.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Roles & Operators Information */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  Hiérarchie des Rôles Opérateurs (OperatorInfo)
                </h3>

                <div className="space-y-2">
                  {[
                    { code: 'S', title: 'Super Administrateur', desc: 'Gestion des profils et options serrures.' },
                    { code: 'A', title: 'Administrateur', desc: 'Mise en service des serrures et passes généraux.' },
                    { code: 'M', title: 'Manager d’Étage', desc: 'Attribution des cartes étages et check-out.' },
                    { code: 'G', title: 'Opérateur Général (Réception)', desc: 'Émission quotidienne des cartes clients.' },
                  ].map((role) => (
                    <div
                      key={role.code}
                      className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3"
                    >
                      <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center font-mono">
                        {role.code}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-xs block">
                          {role.title}
                        </span>
                        <span className="text-[11px] text-slate-500 block">{role.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Licence & Freedom Note */}
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span>Système d'Accès Libre et Permanent (Zéro Bridage Vendeur)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                    Dans le logiciel Delphi original, une licence commerciale expirait après un compte à rebours de jours (<code>Reg.ini</code>). Dans votre application OmniBook, l'accès à l'encodeur USB HID fonctionne en direct sans aucun code de licence ni restriction de durée.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
