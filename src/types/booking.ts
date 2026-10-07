export type DomainType =
  | 'hotel'
  | 'residence'
  | 'restaurant'
  | 'clinic'
  | 'administration'
  | 'wellness'
  | 'other';

export type UserRole = 'manager' | 'receptionist' | 'staff' | 'client';

export interface DomainConfig {
  id: DomainType;
  label: { fr: string; en: string; ar: string };
  badge: { fr: string; en: string; ar: string };
  unitTerm: { fr: string; en: string; ar: string }; // e.g. Chambre, Table, Cabinet, Guichet
  userTerm: { fr: string; en: string; ar: string }; // e.g. Client, Couvert, Patient, Usager
  bookingTerm: { fr: string; en: string; ar: string }; // e.g. Séjour, Réservation, Rendez-vous, Démarche
  kpiLabel1: { fr: string; en: string; ar: string };
  kpiLabel2: { fr: string; en: string; ar: string };
  icon: string;
}

export type SectorType = DomainType;

export type Language = 'fr' | 'en' | 'ar';
export type Theme = 'light' | 'dark';

export type BookingStatus =
  | 'new'
  | 'confirmed'
  | 'due_in'
  | 'checked_in'
  | 'due_out'
  | 'checked_out'
  | 'booking_offer'
  | 'out_of_order'
  | 'cancelled';

export type DocumentType = 'invoice' | 'quote' | 'proforma';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g. 10 or 20 or 5.5
  total: number;
}

export interface InvoiceRecord {
  id: string;
  docNumber: string; // e.g. FAC-2026-0012, DEV-2026-0004
  docType: DocumentType;
  domain: DomainType;
  bookingId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCompany?: string;
  customerTaxId?: string;
  issueDate: string; // YYYY-MM-DD
  validUntilOrDueDate: string; // YYYY-MM-DD
  items: InvoiceItem[];
  subtotalHT: number;
  discountType: 'none' | 'percent' | 'fixed' | 'promo_code';
  discountValue: number;
  discountCode?: string;
  discountAmount: number;
  vatAmount: number;
  cityTouristTax: number;
  totalTTC: number;
  depositPaid: number;
  balanceDue: number;
  status: 'draft' | 'sent' | 'paid' | 'accepted' | 'rejected' | 'overdue';
  paymentMethod?: 'credit_card' | 'bank_transfer' | 'cash' | 'online';
  termsAndNotes?: string;
}

export interface PromoOffer {
  code: string;
  title: { fr: string; en: string; ar: string };
  type: 'percent' | 'fixed';
  value: number; // e.g. 15 for 15% or 50 for 50€
  minAmount?: number;
  domainScope: DomainType | 'all';
  description: { fr: string; en: string; ar: string };
}

export interface ResourceGroup {
  id: string;
  name: { fr: string; en: string; ar: string };
  sector: SectorType;
  icon?: string;
  resources: ResourceItem[];
}

export interface ResourceItem {
  id: string;
  name: string; // e.g. "101", "Purple Room", "Dr. Martin - Cabinet 1"
  type: string; // e.g. "Single Room", "Cardiologie", "Spa Zen"
  sector: SectorType;
  pricePerDay: number;
  housekeepingStatus?: 'clean' | 'cleaning' | 'dirty' | 'out_of_order';
  capacity?: number;
}

export interface TimelineBooking {
  id: string;
  resourceId: string;
  resourceName: string;
  sector: SectorType;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: BookingStatus;
  totalPrice: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  notes?: string;
  color?: string;
}

export interface AvailabilityCount {
  [date: string]: number; // remaining available rooms on this date
}

export interface AnalyticsTrendPoint {
  date: string;
  displayDate: string;
  totalBookings: number;
  hotelOccupancy: number; // in %
  clinicAppointments: number;
  revenue: number;
  revPar: number;
  teleconsultCount: number;
}

export interface InternationalKpis {
  revPar: number; // Revenue per Available Room (USALI standard)
  adr: number; // Average Daily Rate (EUR)
  hotelOccupancyRate: number; // %
  alos: number; // Average Length of Stay (days)
  clinicAppointmentsTotal: number;
  clinicUtilizationRate: number; // % of capacity booked
  clinicTeleconsultRatio: number; // %
  wellnessBookingsTotal: number;
  totalRevenue: number;
  taxCityCollected: number; // Taxe de séjour / tourist tax
}

export interface ScheduleOptimizationInsight {
  id: string;
  type: 'revenue' | 'capacity' | 'staffing' | 'housekeeping';
  sector: SectorType;
  priority: 'high' | 'medium' | 'low';
  title: { fr: string; en: string; ar: string };
  description: { fr: string; en: string; ar: string };
  metric: string;
  recommendedAction: { fr: string; en: string; ar: string };
  potentialGain: string;
}
