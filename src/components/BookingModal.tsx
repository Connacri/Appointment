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
    updateBookingStatus,
    deleteBooking,
    currentBaseDate,
    currentDomain,
    resourceGroups,
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

      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setStatus('confirmed');
      setNotes('');
      setPaymentStatus(activeDomain === 'administration' ? 'paid' : 'paid');
      setConflictError(null);
    }
  }, [isOpen, selectedBooking, newBookingInitialSlot, currentBaseDate, activeDomain, domainResources]);

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

    if (activeDomain === 'clinic') {
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

    if (isEditing && selectedBooking) {
      updateBookingStatus(selectedBooking.id, status);
      setSelectedBooking(null);
      setIsNewBookingModalOpen(false);
    } else {
      const res = addBooking({
        resourceId: resourceId || domainResources[0]?.id || 'res_1',
        resourceName: currentResource?.name || 'Ressource',
        sector: activeDomain,
        guestName,
        guestEmail: guestEmail || `${guestName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        guestPhone: guestPhone || '+33 6 00 00 00 00',
        startDate,
        endDate: endDate || startDate,
        status,
        totalPrice,
        paymentStatus,
        notes,
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
      case 'hotel':
        return Bed;
      case 'residence':
        return Building2;
      case 'restaurant':
        return UtensilsCrossed;
      case 'clinic':
        return Stethoscope;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
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

          {/* === D. CLINIC PREDEFINED SHEET === */}
          {activeDomain === 'clinic' && (
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

          {/* 5. STATUS & PAYMENT */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fr' ? 'Statut du dossier :' : language === 'ar' ? 'حالة الحجز:' : 'Status:'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="paid">{language === 'fr' ? 'Payé intégralement' : 'Paid in full'}</option>
                <option value="pending">{language === 'fr' ? 'En attente' : 'Pending'}</option>
                <option value="partial">{language === 'fr' ? 'Acompte versé' : 'Deposit partial'}</option>
              </select>
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
              placeholder="Consignes particulières, heure de rendez-vous, accès code..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* 7. DEDICATED DOMAIN PRICING BOX */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-xs">
                {priceBreakdown}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white text-base">
                Total : {totalPrice === 0 ? 'Gratuit (0.00 €)' : `${totalPrice} €`}
              </span>
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
    </div>
  );
};
