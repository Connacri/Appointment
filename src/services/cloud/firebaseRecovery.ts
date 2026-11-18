import type {
  BookingStatus,
  PmsTask,
  ResourceGroup,
  ResourceItem,
  SectorType,
  StockItem,
  TimelineBooking,
} from '../../types/booking';
import type { EstablishmentProfile } from '../../types/establishment';

export const FIREBASE_CONFIG_STORAGE_KEY = 'appointment_firebase_config';

export interface FirebaseCloudConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  databaseURL?: string;
  storageBucket?: string;
  appId?: string;
  rootPath?: string;
}

export interface FirebaseRecoveryPayload {
  groups: ResourceGroup[];
  bookings: TimelineBooking[];
  tasks: PmsTask[];
  stockItems: StockItem[];
  dynamicRates: Record<string, Record<string, number>>;
  establishmentProfile: Partial<EstablishmentProfile> | null;
  sources: Array<'firestore' | 'realtime_database'>;
  warnings: string[];
}

export interface FirebaseConnectionTestResult {
  firestore: {
    configured: boolean;
    ok: boolean;
    latencyMs?: number;
    status?: number;
    error?: string;
  };
  realtimeDatabase: {
    configured: boolean;
    ok: boolean;
    latencyMs?: number;
    status?: number;
    error?: string;
  };
}

function readEnv(key: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const val = env?.[key];
    return typeof val === 'string' ? val.trim() : '';
  } catch {
    return '';
  }
}

export function isFirebaseFirestoreConfigured(config: FirebaseCloudConfig): boolean {
  return Boolean(config.projectId && config.projectId.trim().length > 0);
}

export function isFirebaseRtdbConfigured(config: FirebaseCloudConfig): boolean {
  const url = config.databaseURL?.trim() || '';
  return /^https?:\/\/[a-z0-9.-]+/i.test(url);
}

export function isAnyFirebaseCloudConfigured(config: FirebaseCloudConfig): boolean {
  return isFirebaseFirestoreConfigured(config) || isFirebaseRtdbConfigured(config);
}

export function readFirebaseCloudConfig(): FirebaseCloudConfig {
  let stored: Partial<FirebaseCloudConfig> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          stored = {
            apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : undefined,
            authDomain: typeof parsed.authDomain === 'string' ? parsed.authDomain.trim() : undefined,
            projectId: typeof parsed.projectId === 'string' ? parsed.projectId.trim() : undefined,
            databaseURL: typeof parsed.databaseURL === 'string' ? parsed.databaseURL.trim() : undefined,
            storageBucket: typeof parsed.storageBucket === 'string' ? parsed.storageBucket.trim() : undefined,
            appId: typeof parsed.appId === 'string' ? parsed.appId.trim() : undefined,
            rootPath: typeof parsed.rootPath === 'string' ? parsed.rootPath.trim() : undefined,
          };
        }
      }
    } catch {
      // Ignore malformed stored config
    }
  }

  return {
    apiKey: stored.apiKey || readEnv('VITE_FIREBASE_API_KEY') || undefined,
    authDomain: stored.authDomain || readEnv('VITE_FIREBASE_AUTH_DOMAIN') || undefined,
    projectId: stored.projectId || readEnv('VITE_FIREBASE_PROJECT_ID') || undefined,
    databaseURL: stored.databaseURL || readEnv('VITE_FIREBASE_DATABASE_URL') || undefined,
    storageBucket: stored.storageBucket || readEnv('VITE_FIREBASE_STORAGE_BUCKET') || undefined,
    appId: stored.appId || readEnv('VITE_FIREBASE_APP_ID') || undefined,
    rootPath: stored.rootPath || readEnv('VITE_FIREBASE_ROOT_PATH') || undefined,
  };
}

export function saveFirebaseCloudConfig(config: FirebaseCloudConfig): void {
  if (typeof window === 'undefined') return;
  const sanitized: FirebaseCloudConfig = {
    apiKey: config.apiKey?.trim() || undefined,
    authDomain: config.authDomain?.trim() || undefined,
    projectId: config.projectId?.trim() || undefined,
    databaseURL: config.databaseURL?.trim().replace(/\/+$/, '') || undefined,
    storageBucket: config.storageBucket?.trim() || undefined,
    appId: config.appId?.trim() || undefined,
    rootPath: config.rootPath?.trim().replace(/^\/+|\/+$/g, '') || undefined,
  };

  if (!isAnyFirebaseCloudConfigured(sanitized) && !sanitized.apiKey) {
    window.localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  } else {
    window.localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
  }
  window.dispatchEvent(new CustomEvent('appointment-cloud-config-updated'));
}

