/**
 * Pure backfill planner for the automatic personal workspace.
 *
 * Given an existing local EstablishmentProfile, ResourceGroup[] and TimelineBooking[],
 * it produces a causally ordered list of Outbox operations
 * (establishment → resource groups → resources → bookings) to seed the remote
 * personal workspace.
 *
 * It is intentionally side-effect free: it never writes to IndexedDB or Supabase.
 * The caller (AppContext) is responsible for idempotency checks and actual writes.
 *
 * Guards:
 *  - Rejects blank profiles (empty name) so no establishment is ever invented.
 *  - Uses only the real local profile and inventory values.
 *  - Derives one stable establishment id; it never silently merges physical buildings.
 *  - Skips demo/bootstrap records (mockData ids) so backfill only covers real local data.
 *
 * Payloads are domain objects (camelCase), exactly what the sync adapter consumes.
 * Remote snake_case column mapping stays in `pmsRepository`, never in the Outbox.
 */

import type { EstablishmentProfile, EstablishmentType } from '../../types/establishment';
import type {
  HotelEstablishment,
  ResourceGroup,
  ResourceItem,
  TimelineBooking,
} from '../../types/booking';
import { capitalizeFirstLetter } from '../../utils/text';
import { isValidBookingDateRange } from '../../utils/bookingValidation';

const DEMO_GROUP_IDS = new Set(['demo-group-1', 'demo-group-2', 'demo-group-3']);
const DEMO_RESOURCE_IDS = new Set(['demo-room-101', 'demo-room-102', 'demo-room-103']);
const DEMO_BOOKING_IDS = new Set(['demo-booking-1', 'demo-booking-2', 'demo-booking-3']);

export interface BackfillEstablishment extends HotelEstablishment {
  /** Remote `establishments.domain` value; derived from the real local type. */
  domain: 'hotel' | 'resort';
  currency: string;
  country: string;
  address: string;
  establishmentType: EstablishmentType;
}

export interface BackfillResourceGroup {
  id: string;
  name: ResourceGroup['name'];
  sector: ResourceGroup['sector'];
  icon?: string;
  establishmentId: string;
}

export interface BackfillResource extends ResourceItem {
  groupId: string;
  establishmentId: string;
}

interface BackfillOperationBase {
  /** Stable id used as the Outbox entityId. */
  entityId: string;
  /** Remote establishment scope for this operation. */
  establishmentId: string;
  /** Stable, deterministic idempotency key so re-running backfill never duplicates. */
  idempotencyKey: string;
  /** Human label for telemetry / warnings. */
  label: string;
}

export type BackfillOperation =
  | (BackfillOperationBase & { kind: 'establishment'; payload: BackfillEstablishment })
  | (BackfillOperationBase & { kind: 'resourceGroup'; payload: BackfillResourceGroup })
  | (BackfillOperationBase & { kind: 'resource'; payload: BackfillResource })
  | (BackfillOperationBase & { kind: 'booking'; payload: TimelineBooking });

export interface BackfillPlan {
  ok: boolean;
  establishment: BackfillEstablishment | null;
  establishmentId: string | null;
  operations: BackfillOperation[];
  warnings: string[];
  skipped: { groups: number; resources: number; bookings: number };
  reason?: 'blank_profile' | 'no_workspace' | 'ambiguous_establishment';
}

/** Deterministic slug; Arabic/non-Latin names fall back to a stable hash. */
export function stableSlug(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `x${(hash >>> 0).toString(36)}`;
}

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function stableEstablishmentId(profile: Partial<EstablishmentProfile> | null | undefined): string {
  const source =
    profile?.id && profile.id !== 'establishment-draft' && profile.id !== 'establishment-cloud'
      ? safeTrim(profile.id)
      : safeTrim(profile?.name);
  return `est-${stableSlug(source || 'establishment')}`;
}

