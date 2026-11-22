import type { Language, PmsTask } from '../types/booking';
import type {
  RoleCategory,
  RoleDefinition,
  StaffCareerChangeType,
  StaffEmploymentStatus,
  StaffMemberRecord,
  StaffShiftType,
  UserRole,
} from '../types/roles';

const ROLE_TASK_TEMPLATES: Record<string, { fr: string[]; en: string[]; ar: string[] }> = {
  room_attendant: {
    fr: ['Nettoyage départ à fond', 'Recouche & réfection literie', 'Réassort produits d’accueil', 'Signalement objets oubliés'],
    en: ['Full checkout room cleaning', 'Stay-over bedding refresh', 'Amenities & consumables restock', 'Report lost property'],
    ar: ['تنظيف شامل بعد المغادرة', 'ترتيب الغرفة وتغيير البياضات', 'تزويد الغرفة بالمستلزمات', 'الإبلاغ عن المفقودات'],
  },
  gouvernante: {
    fr: ['Inspection qualité des chambres', 'Répartition des étages & tâches', 'Contrôle dotation linge & stock', 'Validation chambres prêtes'],
    en: ['Room quality inspection', 'Floor & task allocation', 'Linen & amenities stock check', 'Approve ready rooms'],
    ar: ['فحص جودة الغرف', 'توزيع الطوابق والمهام', 'مراقبة مخزون البياضات', 'اعتماد جاهزية الغرف'],
  },
  laundry_attendant: {
    fr: ['Tri et lavage du linge hôtelier', 'Repassage & pliage serviettes', 'Approvisionnement offices étages'],
    en: ['Sort and wash hotel linen', 'Press and fold towels', 'Replenish floor linen closets'],
    ar: ['فرز وغسل بياضات الفندق', 'كي وطي المناشف', 'تزويد خزائن الطوابق'],
  },
  plumber: {
    fr: ['Contrôle fuites & robinetterie', 'Vérification chauffe-eau & pression', 'Débouchage sanitaires'],
    en: ['Check leaks & faucets', 'Inspect water heaters & pressure', 'Sanitary drain maintenance'],
    ar: ['فحص التسربات والحنفيات', 'فحص السخانات وضغط المياه', 'صيانة الصرف الصحي'],
  },
  carpenter: {
    fr: ['Réglage portes & serrures bois', 'Réparation mobilier & placards', 'Pose joints & plinthes'],
    en: ['Adjust doors & wood frames', 'Repair room furniture & closets', 'Fix trims & moldings'],
    ar: ['ضبط الأبواب والإطارات الخشبية', 'إصلاح أثاث الغرف والخزائن', 'تركيب التشطيبات الخشبية'],
  },
  electrician: {
    fr: ['Contrôle éclairage & prises', 'Vérification disjoncteurs & économiseurs', 'Dépannage TV / domotique'],
    en: ['Inspect lighting & outlets', 'Check breakers & key-card switches', 'Troubleshoot TV / room controls'],
    ar: ['فحص الإضاءة والمقابس', 'فحص القواطع ومفاتيح البطاقات', 'صيانة التلفاز والتحكم الذكي'],
  },
  hvac_tech: {
    fr: ['Nettoyage filtres climatisation', 'Contrôle thermostats & gaz', 'Entretien ventilation SDB'],
    en: ['Clean AC filters', 'Check thermostats & refrigerant', 'Bathroom exhaust maintenance'],
    ar: ['تنظيف فلاتر التكييف', 'فحص منظمات الحرارة والغاز', 'صيانة التهوية'],
  },
  maintenance_tech: {
    fr: ['Ronde maintenance préventive', 'Retouches peinture & serrurerie', 'Intervention demandes urgentes'],
    en: ['Preventive facility rounds', 'Paint touch-ups & mechanical locks', 'Urgent repair dispatch'],
    ar: ['جولة الصيانة الوقائية', 'أعمال الدهان والأقفال', 'معالجة الأعطال الطارئة'],
  },
  receptionist: {
    fr: ['Accueil check-in / check-out', 'Encodage cartes proUSB', 'Facturation & fiches police'],
    en: ['Front desk check-in / check-out', 'Encode proUSB key cards', 'Billing & guest registration'],
    ar: ['استقبال وتسجيل الدخول والمغادرة', 'برمجة بطاقات الغرف', 'الفوترة وتوثيق النزلاء'],
  },
  concierge: {
    fr: ['Accueil bagages & parking', 'Coordination transferts & excursions', 'Réservations Spa & demandes VIP'],
    en: ['Luggage & valet welcome', 'Coordinate transfers & tours', 'Spa & VIP guest requests'],
    ar: ['استلام الأمتعة وخدمة النزلاء', 'تنسيق التنقلات والرحلات', 'حجوزات السبا وطلبات كبار الشخصيات'],
  },
  night_auditor: {
    fr: ['Clôture caisse & audit nocturne', 'Accueil arrivées tardives', 'Ronde sécurité & veille'],
    en: ['Night audit & cash closing', 'Late arrivals check-in', 'Overnight security round'],
    ar: ['الإغلاق المالي والتدقيق الليلي', 'استقبال الوصول المتأخر', 'الجولة الأمنية الليلية'],
  },
  room_service: {
    fr: ['Livraison plateaux en chambre', 'Inventaire & réassort minibar', 'Débarrassage étages'],
    en: ['In-room meal delivery', 'Minibar inventory & restock', 'Floor tray clearance'],
    ar: ['توصيل الوجبات للغرف', 'جرد وتعبئة الميني بار', 'جمع صواني الغرف'],
  },
  spa_therapist: {
    fr: ['Préparation cabines de soins', 'Réalisation séances Spa / Hammam', 'Gestion huiles & linge Spa'],
    en: ['Prepare treatment cabins', 'Perform Spa / Hammam sessions', 'Manage Spa oils & towels'],
    ar: ['تجهيز غرف العناية', 'تنفيذ جلسات السبا والحمام', 'إدارة مستلزمات السبا'],
  },
  security: {
    fr: ['Contrôle accès & entrées', 'Ronde périmètre & parkings', 'Consignation incidents & objets trouvés'],
    en: ['Access & entrance control', 'Perimeter & parking rounds', 'Log incidents & lost items'],
    ar: ['مراقبة المداخل والأمن', 'جولات المحيط والمواقف', 'توثيق الحوادث والمفقودات'],
  },
  chef_du_personnel: {
    fr: ['Recrutement & création fiches staff', 'Affectation zones & plannings shifts', 'Suivi promotions & charge de travail'],
    en: ['Staff onboarding & role setup', 'Zone & shift allocation', 'Promotions & workload tracking'],
    ar: ['توظيف وإعداد ملفات الموظفين', 'توزيع المناطق والمناوبات', 'متابعة الترقيات وتوازن المهام'],
  },
};