export function clearFirebaseCloudConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('appointment-cloud-config-updated'));
}

/**
 * Parses either raw JSON or a copy-pasted JS `const firebaseConfig = { ... };`
 * snippet from the Firebase Console. Rejects private service-account credentials
 * so secrets are never pasted or stored in browser storage.
 */
export function parseFirebaseConfigInput(input: string): FirebaseCloudConfig {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Collez une configuration Firebase JSON ou JS valide.');
  }

  // Extract object literal if user pasted a JS declaration
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Format non reconnu : aucun objet { ... } détecté.');
  }
  const candidate = trimmed.slice(firstBrace, lastBrace + 1);

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Strip JS-only line/block comments only outside quoted strings, then normalize JS object literal keys/quotes
    const normalized = candidate
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(normalized) as Record<string, unknown>;
    } catch {
      throw new Error('JSON Firebase invalide. Vérifiez la syntaxe des accolades et guillemets.');
    }
  }

  if (
    !parsed ||
    parsed.type === 'service_account' ||
    typeof parsed.private_key === 'string' ||
    typeof parsed.private_key_id === 'string'
  ) {
    throw new Error(
      'Sécurité : ne collez jamais un fichier service_account ou private_key dans le navigateur. Utilisez uniquement la configuration Web publique (apiKey, projectId, databaseURL).',
    );
  }

  const next: FirebaseCloudConfig = {
    apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : undefined,
    authDomain: typeof parsed.authDomain === 'string' ? parsed.authDomain.trim() : undefined,
    projectId: typeof parsed.projectId === 'string' ? parsed.projectId.trim() : undefined,
    databaseURL: typeof parsed.databaseURL === 'string' ? parsed.databaseURL.trim().replace(/\/+$/, '') : undefined,
    storageBucket: typeof parsed.storageBucket === 'string' ? parsed.storageBucket.trim() : undefined,
    appId: typeof parsed.appId === 'string' ? parsed.appId.trim() : undefined,
    rootPath: typeof parsed.rootPath === 'string' ? parsed.rootPath.trim().replace(/^\/+|\/+$/g, '') : undefined,
  };

  if (!isAnyFirebaseCloudConfigured(next)) {
    throw new Error('La configuration doit contenir au moins projectId (Firestore) ou databaseURL (Realtime Database).');
  }

  return next;
}

export function decodeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;

  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('stringValue' in v) return String(v.stringValue);
  if ('bytesValue' in v) return String(v.bytesValue);
  if ('referenceValue' in v) return String(v.referenceValue);
  if ('geoPointValue' in v) return v.geoPointValue;

  if ('arrayValue' in v) {
    const arr = v.arrayValue as { values?: unknown[] } | undefined;
    return (arr?.values ?? []).map(decodeFirestoreValue);
  }

  if ('mapValue' in v) {
    const map = v.mapValue as { fields?: Record<string, unknown> } | undefined;
    const out: Record<string, unknown> = {};
    for (const [key, fieldVal] of Object.entries(map?.fields ?? {})) {
      out[key] = decodeFirestoreValue(fieldVal);
    }
    return out;
  }

  return undefined;
}

export function decodeFirestoreDocument(doc: {
  name?: string;
  fields?: Record<string, unknown>;
}): Record<string, unknown> | null {
  if (!doc || typeof doc !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(doc.fields ?? {})) {
    out[key] = decodeFirestoreValue(val);
  }
  if (!out.id && typeof doc.name === 'string') {
    const id = doc.name.split('/').pop();
    if (id) out.id = id;
  }
  return out;
}

export function normalizeCollectionEntries(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return [];
  const rows: Array<Record<string, unknown>> = [];

  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        if (rec.deletedAt || rec.deleted_at || rec._deleted) return;
        rows.push({ id: rec.id ?? String(index), ...rec });
      }
    });
    return rows;
  }

  if (typeof raw === 'object') {
    for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        if (rec.deletedAt || rec.deleted_at || rec._deleted) continue;
        rows.push({ id: rec.id ?? key, ...rec });
      }
    }
  }

  return rows;
}

function asSector(value: unknown): SectorType {
  if (value === 'resort' || value === 'hotel') return value;
  return 'hotel';
}

