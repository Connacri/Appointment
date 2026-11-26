import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Coins,
  Package,
  History,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import {
  isValidBookingDateRange,
  isValidEmailAddress,
  isValidPhoneNumber,
  validateBookingOccupants,
  type OccupantValidationError,
} from '../utils/bookingValidation';
import { buildNormalizedOccupantList, normalizeOccupantEntry } from '../utils/bookingOccupants';
import { BookingOccupant, BookingStatus, DomainType, TimelineBooking, ResourceItem } from '../types/booking';
import { domainConfigs } from '../data/mockData';
import { statusConfig } from './LegendBar';
import { downloadICS } from '../utils/icsExport';
import { isRoomReadyForBooking } from '../utils/roomReadiness';
import { lockManager } from '../locks/lockManager';
import { CardResultDialog, CardResult } from './CardResultDialog';
import { CardCreationProgressModal } from './CardCreationProgressModal';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { PoliceSheetModal } from './PoliceSheetModal';
import { ALGERIA_69_WILAYAS } from '../data/algeriaWilayas';
import { HOSPITALITY_MEAL_PLANS, DIETARY_PREFERENCES } from '../data/mealPlans';
import { KeyRound, Loader2, Utensils, UtensilsCrossed, ShieldAlert, Award, FileSpreadsheet } from 'lucide-react';
import { normalizeBookingText } from '../utils/bookingText';
import { resolveGuestAlertSourceForRole } from '../utils/rolePermissions';
import {
  buildBookingModalSummary,
  buildGuestCheckoutPayload,
  resolveHeldValuablesOnCheckout,
} from '../utils/bookingSummary';

/**
 * Imported or legacy bookings can miss text fields (guest name, e-mail, alert
 * text). Reading them directly throws during render, which unmounts the whole
 * React tree and leaves a blank page — exactly what happened right after a
 * booking was confirmed. Every booking-side string comparison goes through here.
 */
const bookingText = normalizeBookingText;