/**
 * The remote `establishments.establishment_type` check constraint accepts
 * hotel|resort|residence|boutique|business|motel|other. The local product also
 * offers `spa_clinic`, which has no remote equivalent yet, so it is stored as
 * `other` instead of rejecting the whole backfill on a check violation.
 */
function remoteEstablishmentType(type: EstablishmentType | undefined): EstablishmentType {
  if (!type) return 'hotel';
  return type === 'spa_clinic' ? 'other' : type;
}

/**
 * `establishments.check_in_time` / `check_out_time` are PostgreSQL `time` columns,
 * while the profile form is free text. Normalize common human formats and fall
 * back to the documented default instead of sending an invalid time that would
 * make every retry of the establishment push fail.
 */
function normalizeTime(value: string | undefined, fallback: string): string {
  const raw = safeTrim(value);
  const match = /^(\d{1,2})\s*[:hH.]\s*(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function establishmentCode(profile: Partial<EstablishmentProfile> | null | undefined): string {
  const source =
    profile?.id && profile.id !== 'establishment-draft' && profile.id !== 'establishment-cloud'
      ? safeTrim(profile.id)
      : safeTrim(profile?.name);
  return (
    source
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase()
      .slice(0, 24) || 'EST'
  );
}

function capitalizeLocalizedName(name: ResourceGroup['name']): ResourceGroup['name'] {
  return {
    fr: capitalizeFirstLetter(name?.fr ?? ''),
    en: capitalizeFirstLetter(name?.en ?? ''),
    ar: name?.ar ?? '',
  };
}

function isDemoGroup(group: ResourceGroup): boolean {
  return DEMO_GROUP_IDS.has(group.id);
}

function isDemoResource(resource: ResourceItem): boolean {
  return DEMO_RESOURCE_IDS.has(resource.id);
}

function isDemoBooking(booking: TimelineBooking): boolean {
  return DEMO_BOOKING_IDS.has(booking.id);
}

/**
 * Canonical JSON for a deterministic content fingerprint. This is an idempotency
 * namespace component, not a security hash or an authorization primitive.
 */
function stableBackfillJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableBackfillJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stableBackfillJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * A stable backfill key identifies one exact payload revision. A stable key based
 * only on entity ID incorrectly treats a later rename/re-parent/edit as the same
 * immutable operation and turns a legitimate update into an idempotency collision.
 */
function backfillIdempotencyKey(
  workspaceId: string,
  kind: string,
  entityId: string,
  establishmentId: string,
  payload: unknown,
): string {
  const canonical = stableBackfillJson(payload);
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193);
    hashB = Math.imul(hashB ^ code, 0x85ebca6b);
  }
  const fingerprint = `${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0).toString(16).padStart(8, '0')}`;
  return `backfill:${workspaceId}:${kind}:${entityId}:${establishmentId}:${fingerprint}`;
}

/**
 * Build the backfill plan. Returns `ok: false` when the profile has no real name,
 * so no establishment or Outbox records are invented.
 *
 * Note: a profile that still carries the placeholder id `establishment-draft`
 * is valid once the user entered a real name; the id is then derived from that
 * name. Only a blank name means "no real establishment yet".
 */