const CATEGORY_TASK_FALLBACKS: Record<RoleCategory, { fr: string[]; en: string[]; ar: string[] }> = {
  management: {
    fr: ['Supervision des équipes', 'Validation qualité & rapports'],
    en: ['Team supervision', 'Quality & reporting review'],
    ar: ['الإشراف على الفرق', 'مراجعة الجودة والتقارير'],
  },
  front_office: {
    fr: ['Accueil & orientation clients', 'Coordination arrivées & départs'],
    en: ['Guest welcome & support', 'Coordinate arrivals & departures'],
    ar: ['استقبال وإرشاد النزلاء', 'تنسيق الوصول والمغادرة'],
  },
  housekeeping: {
    fr: ['Remise en état des chambres', 'Contrôle linge & consommables'],
    en: ['Room turnaround & cleaning', 'Linen & supplies check'],
    ar: ['تنظيف وتجهيز الغرف', 'فحص البياضات والمستلزمات'],
  },
  maintenance: {
    fr: ['Diagnostic & réparation technique', 'Contrôle sécurité installations'],
    en: ['Technical diagnosis & repair', 'Facility safety check'],
    ar: ['الفحص والإصلاح الفني', 'فحص سلامة التجهيزات'],
  },
  guest_services: {
    fr: ['Prise en charge demandes clients', 'Suivi qualité de service'],
    en: ['Handle guest service requests', 'Service quality follow-up'],
    ar: ['تلبية طلبات النزلاء', 'متابعة جودة الخدمة'],
  },
  client: {
    fr: ['Consultation séjour'],
    en: ['Stay consultation'],
    ar: ['متابعة الإقامة'],
  },
};

