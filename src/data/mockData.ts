import { ResourceGroup, TimelineBooking, InvoiceRecord, PromoOffer } from '../types/booking';

export const initialResourceGroups: ResourceGroup[] = [
  // HÔTELLERIE
  {
    id: 'grp_single',
    name: {
      fr: 'Chambre Simple (Single Room)',
      en: 'Single Room',
      ar: 'غرفة مفردة',
    },
    sector: 'hotel',
    resources: [
      { id: 'rm_101', name: '101 - Purple Room', type: 'Single Room', sector: 'hotel', pricePerDay: 85, housekeepingStatus: 'clean', capacity: 1 },
      { id: 'rm_102', name: '102 - Yellow Room', type: 'Single Room', sector: 'hotel', pricePerDay: 85, housekeepingStatus: 'clean', capacity: 1 },
      { id: 'rm_103', name: '103 - Green Room', type: 'Single Room', sector: 'hotel', pricePerDay: 90, housekeepingStatus: 'cleaning', capacity: 1 },
      { id: 'rm_104', name: '104 - Orange Room', type: 'Single Room', sector: 'hotel', pricePerDay: 90, housekeepingStatus: 'dirty', capacity: 1 },
    ],
  },
  {
    id: 'grp_double',
    name: {
      fr: 'Chambre Double Standard Panorama',
      en: 'Double Room Standard with Panorama',
      ar: 'غرفة مزدوجة بإطلالة بانورامية',
    },
    sector: 'hotel',
    resources: [
      { id: 'rm_201', name: '201 - Blue Room', type: 'Double Room', sector: 'hotel', pricePerDay: 110, housekeepingStatus: 'clean', capacity: 2 },
      { id: 'rm_202', name: '202 - Violet Room', type: 'Double Room', sector: 'hotel', pricePerDay: 115, housekeepingStatus: 'clean', capacity: 2 },
      { id: 'rm_203', name: '203 - Red Room', type: 'Double Room', sector: 'hotel', pricePerDay: 120, housekeepingStatus: 'clean', capacity: 2 },
    ],
  },
  {
    id: 'grp_suite',
    name: {
      fr: 'Suites de Prestige',
      en: 'Prestige Suites',
      ar: 'أجنحة فاخرة',
    },
    sector: 'hotel',
    resources: [
      { id: 'rm_301', name: '301 - Cozy Suite', type: 'Suite', sector: 'hotel', pricePerDay: 190, housekeepingStatus: 'clean', capacity: 3 },
      { id: 'rm_302', name: '302 - Wonderful Suite', type: 'Suite', sector: 'hotel', pricePerDay: 230, housekeepingStatus: 'clean', capacity: 4 },
      { id: 'rm_303', name: '303 - Presidential Suite', type: 'Suite', sector: 'hotel', pricePerDay: 350, housekeepingStatus: 'clean', capacity: 4 },
    ],
  },

  // CLINIQUE & MÉDECINS
  {
    id: 'grp_clinic_consult',
    name: {
      fr: 'Cabinets Médicaux & Spécialités',
      en: 'Medical Cabinets & Specialists',
      ar: 'العيادات الطبية والاستشارات',
    },
    sector: 'clinic',
    resources: [
      { id: 'cl_101', name: 'Dr. Ramona - Dermatologie', type: 'Consultation', sector: 'clinic', pricePerDay: 75, housekeepingStatus: 'clean' },
      { id: 'cl_102', name: 'Dr. Alexander - Cardiologie', type: 'Consultation', sector: 'clinic', pricePerDay: 90, housekeepingStatus: 'clean' },
      { id: 'cl_103', name: 'Dr. Sophie - Pédiatrie', type: 'Consultation', sector: 'clinic', pricePerDay: 65, housekeepingStatus: 'clean' },
      { id: 'cl_104', name: 'Dr. Dieter - Médecine Générale', type: 'Consultation', sector: 'clinic', pricePerDay: 50, housekeepingStatus: 'clean' },
    ],
  },
  {
    id: 'grp_clinic_exam',
    name: {
      fr: 'Salles d\'Examens & Soins',
      en: 'Exam & Procedure Rooms',
      ar: 'غرف الفحص والتحاليل',
    },
    sector: 'clinic',
    resources: [
      { id: 'cl_201', name: 'Salle Échographie & Imagerie', type: 'Exam Room', sector: 'clinic', pricePerDay: 120, housekeepingStatus: 'clean' },
      { id: 'cl_202', name: 'Salle Prélèvements & Soins', type: 'Care Room', sector: 'clinic', pricePerDay: 40, housekeepingStatus: 'clean' },
    ],
  },

  // RÉSIDENCE & APPARTEMENTS DE VACANCES
  {
    id: 'grp_residence_studios',
    name: {
      fr: 'Résidence - Studios Meublés & T2',
      en: 'Residence - Furnished Studios & 1-Bed',
      ar: 'إقامة - استوديوهات وشقق مفروشة',
    },
    sector: 'residence',
    resources: [
      { id: 'res_101', name: 'Studio A1 - Jardin Privé', type: 'Studio', sector: 'residence', pricePerDay: 70, housekeepingStatus: 'clean', capacity: 2 },
      { id: 'res_102', name: 'Studio A2 - Balcon Sud', type: 'Studio', sector: 'residence', pricePerDay: 75, housekeepingStatus: 'clean', capacity: 2 },
      { id: 'res_201', name: 'Appartement T2 Terrasse B1', type: 'T2', sector: 'residence', pricePerDay: 130, housekeepingStatus: 'clean', capacity: 4 },
      { id: 'res_301', name: 'Villa Duplex V1 avec Piscine', type: 'Villa', sector: 'residence', pricePerDay: 280, housekeepingStatus: 'clean', capacity: 6 },
    ],
  },

  // RESTAURANT & GASTRONOMIE
  {
    id: 'grp_restaurant_tables',
    name: {
      fr: 'Restaurant - Tables & Salons Particuliers',
      en: 'Restaurant - Tables & Private Dining',
      ar: 'مطعم - طاولات وصالات خاصة',
    },
    sector: 'restaurant',
    resources: [
      { id: 'rest_01', name: 'Table 1 - Terrasse Jardin (2p)', type: 'Terrasse', sector: 'restaurant', pricePerDay: 60, housekeepingStatus: 'clean', capacity: 2 },
      { id: 'rest_02', name: 'Table 2 - Baie Vitrée (4p)', type: 'Salle', sector: 'restaurant', pricePerDay: 120, housekeepingStatus: 'clean', capacity: 4 },
      { id: 'rest_03', name: 'Table 3 - Pergola Ombragée (6p)', type: 'Terrasse', sector: 'restaurant', pricePerDay: 180, housekeepingStatus: 'clean', capacity: 6 },
      { id: 'rest_vip', name: 'Salon Privé Chef & Dégustation (10p)', type: 'VIP Dining', sector: 'restaurant', pricePerDay: 350, housekeepingStatus: 'clean', capacity: 10 },
    ],
  },

  // ADMINISTRATION & GUICHETS PUBLICS
  {
    id: 'grp_admin_desks',
    name: {
      fr: 'Administration - Guichets & Formalités',
      en: 'Administration - Public Service Desks',
      ar: 'إدارة - شبابيك ومكاتب الخدمات العامة',
    },
    sector: 'administration',
    resources: [
      { id: 'adm_01', name: 'Guichet 1 - Passeports & État Civil', type: 'Guichet', sector: 'administration', pricePerDay: 0, housekeepingStatus: 'clean' },
      { id: 'adm_02', name: 'Guichet 2 - Urbanisme & Permis', type: 'Guichet', sector: 'administration', pricePerDay: 0, housekeepingStatus: 'clean' },
      { id: 'adm_03', name: 'Guichet 3 - Affaires Sociales & Aides', type: 'Guichet', sector: 'administration', pricePerDay: 0, housekeepingStatus: 'clean' },
      { id: 'adm_04', name: 'Bureau Élu & Direction Générale', type: 'Bureau', sector: 'administration', pricePerDay: 0, housekeepingStatus: 'clean' },
    ],
  },

  // BIEN-ÊTRE, SPA & SOINS
  {
    id: 'grp_wellness',
    name: {
      fr: 'Espace Bien-être, Spa & Autres RDV',
      en: 'Wellness, Spa & Appointments',
      ar: 'العافية، السبا ومواعيد أخرى',
    },
    sector: 'wellness',
    resources: [
      { id: 'wn_101', name: 'Cabine Zen - Massage & Soins', type: 'Spa', sector: 'wellness', pricePerDay: 80, housekeepingStatus: 'clean' },
      { id: 'wn_102', name: 'Espace Balnéothérapie Privatif', type: 'Hydrotherapy', sector: 'wellness', pricePerDay: 110, housekeepingStatus: 'clean' },
      { id: 'wn_103', name: 'Salon Conseil & Coworking VIP', type: 'Consulting', sector: 'wellness', pricePerDay: 60, housekeepingStatus: 'clean' },
    ],
  },
];

