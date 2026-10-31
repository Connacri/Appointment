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
  
  updatedAt: string;
}

export const DEFAULT_ESTABLISHMENT_PROFILE: EstablishmentProfile = {
  id: 'est_default_oran',
  name: "Grand Hôtel & Resort Méditerranée",
  type: 'hotel',
  typeLabel: "Hôtel 4 Étoiles & Résidence Hôtelière",
  stars: 4,
  slogan: "L'Excellence du Séjour & le Confort au Bord de Mer",
  logoUrl: '', // Logo par défaut généré dynamiquement
  address: "Boulevard Front de Mer, Les Falaises",
  city: "Oran",
  postalCode: "31000",
  region: "Wilaya d'Oran",
  country: "Algérie",
  phone: "+213 (0) 41 40 50 60",
  phoneSecondary: "+213 (0) 550 12 34 56",
  email: "contact@hotel-mediterranee.dz",
  website: "www.hotel-mediterranee.dz",
  taxNumber: "001231019000045", // NIF
  tradeRegisterNumber: "31/00-1984250B20", // RC
  statisticalIdNumber: "099031010045678", // NIS
  taxArticleNumber: "31012450099", // Article
  vatNumber: "",
  bankName: "Banque d'Algérie / BNA Agence Oran Centre",
  bankAccountRib: "001 00450 0200012345 67",
  bankSwift: "BNALDZAL045",
  defaultCurrency: "DA",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  updatedAt: new Date().toISOString(),
};