function asBookingStatus(value: unknown): BookingStatus {
  const valid: BookingStatus[] = [
    'new',
    'confirmed',
    'due_in',
    'checked_in',
    'due_out',
    'checked_out',
    'booking_offer',
    'out_of_order',
    'cancelled',
  ];
  return typeof value === 'string' && valid.includes(value as BookingStatus)
    ? (value as BookingStatus)
    : 'confirmed';
}

function asPaymentStatus(value: unknown): TimelineBooking['paymentStatus'] {
  if (value === 'paid' || value === 'partial' || value === 'pending') {
    return value;
  }
  return 'pending';
}

function asResourceView(value: unknown): ResourceItem['view'] {
  if (value === 'Mer' || value === 'Jardin' || value === 'Ville' || value === 'Piscine' || value === 'Arrière') {
    return value;
  }
  return undefined;
}

function asOriginChannel(value: unknown): TimelineBooking['originChannel'] {
  if (value === 'Direct' || value === 'Booking.com' || value === 'Airbnb' || value === 'Expedia') {
    return value;
  }
  return undefined;
}

function asTaskCategory(value: unknown): PmsTask['category'] {
  if (
    value === 'Ménage' ||
    value === 'Linge' ||
    value === 'Minibar & accueil' ||
    value === 'Livraison' ||
    value === 'Maintenance'
  ) {
    return value;
  }
  if (value === 'delivery') return 'Livraison';
  if (value === 'maintenance') return 'Maintenance';
  return 'Ménage';
}

function normalizeResourceItem(raw: Record<string, unknown>): ResourceItem | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;
  return {
    id,
    groupId: typeof raw.groupId === 'string' ? raw.groupId : typeof raw.group_id === 'string' ? raw.group_id : undefined,
    name,
    type: typeof raw.type === 'string' ? raw.type : typeof raw.resource_type === 'string' ? raw.resource_type : 'Chambre',
    sector: asSector(raw.sector ?? raw.domain),
    pricePerDay: Number(raw.pricePerDay ?? raw.price_per_day ?? 0) || 0,
    housekeepingStatus:
      raw.housekeepingStatus === 'clean' ||
      raw.housekeepingStatus === 'cleaning' ||
      raw.housekeepingStatus === 'dirty' ||
      raw.housekeepingStatus === 'out_of_order'
        ? raw.housekeepingStatus
        : 'clean',
    capacity: raw.capacity !== undefined ? Number(raw.capacity) : undefined,
    building: typeof raw.building === 'string' ? raw.building : undefined,
    floor: typeof raw.floor === 'string' ? raw.floor : undefined,
    wing: typeof raw.wing === 'string' ? raw.wing : undefined,
    view: asResourceView(raw.view),
    beds: typeof raw.beds === 'string' ? raw.beds : undefined,
    sizeM2: raw.sizeM2 !== undefined ? Number(raw.sizeM2) : undefined,
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String) : undefined,
    establishmentId:
      typeof raw.establishmentId === 'string'
        ? raw.establishmentId
        : typeof raw.establishment_id === 'string'
          ? raw.establishment_id
          : undefined,
  };
}

