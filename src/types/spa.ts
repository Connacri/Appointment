/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Spa, Thalasso & Wellness Centre Types for Appointment PMS
 */

export type SpaCategory = 'massage' | 'hammam_hydro' | 'facial_beauty' | 'package';

export interface SpaTreatment {
  id: string;
  name: { fr: string; en: string; ar: string };
  category: SpaCategory;
  durationMinutes: number; // e.g. 30, 50, 80, 120
  price: number;
  description: { fr: string; en: string; ar: string };
  benefits: { fr: string; en: string; ar: string };
  recommendedFor: { fr: string; en: string; ar: string };
  isSignature?: boolean;
}

export type SpaFacilityType = 'cabin_massage' | 'cabin_hydro' | 'cabin_facial' | 'hammam' | 'sauna' | 'jacuzzi';

export interface SpaFacility {
  id: string;
  name: { fr: string; en: string; ar: string };
  type: SpaFacilityType;
  capacity: number;
  status: 'available' | 'in_treatment' | 'sanitizing' | 'reserved';
  currentGuest?: string;
  currentTreatment?: string;
  temperature?: string;
}

export interface SpaTherapist {
  id: string;
  name: string;
  role: { fr: string; en: string; ar: string };
  specialties: { fr: string; en: string; ar: string };
  isAvailable: boolean;
  assignedCabin?: string;
  todayAppointmentsCount: number;
}

export type SpaAppointmentStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type SpaPaymentMethod = 'room_charge' | 'cash' | 'card' | 'package_included';

export interface SpaAppointment {
  id: string;
  guestName: string;
  guestRoom?: string; // e.g. "101 - Purple Room" or "Client Externe"
  guestPhone?: string;
  treatmentId: string;
  treatmentName: string;
  facilityId: string;
  facilityName: string;
  therapistId: string;
  therapistName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  price: number;
  status: SpaAppointmentStatus;
  paymentMethod: SpaPaymentMethod;
  paymentSettled: boolean;
  notes?: string;
}