export function getDefaultTasksForRole(role: RoleDefinition, language: Language = 'fr'): string[] {
  const byId = ROLE_TASK_TEMPLATES[role.id];
  if (byId) return [...(byId[language] || byId.fr)];
  const byCat = CATEGORY_TASK_FALLBACKS[role.category] || CATEGORY_TASK_FALLBACKS.guest_services;
  return [...(byCat[language] || byCat.fr)];
}

export function mapRoleToTaskCategory(role: RoleDefinition): PmsTask['category'] {
  if (role.id === 'laundry_attendant') return 'Linge';
  if (role.id === 'room_service') return 'Minibar & accueil';
  if (role.category === 'housekeeping') return 'Ménage';
  if (role.category === 'maintenance') return 'Maintenance';
  if (role.category === 'guest_services') return 'Livraison';
  return 'Ménage';
}

export function buildStaffMemberRecord(input: {
  id?: string;
  fullName: string;
  phone?: string;
  roleId: UserRole;
  assignment: string;
  shift: StaffShiftType;
  defaultTasks: string[];
  status?: StaffEmploymentStatus;
  approvedBy: string;
  note?: string;
  nowIso?: string;
}): StaffMemberRecord {
  const nowIso = input.nowIso || new Date().toISOString();
  const id = input.id || `stf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanedTasks = Array.from(
    new Set(input.defaultTasks.map((t) => t.trim()).filter(Boolean))
  );
  return {
    id,
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || undefined,
    roleId: input.roleId,
    assignment: input.assignment.trim() || 'Étage 1',
    shift: input.shift,
    defaultTasks: cleanedTasks,
    status: input.status || 'active',
    hiredAt: nowIso,
    history: [
      {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: nowIso,
        type: 'hired',
        toRoleId: input.roleId,
        toAssignment: input.assignment.trim() || 'Étage 1',
        note: input.note?.trim() || undefined,
        approvedBy: input.approvedBy,
      },
    ],
  };
}

export function applyStaffAssignmentUpdate(
  member: StaffMemberRecord,
  patch: {
    assignment: string;
    shift: StaffShiftType;
    status?: StaffEmploymentStatus;
    defaultTasks?: string[];
    note?: string;
    approvedBy: string;
    nowIso?: string;
  }
): StaffMemberRecord {
  const nowIso = patch.nowIso || new Date().toISOString();
  const nextAssignment = patch.assignment.trim() || member.assignment;
  const nextTasks = patch.defaultTasks
    ? Array.from(new Set(patch.defaultTasks.map((t) => t.trim()).filter(Boolean)))
    : member.defaultTasks;
  return {
    ...member,
    assignment: nextAssignment,
    shift: patch.shift,
    status: patch.status ?? member.status,
    defaultTasks: nextTasks,
    history: [
      {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: nowIso,
        type: 'assigned',
        fromRoleId: member.roleId,
        toRoleId: member.roleId,
        fromAssignment: member.assignment,
        toAssignment: nextAssignment,
        note: patch.note?.trim() || undefined,
        approvedBy: patch.approvedBy,
      },
      ...member.history,
    ],
  };
}

export function applyStaffPromotionOrTransfer(
  member: StaffMemberRecord,
  change: {
    newRoleId: UserRole;
    newAssignment?: string;
    newShift?: StaffShiftType;
    defaultTasks?: string[];
    changeType: Extract<StaffCareerChangeType, 'promoted' | 'transferred'>;
    note?: string;
    approvedBy: string;
    nowIso?: string;
  }
): StaffMemberRecord {
  const nowIso = change.nowIso || new Date().toISOString();
  const nextAssignment = change.newAssignment?.trim() || member.assignment;
  const nextTasks = change.defaultTasks
    ? Array.from(new Set(change.defaultTasks.map((t) => t.trim()).filter(Boolean)))
    : member.defaultTasks;

  return {
    ...member,
    roleId: change.newRoleId,
    assignment: nextAssignment,
    shift: change.newShift ?? member.shift,
    defaultTasks: nextTasks,
    history: [
      {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: nowIso,
        type: change.changeType,
        fromRoleId: member.roleId,
        toRoleId: change.newRoleId,
        fromAssignment: member.assignment,
        toAssignment: nextAssignment,
        note: change.note?.trim() || undefined,
        approvedBy: change.approvedBy,
      },
      ...member.history,
    ],
  };
}
