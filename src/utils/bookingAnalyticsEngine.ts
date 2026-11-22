import type {
  DomainType,
  InvoiceRecord,
  Language,
  PmsTask,
  ResourceGroup,
  ResourceItem,
  StockItem,
  StockMovement,
  TimelineBooking,
} from '../types/booking';
import type { EventLogEntry } from '../types/eventLog';
import { HOSPITALITY_MEAL_PLANS, DIETARY_PREFERENCES } from '../data/mealPlans';

export type AnalyticsRangeKey = '7d' | '30d' | '90d' | '365d';

export interface RoomWithGroup extends ResourceItem {
  groupId?: string;
  groupName: string;
}

export interface AnalyticsPeriodSummary {
  from: string;
  toExclusive: string;
  toInclusive: string;
  days: number;
  revenuePrimary: number;
  revenueByCurrency: Record<string, number>;
  occupiedRoomNights: number;
  availableRoomNights: number;
  occupancyPct: number;
  adr: number;
  revPar: number;
  alos: number;
  bookingsCount: number;
  cancellationsCount: number;
  cancelRatePct: number;
  maintenanceTasksCount: number;
  alertsCount: number;
}

export interface MetricDelta {
  current: number;
  previous: number;
  diff: number;
  pctChange: number | null;
}

export interface ComparativeTrendPoint {
  label: string;
  prevLabel: string;
  occupancy: number;
  prevOccupancy: number;
  arrivals: number;
  prevArrivals: number;
  revenue: number;
  prevRevenue: number;
  stockOut: number;
  prevStockOut: number;
}

export interface ForecastHorizonPoint {
  horizonDays: 7 | 14 | 30;
  label: { fr: string; en: string; ar: string };
  confirmedNights: number;
  projectedNights: number;
  confirmedOccupancyPct: number;
  projectedOccupancyPct: number;
  confirmedRevenue: number;
  projectedRevenue: number;
  expectedArrivals: number;
  expectedCheckouts: number;
  confidencePct: number;
}

export interface RoomUsageStat {
  roomId: string;
  roomName: string;
  roomType: string;
  building: string;
  floor: string;
  wing: string;
  housekeepingStatus: ResourceItem['housekeepingStatus'];
  pricePerDay: number;
  staysCount: number;
  prevStaysCount: number;
  nightsSold: number;
  prevNightsSold: number;
  utilizationPct: number;
  prevUtilizationPct: number;
  revenue: number;
  avgStayNights: number;
  maintenanceCount: number;
  alertsCount: number;
}

export interface FloorFrequencyStat {
  key: string;
  building: string;
  floor: string;
  roomsCount: number;
  outOfOrderCount: number;
  occupiedTodayCount: number;
  staysCount: number;
  nightsSold: number;
  prevNightsSold: number;
  occupancyPct: number;
  prevOccupancyPct: number;
  deltaPts: number;
  revenue: number;
  isMostFrequent: boolean;
}

export type ClientSegmentId = 'family' | 'couple' | 'business' | 'solo' | 'vip' | 'group';

export interface ClientSegmentStat {
  id: ClientSegmentId;
  label: { fr: string; en: string; ar: string };
  count: number;
  prevCount: number;
  sharePct: number;
  nightsSold: number;
  revenue: number;
  avgSpend: number;
  avgStayNights: number;
  topNeeds: Array<{ id: string; label: string; count: number }>;
}

export interface AgeBracketStat {
  id: '0-17' | '18-25' | '26-35' | '36-50' | '51-65' | '65+' | 'unspecified';
  label: { fr: string; en: string; ar: string };
  peopleCount: number;
  bookingsCount: number;
  sharePct: number;
  isEstimatedOrMissing: boolean;
  topNeeds: string[];
}

export interface GuestNeedStat {
  id: string;
  label: { fr: string; en: string; ar: string };
  category: 'option' | 'diet' | 'request' | 'comfort';
  count: number;
  prevCount: number;
  sharePct: number;
  topSegments: ClientSegmentId[];
}

export interface MealPlanStat {
  id: string;
  code: string;
  label: string;
  count: number;
  prevCount: number;
  sharePct: number;
}

export interface ExtraAdditiveStat {
  id: string;
  label: string;
  kind: 'paid_extra' | 'diet_additive' | 'stay_option';
  count: number;
  prevCount: number;
  attachRatePct: number;
  estimatedRevenue: number;
}

export interface TechnicalTradeStat {
  id: 'hvac' | 'plumbing' | 'electrical' | 'carpentry' | 'general';
  label: { fr: string; en: string; ar: string };
  count: number;
  prevCount: number;
  openCount: number;
  urgentCount: number;
  sampleRooms: string[];
}

export interface RecurringRiskRoomStat {
  roomKey: string;
  roomLabel: string;
  building: string;
  housekeepingStatus?: ResourceItem['housekeepingStatus'];
  maintenanceCount: number;
  urgentCount: number;
  alertsCount: number;
  lockErrorsCount: number;
  riskScore: number;
  riskLevel: 'high' | 'medium';
  reasons: string[];
}

export interface ComplaintAlertRecord {
  id: string;
  date: string;
  roomName: string;
  guestName: string;
  source: 'guest_alert' | 'booking_note' | 'maintenance_urgent' | 'lock_error' | 'forgotten_item';
  severity: 'high' | 'medium' | 'info';
  text: string;
}

export interface StockRunwayStat {
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  consumedInPeriod: number;
  avgDailyBurn: number;
  daysRemaining: number | null;
  riskLevel: 'critical' | 'warning' | 'healthy';
}

export interface TaskCategoryStat {
  category: PmsTask['category'];
  label: { fr: string; en: string; ar: string };
  total: number;
  prevTotal: number;
  done: number;
  doing: number;
  pending: number;
  cancelled: number;
  urgent: number;
  completionRatePct: number;
  sharePct: number;
}

export interface StaffWorkloadStat {
  staffName: string;
  assignedTotal: number;
  completedCount: number;
  prevCompletedCount: number;
  doingCount: number;
  pendingCount: number;
  urgentHandled: number;
  completionRatePct: number;
  workloadSharePct: number;
  roomsCount: number;
  roomsList: string[];
  consumedUnits: number;
  categoryBreakdown: Array<{ category: PmsTask['category']; count: number; done: number }>;
  balanceStatus: 'overloaded' | 'balanced' | 'available';
}

export interface TaskExecutionLogItem {
  id: string;
  room: string;
  typeName: string;
  category: PmsTask['category'];
  status: PmsTask['status'];
  priority: PmsTask['priority'];
  assignee: string;
  executor: string;
  date: string;
  completedAt?: string;
}

export interface TasksAnalyticsSummary {
  totalTasks: number;
  prevTotalTasks: number;
  completedTasks: number;
  prevCompletedTasks: number;
  doingTasks: number;
  pendingTasks: number;
  cancelledTasks: number;
  urgentOpenTasks: number;
  completionRatePct: number;
  prevCompletionRatePct: number;
  avgTasksPerStaff: number;
  imbalanceDetected: boolean;
  byCategory: TaskCategoryStat[];
  staffWorkload: StaffWorkloadStat[];
  recentExecutions: TaskExecutionLogItem[];
}

export interface ManagerRecommendation {
  id: string;
  category: 'yield' | 'prevention' | 'quality' | 'stock' | 'upsell' | 'operations';
  priority: 'high' | 'medium' | 'low';
  title: { fr: string; en: string; ar: string };
  rationale: { fr: string; en: string; ar: string };
  action: { fr: string; en: string; ar: string };
  metricBadge: string;
}

export interface BookingAnalyticsSnapshot {
  range: AnalyticsRangeKey;
  today: string;
  current: AnalyticsPeriodSummary;
  previous: AnalyticsPeriodSummary;
  deltas: {
    revenue: MetricDelta;
    occupancyPct: MetricDelta;
    nightsSold: MetricDelta;
    adr: MetricDelta;
    revPar: MetricDelta;
    bookingsCount: MetricDelta;
    cancelRatePct: MetricDelta;
    maintenanceTasks: MetricDelta;
    alertsCount: MetricDelta;
    tasksTotal: MetricDelta;
    tasksCompletionRate: MetricDelta;
  };
  trendPoints: ComparativeTrendPoint[];
  forecasts: ForecastHorizonPoint[];
  roomFrequencies: RoomUsageStat[];
  underutilizedRooms: RoomUsageStat[];
  floorFrequencies: FloorFrequencyStat[];
  mostFrequentFloor: FloorFrequencyStat | null;
  clientSegments: ClientSegmentStat[];
  ageBrackets: AgeBracketStat[];
  declaredAgeSharePct: number;
  totalGuestsCount: number;
  totalChildrenCount: number;
  guestNeeds: GuestNeedStat[];
  nationalityBreakdown: Array<{ label: string; count: number; sharePct: number }>;
  channelBreakdown: Array<{ label: string; count: number; sharePct: number; revenue: number }>;
  mealPlanStats: MealPlanStat[];
  paidExtrasStats: ExtraAdditiveStat[];
  dietaryAdditivesStats: ExtraAdditiveStat[];
  extrasAttachRatePct: number;
  totalEstimatedExtrasRevenue: number;
  failuresByTrade: TechnicalTradeStat[];
  recurringRiskRooms: RecurringRiskRoomStat[];
  complaintsAndAlerts: ComplaintAlertRecord[];
  forgottenStoredCount: number;
  stockRunway: StockRunwayStat[];
  tasksAnalytics: TasksAnalyticsSummary;
  recommendations: ManagerRecommendation[];
}

export interface BookingAnalyticsInput {
  bookings: TimelineBooking[];
  rooms: RoomWithGroup[];
  groups: ResourceGroup[];
  tasks: PmsTask[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  eventLogs: EventLogEntry[];
  invoiceDocs: InvoiceRecord[];
  range: AnalyticsRangeKey;
  currency: string;
  domain: DomainType;
  language: Language;
  now?: Date;
}

export function formatAnalyticsDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function analyticsDayDiff(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86400000)) : 0;
}

export function analyticsOverlapNights(
  start: string,
  end: string,
  from: string,
  toExclusive: string
): number {
  const a = start > from ? start : from;
  const b = end < toExclusive ? end : toExclusive;
  return analyticsDayDiff(a, b);
}