export function planBackfill({
  profile,
  workspaceId,
  groups,
  bookings,
  remoteEstablishments = [],
  selectedEstablishmentId,
}: {
  profile: EstablishmentProfile;
  workspaceId: string;
  groups: ResourceGroup[];
  bookings: TimelineBooking[];
  /** Remote establishments already present in the personal workspace. */
  remoteEstablishments?: HotelEstablishment[];
  /** Currently selected real remote establishment, if any. */
  selectedEstablishmentId?: string | 'all';
}): BackfillPlan {
  const warnings: string[] = [];
  const realGroups = groups.filter((group) => !isDemoGroup(group));
  const realResources = realGroups.flatMap((group) =>
    group.resources.filter((resource) => !isDemoResource(resource)),
  );
  const realBookings = bookings.filter((booking) => !isDemoBooking(booking));
  const allSkipped = {
    groups: realGroups.length,
    resources: realResources.length,
    bookings: realBookings.length,
  };

  if (!safeTrim(workspaceId)) {
    return {
      ok: false,
      establishment: null,
      establishmentId: null,
      operations: [],
      warnings: ['Aucun workspace personnel sélectionné : backfill différé.'],
      skipped: { groups: 0, resources: 0, bookings: 0 },
      reason: 'no_workspace',
    };
  }

  const trimmedProfileName = safeTrim(profile?.name);
  if (!trimmedProfileName) {
    return {
      ok: false,
      establishment: null,
      establishmentId: null,
      operations: [],
      warnings: [
        'Nom d’établissement vide : aucun établissement distant n’est créé.',
      ],
      skipped: allSkipped,
      reason: 'blank_profile',
    };
  }

  const remote = remoteEstablishments.filter((item) => Boolean(safeTrim(item?.id)));
  const profileId =
    profile?.id && profile.id !== 'establishment-draft' && profile.id !== 'establishment-cloud'
      ? safeTrim(profile.id) || null
      : null;
  const selected =
    selectedEstablishmentId && selectedEstablishmentId !== 'all' ? selectedEstablishmentId : null;

  let establishmentId: string;
  let pushEstablishment: boolean;

  if (remote.length === 0) {
    // Brand-new remote workspace: derive the single real establishment from the
    // local profile. Its id is persisted by the caller so a later rename updates
    // the same establishment instead of creating a duplicate.
    establishmentId = stableEstablishmentId(profile);
    pushEstablishment = true;
  } else if (remote.length === 1) {
    // The remote root already exists: never create a second establishment.
    establishmentId = remote[0].id;
    pushEstablishment = false;
  } else {
    const matched =
      remote.find((item) => item.id === profileId) ??
      remote.find((item) => item.id === selected) ??
      null;

    if (!matched) {
      return {
        ok: false,
        establishment: null,
        establishmentId: null,
        operations: [],
        warnings: [
          `Le workspace contient ${remote.length} établissements et l’inventaire local ` +
            'ne permet pas de choisir lequel rattacher. Backfill annulé pour ne pas mélanger ' +
            'plusieurs bâtiments réels.',
        ],
        skipped: allSkipped,
        reason: 'ambiguous_establishment',
      };
    }

    establishmentId = matched.id;
    pushEstablishment = false;
  }

  const remoteRoot = remote.find((item) => item.id === establishmentId);
  const establishment: BackfillEstablishment = {
    id: establishmentId,
    code: remoteRoot?.code || establishmentCode(profile),
    name: capitalizeFirstLetter(trimmedProfileName),
    city: safeTrim(profile?.city),
    stars: Math.max(0, Math.min(5, profile?.stars ?? 0)),
    // The local profile does not collect a tax rate or facilities list.
    // Zero/empty are neutral schema defaults, not invented business facts.
    taxRate: 0,
    checkInTime: normalizeTime(profile?.checkInTime, '14:00'),
    checkOutTime: normalizeTime(profile?.checkOutTime, '12:00'),
    facilities: [],
    domain: profile?.type === 'resort' ? 'resort' : 'hotel',
    currency: safeTrim(profile?.defaultCurrency) || 'DA',
    country: safeTrim(profile?.country),
    address: safeTrim(profile?.address),
    establishmentType: remoteEstablishmentType(profile?.type),
  };

  const operations: BackfillOperation[] = [];

  // 1. Establishment (root of the hierarchy; must exist before everything else).
  //    Skipped when the remote root already exists: creating it again would
  //    duplicate a real establishment.
  if (pushEstablishment) {
    operations.push({
      kind: 'establishment',
      entityId: establishmentId,
      establishmentId,
      payload: establishment,
      idempotencyKey: backfillIdempotencyKey(
        workspaceId, 'establishment', establishmentId, establishmentId, establishment,
      ),
      label: `Établissement ${establishment.name}`,
    });
  }

  let skippedGroups = 0;
  let skippedResources = 0;

  for (const group of groups) {
    if (isDemoGroup(group)) {
      skippedGroups += 1;
      skippedResources += group.resources.length;
      continue;
    }

    const groupName = capitalizeLocalizedName(group.name);
    const groupEstablishmentId = establishmentId;

    // 2. Resource group (building). Resources reference it through `group_id`,
    //    so it must exist remotely before any resource upsert.
    const groupPayload: BackfillResourceGroup = {
      id: group.id,
      name: groupName,
      sector: group.sector,
      icon: group.icon,
      establishmentId: groupEstablishmentId,
    };
    operations.push({
      kind: 'resourceGroup',
      entityId: group.id,
      establishmentId: groupEstablishmentId,
      payload: groupPayload,
      idempotencyKey: backfillIdempotencyKey(
        workspaceId, 'resource_group', group.id, groupEstablishmentId, groupPayload,
      ),
      label: `Bâtiment ${groupName.fr || groupName.en || group.id}`,
    });

    for (const resource of group.resources) {
      if (isDemoResource(resource)) {
        skippedResources += 1;
        continue;
      }

      if (
        resource.establishmentId &&
        resource.establishmentId !== 'all' &&
        resource.establishmentId !== establishmentId
      ) {
        warnings.push(
          `Ressource ${resource.name} déclare l’établissement ${resource.establishmentId} ; ` +
            `elle est rattachée à l’établissement réel du backfill ${establishmentId}.`,
        );
      }

      // 3. Resource (after its group). Always scoped to the single backfilled
      //    establishment so the causal chain stays valid.
      const resourcePayload: BackfillResource = {
        ...resource,
        groupId: resource.groupId ?? group.id,
        establishmentId: groupEstablishmentId,
      };
      operations.push({
        kind: 'resource',
        entityId: resource.id,
        establishmentId: groupEstablishmentId,
        payload: resourcePayload,
        idempotencyKey: backfillIdempotencyKey(
          workspaceId, 'resource', resource.id, groupEstablishmentId, resourcePayload,
        ),
        label: `Ressource ${resource.name}`,
      });
    }
  }

  // 4. Bookings (after resources; remote saveBooking validates that the resource
  //    belongs to the same workspace/establishment).
  let skippedBookings = 0;
  const localResourceIds = new Set(realResources.map((resource) => resource.id));

  for (const booking of bookings) {
    if (isDemoBooking(booking)) {
      skippedBookings += 1;
      continue;
    }
    if (!isValidBookingDateRange(booking.startDate, booking.endDate || booking.startDate)) {
      skippedBookings += 1;
      warnings.push(
        `Réservation ${booking.id} ignorée : dates invalides (${booking.startDate} → ${booking.endDate || booking.startDate}).`,
      );
      continue;
    }
    if (!booking.resourceId || !localResourceIds.has(booking.resourceId)) {
      skippedBookings += 1;
      warnings.push(
        `Réservation ${booking.id} ignorée : ressource ${booking.resourceId} absente de l’inventaire local.`,
      );
      continue;
    }
    const bookingPayload: TimelineBooking = { ...booking };
    operations.push({
      kind: 'booking',
      entityId: booking.id,
      establishmentId,
      payload: bookingPayload,
      idempotencyKey: backfillIdempotencyKey(
        workspaceId, 'booking', booking.id, establishmentId, bookingPayload,
      ),
      label: `Réservation ${booking.id}`,
    });
  }

  return {
    ok: true,
    establishment,
    establishmentId,
    operations,
    warnings,
    skipped: {
      groups: skippedGroups,
      resources: skippedResources,
      bookings: skippedBookings,
    },
  };
}
