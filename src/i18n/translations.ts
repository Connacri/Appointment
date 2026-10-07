import { Language } from '../types/booking';

export const translations = {
  // Brand & Top Navigation
  brandName: {
    fr: 'OmniBook',
    en: 'OmniBook',
    ar: 'أومني بوك',
  },
  tagline: {
    fr: 'Hôtellerie, Clinique Médicale & Services',
    en: 'Hospitality, Medical Clinic & Services',
    ar: 'الفنادق، العيادات الطبية والخدمات',
  },
  navExplore: {
    fr: 'Découvrir',
    en: 'Explore',
    ar: 'استكشاف',
  },
  navMyBookings: {
    fr: 'Mes Réservations',
    en: 'My Bookings',
    ar: 'حجوزاتي',
  },
  navCockpit: {
    fr: 'AGENTS.md Cockpit',
    en: 'AGENTS.md Cockpit',
    ar: 'لوحة AGENTS.md',
  },
  navLegal: {
    fr: 'Confidentialité & Compte',
    en: 'Privacy & Account',
    ar: 'الخصوصية والحساب',
  },

  // Sectors & Filters
  sectorAll: {
    fr: 'Tous les services',
    en: 'All Services',
    ar: 'جميع الخدمات',
  },
  sectorHotel: {
    fr: 'Hôtellerie & Séjours',
    en: 'Hotels & Stays',
    ar: 'الفنادق والإقامة',
  },
  sectorClinic: {
    fr: 'Clinique & Médecins',
    en: 'Clinics & Doctors',
    ar: 'العيادات والأطباء',
  },
  sectorWellness: {
    fr: 'Bien-être & Autres RDV',
    en: 'Wellness & Appointments',
    ar: 'العافية ومواعيد أخرى',
  },

  // Search & Sorting
  searchPlaceholder: {
    fr: 'Rechercher une chambre, un médecin, une spécialité ou un soin...',
    en: 'Search a room, doctor, medical specialty, or wellness service...',
    ar: 'ابحث عن غرفة، طبيب، تخصص طبي، أو خدمة استرخاء...',
  },
  filterBy: {
    fr: 'Filtrer',
    en: 'Filter',
    ar: 'تصفية',
  },
  sortByPriceAsc: {
    fr: 'Prix : croissant',
    en: 'Price: Low to High',
    ar: 'السعر: من الأقل إلى الأعلى',
  },
  sortByRating: {
    fr: 'Meilleures notes',
    en: 'Top Rated',
    ar: 'الأعلى تقييماً',
  },

  // Hotel Card & Details
  perNight: {
    fr: '/ nuit',
    en: '/ night',
    ar: '/ ليلة',
  },
  capacityGuests: {
    fr: 'personnes max',
    en: 'guests max',
    ar: 'ضيوف كحد أقصى',
  },
  bookRoom: {
    fr: 'Réserver la chambre',
    en: 'Book Room',
    ar: 'حجز الغرفة',
  },
  checkIn: {
    fr: 'Date d\'arrivée',
    en: 'Check-in Date',
    ar: 'تاريخ الوصول',
  },
  checkOut: {
    fr: 'Date de départ',
    en: 'Check-out Date',
    ar: 'تاريخ المغادرة',
  },
  guestsCount: {
    fr: 'Nombre de voyageurs',
    en: 'Number of Guests',
    ar: 'عدد النزلاء',
  },
  boardOption: {
    fr: 'Formule repas',
    en: 'Meal Plan',
    ar: 'خطة الوجبات',
  },
  boardRoomOnly: {
    fr: 'Hébergement seul',
    en: 'Room only',
    ar: 'إقامة فقط بدون وجبات',
  },
  boardBreakfast: {
    fr: 'Petit-déjeuner buffet inclus (+25€/nuit)',
    en: 'Breakfast buffet included (+€25/night)',
    ar: 'شامل بوفيه الإفطار (+25 يورو/ليلة)',
  },
  boardHalfBoard: {
    fr: 'Demi-pension : Dîner gastronomique (+60€/nuit)',
    en: 'Half Board: Dinner included (+€60/night)',
    ar: 'نصف إقامة: عشاء فاخر (+60 يورو/ليلة)',
  },
  boardAllInclusive: {
    fr: 'Tout Inclus premium (+110€/nuit)',
    en: 'All Inclusive premium (+€110/night)',
    ar: 'شامل كلياً مميز (+110 يورو/ليلة)',
  },

  // Clinic Card & Details
  doctorConsultation: {
    fr: 'Consultation',
    en: 'Consultation',
    ar: 'الاستشارة',
  },
  consultationFee: {
    fr: 'Tarif consultation',
    en: 'Consultation Fee',
    ar: 'رسوم الكشف',
  },
  takeAppointment: {
    fr: 'Prendre rendez-vous',
    en: 'Book Appointment',
    ar: 'حجز موعد',
  },
  modeInPerson: {
    fr: 'Au cabinet médical',
    en: 'In-clinic visit',
    ar: 'في العيادة الطبية',
  },
  modeTeleconsultation: {
    fr: 'Téléconsultation vidéo',
    en: 'Video Teleconsultation',
    ar: 'استشارة فيديو عن بُعد',
  },
  selectTimeSlot: {
    fr: 'Sélectionner un créneau horaire',
    en: 'Select a Time Slot',
    ar: 'اختر التوقيت المناسب',
  },
  consultationReason: {
    fr: 'Motif de consultation',
    en: 'Consultation Reason',
    ar: 'سبب الزيارة أو الأعراض',
  },
  consultationReasonPlaceholder: {
    fr: 'Ex: Suivi régulier, bilan de santé, ordonnance, avis spécialisé...',
    en: 'e.g. Regular checkup, health assessment, renewal, specialist advice...',
    ar: 'مثال: فحص دوري، تقييم صحي، تجديد وصفة، استشارة متخصصة...',
  },
  doctorYearsExperience: {
    fr: 'ans d\'expérience',
    en: 'years of experience',
    ar: 'سنوات خبرة',
  },

  // Service & Other Appointments
  serviceDuration: {
    fr: 'Durée',
    en: 'Duration',
    ar: 'المدة',
  },
  minutes: {
    fr: 'minutes',
    en: 'minutes',
    ar: 'دقيقة',
  },
  bookService: {
    fr: 'Réserver la séance',
    en: 'Book Session',
    ar: 'حجز الجلسة',
  },

  // Customer Contact Info
  personalInfo: {
    fr: 'Coordonnées du bénéficiaire',
    en: 'Contact & Guest Details',
    ar: 'بيانات المستفيد أو النزيل',
  },
  fullName: {
    fr: 'Nom complet',
    en: 'Full Name',
    ar: 'الاسم الكامل',
  },
  emailAddress: {
    fr: 'Adresse e-mail (confirmation)',
    en: 'Email Address (for confirmation)',
    ar: 'البريد الإلكتروني (لتأكيد الحجز)',
  },
  phoneNumber: {
    fr: 'Numéro de téléphone',
    en: 'Phone Number',
    ar: 'رقم الهاتف للتواصل',
  },
  specialRequests: {
    fr: 'Demandes particulières ou remarques',
    en: 'Special Requests / Notes',
    ar: 'ملاحظات أو طلبات خاصة',
  },
  specialRequestsPlaceholder: {
    fr: 'Arrivée tardive, allergies, antécédents médicaux...',
    en: 'Late arrival, dietary allergies, medical notes...',
    ar: 'وصول متأخر، حساسية معينة، ملاحظات طبية...',
  },

  // Confirmation & Summary
  orderSummary: {
    fr: 'Récapitulatif de la réservation',
    en: 'Booking Summary',
    ar: 'ملخص الحجز والموعد',
  },
  totalToPay: {
    fr: 'Montant total estimé',
    en: 'Total Estimated Amount',
    ar: 'المبلغ الإجمالي المتوقع',
  },
  confirmAndPay: {
    fr: 'Confirmer la réservation',
    en: 'Confirm Booking',
    ar: 'تأكيد الحجز الآن',
  },
  cancelBtn: {
    fr: 'Fermer',
    en: 'Close',
    ar: 'إغلاق',
  },
  bookingConfirmedTitle: {
    fr: 'Réservation Confirmée !',
    en: 'Booking Confirmed!',
    ar: 'تم تأكيد الحجز بنجاح!',
  },
  bookingConfirmedMsg: {
    fr: 'Votre référence de dossier est active. Un e-mail avec tous les détails a été préparé.',
    en: 'Your reservation reference is active. An email with all booking details has been dispatched.',
    ar: 'تم تفعيل مرجع حجزك بنجاح. أرسلت تفاصيل الحجز إلى بريدك الإلكتروني.',
  },
  confirmationCode: {
    fr: 'Code de confirmation',
    en: 'Confirmation Code',
    ar: 'رمز تأكيد الحجز',
  },
  exportCalendar: {
    fr: 'Ajouter à mon agenda (.ics)',
    en: 'Add to Calendar (.ics)',
    ar: 'إضافة إلى التقويم (.ics)',
  },
  viewMyBookings: {
    fr: 'Consulter mes réservations',
    en: 'View My Bookings',
    ar: 'عرض قائمة حجوزاتي',
  },

  // My Bookings View
  myBookingsTitle: {
    fr: 'Mes Réservations & Rendez-vous',
    en: 'My Bookings & Appointments',
    ar: 'سجل حجوزاتي ومواعيدي',
  },
  filterUpcoming: {
    fr: 'À venir',
    en: 'Upcoming',
    ar: 'القادمة',
  },
  filterPast: {
    fr: 'Passées',
    en: 'Past',
    ar: 'السابقة',
  },
  filterCancelled: {
    fr: 'Annulées',
    en: 'Cancelled',
    ar: 'الملغاة',
  },
  statusConfirmed: {
    fr: 'Confirmé',
    en: 'Confirmed',
    ar: 'مؤكد',
  },
  statusPending: {
    fr: 'En attente',
    en: 'Pending',
    ar: 'قيد المراجعة',
  },
  statusCancelled: {
    fr: 'Annulé',
    en: 'Cancelled',
    ar: 'ملغى',
  },
  cancelReservation: {
    fr: 'Annuler la réservation',
    en: 'Cancel Booking',
    ar: 'إلغاء الحجز',
  },
  cancelConfirmPrompt: {
    fr: 'Êtes-vous sûr de vouloir annuler ce rendez-vous / cette réservation ?',
    en: 'Are you sure you want to cancel this booking/appointment?',
    ar: 'هل أنت متأكد من رغبتك في إلغاء هذا الحجز أو الموعد؟',
  },
  noBookingsFound: {
    fr: 'Aucune réservation trouvée dans cette catégorie.',
    en: 'No bookings found in this category.',
    ar: 'لم يتم العثور على أي حجز في هذا القسم.',
  },
  startBookingNow: {
    fr: 'Parcourir les hébergements & cliniques',
    en: 'Browse Accommodations & Clinics',
    ar: 'تصفح أماكن الإقامة والعيادات',
  },

  // States & Offline Mode
  loadingTitle: {
    fr: 'Chargement des disponibilités...',
    en: 'Loading real-time availability...',
    ar: 'جارٍ جلب المواعيد المتاحة والغرف...',
  },
  offlineTitle: {
    fr: 'Mode Hors-Ligne (Simulé ou Réseau Déconnecté)',
    en: 'Offline Mode (Simulated or Network Disconnected)',
    ar: 'وضع العمل دون اتصال (محاكي أو الشبكة معطلة)',
  },
  offlineDesc: {
    fr: 'Les réservations locales sont enregistrées en mémoire sécurisée et synchronisées dès le rétablissement de la connexion.',
    en: 'Local reservations are stored in secure local state and will synchronize upon network restoration.',
    ar: 'يتم حفظ الحجوزات محلياً في الذاكرة الآمنة ومزامنتها فور عودة الاتصال بالإنترنت.',
  },
  simulateOfflineToggle: {
    fr: 'Simuler Mode Hors-ligne',
    en: 'Simulate Offline Mode',
    ar: 'محاكاة انقطاع الاتصال',
  },
  onlineRestored: {
    fr: 'Connexion réseau active',
    en: 'Active Network Connection',
    ar: 'الاتصال بالإنترنت نشط',
  },
  retryAction: {
    fr: 'Réessayer',
    en: 'Retry',
    ar: 'إعادة المحاولة',
  },

  // AGENTS.md Cockpit & Health Scorecard
  cockpitTitle: {
    fr: 'AGENTS.md Engineering Cockpit',
    en: 'AGENTS.md Engineering Cockpit',
    ar: 'لوحة قيادة معايير AGENTS.md',
  },
  healthScoreTitle: {
    fr: 'Score de Santé du Projet (docs/HEALTH.md)',
    en: 'Project Health Score (docs/HEALTH.md)',
    ar: 'مؤشر صحة المشروع (docs/HEALTH.md)',
  },
  healthScoreMax: {
    fr: 'sur 100 points',
    en: 'out of 100 points',
    ar: 'من أصل 100 نقطة',
  },
  categorySecurity: {
    fr: 'Sécurité & Gestion des Secrets (20 pts)',
    en: 'Security & Secrets Management (20 pts)',
    ar: 'الأمان وإدارة المفاتيح السرية (20 نقطة)',
  },
  categoryCICD: {
    fr: 'CI/CD & Builds Signés Android (20 pts)',
    en: 'CI/CD & Android Signed Builds (20 pts)',
    ar: 'التكامل المستمر وبناء أندرويد الموقع (20 نقطة)',
  },
  categoryCompliance: {
    fr: 'Conformité Google Play & Légale (15 pts)',
    en: 'Google Play & Legal Compliance (15 pts)',
    ar: 'الامتثال لمتجر جوجل بلاي والسياسات (15 نقطة)',
  },
  categoryI18n: {
    fr: 'i18n & Parité RTL Arabe (10 pts)',
    en: 'i18n & Arabic RTL Parity (10 pts)',
    ar: 'تعدد اللغات والمطابقة باللغة العربية (10 نقاط)',
  },
  categoryResponsive: {
    fr: 'Responsive & Accessibilité WCAG (10 pts)',
    en: 'Responsive & WCAG Accessibility (10 pts)',
    ar: 'التوافق مع الشاشات وسهولة الوصول (10 نقاط)',
  },
  categoryPerformance: {
    fr: 'Performance & R8 Minification (10 pts)',
    en: 'Performance & R8 Minification (10 pts)',
    ar: 'الأداء والضغط R8 وميزانية السرعة (10 نقاط)',
  },
  categoryTests: {
    fr: 'Tests & Matrice Appareils (10 pts)',
    en: 'Tests & Multi-Device Matrix (10 pts)',
    ar: 'الاختبارات ومصفوفة الأجهزة (10 نقاط)',
  },
  categoryDocs: {
    fr: 'Documentation & Traçabilité (5 pts)',
    en: 'Documentation & Traceability (5 pts)',
    ar: 'التوثيق الشامل ومتابعة التغييرات (5 نقاط)',
  },
  releaseTrackSimulation: {
    fr: 'Contrôle des Pistes Google Play (Appendix C)',
    en: 'Google Play Tracks Control (Appendix C)',
    ar: 'إدارة مسارات الإطلاق في Google Play',
  },
  stagedRollout: {
    fr: 'Déploiement progressif (Staged Rollout)',
    en: 'Staged Rollout Percentage',
    ar: 'نسبة الإطلاق التدريجي',
  },
  verifySha256: {
    fr: 'Vérifier SHA-256 APK & AAB',
    en: 'Verify APK & AAB SHA-256 Digest',
    ar: 'مطابقة بصمة SHA-256 للتطبيق والحزمة',
  },
  downloadAgentsMd: {
    fr: 'Télécharger AGENTS.md',
    en: 'Download AGENTS.md',
    ar: 'تحميل ملف AGENTS.md',
  },
  downloadWorkflow: {
    fr: 'Télécharger ci-release.yml',
    en: 'Download ci-release.yml',
    ar: 'تحميل ملف ci-release.yml',
  },
  downloadBootstrapScript: {
    fr: 'Télécharger bootstrap-secrets.sh',
    en: 'Download bootstrap-secrets.sh',
    ar: 'تحميل ملف bootstrap-secrets.sh',
  },

  // Legal & In-App Account Deletion
  legalTitle: {
    fr: 'Centre de Confidentialité & Gestion de Compte',
    en: 'Privacy & Account Management Center',
    ar: 'مركز الخصوصية وإدارة بيانات الحساب',
  },
  deleteAccountInAppBtn: {
    fr: 'Supprimer mon compte & purger mes données (In-App §19.3)',
    en: 'Delete My Account & Purge Data (In-App §19.3)',
    ar: 'حذف حسابي ومسح كافة بياناتي نهائياً (§19.3)',
  },
  deleteAccountWarning: {
    fr: 'Action irréversible : Toutes vos réservations, données locales et identifiants de session seront effacés conformément au RGPD.',
    en: 'Irreversible action: All your bookings, local cached data, and session identifiers will be permanently destroyed.',
    ar: 'إجراء لا رجعة فيه: سيتم مسح جميع حجوزاتك ومواعيدك وبياناتك المحلية نهائياً وفقاً لقوانين حماية البيانات.',
  },
  deleteSuccessToast: {
    fr: 'Votre compte et vos données locales ont été entièrement purgés avec succès.',
    en: 'Your account and local storage have been completely erased.',
    ar: 'تم مسح حسابك وكافة السجلات المحلية بالكامل بنجاح.',
  },
  privacyPolicyExternal: {
    fr: 'Consulter la Politique de Confidentialité publique (/privacy/)',
    en: 'Read Public Privacy Policy (/privacy/)',
    ar: 'قراءة سياسة الخصوصية الرسمية للعموم (/privacy/)',
  },
  webDeletionPortalLink: {
    fr: 'Accéder au Portail Web de suppression (/delete-account/)',
    en: 'Visit Web Deletion Portal (/delete-account/)',
    ar: 'زيارة بوابة حذف الحساب عبر الويب (/delete-account/)',
  },
};

export function getTranslation(key: keyof typeof translations, lang: Language): string {
  const item = translations[key];
  if (!item) return key;
  return item[lang] || item['en'] || key;
}