export function normalizeFirebaseSnapshot(raw: {
  resourceGroups?: unknown;
  resources?: unknown;
  bookings?: unknown;
  tasks?: unknown;
  stockItems?: unknown;
  dynamicRates?: unknown;
  establishmentProfile?: unknown;
  establishments?: unknown;
}): Omit<FirebaseRecoveryPayload, 'sources' | 'warnings'> {
  const rawGroups = normalizeCollectionEntries(raw.resourceGroups);
  const rawResources = normalizeCollectionEntries(raw.resources);
  const rawBookings = normalizeCollectionEntries(raw.bookings);
  const rawTasks = normalizeCollectionEntries(raw.tasks);
  const rawStock = normalizeCollectionEntries(raw.stockItems);

  const groupMap = new Map<string, ResourceGroup>();
  for (const g of rawGroups) {
    const id = typeof g.id === 'string' ? g.id.trim() : '';
    if (!id) continue;
    const rawName = g.name;
    const nameObj =
      rawName && typeof rawName === 'object' && !Array.isArray(rawName)
        ? {
            fr: String((rawName as Record<string, unknown>).fr ?? (rawName as Record<string, unknown>).en ?? id),
            en: String((rawName as Record<string, unknown>).en ?? (rawName as Record<string, unknown>).fr ?? id),
            ar: String((rawName as Record<string, unknown>).ar ?? (rawName as Record<string, unknown>).fr ?? id),
          }
        : {
            fr: String(rawName ?? id),
            en: String(rawName ?? id),
            ar: String(rawName ?? id),
          };
    const nestedResources = Array.isArray(g.resources)
      ? normalizeCollectionEntries(g.resources)
          .map(normalizeResourceItem)
          .filter((r): r is ResourceItem => Boolean(r))
          .map((r) => ({ ...r, groupId: id }))
      : [];

    groupMap.set(id, {
      id,
      name: nameObj,
      sector: asSector(g.sector ?? g.domain),
      icon: typeof g.icon === 'string' ? g.icon : 'Building',
      resources: nestedResources,
    });
  }

  for (const rRaw of rawResources) {
    const resource = normalizeResourceItem(rRaw);
    if (!resource) continue;
    const targetGroupId =
      resource.groupId || (resource.building ? `cloud-building-${resource.building}` : 'cloud-inventory');
    let group = groupMap.get(targetGroupId);
    if (!group) {
      const label = resource.building ? String(resource.building) : 'Inventaire Cloud';
      group = {
        id: targetGroupId,
        name: { fr: label, en: label, ar: label },
        sector: resource.sector,
        icon: 'Building',
        resources: [],
      };
      groupMap.set(targetGroupId, group);
    }
    if (!group.resources.some((existing) => existing.id === resource.id)) {
      group.resources.push({ ...resource, groupId: group.id });
    }
  }

  const bookings: TimelineBooking[] = [];
  for (const b of rawBookings) {
    const id = typeof b.id === 'string' ? b.id.trim() : '';
    const resourceId = typeof b.resourceId === 'string' ? b.resourceId : typeof b.resource_id === 'string' ? b.resource_id : '';
    const startDate = typeof b.startDate === 'string' ? b.startDate : typeof b.start_date === 'string' ? b.start_date : '';
    const endDate = typeof b.endDate === 'string' ? b.endDate : typeof b.end_date === 'string' ? b.end_date : '';
    if (!id || !resourceId || !startDate || !endDate) continue;

    bookings.push({
      id,
      resourceId,
      resourceName:
        typeof b.resourceName === 'string'
          ? b.resourceName
          : typeof b.resource_name === 'string'
            ? b.resource_name
            : resourceId,
      sector: asSector(b.sector ?? b.domain),
      guestName:
        typeof b.guestName === 'string'
          ? b.guestName
          : typeof b.guest_name === 'string'
            ? b.guest_name
            : 'Client',
      guestEmail: typeof b.guestEmail === 'string' ? b.guestEmail : typeof b.guest_email === 'string' ? b.guest_email : '',
      guestPhone: typeof b.guestPhone === 'string' ? b.guestPhone : typeof b.guest_phone === 'string' ? b.guest_phone : '',
      startDate,
      endDate,
      status: asBookingStatus(b.status),
      totalPrice: Number(b.totalPrice ?? b.total_price ?? 0) || 0,
      paymentStatus: asPaymentStatus(b.paymentStatus ?? b.payment_status),
      notes: typeof b.notes === 'string' ? b.notes : undefined,
      adults: b.adults !== undefined ? Number(b.adults) : undefined,
      children: b.children !== undefined ? Number(b.children) : undefined,
      mealPlan: typeof b.mealPlan === 'string' ? (b.mealPlan as TimelineBooking['mealPlan']) : undefined,
      originChannel: asOriginChannel(b.originChannel ?? b.origin_channel),
      extras: Array.isArray(b.extras) ? (b.extras as TimelineBooking['extras']) : undefined,
      occupantsList: Array.isArray(b.occupantsList) ? (b.occupantsList as TimelineBooking['occupantsList']) : undefined,
      customMetadata:
        b.customMetadata && typeof b.customMetadata === 'object'
          ? (b.customMetadata as Record<string, unknown>)
          : undefined,
    });
  }

  const tasks: PmsTask[] = rawTasks
    .filter((t) => typeof t.id === 'string' && (typeof t.typeName === 'string' || typeof t.type_name === 'string'))
    .map((t) => ({
      id: String(t.id),
      room: typeof t.room === 'string' ? t.room : '',
      typeId: typeof t.typeId === 'string' ? t.typeId : typeof t.type_id === 'string' ? t.type_id : '',
      typeName: typeof t.typeName === 'string' ? t.typeName : String(t.type_name),
      category: asTaskCategory(t.category),
      assignee: typeof t.assignee === 'string' ? t.assignee : '',
      date: typeof t.date === 'string' ? t.date : typeof t.task_date === 'string' ? t.task_date : '',
      status:
        t.status === 'pending' || t.status === 'doing' || t.status === 'done' || t.status === 'cancel'
          ? t.status
          : 'pending',
      priority: t.priority === 'urgent' ? 'urgent' : 'normal',
      note: typeof t.note === 'string' ? t.note : undefined,
    }));

  const stockItems: StockItem[] = rawStock
    .filter((s) => typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({
      id: String(s.id),
      category:
        s.category === 'minibar' || s.category === 'hygiene' || s.category === 'linen' || s.category === 'cleaning'
          ? s.category
          : 'hygiene',
      name: String(s.name),
      unit: typeof s.unit === 'string' ? s.unit : 'u',
      quantity: Number(s.quantity ?? 0) || 0,
      minThreshold: Number(s.minThreshold ?? s.min_threshold ?? 0) || 0,
      unitCost: Number(s.unitCost ?? s.unit_cost ?? 0) || 0,
    }));

  const dynamicRates: Record<string, Record<string, number>> = {};
  if (raw.dynamicRates && typeof raw.dynamicRates === 'object' && !Array.isArray(raw.dynamicRates)) {
    for (const [roomType, dates] of Object.entries(raw.dynamicRates as Record<string, unknown>)) {
      if (dates && typeof dates === 'object' && !Array.isArray(dates)) {
        const rateMap: Record<string, number> = {};
        for (const [date, price] of Object.entries(dates as Record<string, unknown>)) {
          const num = Number(price);
          if (Number.isFinite(num)) rateMap[date] = num;
        }
        if (Object.keys(rateMap).length > 0) dynamicRates[roomType] = rateMap;
      }
    }
  }

  let establishmentProfile: Partial<EstablishmentProfile> | null = null;
  const profileSource =
    raw.establishmentProfile && typeof raw.establishmentProfile === 'object' && !Array.isArray(raw.establishmentProfile)
      ? (raw.establishmentProfile as Record<string, unknown>)
      : normalizeCollectionEntries(raw.establishments)[0] ?? null;

  if (profileSource && typeof profileSource.name === 'string' && profileSource.name.trim()) {
    establishmentProfile = {
      name: profileSource.name.trim(),
      address: typeof profileSource.address === 'string' ? profileSource.address : undefined,
      city: typeof profileSource.city === 'string' ? profileSource.city : undefined,
      country: typeof profileSource.country === 'string' ? profileSource.country : undefined,
      phone: typeof profileSource.phone === 'string' ? profileSource.phone : undefined,
      email: typeof profileSource.email === 'string' ? profileSource.email : undefined,
      website: typeof profileSource.website === 'string' ? profileSource.website : undefined,
      logoUrl: typeof profileSource.logoUrl === 'string' ? profileSource.logoUrl : undefined,
      stars: typeof profileSource.stars === 'number' ? profileSource.stars : undefined,
      taxNumber: typeof profileSource.taxNumber === 'string' ? profileSource.taxNumber : undefined,
      tradeRegisterNumber:
        typeof profileSource.tradeRegisterNumber === 'string' ? profileSource.tradeRegisterNumber : undefined,
      bankName: typeof profileSource.bankName === 'string' ? profileSource.bankName : undefined,
      bankAccountRib: typeof profileSource.bankAccountRib === 'string' ? profileSource.bankAccountRib : undefined,
      defaultCurrency:
        typeof profileSource.defaultCurrency === 'string'
          ? profileSource.defaultCurrency
          : typeof profileSource.currency === 'string'
            ? profileSource.currency
            : undefined,
    };
  }

  return {
    groups: [...groupMap.values()],
    bookings,
    tasks,
    stockItems,
    dynamicRates,
    establishmentProfile,
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function buildRtdbUrl(baseUrl: string, path: string, query = ''): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const suffix = cleanPath ? `/${cleanPath}.json` : '/.json';
  return `${cleanBase}${suffix}${query ? `?${query}` : ''}`;
}

function buildFirestoreCollectionUrl(projectId: string, collection: string, apiKey?: string, pageSize = 200): string {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId.trim())}/databases/(default)/documents/${encodeURIComponent(collection)}?pageSize=${pageSize}`;
  return apiKey?.trim() ? `${base}&key=${encodeURIComponent(apiKey.trim())}` : base;
}

export async function testFirebaseCloudConnection(
  config: FirebaseCloudConfig,
): Promise<FirebaseConnectionTestResult> {
  const firestoreConfigured = isFirebaseFirestoreConfigured(config);
  const rtdbConfigured = isFirebaseRtdbConfigured(config);

  const result: FirebaseConnectionTestResult = {
    firestore: { configured: firestoreConfigured, ok: false },
    realtimeDatabase: { configured: rtdbConfigured, ok: false },
  };

  const tasks: Promise<void>[] = [];

  if (firestoreConfigured && config.projectId) {
    tasks.push(
      (async () => {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        try {
          const collection = config.rootPath ? `${config.rootPath}/bookings` : 'bookings';
          const res = await fetchJsonWithTimeout(
            buildFirestoreCollectionUrl(config.projectId!, collection, config.apiKey, 1),
          );
          const latencyMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
          result.firestore.status = res.status;
          result.firestore.latencyMs = latencyMs;
          if (res.ok) {
            result.firestore.ok = true;
          } else {
            const msg =
              (res.data as { error?: { message?: string } } | null)?.error?.message ||
              `HTTP ${res.status}`;
            result.firestore.error = msg;
          }
        } catch (err) {
          result.firestore.error = err instanceof Error ? err.message : 'Erreur réseau Firestore';
        }
      })(),
    );
  }

  if (rtdbConfigured && config.databaseURL) {
    tasks.push(
      (async () => {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        try {
          const res = await fetchJsonWithTimeout(
            buildRtdbUrl(config.databaseURL!, config.rootPath || '', 'shallow=true'),
          );
          const latencyMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
          result.realtimeDatabase.status = res.status;
          result.realtimeDatabase.latencyMs = latencyMs;
          if (res.ok) {
            result.realtimeDatabase.ok = true;
          } else {
            const msg =
              (res.data as { error?: string } | null)?.error || `HTTP ${res.status}`;
            result.realtimeDatabase.error = msg;
          }
        } catch (err) {
          result.realtimeDatabase.error = err instanceof Error ? err.message : 'Erreur réseau Realtime Database';
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return result;
}

export async function recoverFromFirebaseCloud(
  config: FirebaseCloudConfig,
): Promise<FirebaseRecoveryPayload> {
  const empty: FirebaseRecoveryPayload = {
    groups: [],
    bookings: [],
    tasks: [],
    stockItems: [],
    dynamicRates: {},
    establishmentProfile: null,
    sources: [],
    warnings: [],
  };

  if (!isAnyFirebaseCloudConfigured(config)) return empty;

  const prefix = config.rootPath ? config.rootPath.replace(/^\/+|\/+$/g, '') : '';
  const joinPath = (segment: string) => (prefix ? `${prefix}/${segment}` : segment);

  const collected = {
    resourceGroups: [] as unknown[],
    resources: [] as unknown[],
    bookings: [] as unknown[],
    tasks: [] as unknown[],
    stockItems: [] as unknown[],
    dynamicRates: {} as Record<string, unknown>,
    establishmentProfile: null as unknown,
    establishments: [] as unknown[],
  };

  const sources: Array<'firestore' | 'realtime_database'> = [];
  const warnings: string[] = [];

  // 1. Firebase Realtime Database recovery
  if (isFirebaseRtdbConfigured(config) && config.databaseURL) {
    try {
      const rootRes = await fetchJsonWithTimeout(buildRtdbUrl(config.databaseURL, prefix));
      if (rootRes.ok && rootRes.data && typeof rootRes.data === 'object') {
        sources.push('realtime_database');
        const root = rootRes.data as Record<string, unknown>;
        collected.resourceGroups.push(...normalizeCollectionEntries(root.resourceGroups ?? root.resource_groups));
        collected.resources.push(...normalizeCollectionEntries(root.resources ?? root.rooms));
        collected.bookings.push(...normalizeCollectionEntries(root.bookings ?? root.reservations));
        collected.tasks.push(...normalizeCollectionEntries(root.tasks ?? root.pms_tasks));
        collected.stockItems.push(...normalizeCollectionEntries(root.stockItems ?? root.stock_items));
        if (root.dynamicRates && typeof root.dynamicRates === 'object') {
          Object.assign(collected.dynamicRates, root.dynamicRates);
        }
        if (root.dynamic_rates && typeof root.dynamic_rates === 'object') {
          Object.assign(collected.dynamicRates, root.dynamic_rates);
        }
        if (root.establishmentProfile) collected.establishmentProfile = root.establishmentProfile;
        if (root.establishments) collected.establishments.push(...normalizeCollectionEntries(root.establishments));
      } else if (rootRes.status === 401 || rootRes.status === 403) {
        // Fallback: try individual collection nodes if root read is locked down
        const [groupsRes, resRes, bkgRes, profRes] = await Promise.all([
          fetchJsonWithTimeout(buildRtdbUrl(config.databaseURL, joinPath('resourceGroups'))).catch(() => null),
          fetchJsonWithTimeout(buildRtdbUrl(config.databaseURL, joinPath('resources'))).catch(() => null),
          fetchJsonWithTimeout(buildRtdbUrl(config.databaseURL, joinPath('bookings'))).catch(() => null),
          fetchJsonWithTimeout(buildRtdbUrl(config.databaseURL, joinPath('establishmentProfile'))).catch(() => null),
        ]);
        const anyOk = [groupsRes, resRes, bkgRes, profRes].some((r) => r?.ok);
        if (anyOk) {
          sources.push('realtime_database');
          if (groupsRes?.ok) collected.resourceGroups.push(...normalizeCollectionEntries(groupsRes.data));
          if (resRes?.ok) collected.resources.push(...normalizeCollectionEntries(resRes.data));
          if (bkgRes?.ok) collected.bookings.push(...normalizeCollectionEntries(bkgRes.data));
          if (profRes?.ok && profRes.data) collected.establishmentProfile = profRes.data;
        } else {
          warnings.push(`Realtime Database HTTP ${rootRes.status} (accès refusé ou authentification requise)`);
        }
      }
    } catch (err) {
      warnings.push(`Realtime Database : ${err instanceof Error ? err.message : 'échec lecture'}`);
    }
  }

  // 2. Cloud Firestore recovery
  if (isFirebaseFirestoreConfigured(config) && config.projectId) {
    const fetchFsCollection = async (names: string[]): Promise<Array<Record<string, unknown>>> => {
      for (const name of names) {
        const path = joinPath(name);
        try {
          const res = await fetchJsonWithTimeout(
            buildFirestoreCollectionUrl(config.projectId!, path, config.apiKey, 200),
          );
          if (res.ok && res.data && typeof res.data === 'object') {
            const docs = (res.data as { documents?: Array<{ name?: string; fields?: Record<string, unknown> }> }).documents;
            if (Array.isArray(docs) && docs.length > 0) {
              return docs
                .map(decodeFirestoreDocument)
                .filter((d): d is Record<string, unknown> => Boolean(d));
            }
            // Empty collection still confirms Firestore responded cleanly
            return [];
          }
          if (res.status === 403 || res.status === 401) {
            warnings.push(`Firestore (${name}) : HTTP ${res.status}`);
          }
        } catch (err) {
          warnings.push(`Firestore (${name}) : ${err instanceof Error ? err.message : 'échec lecture'}`);
        }
      }
      return [];
    };

    const [fsGroups, fsResources, fsBookings, fsTasks, fsStock, fsEstablishments] = await Promise.all([
      fetchFsCollection(['resourceGroups', 'resource_groups']),
      fetchFsCollection(['resources', 'rooms']),
      fetchFsCollection(['bookings', 'reservations']),
      fetchFsCollection(['tasks', 'pms_tasks']),
      fetchFsCollection(['stockItems', 'stock_items']),
      fetchFsCollection(['establishments', 'establishmentProfile']),
    ]);

    if (
      fsGroups.length > 0 ||
      fsResources.length > 0 ||
      fsBookings.length > 0 ||
      fsTasks.length > 0 ||
      fsStock.length > 0 ||
      fsEstablishments.length > 0
    ) {
      sources.push('firestore');
      collected.resourceGroups.push(...fsGroups);
      collected.resources.push(...fsResources);
      collected.bookings.push(...fsBookings);
      collected.tasks.push(...fsTasks);
      collected.stockItems.push(...fsStock);
      collected.establishments.push(...fsEstablishments);
    }
  }

  const normalized = normalizeFirebaseSnapshot(collected);
  return {
    ...normalized,
    sources,
    warnings,
  };
}