export const BookingModal: React.FC = () => {
  const {
    language,
    isNewBookingModalOpen,
    setIsNewBookingModalOpen,
    newBookingInitialSlot,
    selectedBooking,
    setSelectedBooking,
    addBooking,
    checkConflict,
    updateBooking,
    reassignBookingRoom,
    updateBookingStatus,
    deleteBooking,
    currentBaseDate,
    currentDomain,
    currentRole,
    activeRoleDefinition,
    clientProfile,
    resourceGroups,
    selectedBuildingGroupId,
    bookings,
    generateTurnoverTasksForCheckout,
    currency,
    establishmentProfile,
    lastCreatedInvoice,
    setLastCreatedInvoice,
    createInvoiceFromBooking,
  } = useApp();

  const isEditing = !!selectedBooking;
  const isOpen = isNewBookingModalOpen || isEditing;
  const isRoomCellBooking = !isEditing && !!newBookingInitialSlot?.resourceId;

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
  const [editingRoomId, setEditingRoomId] = useState<string>('');
  const [editingRoomPriceDiff, setEditingRoomPriceDiff] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [adultGuests, setAdultGuests] = useState<BookingOccupant[]>([]);
  const [childGuests, setChildGuests] = useState<BookingOccupant[]>([]);
  const [occupantErrors, setOccupantErrors] = useState<OccupantValidationError[]>([]);
  const [showOccupantValidation, setShowOccupantValidation] = useState(false);
  const [startDate, setStartDate] = useState(currentBaseDate);
  const [endDate, setEndDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [status, setStatus] = useState<BookingStatus>('confirmed');
  const [notes, setNotes] = useState('');
  const [valuablesText, setValuablesText] = useState('');
  const [forgottenText, setForgottenText] = useState('');
  const [guestAlertsText, setGuestAlertsText] = useState('');
  const [pendingCheckoutPrompt, setPendingCheckoutPrompt] = useState<{
    mode: 'checkout' | 'guest_left';
    returnedById: Record<string, boolean>;
  } | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<{ title: string; message: string } | null>(null);
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
  const [idDocumentExpiryDate, setIdDocumentExpiryDate] = useState('');
  const [visaExpiryDate, setVisaExpiryDate] = useState('');
  const [matchedGuestHistory, setMatchedGuestHistory] = useState<TimelineBooking | null>(null);
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

  useEffect(() => {
    if (!isOpen || selectedBooking || activeRoleDefinition.permissions.isClientPortal) return;
    const name = guestName.trim().toLocaleLowerCase();
    const email = guestEmail.trim().toLocaleLowerCase();
    if (name.length < 4 && !email.includes('@')) { setMatchedGuestHistory(null); return; }
    // Imported or legacy bookings may miss these fields (or store dates as Date
    // objects). Normalise them before comparing: an exception raised here escapes
    // the effect, unmounts the React tree and leaves a blank page right after a
    // booking is confirmed, because this effect re-runs as soon as `bookings` changes.
    const sortKey = (booking: TimelineBooking) => {
      const raw: unknown = booking.lastModifiedAt ?? booking.startDate;
      if (raw instanceof Date) return String(raw.getTime());
      return typeof raw === 'string' ? raw : '';
    };
    const previous = bookings
      .filter((booking) => booking.sector === activeDomain)
      .filter((booking) =>
        (email && bookingText(booking.guestEmail) === email) ||
        (name.length >= 4 && bookingText(booking.guestName) === name)
      )
      .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))[0];
    if (!previous) { setMatchedGuestHistory(null); return; }
    setMatchedGuestHistory(previous);
    setGuestName(previous.guestName || guestName);
    setGuestEmail(previous.guestEmail || guestEmail);
    setGuestPhone(previous.guestPhone || guestPhone);
    setGuestType(previous.guestType || (previous.nationality === 'Algérienne' ? 'algerian' : 'foreigner'));
    setForeignNationality(previous.nationality || 'Française');
    setIdPieceType(previous.idPieceType || (previous.identityType === 'passport' ? 'passport' : 'cni'));
    setIdPieceNumber(previous.idPieceNumber || previous.identityNumber || previous.passportNumber || '');
    setAlgerianIdNumber(previous.identityNumber || previous.idPieceNumber || '');
    setPassportNumber(previous.passportNumber || previous.idPieceNumber || '');
    setVisaNumber(previous.visaNumber || '');
    setEntryDateInCountry(previous.entryDateInCountry || '');
    setWilayaOfOrigin(previous.wilayaOfOrigin || previous.wilaya || '31 - Oran');
    setIdDocumentExpiryDate(previous.idDocumentExpiryDate || '');
    setVisaExpiryDate(previous.visaExpiryDate || '');
    setGuestAlertsText((previous.guestAlerts || []).map((alert) => alert?.text ?? '').join('\n'));
  }, [isOpen, guestName, guestEmail, bookings, activeDomain, activeRoleDefinition.permissions.isClientPortal, selectedBooking]);

  const documentExpiryWarning = (date?: string) => {
    if (!date) return null;
    const days = Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: `Expiré depuis ${Math.abs(days)} jour(s)`, tone: 'red' };
    if (days <= 30) return { label: days === 0 ? 'Expire aujourd’hui' : `Expire dans ${days} jour(s)`, tone: 'amber' };
    return { label: `Valide encore ${days} jour(s)`, tone: 'green' };
  };

  // Formule de Pension & Restauration (inspiré Booking & Airbnb)
  const [selectedMealPlanId, setSelectedMealPlanId] = useState<string>('bb');
  const [selectedDietary, setSelectedDietary] = useState<string[]>(['halal']);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [guestAgeBracket, setGuestAgeBracket] = useState<string>('');
  const [clientSegment, setClientSegment] = useState<string>('');

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
  const [requestedCardCount, setRequestedCardCount] = useState(2);
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingConfirmation, setBookingConfirmation] = useState<any | null>(null);
  const [cardsCreatedCount, setCardsCreatedCount] = useState(0);
  const [cardResult, setCardResult] = useState<CardResult | null>(null);
  const [usbConnected, setUsbConnected] = useState<boolean>(lockManager.getStatus() === 'connected');
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [confirmDeleteBooking, setConfirmDeleteBooking] = useState(false);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);

  // A confirmed booking must never leak into the next sheet: reopening the dialog
  // used to show the previous confirmation (and its step indicator) instead of a
  // fresh form. Reset the confirmation, the step and the card counters on open.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setBookingConfirmation(null);
      setBookingStep(0);
      setCardsCreatedCount(0);
      setRequestedCardCount(2);
      setCardResult(null);
      setConflictError(null);
      setConfirmDeleteBooking(false);
      setPendingCheckoutPrompt(null);
      setCheckoutNotice(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

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
      const normalizedOccupants = buildNormalizedOccupantList(selectedBooking);
      setResourceId(selectedBooking.resourceId);
      setGuestName(selectedBooking.guestName || '');
      setGuestEmail(selectedBooking.guestEmail || '');
      setGuestPhone(selectedBooking.guestPhone || '');
      setAdultGuests(normalizedOccupants.adults);
      setChildGuests(normalizedOccupants.children);
      setOccupantErrors([]);
      setShowOccupantValidation(false);
      setStartDate(selectedBooking.startDate || currentBaseDate);
      setEndDate(selectedBooking.endDate || selectedBooking.startDate);
      setCheckInTime(selectedBooking.checkInTime || '14:00');
      setCheckOutTime(selectedBooking.checkOutTime || '12:00');
      setStatus(selectedBooking.status || 'confirmed');
      setNotes(selectedBooking.notes || '');
      setValuablesText((selectedBooking.valuablesAtReception || []).filter((item) => item.status === 'held').map((item) => item.description).join('\n'));
      setForgottenText((selectedBooking.forgottenItems || []).filter((item) => item.status === 'stored').map((item) => item.description).join('\n'));
      setGuestAlertsText((selectedBooking.guestAlerts || []).map((item) => item.text).join('\n'));
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
      setIdDocumentExpiryDate(selectedBooking.idDocumentExpiryDate || '');
      setVisaExpiryDate(selectedBooking.visaExpiryDate || '');
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

      // Hydrate custom metadata and authoritative occupancy counts
      const meta = selectedBooking.customMetadata || {};
      const hydratedExtras = Array.isArray(meta.selectedExtras)
        ? meta.selectedExtras.filter((item: unknown): item is string => typeof item === 'string')
        : [];
      setSelectedExtras(hydratedExtras);
      setGuestAgeBracket(typeof meta.guestAgeBracket === 'string' ? meta.guestAgeBracket : '');
      setClientSegment(typeof meta.clientSegment === 'string' ? meta.clientSegment : '');
      const resolvedAdults = selectedBooking.adults ?? (selectedBooking.sector === 'resort' ? meta.resortOccupants : meta.hotelAdults);
      const resolvedChildren = selectedBooking.children ?? meta.hotelChildren ?? 0;
      if (selectedBooking.sector === 'hotel') {
        setHotelAdults(Math.max(1, Number(resolvedAdults) || 1));
        setHotelChildren(Math.max(0, Number(resolvedChildren) || 0));
        if (meta.hotelMealPlan) setHotelMealPlan(meta.hotelMealPlan);
        if (meta.hotelCheckinTime) setHotelCheckinTime(meta.hotelCheckinTime);
        if (meta.hotelOptionBabyBed !== undefined) setHotelOptionBabyBed(meta.hotelOptionBabyBed);
        if (meta.hotelOptionHighFloor !== undefined) setHotelOptionHighFloor(meta.hotelOptionHighFloor);
        if (meta.hotelOptionPet !== undefined) setHotelOptionPet(meta.hotelOptionPet);
        if (meta.hotelOptionWelcomeGift !== undefined) setHotelOptionWelcomeGift(meta.hotelOptionWelcomeGift);
      } else if (selectedBooking.sector === 'resort') {
        setResortOccupants(Math.max(1, Number(resolvedAdults) || 1));
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

      setCheckInTime(newBookingInitialSlot?.time || '14:00');
      setCheckOutTime('12:00');
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

      if (activeRoleDefinition.permissions.isClientPortal) {
        setGuestName(clientProfile.name);
        setGuestEmail(clientProfile.email);
        setGuestPhone(clientProfile.phone);
      } else {
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
      }
      setAdultGuests([]);
      setChildGuests([]);
      setOccupantErrors([]);
      setShowOccupantValidation(false);
      setStatus('confirmed');
      setNotes('');
      setValuablesText('');
      setForgottenText('');
      setGuestAlertsText('');
      setPaymentStatus('paid');
      setConflictError(null);
      setGuestType('algerian');
      setIdPieceType('cni');
      setIdPieceNumber('');
      setIdDocumentExpiryDate('');
      setVisaExpiryDate('');
      setMatchedGuestHistory(null);
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
      setGuestAgeBracket('');
      setClientSegment('');
      setPaymentCurrency(currency || 'DA');
      setPaymentMethodType('cash_dzd');
    }
  }, [isOpen, selectedBooking, newBookingInitialSlot, currentBaseDate, activeDomain, domainResources, activeRoleDefinition.permissions.isClientPortal, clientProfile]);

  // Keep adult & child occupant arrays sized to active occupancy and synchronize Person #1 with primary guest fields
  useEffect(() => {
    const adultTarget = activeDomain === 'hotel' ? hotelAdults : activeDomain === 'resort' ? resortOccupants : 1;
    const childTarget = activeDomain === 'hotel' ? hotelChildren : 0;

    setAdultGuests((current) =>
      Array.from({ length: adultTarget }, (_, index) => {
        if (index === 0) {
          return normalizeOccupantEntry(
            {
              ...(current[0] || {}),
              fullName: guestName,
              phone: guestPhone,
              email: guestEmail,
              documentType: idPieceType,
              documentNumber: idPieceNumber,
              documentExpiryDate: idDocumentExpiryDate || undefined,
            },
            { index: 0, role: 'adult', isPrimary: true }
          );
        }
        return normalizeOccupantEntry(current[index], {
          index,
          role: 'adult',
          isPrimary: false,
        });
      })
    );

    setChildGuests((current) =>
      Array.from({ length: childTarget }, (_, index) =>
        normalizeOccupantEntry(current[index], {
          index: adultTarget + index,
          role: 'child',
          isPrimary: false,
        })
      )
    );
  }, [
    hotelAdults,
    hotelChildren,
    resortOccupants,
    activeDomain,
    guestName,
    guestPhone,
    guestEmail,
    idPieceType,
    idPieceNumber,
    idDocumentExpiryDate,
  ]);

  const updateAdultOccupantField = (
    index: number,
    field: keyof BookingOccupant,
    value: string
  ) => {
    if (index === 0) {
      if (field === 'fullName') setGuestName(value);
      else if (field === 'phone') setGuestPhone(value);
      else if (field === 'email') setGuestEmail(value);
      else if (field === 'documentType') {
        setIdPieceType(value as typeof idPieceType);
        if (value === 'cni') setAlgerianIdType('cni');
      } else if (field === 'documentNumber') {
        setIdPieceNumber(value);
        setAlgerianIdNumber(value);
        setPassportNumber(value);
      } else if (field === 'documentExpiryDate') {
        setIdDocumentExpiryDate(value);
      }
      return;
    }

    setAdultGuests((current) =>
      current.map((item, i) =>
        i === index
          ? normalizeOccupantEntry(
              { ...item, [field]: value },
              { index: i, role: 'adult', isPrimary: false }
            )
          : item
      )
    );
  };

  const updateChildOccupantField = (
    childIndex: number,
    field: keyof BookingOccupant,
    value: string
  ) => {
    const adultOffset = activeDomain === 'hotel' ? hotelAdults : activeDomain === 'resort' ? resortOccupants : 1;
    setChildGuests((current) =>
      current.map((item, i) =>
        i === childIndex
          ? normalizeOccupantEntry(
              { ...item, [field]: value },
              { index: adultOffset + i, role: 'child', isPrimary: false }
            )
          : item
      )
    );
  };

  const applyPrimaryContactToChild = (childIndex: number) => {
    const adultOffset = activeDomain === 'hotel' ? hotelAdults : activeDomain === 'resort' ? resortOccupants : 1;
    setChildGuests((current) =>
      current.map((item, i) =>
        i === childIndex
          ? normalizeOccupantEntry(
              {
                ...item,
                phone: guestPhone.trim() || item.phone,
                email: guestEmail.trim() || item.email,
              },
              { index: adultOffset + i, role: 'child', isPrimary: false }
            )
          : item
      )
    );
  };

  // Card quantity defaults to all occupants; reception can override it.
  const occupantCount = activeDomain === 'hotel' ? hotelAdults + hotelChildren : activeDomain === 'resort' ? resortOccupants : 1;
  useEffect(() => {
    setRequestedCardCount(Math.max(1, occupantCount));
  }, [occupantCount]);

  // Live occupant validation errors when validation is triggered
  const normalizedOccupantsPreview = useMemo(() => {
    const adultsTarget = activeDomain === 'hotel' ? hotelAdults : activeDomain === 'resort' ? resortOccupants : 1;
    const childrenTarget = activeDomain === 'hotel' ? hotelChildren : 0;
    return buildNormalizedOccupantList({
      sector: activeDomain,
      guestName,
      guestPhone,
      guestEmail,
      idPieceType,
      idPieceNumber,
      identityNumber: algerianIdNumber,
      passportNumber,
      idDocumentExpiryDate,
      adults: adultsTarget,
      children: childrenTarget,
      adultGuests: adultGuests.slice(0, adultsTarget),
      occupantsList: [
        ...adultGuests.slice(0, adultsTarget),
        ...childGuests.slice(0, childrenTarget),
      ],
    });
  }, [
    activeDomain,
    hotelAdults,
    hotelChildren,
    resortOccupants,
    guestName,
    guestPhone,
    guestEmail,
    idPieceType,
    idPieceNumber,
    algerianIdNumber,
    passportNumber,
    idDocumentExpiryDate,
    adultGuests,
    childGuests,
  ]);

  const liveOccupantCheck = useMemo(() => {
    return validateBookingOccupants(
      {
        sector: activeDomain,
        guestName,
        guestPhone,
        guestEmail,
        idPieceType,
        idPieceNumber,
        specialAuthorizationDesc,
        adults: normalizedOccupantsPreview.adultsCount,
        children: normalizedOccupantsPreview.childrenCount,
        adultGuests: normalizedOccupantsPreview.adults,
        occupantsList: normalizedOccupantsPreview.allOccupants,
      },
      language
    );
  }, [
    activeDomain,
    guestName,
    guestPhone,
    guestEmail,
    idPieceType,
    idPieceNumber,
    specialAuthorizationDesc,
    normalizedOccupantsPreview,
    language,
  ]);

  useEffect(() => {
    if (showOccupantValidation) {
      setOccupantErrors(liveOccupantCheck.errors);
    }
  }, [showOccupantValidation, liveOccupantCheck]);

  const getFieldError = (personIndex: number, field: OccupantValidationError['field']): string | undefined => {
    if (!showOccupantValidation) return undefined;
    return occupantErrors.find((err) => err.personIndex === personIndex && err.field === field)?.message;
  };

  // Current selected resource
  const currentResource = useMemo(() => {
    return domainResources.find((r) => r.id === resourceId) || domainResources[0] || null;
  }, [domainResources, resourceId]);

  // Room price difference when editing (new resource daily price - old resource daily price)
  const priceDiffDaily = useMemo(() => {
    if (!editingRoomId || !currentResource) return 0;
    const newResource = domainResources.find((r) => r.id === editingRoomId);
    if (!newResource) return 0;
    return (newResource.pricePerDay || 0) - (currentResource?.pricePerDay || 0);
  }, [editingRoomId, currentResource, domainResources]);

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
      let record: Awaited<ReturnType<typeof lockManager.issueGuestCardFromBooking>> | null = null;
      let successfulCards = 0;
      const cardsRemaining = Math.max(0, requestedCardCount - cardsCreatedCount);
      if (cardsRemaining === 0) throw new Error('Le nombre de cartes demandé a déjà été encodé.');
      for (let index = 0; index < cardsRemaining; index += 1) {
        const bookingForCard = bookingConfirmation || selectedBooking;
        if (!bookingForCard?.id) {
          throw new Error('Enregistrez la réservation avant de créer les cartes de chambre.');
        }
        record = await lockManager.issueGuestCardFromBooking(
          { id: bookingForCard.id, guestName: bookingForCard.guestName || guestName || 'Client', resourceName: bookingForCard.resourceName || currentResource?.name || resourceNameFallback, buildingNo: currentResource?.building !== undefined ? Number.parseInt(currentResource.building, 10) : undefined, floorNo: currentResource?.floor !== undefined ? Number.parseInt(currentResource.floor, 10) : undefined, startDate: bookingForCard.startDate || startDate, endDate: bookingForCard.endDate || endDate },
          'Admin',
        );
        successfulCards += 1;
        setCardsCreatedCount((previous) => previous + 1);
        setCardProgress(Math.round(((index + 1) / Math.max(1, cardsRemaining)) * 100));
      }
      if (!record) throw new Error('Aucune carte n’a été créée.');
      clearInterval(progressTimer);
      setCardProgress(100);
      await lockManager.notifySuccess();
      setCardResult({
        success: true,
        title: `${successfulCards} carte(s) encodée(s) avec succès`,
        message: `${successfulCards} carte(s) ont été encodées pour la chambre ${record.roomNumber || currentResource?.name}, au nom de ${record.holderName}. Validité jusqu'au ${record.validUntil}.`,
        details: [ { label: 'Chambre', value: record.roomNumber || '—' }, { label: 'Client', value: record.holderName }, { label: 'Cartes créées', value: String(successfulCards) }, { label: 'Expire le', value: record.validUntil }, { label: 'Dernière trame (hex)', value: record.rawHex } ],
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
  const submitInFlightRef = useRef(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    try {
    const isChangingRoom = !isEditing || selectedBooking?.resourceId !== resourceId;
    if (activeDomain === 'hotel' && !isEditing && isChangingRoom && (!currentResource || !isRoomReadyForBooking(currentResource.housekeepingStatus))) {
      setRoomStatusAlert({ roomName: currentResource?.name ?? '—', status: currentResource?.housekeepingStatus });
      return;
    }

    const effectiveEndDate = endDate || startDate;
    if (!isValidBookingDateRange(startDate, effectiveEndDate)) {
      setConflictError(getTranslation('bookingInvalidDateRange', language));
      return;
    }
    if (activeDomain === 'hotel') {
      const startAt = new Date(`${startDate}T${checkInTime}:00`).getTime();
      const endAt = new Date(`${effectiveEndDate}T${checkOutTime}:00`).getTime();
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
        setConflictError('L’heure de départ doit être postérieure à l’heure d’arrivée.');
        return;
      }
    }

    // Strict validation of ALL occupants & coordinates before checkConflict / write
    setShowOccupantValidation(true);
    setOccupantErrors(liveOccupantCheck.errors);
    if (!liveOccupantCheck.valid) {
      setConflictError(
        liveOccupantCheck.summaryError ||
          getTranslation('bookingOccupantsRuleBanner', language)
      );
      const firstErr = liveOccupantCheck.errors[0];
      const targetAnchor =
        firstErr && firstErr.personIndex === 0 && (firstErr.field === 'fullName' || firstErr.field === 'phone' || firstErr.field === 'email')
          ? 'booking-step-guest'
          : firstErr && firstErr.personIndex === 0 && (firstErr.field === 'documentNumber' || firstErr.field === 'documentType' || firstErr.field === 'specialAuthorizationDesc')
          ? 'booking-step-police'
          : 'booking-step-occupants';
      document.getElementById(targetAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (!isEditing && activeDomain === 'hotel' && checkConflict(resourceId, startDate, effectiveEndDate, undefined, checkInTime, checkOutTime)) {
      setConflictError('Cette chambre n’est pas disponible sur ce créneau. Vérifiez les heures ou choisissez une autre chambre.');
      return;
    }
    setConflictError(null);

    const totalAdults = normalizedOccupantsPreview.adultsCount;
    const totalChildren = normalizedOccupantsPreview.childrenCount;

    // Build custom domain metadata payload & structured extras
    const paxForExtras = activeDomain === 'hotel' ? totalAdults : Math.max(1, resortOccupants);
    const extraCatalogMap: Record<string, { label: string; amount: number }> = {
      grab_go: { label: 'Grab & Go (Petit-déj emporté)', amount: 12 * paxForExtras * calculatedDays },
      picnic: { label: 'Panier Pique-Nique Excursion', amount: 20 * paxForExtras },
      romantic: { label: 'Dîner Romantique Chandelles VIP', amount: 65 },
      private_chef: { label: 'Barbecue & Chef Privé en Villa', amount: 95 },
    };
    const formExtras: Array<{ label: string; amount: number; category?: string }> = selectedExtras
      .filter((id) => Boolean(extraCatalogMap[id]))
      .map((id) => ({
        label: extraCatalogMap[id].label,
        amount: extraCatalogMap[id].amount,
        category: 'booking_extra',
      }));
    const existingNonFormExtras = (selectedBooking?.extras || []).filter(
      (item) => item.category !== 'booking_extra'
    );
    const combinedExtras = [...existingNonFormExtras, ...formExtras];

    let customMetadata: Record<string, any> = {
      selectedExtras: [...selectedExtras],
      ...(guestAgeBracket ? { guestAgeBracket } : {}),
      ...(clientSegment ? { clientSegment } : {}),
    };
    if (activeDomain === 'hotel') {
      customMetadata = {
        ...customMetadata,
        hotelAdults: totalAdults,
        hotelChildren: totalChildren,
        hotelMealPlan,
        hotelCheckinTime,
        hotelOptionBabyBed,
        hotelOptionHighFloor,
        hotelOptionPet,
        hotelOptionWelcomeGift,
      };
    } else if (activeDomain === 'resort') {
      customMetadata = {
        ...customMetadata,
        resortOccupants: totalAdults,
        resortFormula,
        resortCheckinTime,
        resortOptionPrivatePool,
        resortOptionBeachCabana,
        resortOptionVipTransfer,
        resortOptionGolfBuggy,
      };
    }

    const computedOriginalAmount = Math.round(totalPrice * (ratesFromEur[paymentCurrency] || 1));
    const computedRateToDzd = ratesFromEur['DA'] / (ratesFromEur[paymentCurrency] || 1);

    const roleLabel = activeRoleDefinition.label[language] || activeRoleDefinition.label.fr || currentRole;
    const currentUserName = `${roleLabel} (${clientProfile?.name || roleLabel})`;
    const nowIso = new Date().toISOString();
    const effectivePrimaryDocNum = idPieceNumber || (guestType === 'algerian' ? algerianIdNumber : passportNumber);

    if (isEditing && selectedBooking) {
      const historyEntry = {
        timestamp: nowIso,
        modifiedBy: currentUserName,
        changes: `Mise à jour: ${guestName}, Dates: ${startDate} au ${effectiveEndDate}, Statut: ${status}, Pension: ${selectedMealPlanId.toUpperCase()}, Pièce: ${idPieceType}`,
      };
      const updatedHistory = [...(selectedBooking.modificationHistory || []), historyEntry];

      const roomSwapRequired = selectedBooking.resourceId !== resourceId
        && checkConflict(resourceId, startDate, effectiveEndDate, selectedBooking.id, checkInTime, checkOutTime);
      if (roomSwapRequired && !window.confirm(
        language === 'fr'
          ? 'Cette chambre est déjà attribuée à un autre séjour. Voulez-vous permuter les deux chambres ? Les deux réservations seront contrôlées et enregistrées ensemble.'
          : language === 'ar'
            ? 'هذه الغرفة مخصصة لإقامة أخرى. هل تريد تبديل الغرفتين؟ سيتم التحقق من الحجزين وحفظهما معًا.'
            : 'This room is assigned to another stay. Swap the two rooms? Both bookings will be validated and saved together.'
      )) return;
      const updateRes = await reassignBookingRoom(selectedBooking.id, {
        resourceId,
        resourceName: currentResource?.name || selectedBooking.resourceName,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        startDate,
        endDate: effectiveEndDate,
        checkInTime,
        checkOutTime,
        status,
        totalPrice,
        paymentStatus,
        notes,
        valuablesAtReception: (selectedBooking.valuablesAtReception || []).filter((item) => item.status !== 'returned').concat(valuablesText.split('\n').map((description) => description.trim()).filter(Boolean).map((description) => ({ id: crypto.randomUUID(), description, status: 'held' as const, recordedAt: nowIso }))),
        forgottenItems: (selectedBooking.forgottenItems || []).filter((item) => item.status !== 'returned').concat(forgottenText.split('\n').map((description) => description.trim()).filter(Boolean).map((description) => ({ id: crypto.randomUUID(), description, status: 'stored' as const, foundAt: nowIso, foundBy: currentUserName }))),
        guestAlerts: (selectedBooking.guestAlerts || []).concat(guestAlertsText.split('\n').map((text) => text.trim()).filter(Boolean).map((text) => ({ id: crypto.randomUUID(), text, source: resolveGuestAlertSourceForRole(activeRoleDefinition), createdAt: nowIso, createdBy: currentUserName }))),
        adults: totalAdults,
        adultGuests: normalizedOccupantsPreview.adults,
        occupantsList: normalizedOccupantsPreview.allOccupants,
        children: totalChildren,
        guestType,
        nationality: guestType === 'algerian' ? 'Algérienne' : foreignNationality,
        identityType: guestType === 'algerian' ? algerianIdType : 'passport',
        identityNumber: effectivePrimaryDocNum,
        idPieceType,
        idPieceNumber: effectivePrimaryDocNum,
        specialAuthorizationDesc: idPieceType === 'special_authorization' ? specialAuthorizationDesc : undefined,
        passportNumber: guestType === 'foreigner' ? (passportNumber || idPieceNumber) : undefined,
        idDocumentExpiryDate: idDocumentExpiryDate || undefined,
        visaExpiryDate: guestType === 'foreigner' ? (visaExpiryDate || undefined) : undefined,
        visaNumber: guestType === 'foreigner' ? visaNumber : undefined,
        entryDateInCountry: guestType === 'foreigner' ? entryDateInCountry : undefined,
        wilayaOfOrigin: guestType === 'algerian' ? wilayaOfOrigin : undefined,
        wilaya: wilayaOfOrigin,
        mealPlan: selectedMealPlanId as any,
        mealPlanDietPreferences: selectedDietary,
        extras: combinedExtras,
        lastModifiedAt: nowIso,
        lastModifiedBy: currentUserName,
        modificationHistory: updatedHistory,
        paymentCurrency,
        originalCurrencyAmount: computedOriginalAmount,
        currencyRateToDzd: computedRateToDzd,
        paymentMethodType,
        customMetadata,
      });
      if (updateRes && !updateRes.success) {
        setConflictError(updateRes.error || getTranslation('bookingOccupantsRuleBanner', language));
        return;
      }
      setSelectedBooking(null);
      setIsNewBookingModalOpen(false);
    } else {
      const initialHistory = [
        {
          timestamp: nowIso,
          modifiedBy: currentUserName,
          changes: `Création du dossier de réservation (${startDate} au ${effectiveEndDate})`,
        },
      ];

      const res = await addBooking({
        resourceId: resourceId || domainResources[0]?.id || 'res_1',
        resourceName: currentResource?.name || 'Ressource',
        sector: activeDomain,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        startDate,
        endDate: effectiveEndDate,
        checkInTime,
        checkOutTime,
        status,
        totalPrice,
        paymentStatus,
        notes,
        valuablesAtReception: valuablesText.split('\n').map((description) => description.trim()).filter(Boolean).map((description) => ({ id: crypto.randomUUID(), description, status: 'held' as const, recordedAt: nowIso })),
        forgottenItems: forgottenText.split('\n').map((description) => description.trim()).filter(Boolean).map((description) => ({ id: crypto.randomUUID(), description, status: 'stored' as const, foundAt: nowIso, foundBy: currentUserName })),
        guestAlerts: guestAlertsText.split('\n').map((text) => text.trim()).filter(Boolean).map((text) => ({ id: crypto.randomUUID(), text, source: resolveGuestAlertSourceForRole(activeRoleDefinition), createdAt: nowIso, createdBy: currentUserName })),
        adults: totalAdults,
        adultGuests: normalizedOccupantsPreview.adults,
        occupantsList: normalizedOccupantsPreview.allOccupants,
        children: totalChildren,
        guestType,
        nationality: guestType === 'algerian' ? 'Algérienne' : foreignNationality,
        identityType: guestType === 'algerian' ? algerianIdType : 'passport',
        identityNumber: effectivePrimaryDocNum,
        idPieceType,
        idPieceNumber: effectivePrimaryDocNum,
        specialAuthorizationDesc: idPieceType === 'special_authorization' ? specialAuthorizationDesc : undefined,
        passportNumber: guestType === 'foreigner' ? (passportNumber || idPieceNumber) : undefined,
        idDocumentExpiryDate: idDocumentExpiryDate || undefined,
        visaExpiryDate: guestType === 'foreigner' ? (visaExpiryDate || undefined) : undefined,
        visaNumber: guestType === 'foreigner' ? visaNumber : undefined,
        entryDateInCountry: guestType === 'foreigner' ? entryDateInCountry : undefined,
        wilayaOfOrigin: guestType === 'algerian' ? wilayaOfOrigin : undefined,
        wilaya: wilayaOfOrigin,
        mealPlan: selectedMealPlanId as any,
        mealPlanDietPreferences: selectedDietary,
        extras: combinedExtras,
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
      if (res.booking) {
        setBookingConfirmation({ ...res.booking, cardCountRequested: requestedCardCount });
        setCardsCreatedCount(0);
        setRequestedCardCount(2);
        setBookingStep(2);
      } else setIsNewBookingModalOpen(false);
    }
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const closeModal = () => {
    setBookingConfirmation(null);
    setIsNewBookingModalOpen(false);
    setSelectedBooking(null);
    setCardsCreatedCount(0);
    setRequestedCardCount(2);
    setConfirmDeleteBooking(false);
    setPendingCheckoutPrompt(null);
    setCheckoutNotice(null);
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
          fr: 'Fiche de Réservation Hôtelière',
          en: 'Hotel Reservation Sheet',
          ar: 'استمارة حجز فندق',
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        className="pms-dialog-panel pms-modal pms-sheet w-full sm:max-w-4xl flex flex-col min-h-0 max-h-[94dvh] sm:max-h-[92dvh] my-0 sm:my-auto rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Modal Dedicated Domain Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
              <DomainHeaderIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h3
                  id="booking-dialog-title"
                  className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg leading-tight truncate"
                >
                  {isEditing
                    ? (language === 'fr'
                        ? 'Modifier la réservation'
                        : language === 'ar'
                        ? 'تعديل الحجز'
                        : 'Edit Reservation')
                    : (language === 'fr'
                        ? 'Nouvelle réservation'
                        : language === 'ar'
                        ? 'حجز جديد'
                        : 'New Reservation')}
                </h3>
                {(isRoomCellBooking || (isEditing && selectedBooking?.resourceName)) && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0">
                    {currentResource?.name || selectedBooking?.resourceName || resourceNameFallback}
                  </span>
                )}
                {isEditing && selectedBooking && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                      statusConfig[selectedBooking.status]?.pillBg || 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {statusConfig[selectedBooking.status]?.label[language] || selectedBooking.status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                {domainCfg.label[language] || domainCfg.label.en} · {sheetTitle[language] || sheetTitle.en}
                {isEditing && selectedBooking?.guestName ? ` · ${selectedBooking.guestName}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="min-w-11 min-h-11 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
            title={language === 'fr' ? 'Fermer la boîte de dialogue' : language === 'ar' ? 'إغلاق النافذة' : 'Close dialog'}
            aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        {bookingConfirmation ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            <section className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-6">
              <div className="mx-auto max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-7 shadow-sm space-y-5">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center ring-8 ring-emerald-50 dark:ring-emerald-950/40">
                    <CheckCircle2 size={30} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                    {language === 'fr' ? 'Réservation enregistrée' : language === 'ar' ? 'تم تسجيل الحجز' : 'Booking saved'}
                  </p>
                  <h4 className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                    {language === 'fr' ? 'Confirmation du séjour' : language === 'ar' ? 'تأكيد الإقامة' : 'Stay Confirmation'}
                  </h4>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {language === 'fr'
                      ? 'Le dossier est créé. Vous pouvez maintenant encoder les cartes de chambre.'
                      : language === 'ar'
                      ? 'تم إنشاء الملف. يمكنك الآن برمجة بطاقات الغرفة.'
                      : 'The reservation is saved. You can now encode room key cards.'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {language === 'fr' ? 'Référence de réservation' : language === 'ar' ? 'مرجع الحجز' : 'Booking Reference'}
                  </p>
                  <p className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-white break-all">{bookingConfirmation.id}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-start">
                  {[
                    [language === 'fr' ? 'Client' : language === 'ar' ? 'النزيل' : 'Guest', bookingConfirmation.guestName],
                    [language === 'fr' ? 'Chambre' : language === 'ar' ? 'الغرفة' : 'Room', bookingConfirmation.resourceName],
                    [language === 'fr' ? 'Arrivée' : language === 'ar' ? 'الوصول' : 'Check-in', `${bookingConfirmation.startDate} · ${bookingConfirmation.checkInTime || '14:00'}`],
                    [language === 'fr' ? 'Départ' : language === 'ar' ? 'المغادرة' : 'Check-out', `${bookingConfirmation.endDate} · ${bookingConfirmation.checkOutTime || '12:00'}`],
                    [language === 'fr' ? 'Occupants' : language === 'ar' ? 'النزلاء' : 'Guests', `${bookingConfirmation.adults || 1} ${language === 'ar' ? 'بالغ' : 'adult(s)'} · ${bookingConfirmation.children || 0} ${language === 'ar' ? 'طفل' : 'child(ren)'}`],
                    [language === 'fr' ? 'Montant' : language === 'ar' ? 'المبلغ' : 'Amount', `${(bookingConfirmation.originalCurrencyAmount ?? bookingConfirmation.totalPrice ?? totalPrice).toLocaleString()} ${paymentCurrency}`],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3">
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 break-words tabular-nums mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-violet-50/70 dark:bg-violet-950/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-violet-950 dark:text-violet-200">
                        {language === 'fr' ? 'Cartes de chambre RFID' : language === 'ar' ? 'بطاقات الغرفة RFID' : 'RFID Room Cards'}
                      </p>
                      <p className="text-xs mt-0.5 text-violet-800/80 dark:text-violet-300">
                        {language === 'fr' ? 'Quantité demandée' : language === 'ar' ? 'الكمية المطلوبة' : 'Requested'}: {bookingConfirmation.cardCountRequested}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-2xl font-black text-violet-700 dark:text-violet-300 tabular-nums">{cardsCreatedCount}</p>
                      <p className="text-[10px] text-violet-700 dark:text-violet-300">
                        {language === 'fr' ? 'encodée(s)' : language === 'ar' ? 'مُبرمجة' : 'encoded'}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-violet-100 dark:bg-violet-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{ width: `${Math.min(100, (cardsCreatedCount / Math.max(1, bookingConfirmation.cardCountRequested)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateRoomCard()}
                      disabled={isCreatingCard || !usbConnected || cardsCreatedCount >= bookingConfirmation.cardCountRequested}
                      className="flex-1 min-h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <KeyRound size={16} className="shrink-0" />
                      <span>
                        {isCreatingCard
                          ? `Encodage… ${Math.round(cardProgress)}%`
                          : cardsCreatedCount >= bookingConfirmation.cardCountRequested
                          ? (language === 'fr' ? 'Cartes encodées' : language === 'ar' ? 'تمت البرمجة' : 'Cards encoded')
                          : (language === 'fr' ? 'Encoder les cartes' : language === 'ar' ? 'برمجة البطاقات' : 'Encode cards')}
                      </span>
                    </button>
                    <div className="flex items-center justify-between sm:justify-start gap-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 px-3 py-1">
                      <label htmlFor="room-card-count-confirm" className="text-xs font-semibold text-violet-900 dark:text-violet-200">
                        {language === 'fr' ? 'Nombre' : language === 'ar' ? 'العدد' : 'Count'}
                      </label>
                      <input
                        id="room-card-count-confirm"
                        type="number"
                        min={1}
                        max={20}
                        value={requestedCardCount}
                        onChange={(e) => {
                          const value = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                          setRequestedCardCount(value);
                          setBookingConfirmation((current: any) =>
                            current ? { ...current, cardCountRequested: value } : current,
                          );
                        }}
                        className="w-16 h-10 rounded-lg border border-violet-200 dark:border-violet-800 bg-slate-50 dark:bg-slate-950 px-1 text-center text-sm font-bold tabular-nums"
                        aria-label={language === 'fr' ? 'Nombre de cartes à encoder' : 'Number of cards to encode'}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-violet-800 dark:text-violet-300">
                    {usbConnected
                      ? (language === 'fr' ? 'Encodeur proUSB connecté : prêt à encoder.' : language === 'ar' ? 'المبرمج متصل وجاهز.' : 'proUSB encoder connected: ready.')
                      : (language === 'fr' ? 'Connectez l’encodeur proUSB dans Serrures pour créer les cartes.' : language === 'ar' ? 'وصّل مبرمج proUSB لإنشاء البطاقات.' : 'Connect proUSB encoder in Locks to encode cards.')}
                  </p>
                </div>
              </div>
            </section>
            <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center justify-between sm:block gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {language === 'fr' ? 'Montant confirmé' : language === 'ar' ? 'المبلغ المؤكد' : 'Confirmed total'}
                </span>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                  {(bookingConfirmation.originalCurrencyAmount ?? priceInPaymentCurrency).toLocaleString()} {currencySymbols[paymentCurrency] || paymentCurrency}
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                {(activeDomain === 'hotel' || activeDomain === 'resort') && (
                  <button
                    type="button"
                    onClick={() => setShowPoliceSheetModal(true)}
                    className="min-h-11 px-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <ShieldCheck size={16} className="shrink-0" />
                    <span>
                      {language === 'fr'
                        ? 'Fiche de Police'
                        : language === 'ar'
                        ? 'بطاقة الشرطة'
                        : 'Police Sheet'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="min-h-11 w-full sm:w-auto sm:min-w-44 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-sm cursor-pointer transition-colors"
                >
                  {language === 'fr' ? 'Terminer' : language === 'ar' ? 'إنهاء' : 'Done'}
                </button>
              </div>
            </footer>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Pinned compact booking journey header */}
          <div className="shrink-0 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3.5 sm:px-6 py-2 space-y-1.5 z-10">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0">
                {language === 'fr' ? 'Parcours de réservation' : language === 'ar' ? 'مراحل الحجز' : 'Booking progress'}
              </span>
              <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${((bookingStep + 1) / 3) * 100}%` }} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">{bookingStep + 1}/3</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: language === 'fr' ? 'Client' : language === 'ar' ? 'النزيل' : 'Guest', target: 'booking-step-guest' },
                { label: language === 'fr' ? 'Séjour' : language === 'ar' ? 'الإقامة' : 'Stay', target: 'booking-step-stay' },
                { label: language === 'fr' ? 'Paiement' : language === 'ar' ? 'الدفع' : 'Payment', target: 'booking-step-payment' },
              ].map((step, index) => (
                <button
                  key={step.target}
                  type="button"
                  onClick={() => {
                    setBookingStep(index);
                    document.getElementById(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`rounded-lg h-8 sm:h-9 px-2 text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    bookingStep === index
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-[10px] opacity-75 tabular-nums">0{index + 1}</span>
                  <span className="truncate">{step.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto overscroll-contain space-y-5 text-sm bg-slate-50 dark:bg-slate-950">
          {conflictError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-semibold">{conflictError}</span>
            </div>
          )}

          {/* Traceability, Quick Stay Actions & Modification details (Audit trail) */}
          {isEditing && selectedBooking && (() => {
            const summary = buildBookingModalSummary(selectedBooking, currency, currentResource?.name);
            const resolvedRoomName =
              currentResource?.name?.trim() ||
              selectedBooking.resourceName?.trim() ||
              (language === 'fr' ? 'sélectionnée' : language === 'ar' ? 'المحددة' : 'selected room');
            const resolvedGuestName =
              guestName.trim() ||
              selectedBooking.guestName?.trim() ||
              (language === 'fr' ? 'Client' : language === 'ar' ? 'النزيل' : 'Guest');
            const heldValuables = (selectedBooking.valuablesAtReception || []).filter((item) => item.status === 'held');

            const executeCheckoutAction = async (
              mode: 'checkout' | 'guest_left',
              returnedById?: Record<string, boolean>
            ) => {
              const now = new Date();
              const nowIso = now.toISOString();
              const updatedValuables =
                heldValuables.length > 0 && returnedById
                  ? resolveHeldValuablesOnCheckout(selectedBooking.valuablesAtReception, returnedById, nowIso)
                  : undefined;

              if (mode === 'guest_left') {
                const payload = buildGuestCheckoutPayload(now);
                const result = await updateBooking(selectedBooking.id, {
                  endDate: payload.endDate,
                  checkOutTime: payload.checkOutTime,
                  actualCheckOutAt: payload.actualCheckOutAt,
                  status: 'checked_out',
                  ...(updatedValuables ? { valuablesAtReception: updatedValuables } : {}),
                });
                if (!result.success) {
                  setConflictError(result.error || 'Impossible d’enregistrer le départ.');
                  return;
                }
                setEndDate(payload.endDate);
                setCheckOutTime(payload.checkOutTime);
                setStatus('checked_out');
                generateTurnoverTasksForCheckout(resolvedRoomName);
                setPendingCheckoutPrompt(null);
                setCheckoutNotice({
                  title:
                    language === 'fr'
                      ? 'Départ enregistré'
                      : language === 'ar'
                      ? 'تم تسجيل المغادرة'
                      : 'Guest checkout recorded',
                  message:
                    language === 'fr'
                      ? `Le départ de ${resolvedGuestName} est enregistré à ${payload.checkOutTime}. La chambre ${resolvedRoomName} sera proposée à nouveau à partir de ${payload.turnoverReadyAt} après 10 minutes de remise en état.`
                      : language === 'ar'
                      ? `تم تسجيل مغادرة ${resolvedGuestName} في الساعة ${payload.checkOutTime}. ستصبح الغرفة ${resolvedRoomName} متاحة بعد 10 دقائق (${payload.turnoverReadyAt}).`
                      : `Checkout for ${resolvedGuestName} recorded at ${payload.checkOutTime}. Room ${resolvedRoomName} available from ${payload.turnoverReadyAt} after the 10-minute turnover.`,
                });
              } else {
                const result = await updateBooking(selectedBooking.id, {
                  status: 'checked_out',
                  actualCheckOutAt: nowIso,
                  ...(updatedValuables ? { valuablesAtReception: updatedValuables } : {}),
                });
                if (!result.success) {
                  setConflictError(result.error || 'Impossible d’enregistrer le départ.');
                  return;
                }
                generateTurnoverTasksForCheckout(resolvedRoomName);
                setPendingCheckoutPrompt(null);
                closeModal();
              }
            };

            const requestCheckoutAction = async (mode: 'checkout' | 'guest_left') => {
              if (heldValuables.length > 0) {
                const defaults: Record<string, boolean> = {};
                heldValuables.forEach((item) => {
                  defaults[item.id] = true;
                });
                setPendingCheckoutPrompt({ mode, returnedById: defaults });
                return;
              }
              await executeCheckoutAction(mode);
            };

            const paymentStatusLabel =
              summary.paymentStatus === 'paid'
                ? language === 'fr'
                  ? 'Payé'
                  : language === 'ar'
                  ? 'مدفوع'
                  : 'Paid'
                : summary.paymentStatus === 'partial'
                ? language === 'fr'
                  ? 'Acompte'
                  : language === 'ar'
                  ? 'عربون'
                  : 'Deposit'
                : language === 'fr'
                ? 'En attente'
                : language === 'ar'
                ? 'قيد الانتظار'
                : 'Pending';

            return (
            <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/80 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">
                    {language === 'fr' ? 'Détails du Dossier & Actions' : language === 'ar' ? 'تفاصيل الملف والإجراءات' : 'Booking Dossier & Actions'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-800 font-bold text-blue-700 dark:text-blue-300 shrink-0">
                    #{selectedBooking.id.substring(0, 8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(!showHistoryModal)}
                  className="min-h-10 px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>
                    {showHistoryModal
                      ? (language === 'fr' ? 'Masquer Historique' : language === 'ar' ? 'إخفاء السجل' : 'Hide History')
                      : `${language === 'fr' ? 'Historique' : language === 'ar' ? 'السجل' : 'History'} (${(selectedBooking.modificationHistory?.length || 0) + (selectedBooking.lastModifiedAt ? 1 : 0)})`}
                  </span>
                </button>
              </div>

              {/* At-a-glance Stay Summary (consolidates all stay overview details directly inside the dialog) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
                <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 block">
                    {getTranslation('ganttTenant', language)}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                      {summary.guestType === 'algerian' ? 'DZ' : 'INT'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {summary.guestName}
                    </span>
                  </div>
                  <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                    {summary.roomName}
                  </span>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 block">
                    {getTranslation('ganttOccupants', language)}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-900 dark:text-white tabular-nums">
                    <Users size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{summary.totalOccupants} pers.</span>
                  </div>
                  <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums block">
                    {summary.adults} {language === 'fr' ? 'adulte(s)' : language === 'ar' ? 'بالغ' : 'adult(s)'}
                    {summary.children > 0
                      ? ` · ${summary.children} ${language === 'fr' ? 'enfant(s)' : language === 'ar' ? 'طفل' : 'child(ren)'}`
                      : ''}
                  </span>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 block">
                    {getTranslation('ganttDates', language)}
                  </span>
                  <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white tabular-nums truncate">
                    {summary.startDate} → {summary.endDate}
                  </div>
                  <span className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums block">
                    {summary.checkInTime} → {summary.checkOutTime}
                    {summary.actualCheckOutAt
                      ? ` (${language === 'fr' ? 'parti' : language === 'ar' ? 'غادر' : 'left'} ${new Date(summary.actualCheckOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                      : ''}
                  </span>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 block">
                    {getTranslation('ganttPayment', language)}
                  </span>
                  <div className="mt-1 font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {summary.displayAmount.toLocaleString('fr-FR')} {summary.currency}
                  </div>
                  <span className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                    {paymentStatusLabel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'fr' ? 'Dernière modification : ' : language === 'ar' ? 'آخر تعديل: ' : 'Last updated: '}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                    {selectedBooking.lastModifiedAt
                      ? new Date(selectedBooking.lastModifiedAt).toLocaleString(language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-DZ' : 'en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : (language === 'fr' ? 'Création initiale' : language === 'ar' ? 'إنشاء أولي' : 'Initial creation')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'fr' ? 'Modifié par : ' : language === 'ar' ? 'عُدّل بواسطة: ' : 'Modified by: '}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedBooking.lastModifiedBy || 'Réception'}
                  </span>
                </div>
              </div>

              {checkoutNotice && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-bold">{checkoutNotice.title}</p>
                      <p className="mt-0.5 leading-relaxed">{checkoutNotice.message}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-9 shrink-0 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 text-xs font-semibold cursor-pointer"
                  >
                    {language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              )}

              {pendingCheckoutPrompt && (
                <div
                  role="alertdialog"
                  aria-label={language === 'fr' ? 'Restitution des objets confiés' : 'Return held valuables'}
                  className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 text-xs space-y-2.5"
                >
                  <p className="font-bold text-amber-950 dark:text-amber-200">
                    {language === 'fr'
                      ? `Départ de ${selectedBooking.guestName} : vérifiez les objets confiés à la réception`
                      : language === 'ar'
                      ? `مغادرة ${selectedBooking.guestName}: تحقق من الأمانات المسلمة`
                      : `Departure of ${selectedBooking.guestName}: verify held valuables`}
                  </p>
                  <div className="space-y-1.5">
                    {heldValuables.map((item) => {
                      const isReturned = Boolean(pendingCheckoutPrompt.returnedById[item.id]);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2"
                        >
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{item.description}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPendingCheckoutPrompt((prev) =>
                                  prev ? { ...prev, returnedById: { ...prev.returnedById, [item.id]: true } } : prev
                                )
                              }
                              className={`min-h-9 px-2.5 rounded-md font-semibold cursor-pointer border ${
                                isReturned
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {language === 'fr' ? 'Restitué' : language === 'ar' ? 'تم التسليم' : 'Returned'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingCheckoutPrompt((prev) =>
                                  prev ? { ...prev, returnedById: { ...prev.returnedById, [item.id]: false } } : prev
                                )
                              }
                              className={`min-h-9 px-2.5 rounded-md font-semibold cursor-pointer border ${
                                !isReturned
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {language === 'fr' ? 'Conservé / non réclamé' : language === 'ar' ? 'محفوظ' : 'Kept / unclaimed'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingCheckoutPrompt(null)}
                      className="min-h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        executeCheckoutAction(pendingCheckoutPrompt.mode, pendingCheckoutPrompt.returnedById)
                      }
                      className="min-h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      {language === 'fr' ? 'Confirmer le départ' : language === 'ar' ? 'تأكيد المغادرة' : 'Confirm departure'}
                    </button>
                  </div>
                </div>
              )}

              {/* Stay lifecycle & document quick actions */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void updateBookingStatus(selectedBooking.id, 'checked_in').then((result) => {
                        if (result.success) closeModal();
                        else setConflictError(result.error || 'Impossible d’enregistrer le check-in.');
                      });
                    }}
                    className="min-h-11 justify-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span className="truncate">{language === 'ar' ? 'تسجيل الوصول' : 'Check-in'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { void requestCheckoutAction('checkout'); }}
                    className="min-h-11 justify-center px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title={language === 'fr' ? 'Effectue le départ et génère les tâches de remise en état chambre' : 'Check out and generate turnover tasks'}
                  >
                    <Sparkles size={15} className="shrink-0" />
                    <span className="truncate">{language === 'fr' ? 'Check-out' : language === 'ar' ? 'تسجيل المغادرة' : 'Check-out'}</span>
                  </button>
                  {activeDomain === 'hotel' && !['checked_out', 'cancelled'].includes(selectedBooking.status) && (
                    <button
                      type="button"
                      onClick={() => { void requestCheckoutAction('guest_left'); }}
                      className="min-h-11 justify-center px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title={
                        language === 'fr'
                          ? "Enregistre le départ immédiat à l'heure actuelle (chambre libre après 10 min de remise en état)"
                          : language === 'ar'
                          ? 'تسجيل مغادرة النزيل فورًا بالساعة الحالية'
                          : 'Record immediate guest departure at current time (10-min turnover)'
                      }
                    >
                      <LogOut size={15} className="shrink-0" />
                      <span className="truncate">
                        {language === 'fr' ? 'Locataire parti' : language === 'ar' ? 'غادر النزيل' : 'Guest left'}
                      </span>
                    </button>
                  )}
                  {activeDomain === 'hotel' && selectedBooking.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => {
                        const invoice = createInvoiceFromBooking(selectedBooking, 'invoice');
                        if (invoice) {
                          setIsInvoicePreviewOpen(true);
                        }
                      }}
                      disabled={!createInvoiceFromBooking}
                      className="min-h-11 justify-center px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40 cursor-pointer"
                      title={language === 'fr' ? 'Créer la facture de ce séjour' : 'Create invoice for this stay'}
                    >
                      <FileText size={15} className="shrink-0" />
                      <span className="truncate">{language === 'fr' ? 'Facture' : language === 'ar' ? 'الفاتورة' : 'Invoice'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadICS(selectedBooking)}
                    className="min-h-11 justify-center px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs font-semibold cursor-pointer"
                    title={language === 'fr' ? "Télécharger l'événement .ICS" : 'Download .ICS event'}
                  >
                    <Download size={15} className="shrink-0" />
                    <span>.ICS</span>
                  </button>
                  {!confirmDeleteBooking ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteBooking(true)}
                      className="col-span-2 sm:col-span-1 sm:ms-auto min-h-11 justify-center px-3.5 py-2 border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      title={language === 'fr' ? 'Supprimer cette réservation' : 'Delete booking'}
                    >
                      <Trash2 size={15} className="shrink-0" />
                      <span>{language === 'fr' ? 'Supprimer' : language === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  ) : (
                    <div className="col-span-2 sm:ms-auto flex flex-wrap items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-1.5">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-200 px-1.5">
                        {language === 'fr' ? 'Supprimer ?' : language === 'ar' ? 'تأكيد الحذف؟' : 'Delete?'}
                      </span>
                      <button
                        type="button"
                        disabled={isDeletingBooking}
                        onClick={async () => {
                          setIsDeletingBooking(true);
                          try {
                            await deleteBooking(selectedBooking.id);
                            setConfirmDeleteBooking(false);
                          } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            setConflictError(
                              language === 'fr'
                                ? `Suppression non confirmée : ${message}`
                                : language === 'ar'
                                  ? `لم يتم تأكيد الحذف: ${message}`
                                  : `Deletion was not confirmed: ${message}`,
                            );
                          } finally {
                            setIsDeletingBooking(false);
                          }
                        }}
                        className="min-h-10 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeletingBooking
                          ? (language === 'fr' ? 'Suppression…' : language === 'ar' ? 'جارٍ الحذف…' : 'Deleting…')
                          : (language === 'fr' ? 'Oui, supprimer' : language === 'ar' ? 'نعم، حذف' : 'Confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteBooking(false)}
                        className="min-h-10 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        {language === 'fr' ? 'Non' : language === 'ar' ? 'لا' : 'No'}
                      </button>
                    </div>
                  )}
                </div>

                {/* proUSB RFID Card Encoding Bar (only for confirmed hotel stays) */}
                {activeDomain === 'hotel' && selectedBooking.status === 'confirmed' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => void handleCreateRoomCard()}
                        disabled={isCreatingCard}
                        className={`min-h-11 flex-1 sm:flex-none justify-center px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          isCreatingCard
                            ? 'bg-slate-300 text-slate-700 cursor-wait'
                            : usbConnected
                              ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed'
                        }`}
                        title={
                          usbConnected
                            ? 'Encoder la carte client proUSB pour cette chambre et ce séjour'
                            : "Encodeur proUSB non connecté - branchez-le d'abord dans l'onglet Serrures"
                        }
                      >
                        {isCreatingCard ? (
                          <Loader2 size={15} className="animate-spin shrink-0" />
                        ) : (
                          <KeyRound size={15} className="shrink-0" />
                        )}
                        <span>
                          {isCreatingCard
                            ? `Encodage… ${Math.round(cardProgress)}%`
                            : language === 'fr'
                              ? 'Créer la carte client'
                              : language === 'ar'
                                ? 'إنشاء بطاقة الغرفة'
                                : 'Create Guest Card'}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/70 dark:bg-violet-950/30 px-2.5 py-1">
                        <label htmlFor="room-card-count" className="text-xs font-semibold text-violet-900 dark:text-violet-200 whitespace-nowrap">
                          {language === 'fr' ? 'Cartes' : language === 'ar' ? 'البطاقات' : 'Cards'}
                        </label>
                        <input
                          id="room-card-count"
                          type="number"
                          min={1}
                          max={20}
                          value={requestedCardCount}
                          onChange={(e) => setRequestedCardCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                          className="w-14 h-9 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 px-1 text-center text-xs font-bold text-slate-900 dark:text-white tabular-nums"
                          aria-label={language === 'fr' ? 'Nombre de cartes à créer' : language === 'ar' ? 'عدد البطاقات المطلوبة' : 'Number of cards to create'}
                        />
                        <span className="text-[11px] text-violet-700 dark:text-violet-300 whitespace-nowrap tabular-nums">
                          ({occupantCount} {language === 'ar' ? 'نزيل' : 'occ.'})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-semibold shrink-0">
                      {usbConnected ? (
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} className="shrink-0" />
                          <span>{language === 'fr' ? 'Encodeur proUSB prêt' : language === 'ar' ? 'المبرمج متصل' : 'Encoder ready'}</span>
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>{language === 'fr' ? 'Encodeur non connecté' : language === 'ar' ? 'المبرمج غير متصل' : 'Encoder not connected'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {showHistoryModal && selectedBooking.modificationHistory && selectedBooking.modificationHistory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-1.5 max-h-36 overflow-y-auto">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Historique des modifications :
                  </div>
                  {selectedBooking.modificationHistory.slice().reverse().map((h, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200/70 dark:border-slate-800 text-[11px] flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 dark:text-slate-200 me-2">{h.modifiedBy}</span>
                        <span className="text-slate-600 dark:text-slate-400 break-words">{h.changes}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })()}

          {/* 1. SECTOR RESOURCE ASSIGNMENT (Strictly scoped to activeDomain) */}
          {!isRoomCellBooking && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {language === 'fr'
                    ? `${domainCfg.unitTerm.fr} assignée :`
                    : language === 'ar'
                    ? `${domainCfg.unitTerm.ar} المخصصة:`
                    : `Assigned ${domainCfg.unitTerm.en}:`}
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-normal">
                  {domainResources.length} {language === 'fr' ? 'disponibles dans ce domaine' : 'available in this domain'}
                </span>
              </label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              >
                {domainResources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.type} ({r.pricePerDay > 0 ? `${r.pricePerDay} € / unité` : 'Inclus / Gratuit'})
                    {r.capacity ? ` • Capacité: ${r.capacity}p` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. BENEFICIARY / CLIENT / PATIENT IDENTITY */}
          <div id="booking-step-guest" className="space-y-4 scroll-mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
            <div>
              <label htmlFor="booking-primary-name" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr'
                  ? `${domainCfg.userTerm.fr} (Nom complet) *`
                  : language === 'ar'
                  ? `${domainCfg.userTerm.ar} (الاسم الكامل) *`
                  : `Full ${domainCfg.userTerm.en} Name *`}
              </label>
              <div className="relative">
                <User size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="booking-primary-name"
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  aria-invalid={Boolean(getFieldError(0, 'fullName'))}
                  placeholder={
                    activeDomain === 'resort'
                      ? 'Ex: Famille Delacroix (Villa 01)'
                      : 'Ex: Alexander Kaufmann'
                  }
                  className={`w-full h-11 ps-9 pe-3 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-shadow ${
                    getFieldError(0, 'fullName')
                      ? 'border-rose-500 focus:ring-rose-500/30 focus:border-rose-500'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
              </div>
              {getFieldError(0, 'fullName') && (
                <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {getFieldError(0, 'fullName')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="booking-primary-email" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'fr'
                    ? 'Email de contact (optionnel) :'
                    : language === 'ar'
                    ? 'البريد الإلكتروني (اختياري):'
                    : 'Email Address (optional):'}
                </label>
                <div className="relative">
                  <Mail size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="booking-primary-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    aria-invalid={Boolean(getFieldError(0, 'email'))}
                    placeholder="contact@exemple.com"
                    className={`w-full h-11 ps-9 pe-3 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-shadow ${
                      getFieldError(0, 'email')
                        ? 'border-rose-500 focus:ring-rose-500/30 focus:border-rose-500'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {getFieldError(0, 'email') && (
                  <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {getFieldError(0, 'email')}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label htmlFor="booking-primary-phone" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'fr' ? 'Téléphone (facultatif)' : language === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone Number (optional)'}
                </label>
                <div className="relative">
                  <Phone size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="booking-primary-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    aria-invalid={Boolean(getFieldError(0, 'phone'))}
                    placeholder="+213 550 00 00 00"
                    className={`w-full h-11 ps-9 pe-3 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-shadow tabular-nums ${
                      getFieldError(0, 'phone')
                        ? 'border-rose-500 focus:ring-rose-500/30 focus:border-rose-500'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {getFieldError(0, 'phone') && (
                  <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {getFieldError(0, 'phone')}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="min-w-0">
                <label htmlFor="booking-guest-age-bracket" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {language === 'fr'
                    ? 'Tranche d’âge du client (optionnel)'
                    : language === 'ar'
                    ? 'الفئة العمرية للنزيل (اختياري)'
                    : 'Guest Age Bracket (optional)'}
                </label>
                <select
                  id="booking-guest-age-bracket"
                  value={guestAgeBracket}
                  onChange={(e) => setGuestAgeBracket(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {language === 'fr' ? 'Non renseignée' : language === 'ar' ? 'غير محددة' : 'Not specified'}
                  </option>
                  <option value="18-25">18 – 25 {language === 'fr' ? 'ans' : language === 'ar' ? 'سنة' : 'yrs'}</option>
                  <option value="26-35">26 – 35 {language === 'fr' ? 'ans' : language === 'ar' ? 'سنة' : 'yrs'}</option>
                  <option value="36-50">36 – 50 {language === 'fr' ? 'ans' : language === 'ar' ? 'سنة' : 'yrs'}</option>
                  <option value="51-65">51 – 65 {language === 'fr' ? 'ans' : language === 'ar' ? 'سنة' : 'yrs'}</option>
                  <option value="65+">65+ {language === 'fr' ? 'ans' : language === 'ar' ? 'سنة' : 'yrs'}</option>
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="booking-client-segment" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {language === 'fr'
                    ? 'Typologie de séjour (optionnel)'
                    : language === 'ar'
                    ? 'نوع الإقامة / العميل (اختياري)'
                    : 'Guest Profile / Segment (optional)'}
                </label>
                <select
                  id="booking-client-segment"
                  value={clientSegment}
                  onChange={(e) => setClientSegment(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {language === 'fr' ? 'Détection automatique' : language === 'ar' ? 'تحديد تلقائي' : 'Auto-detect'}
                  </option>
                  <option value="solo">{language === 'fr' ? 'Voyageur Solo' : language === 'ar' ? 'مسافر منفرد' : 'Solo Traveler'}</option>
                  <option value="couple">{language === 'fr' ? 'Couple / Loisirs' : language === 'ar' ? 'زوجان / سياحة' : 'Couple / Leisure'}</option>
                  <option value="family">{language === 'fr' ? 'Famille (avec ou sans enfants)' : language === 'ar' ? 'عائلة' : 'Family'}</option>
                  <option value="business">{language === 'fr' ? 'Affaires / Corporate' : language === 'ar' ? 'أعمال / شركات' : 'Business / Corporate'}</option>
                  <option value="vip">{language === 'fr' ? 'Client VIP / Prestige' : language === 'ar' ? 'عميل VIP' : 'VIP / Prestige'}</option>
                  <option value="group">{language === 'fr' ? 'Groupe / Délégation' : language === 'ar' ? 'مجموعة / وفد' : 'Group / Delegation'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2.b TENANT NATIONALITY & POLICE REGULATION (Algérien vs Étranger) */}
          {(activeDomain === 'hotel' || activeDomain === 'resort') && (
            <div id="booking-step-police" className="scroll-mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 px-4 sm:px-5 py-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-xs shrink-0">
                    <ShieldCheck size={19} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                        {language === 'fr'
                          ? 'Nationalité & Fiche de Police (DGSN)'
                          : language === 'ar'
                          ? 'جنسية النزيل وبطاقة الشرطة التنظيمية'
                          : 'Tenant Nationality & Police Form'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                          idPieceNumber.trim()
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {idPieceNumber.trim()
                          ? language === 'ar'
                            ? 'جاهزة'
                            : language === 'en'
                            ? 'Ready'
                            : 'Prête'
                          : language === 'ar'
                          ? 'رقم الوثيقة مطلوب'
                          : language === 'en'
                          ? 'ID required'
                          : 'Pièce à saisir'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {language === 'ar'
                        ? 'التحقق من هوية المسافر وتجهيز بطاقة الشرطة الفردية.'
                        : language === 'en'
                        ? 'Traveler identification and DGSN individual registration sheet.'
                        : 'Identification du voyageur et préparation de la fiche individuelle officielle.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPoliceSheetModal(true)}
                  className="w-full sm:w-auto min-h-11 px-4 py-2 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <FileText size={14} />
                  <span>
                    {language === 'fr'
                      ? 'Aperçu Fiche de Police'
                      : language === 'ar'
                      ? 'معاينة بطاقة الشرطة'
                      : 'Police Form Preview'}
                  </span>
                </button>
              </div>
              <div className="p-4 sm:p-5 space-y-4">

              {/* Guest Type Selector Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setGuestType('algerian');
                    setForeignNationality('Algérienne');
                  }}
                  className={`min-h-11 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    guestType === 'algerian'
                      ? 'bg-emerald-700 dark:bg-emerald-600 text-white shadow-md ring-1 ring-emerald-500/20'
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
                  className={`min-h-11 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    guestType === 'foreigner'
                      ? 'bg-slate-900 dark:bg-slate-600 text-white shadow-md ring-1 ring-slate-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🌐</span>
                  <span>{language === 'fr' ? 'Ressortissant Étranger' : language === 'ar' ? 'أجنبي / مقيم بالخارج' : 'Foreign Resident'}</span>
                </button>
              </div>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'Type de Pièce d\'Identité *' : language === 'ar' ? 'نوع وثيقة الهوية *' : 'ID Document Type *'}
                    </label>
                    <select
                      value={idPieceType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setIdPieceType(val);
                        if (val === 'cni') setAlgerianIdType('cni');
                      }}
                      className="w-full h-11 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold text-xs"
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

                  <div className="min-w-0">
                    <label htmlFor="booking-primary-doc-number" className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'N° de la Pièce *' : language === 'ar' ? 'رقم الوثيقة *' : 'Document Number *'}
                    </label>
                    <input
                      id="booking-primary-doc-number"
                      type="text"
                      value={idPieceNumber}
                      onChange={(e) => {
                        setIdPieceNumber(e.target.value);
                        setAlgerianIdNumber(e.target.value);
                        setPassportNumber(e.target.value);
                      }}
                      aria-invalid={Boolean(getFieldError(0, 'documentNumber'))}
                      placeholder="Ex: 1102938491029 / 21EF98124"
                      className={`w-full h-11 px-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-800 dark:text-slate-100 font-mono text-xs font-bold tabular-nums ${
                        getFieldError(0, 'documentNumber')
                          ? 'border-rose-500 ring-1 ring-rose-500/30'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {getFieldError(0, 'documentNumber') && (
                      <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {getFieldError(0, 'documentNumber')}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {guestType === 'algerian' ? 'Wilaya de Résidence (69 Wilayas) *' : 'Nationalité *'}
                    </label>
                    {guestType === 'algerian' ? (
                      <select
                        value={wilayaOfOrigin}
                        onChange={(e) => setWilayaOfOrigin(e.target.value)}
                        className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
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
                        className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Date d'expiration de la pièce</label>
                    <input type="date" value={idDocumentExpiryDate} onChange={(e) => setIdDocumentExpiryDate(e.target.value)} className="w-full h-11 px-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"/>
                    {documentExpiryWarning(idDocumentExpiryDate) && <p className={`mt-1 text-[11px] font-semibold ${documentExpiryWarning(idDocumentExpiryDate)?.tone === 'red' ? 'text-red-600' : documentExpiryWarning(idDocumentExpiryDate)?.tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>{documentExpiryWarning(idDocumentExpiryDate)?.label}</p>}
                  </div>
                  {guestType === 'foreigner' && <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Date d'expiration du visa</label>
                    <input type="date" value={visaExpiryDate} onChange={(e) => setVisaExpiryDate(e.target.value)} className="w-full h-11 px-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"/>
                    {documentExpiryWarning(visaExpiryDate) && <p className={`mt-1 text-[11px] font-semibold ${documentExpiryWarning(visaExpiryDate)?.tone === 'red' ? 'text-red-600' : documentExpiryWarning(visaExpiryDate)?.tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>{documentExpiryWarning(visaExpiryDate)?.label}</p>}
                  </div>}
                </div>
                {matchedGuestHistory && <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 p-3 space-y-1">
                  <p className="text-xs font-bold text-violet-900 dark:text-violet-200">Client déjà connu — dossier prérempli</p>
                  <p className="text-[11px] text-violet-800 dark:text-violet-300">Dernier séjour : {matchedGuestHistory.startDate} → {matchedGuestHistory.endDate} • {matchedGuestHistory.resourceName}</p>
                  {matchedGuestHistory.idDocumentExpiryDate && documentExpiryWarning(matchedGuestHistory.idDocumentExpiryDate) && <p className={`text-xs font-bold ${documentExpiryWarning(matchedGuestHistory.idDocumentExpiryDate)?.tone === 'red' ? 'text-red-600' : 'text-amber-700'}`}>⚠ Pièce : {documentExpiryWarning(matchedGuestHistory.idDocumentExpiryDate)?.label}</p>}
                  {matchedGuestHistory.visaExpiryDate && documentExpiryWarning(matchedGuestHistory.visaExpiryDate) && <p className={`text-xs font-bold ${documentExpiryWarning(matchedGuestHistory.visaExpiryDate)?.tone === 'red' ? 'text-red-600' : 'text-amber-700'}`}>⚠ Visa : {documentExpiryWarning(matchedGuestHistory.visaExpiryDate)?.label}</p>}
                  {(matchedGuestHistory.guestAlerts || []).map((alert) => <p key={alert.id} className="text-xs text-violet-800 dark:text-violet-300">• {alert.text}</p>)}
                </div>}

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
                        className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono text-xs uppercase"
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
                        className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {/* 3. DEDICATED PREDEFINED FIELDS PER DOMAIN */}

          {/* === A. HOTEL PREDEFINED SHEET === */}
          {activeDomain === 'hotel' && (
            <div className="overflow-hidden rounded-[1.5rem] border border-sky-200 dark:border-sky-900/70 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center gap-3 border-b border-sky-100 dark:border-sky-900/60 bg-gradient-to-r from-sky-50 via-white to-indigo-50/70 dark:from-sky-950/50 dark:via-slate-900 dark:to-indigo-950/30 px-4 sm:px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm"><Bed size={19} /></span>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">Paramètres du Séjour Hôtelier</h4>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Occupants, formule de pension, préférences et prestations complémentaires.</p>
                </div>
              </div>
              <div className="space-y-4 p-4 sm:p-5">

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="min-w-0">
                  <label htmlFor="hotel-adults-count" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Adultes</label>
                  <select
                    id="hotel-adults-count"
                    value={hotelAdults}
                    onChange={(e) => setHotelAdults(Number(e.target.value))}
                    className="w-full h-11 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} adulte{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label htmlFor="hotel-children-count" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Enfants</label>
                  <select
                    id="hotel-children-count"
                    value={hotelChildren}
                    onChange={(e) => setHotelChildren(Number(e.target.value))}
                    className="w-full h-11 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} enfant{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0 col-span-1 min-[380px]:col-span-2 sm:col-span-1">
                  <label htmlFor="hotel-checkin-time" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure Arrivée</label>
                  <input
                    id="hotel-checkin-time"
                    type="time"
                    value={hotelCheckinTime}
                    onChange={(e) => setHotelCheckinTime(e.target.value)}
                    className="w-full h-11 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              {/* All Occupants (Adults + Children) details & coordinates */}
              <div
                id="booking-step-occupants"
                className="scroll-mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 p-3 sm:p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      {getTranslation('bookingOccupantsHeading', language).replace('{count}', String(normalizedOccupantsPreview.totalOccupants))}
                    </h5>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      {occupantCount > 1
                        ? getTranslation('bookingOccupantsRuleBanner', language)
                        : getTranslation('bookingOccupantPrimaryContactHint', language)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                    {getTranslation('bookingOccupantsCompletionStatus', language)
                      .replace(
                        '{completed}',
                        String(
                          normalizedOccupantsPreview.allOccupants.filter(
                            (p) =>
                              p.fullName.trim().length >= 2 &&
                              (!p.phone.trim() || isValidPhoneNumber(p.phone)) &&
                              (!p.email.trim() || isValidEmailAddress(p.email)) &&
                              (occupantCount <= 1 ||
                                (p.documentNumber.trim().length >= 2 &&
                                  (!p.isPrimary || isValidPhoneNumber(p.phone))))
                          ).length
                        )
                      )
                      .replace('{total}', String(normalizedOccupantsPreview.totalOccupants))}
                  </span>
                </div>

                <div className="space-y-3">
                  {normalizedOccupantsPreview.adults.map((adult, index) => {
                    const nameErr = getFieldError(index, 'fullName');
                    const phoneErr = getFieldError(index, 'phone');
                    const emailErr = getFieldError(index, 'email');
                    const docTypeErr = getFieldError(index, 'documentType');
                    const docNumErr = getFieldError(index, 'documentNumber');

                    return (
                      <div
                        key={adult.id || `adult-${index}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-3.5 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {getTranslation('bookingOccupantAdultRole', language).replace('{index}', String(index + 1))}
                            {index === 0 && (
                              <span className="ms-2 font-medium text-emerald-700 dark:text-emerald-400">
                                · {getTranslation('bookingOccupantPrimaryTag', language)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div className="min-w-0">
                            <label htmlFor={`occ-adult-${index}-name`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantFullName', language)}
                            </label>
                            <input
                              id={`occ-adult-${index}-name`}
                              type="text"
                              value={adult.fullName}
                              onChange={(e) => updateAdultOccupantField(index, 'fullName', e.target.value)}
                              aria-invalid={Boolean(nameErr)}
                              placeholder={getTranslation('bookingOccupantFullName', language).replace(' *', '')}
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                                nameErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {nameErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{nameErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-adult-${index}-phone`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {index === 0 && occupantCount > 1
                                ? getTranslation('bookingOccupantPhone', language)
                                : getTranslation('bookingOccupantPhoneOptional', language)}
                            </label>
                            <input
                              id={`occ-adult-${index}-phone`}
                              type="tel"
                              value={adult.phone}
                              onChange={(e) => updateAdultOccupantField(index, 'phone', e.target.value)}
                              aria-invalid={Boolean(phoneErr)}
                              placeholder="+213 550 00 00 00"
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white tabular-nums ${
                                phoneErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {phoneErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{phoneErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-adult-${index}-email`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantEmail', language)}
                            </label>
                            <input
                              id={`occ-adult-${index}-email`}
                              type="email"
                              value={adult.email}
                              onChange={(e) => updateAdultOccupantField(index, 'email', e.target.value)}
                              aria-invalid={Boolean(emailErr)}
                              placeholder="contact@exemple.com"
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                                emailErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {emailErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{emailErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-adult-${index}-doctype`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantDocType', language)}
                            </label>
                            <select
                              id={`occ-adult-${index}-doctype`}
                              value={adult.documentType}
                              onChange={(e) => updateAdultOccupantField(index, 'documentType', e.target.value)}
                              aria-invalid={Boolean(docTypeErr)}
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                                docTypeErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              <option value="cni">Carte d'identité (CNI)</option>
                              <option value="passport">Passeport</option>
                              <option value="driving_license">Permis de conduire</option>
                              <option value="special_authorization">Autorisation spéciale</option>
                              <option value="diplomatic_passport">Passeport diplomatique</option>
                              <option value="special_passport">Passeport spécial</option>
                              <option value="official_document">Document officiel</option>
                            </select>
                            {docTypeErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{docTypeErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-adult-${index}-docnum`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantDocNumber', language)}
                            </label>
                            <input
                              id={`occ-adult-${index}-docnum`}
                              type="text"
                              value={adult.documentNumber}
                              onChange={(e) => updateAdultOccupantField(index, 'documentNumber', e.target.value)}
                              aria-invalid={Boolean(docNumErr)}
                              placeholder="N° CNI / Passeport"
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums ${
                                docNumErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {docNumErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{docNumErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-adult-${index}-docexp`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantDocExpiry', language)}
                            </label>
                            <input
                              id={`occ-adult-${index}-docexp`}
                              type="date"
                              value={adult.documentExpiryDate || ''}
                              onChange={(e) => updateAdultOccupantField(index, 'documentExpiryDate', e.target.value)}
                              className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white tabular-nums"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {normalizedOccupantsPreview.children.map((child, childIdx) => {
                    const personIdx = normalizedOccupantsPreview.adultsCount + childIdx;
                    const nameErr = getFieldError(personIdx, 'fullName');
                    const phoneErr = getFieldError(personIdx, 'phone');
                    const emailErr = getFieldError(personIdx, 'email');
                    const docTypeErr = getFieldError(personIdx, 'documentType');
                    const docNumErr = getFieldError(personIdx, 'documentNumber');

                    return (
                      <div
                        key={child.id || `child-${childIdx}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-3.5 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {getTranslation('bookingOccupantChildRole', language).replace('{index}', String(childIdx + 1))}
                          </span>
                          {(guestPhone.trim() || guestEmail.trim()) && (
                            <button
                              type="button"
                              onClick={() => applyPrimaryContactToChild(childIdx)}
                              className="min-h-10 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            >
                              {getTranslation('bookingOccupantCopyPrimaryContact', language)}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div className="min-w-0">
                            <label htmlFor={`occ-child-${childIdx}-name`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantFullName', language)}
                            </label>
                            <input
                              id={`occ-child-${childIdx}-name`}
                              type="text"
                              value={child.fullName}
                              onChange={(e) => updateChildOccupantField(childIdx, 'fullName', e.target.value)}
                              aria-invalid={Boolean(nameErr)}
                              placeholder={getTranslation('bookingOccupantFullName', language).replace(' *', '')}
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                                nameErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {nameErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{nameErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-child-${childIdx}-phone`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantPhoneOptional', language)}
                            </label>
                            <input
                              id={`occ-child-${childIdx}-phone`}
                              type="tel"
                              value={child.phone}
                              onChange={(e) => updateChildOccupantField(childIdx, 'phone', e.target.value)}
                              aria-invalid={Boolean(phoneErr)}
                              placeholder="+213 550 00 00 00"
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white tabular-nums ${
                                phoneErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {phoneErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{phoneErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-child-${childIdx}-email`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantEmail', language)}
                            </label>
                            <input
                              id={`occ-child-${childIdx}-email`}
                              type="email"
                              value={child.email}
                              onChange={(e) => updateChildOccupantField(childIdx, 'email', e.target.value)}
                              aria-invalid={Boolean(emailErr)}
                              placeholder="contact@exemple.com"
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                                emailErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {emailErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{emailErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-child-${childIdx}-doctype`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantDocType', language)}
                            </label>
                            <select
                              id={`occ-child-${childIdx}-doctype`}
                              value={child.documentType}
                              onChange={(e) => updateChildOccupantField(childIdx, 'documentType', e.target.value)}
                              aria-invalid={Boolean(docTypeErr)}
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                                docTypeErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              <option value="cni">Carte d'identité / Livret de famille</option>
                              <option value="passport">Passeport</option>
                              <option value="official_document">Acte de naissance / Document officiel</option>
                            </select>
                            {docTypeErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{docTypeErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-child-${childIdx}-docnum`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantDocNumber', language)}
                            </label>
                            <input
                              id={`occ-child-${childIdx}-docnum`}
                              type="text"
                              value={child.documentNumber}
                              onChange={(e) => updateChildOccupantField(childIdx, 'documentNumber', e.target.value)}
                              aria-invalid={Boolean(docNumErr)}
                              placeholder="N° Acte / Livret / Passeport"
                              className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums ${
                                docNumErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                            {docNumErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{docNumErr}</p>}
                          </div>

                          <div className="min-w-0">
                            <label htmlFor={`occ-child-${childIdx}-docexp`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {getTranslation('bookingOccupantDocExpiry', language)}
                            </label>
                            <input
                              id={`occ-child-${childIdx}-docexp`}
                              type="date"
                              value={child.documentExpiryDate || ''}
                              onChange={(e) => updateChildOccupantField(childIdx, 'documentExpiryDate', e.target.value)}
                              className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white tabular-nums"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formule de Pension & Restauration (Inspiré Booking & Airbnb) */}
              <div className="space-y-2 pt-2 border-t border-blue-200/50 dark:border-blue-900/40">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 min-w-0">
                    <UtensilsCrossed size={14} className="text-amber-500 shrink-0" />
                    <span className="truncate">Formule de Pension & Restauration</span>
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 shrink-0">
                    {HOSPITALITY_MEAL_PLANS.find((p) => p.id === selectedMealPlanId)?.shortBadge || 'BB'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {HOSPITALITY_MEAL_PLANS.map((plan) => {
                    const isSelected = selectedMealPlanId === plan.id;
                    const priceInDzd = Math.round(plan.pricePerPersonDay * 145.5);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedMealPlanId(plan.id)}
                        className={`min-w-0 min-h-11 p-2.5 rounded-xl border text-start flex flex-col justify-between transition cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {plan.shortBadge}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums truncate">
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
                    <div className="p-2.5 bg-slate-100/70 dark:bg-slate-900/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
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
                <div className="space-y-1.5 pt-1">
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
                          className={`min-h-9 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
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
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Extras Expérientiels Booking & Airbnb :
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
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
                          className={`min-h-11 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer select-none ${
                            isChecked
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
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
                              className="rounded text-blue-600 shrink-0"
                            />
                            <span className="truncate">{extra.label}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                            {extra.price}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs border-t border-slate-100 dark:border-slate-800">
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionBabyBed}
                    onChange={(e) => setHotelOptionBabyBed(e.target.checked)}
                    className="rounded text-blue-600 shrink-0"
                  />
                  <span>Lit bébé d'appoint (+10€)</span>
                </label>
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionHighFloor}
                    onChange={(e) => setHotelOptionHighFloor(e.target.checked)}
                    className="rounded text-blue-600 shrink-0"
                  />
                  <span>Étage élevé / Vue dégagée</span>
                </label>
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionPet}
                    onChange={(e) => setHotelOptionPet(e.target.checked)}
                    className="rounded text-blue-600 shrink-0"
                  />
                  <span>Animal de compagnie (+15€)</span>
                </label>
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hotelOptionWelcomeGift}
                    onChange={(e) => setHotelOptionWelcomeGift(e.target.checked)}
                    className="rounded text-blue-600 shrink-0"
                  />
                  <span>Bouteille de bienvenue (+35€)</span>
                </label>
              </div>
              </div>
            </div>
          )}

          {/* === B. RESORT & COMPLEXE PREDEFINED SHEET === */}
          {activeDomain === 'resort' && (
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Palmtree size={14} />
                <span>Paramètres Resort, Villas & Bungalows</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="min-w-0">
                  <label htmlFor="resort-occupants-count" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Capacité / Occupants</label>
                  <select
                    id="resort-occupants-count"
                    value={resortOccupants}
                    onChange={(e) => setResortOccupants(Number(e.target.value))}
                    className="w-full h-11 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} personne{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label htmlFor="resort-formula-select" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Formule Resort</label>
                  <select
                    id="resort-formula-select"
                    value={resortFormula}
                    onChange={(e) => setResortFormula(e.target.value as any)}
                    className="w-full h-11 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="all_inclusive">All-Inclusive Resort VIP (+60€ / pers / jour)</option>
                    <option value="half_board">Demi-Pension Gourmande (+35€ / pers / jour)</option>
                    <option value="spa_package">Formule Séjour & Soins Spa (+50€ / pers / jour)</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label htmlFor="resort-checkin-time" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure Arrivée Souhaitée</label>
                  <input
                    id="resort-checkin-time"
                    type="time"
                    value={resortCheckinTime}
                    onChange={(e) => setResortCheckinTime(e.target.value)}
                    className="w-full h-11 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div id="booking-step-occupants" className="scroll-mt-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-slate-50/70 dark:bg-slate-950/40 p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      {getTranslation('bookingOccupantsHeading', language).replace('{count}', String(normalizedOccupantsPreview.totalOccupants))}
                    </h5>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      {occupantCount > 1
                        ? getTranslation('bookingOccupantsRuleBanner', language)
                        : getTranslation('bookingOccupantPrimaryContactHint', language)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                    {getTranslation('bookingOccupantsCompletionStatus', language)
                      .replace(
                        '{completed}',
                        String(
                          normalizedOccupantsPreview.allOccupants.filter(
                            (p) =>
                              p.fullName.trim().length >= 2 &&
                              (!p.phone.trim() || isValidPhoneNumber(p.phone)) &&
                              (!p.email.trim() || isValidEmailAddress(p.email)) &&
                              (occupantCount <= 1 ||
                                (p.documentNumber.trim().length >= 2 &&
                                  (!p.isPrimary || isValidPhoneNumber(p.phone))))
                          ).length
                        )
                      )
                      .replace('{total}', String(normalizedOccupantsPreview.totalOccupants))}
                  </span>
                </div>
                {normalizedOccupantsPreview.adults.map((adult, index) => {
                  const nameErr = getFieldError(index, 'fullName');
                  const phoneErr = getFieldError(index, 'phone');
                  const emailErr = getFieldError(index, 'email');
                  const docTypeErr = getFieldError(index, 'documentType');
                  const docNumErr = getFieldError(index, 'documentNumber');

                  return (
                    <div
                      key={adult.id || `resort-adult-${index}`}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2.5"
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {getTranslation('bookingOccupantAdultRole', language).replace('{index}', String(index + 1))}
                        {index === 0 && (
                          <span className="ms-2 font-medium text-emerald-700 dark:text-emerald-400">
                            · {getTranslation('bookingOccupantPrimaryTag', language)}
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <div className="min-w-0">
                          <label htmlFor={`resort-occ-${index}-name`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {getTranslation('bookingOccupantFullName', language)}
                          </label>
                          <input
                            id={`resort-occ-${index}-name`}
                            type="text"
                            value={adult.fullName}
                            onChange={(e) => updateAdultOccupantField(index, 'fullName', e.target.value)}
                            aria-invalid={Boolean(nameErr)}
                            placeholder={getTranslation('bookingOccupantFullName', language).replace(' *', '')}
                            className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                              nameErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                          {nameErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{nameErr}</p>}
                        </div>
                        <div className="min-w-0">
                          <label htmlFor={`resort-occ-${index}-phone`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {index === 0 && occupantCount > 1
                              ? getTranslation('bookingOccupantPhone', language)
                              : getTranslation('bookingOccupantPhoneOptional', language)}
                          </label>
                          <input
                            id={`resort-occ-${index}-phone`}
                            type="tel"
                            value={adult.phone}
                            onChange={(e) => updateAdultOccupantField(index, 'phone', e.target.value)}
                            aria-invalid={Boolean(phoneErr)}
                            placeholder="+213 550 00 00 00"
                            className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white tabular-nums ${
                              phoneErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                          {phoneErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{phoneErr}</p>}
                        </div>
                        <div className="min-w-0">
                          <label htmlFor={`resort-occ-${index}-email`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {getTranslation('bookingOccupantEmail', language)}
                          </label>
                          <input
                            id={`resort-occ-${index}-email`}
                            type="email"
                            value={adult.email}
                            onChange={(e) => updateAdultOccupantField(index, 'email', e.target.value)}
                            aria-invalid={Boolean(emailErr)}
                            placeholder="contact@exemple.com"
                            className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                              emailErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                          {emailErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{emailErr}</p>}
                        </div>
                        <div className="min-w-0">
                          <label htmlFor={`resort-occ-${index}-doctype`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {getTranslation('bookingOccupantDocType', language)}
                          </label>
                          <select
                            id={`resort-occ-${index}-doctype`}
                            value={adult.documentType}
                            onChange={(e) => updateAdultOccupantField(index, 'documentType', e.target.value)}
                            aria-invalid={Boolean(docTypeErr)}
                            className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white ${
                              docTypeErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <option value="cni">Carte d'identité (CNI)</option>
                            <option value="passport">Passeport</option>
                            <option value="driving_license">Permis de conduire</option>
                            <option value="special_authorization">Autorisation spéciale</option>
                            <option value="diplomatic_passport">Passeport diplomatique</option>
                            <option value="special_passport">Passeport spécial</option>
                            <option value="official_document">Document officiel</option>
                          </select>
                          {docTypeErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{docTypeErr}</p>}
                        </div>
                        <div className="min-w-0">
                          <label htmlFor={`resort-occ-${index}-docnum`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {getTranslation('bookingOccupantDocNumber', language)}
                          </label>
                          <input
                            id={`resort-occ-${index}-docnum`}
                            type="text"
                            value={adult.documentNumber}
                            onChange={(e) => updateAdultOccupantField(index, 'documentNumber', e.target.value)}
                            aria-invalid={Boolean(docNumErr)}
                            placeholder="N° CNI / Passeport"
                            className={`w-full h-11 rounded-lg border bg-white dark:bg-slate-950 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums ${
                              docNumErr ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                          {docNumErr && <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{docNumErr}</p>}
                        </div>
                        <div className="min-w-0">
                          <label htmlFor={`resort-occ-${index}-docexp`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            {getTranslation('bookingOccupantDocExpiry', language)}
                          </label>
                          <input
                            id={`resort-occ-${index}-docexp`}
                            type="date"
                            value={adult.documentExpiryDate || ''}
                            onChange={(e) => updateAdultOccupantField(index, 'documentExpiryDate', e.target.value)}
                            className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-xs">
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionPrivatePool}
                    onChange={(e) => setResortOptionPrivatePool(e.target.checked)}
                    className="rounded text-amber-600 shrink-0"
                  />
                  <span>Piscine privée chauffée</span>
                </label>
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionBeachCabana}
                    onChange={(e) => setResortOptionBeachCabana(e.target.checked)}
                    className="rounded text-amber-600 shrink-0"
                  />
                  <span>Cabana Plage Privée</span>
                </label>
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionVipTransfer}
                    onChange={(e) => setResortOptionVipTransfer(e.target.checked)}
                    className="rounded text-amber-600 shrink-0"
                  />
                  <span>Navette VIP Aéroport (+80€)</span>
                </label>
                <label className="min-h-11 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={resortOptionGolfBuggy}
                    onChange={(e) => setResortOptionGolfBuggy(e.target.checked)}
                    className="rounded text-amber-600 shrink-0"
                  />
                  <span>Voiturette Resort (+30€/j)</span>
                </label>
              </div>
            </div>
          )}

          {/* 4. DATES & SCHEDULE */}
          <div id="booking-step-stay" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-5 border-t border-slate-200 dark:border-slate-800 scroll-mt-4">
            <div className="min-w-0">
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between gap-2">
                <span>{language === 'fr' ? "Date d'arrivée / Début *" : language === 'ar' ? 'تاريخ الوصول *' : 'Start / Check-in Date *'}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal shrink-0">≥ Aujourd'hui</span>
              </label>
              <input
                type="date"
                required
                min={todayIso}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-medium"
              />
            </div>

            <div className="min-w-0">
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between gap-2">
                <span>{language === 'fr' ? 'Date de départ / Fin *' : language === 'ar' ? 'تاريخ المغادرة *' : 'End / Check-out Date *'}</span>
                <span className="text-[10px] text-slate-400 font-normal shrink-0">Min: Arrivée</span>
              </label>
              <input
                type="date"
                required
                min={startDate || todayIso}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-medium"
              />
            </div>
          </div>
          {activeDomain === 'hotel' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-3">
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Heure d'arrivée</label>
                <input type="time" required value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} className="h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 font-semibold text-slate-900 dark:text-white" />
                <span className="mt-1 block text-[10px] text-slate-500">Check-in</span>
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Heure de départ</label>
                <input type="time" required value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} className="h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 font-semibold text-slate-900 dark:text-white" />
                <span className="mt-1 block text-[10px] text-slate-500">Check-out · 10 min de préparation avant la prochaine arrivée</span>
              </div>
            </div>
          )}

          {/* 5. STATUS, MULTI-CURRENCY & PAYMENT */}
          <div id="booking-step-payment" className="scroll-mt-4 overflow-hidden rounded-[1.5rem] border border-violet-200 dark:border-violet-900/70 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-3 px-4 sm:px-5 py-4 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-fuchsia-950/20 border-b border-violet-100 dark:border-violet-900/60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm"><Coins size={19} /></span>
              <div className="min-w-0"><h4 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">Devise & Conditions de Règlement</h4><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Devise de facturation, moyen de paiement et état d’encaissement.</p></div>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="min-w-0">
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
                  className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-bold"
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
                  className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
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
                  className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
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
                  className="w-full h-11 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
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
          </div>

          {/* 6. NOTES & INSTRUCTIONS */}
          <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 dark:bg-slate-700 text-white"><FileText size={18} /></span>
              <div><h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Remarques & instructions particulières</h4><p className="text-[11px] text-slate-500 dark:text-slate-400">Consignes opérationnelles liées à ce séjour et au suivi du client.</p></div>
            </div>
            <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
              className="w-full min-h-24 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-shadow text-sm resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-200/90 dark:border-amber-900/70 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 p-4 space-y-2">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"><ShieldCheck size={16}/></span><label className="text-xs font-extrabold text-amber-950 dark:text-amber-200">Objets confiés à la réception</label></div>
              <textarea rows={3} value={valuablesText} onChange={(e) => setValuablesText(e.target.value)} placeholder="Un objet par ligne : bijoux, ordinateur, enveloppe..." className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-slate-950 p-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"/>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">À vérifier et restituer au départ du client.</p>
            </div>
            <div className="rounded-2xl border border-orange-200/90 dark:border-orange-900/70 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/25 dark:to-slate-900 p-4 space-y-2">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300"><Package size={16}/></span><label className="text-xs font-extrabold text-orange-950 dark:text-orange-200">Objets trouvés / oubliés</label></div>
              <textarea rows={3} value={forgottenText} onChange={(e) => setForgottenText(e.target.value)} placeholder="Un objet par ligne : chargeur, vêtement..." className="w-full rounded-xl border border-orange-200 dark:border-orange-800 bg-white/90 dark:bg-slate-950 p-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500"/>
              <p className="text-[11px] leading-relaxed text-orange-800 dark:text-orange-300">Conservés dans le dossier jusqu'à restitution.</p>
            </div>
            <div className="md:col-span-2 rounded-2xl border border-sky-200/90 dark:border-sky-900/70 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/25 dark:to-slate-900 p-4 space-y-2">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300"><History size={16}/></span><label className="text-xs font-extrabold text-sky-950 dark:text-sky-200">Réserves et observations pour les prochains séjours</label></div>
              <textarea rows={2} value={guestAlertsText} onChange={(e) => setGuestAlertsText(e.target.value)} placeholder="Un point par ligne : préférence, anomalie constatée, demande particulière..." className="w-full rounded-xl border border-sky-200 dark:border-sky-800 bg-white/90 dark:bg-slate-950 p-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"/>
              <p className="text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">Ces observations restent dans l'historique et seront rappelées lors d'une prochaine réservation de ce client.</p>
            </div>
            {bookings.filter((booking) => booking.id !== selectedBooking?.id && guestName.trim() && (bookingText(booking.guestName) === guestName.trim().toLowerCase() || (guestEmail && bookingText(booking.guestEmail) === guestEmail.trim().toLowerCase())) && (booking.guestAlerts?.length || booking.forgottenItems?.some((item) => item?.status === 'stored'))).length > 0 && (
              <div className="md:col-span-2 rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/20 p-3">
                <p className="text-xs font-bold text-violet-900 dark:text-violet-200 mb-2">Historique à signaler pour ce client</p>
                {bookings.filter((booking) => booking.id !== selectedBooking?.id && guestName.trim() && (bookingText(booking.guestName) === guestName.trim().toLowerCase() || (guestEmail && bookingText(booking.guestEmail) === guestEmail.trim().toLowerCase()))).flatMap((booking) => [...(booking.guestAlerts || []).map((alert) => alert?.text ?? ''), ...(booking.forgottenItems || []).filter((item) => item?.status === 'stored' && item?.description).map((item) => `Objet oublié : ${item.description}`)]).filter(Boolean).map((item, index) => <p key={index} className="text-xs text-violet-800 dark:text-violet-300">• {item}</p>)}
              </div>
            )}
            </div>
          </div>

          {/* 7. DEDICATED DOMAIN PRICING BREAKDOWN */}
          <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 rounded-[1.5rem] border border-slate-700 shadow-lg text-white space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 block">
              {language === 'fr' ? 'Détail du tarif' : language === 'ar' ? 'تفاصيل السعر' : 'Price breakdown'}
            </span>
            <p className="text-xs leading-relaxed text-slate-300">
              {priceBreakdown}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
              <span className="font-black text-white text-xl sm:text-2xl tracking-tight tabular-nums">
                {totalPrice === 0
                  ? (language === 'fr' ? 'Gratuit (0.00)' : language === 'ar' ? 'مجاني (0.00)' : 'Free (0.00)')
                  : `${priceInPaymentCurrency.toLocaleString('fr-FR')} ${currencySymbols[paymentCurrency] || paymentCurrency}`}
              </span>
              {totalPrice > 0 && paymentCurrency !== 'DA' && (
                <span className="text-xs font-bold text-emerald-300 tabular-nums">
                  {priceInDzd.toLocaleString('fr-FR')} DA · contre-valeur DZD
                </span>
              )}
              {totalPrice > 0 && paymentCurrency === 'DA' && (
                <span className="text-[11px] font-semibold text-slate-300 tabular-nums">
                  ({totalPrice.toLocaleString('fr-FR')} € base)
                </span>
              )}
            </div>
          </div>
          </div>

          {/* DOCKED FOOTER: PRICE + CONFIRMATION BUTTONS */}
          <footer
            id="booking-step-confirm"
            className="shrink-0 scroll-mt-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(15_23_42/0.06)] dark:shadow-[0_-4px_16px_rgb(0_0_0/0.35)] z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4"
          >
            <div className="flex items-center justify-between sm:block gap-3 min-w-0">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 block">
                  {language === 'fr'
                    ? `Total séjour · ${calculatedDays} nuit${calculatedDays > 1 ? 's' : ''}`
                    : language === 'ar'
                    ? `إجمالي الإقامة · ${calculatedDays} ليالٍ`
                    : `Stay total · ${calculatedDays} night${calculatedDays > 1 ? 's' : ''}`}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
                    {totalPrice === 0
                      ? (language === 'fr' ? 'Gratuit (0.00)' : language === 'ar' ? 'مجاني (0.00)' : 'Free (0.00)')
                      : `${priceInPaymentCurrency.toLocaleString('fr-FR')} ${currencySymbols[paymentCurrency] || paymentCurrency}`}
                  </span>
                  {totalPrice > 0 && paymentCurrency !== 'DA' && (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      ({priceInDzd.toLocaleString('fr-FR')} DA)
                    </span>
                  )}
                  {totalPrice > 0 && paymentCurrency === 'DA' && (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      ({totalPrice.toLocaleString('fr-FR')} €)
                    </span>
                  )}
                </div>
              </div>
              <span className="sm:hidden text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                {paymentStatus === 'paid'
                  ? (language === 'fr' ? 'Payé' : language === 'ar' ? 'مدفوع' : 'Paid')
                  : paymentStatus === 'partial'
                  ? (language === 'fr' ? 'Acompte' : language === 'ar' ? 'عربون' : 'Deposit')
                  : (language === 'fr' ? 'À encaisser' : language === 'ar' ? 'عند الوصول' : 'Pending')}
              </span>
            </div>

            <div className="flex flex-col-reverse min-[360px]:flex-row sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="min-h-11 w-full min-[360px]:w-auto min-[360px]:min-w-24 px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors text-xs sm:text-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="min-h-11 w-full min-[360px]:flex-1 sm:flex-none sm:min-w-52 justify-center px-5 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 text-xs sm:text-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <CheckCircle2 size={16} className="shrink-0" />
                <span>
                  {isEditing
                    ? language === 'fr'
                      ? 'Enregistrer'
                      : language === 'ar'
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : language === 'fr'
                    ? 'Confirmer la réservation'
                    : language === 'ar'
                    ? 'تأكيد الحجز'
                    : 'Confirm Booking'}
                </span>
              </button>
            </div>
          </footer>
        </form>
        )}
      </div>

      {/* ALGERIAN POLICE REGISTRATION SHEET MODAL (Fiche Individuelle de Police) */}
      <PoliceSheetModal
        isOpen={showPoliceSheetModal}
        onClose={() => setShowPoliceSheetModal(false)}
        language={language}
        establishmentProfile={establishmentProfile}
        bookingId={bookingConfirmation?.id ?? selectedBooking?.id}
        activeDomain={activeDomain}
        resourceGroups={resourceGroups}
        selectedBuildingGroupId={selectedBuildingGroupId}
        currentResource={currentResource}
        guestName={guestName}
        guestPhone={guestPhone}
        guestEmail={guestEmail}
        guestType={guestType}
        foreignNationality={foreignNationality}
        idPieceType={idPieceType}
        idPieceNumber={idPieceNumber}
        algerianIdType={algerianIdType}
        algerianIdNumber={algerianIdNumber}
        passportNumber={passportNumber}
        idDocumentExpiryDate={idDocumentExpiryDate}
        specialAuthorizationDesc={specialAuthorizationDesc}
        wilayaOfOrigin={wilayaOfOrigin}
        visaNumber={visaNumber}
        visaExpiryDate={visaExpiryDate}
        entryDateInCountry={entryDateInCountry}
        startDate={startDate}
        endDate={endDate || startDate}
        checkInTime={checkInTime}
        checkOutTime={checkOutTime}
        calculatedDays={calculatedDays}
        hotelAdults={hotelAdults}
        hotelChildren={hotelChildren}
        resortOccupants={resortOccupants}
        adultGuests={normalizedOccupantsPreview.adults}
        occupants={normalizedOccupantsPreview.allOccupants}
        paymentCurrency={paymentCurrency}
        currencySymbol={currencySymbols[paymentCurrency] || paymentCurrency}
        priceInPaymentCurrency={priceInPaymentCurrency}
        priceInDzd={priceInDzd}
        paymentMethodType={paymentMethodType}
      />

      {roomStatusAlert && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-black/70 pms-modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="room-status-alert-title">
          <div className="w-full max-w-md rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3 pms-modal">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><AlertCircle size={22} /><h3 id="room-status-alert-title" className="font-extrabold text-base">{language === 'ar' ? 'لا يمكن إنشاء الحجز' : language === 'en' ? 'Reservation blocked' : 'Réservation impossible'}</h3></div>
            <p className="text-sm text-slate-700 dark:text-slate-200">{language === 'ar' ? 'يجب أن تكون الغرفة نظيفة ومتاحة (الحالة الخضراء) قبل إنشاء الحجز.' : language === 'en' ? 'The room must be clean and available (green status) before a reservation can be created.' : 'La chambre doit être propre et disponible (statut vert) avant de créer une réservation.'}</p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm space-y-1">
              <div><strong>{language === 'ar' ? 'الغرفة' : language === 'en' ? 'Room' : 'Chambre'} :</strong> {roomStatusAlert.roomName}</div>
              <div><strong>{language === 'ar' ? 'الحالة' : language === 'en' ? 'Status' : 'Statut'} :</strong> {roomStatusAlert.status === 'cleaning' ? (language === 'en' ? 'Cleaning' : language === 'ar' ? 'قيد التنظيف' : 'Nettoyage en cours') : roomStatusAlert.status === 'dirty' ? (language === 'en' ? 'Dirty' : language === 'ar' ? 'متسخة' : 'Sale') : roomStatusAlert.status === 'out_of_order' ? (language === 'en' ? 'Out of order' : language === 'ar' ? 'خارج الخدمة' : 'Hors service') : (language === 'en' ? 'Unconfirmed' : language === 'ar' ? 'غير مؤكدة' : 'Non confirmée')}</div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{language === 'ar' ? 'اطلب من التدبير المنزلي تحديث حالة الغرفة إلى نظيفة بعد المراقبة.' : language === 'en' ? 'Ask housekeeping to update the room to Clean after inspection.' : 'Demandez au service d’étage de contrôler la chambre puis de passer son statut à « Propre ».'}</p>
            <div className="flex justify-end"><button type="button" onClick={() => setRoomStatusAlert(null)} className="min-h-11 px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm cursor-pointer">{language === 'ar' ? 'حسنًا' : language === 'en' ? 'Understood' : 'Compris'}</button></div>
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

      {/* Invoice preview — opened after creating an invoice from a confirmed booking */}
      {lastCreatedInvoice && (
        <InvoicePreviewModal
          invoice={lastCreatedInvoice}
          isOpen={isInvoicePreviewOpen}
          onClose={() => {
            setIsInvoicePreviewOpen(false);
            setLastCreatedInvoice(null);
          }}
        />
      )}
    </div>
  );
};
