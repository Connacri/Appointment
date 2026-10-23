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
  Stethoscope,
  Building2,
  UtensilsCrossed,
  Landmark,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  HeartPulse,
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

  // Tenant Nationality & Police Declaration State (Algérien vs Étranger)
  const [guestType, setGuestType] = useState<'algerian' | 'foreigner'>('algerian');
  const [algerianIdType, setAlgerianIdType] = useState<'cni' | 'nin'>('cni');
  const [algerianIdNumber, setAlgerianIdNumber] = useState('');
  const [wilayaOfOrigin, setWilayaOfOrigin] = useState('31 - Oran');
  const [foreignNationality, setForeignNationality] = useState('Française');
  const [passportNumber, setPassportNumber] = useState('');
  const [visaNumber, setVisaNumber] = useState('');
  const [entryDateInCountry, setEntryDateInCountry] = useState('');
  const [showPoliceSheetModal, setShowPoliceSheetModal] = useState(false);

  // Multi-Currency Payment State (DZD, EUR, USD, RMB, GBP, SAR)
  const [paymentCurrency, setPaymentCurrency] = useState<string>('DA');
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

  // 2. RESIDENCE Specific
  const [residenceOccupants, setResidenceOccupants] = useState(2);
  const [residenceDepositType, setResidenceDepositType] = useState('cb_preauth');
  const [residenceCleaningIncluded, setResidenceCleaningIncluded] = useState(true);
  const [residenceLinenPack, setResidenceLinenPack] = useState(true);
  const [residenceParkingOption, setResidenceParkingOption] = useState(false);
  const [residenceKeyPickupTime, setResidenceKeyPickupTime] = useState('16:00');

  // 3. RESTAURANT Specific
  const [restaurantCovers, setRestaurantCovers] = useState(2);
  const [restaurantService, setRestaurantService] = useState<'lunch' | 'dinner_1' | 'dinner_2'>('dinner_1');
  const [restaurantTime, setRestaurantTime] = useState('20:00');
  const [restaurantDietary, setRestaurantDietary] = useState('none');
  const [restaurantOccasion, setRestaurantOccasion] = useState('standard');
  const [restaurantMenuFormula, setRestaurantMenuFormula] = useState('a_la_carte');

  // 4. CLINIC Specific
  const [clinicPatientBirthDate, setClinicPatientBirthDate] = useState('');
  const [clinicSocialSecurity, setClinicSocialSecurity] = useState('');
  const [clinicConsultationMotif, setClinicConsultationMotif] = useState('first_visit');
  const [clinicCareCoverage, setClinicCareCoverage] = useState('secteur1');
  const [clinicReferringDoctor, setClinicReferringDoctor] = useState('');
  const [clinicAppointmentTime, setClinicAppointmentTime] = useState('10:30');

  // 5. ADMINISTRATION Specific
  const [adminProcedureType, setAdminProcedureType] = useState('passport_cni');
  const [adminPreDemandeNumber, setAdminPreDemandeNumber] = useState('');
  const [adminAppointmentTime, setAdminAppointmentTime] = useState('09:40');
  const [adminCheckIdentityDoc, setAdminCheckIdentityDoc] = useState(true);
  const [adminCheckProofOfAddress, setAdminCheckProofOfAddress] = useState(true);
  const [adminCheckPhoto, setAdminCheckPhoto] = useState(true);
  const [adminCheckTaxStamp, setAdminCheckTaxStamp] = useState(false);

  // 6. WELLNESS Specific
  const [wellnessRitual, setWellnessRitual] = useState('californian_massage');
  const [wellnessTherapistPref, setWellnessTherapistPref] = useState('any');
  const [wellnessSessionTime, setWellnessSessionTime] = useState('14:00');
  const [wellnessHealthCheck, setWellnessHealthCheck] = useState('none');
  const [wellnessPackLuxe, setWellnessPackLuxe] = useState(false);

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

      setAlgerianIdNumber(selectedBooking.identityNumber || '');
      setWilayaOfOrigin(selectedBooking.wilayaOfOrigin || '31 - Oran');
      setForeignNationality(
        selectedBooking.nationality && selectedBooking.nationality !== 'Algérienne'
          ? selectedBooking.nationality
          : 'Française'
      );
      setPassportNumber(selectedBooking.passportNumber || '');
      setVisaNumber(selectedBooking.visaNumber || '');
      setEntryDateInCountry(selectedBooking.entryDateInCountry || '');
      setPaymentCurrency(selectedBooking.paymentCurrency || currency || 'DA');
      setPaymentMethodType(
        (selectedBooking.paymentMethodType as any) ||
          (selectedBooking.guestType === 'foreigner' ? 'card_international' : 'cash_dzd')
      );

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
      } else if (selectedBooking.sector === 'residence') {
        if (meta.residenceOccupants) setResidenceOccupants(meta.residenceOccupants);
        if (meta.residenceDepositType) setResidenceDepositType(meta.residenceDepositType);
        if (meta.residenceCleaningIncluded !== undefined) setResidenceCleaningIncluded(meta.residenceCleaningIncluded);
        if (meta.residenceLinenPack !== undefined) setResidenceLinenPack(meta.residenceLinenPack);
        if (meta.residenceParkingOption !== undefined) setResidenceParkingOption(meta.residenceParkingOption);
        if (meta.residenceKeyPickupTime) setResidenceKeyPickupTime(meta.residenceKeyPickupTime);
      } else if (selectedBooking.sector === 'restaurant') {
        if (meta.restaurantCovers) setRestaurantCovers(meta.restaurantCovers);
        if (meta.restaurantService) setRestaurantService(meta.restaurantService);
        if (meta.restaurantTime) setRestaurantTime(meta.restaurantTime);
        if (meta.restaurantDietary) setRestaurantDietary(meta.restaurantDietary);
        if (meta.restaurantOccasion) setRestaurantOccasion(meta.restaurantOccasion);
        if (meta.restaurantMenuFormula) setRestaurantMenuFormula(meta.restaurantMenuFormula);
      } else if (selectedBooking.sector === 'clinic') {
        if (meta.clinicPatientBirthDate) setClinicPatientBirthDate(meta.clinicPatientBirthDate);
        if (meta.clinicSocialSecurity) setClinicSocialSecurity(meta.clinicSocialSecurity);
        if (meta.clinicConsultationMotif) setClinicConsultationMotif(meta.clinicConsultationMotif);
        if (meta.clinicCareCoverage) setClinicCareCoverage(meta.clinicCareCoverage);
        if (meta.clinicReferringDoctor) setClinicReferringDoctor(meta.clinicReferringDoctor);
        if (meta.clinicAppointmentTime) setClinicAppointmentTime(meta.clinicAppointmentTime);
      } else if (selectedBooking.sector === 'administration') {
        if (meta.adminProcedureType) setAdminProcedureType(meta.adminProcedureType);
        if (meta.adminPreDemandeNumber) setAdminPreDemandeNumber(meta.adminPreDemandeNumber);
        if (meta.adminAppointmentTime) setAdminAppointmentTime(meta.adminAppointmentTime);
        if (meta.adminCheckIdentityDoc !== undefined) setAdminCheckIdentityDoc(meta.adminCheckIdentityDoc);
        if (meta.adminCheckProofOfAddress !== undefined) setAdminCheckProofOfAddress(meta.adminCheckProofOfAddress);
        if (meta.adminCheckPhoto !== undefined) setAdminCheckPhoto(meta.adminCheckPhoto);
        if (meta.adminCheckTaxStamp !== undefined) setAdminCheckTaxStamp(meta.adminCheckTaxStamp);
      } else if (selectedBooking.sector === 'wellness') {
        if (meta.wellnessRitual) setWellnessRitual(meta.wellnessRitual);
        if (meta.wellnessTherapistPref) setWellnessTherapistPref(meta.wellnessTherapistPref);
        if (meta.wellnessSessionTime) setWellnessSessionTime(meta.wellnessSessionTime);
        if (meta.wellnessHealthCheck) setWellnessHealthCheck(meta.wellnessHealthCheck);
        if (meta.wellnessPackLuxe !== undefined) setWellnessPackLuxe(meta.wellnessPackLuxe);
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
        // For single-day services (clinic, restaurant, admin, wellness) default to same day; for stays (hotel, residence) default +3 days
        if (activeDomain === 'clinic' || activeDomain === 'restaurant' || activeDomain === 'administration' || activeDomain === 'wellness') {
          setEndDate(newBookingInitialSlot.date);
        } else {
          const next = new Date(y, m - 1, d + 3);
          setEndDate(
            `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
              next.getDate()
            ).padStart(2, '0')}`
          );
        }
      } else {
        setStartDate(currentBaseDate);
        const [y, m, d] = currentBaseDate.split('-').map(Number);
        if (activeDomain === 'clinic' || activeDomain === 'restaurant' || activeDomain === 'administration' || activeDomain === 'wellness') {
          setEndDate(currentBaseDate);
        } else {
          const next = new Date(y, m - 1, d + 3);
          setEndDate(
            `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
              next.getDate()
            ).padStart(2, '0')}`
          );
        }
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
      setPaymentStatus(activeDomain === 'administration' ? 'paid' : 'paid');
      setConflictError(null);
      setGuestType('algerian');
      setAlgerianIdNumber('');
      setWilayaOfOrigin('31 - Oran');
      setForeignNationality('Française');
      setPassportNumber('');
      setVisaNumber('');
      setEntryDateInCountry('');
      setPaymentCurrency(currency || 'DA');
      setPaymentMethodType('cash_dzd');
    }
  }, [isOpen, selectedBooking, newBookingInitialSlot, currentBaseDate, activeDomain, domainResources, currentRole, clientProfile]);

  // Current selected resource
  const currentResource = useMemo(() => {
    return domainResources.find((r) => r.id === resourceId) || domainResources[0] || null;
  }, [domainResources, resourceId]);

  // Calculate days / nights duration
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24);
    return Math.max(1, Math.round(diff));
  }, [startDate, endDate]);

  // Dedicated pricing logic per business domain
  const { totalPrice, priceBreakdown } = useMemo(() => {
    const baseDaily = currentResource?.pricePerDay || 0;

    if (activeDomain === 'hotel') {
      const roomBase = calculatedDays * (baseDaily || 95);
      const mealRate =
        hotelMealPlan === 'breakfast' ? 15 : hotelMealPlan === 'half_board' ? 38 : hotelMealPlan === 'full_board' ? 58 : 0;
      const mealTotal = mealRate * hotelAdults * calculatedDays;
      const babyBedTotal = hotelOptionBabyBed ? 10 * calculatedDays : 0;
      const petTotal = hotelOptionPet ? 15 * calculatedDays : 0;
      const giftTotal = hotelOptionWelcomeGift ? 35 : 0;
      const touristTax = 2.5 * hotelAdults * calculatedDays;
      const total = roomBase + mealTotal + babyBedTotal + petTotal + giftTotal + touristTax;
      return {
        totalPrice: Math.round(total),
        priceBreakdown: `${calculatedDays} nuit(s) × ${baseDaily || 95}€ + repas (${mealTotal}€) + taxe séjour (${touristTax.toFixed(2)}€)`,
      };
    }

    if (activeDomain === 'residence') {
      const rentalBase = calculatedDays * (baseDaily || 110);
      const cleaning = residenceCleaningIncluded ? 65 : 0;
      const linen = residenceLinenPack ? 25 : 0;
      const parking = residenceParkingOption ? 12 * calculatedDays : 0;
      const total = rentalBase + cleaning + linen + parking;
      return {
        totalPrice: Math.round(total),
        priceBreakdown: `${calculatedDays} jour(s) × ${baseDaily || 110}€ + forfait ménage/linge (${cleaning + linen}€) + parking (${parking}€)`,
      };
    }

    if (activeDomain === 'restaurant') {
      const formulaPrice = restaurantMenuFormula === 'accord_mets_vins' ? 75 : restaurantMenuFormula === 'formule_affaires' ? 45 : 35;
      const total = formulaPrice * restaurantCovers;
      return {
        totalPrice: total,
        priceBreakdown: `${restaurantCovers} couvert(s) × ${formulaPrice}€ (${restaurantMenuFormula === 'accord_mets_vins' ? 'Menu Mets & Vins' : 'Menu Carte'})`,
      };
    }

    if (activeDomain === 'clinic' || activeDomain === 'doctor') {
      const actRate = baseDaily || 75;
      return {
        totalPrice: actRate,
        priceBreakdown: `Acte médical consultation : ${actRate}€ (Prise en charge ${clinicCareCoverage === 'secteur1' ? '100% Base Sécu' : 'Secteur 2'})`,
      };
    }

    if (activeDomain === 'administration') {
      return {
        totalPrice: 0,
        priceBreakdown: 'Service Public Gratuit (0.00 €)',
      };
    }

    if (activeDomain === 'wellness') {
      const baseRitual =
        wellnessRitual === 'rituel_balneo'
          ? 110
          : wellnessRitual === 'deep_tissue'
          ? 90
          : wellnessRitual === 'soin_visage'
          ? 65
          : 80;
      const luxe = wellnessPackLuxe ? 25 : 0;
      const total = baseRitual + luxe;
      return {
        totalPrice: total,
        priceBreakdown: `Soin bien-être (${baseRitual}€) ${wellnessPackLuxe ? '+ Pack Serviette & Peignoir Luxe (25€)' : ''}`,
      };
    }

    const fallbackTotal = calculatedDays * (baseDaily || 85);
    return {
      totalPrice: fallbackTotal,
      priceBreakdown: `${calculatedDays} jour(s) × ${baseDaily || 85}€`,
    };
  }, [
    activeDomain,
    currentResource,
    calculatedDays,
    hotelAdults,
    hotelMealPlan,
    hotelOptionBabyBed,
    hotelOptionPet,
    hotelOptionWelcomeGift,
    residenceCleaningIncluded,
    residenceLinenPack,
    residenceParkingOption,
    restaurantCovers,
    restaurantMenuFormula,
    clinicCareCoverage,
    wellnessRitual,
    wellnessPackLuxe,
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
    } else if (activeDomain === 'residence') {
      customMetadata = {
        residenceOccupants,
        residenceDepositType,
        residenceCleaningIncluded,
        residenceLinenPack,
        residenceParkingOption,
        residenceKeyPickupTime,
      };
    } else if (activeDomain === 'restaurant') {
      customMetadata = {
        restaurantCovers,
        restaurantService,
        restaurantTime,
        restaurantDietary,
        restaurantOccasion,
        restaurantMenuFormula,
      };
    } else if (activeDomain === 'clinic') {
      customMetadata = {
        clinicPatientBirthDate,
        clinicSocialSecurity,
        clinicConsultationMotif,
        clinicCareCoverage,
        clinicReferringDoctor,
        clinicAppointmentTime,
      };
    } else if (activeDomain === 'administration') {
      customMetadata = {
        adminProcedureType,
        adminPreDemandeNumber,
        adminAppointmentTime,
        adminCheckIdentityDoc,
        adminCheckProofOfAddress,
        adminCheckPhoto,
        adminCheckTaxStamp,
      };
    } else if (activeDomain === 'wellness') {
      customMetadata = {
        wellnessRitual,
        wellnessTherapistPref,
        wellnessSessionTime,
        wellnessHealthCheck,
        wellnessPackLuxe,
      };
    }

    const totalAdults =
      activeDomain === 'hotel'
        ? hotelAdults
        : activeDomain === 'residence'
        ? residenceOccupants
        : activeDomain === 'restaurant'
        ? restaurantCovers
        : 1;
    const totalChildren = activeDomain === 'hotel' ? hotelChildren : 0;
    const computedOriginalAmount = Math.round(totalPrice * (ratesFromEur[paymentCurrency] || 1));
    const computedRateToDzd = ratesFromEur['DA'] / (ratesFromEur[paymentCurrency] || 1);

    if (isEditing && selectedBooking) {
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
        identityNumber: guestType === 'algerian' ? algerianIdNumber : passportNumber,
        passportNumber: guestType === 'foreigner' ? passportNumber : undefined,
        visaNumber: guestType === 'foreigner' ? visaNumber : undefined,
        entryDateInCountry: guestType === 'foreigner' ? entryDateInCountry : undefined,
        wilayaOfOrigin: guestType === 'algerian' ? wilayaOfOrigin : undefined,
        paymentCurrency,
        originalCurrencyAmount: computedOriginalAmount,
        currencyRateToDzd: computedRateToDzd,
        paymentMethodType,
        customMetadata,
      });
      setSelectedBooking(null);
      setIsNewBookingModalOpen(false);
    } else {
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
        identityNumber: guestType === 'algerian' ? algerianIdNumber : passportNumber,
        passportNumber: guestType === 'foreigner' ? passportNumber : undefined,
        visaNumber: guestType === 'foreigner' ? visaNumber : undefined,
        entryDateInCountry: guestType === 'foreigner' ? entryDateInCountry : undefined,
        wilayaOfOrigin: guestType === 'algerian' ? wilayaOfOrigin : undefined,
        paymentCurrency,
        originalCurrencyAmount: computedOriginalAmount,
        currencyRateToDzd: computedRateToDzd,
        paymentMethodType,
        customMetadata,
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

  // Safe early exit for closed modal - Placed AFTER all hooks have been unconditionally called!
  if (!isOpen) return null;

  // Domain Config and visual identity
  const domainCfg = domainConfigs[activeDomain] || domainConfigs.hotel;

  const getDomainIcon = () => {
    switch (activeDomain) {
      case 'doctor':
        return Stethoscope;
      case 'clinic':
        return HeartPulse;
      case 'hotel':
        return Bed;
      case 'residence':
        return Building2;
      case 'restaurant':
        return UtensilsCrossed;
      case 'administration':
        return Landmark;
      case 'wellness':
        return Sparkles;
      default:
        return Hotel;
    }
  };

  const DomainHeaderIcon = getDomainIcon();

  // Localized Sheet Titles
  const getSheetTitle = () => {
    switch (activeDomain) {
      case 'doctor':
        return {
          fr: 'Fiche de Consultation Médicale (Médecin)',
          en: 'Doctor Medical Appointment Sheet',
          ar: 'استمارة استشارة طبية وفحص',
        };
      case 'clinic':
        return {
          fr: 'Fiche d\'Admission & Plateau Clinique',
          en: 'Clinic Care & Admission Sheet',
          ar: 'استمارة فحص وعلاج بالمصحة',
        };
      case 'hotel':
        return {
          fr: 'Fiche de Réservation Hôtelière',
          en: 'Hotel Reservation Sheet',
          ar: 'استمارة الحجز الفندقي',
        };
      case 'residence':
        return {
          fr: 'Contrat & Fiche de Location Saisonnière',
          en: 'Vacation Rental & Lease Sheet',
          ar: 'استمارة الإيجار السياحي والعقد',
        };
      case 'restaurant':
        return {
          fr: 'Fiche de Réservation Table & Banquet',
          en: 'Table Booking & Dining Sheet',
          ar: 'استمارة حجز طاولة وخدمة مطعم',
        };
      case 'clinic':
        return {
          fr: 'Fiche de Rendez-Vous Médical & Consultation',
          en: 'Medical Consultation & Appointment Sheet',
          ar: 'استمارة موعد فحص واستشارة طبية',
        };
      case 'administration':
        return {
          fr: 'Fiche de Rendez-Vous Démarche Administrative',
          en: 'Public Service Appointment Voucher',
          ar: 'استمارة موعد إداري وخدمة عمومية',
        };
      case 'wellness':
        return {
          fr: 'Fiche de Réservation Séance Bien-être & Spa',
          en: 'Spa & Wellness Care Sheet',
          ar: 'استمارة حجز جلسة استجمام وسبا',
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Dedicated Domain Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <DomainHeaderIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
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
            onClick={closeModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {conflictError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-semibold">{conflictError}</span>
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
                    activeDomain === 'clinic'
                      ? 'Ex: Jean-Marc Dumont'
                      : activeDomain === 'administration'
                      ? 'Ex: Fatima Benali'
                      : activeDomain === 'restaurant'
                      ? 'Ex: Cabinet Laurent & Associés (10 pers)'
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
          {(activeDomain === 'hotel' || activeDomain === 'residence') && (
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

              {guestType === 'algerian' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'Type de Pièce' : 'Document Type'}
                    </label>
                    <select
                      value={algerianIdType}
                      onChange={(e) => setAlgerianIdType(e.target.value as 'cni' | 'nin')}
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                    >
                      <option value="cni">CNI Biométrique</option>
                      <option value="nin">NIN (Numéro d'Identification Nationale)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'N° Pièce Identité' : 'ID Number'}
                    </label>
                    <input
                      type="text"
                      value={algerianIdNumber}
                      onChange={(e) => setAlgerianIdNumber(e.target.value)}
                      placeholder="Ex: 1102938491029"
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'Wilaya de Résidence' : 'Wilaya'}
                    </label>
                    <select
                      value={wilayaOfOrigin}
                      onChange={(e) => setWilayaOfOrigin(e.target.value)}
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                    >
                      <option value="31 - Oran">31 - Oran</option>
                      <option value="16 - Alger">16 - Alger</option>
                      <option value="25 - Constantine">25 - Constantine</option>
                      <option value="09 - Blida">09 - Blida</option>
                      <option value="13 - Tlemcen">13 - Tlemcen</option>
                      <option value="15 - Tizi Ouzou">15 - Tizi Ouzou</option>
                      <option value="19 - Sétif">19 - Sétif</option>
                      <option value="23 - Annaba">23 - Annaba</option>
                      <option value="35 - Boumerdès">35 - Boumerdès</option>
                      <option value="06 - Béjaïa">06 - Béjaïa</option>
                      <option value="47 - Ghardaïa">47 - Ghardaïa</option>
                      <option value="30 - Ouargla">30 - Ouargla</option>
                      <option value="Autre Wilaya">Autre Wilaya</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'Nationalité' : 'Nationality'}
                    </label>
                    <input
                      type="text"
                      value={foreignNationality}
                      onChange={(e) => setForeignNationality(e.target.value)}
                      placeholder="Ex: Française, Espagnole, Chinoise..."
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'N° Passeport' : 'Passport Number'}
                    </label>
                    <input
                      type="text"
                      value={passportNumber}
                      onChange={(e) => setPassportNumber(e.target.value)}
                      placeholder="Ex: 21EF98124"
                      className="w-full h-8 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {language === 'fr' ? 'N° Visa Algérie' : 'Visa Number'}
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
                      {language === 'fr' ? "Date d'Entrée" : 'Entry Date'}
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

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Formule de Pension</label>
                <select
                  value={hotelMealPlan}
                  onChange={(e) => setHotelMealPlan(e.target.value as any)}
                  className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                >
                  <option value="room_only">Hébergement seul (Room Only)</option>
                  <option value="breakfast">Petit-déjeuner buffet inclus (+15€ / pers / jour)</option>
                  <option value="half_board">Demi-pension gourmande (+38€ / pers / jour)</option>
                  <option value="full_board">Pension complète (+58€ / pers / jour)</option>
                </select>
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

          {/* === B. RESIDENCE PREDEFINED SHEET === */}
          {activeDomain === 'residence' && (
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Building2 size={14} />
                <span>Modalités du Contrat de Location Saisonnière</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre d'Occupants</label>
                  <select
                    value={residenceOccupants}
                    onChange={(e) => setResidenceOccupants(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 6, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} occupant{n > 1 ? 's' : ''} (Capacité max)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Dépôt de Garantie (Caution)</label>
                  <select
                    value={residenceDepositType}
                    onChange={(e) => setResidenceDepositType(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="cb_preauth">Pré-autorisation CB (500 € bloqués)</option>
                    <option value="cheque">Chèque de caution (800 €)</option>
                    <option value="cash">Caution espèces à l'état des lieux (300 €)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={residenceCleaningIncluded}
                    onChange={(e) => setResidenceCleaningIncluded(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Ménage départ (+65€)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={residenceLinenPack}
                    onChange={(e) => setResidenceLinenPack(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Draps & Serviettes (+25€)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={residenceParkingOption}
                    onChange={(e) => setResidenceParkingOption(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Place parking (+12€/j)</span>
                </label>
              </div>
            </div>
          )}

          {/* === C. RESTAURANT PREDEFINED SHEET === */}
          {activeDomain === 'restaurant' && (
            <div className="p-3 bg-orange-50/60 dark:bg-orange-950/20 rounded-xl border border-orange-200/70 dark:border-orange-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-orange-800 dark:text-orange-300 font-bold text-xs uppercase tracking-wider">
                <UtensilsCrossed size={14} />
                <span>Paramètres de la Table & Service Culinaire</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre de Couverts</label>
                  <select
                    value={restaurantCovers}
                    onChange={(e) => setRestaurantCovers(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                      <option key={n} value={n}>
                        {n} couvert{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Service</label>
                  <select
                    value={restaurantService}
                    onChange={(e) => setRestaurantService(e.target.value as any)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="lunch">Déjeuner (12h - 14h30)</option>
                    <option value="dinner_1">Dîner 1er serv. (19h - 21h)</option>
                    <option value="dinner_2">Dîner 2nd serv. (21h15 - 23h30)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure Arrivée</label>
                  <input
                    type="time"
                    value={restaurantTime}
                    onChange={(e) => setRestaurantTime(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Régime / Allergies</label>
                  <select
                    value={restaurantDietary}
                    onChange={(e) => setRestaurantDietary(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="none">Aucune restriction alimentaire</option>
                    <option value="vegetarian">Végétarien / Végan</option>
                    <option value="gluten_free">Sans gluten / Maladie cœliaque</option>
                    <option value="halal">Sans porc / Halal</option>
                    <option value="seafood_allergy">Allergie fruits de mer / Arachides</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Formule Menu</label>
                  <select
                    value={restaurantMenuFormula}
                    onChange={(e) => setRestaurantMenuFormula(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="a_la_carte">Menu Carte Gourmande (35€ / pers)</option>
                    <option value="formule_affaires">Formule Affaires Midi (45€ / pers)</option>
                    <option value="accord_mets_vins">Menu Accord Mets & Vins (75€ / pers)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* === D. CLINIC & DOCTOR PREDEFINED SHEET === */}
          {(activeDomain === 'clinic' || activeDomain === 'doctor') && (
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                <Stethoscope size={14} />
                <span>Dossier Médical & Prise en Charge</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Motif de la Consultation</label>
                  <select
                    value={clinicConsultationMotif}
                    onChange={(e) => setClinicConsultationMotif(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="first_visit">Première consultation médicale</option>
                    <option value="followup">Consultation de suivi / Contrôle</option>
                    <option value="urgent">Urgence relative / Douleur aiguë</option>
                    <option value="prescription">Renouvellement ordonnance & bilan</option>
                    <option value="exam">Examen spécialisé (Écho / ECG / Prélèvement)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Régime de Sécurité Sociale</label>
                  <select
                    value={clinicCareCoverage}
                    onChange={(e) => setClinicCareCoverage(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="secteur1">Secteur 1 (Tarif conventionné)</option>
                    <option value="secteur2">Secteur 2 avec OPTAM (Complémentaire)</option>
                    <option value="ald100">Prise en charge ALD 100%</option>
                    <option value="cmu">C2S / Complémentaire Solidaire (Tiers-payant)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">N° Sécurité Sociale / NIR (optionnel)</label>
                  <input
                    type="text"
                    value={clinicSocialSecurity}
                    onChange={(e) => setClinicSocialSecurity(e.target.value)}
                    placeholder="1 85 06 75 ..."
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure du Rendez-Vous</label>
                  <input
                    type="time"
                    value={clinicAppointmentTime}
                    onChange={(e) => setClinicAppointmentTime(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* === E. ADMINISTRATION PREDEFINED SHEET === */}
          {activeDomain === 'administration' && (
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/70 dark:border-indigo-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <Landmark size={14} />
                <span>Instruction de la Démarche Administrative</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Type de Formalité Publique</label>
                  <select
                    value={adminProcedureType}
                    onChange={(e) => setAdminProcedureType(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="passport_cni">Dépôt Passeport biométrique & CNI</option>
                    <option value="urbanisme">Dépôt Permis de construire & Urbanisme</option>
                    <option value="social">Dossier CCAS / Aides sociales & Logement</option>
                    <option value="etat_civil">Acte d'état civil & Mariage / Pacs</option>
                    <option value="elu">Audience citoyenne avec l'élu référent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">N° Pré-demande ANTS / Récépissé</label>
                  <input
                    type="text"
                    value={adminPreDemandeNumber}
                    onChange={(e) => setAdminPreDemandeNumber(e.target.value)}
                    placeholder="ANTS-8937402"
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={adminCheckIdentityDoc}
                    onChange={(e) => setAdminCheckIdentityDoc(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Pièce identité</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={adminCheckProofOfAddress}
                    onChange={(e) => setAdminCheckProofOfAddress(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Justificatif dom.</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={adminCheckPhoto}
                    onChange={(e) => setAdminCheckPhoto(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Photo ANTS</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={adminCheckTaxStamp}
                    onChange={(e) => setAdminCheckTaxStamp(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Timbre fiscal</span>
                </label>
              </div>
            </div>
          )}

          {/* === F. WELLNESS PREDEFINED SHEET === */}
          {activeDomain === 'wellness' && (
            <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-200/70 dark:border-purple-900/40 space-y-3">
              <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={14} />
                <span>Protocole du Soin & Séance Bien-être</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Rituel / Soin Choisi</label>
                  <select
                    value={wellnessRitual}
                    onChange={(e) => setWellnessRitual(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="californian_massage">Massage Californien Relaxant (60 min - 80€)</option>
                    <option value="rituel_balneo">Balnéo Privative Aromatique (90 min - 110€)</option>
                    <option value="deep_tissue">Massage Deep Tissue Décontracturant (60 min - 90€)</option>
                    <option value="soin_visage">Soin Visage Éclat Hydratant Bio (45 min - 65€)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Heure de la Séance</label>
                  <input
                    type="time"
                    value={wellnessSessionTime}
                    onChange={(e) => setWellnessSessionTime(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Bilan Santé & Précautions</label>
                  <select
                    value={wellnessHealthCheck}
                    onChange={(e) => setWellnessHealthCheck(e.target.value)}
                    className="w-full h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="none">Aucune contre-indication médicale</option>
                    <option value="pregnant">Grossesse en cours (&gt; 3 mois)</option>
                    <option value="circulation">Problèmes circulatoires / Jambes lourdes</option>
                    <option value="allergy">Allergie cutanée / Peau réactive</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 text-[11px]">
                    <input
                      type="checkbox"
                      checked={wellnessPackLuxe}
                      onChange={(e) => setWellnessPackLuxe(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Pack Peignoir & Huile Essentielle Luxe (+25€)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 4. DATES & SCHEDULE */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {activeDomain === 'clinic' || activeDomain === 'administration' || activeDomain === 'restaurant'
                  ? language === 'fr'
                    ? 'Date du Rendez-vous / Séance'
                    : 'Date of Appointment'
                  : language === 'fr'
                  ? "Date d'arrivée / Début"
                  : 'Start / Check-in Date'}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {activeDomain === 'clinic' || activeDomain === 'administration' || activeDomain === 'restaurant'
                  ? language === 'fr'
                    ? 'Date de Fin (Idem si 1 jour)'
                    : 'End Date'
                  : language === 'fr'
                  ? 'Date de départ / Fin'
                  : 'End / Check-out Date'}
              </label>
              <input
                type="date"
                required
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
          <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
            {isEditing && selectedBooking && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    updateBookingStatus(selectedBooking.id, 'checked_in');
                    closeModal();
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
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
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
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
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-xs"
            >
              {language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                          : `${residenceOccupants} occupant(s)`}
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
    </div>
  );
};
