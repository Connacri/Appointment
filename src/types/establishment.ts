/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Profil complet de l'établissement hôtelier / touristique
 * Utilisé pour :
 * - L'onboarding à la première ouverture de l'application
 * - Les en-têtes et pieds de page des Factures, Devis, et Pro Formas
 * - Les exports PDF officiels et fiches de police
 */

export type EstablishmentType =
  | 'hotel'
  | 'resort'
  | 'boutique'
  | 'business'
  | 'residence'
  | 'motel'
  | 'spa_clinic'
  | 'other';

export interface EstablishmentProfile {
  id: string;
  name: string; // Ex: "Grand Hôtel Royal d'Oran"
  type: EstablishmentType;
  typeLabel: string; // Ex: "Hôtel 5 Étoiles & Centre d'Affaires"
  stars: number; // 0 à 5
  slogan?: string; // Ex: "L'Excellence & le Confort au Cœur de la Ville"
  logoUrl?: string; // Image base64 ou URL SVG/PNG
  
  // Coordonnées géographiques & contact
  address: string; // Ex: "14 Boulevard Front de Mer"
  city: string; // Ex: "Oran"
  postalCode?: string; // Ex: "31000"
  region?: string; // Ex: "Wilaya d'Oran"
  country: string; // Ex: "Algérie" ou "France"
  phone: string; // Ex: "+213 41 29 00 00"
  phoneSecondary?: string; // Ex: "+213 550 12 34 56"
  email: string; // Ex: "contact@grandhotel-oran.com"
  website?: string; // Ex: "www.grandhotel-oran.com"
  
  // Mentions Légales & Fiscales (Factures & Devis)
  taxNumber?: string; // NIF (Numéro d'Identification Fiscale)
  tradeRegisterNumber?: string; // RC (Registre de Commerce)
  statisticalIdNumber?: string; // NIS (Numéro d'Identification Statistique)
  taxArticleNumber?: string; // Article d'Imposition (AI)
  vatNumber?: string; // Numéro de TVA intracommunautaire (si Europe)
  
  // Coordonnées Bancaires (Règlement Factures & Devis)
  bankName?: string; // Ex: "Banque Nationale d'Algérie (BNA)" ou "BNP Paribas"
  bankAccountRib?: string; // RIB / Compte / IBAN
  bankSwift?: string; // Code BIC / Swift
  
  // Paramètres d'exploitation
  defaultCurrency: string; // "DA", "€", "$", "SAR", "GBP"
  checkInTime: string; // Ex: "14:00"
  checkOutTime: string; // Ex: "12:00"
  roomGroupingMode?: 'floor' | 'wing' | 'floor_wing'; // Regroupement des chambres dans le planning
  
  updatedAt: string;
}

export const DEFAULT_ESTABLISHMENT_PROFILE: EstablishmentProfile = {
  // Blank draft only. A hotel must be entered or imported explicitly by the user.
  id: 'establishment-draft',
  name: '',
  type: 'hotel',
  typeLabel: '',
  stars: 0,
  slogan: '',
  logoUrl: '',
  address: '',
  city: '',
  postalCode: '',
  region: '',
  country: 'Algérie',
  phone: '',
  phoneSecondary: '',
  email: '',
  website: '',
  taxNumber: '',
  tradeRegisterNumber: '',
  statisticalIdNumber: '',
  taxArticleNumber: '',
  vatNumber: '',
  bankName: '',
  bankAccountRib: '',
  bankSwift: '',
  defaultCurrency: 'DA',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  roomGroupingMode: 'floor',
  updatedAt: new Date().toISOString(),
};
