import React, { useState, useEffect, useMemo } from 'react';
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
  Hotel,
  Palmtree,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  Coffee,
  Car,
  Baby,
  Users,
  Info,
  Globe,
  Printer,
  Coins,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BookingStatus, DomainType, TimelineBooking, ResourceItem } from '../types/booking';
import { domainConfigs } from '../data/mockData';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';
import { isRoomReadyForBooking } from '../utils/roomReadiness';
import { lockManager } from '../locks/lockManager';
import { CardResultDialog, CardResult } from './CardResultDialog';
import { CardCreationProgressModal } from './CardCreationProgressModal';
import { ALGERIA_69_WILAYAS } from '../data/algeriaWilayas';
import { HOSPITALITY_MEAL_PLANS, DIETARY_PREFERENCES } from '../data/mealPlans';
import { KeyRound, Loader2, Utensils, UtensilsCrossed, ShieldAlert, Award, FileSpreadsheet } from 'lucide-react';

export const BookingModal: React.FC = () => {
  const {
    language,
    isNewBookingModalOpen,
    setIsNewBookingModalOpen,
    newBookingInitialSlot,
    selectedBooking,
    setSelectedBooking,
    addBooking,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    currentBaseDate,
    currentDomain,
    currentRole,
    clientProfile,
    resourceGroups,
    generateTurnoverTasksForCheckout,
    currency,
  } = useApp();

  const isEditing = !!selectedBooking;
  const isOpen = isNewBookingModalOpen || isEditing;

  // Active domain: locked to currentDomain for new bookings, or the booking's own sector when editing.
  // Never mix domains: each domain has its own dedicated reservation sheet!
  const activeDomain: DomainType = useMemo(() => {
    if (selectedBooking) {
      return selectedBooking.sector || currentDomain;
    }
    return currentDomain;
  }, [selectedBooking, currentDomain]);

  // Flatten all resources available strictly for the active domain
  const domainResources: ResourceItem[] = useMemo(() => {
    const matchingGroups = resourceGroups.filter((g) => g.sector === activeDomain);
    const list = matchingGroups.flatMap((g) => g.resources);
    if (list.length > 0) return list;
    // Fallback if none found
    return resourceGroups.flatMap((g) => g.resources);
  }, [resourceGroups, activeDomain]);

  // Core Booking States (unconditionally initialized)
  const [resourceId, setResourceId] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [startDate, setStartDate] = useState(currentBaseDate);
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<BookingStatus>('confirmed');
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partial'>('paid');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [roomStatusAlert, setRoomStatusAlert] = useState<{ roomName: string; status: ResourceItem['housekeepingStatus'] } | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];

  // Tenant Nationality & Police Declaration State (Algérien vs Étranger)
  const [guestType, setGuestType] = useState<'algerian' | 'foreigner'>('algerian');
  // Formulaire de réservation pièces requises : cni, passport, permis de conduire, autorisation spéciale avec descriptif, passport diplomatique, passport spécial, document officiel
  const [idPieceType, setIdPieceType] = useState<
    | 'cni'
    | 'passport'
    | 'driving_license'
    | 'special_authorization'
    | 'diplomatic_passport'
    | 'special_passport'
    | 'official_document'
  >('cni');
  const [idPieceNumber, setIdPieceNumber] = useState('');
  const [specialAuthorizationDesc, setSpecialAuthorizationDesc] = useState('');
  const [algerianIdType, setAlgerianIdType] = useState<'cni' | 'nin'>('cni');
  const [algerianIdNumber, setAlgerianIdNumber] = useState('');
  const [wilayaOfOrigin, setWilayaOfOrigin] = useState('31 - Oran');
  const [foreignNationality, setForeignNationality] = useState('Française');
  const [passportNumber, setPassportNumber] = useState('');
  const [visaNumber, setVisaNumber] = useState('');
  const [entryDateInCountry, setEntryDateInCountry] = useState('');
  const [showPoliceSheetModal, setShowPoliceSheetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Formule de Pension & Restauration (inspiré Booking & Airbnb)
  const [selectedMealPlanId, setSelectedMealPlanId] = useState<string>('bb');
  const [selectedDietary, setSelectedDietary] = useState<string[]>(['halal']);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Multi-Currency Payment State (DZD, EUR, USD, RMB, GBP, SAR)
  const [paymentCurrency, setPaymentCurrency] = useState<string>(currency || 'DA');
  const [paymentMethodType, setPaymentMethodType] = useState<
    'cash_dzd' | 'cib' | 'edahabia' | 'cash_forex' | 'card_international' | 'bank_transfer'
  >('cash_dzd');

  // Dedicated Domain Specific Predefined States
  // 1. HOTEL Specific
  const [hotelAdults, setHotelAdults] = useState(2);
  const [hotelChildren, setHotelChildren] = useState(0);
  const [hotelMealPlan, setHotelMealPlan] = useState<'room_only' | 'breakfast' | 'half_board' | 'full_board'>('breakfast');
  const [hotelCheckinTime, setHotelCheckinTime] = useState('15:00');
  const [hotelOptionBabyBed, setHotelOptionBabyBed] = useState(false);
  const [hotelOptionHighFloor, setHotelOptionHighFloor] = useState(false);
  const [hotelOptionPet, setHotelOptionPet] = useState(false);
  const [hotelOptionWelcomeGift, setHotelOptionWelcomeGift] = useState(false);

  // proUSB Guest Card creation from the booking dialog
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [cardProgress, setCardProgress] = useState(0);
  const [cardResult, setCardResult] = useState<CardResult | null>(null);
  const [usbConnected, setUsbConnected] = useState<boolean>(lockManager.getStatus() === 'connected');

  // Mirror the encoder connection state while the modal is open.
  useEffect(() => {
    if (!isOpen) return undefined;
    setUsbConnected(lockManager.getStatus() === 'connected');
    const unsubscribe = lockManager.subscribeConnection((status) => {
      setUsbConnected(status === 'connected');
    });
    return unsubscribe;
  }, [isOpen]);

  // 2. RESORT Specific
  const [resortOccupants, setResortOccupants] = useState(4);
  const [resortFormula, setResortFormula] = useState<'all_inclusive' | 'half_board' | 'spa_package'>('all_inclusive');
  const [resortCheckinTime, setResortCheckinTime] = useState('14:00');
  const [resortOptionPrivatePool, setResortOptionPrivatePool] = useState(true);
  const [resortOptionBeachCabana, setResortOptionBeachCabana] = useState(true);
  const [resortOptionVipTransfer, setResortOptionVipTransfer] = useState(false);
  const [resortOptionGolfBuggy, setResortOptionGolfBuggy] = useState(false);

  // Synchronization effect when opening modal or changing selected booking
  useEffect(() => {
    if (!isOpen) return;

    if (selectedBooking) {
      setResourceId(selectedBooking.resourceId);
      setGuestName(selectedBooking.guestName || '');
      setGuestEmail(selectedBooking.guestEmail || '');
      setGuestPhone(selectedBooking.guestPhone || '');
      setStartDate(selectedBooking.startDate || currentBaseDate);
      setEndDate(selectedBooking.endDate || selectedBooking.startDate);
      setStatus(selectedBooking.status || 'confirmed');
      setNotes(selectedBooking.notes || '');
      setPaymentStatus(selectedBooking.paymentStatus || 'paid');
      setConflictError(null);

      // Hydrate tenant origin & nationality
      if (selectedBooking.guestType) {
        setGuestType(selectedBooking.guestType);
      } else if (selectedBooking.nationality === 'Algérienne' || selectedBooking.nationality === 'Algerian') {
        setGuestType('algerian');
      } else if (selectedBooking.nationality) {
        setGuestType('foreigner');
      } else {
        setGuestType('algerian');
      }

      // Hydrate identity piece
      if (selectedBooking.idPieceType) {
        setIdPieceType(selectedBooking.idPieceType as any);
      } else if (selectedBooking.guestType === 'foreigner') {
        setIdPieceType('passport');
      } else {
        setIdPieceType('cni');
      }
      setIdPieceNumber(selectedBooking.idPieceNumber || selectedBooking.identityNumber || selectedBooking.passportNumber || '');
      setSpecialAuthorizationDesc(selectedBooking.specialAuthorizationDesc || '');
      setAlgerianIdNumber(selectedBooking.identityNumber || selectedBooking.idPieceNumber || '');
      setWilayaOfOrigin(selectedBooking.wilayaOfOrigin || selectedBooking.wilaya || '31 - Oran');
      setForeignNationality(
        selectedBooking.nationality && selectedBooking.nationality !== 'Algérienne'
          ? selectedBooking.nationality
          : 'Française'
      );
      setPassportNumber(selectedBooking.passportNumber || selectedBooking.idPieceNumber || '');
      setVisaNumber(selectedBooking.visaNumber || '');
      setEntryDateInCountry(selectedBooking.entryDateInCountry || '');
      setPaymentCurrency(selectedBooking.paymentCurrency || currency || 'DA');
      setPaymentMethodType(
        (selectedBooking.paymentMethodType as any) ||
          (selectedBooking.guestType === 'foreigner' ? 'card_international' : 'cash_dzd')
      );

      // Hydrate meal plan and dietary preferences
      if (selectedBooking.mealPlan) {
        setSelectedMealPlanId(selectedBooking.mealPlan);
      }
      if (selectedBooking.mealPlanDietPreferences && selectedBooking.mealPlanDietPreferences.length > 0) {
        setSelectedDietary(selectedBooking.mealPlanDietPreferences);
      }

      // Hydrate custom metadata if present
      const meta = selectedBooking.customMetadata || {};
      if (selectedBooking.sector === 'hotel') {
        if (meta.hotelAdults) setHotelAdults(meta.hotelAdults);
        if (meta.hotelChildren !== undefined) setHotelChildren(meta.hotelChildren);
        if (meta.hotelMealPlan) setHotelMealPlan(meta.hotelMealPlan);
        if (meta.hotelCheckinTime) setHotelCheckinTime(meta.hotelCheckinTime);
        if (meta.hotelOptionBabyBed !== undefined) setHotelOptionBabyBed(meta.hotelOptionBabyBed);
        if (meta.hotelOptionHighFloor !== undefined) setHotelOptionHighFloor(meta.hotelOptionHighFloor);
        if (meta.hotelOptionPet !== undefined) setHotelOptionPet(meta.hotelOptionPet);
        if (meta.hotelOptionWelcomeGift !== undefined) setHotelOptionWelcomeGift(meta.hotelOptionWelcomeGift);
      } else if (selectedBooking.sector === 'resort') {
        if (meta.resortOccupants) setResortOccupants(meta.resortOccupants);
        if (meta.resortFormula) setResortFormula(meta.resortFormula);
        if (meta.resortCheckinTime) setResortCheckinTime(meta.resortCheckinTime);
        if (meta.resortOptionPrivatePool !== undefined) setResortOptionPrivatePool(meta.resortOptionPrivatePool);
        if (meta.resortOptionBeachCabana !== undefined) setResortOptionBeachCabana(meta.resortOptionBeachCabana);
        if (meta.resortOptionVipTransfer !== undefined) setResortOptionVipTransfer(meta.resortOptionVipTransfer);
        if (meta.resortOptionGolfBuggy !== undefined) setResortOptionGolfBuggy(meta.resortOptionGolfBuggy);
      }
    } else {
      // New booking initialization strictly scoped to active domain
      const defaultResId = domainResources[0]?.id || '';
      if (newBookingInitialSlot?.resourceId) {
        // verify if this resource belongs to domainResources
        const match = domainResources.find((r) => r.id === newBookingInitialSlot.resourceId);
        setResourceId(match ? match.id : defaultResId);
      } else {
        setResourceId(defaultResId);
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

      if (currentRole === 'client') {
        setGuestName(clientProfile.name);
        setGuestEmail(clientProfile.email);
        setGuestPhone(clientProfile.phone);
      } else {
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
      }
      setStatus('confirmed');
      setNotes('');
      setPaymentStatus('paid');
      setConflictError(null);
      setGuestType('algerian');
      setIdPieceType('cni');
      setIdPieceNumber('');
      setSpecialAuthorizationDesc('');
      setAlgerianIdNumber('');
      setWilayaOfOrigin('31 - Oran');
      setForeignNationality('Française');
      setPassportNumber('');
      setVisaNumber('');
      setEntryDateInCountry('');
      setSelectedMealPlanId('bb');
      setSelectedDietary(['halal']);
      setSelectedExtras([]);
      setPaymentCurrency(currency || 'DA');
      setPaymentMethodType('cash_dzd');
    }
  }, [isOpen, selectedBooking, newBookingInitialSlot, currentBaseDate, activeDomain, domainResources, currentRole, clientProfile]);

  // Current selected resource
  const currentResource = useMemo(() => {
    return domainResources.find((r) => r.id === resourceId) || domainResources[0] || null;
  }, [domainResources, resourceId]);

  /**
   * Émet la carte client proUSB directement depuis la fiche de réservation :
   * même chambre, même séjour (arrivée 14h / départ 12h par défaut), même
   * client. Nécessite l'encodeur USB connecté ; un dialogue succès/échec
   * système est affiché après chaque tentative.
   */
  const handleCreateRoomCard = async () => {
    if (isCreatingCard) return;

    if (!usbConnected) {
      await lockManager.notifyFailure();
      setCardResult({
        success: false,
        title: 'Encodeur proUSB non connecté',
        message:
          "Branchez l'encodeur USB et connectez-le dans l'onglet « Serrures proUSB » avant de créer la carte.",
        details: [
          { label: 'Chambre', value: currentResource?.name || resourceNameFallback },
          { label: 'Client', value: guestName || '—' },
        ],
      });
      return;
    }

    setIsCreatingCard(true);
    setCardProgress(15);
    const progressTimer = setInterval(() => {
      setCardProgress((prev) => Math.min(92, prev + Math.floor(Math.random() * 12) + 8));
    }, 110);

    try {
      const record = await lockManager.issueGuestCardFromBooking(
        {
          id: selectedBooking?.id || `draft-${Date.now()}`,
          guestName: guestName || selectedBooking?.guestName || 'Client',
          resourceName: currentResource?.name || resourceNameFallback,
          buildingNo: currentResource?.building !== undefined ? Number.parseInt(currentResource.building, 10) : undefined,
          floorNo: currentResource?.floor !== undefined ? Number.parseInt(currentResource.floor, 10) : undefined,
          startDate,
          endDate,
        },
        'Admin',
      );
      clearInterval(progressTimer);
      setCardProgress(100);
      await lockManager.notifySuccess();
      setCardResult({
        success: true,
        title: 'Carte client encodée avec succès',
        message: `La carte de la chambre ${record.roomNumber || currentResource?.name} pour ${record.holderName} est valide jusqu'au ${record.validUntil}. Présentez la carte au lecteur de la serrure pour l'activer.`,
        details: [
          { label: 'Chambre', value: record.roomNumber || '—' },
          { label: 'Client', value: record.holderName },
          { label: 'Expire le', value: record.validUntil },
          { label: 'Trame (hex)', value: record.rawHex },
        ],
      });
    } catch (error) {
      clearInterval(progressTimer);
      setCardProgress(0);
      await lockManager.notifyFailure();
      setCardResult({
        success: false,
        title: "Échec de l'écriture de la carte",
        message:
          error instanceof Error
            ? error.message
            : "La carte n'a pas pu être encodée. Vérifiez que la carte est bien posée sur l'encodeur.",
        details: [
          { label: 'Chambre', value: currentResource?.name || '—' },
          { label: 'Client', value: guestName || '—' },
        ],
      });
    } finally {
      clearInterval(progressTimer);
      setTimeout(() => {
        setIsCreatingCard(false);
        setCardProgress(0);
      }, 1000);
    }
  };

  /** Nom de chambre déduit du champ resource (fallback si aucune ressource). */
  const resourceNameFallback = selectedBooking?.resourceName || '';

  // Calculate days / nights duration
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24);
    return Math.max(1, Math.round(diff));
  }, [startDate, endDate]);

  // Dedicated pricing logic per business domain
  const { totalPrice, priceBreakdown } = useMemo(() => {
    const baseDaily = currentResource?.pricePerDay || 0;

    const activeMealPlan = HOSPITALITY_MEAL_PLANS.find((m) => m.id === selectedMealPlanId);
    const mealRate = activeMealPlan ? activeMealPlan.pricePerPersonDay : 0;
    const mealPlanName = activeMealPlan ? activeMealPlan.shortBadge : 'Pension';

    const extrasTotal = selectedExtras.reduce((acc, extraId) => {
      if (extraId === 'grab_go') return acc + 12 * (activeDomain === 'hotel' ? hotelAdults : resortOccupants) * calculatedDays;
      if (extraId === 'picnic') return acc + 20 * (activeDomain === 'hotel' ? hotelAdults : resortOccupants);
      if (extraId === 'romantic') return acc + 65;
      if (extraId === 'private_chef') return acc + 95;
      return acc;
    }, 0);

    if (activeDomain === 'hotel') {
      const roomBase = calculatedDays * (baseDaily || 95);
      const mealTotal = mealRate * hotelAdults * calculatedDays;
      const babyBedTotal = hotelOptionBabyBed ? 10 * calculatedDays : 0;
      const petTotal = hotelOptionPet ? 15 * calculatedDays : 0;
      const giftTotal = hotelOptionWelcomeGift ? 35 : 0;
      const touristTax = 2.5 * hotelAdults * calculatedDays;
      const total = roomBase + mealTotal + extrasTotal + babyBedTotal + petTotal + giftTotal + touristTax;
      return {
        totalPrice: Math.round(total),
        priceBreakdown: `${calculatedDays} nuit(s) × ${baseDaily || 95}€ + ${mealPlanName} (${mealTotal}€) + options (${babyBedTotal + petTotal + giftTotal + extrasTotal}€) + taxe séjour (${touristTax.toFixed(2)}€)`,
      };
    }

    if (activeDomain === 'resort') {
      const villaBase = calculatedDays * (baseDaily || 280);
      const formulaPrice = mealRate > 0 ? mealRate : (resortFormula === 'all_inclusive' ? 95 : resortFormula === 'half_board' ? 55 : 75);
      const formulaTotal = formulaPrice * resortOccupants * calculatedDays;
      const poolTotal = resortOptionPrivatePool ? 40 * calculatedDays : 0;
      const cabanaTotal = resortOptionBeachCabana ? 30 * calculatedDays : 0;
      const transferTotal = resortOptionVipTransfer ? 85 : 0;
      const buggyTotal = resortOptionGolfBuggy ? 25 * calculatedDays : 0;
      const total = villaBase + formulaTotal + extrasTotal + poolTotal + cabanaTotal + transferTotal + buggyTotal;
      return {
        totalPrice: Math.round(total),
        priceBreakdown: `${calculatedDays} nuit(s) × ${baseDaily || 280}€ + formule ${mealPlanName} (${formulaTotal}€) + services VIP & extras (${poolTotal + cabanaTotal + transferTotal + buggyTotal + extrasTotal}€)`,
      };
    }

    const fallbackTotal = calculatedDays * (baseDaily || 95) + mealRate * calculatedDays + extrasTotal;
    return {
      totalPrice: fallbackTotal,
      priceBreakdown: `${calculatedDays} jour(s) × ${baseDaily || 95}€ + ${mealPlanName}`,
    };
  }, [
    activeDomain,
    currentResource,
    calculatedDays,
    hotelAdults,
    selectedMealPlanId,
    selectedExtras,
    hotelOptionBabyBed,
    hotelOptionPet,
    hotelOptionWelcomeGift,
    resortOccupants,
    resortFormula,
    resortOptionPrivatePool,
    resortOptionBeachCabana,
    resortOptionVipTransfer,
    resortOptionGolfBuggy,
  ]);

  // Currency Conversion Rates (Base: EUR = 1)
  const ratesFromEur: Record<string, number> = {
    EUR: 1,
    DA: 145.5,
    USD: 1.08,
    RMB: 7.74,
    GBP: 0.85,
    SAR: 4.05,
  };

  const currencySymbols: Record<string, string> = {
    DA: 'DA',
    EUR: '€',
    USD: '$',
    RMB: '¥',
    GBP: '£',
    SAR: '﷼',
  };

  const currentCurrencyRate = ratesFromEur[paymentCurrency] || 1;
  const priceInPaymentCurrency = Math.round(totalPrice * currentCurrencyRate);
  const priceInDzd = Math.round(totalPrice * (ratesFromEur['DA'] || 145.5));

  // Submitting form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isChangingRoom = !isEditing || selectedBooking?.resourceId !== resourceId;
    if (activeDomain === 'hotel' && isChangingRoom && (!currentResource || !isRoomReadyForBooking(currentResource.housekeepingStatus))) {
      setRoomStatusAlert({ roomName: currentResource?.name ?? '—', status: currentResource?.housekeepingStatus });
      return;
    }
    if (!guestName.trim()) return;
    setConflictError(null);

    // Build custom domain metadata payload
    let customMetadata: Record<string, any> = {};
    if (activeDomain === 'hotel') {
      customMetadata = {
        hotelAdults,
        hotelChildren,
        hotelMealPlan,
        hotelCheckinTime,
        hotelOptionBabyBed,
        hotelOptionHighFloor,
        hotelOptionPet,
        hotelOptionWelcomeGift,
      };
    } else if (activeDomain === 'resort') {
      customMetadata = {
        resortOccupants,
        resortFormula,
        resortCheckinTime,
        resortOptionPrivatePool,
        resortOptionBeachCabana,
        resortOptionVipTransfer,
        resortOptionGolfBuggy,
      };
    }

    const totalAdults = activeDomain === 'hotel' ? hotelAdults : resortOccupants;
    const totalChildren = activeDomain === 'hotel' ? hotelChildren : 0;
    const computedOriginalAmount = Math.round(totalPrice * (ratesFromEur[paymentCurrency] || 1));
    const computedRateToDzd = ratesFromEur['DA'] / (ratesFromEur[paymentCurrency] || 1);

    const currentUserName = `${currentRole.toUpperCase()} (${clientProfile?.name || 'Réception'})`;
    const nowIso = new Date().toISOString();

    if (isEditing && selectedBooking) {
      const historyEntry = {
        timestamp: nowIso,
        modifiedBy: currentUserName,
        changes: `Mise à jour: ${guestName}, Dates: ${startDate} au ${endDate}, Statut: ${status}, Pension: ${selectedMealPlanId.toUpperCase()}, Pièce: ${idPieceType}`,
      };
      const updatedHistory = [...(selectedBooking.modificationHistory || []), historyEntry];

      updateBooking(selectedBooking.id, {
        resourceId,
        resourceName: currentResource?.name || selectedBooking.resourceName,
        guestName,
        guestEmail,
        guestPhone,
        startDate,
        endDate: endDate || startDate,
        status,
        totalPrice,
        paymentStatus,
        notes,
        adults: totalAdults,
        children: totalChildren,
        guestType,
        nationality: guestType === 'algerian' ? 'Algérienne' : foreignNationality,
        identityType: guestType === 'algerian' ? algerianIdType : 'passport',
        identityNumber: idPieceNumber || (guestType === 'algerian' ? algerianIdNumber : passportNumber),
        idPieceType,
        idPieceNumber: idPieceNumber || (guestType === 'algerian' ? algerianIdNumber : passportNumber),
        specialAuthorizationDesc: idPieceType === 'special_authorization' ? specialAuthorizationDesc : undefined,
        passportNumber: guestType === 'foreigner' ? (passportNumber || idPieceNumber) : undefined,
        visaNumber: guestType === 'foreigner' ? visaNumber : undefined,
        entryDateInCountry: guestType === 'foreigner' ? entryDateInCountry : undefined,
        wilayaOfOrigin: guestType === 'algerian' ? wilayaOfOrigin : undefined,
        wilaya: wilayaOfOrigin,
        mealPlan: selectedMealPlanId as any,
        mealPlanDietPreferences: selectedDietary,
        lastModifiedAt: nowIso,
        lastModifiedBy: currentUserName,
        modificationHistory: updatedHistory,
        paymentCurrency,
        originalCurrencyAmount: computedOriginalAmount,
        currencyRateToDzd: computedRateToDzd,
        paymentMethodType,
        customMetadata,
      });
      setSelectedBooking(null);
      setIsNewBookingModalOpen(false);
    } else {
      const initialHistory = [
        {
          timestamp: nowIso,
          modifiedBy: currentUserName,
          changes: `Création du dossier de réservation (${startDate} au ${endDate || startDate})`,
        },
      ];

      const res = addBooking({
        resourceId: resourceId || domainResources[0]?.id || 'res_1',
        resourceName: currentResource?.name || 'Ressource',
        sector: activeDomain,
        guestName,
        guestEmail: guestEmail || `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        guestPhone:
          guestPhone || (guestType === 'algerian' ? '+213 550 12 34 56' : '+33 6 00 00 00 00'),
        startDate,
        endDate: endDate || startDate,
        status,
        totalPrice,
        paymentStatus,
        notes,
        adults: totalAdults,
        children: totalChildren,
        guestType,
        nationality: guestType === 'algerian' ? 'Algérienne' : foreignNationality,
        identityType: guestType === 'algerian' ? algerianIdType : 'passport',
        identityNumber: idPieceNumber || (guestType === 'algerian' ? algerianIdNumber : passportNumber),
        idPieceType,
        idPieceNumber: idPieceNumber || (guestType === 'algerian' ? algerianIdNumber : passportNumber),
        specialAuthorizationDesc: idPieceType === 'special_authorization' ? specialAuthorizationDesc : undefined,
        passportNumber: guestType === 'foreigner' ? (passportNumber || idPieceNumber) : undefined,
        visaNumber: guestType === 'foreigner' ? visaNumber : undefined,
        entryDateInCountry: guestType === 'foreigner' ? entryDateInCountry : undefined,
        wilayaOfOrigin: guestType === 'algerian' ? wilayaOfOrigin : undefined,
        wilaya: wilayaOfOrigin,
        mealPlan: selectedMealPlanId as any,
        mealPlanDietPreferences: selectedDietary,
        lastModifiedAt: nowIso,
        lastModifiedBy: currentUserName,
        modificationHistory: initialHistory,
        paymentCurrency,
        originalCurrencyAmount: computedOriginalAmount,
        currencyRateToDzd: computedRateToDzd,
        paymentMethodType,
        customMetadata,
      });

      if (!res.success && res.error) {
        if (res.code === 'room_not_ready') {
          setRoomStatusAlert({ roomName: res.roomName ?? currentResource?.name ?? '—', status: res.roomStatus });
        } else {
          setConflictError(res.error);
        }
        return;
      }
      setIsNewBookingModalOpen(false);
    }
  };

  const closeModal = () => {
    setIsNewBookingModalOpen(false);
    setSelectedBooking(null);
  };

  // Keyboard accessibility hook called unconditionally BEFORE any early exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Safe early exit for closed modal - Placed AFTER all hooks have been unconditionally called!
  if (!isOpen) return null;

  // Domain Config and visual identity
  const domainCfg = domainConfigs[activeDomain] || domainConfigs.hotel;

  const getDomainIcon = () => {
    switch (activeDomain) {
      case 'hotel':
        return Bed;
      case 'resort':
        return Palmtree;
      default:
        return Hotel;
    }
  };

  const DomainHeaderIcon = getDomainIcon();

  // Localized Sheet Titles
  const getSheetTitle = () => {
    switch (activeDomain) {
      case 'hotel':
        return {
          fr: 'Fiche de Réservation Hôtelière',
          en: 'Hotel Reservation Sheet',
          ar: 'استمارة الحجز الفندقي',
        };
      case 'resort':
        return {
          fr: 'Fiche de Réservation Resort & Complexe',
          en: 'Resort & Villa Booking Sheet',
          ar: 'استمارة حجز المنتجع والفلل',
        };
      default:
        return {
          fr: 'Fiche de Réservation',
          en: 'Reservation Sheet',
          ar: 'استمارة الحجز',
        };
    }
  };

  const sheetTitle = getSheetTitle();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs pms-modal-backdrop overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" className="pms-dialog-panel pms-modal pms-sheet w-full max-w-2xl flex flex-col max-h-[96dvh] sm:max-h-[94dvh] h-[96dvh] sm:h-auto my-0 sm:my-auto rounded-t-3xl sm:rounded-2xl overflow-hidden">
        {/* Modal Dedicated Domain Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-5 pt-3 sm:pt-4 pb-3 sm:py-4 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <DomainHeaderIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="booking-dialog-title" className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                  {sheetTitle[language] || sheetTitle.en}
                </h3>
                {isEditing && selectedBooking && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      statusConfig[selectedBooking.status]?.pillBg || 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {statusConfig[selectedBooking.status]?.label[language] || selectedBooking.status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {domainCfg.label[language] || domainCfg.label.en} • {domainCfg.bookingTerm[language]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Fermer la boîte de dialogue"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 text-xs pb-5">
          {conflictError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-semibold">{conflictError}</span>
            </div>
          )}

          {/* Traceability & Modification details (Audit trail) */}
          {isEditing && selectedBooking && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/80 dark:border-blue-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    Détails du Dossier & Traçabilité
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 font-bold text-blue-700 dark:text-blue-300">
                    #{selectedBooking.id.substring(0, 8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(!showHistoryModal)}
                  className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  <span>
                    {showHistoryModal
                      ? 'Masquer Historique'
                      : `Historique (${(selectedBooking.modificationHistory?.length || 0) + (selectedBooking.lastModifiedAt ? 1 : 0)})`}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-blue-200/50 dark:border-blue-900/40">
                <div>
                  <span className="text-slate-400 font-medium">Dernière modification : </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedBooking.lastModifiedAt
                      ? new Date(selectedBooking.lastModifiedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Création initiale'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Modifié par : </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedBooking.lastModifiedBy || 'Réception'}
                  </span>
                </div>
              </div>

              {showHistoryModal && selectedBooking.modificationHistory && selectedBooking.modificationHistory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-900/40 space-y-1.5 max-h-36 overflow-y-auto">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Historique des modifications :
                  </div>
                  {selectedBooking.modificationHistory.slice().reverse().map((h, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-slate-200/70 dark:border-slate-800 text-[11px] flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">{h.modifiedBy}</span>
                        <span className="text-slate-600 dark:text-slate-400">{h.changes}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 1. SECTOR RESOURCE ASSIGNMENT (Strictly scoped to activeDomain) */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>
                {language === 'fr'
                  ? `${domainCfg.unitTerm.fr} assignée :`
                  : language === 'ar'
                  ? `${domainCfg.unitTerm.ar} المخصصة:`
                  : `Assigned ${domainCfg.unitTerm.en}:`}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                {domainResources.length} {language === 'fr' ? 'disponibles dans ce domaine' : 'available in this domain'}
              </span>
            </label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {domainResources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.type} ({r.pricePerDay > 0 ? `${r.pricePerDay} € / unité` : 'Inclus / Gratuit'})
                  {r.capacity ? ` • Capacité: ${r.capacity}p` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. BENEFICIARY / CLIENT / PATIENT IDENTITY */}
          <div className="space-y-2.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr'
                  ? `${domainCfg.userTerm.fr} (Nom complet) *`
                  : language === 'ar'
                  ? `${domainCfg.userTerm.ar} (الاسم الكامل) *`
                  : `Full ${domainCfg.userTerm.en} Name *`}
              </label>
              <div className="relative">
                <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={
                    activeDomain === 'resort'
                      ? 'Ex: Famille Delacroix (Villa 01)'
                      : 'Ex: Alexander Kaufmann'
                  }
                  className="w-full h-9 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'fr' ? 'Email de contact :' : language === 'ar' ? 'البريد الإلكتروني:' : 'Email Address:'}
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="contact@exemple.com"
                    className="w-full h-9 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'fr' ? 'Téléphone (Rappel / SMS) :' : language === 'ar' ? 'رقم الهاتف للاتصال:' : 'Phone Number:'}
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full h-9 pl-8 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2.b TENANT NATIONALITY & POLICE REGULATION (Algérien vs Étranger) */}
          {(activeDomain === 'hotel' || activeDomain === 'resort') && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {language === 'fr'
                      ? 'Nationalité & Fiche de Police (Réglementation DGSN)'
                      : language === 'ar'
                      ? 'جنسية النزيل وبطاقة الشرطة التنظيمية'
                      : 'Tenant Nationality & Police Declaration Form'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPoliceSheetModal(true)}
                  className="px-2 py-1 text-[11px] font-semibold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileText size={13} />
                  <span>{language === 'fr' ? 'Aperçu Fiche de Police' : 'Police Form'}</span>
                </button>
              </div>

              {/* Guest Type Selector Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setGuestType('algerian');
                    setForeignNationality('Algérienne');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    guestType === 'algerian'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🇩🇿</span>
                  <span>{language === 'fr' ? 'Citoyen Algérien (National)' : language === 'ar' ? 'مواطن جزائري (وطني)' : 'Algerian National'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuestType('foreigner');
                    if (foreignNationality === 'Algérienne') setForeignNationality('Française');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    guestType === 'foreigner'
                      ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🌐</span>
                  <span>{language === 'fr' ? 'Ressortissant Étranger' : language === 'ar' ? 'أجنبي / مقيم بالخارج' : 'Foreign Resident'}</span>
                </button>
              </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'Type de Pièce d\'Identité *' : 'ID Document Type *'}
                    </label>
                    <select
                      value={idPieceType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setIdPieceType(val);
                        if (val === 'cni') setAlgerianIdType('cni');
                      }}
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold text-xs"
                    >
                      <option value="cni">🪪 CNI (Carte Nationale d'Identité)</option>
                      <option value="passport">🛂 Passeport Ordinaire</option>
                      <option value="driving_license">🚗 Permis de Conduire</option>
                      <option value="special_authorization">📜 Autorisation Spéciale (avec descriptif)</option>
                      <option value="diplomatic_passport">🏛️ Passeport Diplomatique</option>
                      <option value="special_passport">⭐ Passeport Spécial / Service</option>
                      <option value="official_document">📄 Document Officiel d'État</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'N° de la Pièce *' : 'Document Number *'}
                    </label>
                    <input
                      type="text"
                      value={idPieceNumber}
                      onChange={(e) => {
                        setIdPieceNumber(e.target.value);
                        setAlgerianIdNumber(e.target.value);
                        setPassportNumber(e.target.value);
                      }}
                      placeholder="Ex: 1102938491029 / 21EF98124"
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {guestType === 'algerian' ? 'Wilaya de Résidence (69 Wilayas) *' : 'Nationalité *'}
                    </label>
                    {guestType === 'algerian' ? (
                      <select
                        value={wilayaOfOrigin}
                        onChange={(e) => setWilayaOfOrigin(e.target.value)}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                      >
                        {ALGERIA_69_WILAYAS.map((w) => (
                          <option key={w.code} value={`${w.code} - ${w.nameFr}`}>
                            {w.code} - {w.nameFr} ({w.nameAr})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={foreignNationality}
                        onChange={(e) => setForeignNationality(e.target.value)}
                        placeholder="Ex: Française, Tunisienne, Chinoise..."
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Conditional Description for Special Authorization */}
                {idPieceType === 'special_authorization' && (
                  <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-1">
                    <label className="block font-bold text-amber-900 dark:text-amber-200 text-xs flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-600" />
                      <span>Descriptif de l'Autorisation Spéciale (Motif, autorité émettrice, référence dérogation) *</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={specialAuthorizationDesc}
                      onChange={(e) => setSpecialAuthorizationDesc(e.target.value)}
                      placeholder="Ex: Autorisation spéciale préfectorale n° 2026/419 émise par la Wilaya d'Oran - Mission officielle d'inspection..."
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                    />
                  </div>
                )}

                {/* Foreigner Visa & Entry Fields */}
                {guestType === 'foreigner' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fr' ? 'N° Visa Entrée Algérie' : 'Algerian Visa Number'}
                      </label>
                      <input
                        type="text"
                        value={visaNumber}
                        onChange={(e) => setVisaNumber(e.target.value)}
                        placeholder="Ex: VZ-2026/09"
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono text-xs uppercase"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {language === 'fr' ? "Date d'Entrée sur le Territoire" : 'Entry Date'}
                      </label>
                      <input
                        type="date"
                        value={entryDateInCountry}
                        onChange={(e) => setEntryDateInCountry(e.target.value)}
                        className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. DEDICATED PREDEFINED FIELDS PER DOMAIN */}

          {/* === A. HOTEL PREDEFINED SHEET === */}
          {activeDomain === 'hotel' && (
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/70 dark:border-blue-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-bold text-xs uppercase tracking-wider">
                <Bed size={14} />
                <span>Paramètres du Séjour Hôtelier</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Adultes</label>
                  <select
                    value={hotelAdults}
                    onChange={(e) => setHotelAdults(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} adulte{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Enfants</label>
                  <select
                    value={hotelChildren}
                    onChange={(e) => setHotelChildren(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} enfant{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure Arrivée</label>
                  <input
                    type="time"
                    value={hotelCheckinTime}
                    onChange={(e) => setHotelCheckinTime(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Formule de Pension & Restauration (Inspiré Booking & Airbnb) */}
              <div className="space-y-2 pt-1 border-t border-blue-200/50 dark:border-blue-900/40">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                    <UtensilsCrossed size={14} className="text-amber-500" />
                    <span>Formule de Pension & Restauration (Standard Booking / Airbnb)</span>
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                    {HOSPITALITY_MEAL_PLANS.find((p) => p.id === selectedMealPlanId)?.shortBadge || 'BB'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {HOSPITALITY_MEAL_PLANS.map((plan) => {
                    const isSelected = selectedMealPlanId === plan.id;
                    const priceInDzd = Math.round(plan.pricePerPersonDay * 145.5);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedMealPlanId(plan.id)}
                        className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {plan.shortBadge}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {plan.pricePerPersonDay === 0
                              ? 'Inclus'
                              : paymentCurrency === 'DA'
                              ? `+${priceInDzd} DA/j`
                              : `+${plan.pricePerPersonDay} €/j`}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-1">
                          {plan.name[language] || plan.name.fr}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Plan Description */}
                {(() => {
                  const currentPlan = HOSPITALITY_MEAL_PLANS.find((p) => p.id === selectedMealPlanId);
                  if (!currentPlan) return null;
                  return (
                    <div className="p-2 bg-slate-100/70 dark:bg-slate-900/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                      <p className="italic">{currentPlan.description[language] || currentPlan.description.fr}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {currentPlan.includedItems.map((item, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300"
                          >
                            ✓ {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Dietary preferences */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Régimes & Préférences Alimentaires :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DIETARY_PREFERENCES.map((diet) => {
                      const isChecked = selectedDietary.includes(diet.id);
                      return (
                        <button
                          key={diet.id}
                          type="button"
                          onClick={() => {
                            setSelectedDietary(
                              isChecked
                                ? selectedDietary.filter((id) => id !== diet.id)
                                : [...selectedDietary, diet.id]
                            );
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {diet.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Airbnb & Booking Style Extras */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Extras Expérientiels Booking & Airbnb :
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      { id: 'grab_go', label: '🥡 Grab & Go (Petit-déj emporté)', price: '+12€/p' },
                      { id: 'picnic', label: '🧺 Panier Pique-Nique Excursion', price: '+20€/p' },
                      { id: 'romantic', label: '🕯️ Dîner Romantique Chandelles VIP', price: '+65€' },
                      { id: 'private_chef', label: '👨‍🍳 Barbecue & Chef Privé en Villa', price: '+95€' },
                    ].map((extra) => {
                      const isChecked = selectedExtras.includes(extra.id);
                      return (
                        <label
                          key={extra.id}
                          className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer select-none ${
                            isChecked
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedExtras(
                                  isChecked
                                    ? selectedExtras.filter((id) => id !== extra.id)
                                    : [...selectedExtras, extra.id]
                                );
                              }}
                              className="rounded text-blue-600"
                            />
                            <span className="truncate">{extra.label}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-1">
                            {extra.price}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionBabyBed}
                    onChange={(e) => setHotelOptionBabyBed(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Lit bébé d'appoint (+10€)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionHighFloor}
                    onChange={(e) => setHotelOptionHighFloor(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Étage élevé / Vue dégagée</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionPet}
                    onChange={(e) => setHotelOptionPet(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Animal de compagnie (+15€)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionWelcomeGift}
                    onChange={(e) => setHotelOptionWelcomeGift(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Bouteille de bienvenue (+35€)</span>
                </label>
              </div>
            </div>
          )}

          {/* === B. RESORT & COMPLEXE PREDEFINED SHEET === */}
          {activeDomain === 'resort' && (
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Palmtree size={14} />
                <span>Paramètres Resort, Villas & Bungalows</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Capacité / Occupants</label>
                  <select
                    value={resortOccupants}
                    onChange={(e) => setResortOccupants(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} personne{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Formule Resort</label>
                  <select
                    value={resortFormula}
                    onChange={(e) => setResortFormula(e.target.value as any)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="all_inclusive">All-Inclusive Resort VIP (+60€ / pers / jour)</option>
                    <option value="half_board">Demi-Pension Gourmande (+35€ / pers / jour)</option>
                    <option value="spa_package">Formule Séjour & Soins Spa (+50€ / pers / jour)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure Arrivée Souhaitée</label>
                  <input
                    type="time"
                    value={resortCheckinTime}
                    onChange={(e) => setResortCheckinTime(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionPrivatePool}
                    onChange={(e) => setResortOptionPrivatePool(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Piscine privée chauffée</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionBeachCabana}
                    onChange={(e) => setResortOptionBeachCabana(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Cabana Plage Privée</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionVipTransfer}
                    onChange={(e) => setResortOptionVipTransfer(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Navette VIP Aéroport (+80€)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionGolfBuggy}
                    onChange={(e) => setResortOptionGolfBuggy(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Voiturette Resort (+30€/j)</span>
                </label>
              </div>
            </div>
          )}

          {/* 4. DATES & SCHEDULE */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>{language === 'fr' ? "Date d'arrivée / Début *" : 'Start / Check-in Date *'}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">≥ Aujourd'hui</span>
              </label>
              <input
                type="date"
                required
                min={todayIso}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>{language === 'fr' ? 'Date de départ / Fin *' : 'End / Check-out Date *'}</span>
                <span className="text-[10px] text-slate-400 font-normal">Min: Arrivée</span>
              </label>
              <input
                type="date"
                required
                min={startDate || todayIso}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* 5. STATUS, MULTI-CURRENCY & PAYMENT */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
              <Coins size={15} className="text-amber-500" />
              <span>
                {language === 'fr'
                  ? 'Devise & Conditions de Règlement'
                  : language === 'ar'
                  ? 'العملة وطريقة الدفع'
                  : 'Currency & Payment Terms'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'fr' ? 'Devise de Paiement' : 'Currency'}
                </label>
                <select
                  value={paymentCurrency}
                  onChange={(e) => {
                    const newCurr = e.target.value;
                    setPaymentCurrency(newCurr);
                    if (newCurr === 'DA') {
                      setPaymentMethodType('cash_dzd');
                    } else {
                      setPaymentMethodType('cash_forex');
                    }
                  }}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-bold"
                >
                  <option value="DA">🇩🇿 DZD / DA (Dinar Algérien)</option>
                  <option value="EUR">🇪🇺 EUR (€ - Euro)</option>
                  <option value="USD">🇺🇸 USD ($ - Dollar US)</option>
                  <option value="RMB">🇨🇳 RMB (¥ - Yuan Renminbi)</option>
                  <option value="GBP">🇬🇧 GBP (£ - Livre Sterling)</option>
                  <option value="SAR">🇸🇦 SAR (﷼ - Riyal Saoudien)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'fr' ? 'Mode de Règlement' : 'Payment Method'}
                </label>
                <select
                  value={paymentMethodType}
                  onChange={(e) => setPaymentMethodType(e.target.value as any)}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                >
                  {paymentCurrency === 'DA' ? (
                    <>
                      <option value="cash_dzd">💵 Espèces DZD (Cash)</option>
                      <option value="cib">💳 Carte CIB / Edahabia</option>
                      <option value="bank_transfer">🏦 Virement Bancaire (CCP / BEA / BNA)</option>
                    </>
                  ) : (
                    <>
                      <option value="cash_forex">💵 Espèces Devises ({paymentCurrency})</option>
                      <option value="card_international">💳 Carte Internationale (Visa / MC)</option>
                      <option value="bank_transfer">🌐 Virement SWIFT International</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'fr' ? 'Statut du Dossier' : 'Booking Status'}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BookingStatus)}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(statusConfig) as BookingStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {statusConfig[st].label[language] || statusConfig[st].label.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'fr' ? 'État d\'encaissement' : 'Payment Status'}
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
                >
                  <option value="paid">
                    {language === 'fr' ? '✅ Règlement Total Effectué (Payé)' : '✅ Paid in Full'}
                  </option>
                  <option value="pending">
                    {language === 'fr' ? '⏳ En attente de paiement sur place' : '⏳ Pending / Pay at check-in'}
                  </option>
                  <option value="partial">
                    {language === 'fr' ? '🌓 Acompte versé / Solde à l\'arrivée' : '🌓 Deposit paid / Balance pending'}
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-between p-2 bg-amber-50/70 dark:bg-amber-950/30 rounded-lg border border-amber-200/60 dark:border-amber-900/40 text-[11px]">
                <div className="text-amber-900 dark:text-amber-200">
                  <span className="font-semibold block">Taux de change appliqué :</span>
                  <span>1 EUR = 145.50 DA • 1 USD = 135.00 DA</span>
                </div>
                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded text-[10px] font-bold">
                  DZD / Forex
                </span>
              </div>
            </div>
          </div>

          {/* 6. NOTES & INSTRUCTIONS */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'fr'
                ? 'Remarques / Instructions particulières :'
                : language === 'ar'
                ? 'ملاحظات خاصة:'
                : 'Notes / Special Requests:'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Consignes particulières, heure d'arrivée, accompagnants..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* 7. DEDICATED DOMAIN PRICING BOX */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-xs">
                {priceBreakdown}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white text-base">
                  {totalPrice === 0
                    ? 'Gratuit (0.00)'
                    : `${priceInPaymentCurrency.toLocaleString()} ${currencySymbols[paymentCurrency] || paymentCurrency}`}
                </span>
                {totalPrice > 0 && paymentCurrency !== 'DA' && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ≈ {priceInDzd.toLocaleString()} DA
                  </span>
                )}
                {totalPrice > 0 && paymentCurrency === 'DA' && (
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    ({totalPrice} € base)
                  </span>
                )}
              </div>
            </div>

            {isEditing && selectedBooking && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => downloadICS(selectedBooking)}
                  className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 flex items-center gap-1 hover:bg-white dark:hover:bg-slate-700 transition-colors text-xs font-semibold"
                  title="Télécharger l'événement .ICS"
                >
                  <Download size={14} />
                  <span>.ICS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Voulez-vous supprimer cette fiche de réservation ?')) {
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

          {/* ACTION BUTTONS */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2 z-10">
            {activeDomain === 'hotel' && (
              <div className="flex items-center gap-2 w-full sm:w-auto sm:mr-auto">
                <button
                  type="button"
                  onClick={() => void handleCreateRoomCard()}
                  disabled={isCreatingCard}
                  className={`min-h-11 flex-1 sm:flex-none justify-center px-3 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    isCreatingCard
                      ? 'bg-slate-300 text-slate-600 cursor-wait'
                      : usbConnected
                        ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    usbConnected
                      ? 'Encoder la carte client proUSB pour cette chambre et ce séjour'
                      : "Encodeur proUSB non connecté — branchez-le d'abord dans l'onglet Serrures"
                  }
                >
                  {isCreatingCard ? (
                    <div className="relative w-4 h-4 shrink-0 mr-1">
                      <svg className="w-4 h-4 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${Math.max(5, cardProgress)}, 100`} />
                      </svg>
                    </div>
                  ) : (
                    <KeyRound size={14} />
                  )}
                  <span>
                    {isCreatingCard
                      ? `Encodage… ${Math.round(cardProgress)}%`
                      : language === 'fr'
                        ? 'Créer la carte client'
                        : language === 'ar'
                          ? 'إنشاء بطاقة الضيف'
                          : 'Create Guest Card'}
                  </span>
                </button>
                {!usbConnected && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {language === 'fr'
                      ? 'Encodeur non connecté'
                      : language === 'ar'
                        ? 'المحول غير متصل'
                        : 'Encoder not connected'}
                  </span>
                )}
              </div>
            )}
            {isEditing && selectedBooking && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    updateBookingStatus(selectedBooking.id, 'checked_in');
                    closeModal();
                  }}
                  className="min-h-11 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>{language === 'fr' ? 'Check-in' : 'Check-in'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateBookingStatus(selectedBooking.id, 'checked_out');
                    generateTurnoverTasksForCheckout(selectedBooking.resourceName);
                    closeModal();
                  }}
                  className="min-h-11 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none justify-center px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Effectue le départ et génère les tâches de remise en état chambre"
                >
                  <Sparkles size={14} />
                  <span>{language === 'fr' ? 'Check-out & Turnover' : 'Check-out'}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={closeModal}
              className="min-h-11 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="min-h-11 flex-[2] basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none justify-center px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <CheckCircle2 size={16} />
              <span>
                {isEditing
                  ? language === 'fr'
                    ? 'Enregistrer les modifications'
                    : language === 'ar'
                    ? 'حفظ التعديلات'
                    : 'Save Changes'
                  : language === 'fr'
                  ? 'Confirmer cette réservation'
                  : language === 'ar'
                  ? 'تأكيد الحجز'
                  : 'Confirm Booking'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* ALGERIAN POLICE REGISTRATION SHEET MODAL (Fiche Individuelle de Police) */}
      {showPoliceSheetModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs pms-modal-backdrop overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPoliceSheetModal(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] my-auto pms-modal">
            {/* Header */}
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-200" />
                <div>
                  <h4 className="font-bold text-sm leading-tight">
                    Fiche Individuelle de Police • بطاقة الشرطة الفردية
                  </h4>
                  <p className="text-[11px] text-emerald-100">
                    Réglementation Hôtelière Algérienne — Déclaration DGSN / Tourisme
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPoliceSheetModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Document Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
              <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-3">
                <p className="font-bold text-[13px] tracking-wide">الجمهورية الجزائرية الديمقراطية الشعبية</p>
                <p className="font-bold text-[12px] tracking-wide text-slate-700 dark:text-slate-300">
                  RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  وزارة السياحة والصناعة التقليدية • المديرية العامة للأمن الوطني (DGSN)
                </p>
                <h3 className="font-extrabold text-sm uppercase mt-2 tracking-widest text-emerald-800 dark:text-emerald-300">
                  FICHE DE DÉCLARATION DU SÉJOURNANT EN ÉTABLISSEMENT D'HÉBERGEMENT
                </h3>
              </div>

              {/* Grid Details */}
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-emerald-700 dark:text-emerald-400">
                    1. Renseignements Personnels du Locataire / هوية النزيل
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block">Nom & Prénom :</span>
                      <span className="font-bold text-slate-900 dark:text-white">{guestName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Statut / Nationalité :</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {guestType === 'algerian' ? '🇩🇿 Algérienne (Citoyen National)' : `🌐 ${foreignNationality}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pièce d'Identité :</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {guestType === 'algerian'
                          ? `${algerianIdType.toUpperCase()}: ${algerianIdNumber || 'Non renseigné'}`
                          : `Passeport: ${passportNumber || 'Non renseigné'}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        {guestType === 'algerian' ? 'Wilaya d\'origine / Résidence :' : 'Visa / Entrée :'}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {guestType === 'algerian'
                          ? wilayaOfOrigin
                          : `Visa N°: ${visaNumber || '—'} (Entrée: ${entryDateInCountry || '—'})`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Contact Téléphonique :</span>
                      <span className="font-medium text-slate-900 dark:text-white">{guestPhone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Email :</span>
                      <span className="font-medium text-slate-900 dark:text-white">{guestEmail || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-blue-700 dark:text-blue-400">
                    2. Modalités du Séjour Hôtelier / تفاصيل الإقامة
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block">Chambre / Hébergement :</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {currentResource?.name || 'Chambre'} ({currentResource?.type || 'Hébergement'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Nombre d'Occupants dans la Chambre :</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {activeDomain === 'hotel'
                          ? `${hotelAdults} adulte(s) ${hotelChildren > 0 ? `+ ${hotelChildren} enfant(s)` : ''}`
                          : `${resortOccupants} occupant(s)`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Date d'Arrivée (Check-in) :</span>
                      <span className="font-medium text-slate-900 dark:text-white">{startDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Date de Départ Prévue (Check-out) :</span>
                      <span className="font-medium text-slate-900 dark:text-white">{endDate || startDate}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-400">
                    3. Règlement & Devises / الدفع والعملة
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block">Devise Facturée :</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {paymentCurrency} ({currencySymbols[paymentCurrency] || paymentCurrency})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Montant Facturé :</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {priceInPaymentCurrency.toLocaleString()} {currencySymbols[paymentCurrency] || paymentCurrency}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Contre-valeur DZD (DA) :</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {priceInDzd.toLocaleString()} DA
                      </span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-300 dark:border-slate-700">
                  <div className="h-20 border border-slate-300 dark:border-slate-700 rounded-lg p-2 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Signature du Séjournant / تأشيرة النزيل
                    </span>
                    <span className="text-[10px] text-slate-400 italic">Mention "Lu et approuvé"</span>
                  </div>
                  <div className="h-20 border border-slate-300 dark:border-slate-700 rounded-lg p-2 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Cachet & Visa de l'Hôtel / خاتم المؤسسة الفندقية
                    </span>
                    <span className="text-[10px] text-slate-400 italic">Réceptionniste de service</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Formulaire conforme au Décret exécutif n° 08-364 relatif aux établissements hôteliers.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 text-white dark:text-slate-900 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Imprimer la Fiche</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPoliceSheetModal(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {roomStatusAlert && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-black/70 pms-modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="room-status-alert-title">
          <div className="w-full max-w-md rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3 pms-modal">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><AlertCircle size={22} /><h3 id="room-status-alert-title" className="font-extrabold text-base">{language === 'ar' ? 'لا يمكن إنشاء الحجز' : language === 'en' ? 'Reservation blocked' : 'Réservation impossible'}</h3></div>
            <p className="text-sm text-slate-700 dark:text-slate-200">{language === 'ar' ? 'يجب أن تكون الغرفة نظيفة ومتاحة (الحالة الخضراء) قبل إنشاء الحجز.' : language === 'en' ? 'The room must be clean and available (green status) before a reservation can be created.' : 'La chambre doit être propre et disponible (statut vert) avant de créer une réservation.'}</p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm space-y-1">
              <div><strong>{language === 'ar' ? 'الغرفة' : language === 'en' ? 'Room' : 'Chambre'} :</strong> {roomStatusAlert.roomName}</div>
              <div><strong>{language === 'ar' ? 'الحالة' : language === 'en' ? 'Status' : 'Statut'} :</strong> {roomStatusAlert.status === 'cleaning' ? (language === 'en' ? 'Cleaning' : language === 'ar' ? 'قيد التنظيف' : 'Nettoyage en cours') : roomStatusAlert.status === 'dirty' ? (language === 'en' ? 'Dirty' : language === 'ar' ? 'متسخة' : 'Sale') : roomStatusAlert.status === 'out_of_order' ? (language === 'en' ? 'Out of order' : language === 'ar' ? 'خارج الخدمة' : 'Hors service') : (language === 'en' ? 'Unconfirmed' : language === 'ar' ? 'غير مؤكدة' : 'Non confirmée')}</div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{language === 'ar' ? 'اطلب من التدبير المنزلي تحديث حالة الغرفة إلى نظيفة بعد contrôle.' : language === 'en' ? 'Ask housekeeping to update the room to Clean after inspection.' : 'Demandez au service d’étage de contrôler la chambre puis de passer son statut à « Propre ».'}</p>
            <div className="flex justify-end"><button type="button" onClick={() => setRoomStatusAlert(null)} className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm">{language === 'ar' ? 'حسنًا' : language === 'en' ? 'Understood' : 'Compris'}</button></div>
          </div>
        </div>
      )}

      {/* Indicateur circulaire de progression immersif lors de la création de la carte */}
      <CardCreationProgressModal
        isOpen={isCreatingCard}
        progress={cardProgress}
        cardTitle={`Carte Client · ${currentResource?.name || resourceNameFallback || 'Chambre'} (${guestName || 'Client'})`}
        statusText="Encodage RFID et vérification en cours..."
      />

      {/* Card creation result — success or failure dialog */}
      <CardResultDialog result={cardResult} onClose={() => setCardResult(null)} />
    </div>
  );
};