// Helper to format dates YYYY-MM-DD
function getDateOffset(daysOffset: number): string {
  const d = new Date(2026, 9, 26); // Oct 26, 2026 as base date
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const initialBookings: TimelineBooking[] = [
  // Hotel reservations matching screenshots
  {
    id: 'bkg_1',
    resourceId: 'rm_101',
    resourceName: '101 - Purple Room',
    sector: 'hotel',
    guestName: 'Lisa Young',
    guestEmail: 'lisa.young@example.com',
    guestPhone: '+33 6 12 34 56 78',
    startDate: getDateOffset(3), // 29 Oct
    endDate: getDateOffset(8),   // 3 Nov
    status: 'confirmed',
    totalPrice: 425,
    paymentStatus: 'paid',
    notes: 'Arrivée tardive vers 20h. Clé en réception.',
  },
  {
    id: 'bkg_2',
    resourceId: 'rm_102',
    resourceName: '102 - Yellow Room',
    sector: 'hotel',
    guestName: 'Dieter Färber',
    guestEmail: 'dieter.f@example.com',
    guestPhone: '+49 151 2345678',
    startDate: getDateOffset(1), // 27 Oct
    endDate: getDateOffset(4),   // 30 Oct
    status: 'checked_in',
    totalPrice: 255,
    paymentStatus: 'paid',
    notes: 'Petit-déjeuner buffet inclus.',
  },
  {
    id: 'bkg_3',
    resourceId: 'rm_102',
    resourceName: '102 - Yellow Room',
    sector: 'hotel',
    guestName: 'Helen White',
    guestEmail: 'helen.w@example.com',
    guestPhone: '+44 7700 900123',
    startDate: getDateOffset(7), // 2 Nov
    endDate: getDateOffset(11),  // 6 Nov
    status: 'confirmed',
    totalPrice: 340,
    paymentStatus: 'pending',
  },
  {
    id: 'bkg_4',
    resourceId: 'rm_103',
    resourceName: '103 - Green Room',
    sector: 'hotel',
    guestName: 'Nancy Allen',
    guestEmail: 'nancy.a@example.com',
    guestPhone: '+1 415 555 2671',
    startDate: getDateOffset(3), // 29 Oct
    endDate: getDateOffset(10),  // 5 Nov
    status: 'confirmed',
    totalPrice: 630,
    paymentStatus: 'paid',
  },
  {
    id: 'bkg_5',
    resourceId: 'rm_104',
    resourceName: '104 - Orange Room',
    sector: 'hotel',
    guestName: 'Donna Morris',
    guestEmail: 'donna.m@example.com',
    guestPhone: '+33 6 98 76 54 32',
    startDate: getDateOffset(1), // 27 Oct
    endDate: getDateOffset(3),   // 29 Oct
    status: 'confirmed',
    totalPrice: 180,
    paymentStatus: 'paid',
  },
  {
    id: 'bkg_6',
    resourceId: 'rm_201',
    resourceName: '201 - Blue Room',
    sector: 'hotel',
    guestName: 'Alexander Kaufmann',
    guestEmail: 'alex.kaufmann@example.com',
    guestPhone: '+49 170 9988776',
    startDate: getDateOffset(1), // 27 Oct
    endDate: getDateOffset(5),   // 31 Oct
    status: 'checked_in',
    totalPrice: 110,
    paymentStatus: 'paid',
    notes: 'Chambre avec vue mer demandée. Lit King-size.',
  },
  {
    id: 'bkg_7',
    resourceId: 'rm_201',
    resourceName: '201 - Blue Room',
    sector: 'hotel',
    guestName: 'Eric Butler',
    guestEmail: 'eric.b@example.com',
    guestPhone: '+1 212 555 0192',
    startDate: getDateOffset(6), // 1 Nov
    endDate: getDateOffset(11),  // 6 Nov
    status: 'confirmed',
    totalPrice: 550,
    paymentStatus: 'pending',
  },
  {
    id: 'bkg_8',
    resourceId: 'rm_202',
    resourceName: '202 - Violet Room',
    sector: 'hotel',
    guestName: 'Karen Harrison',
    guestEmail: 'karen.h@example.com',
    guestPhone: '+44 7911 123456',
    startDate: getDateOffset(1), // 27 Oct
    endDate: getDateOffset(4),   // 30 Oct
    status: 'due_in',
    totalPrice: 345,
    paymentStatus: 'paid',
  },
  {
    id: 'bkg_9',
    resourceId: 'rm_301',
    resourceName: '301 - Cozy Suite',
    sector: 'hotel',
    guestName: 'Ramona Cold',
    guestEmail: 'ramona.c@example.com',
    guestPhone: '+33 6 45 67 89 01',
    startDate: getDateOffset(0), // 26 Oct
    endDate: getDateOffset(3),   // 29 Oct
    status: 'booking_offer',
    totalPrice: 570,
    paymentStatus: 'pending',
  },
  {
    id: 'bkg_10',
    resourceId: 'rm_301',
    resourceName: '301 - Cozy Suite',
    sector: 'hotel',
    guestName: 'Ernesto Grand',
    guestEmail: 'ernesto.g@example.com',
    guestPhone: '+34 612 345 678',
    startDate: getDateOffset(4), // 30 Oct
    endDate: getDateOffset(8),   // 3 Nov
    status: 'confirmed',
    totalPrice: 760,
    paymentStatus: 'paid',
  },
  {
    id: 'bkg_11',
    resourceId: 'rm_302',
    resourceName: '302 - Wonderful Suite',
    sector: 'hotel',
    guestName: 'Amanda Richdom',
    guestEmail: 'amanda.r@example.com',
    guestPhone: '+1 310 555 8899',
    startDate: getDateOffset(2), // 28 Oct
    endDate: getDateOffset(6),   // 1 Nov
    status: 'new',
    totalPrice: 920,
    paymentStatus: 'pending',
  },

  // Clinique appointments
  {
    id: 'bkg_cl_1',
    resourceId: 'cl_101',
    resourceName: 'Dr. Ramona - Dermatologie',
    sector: 'clinic',
    guestName: 'Marc Olan',
    guestEmail: 'marc.olan@example.com',
    guestPhone: '+33 6 77 88 99 00',
    startDate: getDateOffset(1), // 27 Oct
    endDate: getDateOffset(2),   // 28 Oct
    status: 'confirmed',
    totalPrice: 75,
    paymentStatus: 'paid',
    notes: 'Consultation contrôle grains de beauté.',
  },
  {
    id: 'bkg_cl_2',
    resourceId: 'cl_102',
    resourceName: 'Dr. Alexander - Cardiologie',
    sector: 'clinic',
    guestName: 'Sara Quint',
    guestEmail: 'sara.q@example.com',
    guestPhone: '+33 6 33 22 11 00',
    startDate: getDateOffset(3), // 29 Oct
    endDate: getDateOffset(5),   // 31 Oct
    status: 'checked_in',
    totalPrice: 90,
    paymentStatus: 'paid',
    notes: 'Bilan cardiaque avec ECG.',
  },
  {
    id: 'bkg_cl_3',
    resourceId: 'cl_103',
    resourceName: 'Dr. Sophie - Pédiatrie',
    sector: 'clinic',
    guestName: 'Sophia Norborn',
    guestEmail: 'sophia.n@example.com',
    guestPhone: '+33 6 55 44 33 22',
    startDate: getDateOffset(4), // 30 Oct
    endDate: getDateOffset(7),   // 2 Nov
    status: 'confirmed',
    totalPrice: 65,
    paymentStatus: 'paid',
  },

  // Wellness & Spa
  {
    id: 'bkg_wn_1',
    resourceId: 'wn_101',
    resourceName: 'Cabine Zen - Massage & Soins',
    sector: 'wellness',
    guestName: 'Clark Fotingen',
    guestEmail: 'clark.f@example.com',
    guestPhone: '+1 415 555 9911',
    startDate: getDateOffset(2), // 28 Oct
    endDate: getDateOffset(4),   // 30 Oct
    status: 'confirmed',
    totalPrice: 160,
    paymentStatus: 'paid',
    notes: 'Massage aux pierres chaudes 90 min.',
  },
  {
    id: 'bkg_wn_2',
    resourceId: 'wn_102',
    resourceName: 'Espace Balnéothérapie Privatif',
    sector: 'wellness',
    guestName: 'Olan Dorf',
    guestEmail: 'olan.d@example.com',
    guestPhone: '+49 171 2233445',
    startDate: getDateOffset(0), // 26 Oct
    endDate: getDateOffset(2),   // 28 Oct
    status: 'due_out',
    totalPrice: 220,
    paymentStatus: 'paid',
  },

  // Résidence
  {
    id: 'bkg_res_1',
    resourceId: 'res_101',
    resourceName: 'Studio A1 - Jardin Privé',
    sector: 'residence',
    guestName: 'Jean-Marc Dupont',
    guestEmail: 'jm.dupont@example.com',
    guestPhone: '+33 6 11 22 33 44',
    startDate: getDateOffset(1),
    endDate: getDateOffset(7),
    status: 'checked_in',
    totalPrice: 420,
    paymentStatus: 'paid',
    notes: 'Bail court séjour 6 nuits, état des lieux d\'entrée signé.',
  },
  {
    id: 'bkg_res_2',
    resourceId: 'res_301',
    resourceName: 'Villa Duplex V1 avec Piscine',
    sector: 'residence',
    guestName: 'Famille Van Der Bilt',
    guestEmail: 'vanderbilt@example.com',
    guestPhone: '+31 6 88 99 00 11',
    startDate: getDateOffset(3),
    endDate: getDateOffset(10),
    status: 'confirmed',
    totalPrice: 1960,
    paymentStatus: 'paid',
    notes: 'Caution déposée par carte bancaire.',
  },

  // Restaurant
  {
    id: 'bkg_rest_1',
    resourceId: 'rest_01',
    resourceName: 'Table 1 - Terrasse Jardin (2p)',
    sector: 'restaurant',
    guestName: 'Claire & Thomas',
    guestEmail: 'claire.t@example.com',
    guestPhone: '+33 6 44 55 66 77',
    startDate: getDateOffset(1),
    endDate: getDateOffset(2),
    status: 'confirmed',
    totalPrice: 120,
    paymentStatus: 'paid',
    notes: 'Dîner romantique, menu dégustation 2 couverts.',
  },
  {
    id: 'bkg_rest_2',
    resourceId: 'rest_vip',
    resourceName: 'Salon Privé Chef & Dégustation (10p)',
    sector: 'restaurant',
    guestName: 'Cabinet Avocats Valois',
    guestEmail: 'valois.associes@example.com',
    guestPhone: '+33 1 42 00 00 00',
    startDate: getDateOffset(2),
    endDate: getDateOffset(3),
    status: 'confirmed',
    totalPrice: 850,
    paymentStatus: 'paid',
    notes: 'Dîner d\'affaires 8 personnes, accord mets-vins premium.',
  },

  // Administration
  {
    id: 'bkg_adm_1',
    resourceId: 'adm_01',
    resourceName: 'Guichet 1 - Passeports & État Civil',
    sector: 'administration',
    guestName: 'Karim Benyamine',
    guestEmail: 'k.benyamine@example.com',
    guestPhone: '+33 6 88 77 66 55',
    startDate: getDateOffset(1),
    endDate: getDateOffset(2),
    status: 'confirmed',
    totalPrice: 0,
    paymentStatus: 'paid',
    notes: 'Renouvellement passeport biométrique et CNI.',
  },
  {
    id: 'bkg_adm_2',
    resourceId: 'adm_02',
    resourceName: 'Guichet 2 - Urbanisme & Permis',
    sector: 'administration',
    guestName: 'Architectes Associés',
    guestEmail: 'contact@archi-assoc.fr',
    guestPhone: '+33 1 48 00 00 00',
    startDate: getDateOffset(3),
    endDate: getDateOffset(4),
    status: 'checked_in',
    totalPrice: 0,
    paymentStatus: 'paid',
    notes: 'Dépôt de permis de construire modificatif.',
  },
];

export const domainConfigs: Record<string, any> = {
  hotel: {
    id: 'hotel',
    label: { fr: 'Hôtellerie & Resorts', en: 'Hotel & Resorts', ar: 'الفنادق والمنتجعات' },
    badge: { fr: 'Hôtel', en: 'Hotel', ar: 'فندق' },
    unitTerm: { fr: 'Chambre / Suite', en: 'Room / Suite', ar: 'غرفة / جناح' },
    userTerm: { fr: 'Client / Nuitée', en: 'Guest', ar: 'نزيل' },
    bookingTerm: { fr: 'Séjour', en: 'Stay', ar: 'إقامة' },
    kpiLabel1: { fr: 'RevPAR Hôtelier', en: 'Hotel RevPAR', ar: 'متوسط العائد لكل غرفة' },
    kpiLabel2: { fr: 'Taux d\'Occupation', en: 'Occupancy Rate', ar: 'نسبة الإشغال' },
    icon: 'Hotel',
  },
  residence: {
    id: 'residence',
    label: { fr: 'Résidence & Locations Saisonnières', en: 'Holiday Residence & Rentals', ar: 'الإقامات والشقق السياحية' },
    badge: { fr: 'Résidence', en: 'Residence', ar: 'إقامة' },
    unitTerm: { fr: 'Appartement / Villa', en: 'Apartment / Villa', ar: 'شقة / فيلا' },
    userTerm: { fr: 'Locataire / Voyageur', en: 'Tenant / Traveler', ar: 'مستأجر' },
    bookingTerm: { fr: 'Bail / Séjour', en: 'Rental Stay', ar: 'إيجار' },
    kpiLabel1: { fr: 'Rendement Locatif', en: 'Rental Yield', ar: 'العائد الإيجاري' },
    kpiLabel2: { fr: 'Taux de Remplissage', en: 'Booking Rate', ar: 'نسبة الامتلاء' },
    icon: 'Building2',
  },
  restaurant: {
    id: 'restaurant',
    label: { fr: 'Restaurant & Gastronomie', en: 'Restaurant & Fine Dining', ar: 'المطاعم والضيافة' },
    badge: { fr: 'Restaurant', en: 'Restaurant', ar: 'مطعم' },
    unitTerm: { fr: 'Table / Salon', en: 'Table / Dining Salon', ar: 'طاولة / صالة' },
    userTerm: { fr: 'Client / Couverts', en: 'Guest / Covers', ar: 'ضيف / أفراد' },
    bookingTerm: { fr: 'Réservation Table', en: 'Table Booking', ar: 'حجز طاولة' },
    kpiLabel1: { fr: 'Ticket Moyen (RevPASH)', en: 'Average Ticket', ar: 'متوسط الفاتورة' },
    kpiLabel2: { fr: 'Rotation des Tables', en: 'Table Turnover', ar: 'دوران الطاولات' },
    icon: 'UtensilsCrossed',
  },
  clinic: {
    id: 'clinic',
    label: { fr: 'Clinique & Cabinet Médical', en: 'Medical Clinic & Practice', ar: 'العيادات والمراكز الطبية' },
    badge: { fr: 'Clinique', en: 'Clinic', ar: 'عيادة' },
    unitTerm: { fr: 'Cabinet / Praticien', en: 'Cabinet / Specialist', ar: 'عيادة / طبيب' },
    userTerm: { fr: 'Patient', en: 'Patient', ar: 'مريض' },
    bookingTerm: { fr: 'Consultation', en: 'Medical Visit', ar: 'استشارة طبية' },
    kpiLabel1: { fr: 'Actes Médicaux', en: 'Consultation Volume', ar: 'عدد الكشوفات' },
    kpiLabel2: { fr: 'Utilisation Praticiens', en: 'Specialist Utilization', ar: 'نسبة استخدام العيادات' },
    icon: 'Stethoscope',
  },
  administration: {
    id: 'administration',
    label: { fr: 'Administration & Services Publics', en: 'Public Administration & Desks', ar: 'الإدارات والخدمات الحكومية' },
    badge: { fr: 'Administration', en: 'Public Services', ar: 'إدارة' },
    unitTerm: { fr: 'Guichet / Bureau', en: 'Service Desk / Office', ar: 'شباك / مكتب' },
    userTerm: { fr: 'Usager / Citoyen', en: 'Citizen / Applicant', ar: 'مواطن / مراجع' },
    bookingTerm: { fr: 'Rendez-vous Démarche', en: 'Appointment / Request', ar: 'موعد معاملة' },
    kpiLabel1: { fr: 'Usagers Accueillis', en: 'Citizens Served', ar: 'المراجعون المخدومون' },
    kpiLabel2: { fr: 'Temps de Traitement Moyen', en: 'Avg Processing Time', ar: 'متوسط وقت المعاملة' },
    icon: 'Landmark',
  },
  wellness: {
    id: 'wellness',
    label: { fr: 'Bien-être, Spa & Soins', en: 'Wellness, Spa & Care', ar: 'العافية ومراكز الاسترخاء' },
    badge: { fr: 'Spa & Soins', en: 'Spa & Wellness', ar: 'سبا واستجمام' },
    unitTerm: { fr: 'Cabine / Espace', en: 'Treatment Room / Zone', ar: 'كابينة / صالة' },
    userTerm: { fr: 'Bénéficiaire', en: 'Client', ar: 'عميل' },
    bookingTerm: { fr: 'Séance de soin', en: 'Care Session', ar: 'جلسة عناية' },
    kpiLabel1: { fr: 'Panier Moyen Soins', en: 'Average Care Package', ar: 'متوسط باقة العناية' },
    kpiLabel2: { fr: 'Taux d\'Occupation Cabines', en: 'Cabin Occupancy', ar: 'إشغال الكبائن' },
    icon: 'Sparkles',
  },
};

export const initialPromos: PromoOffer[] = [
  {
    code: 'EARLYBIRD',
    title: { fr: 'Offre Réservation Anticipée -15%', en: 'Early Bird Discount -15%', ar: 'عرض الحجز المبكر -15%' },
    type: 'percent',
    value: 15,
    minAmount: 150,
    domainScope: 'all',
    description: { fr: 'Pour toute réservation confirmée au moins 14 jours à l\'avance', en: 'For bookings made at least 14 days in advance', ar: 'للحجوزات المؤكدة قبل 14 يوماً على الأقل' },
  },
  {
    code: 'PROMO10',
    title: { fr: 'Remise Spéciale Bienvenue -10%', en: 'Special Welcome Discount -10%', ar: 'خصم ترحيبي خاص -10%' },
    type: 'percent',
    value: 10,
    minAmount: 50,
    domainScope: 'all',
    description: { fr: 'Applicable sur premier séjour, consultation ou repas gastronomique', en: 'Valid on first stay, appointment or dining experience', ar: 'يسري على أول إقامة أو استشارة طبية' },
  },
  {
    code: 'VIPCARE',
    title: { fr: 'Bon Privilège VIP -50€', en: 'VIP Privilege Voucher -€50', ar: 'قسيمة كبار الشخصيات -50 يورو' },
    type: 'fixed',
    value: 50,
    minAmount: 250,
    domainScope: 'all',
    description: { fr: 'Réduction forfaitaire immédiate sur suites et forfaits complets', en: 'Instant flat reduction on prestige suites and complete care', ar: 'خصم فوري مباشر على الأجنحة والباقات الشاملة' },
  },
];

export const initialInvoices: InvoiceRecord[] = [
  {
    id: 'inv_1001',
    docNumber: 'FAC-2026-0089',
    docType: 'invoice',
    domain: 'hotel',
    customerName: 'Alexander Kaufmann',
    customerEmail: 'alex.kaufmann@example.com',
    customerPhone: '+49 170 9988776',
    customerAddress: 'Kurfürstendamm 142, 10707 Berlin, Allemagne',
    issueDate: '2026-10-27',
    validUntilOrDueDate: '2026-11-10',
    items: [
      { id: 'it_1', description: 'Chambre 201 - Blue Room (Séjour 4 nuits)', quantity: 4, unitPrice: 110, vatRate: 10, total: 440 },
      { id: 'it_2', description: 'Formule Petit-Déjeuner Buffet Gastronomique', quantity: 4, unitPrice: 25, vatRate: 10, total: 100 },
      { id: 'it_3', description: 'Taxe de Séjour Métropole (2.80€ / nuit)', quantity: 4, unitPrice: 2.8, vatRate: 0, total: 11.2 },
    ],
    subtotalHT: 490.91,
    discountType: 'promo_code',
    discountCode: 'EARLYBIRD',
    discountValue: 15,
    discountAmount: 81.0,
    vatAmount: 49.09,
    cityTouristTax: 11.2,
    totalTTC: 470.2,
    depositPaid: 200.0,
    balanceDue: 270.2,
    status: 'paid',
    paymentMethod: 'credit_card',
    termsAndNotes: 'Règlement effectué par Carte Bancaire. Merci de votre confiance.',
  },
  {
    id: 'inv_1002',
    docNumber: 'DEV-2026-0045',
    docType: 'quote',
    domain: 'clinic',
    customerName: 'Sara Quint',
    customerEmail: 'sara.q@example.com',
    customerPhone: '+33 6 33 22 11 00',
    customerAddress: '24 Avenue des Champs-Élysées, 75008 Paris',
    issueDate: '2026-10-28',
    validUntilOrDueDate: '2026-11-28',
    items: [
      { id: 'it_1', description: 'Consultation Cardiologie Approfondie (Dr. Alexander)', quantity: 1, unitPrice: 90, vatRate: 0, total: 90 },
      { id: 'it_2', description: 'Électrocardiogramme de repos (ECG 12 dérivations)', quantity: 1, unitPrice: 65, vatRate: 0, total: 65 },
      { id: 'it_3', description: 'Échographie Doppler Cardiaque Transthoracique', quantity: 1, unitPrice: 150, vatRate: 0, total: 150 },
    ],
    subtotalHT: 305.0,
    discountType: 'percent',
    discountValue: 10,
    discountAmount: 30.5,
    vatAmount: 0, // Medical exempt VAT
    cityTouristTax: 0,
    totalTTC: 274.5,
    depositPaid: 0,
    balanceDue: 274.5,
    status: 'sent',
    paymentMethod: 'online',
    termsAndNotes: 'Devis valable 30 jours. Actes médicaux conventionnés secteur 2.',
  },
  {
    id: 'inv_1003',
    docNumber: 'PRO-2026-0012',
    docType: 'proforma',
    domain: 'residence',
    customerName: 'Dieter Färber',
    customerEmail: 'dieter.f@example.com',
    customerPhone: '+49 151 2345678',
    customerAddress: 'Leopoldstraße 88, 80802 Munich',
    issueDate: '2026-10-26',
    validUntilOrDueDate: '2026-11-05',
    items: [
      { id: 'it_1', description: 'Villa Duplex V1 avec Piscine Privée (Séjour 7 nuits)', quantity: 7, unitPrice: 280, vatRate: 10, total: 1960 },
      { id: 'it_2', description: 'Forfait Ménage & Linge de Maison Hôtelier', quantity: 1, unitPrice: 120, vatRate: 20, total: 120 },
      { id: 'it_3', description: 'Taxe de Séjour Forfaitaire', quantity: 7, unitPrice: 2.8, vatRate: 0, total: 19.6 },
    ],
    subtotalHT: 1881.82,
    discountType: 'fixed',
    discountValue: 100,
    discountAmount: 100,
    vatAmount: 198.18,
    cityTouristTax: 19.6,
    totalTTC: 1999.6,
    depositPaid: 600.0,
    balanceDue: 1399.6,
    status: 'draft',
    paymentMethod: 'bank_transfer',
    termsAndNotes: 'Facture Pro Forma pour validation d\'acompte par virement bancaire.',
  },
];