function addDays(base: Date, delta: number): Date {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function makeDelta(current: number, previous: number): MetricDelta {
  const diff = Math.round((current - previous) * 10) / 10;
  if (previous === 0) {
    return {
      current,
      previous,
      diff,
      pctChange: current === 0 ? 0 : null,
    };
  }
  return {
    current,
    previous,
    diff,
    pctChange: Math.round(((current - previous) / Math.abs(previous)) * 100),
  };
}

function normalizeToken(value: string | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveBookingAdultCount(b: TimelineBooking): number {
  const meta = b.customMetadata || {};
  const raw = b.adults ?? (b.sector === 'resort' ? meta.resortOccupants : meta.hotelAdults) ?? b.adultGuests?.length;
  return Math.max(1, Number(raw) || 1);
}

function resolveBookingChildCount(b: TimelineBooking): number {
  const meta = b.customMetadata || {};
  const listChildren = Array.isArray(b.occupantsList)
    ? b.occupantsList.filter((o) => o.role === 'child' || o.isAdult === false).length
    : 0;
  const raw = b.children ?? meta.hotelChildren ?? listChildren;
  return Math.max(listChildren, Number(raw) || 0);
}

function resolveClientSegment(b: TimelineBooking): ClientSegmentId {
  const explicit = b.customMetadata?.clientSegment;
  if (
    explicit === 'family' ||
    explicit === 'couple' ||
    explicit === 'business' ||
    explicit === 'solo' ||
    explicit === 'vip' ||
    explicit === 'group'
  ) {
    return explicit;
  }

  const adults = resolveBookingAdultCount(b);
  const children = resolveBookingChildCount(b);
  const text = normalizeToken(`${b.guestName} ${b.notes || ''}`);
  const nights = Math.max(1, analyticsDayDiff(b.startDate, b.endDate));

  if (text.includes('vip') || (b.mealPlan as string) === 'uai' || b.totalPrice >= 550) {
    return 'vip';
  }
  if (children > 0 || text.includes('famille') || text.includes('family')) {
    return 'family';
  }
  if (adults >= 4 || text.includes('groupe') || text.includes('delegation')) {
    return 'group';
  }
  if (
    adults === 1 &&
    (text.includes('mission') ||
      text.includes('societe') ||
      text.includes('entreprise') ||
      text.includes('affaires') ||
      text.includes('business') ||
      nights <= 2)
  ) {
    return 'business';
  }
  if (adults === 2) return 'couple';
  return 'solo';
}

const SEGMENT_LABELS: Record<ClientSegmentId, { fr: string; en: string; ar: string }> = {
  family: { fr: 'Familles', en: 'Families', ar: 'العائلات' },
  couple: { fr: 'Couples & Loisirs', en: 'Couples & Leisure', ar: 'الأزواج والسياحة' },
  business: { fr: 'Affaires / Corporate', en: 'Business / Corporate', ar: 'الأعمال والشركات' },
  solo: { fr: 'Voyageurs Solo', en: 'Solo Travelers', ar: 'المسافرون الأفراد' },
  vip: { fr: 'VIP & Prestige', en: 'VIP & Prestige', ar: 'كبار الشخصيات VIP' },
  group: { fr: 'Groupes & Délégations', en: 'Groups & Delegations', ar: 'المجموعات والوفود' },
};

const AGE_BRACKET_LABELS: Record<AgeBracketStat['id'], { fr: string; en: string; ar: string }> = {
  '0-17': { fr: '0–17 ans (Enfants / Mineurs)', en: '0–17 yrs (Children)', ar: '0–17 سنة (أطفال)' },
  '18-25': { fr: '18–25 ans (Jeunes adultes)', en: '18–25 yrs (Young adults)', ar: '18–25 سنة (شباب)' },
  '26-35': { fr: '26–35 ans (Actifs)', en: '26–35 yrs (Young professionals)', ar: '26–35 سنة' },
  '36-50': { fr: '36–50 ans (Cadres / Familles)', en: '36–50 yrs (Prime adults)', ar: '36–50 سنة' },
  '51-65': { fr: '51–65 ans (Seniors actifs)', en: '51–65 yrs (Mature travelers)', ar: '51–65 سنة' },
  '65+': { fr: '65+ ans (Seniors)', en: '65+ yrs (Seniors)', ar: '65+ سنة' },
  unspecified: { fr: 'Adultes · Âge non renseigné', en: 'Adults · Age unspecified', ar: 'بالغون · العمر غير محدد' },
};

const EXTRA_METADATA_DEFS: Array<{
  id: string;
  label: string;
  pricePerNight?: number;
  flatPrice?: number;
  perPerson?: boolean;
}> = [
  { id: 'grab_go', label: 'Grab & Go (Petit-déj emporté)', pricePerNight: 12, perPerson: true },
  { id: 'picnic', label: 'Panier Pique-Nique Excursion', flatPrice: 20, perPerson: true },
  { id: 'romantic', label: 'Dîner Romantique Chandelles VIP', flatPrice: 65 },
  { id: 'private_chef', label: 'Barbecue & Chef Privé en Villa', flatPrice: 95 },
];

const NEED_RULES: Array<{
  id: string;
  label: { fr: string; en: string; ar: string };
  category: GuestNeedStat['category'];
  metaKey?: string;
  keywords?: string[];
}> = [
  {
    id: 'need_baby_bed',
    label: { fr: 'Lit bébé / Puériculture', en: 'Baby crib / Childcare', ar: 'سرير رضيع / مستلزمات أطفال' },
    category: 'option',
    metaKey: 'hotelOptionBabyBed',
    keywords: ['lit bebe', 'bebe', 'nourrisson', 'berceau', 'puericulture'],
  },
  {
    id: 'need_high_floor',
    label: { fr: 'Étage élevé / Vue dégagée', en: 'High floor / Scenic view', ar: 'طابق علوي / إطلالة مفتوحة' },
    category: 'comfort',
    metaKey: 'hotelOptionHighFloor',
    keywords: ['etage eleve', 'vue mer', 'panoram', 'calme', 'balcon'],
  },
  {
    id: 'need_late_arrival',
    label: { fr: 'Arrivée tardive / Départ tardif', en: 'Late check-in / Late check-out', ar: 'وصول متأخر / مغادرة متأخرة' },
    category: 'request',
    keywords: ['arrivee tardive', 'tardive', 'depart tardif', 'late', '20h', '21h', '22h', '23h'],
  },
  {
    id: 'need_welcome_vip',
    label: { fr: 'Accueil VIP / Cadeau chambre', en: 'VIP welcome / Welcome gift', ar: 'استقبال VIP / هدية ترحيبية' },
    category: 'option',
    metaKey: 'hotelOptionWelcomeGift',
    keywords: ['vip', 'anniversaire', 'fleurs', 'bienvenue', 'bouquet'],
  },
  {
    id: 'need_pet',
    label: { fr: 'Animal de compagnie', en: 'Pet friendly stay', ar: 'اصطحاب حيوان أليف' },
    category: 'option',
    metaKey: 'hotelOptionPet',
    keywords: ['animal', 'chien', 'chat', 'pet'],
  },
  {
    id: 'need_transfer',
    label: { fr: 'Navette aéroport / Transport', en: 'Airport shuttle / Transfer', ar: 'نقل المطار / تنقلات' },
    category: 'request',
    metaKey: 'resortOptionVipTransfer',
    keywords: ['navette', 'aeroport', 'taxi', 'transfert', 'vol'],
  },
  {
    id: 'need_private_pool',
    label: { fr: 'Piscine / Cabana / Plage privée', en: 'Private pool / Beach cabana', ar: 'مسبح خاص / شاطئ خاص' },
    category: 'option',
    metaKey: 'resortOptionPrivatePool',
    keywords: ['piscine', 'plage', 'cabana', 'transat'],
  },
  {
    id: 'need_climate_comfort',
    label: { fr: 'Confort thermique / Climatisation', en: 'Climate / AC preference', ar: 'تكييف وراحة حرارية' },
    category: 'comfort',
    keywords: ['clim', 'climatisation', 'chauffage', 'temperature', 'oreiller'],
  },
];

function extractBookingNeeds(b: TimelineBooking): Array<{ id: string; label: { fr: string; en: string; ar: string }; category: GuestNeedStat['category'] }> {
  const meta = b.customMetadata || {};
  const text = normalizeToken(
    [b.notes || '', ...(b.guestAlerts || []).map((a) => a.text)].join(' ')
  );
  const found: Array<{ id: string; label: { fr: string; en: string; ar: string }; category: GuestNeedStat['category'] }> = [];
  for (const rule of NEED_RULES) {
    const hasMeta = rule.metaKey ? Boolean(meta[rule.metaKey]) : false;
    const hasKeyword = rule.keywords ? rule.keywords.some((kw) => text.includes(kw)) : false;
    if (hasMeta || hasKeyword) {
      found.push({ id: rule.id, label: rule.label, category: rule.category });
    }
  }
  return found;
}

function classifyTechnicalTrade(textRaw: string): TechnicalTradeStat['id'] {
  const t = normalizeToken(textRaw);
  if (/(clim|cvc|hvac|thermostat|chauffage|ventil|filtre|soufflerie|froid)/.test(t)) return 'hvac';
  if (/(plomb|fuite|eau|robinet|douche|wc|toilette|siphon|evier|lavabo|sanitaire|chauffe)/.test(t)) return 'plumbing';
  if (/(electr|prise|ampoule|lampe|eclairage|disjoncteur|serrure|carte|badge|prousb|encodeur|tv|telecommande)/.test(t)) return 'electrical';
  if (/(menuis|porte|fenetre|volet|placard|armoire|charpent|boiserie|poignee|sommier|lit)/.test(t)) return 'carpentry';
  return 'general';
}

const TRADE_LABELS: Record<TechnicalTradeStat['id'], { fr: string; en: string; ar: string }> = {
  hvac: { fr: 'CVC / Climatisation', en: 'HVAC / Climate', ar: 'التكييف والتبريد' },
  plumbing: { fr: 'Plomberie & Sanitaire', en: 'Plumbing & Sanitary', ar: 'السباكة والصحي' },
  electrical: { fr: 'Électricité & Serrures', en: 'Electrical & Locks', ar: 'الكهرباء والأقفال' },
  carpentry: { fr: 'Menuiserie & Mobilier', en: 'Carpentry & Furniture', ar: 'النجارة والأثاث' },
  general: { fr: 'Maintenance générale', en: 'General maintenance', ar: 'صيانة عامة' },
};

const COMPLAINT_REGEX = /(panne|casse|defect|bruit|nuisance|sale|odeur|froid|chaud|plaint|reclam|dolean|retard|manqu|erreur|refus|insatisf|probleme|fuite|bloque)/;

function matchTaskToRoom(taskRoom: string, rooms: RoomWithGroup[]): RoomWithGroup | undefined {
  const normTask = normalizeToken(taskRoom);
  if (!normTask) return undefined;
  return rooms.find((r) => {
    const normName = normalizeToken(r.name);
    const normId = normalizeToken(r.id);
    if (!normName) return false;
    if (normTask === normName || normTask === normId) return true;
    // Matches "CV-101" or "PL-102" against "101" / "102"
    const suffix = normTask.split(/[-_\s]/).pop();
    return Boolean(suffix && suffix.length >= 2 && (normName === suffix || normName.startsWith(`${suffix} `)));
  });
}

function buildDailyOccupiedCounts(
  dayKeys: string[],
  activeBookings: TimelineBooking[],
  validRoomIds: Set<string>
): Int32Array {
  const occupiedByDay = new Int32Array(dayKeys.length);
  if (dayKeys.length === 0) return occupiedByDay;
  const dayIndex = new Map(dayKeys.map((key, index) => [key, index]));
  const diff = new Int32Array(dayKeys.length + 1);
  const firstDay = dayKeys[0];
  const lastDay = dayKeys[dayKeys.length - 1];

  const intervalsByResource = new Map<string, Array<{ start: number; end: number }>>();
  for (const booking of activeBookings) {
    if (!validRoomIds.has(booking.resourceId)) continue;
    if (['cancelled', 'out_of_order', 'booking_offer'].includes(booking.status)) continue;
    if (booking.endDate <= firstDay || booking.startDate > lastDay) continue;

    let start = dayIndex.get(booking.startDate);
    if (start === undefined) start = booking.startDate < firstDay ? 0 : -1;
    let end = dayIndex.get(booking.endDate);
    if (end === undefined) end = booking.endDate > lastDay ? dayKeys.length : -1;
    if (start < 0 || end < 0 || end <= start) continue;

    const list = intervalsByResource.get(booking.resourceId);
    if (list) list.push({ start, end });
    else intervalsByResource.set(booking.resourceId, [{ start, end }]);
  }

  for (const intervals of intervalsByResource.values()) {
    intervals.sort((a, b) => a.start - b.start);
    let currentStart = -1;
    let currentEnd = -1;
    for (const interval of intervals) {
      if (currentStart < 0) {
        currentStart = interval.start;
        currentEnd = interval.end;
        continue;
      }
      if (interval.start <= currentEnd) {
        if (interval.end > currentEnd) currentEnd = interval.end;
        continue;
      }
      diff[currentStart] += 1;
      diff[Math.min(currentEnd, dayKeys.length)] -= 1;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
    if (currentStart >= 0) {
      diff[currentStart] += 1;
      diff[Math.min(currentEnd, dayKeys.length)] -= 1;
    }
  }

  let running = 0;
  for (let i = 0; i < dayKeys.length; i += 1) {
    running += diff[i];
    occupiedByDay[i] = running;
  }
  return occupiedByDay;
}

function summarizePeriod(
  from: string,
  toExclusive: string,
  days: number,
  bookings: TimelineBooking[],
  validRoomsCount: number,
  tasks: PmsTask[],
  eventLogs: EventLogEntry[],
  domain: DomainType,
  currency: string
): { summary: AnalyticsPeriodSummary; periodBookings: TimelineBooking[]; activeBookings: TimelineBooking[] } {
  const periodBookings = bookings.filter(
    (b) => b.sector === domain && b.startDate < toExclusive && b.endDate > from
  );
  const activeBookings = periodBookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'out_of_order'
  );
  const cancellationsCount = periodBookings.filter((b) => b.status === 'cancelled').length;

  let occupiedRoomNights = 0;
  const revenueByCurrency: Record<string, number> = {};
  let totalStayNights = 0;

  for (const booking of activeBookings) {
    const nightsInPeriod = analyticsOverlapNights(booking.startDate, booking.endDate, from, toExclusive);
    occupiedRoomNights += nightsInPeriod;
    const totalNights = Math.max(1, analyticsDayDiff(booking.startDate, booking.endDate));
    totalStayNights += totalNights;
    const code = booking.paymentCurrency || currency;
    revenueByCurrency[code] = (revenueByCurrency[code] || 0) + (booking.totalPrice * nightsInPeriod) / totalNights;
  }

  const primaryRevenueRaw = revenueByCurrency[currency] ?? Object.values(revenueByCurrency)[0] ?? 0;
  const revenuePrimary = Math.round(primaryRevenueRaw);
  const availableRoomNights = validRoomsCount * days;
  const occupancyPct = availableRoomNights
    ? Math.min(100, Math.round((occupiedRoomNights / availableRoomNights) * 100))
    : 0;
  const adr = occupiedRoomNights > 0 ? Math.round(revenuePrimary / occupiedRoomNights) : 0;
  const revPar = availableRoomNights > 0 ? Math.round(revenuePrimary / availableRoomNights) : 0;
  const alos = activeBookings.length > 0 ? Math.round((totalStayNights / activeBookings.length) * 10) / 10 : 0;
  const cancelRatePct = periodBookings.length > 0 ? Math.round((cancellationsCount / periodBookings.length) * 100) : 0;

  const maintenanceTasksCount = tasks.filter(
    (t) => t.category === 'Maintenance' && t.date >= from && t.date < toExclusive
  ).length;

  const guestAlertCount = periodBookings.reduce((sum, b) => sum + (b.guestAlerts?.length || 0), 0);
  const warnErrorLogsCount = eventLogs.filter((e) => {
    const d = e.timestamp.slice(0, 10);
    return (e.severity === 'warn' || e.severity === 'error') && d >= from && d < toExclusive;
  }).length;

  const toInclusiveDate = addDays(new Date(`${toExclusive}T00:00:00`), -1);

  return {
    summary: {
      from,
      toExclusive,
      toInclusive: formatAnalyticsDateKey(toInclusiveDate),
      days,
      revenuePrimary,
      revenueByCurrency,
      occupiedRoomNights,
      availableRoomNights,
      occupancyPct,
      adr,
      revPar,
      alos,
      bookingsCount: activeBookings.length,
      cancellationsCount,
      cancelRatePct,
      maintenanceTasksCount,
      alertsCount: guestAlertCount + warnErrorLogsCount,
    },
    periodBookings,
    activeBookings,
  };
}

export function computeBookingAnalyticsSnapshot(input: BookingAnalyticsInput): BookingAnalyticsSnapshot {
  const {
    bookings,
    rooms,
    tasks,
    stockItems,
    stockMovements,
    eventLogs,
    invoiceDocs,
    range,
    currency,
    domain,
    language,
    now = new Date(),
  } = input;

  const periodDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const today = formatAnalyticsDateKey(now);
  const from = formatAnalyticsDateKey(addDays(now, -(periodDays - 1)));
  const toExclusive = formatAnalyticsDateKey(addDays(now, 1));

  const prevFrom = formatAnalyticsDateKey(addDays(new Date(`${from}T00:00:00`), -periodDays));
  const prevToExclusive = from;

  const validRooms = rooms.filter((r) => r.housekeepingStatus !== 'out_of_order');
  const validRoomIds = new Set(validRooms.map((r) => r.id));

  const occupiedTodayIds = new Set(
    bookings
      .filter(
        (b) =>
          b.sector === domain &&
          b.status !== 'cancelled' &&
          b.status !== 'out_of_order' &&
          b.startDate <= today &&
          b.endDate > today
      )
      .map((b) => b.resourceId)
  );

  const cur = summarizePeriod(
    from,
    toExclusive,
    periodDays,
    bookings,
    validRooms.length,
    tasks,
    eventLogs,
    domain,
    currency
  );
  const prev = summarizePeriod(
    prevFrom,
    prevToExclusive,
    periodDays,
    bookings,
    validRooms.length,
    tasks,
    eventLogs,
    domain,
    currency
  );

  // Trend points with same-length previous period overlay
  const bucketCount = range === '7d' ? 7 : range === '30d' ? 8 : range === '90d' ? 9 : 12;
  const localeCode = language === 'fr' ? 'fr-DZ' : language === 'ar' ? 'ar-DZ' : 'en-US';

  const buildWindowSeries = (winFrom: string, winToExclusive: string, winBookings: TimelineBooking[]) => {
    const dayKeys: string[] = [];
    const cursor = new Date(`${winFrom}T00:00:00`);
    while (formatAnalyticsDateKey(cursor) < winToExclusive) {
      dayKeys.push(formatAnalyticsDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    const occupiedByDay = buildDailyOccupiedCounts(dayKeys, winBookings, validRoomIds);
    const arrivalsByDay = new Map<string, number>();
    const revenueByDay = new Map<string, number>();

    for (const b of winBookings) {
      if (b.startDate >= winFrom && b.startDate < winToExclusive) {
        arrivalsByDay.set(b.startDate, (arrivalsByDay.get(b.startDate) || 0) + 1);
      }
      const nights = Math.max(1, analyticsDayDiff(b.startDate, b.endDate));
      const nightly = b.totalPrice / nights;
      for (const dKey of dayKeys) {
        if (dKey >= b.startDate && dKey < b.endDate) {
          revenueByDay.set(dKey, (revenueByDay.get(dKey) || 0) + nightly);
        }
      }
    }

    const stockOutByDay = new Map<string, number>();
    for (const mov of stockMovements) {
      if (mov.delta >= 0) continue;
      const d = mov.timestamp.slice(0, 10);
      if (d >= winFrom && d < winToExclusive) {
        stockOutByDay.set(d, (stockOutByDay.get(d) || 0) + Math.abs(mov.delta));
      }
    }

    return Array.from({ length: bucketCount }, (_, index) => {
      const startOffset = Math.floor((index * dayKeys.length) / bucketCount);
      const endOffset =
        index === bucketCount - 1
          ? dayKeys.length
          : Math.floor(((index + 1) * dayKeys.length) / bucketCount);
      let occSum = 0;
      let arrivals = 0;
      let revenue = 0;
      let stockOut = 0;
      for (let day = startOffset; day < endOffset; day += 1) {
        const dKey = dayKeys[day];
        occSum += validRooms.length ? Math.min(100, (occupiedByDay[day] / validRooms.length) * 100) : 0;
        arrivals += arrivalsByDay.get(dKey) || 0;
        revenue += revenueByDay.get(dKey) || 0;
        stockOut += stockOutByDay.get(dKey) || 0;
      }
      const measuredDays = Math.max(1, endOffset - startOffset);
      const labelDate = new Date(`${dayKeys[startOffset] ?? winFrom}T00:00:00`);
      return {
        label: new Intl.DateTimeFormat(localeCode, {
          day: range === '365d' ? undefined : '2-digit',
          month: 'short',
        }).format(labelDate),
        occupancy: Math.round(occSum / measuredDays),
        arrivals,
        revenue: Math.round(revenue),
        stockOut,
      };
    });
  };

  const curSeries = buildWindowSeries(from, toExclusive, cur.activeBookings);
  const prevSeries = buildWindowSeries(prevFrom, prevToExclusive, prev.activeBookings);
  const trendPoints: ComparativeTrendPoint[] = curSeries.map((pt, idx) => {
    const prevPt = prevSeries[idx];
    return {
      label: pt.label,
      prevLabel: prevPt?.label || '',
      occupancy: pt.occupancy,
      prevOccupancy: prevPt?.occupancy ?? 0,
      arrivals: pt.arrivals,
      prevArrivals: prevPt?.arrivals ?? 0,
      revenue: pt.revenue,
      prevRevenue: prevPt?.revenue ?? 0,
      stockOut: pt.stockOut,
      prevStockOut: prevPt?.stockOut ?? 0,
    };
  });

  // Forward Forecast (J+7, J+14, J+30) combining Confirmed On-Books + Recent Pace Projection
  const activeDomainBookings = bookings.filter(
    (b) => b.sector === domain && b.status !== 'cancelled' && b.status !== 'out_of_order'
  );
  const baselineOccRatio =
    cur.summary.occupancyPct > 0 || prev.summary.occupancyPct > 0
      ? (cur.summary.occupancyPct * 0.65 + prev.summary.occupancyPct * 0.35) / 100
      : 0;
  const fallbackAdr =
    cur.summary.adr > 0
      ? cur.summary.adr
      : rooms.length > 0
      ? Math.round(rooms.reduce((s, r) => s + (r.pricePerDay || 0), 0) / rooms.length)
      : 0;

  const forecasts: ForecastHorizonPoint[] = ([7, 14, 30] as const).map((horizonDays) => {
    const fStart = formatAnalyticsDateKey(addDays(now, 1));
    const fEndExcl = formatAnalyticsDateKey(addDays(now, horizonDays + 1));
    const capNights = validRooms.length * horizonDays;

    let confirmedNights = 0;
    let confirmedRev = 0;
    let expectedArrivals = 0;
    let expectedCheckouts = 0;

    for (const b of activeDomainBookings) {
      if (b.startDate < fEndExcl && b.endDate > fStart) {
        const nights = analyticsOverlapNights(b.startDate, b.endDate, fStart, fEndExcl);
        confirmedNights += nights;
        const totalN = Math.max(1, analyticsDayDiff(b.startDate, b.endDate));
        confirmedRev += (b.totalPrice * nights) / totalN;
      }
      if (b.startDate >= fStart && b.startDate < fEndExcl) expectedArrivals += 1;
      if (b.endDate >= fStart && b.endDate < fEndExcl) expectedCheckouts += 1;
    }

    const remainingCapacityNights = Math.max(0, capNights - confirmedNights);
    const pickupFactor = horizonDays === 7 ? 0.45 : horizonDays === 14 ? 0.65 : 0.8;
    const expectedPickupNights = Math.round(remainingCapacityNights * baselineOccRatio * pickupFactor);
    const projectedNights = Math.min(capNights, confirmedNights + expectedPickupNights);
    const confirmedOccupancyPct = capNights > 0 ? Math.min(100, Math.round((confirmedNights / capNights) * 100)) : 0;
    const projectedOccupancyPct = capNights > 0 ? Math.min(100, Math.round((projectedNights / capNights) * 100)) : 0;
    const confirmedRevenue = Math.round(confirmedRev);
    const projectedRevenue = Math.round(confirmedRev + expectedPickupNights * fallbackAdr);
    const hasHistoricalBase = cur.summary.bookingsCount + prev.summary.bookingsCount >= 3;
    const confidencePct = hasHistoricalBase
      ? horizonDays === 7
        ? 88
        : horizonDays === 14
        ? 79
        : 68
      : 52;

    return {
      horizonDays,
      label: {
        fr: `Prévision J+${horizonDays}`,
        en: `Forecast +${horizonDays}d`,
        ar: `توقعات +${horizonDays} يوماً`,
      },
      confirmedNights,
      projectedNights,
      confirmedOccupancyPct,
      projectedOccupancyPct,
      confirmedRevenue,
      projectedRevenue,
      expectedArrivals,
      expectedCheckouts,
      confidencePct,
    };
  });

  // Room usage & frequency (Current vs Previous + Maintenance + Alerts)
  const roomFrequencies: RoomUsageStat[] = rooms
    .map((room) => {
      const curRoomBookings = cur.activeBookings.filter((b) => b.resourceId === room.id);
      const prevRoomBookings = prev.activeBookings.filter((b) => b.resourceId === room.id);
      let nightsSold = 0;
      let totalStayNights = 0;
      let revenue = 0;
      let alertsCount = 0;

      for (const b of curRoomBookings) {
        const overlap = analyticsOverlapNights(b.startDate, b.endDate, from, toExclusive);
        nightsSold += overlap;
        const totalN = Math.max(1, analyticsDayDiff(b.startDate, b.endDate));
        totalStayNights += totalN;
        revenue += (b.totalPrice * overlap) / totalN;
        alertsCount += b.guestAlerts?.length || 0;
      }

      let prevNightsSold = 0;
      for (const b of prevRoomBookings) {
        prevNightsSold += analyticsOverlapNights(b.startDate, b.endDate, prevFrom, prevToExclusive);
      }

      const maintenanceCount = tasks.filter(
        (t) =>
          t.category === 'Maintenance' &&
          t.date >= from &&
          t.date < toExclusive &&
          matchTaskToRoom(t.room, [room])?.id === room.id
      ).length;

      return {
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        building: room.building?.trim() || room.groupName,
        floor: room.floor?.trim() || (language === 'fr' ? 'Non renseigné' : language === 'ar' ? 'غير محدد' : 'Unspecified'),
        wing: room.wing?.trim() || '',
        housekeepingStatus: room.housekeepingStatus,
        pricePerDay: room.pricePerDay || 0,
        staysCount: curRoomBookings.length,
        prevStaysCount: prevRoomBookings.length,
        nightsSold,
        prevNightsSold,
        utilizationPct: periodDays > 0 ? Math.min(100, Math.round((nightsSold / periodDays) * 100)) : 0,
        prevUtilizationPct: periodDays > 0 ? Math.min(100, Math.round((prevNightsSold / periodDays) * 100)) : 0,
        revenue: Math.round(revenue),
        avgStayNights: curRoomBookings.length > 0 ? Math.round((totalStayNights / curRoomBookings.length) * 10) / 10 : 0,
        maintenanceCount,
        alertsCount,
      };
    })
    .sort((a, b) => b.nightsSold - a.nightsSold || b.staysCount - a.staysCount || b.revenue - a.revenue);

  const underutilizedRooms = roomFrequencies
    .filter((r) => r.housekeepingStatus !== 'out_of_order')
    .slice()
    .sort((a, b) => a.utilizationPct - b.utilizationPct || a.staysCount - b.staysCount)
    .slice(0, 5);

  // Floor frequency & comparison
  const floorMap = new Map<string, FloorFrequencyStat>();
  for (const rStat of roomFrequencies) {
    const key = `${rStat.building}::${rStat.floor}`;
    const existing = floorMap.get(key) ?? {
      key,
      building: rStat.building,
      floor: rStat.floor,
      roomsCount: 0,
      outOfOrderCount: 0,
      occupiedTodayCount: 0,
      staysCount: 0,
      nightsSold: 0,
      prevNightsSold: 0,
      occupancyPct: 0,
      prevOccupancyPct: 0,
      deltaPts: 0,
      revenue: 0,
      isMostFrequent: false,
    };
    existing.roomsCount += 1;
    if (rStat.housekeepingStatus === 'out_of_order') existing.outOfOrderCount += 1;
    if (occupiedTodayIds.has(rStat.roomId)) existing.occupiedTodayCount += 1;
    existing.staysCount += rStat.staysCount;
    existing.nightsSold += rStat.nightsSold;
    existing.prevNightsSold += rStat.prevNightsSold;
    existing.revenue += rStat.revenue;
    floorMap.set(key, existing);
  }

  const floorFrequencies = [...floorMap.values()]
    .map((fl) => {
      const activeRooms = Math.max(1, fl.roomsCount - fl.outOfOrderCount);
      const cap = activeRooms * periodDays;
      const occupancyPct = fl.roomsCount - fl.outOfOrderCount > 0 ? Math.min(100, Math.round((fl.nightsSold / cap) * 100)) : 0;
      const prevOccupancyPct = fl.roomsCount - fl.outOfOrderCount > 0 ? Math.min(100, Math.round((fl.prevNightsSold / cap) * 100)) : 0;
      return {
        ...fl,
        occupancyPct,
        prevOccupancyPct,
        deltaPts: occupancyPct - prevOccupancyPct,
      };
    })
    .sort((a, b) => b.nightsSold - a.nightsSold || b.occupancyPct - a.occupancyPct || b.revenue - a.revenue);

  if (floorFrequencies.length > 0 && floorFrequencies[0].nightsSold > 0) {
    floorFrequencies[0].isMostFrequent = true;
  }
  const mostFrequentFloor = floorFrequencies[0]?.nightsSold > 0 ? floorFrequencies[0] : null;

  // Client Typology, Age Brackets, Guest Needs
  const segmentBuckets = new Map<
    ClientSegmentId,
    {
      count: number;
      prevCount: number;
      nightsSold: number;
      revenue: number;
      needCounts: Map<string, { label: string; count: number }>;
    }
  >();
  const ensureSeg = (id: ClientSegmentId) => {
    let entry = segmentBuckets.get(id);
    if (!entry) {
      entry = { count: 0, prevCount: 0, nightsSold: 0, revenue: 0, needCounts: new Map() };
      segmentBuckets.set(id, entry);
    }
    return entry;
  };

  for (const b of prev.activeBookings) {
    ensureSeg(resolveClientSegment(b)).prevCount += 1;
  }

  const ageMap = new Map<
    AgeBracketStat['id'],
    { peopleCount: number; bookingsCount: number; needs: Map<string, number> }
  >();
  const ensureAge = (id: AgeBracketStat['id']) => {
    let entry = ageMap.get(id);
    if (!entry) {
      entry = { peopleCount: 0, bookingsCount: 0, needs: new Map() };
      ageMap.set(id, entry);
    }
    return entry;
  };

  const needMap = new Map<
    string,
    {
      id: string;
      label: { fr: string; en: string; ar: string };
      category: GuestNeedStat['category'];
      count: number;
      prevCount: number;
      segCounts: Map<ClientSegmentId, number>;
    }
  >();

  for (const b of prev.activeBookings) {
    for (const need of extractBookingNeeds(b)) {
      const entry = needMap.get(need.id) ?? {
        id: need.id,
        label: need.label,
        category: need.category,
        count: 0,
        prevCount: 0,
        segCounts: new Map(),
      };
      entry.prevCount += 1;
      needMap.set(need.id, entry);
    }
  }

  let totalGuestsCount = 0;
  let totalChildrenCount = 0;
  let declaredAgePeopleCount = 0;

  const natCounts = new Map<string, number>();
  const channelMap = new Map<string, { count: number; revenue: number }>();

  for (const b of cur.activeBookings) {
    const segId = resolveClientSegment(b);
    const seg = ensureSeg(segId);
    const overlap = analyticsOverlapNights(b.startDate, b.endDate, from, toExclusive);
    const totalN = Math.max(1, analyticsDayDiff(b.startDate, b.endDate));
    const proratedRev = (b.totalPrice * overlap) / totalN;

    seg.count += 1;
    seg.nightsSold += overlap;
    seg.revenue += proratedRev;

    const adults = resolveBookingAdultCount(b);
    const children = resolveBookingChildCount(b);
    totalGuestsCount += adults + children;
    totalChildrenCount += children;

    const needs = extractBookingNeeds(b);
    for (const need of needs) {
      const localizedNeedLabel = need.label[language] || need.label.fr;
      const segNeed = seg.needCounts.get(need.id) ?? { label: localizedNeedLabel, count: 0 };
      segNeed.count += 1;
      seg.needCounts.set(need.id, segNeed);

      const nEntry = needMap.get(need.id) ?? {
        id: need.id,
        label: need.label,
        category: need.category,
        count: 0,
        prevCount: 0,
        segCounts: new Map(),
      };
      nEntry.count += 1;
      nEntry.segCounts.set(segId, (nEntry.segCounts.get(segId) || 0) + 1);
      needMap.set(need.id, nEntry);
    }

    if (children > 0) {
      const childAge = ensureAge('0-17');
      childAge.peopleCount += children;
      childAge.bookingsCount += 1;
      declaredAgePeopleCount += children;
      for (const need of needs) {
        const lbl = need.label[language] || need.label.fr;
        childAge.needs.set(lbl, (childAge.needs.get(lbl) || 0) + 1);
      }
    }

    const declaredAdultBracket = b.customMetadata?.guestAgeBracket as AgeBracketStat['id'] | undefined;
    const adultBucketId: AgeBracketStat['id'] =
      declaredAdultBracket &&
      ['18-25', '26-35', '36-50', '51-65', '65+'].includes(declaredAdultBracket)
        ? declaredAdultBracket
        : 'unspecified';

    const adultAge = ensureAge(adultBucketId);
    adultAge.peopleCount += adults;
    adultAge.bookingsCount += 1;
    if (adultBucketId !== 'unspecified') {
      declaredAgePeopleCount += adults;
    }
    for (const need of needs) {
      const lbl = need.label[language] || need.label.fr;
      adultAge.needs.set(lbl, (adultAge.needs.get(lbl) || 0) + 1);
    }

    const natLabel =
      b.nationality?.trim() ||
      (b.guestType === 'algerian'
        ? language === 'en'
          ? 'Algerian'
          : language === 'ar'
          ? 'جزائرية'
          : 'Algérienne'
        : language === 'en'
        ? 'Foreign'
        : language === 'ar'
        ? 'أجنبية'
        : 'Étrangère');
    natCounts.set(natLabel, (natCounts.get(natLabel) || 0) + 1);

    const chLabel = b.originChannel || 'Direct';
    const chEntry = channelMap.get(chLabel) ?? { count: 0, revenue: 0 };
    chEntry.count += 1;
    chEntry.revenue += proratedRev;
    channelMap.set(chLabel, chEntry);
  }

  const totalActiveCount = Math.max(1, cur.activeBookings.length);

  const clientSegments: ClientSegmentStat[] = [...segmentBuckets.entries()]
    .filter(([, v]) => v.count > 0 || v.prevCount > 0)
    .map(([id, v]) => ({
      id,
      label: SEGMENT_LABELS[id],
      count: v.count,
      prevCount: v.prevCount,
      sharePct: cur.activeBookings.length > 0 ? Math.round((v.count / totalActiveCount) * 100) : 0,
      nightsSold: v.nightsSold,
      revenue: Math.round(v.revenue),
      avgSpend: v.count > 0 ? Math.round(v.revenue / v.count) : 0,
      avgStayNights: v.count > 0 ? Math.round((v.nightsSold / v.count) * 10) / 10 : 0,
      topNeeds: [...v.needCounts.entries()]
        .map(([needId, item]) => ({ id: needId, label: item.label, count: item.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  const ageOrder: AgeBracketStat['id'][] = ['0-17', '18-25', '26-35', '36-50', '51-65', '65+', 'unspecified'];
  const ageBrackets: AgeBracketStat[] = ageOrder
    .map((id) => {
      const entry = ageMap.get(id);
      if (!entry || entry.peopleCount === 0) return null;
      return {
        id,
        label: AGE_BRACKET_LABELS[id],
        peopleCount: entry.peopleCount,
        bookingsCount: entry.bookingsCount,
        sharePct: totalGuestsCount > 0 ? Math.round((entry.peopleCount / totalGuestsCount) * 100) : 0,
        isEstimatedOrMissing: id === 'unspecified',
        topNeeds: [...entry.needs.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([lbl]) => lbl),
      };
    })
    .filter((x): x is AgeBracketStat => x !== null);

  const declaredAgeSharePct =
    totalGuestsCount > 0 ? Math.round((declaredAgePeopleCount / totalGuestsCount) * 100) : 0;

  const guestNeeds: GuestNeedStat[] = [...needMap.values()]
    .filter((n) => n.count > 0 || n.prevCount > 0)
    .map((n) => ({
      id: n.id,
      label: n.label,
      category: n.category,
      count: n.count,
      prevCount: n.prevCount,
      sharePct: cur.activeBookings.length > 0 ? Math.round((n.count / totalActiveCount) * 100) : 0,
      topSegments: [...n.segCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([segId]) => segId),
    }))
    .sort((a, b) => b.count - a.count || b.prevCount - a.prevCount);

  const nationalityBreakdown = [...natCounts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      sharePct: cur.activeBookings.length > 0 ? Math.round((count / totalActiveCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const channelBreakdown = [...channelMap.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      sharePct: cur.activeBookings.length > 0 ? Math.round((v.count / totalActiveCount) * 100) : 0,
      revenue: Math.round(v.revenue),
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  // Meal plans, Extras & Dietary Additives
  const resolveMealCode = (b: TimelineBooking): string => {
    const raw = (b.mealPlan || b.customMetadata?.hotelMealPlan || '').toLowerCase();
    if (raw === 'breakfast') return 'bb';
    if (raw === 'half_board') return 'hb';
    if (raw === 'full_board') return 'fb';
    if (raw === 'room_only') return 'ro';
    if (raw === 'bf') return 'bb';
    return raw || 'unspecified';
  };

  const mealCounts = new Map<string, { count: number; prevCount: number }>();
  for (const b of prev.activeBookings) {
    const code = resolveMealCode(b);
    const e = mealCounts.get(code) ?? { count: 0, prevCount: 0 };
    e.prevCount += 1;
    mealCounts.set(code, e);
  }
  for (const b of cur.activeBookings) {
    const code = resolveMealCode(b);
    const e = mealCounts.get(code) ?? { count: 0, prevCount: 0 };
    e.count += 1;
    mealCounts.set(code, e);
  }

  const mealPlanStats: MealPlanStat[] = [...mealCounts.entries()]
    .filter(([, v]) => v.count > 0)
    .map(([id, v]) => {
      const plan = HOSPITALITY_MEAL_PLANS.find((p) => p.id === id);
      return {
        id,
        code: plan?.shortBadge || (id === 'unspecified' ? '—' : id.toUpperCase()),
        label:
          plan?.name[language] ||
          plan?.name.fr ||
          (id === 'unspecified'
            ? language === 'fr'
              ? 'Non précisée'
              : language === 'ar'
              ? 'غير محددة'
              : 'Not specified'
            : id.toUpperCase()),
        count: v.count,
        prevCount: v.prevCount,
        sharePct: cur.activeBookings.length > 0 ? Math.round((v.count / totalActiveCount) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const paidExtrasMap = new Map<
    string,
    { label: string; kind: 'paid_extra' | 'stay_option'; count: number; prevCount: number; revenue: number }
  >();
  const dietMap = new Map<string, { label: string; count: number; prevCount: number }>();

  const collectExtrasAndDiets = (list: TimelineBooking[], isCurrent: boolean) => {
    let bookingsWithPaidExtras = 0;
    for (const b of list) {
      let hasPaid = false;
      const nights = Math.max(1, analyticsDayDiff(b.startDate, b.endDate));
      const pax = resolveBookingAdultCount(b);
      const meta = b.customMetadata || {};
      const seenForBooking = new Set<string>();

      if (Array.isArray(b.extras)) {
        for (const ex of b.extras) {
          const key = `extra::${normalizeToken(ex.label)}`;
          seenForBooking.add(key);
          hasPaid = true;
          const entry = paidExtrasMap.get(key) ?? {
            label: ex.label,
            kind: 'paid_extra' as const,
            count: 0,
            prevCount: 0,
            revenue: 0,
          };
          if (isCurrent) {
            entry.count += 1;
            entry.revenue += Number(ex.amount) || 0;
          } else {
            entry.prevCount += 1;
          }
          paidExtrasMap.set(key, entry);
        }
      }

      if (Array.isArray(meta.selectedExtras)) {
        for (const extraId of meta.selectedExtras) {
          const def = EXTRA_METADATA_DEFS.find((d) => d.id === extraId);
          if (!def) continue;
          const key = `extra::${normalizeToken(def.label)}`;
          if (seenForBooking.has(key)) continue;
          hasPaid = true;
          const estAmt =
            (def.pricePerNight ? def.pricePerNight * nights * (def.perPerson ? pax : 1) : 0) +
            (def.flatPrice ? def.flatPrice * (def.perPerson ? pax : 1) : 0);
          const entry = paidExtrasMap.get(key) ?? {
            label: def.label,
            kind: 'paid_extra' as const,
            count: 0,
            prevCount: 0,
            revenue: 0,
          };
          if (isCurrent) {
            entry.count += 1;
            entry.revenue += estAmt;
          } else {
            entry.prevCount += 1;
          }
          paidExtrasMap.set(key, entry);
        }
      }

      const optionChecks: Array<{ active: boolean; key: string; label: string; estAmt: number }> = [
        { active: Boolean(meta.hotelOptionBabyBed), key: 'opt_baby_bed', label: 'Lit bébé d’appoint', estAmt: 10 * nights },
        { active: Boolean(meta.hotelOptionPet), key: 'opt_pet', label: 'Animal de compagnie', estAmt: 15 * nights },
        { active: Boolean(meta.hotelOptionWelcomeGift), key: 'opt_welcome_gift', label: 'Cadeau / Bouteille de bienvenue', estAmt: 35 },
        { active: Boolean(meta.resortOptionPrivatePool), key: 'opt_private_pool', label: 'Piscine privée chauffée', estAmt: 40 * nights },
        { active: Boolean(meta.resortOptionBeachCabana), key: 'opt_cabana', label: 'Cabana plage privée', estAmt: 30 * nights },
        { active: Boolean(meta.resortOptionVipTransfer), key: 'opt_vip_transfer', label: 'Transfert VIP aéroport', estAmt: 85 },
        { active: Boolean(meta.resortOptionGolfBuggy), key: 'opt_buggy', label: 'Voiturette Resort', estAmt: 25 * nights },
      ];
      for (const opt of optionChecks) {
        if (!opt.active) continue;
        hasPaid = true;
        const entry = paidExtrasMap.get(opt.key) ?? {
          label: opt.label,
          kind: 'stay_option' as const,
          count: 0,
          prevCount: 0,
          revenue: 0,
        };
        if (isCurrent) {
          entry.count += 1;
          entry.revenue += opt.estAmt;
        } else {
          entry.prevCount += 1;
        }
        paidExtrasMap.set(opt.key, entry);
      }

      if (hasPaid && isCurrent) bookingsWithPaidExtras += 1;

      if (Array.isArray(b.mealPlanDietPreferences)) {
        for (const dietId of b.mealPlanDietPreferences) {
          const def = DIETARY_PREFERENCES.find((d) => d.id === dietId);
          const lbl = def?.label || dietId;
          const entry = dietMap.get(dietId) ?? { label: lbl, count: 0, prevCount: 0 };
          if (isCurrent) entry.count += 1;
          else entry.prevCount += 1;
          dietMap.set(dietId, entry);
        }
      }
    }
    return bookingsWithPaidExtras;
  };

  collectExtrasAndDiets(prev.activeBookings, false);
  const bookingsWithPaidExtras = collectExtrasAndDiets(cur.activeBookings, true);

  // Also capture extra line items from period invoices (room/spa/service supplements)
  for (const inv of invoiceDocs) {
    if (inv.domain !== domain || inv.issueDate < from || inv.issueDate >= toExclusive) continue;
    for (const item of inv.items || []) {
      const normDesc = normalizeToken(item.description);
      if (
        normDesc.includes('nuit') ||
        normDesc.includes('taxe de sejour') ||
        normDesc.includes('chambre') && normDesc.includes('sejour')
      ) {
        continue;
      }
      const key = `inv::${normDesc.slice(0, 32)}`;
      const entry = paidExtrasMap.get(key) ?? {
        label: item.description,
        kind: 'paid_extra' as const,
        count: 0,
        prevCount: 0,
        revenue: 0,
      };
      entry.count += 1;
      entry.revenue += Number(item.total) || 0;
      paidExtrasMap.set(key, entry);
    }
  }

  const paidExtrasStats: ExtraAdditiveStat[] = [...paidExtrasMap.entries()]
    .filter(([, v]) => v.count > 0)
    .map(([id, v]) => ({
      id,
      label: v.label,
      kind: v.kind,
      count: v.count,
      prevCount: v.prevCount,
      attachRatePct: cur.activeBookings.length > 0 ? Math.min(100, Math.round((v.count / totalActiveCount) * 100)) : 0,
      estimatedRevenue: Math.round(v.revenue),
    }))
    .sort((a, b) => b.count - a.count || b.estimatedRevenue - a.estimatedRevenue);

  const dietaryAdditivesStats: ExtraAdditiveStat[] = [...dietMap.entries()]
    .filter(([, v]) => v.count > 0)
    .map(([id, v]) => ({
      id,
      label: v.label,
      kind: 'diet_additive' as const,
      count: v.count,
      prevCount: v.prevCount,
      attachRatePct: cur.activeBookings.length > 0 ? Math.min(100, Math.round((v.count / totalActiveCount) * 100)) : 0,
      estimatedRevenue: 0,
    }))
    .sort((a, b) => b.count - a.count);

  const extrasAttachRatePct =
    cur.activeBookings.length > 0
      ? Math.min(100, Math.round((bookingsWithPaidExtras / cur.activeBookings.length) * 100))
      : 0;
  const totalEstimatedExtrasRevenue = paidExtrasStats.reduce((s, e) => s + e.estimatedRevenue, 0);

  // Failures, Prevention, Recurring Risk Rooms & Complaints
  const tradeBuckets = new Map<
    TechnicalTradeStat['id'],
    { count: number; prevCount: number; openCount: number; urgentCount: number; rooms: Set<string> }
  >();
  const ensureTrade = (id: TechnicalTradeStat['id']) => {
    let e = tradeBuckets.get(id);
    if (!e) {
      e = { count: 0, prevCount: 0, openCount: 0, urgentCount: 0, rooms: new Set() };
      tradeBuckets.set(id, e);
    }
    return e;
  };

  for (const t of tasks) {
    if (t.category !== 'Maintenance') continue;
    const tradeId = classifyTechnicalTrade(`${t.typeName} ${t.note || ''} ${(t.tools || []).join(' ')}`);
    const bucket = ensureTrade(tradeId);
    if (t.date >= from && t.date < toExclusive) {
      bucket.count += 1;
      if (t.status === 'pending' || t.status === 'doing') bucket.openCount += 1;
      if (t.priority === 'urgent') bucket.urgentCount += 1;
      if (t.room) bucket.rooms.add(t.room);
    } else if (t.date >= prevFrom && t.date < prevToExclusive) {
      bucket.prevCount += 1;
    }
  }

  const failuresByTrade: TechnicalTradeStat[] = (
    ['hvac', 'plumbing', 'electrical', 'carpentry', 'general'] as TechnicalTradeStat['id'][]
  )
    .map((id) => {
      const b = tradeBuckets.get(id);
      return {
        id,
        label: TRADE_LABELS[id],
        count: b?.count ?? 0,
        prevCount: b?.prevCount ?? 0,
        openCount: b?.openCount ?? 0,
        urgentCount: b?.urgentCount ?? 0,
        sampleRooms: b ? [...b.rooms].slice(0, 4) : [],
      };
    })
    .filter((item) => item.count > 0 || item.prevCount > 0)
    .sort((a, b) => b.count - a.count || b.urgentCount - a.urgentCount);

  // Risk score per room
  const riskByRoom = new Map<string, RecurringRiskRoomStat>();
  const ensureRiskRoom = (room: RoomWithGroup | undefined, fallbackLabel: string) => {
    const key = room?.id || `raw::${fallbackLabel}`;
    let entry = riskByRoom.get(key);
    if (!entry) {
      entry = {
        roomKey: key,
        roomLabel: room ? `${room.name} (${room.type})` : fallbackLabel,
        building: room?.building?.trim() || room?.groupName || '—',
        housekeepingStatus: room?.housekeepingStatus,
        maintenanceCount: 0,
        urgentCount: 0,
        alertsCount: 0,
        lockErrorsCount: 0,
        riskScore: 0,
        riskLevel: 'medium',
        reasons: [],
      };
      riskByRoom.set(key, entry);
    }
    return entry;
  };

  for (const r of rooms) {
    if (r.housekeepingStatus === 'out_of_order') {
      const entry = ensureRiskRoom(r, r.name);
      entry.riskScore += 5;
      entry.reasons.push(language === 'fr' ? 'Hors service (OOO)' : language === 'ar' ? 'خارج الخدمة' : 'Out of order');
    }
  }

  for (const t of tasks) {
    if (t.category !== 'Maintenance') continue;
    if (t.date < prevFrom || t.date >= toExclusive) continue;
    const matched = matchTaskToRoom(t.room, rooms);
    const entry = ensureRiskRoom(matched, t.room);
    entry.maintenanceCount += 1;
    if (t.priority === 'urgent') {
      entry.urgentCount += 1;
      entry.riskScore += 3;
    } else {
      entry.riskScore += 2;
    }
    if (!entry.reasons.includes(t.typeName)) {
      entry.reasons.push(t.typeName);
    }
  }

  for (const b of cur.activeBookings) {
    if (!b.guestAlerts || b.guestAlerts.length === 0) continue;
    const matched = rooms.find((r) => r.id === b.resourceId);
    const entry = ensureRiskRoom(matched, b.resourceName);
    entry.alertsCount += b.guestAlerts.length;
    entry.riskScore += b.guestAlerts.length * 2;
    for (const a of b.guestAlerts) {
      if (entry.reasons.length < 3) entry.reasons.push(a.text);
    }
  }

  for (const ev of eventLogs) {
    const d = ev.timestamp.slice(0, 10);
    if (d < from || d >= toExclusive) continue;
    if (ev.severity !== 'warn' && ev.severity !== 'error') continue;
    if (ev.category !== 'locks' && ev.category !== 'housekeeping' && ev.category !== 'task') continue;
    const matched = ev.resourceId
      ? rooms.find((r) => r.id === ev.resourceId)
      : matchTaskToRoom(ev.target?.label || ev.target?.secondaryLabel || '', rooms);
    if (!matched && !ev.target?.label) continue;
    const entry = ensureRiskRoom(matched, ev.target?.label || 'Équipement');
    entry.lockErrorsCount += 1;
    entry.riskScore += 2;
    if (entry.reasons.length < 3) entry.reasons.push(ev.title);
  }

  const recurringRiskRooms = [...riskByRoom.values()]
    .filter((r) => r.riskScore >= 3 || r.housekeepingStatus === 'out_of_order' || r.maintenanceCount >= 2)
    .map((r) => ({
      ...r,
      riskLevel: (r.riskScore >= 5 || r.housekeepingStatus === 'out_of_order' || r.urgentCount >= 1 ? 'high' : 'medium') as 'high' | 'medium',
      reasons: r.reasons.slice(0, 3),
    }))
    .sort((a, b) => b.riskScore - a.riskScore || b.maintenanceCount - a.maintenanceCount);

  // Complaints, guest alerts, forgotten items & incident logs
  const complaintsAndAlerts: ComplaintAlertRecord[] = [];
  let forgottenStoredCount = 0;

  for (const b of cur.periodBookings) {
    for (const alert of b.guestAlerts || []) {
      const isHigh = COMPLAINT_REGEX.test(normalizeToken(alert.text));
      complaintsAndAlerts.push({
        id: `alert-${alert.id}`,
        date: alert.createdAt.slice(0, 10) || b.startDate,
        roomName: b.resourceName,
        guestName: b.guestName,
        source: 'guest_alert',
        severity: isHigh ? 'high' : 'medium',
        text: alert.text,
      });
    }
    if (b.notes && COMPLAINT_REGEX.test(normalizeToken(b.notes))) {
      complaintsAndAlerts.push({
        id: `note-${b.id}`,
        date: b.startDate,
        roomName: b.resourceName,
        guestName: b.guestName,
        source: 'booking_note',
        severity: 'medium',
        text: b.notes,
      });
    }
    for (const item of b.forgottenItems || []) {
      if (item.status === 'stored') {
        forgottenStoredCount += 1;
        complaintsAndAlerts.push({
          id: `forgot-${item.id}`,
          date: item.foundAt.slice(0, 10) || b.endDate,
          roomName: b.resourceName,
          guestName: b.guestName,
          source: 'forgotten_item',
          severity: 'info',
          text: `${language === 'fr' ? 'Objet oublié en consigne' : language === 'ar' ? 'مفقودات محفوظة' : 'Stored lost item'}: ${item.description}`,
        });
      }
    }
  }

  for (const t of tasks) {
    if (t.date < from || t.date >= toExclusive) continue;
    if (t.category === 'Maintenance' && t.priority === 'urgent') {
      complaintsAndAlerts.push({
        id: `task-${t.id}`,
        date: t.date,
        roomName: t.room,
        guestName: t.assignee || 'Maintenance',
        source: 'maintenance_urgent',
        severity: 'high',
        text: `${t.typeName}${t.note ? ` — ${t.note}` : ''}`,
      });
    }
  }

  for (const ev of eventLogs) {
    const d = ev.timestamp.slice(0, 10);
    if (d < from || d >= toExclusive) continue;
    if (ev.severity === 'error' || (ev.severity === 'warn' && ev.category === 'locks')) {
      complaintsAndAlerts.push({
        id: `ev-${ev.id}`,
        date: d,
        roomName: ev.target?.label || 'Système',
        guestName: ev.actor?.label || 'Audit',
        source: 'lock_error',
        severity: ev.severity === 'error' ? 'high' : 'medium',
        text: `${ev.title} — ${ev.description}`,
      });
    }
  }

  complaintsAndAlerts.sort((a, b) => b.date.localeCompare(a.date));

  // Stock burn rate & runway prevention
  const consumedByItem = new Map<string, number>();
  for (const mov of stockMovements) {
    if (mov.delta >= 0) continue;
    const d = mov.timestamp.slice(0, 10);
    if (d >= from && d < toExclusive) {
      consumedByItem.set(mov.itemId, (consumedByItem.get(mov.itemId) || 0) + Math.abs(mov.delta));
    }
  }

  const stockRunway: StockRunwayStat[] = stockItems
    .map((item) => {
      const consumedInPeriod = consumedByItem.get(item.id) || 0;
      const avgDailyBurn = Math.round((consumedInPeriod / Math.max(1, periodDays)) * 100) / 100;
      const daysRemaining = avgDailyBurn > 0 ? Math.round(item.quantity / avgDailyBurn) : null;
      const isLow = item.quantity <= item.minThreshold;
      const riskLevel: StockRunwayStat['riskLevel'] =
        isLow || (daysRemaining !== null && daysRemaining <= 5)
          ? 'critical'
          : daysRemaining !== null && daysRemaining <= 14
          ? 'warning'
          : 'healthy';
      return {
        itemId: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        minThreshold: item.minThreshold,
        unit: item.unit,
        consumedInPeriod,
        avgDailyBurn,
        daysRemaining,
        riskLevel,
      };
    })
    .filter((s) => s.riskLevel !== 'healthy' || s.consumedInPeriod > 0)
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, healthy: 2 };
      if (rank[a.riskLevel] !== rank[b.riskLevel]) return rank[a.riskLevel] - rank[b.riskLevel];
      return (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
    });

  // Actionable Manager Recommendations
  const recommendations: ManagerRecommendation[] = [];
  const f7 = forecasts[0];
  const f30 = forecasts[2];

  if (f7 && f7.projectedOccupancyPct >= 75) {
    recommendations.push({
      id: 'rec-yield-high',
      category: 'yield',
      priority: 'high',
      title: {
        fr: 'Activer une hausse tarifaire dynamique sur J+7',
        en: 'Activate dynamic rate uplift for next 7 days',
        ar: 'تفعيل رفع الأسعار الديناميكي للأيام الـ 7 القادمة',
      },
      rationale: {
        fr: `L’occupation projetée atteint ${f7.projectedOccupancyPct}% sur 7 jours (${f7.confirmedOccupancyPct}% déjà confirmée).`,
        en: `Projected occupancy reaches ${f7.projectedOccupancyPct}% over 7 days (${f7.confirmedOccupancyPct}% already confirmed).`,
        ar: `يصل الإشغال المتوقع إلى ${f7.projectedOccupancyPct}% خلال 7 أيام (${f7.confirmedOccupancyPct}% مؤكد بالفعل).`,
      },
      action: {
        fr: 'Rehausser les tarifs BAR de +10% à +15% sur les chambres restantes et privilégier les séjours de 2+ nuits.',
        en: 'Increase BAR rates by +10% to +15% on remaining inventory and favor 2+ night stays.',
        ar: 'رفع الأسعار الأساسية بنسبة 10% إلى 15% للغرف المتبقية وتفضيل الإقامات الطويلة.',
      },
      metricBadge: `${f7.projectedOccupancyPct}% J+7`,
    });
  } else if (f30 && f30.projectedOccupancyPct < 45 && underutilizedRooms.length > 0) {
    recommendations.push({
      id: 'rec-yield-low',
      category: 'yield',
      priority: 'medium',
      title: {
        fr: 'Relancer les chambres sous-utilisées via offres ciblées',
        en: 'Boost underutilized rooms with targeted packages',
        ar: 'تنشيط الغرف الأقل إشغالاً بعروض مخصصة',
      },
      rationale: {
        fr: `${underutilizedRooms.length} chambre(s) affichent un taux d’utilisation faible et l’occupation J+30 projetée est de ${f30.projectedOccupancyPct}%.`,
        en: `${underutilizedRooms.length} room(s) show low utilization and projected 30-day occupancy is ${f30.projectedOccupancyPct}%.`,
        ar: `${underutilizedRooms.length} غرف تسجل إشغالاً منخفضاً والتوقع لـ 30 يوماً هو ${f30.projectedOccupancyPct}%.`,
      },
      action: {
        fr: `Créer un pack week-end / demi-pension incluant ${underutilizedRooms.slice(0, 2).map((r) => r.roomName).join(', ')}.`,
        en: `Launch a weekend or half-board bundle for ${underutilizedRooms.slice(0, 2).map((r) => r.roomName).join(', ')}.`,
        ar: `إطلاق باقة نهاية أسبوع أو نصف إقامة تشمل ${underutilizedRooms.slice(0, 2).map((r) => r.roomName).join('، ')}.`,
      },
      metricBadge: `${underutilizedRooms[0]?.utilizationPct ?? 0}% min`,
    });
  }

  if (recurringRiskRooms.length > 0) {
    const topRisk = recurringRiskRooms[0];
    recommendations.push({
      id: 'rec-prevention-rooms',
      category: 'prevention',
      priority: topRisk.riskLevel === 'high' ? 'high' : 'medium',
      title: {
        fr: `Inspection technique préventive : ${topRisk.roomLabel}`,
        en: `Preventive technical inspection: ${topRisk.roomLabel}`,
        ar: `فحص تقني وقائي: ${topRisk.roomLabel}`,
      },
      rationale: {
        fr: `${recurringRiskRooms.length} chambre(s) présentent des signaux récurrents (${topRisk.reasons.join(' · ')}).`,
        en: `${recurringRiskRooms.length} room(s) show recurring risk signals (${topRisk.reasons.join(' · ')}).`,
        ar: `${recurringRiskRooms.length} غرف تظهر إشارات عطل متكررة (${topRisk.reasons.join(' · ')}).`,
      },
      action: {
        fr: 'Planifier une intervention CVC/plomberie/serrure avant le prochain check-in pour éviter un blocage Hors Service.',
        en: 'Schedule preventive HVAC/plumbing/lock check before the next check-in to prevent OOO downtime.',
        ar: 'جدولة تدخل تقني وقائي قبل تسجيل الوصول القادم لتفادي خروج الغرفة عن الخدمة.',
      },
      metricBadge: `${recurringRiskRooms.length} à surveiller`,
    });
  }

  const urgentComplaints = complaintsAndAlerts.filter((c) => c.severity === 'high');
  if (complaintsAndAlerts.length > 0) {
    recommendations.push({
      id: 'rec-quality-alerts',
      category: 'quality',
      priority: urgentComplaints.length > 0 ? 'high' : 'medium',
      title: {
        fr: 'Traiter les doléances, alertes clients & objets consignés',
        en: 'Resolve guest complaints, alerts & stored items',
        ar: 'معالجة شكاوى النزلاء والتنبيهات والمفقودات',
      },
      rationale: {
        fr: `${complaintsAndAlerts.length} signalement(s) relevés dont ${urgentComplaints.length} critique(s) et ${forgottenStoredCount} objet(s) oublié(s) en attente.`,
        en: `${complaintsAndAlerts.length} record(s) flagged including ${urgentComplaints.length} high-priority and ${forgottenStoredCount} stored lost item(s).`,
        ar: `تم رصد ${complaintsAndAlerts.length} تنبيهاً منها ${urgentComplaints.length} عاجلة و${forgottenStoredCount} مفقودات محفوظة.`,
      },
      action: {
        fr: 'Contacter les clients concernés avant départ et clôturer chaque incident avec la Gouvernante / Réception.',
        en: 'Follow up with affected guests prior to checkout and close each incident with Housekeeping / Front Desk.',
        ar: 'التواصل مع النزلاء المعنيين وإغلاق كل ملاحظة بالتنسيق مع الاستقبال والتدبير المنزلي.',
      },
      metricBadge: `${complaintsAndAlerts.length} alertes`,
    });
  }

  const criticalStock = stockRunway.filter((s) => s.riskLevel === 'critical');
  const warningStock = stockRunway.filter((s) => s.riskLevel === 'warning');
  if (criticalStock.length > 0 || warningStock.length > 0) {
    const sample = [...criticalStock, ...warningStock].slice(0, 2);
    recommendations.push({
      id: 'rec-stock-runway',
      category: 'stock',
      priority: criticalStock.length > 0 ? 'high' : 'medium',
      title: {
        fr: 'Anticiper le réapprovisionnement consommables & linge',
        en: 'Prevent consumables & linen stockouts',
        ar: 'استباق نفاذ مخزون المستهلكات والبياضات',
      },
      rationale: {
        fr: `${criticalStock.length} article(s) critiques et ${warningStock.length} sous 14 jours d’autonomie (${sample.map((s) => s.name).join(', ')}).`,
        en: `${criticalStock.length} critical item(s) and ${warningStock.length} under 14 days runway (${sample.map((s) => s.name).join(', ')}).`,
        ar: `${criticalStock.length} أصناف حرجة و${warningStock.length} بأقل من 14 يوماً (${sample.map((s) => s.name).join('، ')}).`,
      },
      action: {
        fr: 'Émettre un bon de commande basé sur la consommation journalière et les arrivées prévues à J+14.',
        en: 'Issue a replenishment order aligned with daily burn rate and 14-day expected arrivals.',
        ar: 'إصدار طلب تموين بناءً على معدل الاستهلاك اليومي والوصول المتوقع لـ 14 يوماً.',
      },
      metricBadge: `${criticalStock.length} critiques`,
    });
  }

  if (cur.activeBookings.length > 0 && extrasAttachRatePct < 35) {
    recommendations.push({
      id: 'rec-upsell-extras',
      category: 'upsell',
      priority: 'low',
      title: {
        fr: 'Développer le taux de prise des extras & additifs',
        en: 'Grow paid extras & dining add-on attach rate',
        ar: 'رفع نسبة مبيعات الإضافات والخدمات المكملة',
      },
      rationale: {
        fr: `Seules ${extrasAttachRatePct}% des réservations actives incluent un extra ou une option payante.`,
        en: `Only ${extrasAttachRatePct}% of active stays currently include a paid extra or add-on.`,
        ar: `${extrasAttachRatePct}% فقط من الحجوزات النشطة تتضمن خدمات إضافية مدفوعة.`,
      },
      action: {
        fr: 'Proposer Grab & Go aux profils Affaires et Dîner Romantique / Chef Privé aux Couples et Familles dès la confirmation.',
        en: 'Cross-sell Grab & Go to Business guests and Romantic / Private Chef add-ons to Couples and Families at check-in.',
        ar: 'اقتراح وجبات سريعة لضيوف الأعمال وعروض عشاء خاص للعائلات والأزواج عند التأكيد.',
      },
      metricBadge: `${extrasAttachRatePct}% prise`,
    });
  }

  // Operational Tasks & Staff Productivity ("Qui a fait quoi et combien")
  const TASK_CATEGORY_ORDER: PmsTask['category'][] = [
    'Ménage',
    'Linge',
    'Minibar & accueil',
    'Livraison',
    'Maintenance',
  ];
  const TASK_CATEGORY_LABELS: Record<PmsTask['category'], { fr: string; en: string; ar: string }> = {
    'Ménage': { fr: 'Ménage & Rotations', en: 'Housekeeping & Turnover', ar: 'التنظيف والتجهيز' },
    'Linge': { fr: 'Linge & Literie', en: 'Linen & Bedding', ar: 'البياضات والمفروشات' },
    'Minibar & accueil': { fr: 'Minibar & Accueil', en: 'Minibar & Welcome', ar: 'الميني بار والترحيب' },
    'Livraison': { fr: 'Livraisons Client', en: 'Guest Deliveries', ar: 'توصيل الطلبات' },
    'Maintenance': { fr: 'Maintenance & Technique', en: 'Maintenance & Repair', ar: 'الصيانة التقنية' },
  };

  const getEffectiveTaskDate = (task: PmsTask): string =>
    task.status === 'done' && task.completedAt && /^\d{4}-\d{2}-\d{2}/.test(task.completedAt)
      ? task.completedAt.slice(0, 10)
      : task.date;

  const unassignedLabel =
    language === 'fr' ? 'Non assigné' : language === 'ar' ? 'غير مسند' : 'Unassigned';

  const curPeriodTasks = tasks.filter((tk) => {
    const d = getEffectiveTaskDate(tk);
    return d >= from && d < toExclusive;
  });
  const prevPeriodTasks = tasks.filter((tk) => {
    const d = getEffectiveTaskDate(tk);
    return d >= prevFrom && d < prevToExclusive;
  });

  const nonCancelledCurTasks = curPeriodTasks.filter((tk) => tk.status !== 'cancel');
  const nonCancelledPrevTasks = prevPeriodTasks.filter((tk) => tk.status !== 'cancel');

  const completedTasksCount = nonCancelledCurTasks.filter((tk) => tk.status === 'done').length;
  const prevCompletedTasksCount = nonCancelledPrevTasks.filter((tk) => tk.status === 'done').length;
  const doingTasksCount = nonCancelledCurTasks.filter((tk) => tk.status === 'doing').length;
  const pendingTasksCount = nonCancelledCurTasks.filter((tk) => tk.status === 'pending').length;
  const cancelledTasksCount = curPeriodTasks.filter((tk) => tk.status === 'cancel').length;
  const urgentOpenTasksCount = nonCancelledCurTasks.filter(
    (tk) => tk.priority === 'urgent' && tk.status !== 'done'
  ).length;

  const completionRatePct =
    nonCancelledCurTasks.length > 0
      ? Math.round((completedTasksCount / nonCancelledCurTasks.length) * 100)
      : 0;
  const prevCompletionRatePct =
    nonCancelledPrevTasks.length > 0
      ? Math.round((prevCompletedTasksCount / nonCancelledPrevTasks.length) * 100)
      : 0;

  const catBuckets = new Map<
    PmsTask['category'],
    {
      total: number;
      prevTotal: number;
      done: number;
      doing: number;
      pending: number;
      cancelled: number;
      urgent: number;
    }
  >();
  for (const cat of TASK_CATEGORY_ORDER) {
    catBuckets.set(cat, { total: 0, prevTotal: 0, done: 0, doing: 0, pending: 0, cancelled: 0, urgent: 0 });
  }
  for (const tk of curPeriodTasks) {
    const b = catBuckets.get(tk.category) ?? {
      total: 0,
      prevTotal: 0,
      done: 0,
      doing: 0,
      pending: 0,
      cancelled: 0,
      urgent: 0,
    };
    if (tk.status === 'cancel') {
      b.cancelled += 1;
    } else {
      b.total += 1;
      if (tk.status === 'done') b.done += 1;
      else if (tk.status === 'doing') b.doing += 1;
      else b.pending += 1;
      if (tk.priority === 'urgent') b.urgent += 1;
    }
    catBuckets.set(tk.category, b);
  }
  for (const tk of nonCancelledPrevTasks) {
    const b = catBuckets.get(tk.category);
    if (b) b.prevTotal += 1;
  }

  const byCategory: TaskCategoryStat[] = TASK_CATEGORY_ORDER.map((cat) => {
    const b = catBuckets.get(cat)!;
    return {
      category: cat,
      label: TASK_CATEGORY_LABELS[cat],
      total: b.total,
      prevTotal: b.prevTotal,
      done: b.done,
      doing: b.doing,
      pending: b.pending,
      cancelled: b.cancelled,
      urgent: b.urgent,
      completionRatePct: b.total > 0 ? Math.round((b.done / b.total) * 100) : 0,
      sharePct:
        nonCancelledCurTasks.length > 0 ? Math.round((b.total / nonCancelledCurTasks.length) * 100) : 0,
    };
  }).filter((c) => c.total > 0 || c.prevTotal > 0 || c.cancelled > 0);

  // Staff workload & execution attribution
  const staffMap = new Map<
    string,
    {
      assignedTotal: number;
      completedCount: number;
      prevCompletedCount: number;
      doingCount: number;
      pendingCount: number;
      urgentHandled: number;
      rooms: Set<string>;
      consumedUnits: number;
      catMap: Map<PmsTask['category'], { count: number; done: number }>;
    }
  >();

  const ensureStaff = (name: string) => {
    let entry = staffMap.get(name);
    if (!entry) {
      entry = {
        assignedTotal: 0,
        completedCount: 0,
        prevCompletedCount: 0,
        doingCount: 0,
        pendingCount: 0,
        urgentHandled: 0,
        rooms: new Set(),
        consumedUnits: 0,
        catMap: new Map(),
      };
      staffMap.set(name, entry);
    }
    return entry;
  };

  for (const tk of nonCancelledCurTasks) {
    const executor =
      tk.status === 'done'
        ? tk.completedBy?.trim() || tk.assignee?.trim() || unassignedLabel
        : tk.assignee?.trim() || unassignedLabel;
    const st = ensureStaff(executor);
    st.assignedTotal += 1;
    if (tk.status === 'done') st.completedCount += 1;
    else if (tk.status === 'doing') st.doingCount += 1;
    else st.pendingCount += 1;
    if (tk.priority === 'urgent') st.urgentHandled += 1;
    if (tk.room?.trim()) st.rooms.add(tk.room.trim());
    const consumed = (tk.consumedItems || []).reduce((sum, ci) => sum + (ci.quantity || 0), 0);
    st.consumedUnits += consumed;
    const catEntry = st.catMap.get(tk.category) ?? { count: 0, done: 0 };
    catEntry.count += 1;
    if (tk.status === 'done') catEntry.done += 1;
    st.catMap.set(tk.category, catEntry);
  }

  for (const tk of nonCancelledPrevTasks) {
    if (tk.status !== 'done') continue;
    const prevExecutor = tk.completedBy?.trim() || tk.assignee?.trim() || unassignedLabel;
    const st = ensureStaff(prevExecutor);
    st.prevCompletedCount += 1;
  }

  const activeStaffEntries = [...staffMap.entries()].filter(([, v]) => v.assignedTotal > 0);
  const activeStaffCount = activeStaffEntries.length;
  const avgTasksPerStaff =
    activeStaffCount > 0
      ? Math.round((nonCancelledCurTasks.length / activeStaffCount) * 10) / 10
      : 0;
  const assignedCounts = activeStaffEntries.map(([, v]) => v.assignedTotal);
  const minAssigned = assignedCounts.length > 0 ? Math.min(...assignedCounts) : 0;
  const maxAssigned = assignedCounts.length > 0 ? Math.max(...assignedCounts) : 0;

  const staffWorkload: StaffWorkloadStat[] = [...staffMap.entries()]
    .filter(([, v]) => v.assignedTotal > 0 || v.prevCompletedCount > 0)
    .map(([staffName, v]) => {
      const workloadSharePct =
        nonCancelledCurTasks.length > 0
          ? Math.round((v.assignedTotal / nonCancelledCurTasks.length) * 100)
          : 0;

      let balanceStatus: StaffWorkloadStat['balanceStatus'] = 'balanced';
      if (activeStaffCount >= 2 && nonCancelledCurTasks.length >= 3 && maxAssigned - minAssigned >= 2) {
        const overloadedLimit = Math.max(avgTasksPerStaff * 1.35, avgTasksPerStaff + 1.5);
        const availableLimit = Math.max(0, avgTasksPerStaff * 0.65);
        if (v.assignedTotal >= overloadedLimit || (workloadSharePct >= 50 && v.assignedTotal - minAssigned >= 2)) {
          balanceStatus = 'overloaded';
        } else if (v.assignedTotal <= availableLimit) {
          balanceStatus = 'available';
        }
      }

      const categoryBreakdown = [...v.catMap.entries()]
        .map(([category, stats]) => ({ category, count: stats.count, done: stats.done }))
        .sort((a, b) => b.count - a.count);

      return {
        staffName,
        assignedTotal: v.assignedTotal,
        completedCount: v.completedCount,
        prevCompletedCount: v.prevCompletedCount,
        doingCount: v.doingCount,
        pendingCount: v.pendingCount,
        urgentHandled: v.urgentHandled,
        completionRatePct:
          v.assignedTotal > 0 ? Math.round((v.completedCount / v.assignedTotal) * 100) : 0,
        workloadSharePct,
        roomsCount: v.rooms.size,
        roomsList: [...v.rooms],
        consumedUnits: v.consumedUnits,
        categoryBreakdown,
        balanceStatus,
      };
    })
    .sort(
      (a, b) =>
        b.completedCount - a.completedCount ||
        b.assignedTotal - a.assignedTotal ||
        a.staffName.localeCompare(b.staffName)
    );

  const imbalanceDetected =
    staffWorkload.some((s) => s.balanceStatus === 'overloaded') &&
    staffWorkload.some((s) => s.balanceStatus === 'available');

  const recentExecutions: TaskExecutionLogItem[] = nonCancelledCurTasks
    .map((tk) => ({
      id: tk.id,
      room: tk.room,
      typeName: tk.typeName,
      category: tk.category,
      status: tk.status,
      priority: tk.priority,
      assignee: tk.assignee?.trim() || unassignedLabel,
      executor:
        tk.status === 'done'
          ? tk.completedBy?.trim() || tk.assignee?.trim() || unassignedLabel
          : tk.assignee?.trim() || unassignedLabel,
      date: tk.date,
      completedAt: tk.completedAt,
    }))
    .sort((a, b) => (b.completedAt || b.date).localeCompare(a.completedAt || a.date))
    .slice(0, 20);

  const tasksAnalytics: TasksAnalyticsSummary = {
    totalTasks: nonCancelledCurTasks.length,
    prevTotalTasks: nonCancelledPrevTasks.length,
    completedTasks: completedTasksCount,
    prevCompletedTasks: prevCompletedTasksCount,
    doingTasks: doingTasksCount,
    pendingTasks: pendingTasksCount,
    cancelledTasks: cancelledTasksCount,
    urgentOpenTasks: urgentOpenTasksCount,
    completionRatePct,
    prevCompletionRatePct,
    avgTasksPerStaff,
    imbalanceDetected,
    byCategory,
    staffWorkload,
    recentExecutions,
  };

  if (imbalanceDetected) {
    const overloaded = staffWorkload.find((s) => s.balanceStatus === 'overloaded');
    const available = [...staffWorkload].reverse().find((s) => s.balanceStatus === 'available');
    if (overloaded && available) {
      recommendations.push({
        id: 'rec-ops-rebalance',
        category: 'operations',
        priority: 'medium',
        title: {
          fr: 'Rééquilibrer la charge de travail des équipes',
          en: 'Rebalance housekeeping & operational workload',
          ar: 'إعادة توزيع أعباء العمل بين الفريق',
        },
        rationale: {
          fr: `${overloaded.staffName} concentre ${overloaded.assignedTotal} tâches (${overloaded.workloadSharePct}%) contre ${available.assignedTotal} pour ${available.staffName}.`,
          en: `${overloaded.staffName} holds ${overloaded.assignedTotal} tasks (${overloaded.workloadSharePct}%) versus ${available.assignedTotal} for ${available.staffName}.`,
          ar: `يتحمل ${overloaded.staffName} عدد ${overloaded.assignedTotal} مهام (${overloaded.workloadSharePct}%) مقابل ${available.assignedTotal} لـ ${available.staffName}.`,
        },
        action: {
          fr: `Réaffecter ${Math.max(1, Math.floor((overloaded.assignedTotal - available.assignedTotal) / 2))} tâche(s) ouverte(s) de ${overloaded.staffName} vers ${available.staffName}.`,
          en: `Reassign ${Math.max(1, Math.floor((overloaded.assignedTotal - available.assignedTotal) / 2))} open task(s) from ${overloaded.staffName} to ${available.staffName}.`,
          ar: `إعادة إسناد ${Math.max(1, Math.floor((overloaded.assignedTotal - available.assignedTotal) / 2))} مهام مفتوحة من ${overloaded.staffName} إلى ${available.staffName}.`,
        },
        metricBadge: `${overloaded.workloadSharePct}% max`,
      });
    }
  }

  return {
    range,
    today,
    current: cur.summary,
    previous: prev.summary,
    deltas: {
      revenue: makeDelta(cur.summary.revenuePrimary, prev.summary.revenuePrimary),
      occupancyPct: makeDelta(cur.summary.occupancyPct, prev.summary.occupancyPct),
      nightsSold: makeDelta(cur.summary.occupiedRoomNights, prev.summary.occupiedRoomNights),
      adr: makeDelta(cur.summary.adr, prev.summary.adr),
      revPar: makeDelta(cur.summary.revPar, prev.summary.revPar),
      bookingsCount: makeDelta(cur.summary.bookingsCount, prev.summary.bookingsCount),
      cancelRatePct: makeDelta(cur.summary.cancelRatePct, prev.summary.cancelRatePct),
      maintenanceTasks: makeDelta(cur.summary.maintenanceTasksCount, prev.summary.maintenanceTasksCount),
      alertsCount: makeDelta(cur.summary.alertsCount, prev.summary.alertsCount),
      tasksTotal: makeDelta(tasksAnalytics.totalTasks, tasksAnalytics.prevTotalTasks),
      tasksCompletionRate: makeDelta(tasksAnalytics.completionRatePct, tasksAnalytics.prevCompletionRatePct),
    },
    trendPoints,
    forecasts,
    roomFrequencies,
    underutilizedRooms,
    floorFrequencies,
    mostFrequentFloor,
    clientSegments,
    ageBrackets,
    declaredAgeSharePct,
    totalGuestsCount,
    totalChildrenCount,
    guestNeeds,
    nationalityBreakdown,
    channelBreakdown,
    mealPlanStats,
    paidExtrasStats,
    dietaryAdditivesStats,
    extrasAttachRatePct,
    totalEstimatedExtrasRevenue,
    failuresByTrade,
    recurringRiskRooms,
    complaintsAndAlerts,
    forgottenStoredCount,
    stockRunway,
    tasksAnalytics,
    recommendations,
  };
}
