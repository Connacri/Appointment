import { requireSupabase } from './supabaseClient';
import type { TimelineBooking, ResourceGroup, ResourceItem, HotelEstablishment, EstablishmentSyncRecord, PmsTask, StockItem, StockMovement } from '../../types/booking';
import {
  BOOKING_SELECT_COLUMNS,
  fromSupabaseBookingRow,
  toSupabaseBookingRow,
} from './bookingMapper';

type WorkspaceId = string;
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data.');
  return result.data;
}

export async function createWorkspace(name: string, requestedId?: string): Promise<{ id: string; name: string }> {
  const normalized = name.trim();
  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error('Le nom de l’espace doit contenir entre 2 et 80 caractères.');
  }
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw new Error(authError.message);
  const user = authData.user;
  if (!user) {
    throw new Error('Connectez-vous à Supabase avant de créer un espace de travail.');
  }

  // A caller-managed id (the authenticated account id for a personal workspace)
  // makes this operation idempotent across tabs/devices. The RLS policy now lets
  // an owner read its own workspace before the owner membership exists, so a
  // missing membership can be repaired instead of blocking every later login.
  const id = requestedId?.trim() || (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );

  const readOwnedWorkspace = async () => {
    const { data, error } = await db
      .from('workspaces')
      .select('id,name,owner_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

  const ensureOwnerMembership = async (): Promise<void> => {
    const { error } = await db
      .from('workspace_members')
      .upsert(
        { workspace_id: id, user_id: user.id, role: 'owner' },
        { onConflict: 'workspace_id,user_id', ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  };

  const existing = await readOwnedWorkspace();
  if (existing) {
    if (existing.owner_id !== user.id) {
      throw new Error('Cet espace de travail appartient à un autre compte.');
    }
    await ensureOwnerMembership();
    return { id: existing.id, name: existing.name || normalized };
  }

  const { error: workspaceError } = await db
    .from('workspaces')
    .insert({ id, name: normalized, owner_id: user.id });
  if (workspaceError) {
    // A concurrent tab/device may have inserted the same deterministic id.
    // Reload it before reporting failure, then repair the owner membership.
    const raced = await readOwnedWorkspace();
    if (!raced || raced.owner_id !== user.id) throw new Error(workspaceError.message);
    await ensureOwnerMembership();
    return { id: raced.id, name: raced.name || normalized };
  }

  await ensureOwnerMembership();
  return { id, name: normalized };
}

export async function listWorkspaces() {
  const db = requireSupabase();
  const { data, error } = await db
    .from('workspaces')
    .select('id,name,owner_id,workspace_members!inner(role)')
    .order('created_at');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listEstablishments(workspaceId: WorkspaceId): Promise<HotelEstablishment[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('establishments').select('*').eq('workspace_id', workspaceId).eq('is_active', true).is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id:r.id, code:r.code, name:r.name, city:r.city ?? '', stars:r.stars, taxRate:Number(r.tax_rate), checkInTime:r.check_in_time.slice(0,5), checkOutTime:r.check_out_time.slice(0,5), facilities:r.facilities ?? [] }));
}

export async function saveEstablishment(workspaceId: WorkspaceId, item: EstablishmentSyncRecord) {
  if (!workspaceId.trim() || !item.id.trim()) {
    throw new Error('Un workspace et un établissement réels sont obligatoires.');
  }
  const db = requireSupabase();
  return unwrap(await db.from('establishments').upsert({
    id: item.id,
    workspace_id: workspaceId,
    code: item.code,
    name: item.name,
    city: item.city,
    stars: item.stars,
    tax_rate: item.taxRate,
    check_in_time: item.checkInTime,
    check_out_time: item.checkOutTime,
    facilities: item.facilities,
    domain: item.domain ?? 'hotel',
    currency: item.currency ?? 'DZD',
    country: item.country ?? '',
    address: item.address ?? null,
    establishment_type: item.establishmentType ?? 'hotel',
  }).select().single());
}

// Two foreign keys link resources to resource_groups. The composite tenant FK
// also matches workspace_id, so it is the only relationship safe for scoped pulls.
export const RESOURCE_GROUPS_WITH_RESOURCES_SELECT = '*,resources!resources_group_tenant_fk(*)';

export async function listResourceGroups(workspaceId: WorkspaceId, establishmentId?: string): Promise<ResourceGroup[]> {
  const db = requireSupabase();
  let q = db.from('resource_groups').select(RESOURCE_GROUPS_WITH_RESOURCES_SELECT).eq('workspace_id',workspaceId).is('deleted_at',null).order('sort_order');
  if (establishmentId) q = q.eq('establishment_id',establishmentId);
  const {data,error} = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((g:any)=>({id:g.id,name:g.name,sector:g.domain,icon:g.icon ?? undefined,resources:(g.resources ?? []).map((r:any)=>({id:r.id,groupId:r.group_id ?? g.id,name:r.name,type:r.resource_type,sector:r.domain,pricePerDay:Number(r.price_per_day),housekeepingStatus:r.housekeeping_status,capacity:r.capacity ?? undefined,building:r.building ?? undefined,floor:r.floor ?? undefined,view:r.view ?? undefined,beds:r.beds ?? undefined,sizeM2:r.size_m2===null?undefined:Number(r.size_m2),amenities:r.amenities ?? [],establishmentId:r.establishment_id}))}));
}

export async function saveResourceGroup(workspaceId: WorkspaceId, establishmentId: string, group: ResourceGroup) {
  if (!workspaceId.trim() || !establishmentId.trim() || establishmentId === 'all') {
    throw new Error('Un workspace et un établissement réels sont obligatoires.');
  }
  for (const resource of group.resources) {
    if (resource.establishmentId && resource.establishmentId !== establishmentId) {
      throw new Error(`La ressource ${resource.name} appartient à un autre établissement.`);
    }
  }
  const db = requireSupabase();
  unwrap(await db.from('resource_groups').upsert({id:group.id,workspace_id:workspaceId,establishment_id:establishmentId,name:group.name,domain:group.sector,icon:group.icon ?? null}).select().single());
  for (const r of group.resources) await saveResource(workspaceId,establishmentId,group.id,r);
}

/**
 * Upsert only the resource-group metadata row. The outbox pushes a group before
 * its resources so the `resources.group_id` foreign key is always satisfiable.
 * Unlike `saveResourceGroup`, this never cascades resource writes.
 */
export async function saveResourceGroupRow(
  workspaceId: WorkspaceId,
  establishmentId: string,
  group: Pick<ResourceGroup, 'id' | 'name' | 'sector' | 'icon'>,
) {
  if (!workspaceId.trim() || !establishmentId.trim() || establishmentId === 'all') {
    throw new Error('Un workspace et un établissement réels sont obligatoires.');
  }
  const db = requireSupabase();
  return unwrap(await db.from('resource_groups').upsert({
    id: group.id,
    workspace_id: workspaceId,
    establishment_id: establishmentId,
    name: group.name,
    domain: group.sector,
    icon: group.icon ?? null,
  }).select().single());
}

export async function saveResource(workspaceId: WorkspaceId, establishmentId: string, groupId: string|null, item: ResourceItem) {
  if (!workspaceId.trim() || !establishmentId.trim() || establishmentId === 'all') {
    throw new Error('Un workspace et un établissement réels sont obligatoires.');
  }
  if (item.establishmentId && item.establishmentId !== establishmentId) {
    throw new Error(`La ressource ${item.name} ne correspond pas à l'établissement sélectionné.`);
  }
  const db = requireSupabase();
  return unwrap(await db.from('resources').upsert({id:item.id,workspace_id:workspaceId,establishment_id:establishmentId,group_id:groupId,name:item.name,resource_type:item.type,domain:item.sector,price_per_day:item.pricePerDay,capacity:item.capacity ?? null,housekeeping_status:item.housekeepingStatus ?? 'clean',building:item.building ?? null,floor:item.floor ?? null,view:item.view ?? null,beds:item.beds ?? null,size_m2:item.sizeM2 ?? null,amenities:item.amenities ?? []}).select().single());
}

function mapBookingRow(r: any): TimelineBooking {
  return fromSupabaseBookingRow(r);
}

export interface RemoteBookingTombstone {
  entityId: string;
  establishmentId: string;
  version: number;
  deletedAt: string;
}

/**
 * Deleted rows are synchronization data, not visible bookings. Keep this query
 * separate from listBookings so every client can durably apply remote deletes
 * without treating an absent row in a normal snapshot as a deletion.
 */
export async function listBookingTombstones(workspaceId: WorkspaceId): Promise<RemoteBookingTombstone[]> {
  if (!workspaceId.trim()) throw new Error('Workspace requis pour lire les suppressions distantes.');
  const db = requireSupabase();
  const pageSize = 500;
  const tombstones: RemoteBookingTombstone[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from('bookings')
      .select('id,establishment_id,version,deleted_at')
      .eq('workspace_id', workspaceId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Lecture des suppressions de réservations impossible : ${error.message}`);

    const page = (data ?? []).flatMap((row: any) => {
      if (
        typeof row.id !== 'string'
        || typeof row.establishment_id !== 'string'
        || !Number.isSafeInteger(Number(row.version))
        || Number(row.version) < 1
        || typeof row.deleted_at !== 'string'
      ) return [];
      return [{
        entityId: row.id,
        establishmentId: row.establishment_id,
        version: Number(row.version),
        deletedAt: row.deleted_at,
      }];
    });
    tombstones.push(...page);
    if ((data ?? []).length < pageSize) break;
    offset += pageSize;
  }

  return tombstones;
}

export async function listBookings(workspaceId: WorkspaceId, establishmentId?: string): Promise<TimelineBooking[]> {
  // PostgREST caps a single response (Supabase default max rows). Pull the whole
  // workspace page by page through the calendar index instead of silently
  // truncating history at the first page.
  const pageSize = 500;
  const first = await listBookingsWindow(workspaceId, '0001-01-01', '9999-12-31', {
    establishmentId,
    offset: 0,
    limit: pageSize,
  });
  const bookings = [...first.data];
  let offset = first.data.length;

  // `count` can be unavailable under some RLS/PostgREST configurations, so use
  // page fullness as the termination signal instead of trusting `total` alone.
  while (first.data.length === pageSize) {
    const page = await listBookingsWindow(workspaceId, '0001-01-01', '9999-12-31', {
      establishmentId,
      offset,
      limit: pageSize,
      withCount: false,
    });
    if (page.data.length === 0) break;
    bookings.push(...page.data);
    offset += page.data.length;
    if (page.data.length < pageSize) break;
  }

  return bookings;
}

/**
 * Windowed, overlap-safe booking load for the timeline.
 *
 * Uses the existing remote index `idx_bookings_calendar` on
 * (workspace_id, establishment_id, start_date, end_date) WHERE deleted_at IS NULL,
 * a narrow column projection, deterministic ordering and PostgREST `.range()` so
 * only the visible slice travels over the network. No new DDL is required.
 *
 * A booking is included when it overlaps [startDate, endDate]:
 *   start_date <= endDate AND end_date >= startDate
 * PostgREST cannot express the overlap directly, so we fetch the calendar window
 * [startDate, endDate] (every booking starting inside the window) plus, to stay
 * overlap-safe, bookings that started before the window but end inside or after it.
 * The caller may re-filter strictly if needed.
 *
 * `listBookings` reuses this function page by page for whole-workspace pulls so a
 * large history is never silently truncated by the PostgREST max-row limit.
 */
export interface BookingsWindowResult {
  data: TimelineBooking[];
  total: number;
  offset: number;
  limit: number;
}

export async function listBookingsWindow(
  workspaceId: WorkspaceId,
  startDate: string,
  endDate: string,
  options: {
    establishmentId?: string;
    offset?: number;
    limit?: number;
    /** Disable the exact count for follow-up pages; the first page already knows the total. */
    withCount?: boolean;
  } = {},
): Promise<BookingsWindowResult> {
  const { establishmentId, offset = 0, limit = 200, withCount = true } = options;
  const db = requireSupabase();
  // Narrow projection: verified columns required for timeline & detail hydration.
  const selectCols = BOOKING_SELECT_COLUMNS;
  let q = db
    .from('bookings')
    .select(selectCols, withCount ? { count: 'exact' } : undefined)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    // Overlap-safe lower bound: bookings starting on/before the window end.
    .lte('start_date', endDate)
    // Overlap-safe upper bound: bookings ending on/after the window start.
    .gte('end_date', startDate)
    .order('start_date', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, Math.max(offset, offset + limit - 1));
  if (establishmentId) q = q.eq('establishment_id', establishmentId);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return {
    data: (data ?? []).map(mapBookingRow),
    total: count ?? 0,
    offset,
    limit,
  };
}

export async function saveBooking(workspaceId: WorkspaceId, establishmentId: string, b: TimelineBooking) {
  if (!workspaceId.trim() || !establishmentId.trim() || establishmentId === 'all') {
    throw new Error('Un workspace et un établissement réels sont obligatoires.');
  }
  const db = requireSupabase();
  const { data: resource, error: resourceError } = await db.from('resources')
    .select('id,workspace_id,establishment_id')
    .eq('id', b.resourceId)
    .maybeSingle();
  if (resourceError) throw new Error(resourceError.message);
  if (!resource || resource.workspace_id !== workspaceId || resource.establishment_id !== establishmentId) {
    throw new Error('Réservation refusée : la chambre/ressource n’appartient pas à l’établissement et au workspace sélectionnés.');
  }
  const {data:auth} = await db.auth.getUser();
  const row = toSupabaseBookingRow(workspaceId, establishmentId, b, auth.user?.id ?? null);
  return unwrap(await db.from('bookings').upsert(row).select().single());
}

export async function deleteResource(id: string, workspaceId?: WorkspaceId) {
  const db = requireSupabase();
  let q = db.from('resources').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
  if (workspaceId?.trim()) q = q.eq('workspace_id', workspaceId);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function deleteBooking(id: string, workspaceId: WorkspaceId): Promise<void> {
  if (!id.trim() || !workspaceId.trim()) {
    throw new Error('Identifiant de réservation et workspace obligatoires pour supprimer.');
  }
  const db = requireSupabase();
  const { data, error } = await db
    .from('bookings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;

  // Idempotent retry: a previous request may have committed before its ACK was
  // lost. Accept only a real tombstone in this exact workspace, never a zero-row
  // update caused by a missing row or an RLS/tenant mismatch.
  const { data: existingTombstone, error: verifyError } = await db
    .from('bookings')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .maybeSingle();
  if (verifyError) throw new Error(verifyError.message);
  if (!existingTombstone) {
    throw new Error('Suppression non appliquée : réservation absente ou inaccessible dans ce workspace.');
  }
}

export async function listTasks(workspaceId: WorkspaceId, establishmentId: string): Promise<PmsTask[]> {
  const db = requireSupabase();
  const {data,error} = await db.from('pms_tasks').select('*').eq('workspace_id',workspaceId).eq('establishment_id',establishmentId).is('deleted_at',null).order('task_date');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r:any)=>({id:r.id,room:r.room ?? '',typeId:r.type_id ?? '',typeName:r.type_name,category:r.category,assignee:r.assignee ?? '',date:r.task_date,status:r.status,priority:r.priority,note:r.note ?? undefined,subtasks:r.subtasks ?? [],tools:r.tools ?? [],consumedItems:r.consumed_items ?? [],completedBy:r.completed_by ?? undefined,completedAt:r.completed_at ?? undefined}));
}

export async function saveTask(workspaceId: WorkspaceId, establishmentId: string, t: PmsTask) {
  const db = requireSupabase();
  return unwrap(await db.from('pms_tasks').upsert({id:t.id,workspace_id:workspaceId,establishment_id:establishmentId,room:t.room,type_id:t.typeId,type_name:t.typeName,category:t.category,assignee:t.assignee,task_date:t.date,status:t.status,priority:t.priority,note:t.note ?? null,subtasks:t.subtasks ?? [],tools:t.tools ?? [],consumed_items:t.consumedItems ?? [],completed_by:t.completedBy ?? null,completed_at:t.completedAt ?? null}).select().single());
}

export async function listStockItems(workspaceId: WorkspaceId, establishmentId: string): Promise<StockItem[]> {
  const db = requireSupabase();
  const {data,error} = await db.from('stock_items').select('*').eq('workspace_id',workspaceId).eq('establishment_id',establishmentId).is('deleted_at',null).order('category');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r:any)=>({id:r.id,category:r.category,name:r.name,unit:r.unit,quantity:Number(r.quantity),minThreshold:Number(r.min_threshold),unitCost:Number(r.unit_cost)}));
}

export async function saveStockItem(workspaceId: WorkspaceId, establishmentId: string, i: StockItem) {
  const db = requireSupabase();
  return unwrap(await db.from('stock_items').upsert({id:i.id,workspace_id:workspaceId,establishment_id:establishmentId,category:i.category,name:i.name,unit:i.unit,quantity:i.quantity,min_threshold:i.minThreshold,unit_cost:i.unitCost}).select().single());
}

export async function addStockMovement(workspaceId: WorkspaceId, establishmentId: string, m: StockMovement) {
  const db = requireSupabase();
  const {data:auth} = await db.auth.getUser();
  return unwrap(await db.from('stock_movements').insert({id:m.id,workspace_id:workspaceId,establishment_id:establishmentId,item_id:m.itemId,timestamp:m.timestamp,delta:m.delta,reason:m.reason,room:m.room ?? null,actor_name:m.user,created_by:auth.user?.id ?? null}).select().single());
}

export async function listDynamicRates(workspaceId: WorkspaceId, establishmentId?: string): Promise<Record<string, Record<string, number>>> {
  const db = requireSupabase();
  let q = db.from('dynamic_rates').select('resource_type,rate_date,price').eq('workspace_id', workspaceId).is('deleted_at', null);
  if (establishmentId) q = q.eq('establishment_id', establishmentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const matrix: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    if (!row.resource_type || !row.rate_date) continue;
    if (!matrix[row.resource_type]) matrix[row.resource_type] = {};
    matrix[row.resource_type][row.rate_date] = Number(row.price);
  }
  return matrix;
}

export async function syncCardLockMdbToSupabase(
  groups: ResourceGroup[],
  bookingsList: TimelineBooking[],
  workspaceId: WorkspaceId,
  establishmentId: string
): Promise<{ groupsCount: number; resourcesCount: number; bookingsCount: number }> {
  if (!workspaceId.trim() || !establishmentId.trim() || establishmentId === 'all') {
    throw new Error('Sélectionnez un workspace et un établissement réels avant la synchronisation CardLock.');
  }

  const db = requireSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!auth.user) throw new Error('Authentification Supabase requise pour la synchronisation cloud.');

  // Never choose the first workspace or create a synthetic establishment.
  const workspaces = await listWorkspaces();
  if (!workspaces.some((workspace: { id: string }) => workspace.id === workspaceId)) {
    throw new Error('Le workspace sélectionné n’est pas accessible au compte connecté.');
  }

  const establishments = await listEstablishments(workspaceId);
  if (!establishments.some((establishment) => establishment.id === establishmentId)) {
    throw new Error('L’établissement sélectionné n’existe pas dans ce workspace Supabase.');
  }
  // One CardLock BuildingInfo row represents one physical establishment.
  // Never push several buildings into one selected establishment.
  if (groups.length > 1) {
    throw new Error(`Import cloud annulé : le fichier CardLock contient ${groups.length} bâtiments. Chaque bâtiment doit être rattaché à son propre établissement réel ; aucun enregistrement n’a été envoyé.`);
  }
  const resourceIds = new Set(groups.flatMap((group) => group.resources.map((resource) => resource.id)));
  if (resourceIds.size !== groups.reduce((total, group) => total + group.resources.length, 0)) {
    throw new Error('Import cloud annulé : des identifiants de ressources sont dupliqués.');
  }
  const orphanBookings = bookingsList.filter((booking) => !resourceIds.has(booking.resourceId));
  if (orphanBookings.length > 0) {
    throw new Error(`Import cloud annulé : ${orphanBookings.length} séjour(s) ne correspondent à aucune ressource importée.`);
  }

  let totalResources = 0;
  for (const group of groups) {
    await saveResourceGroup(workspaceId, establishmentId, group);
    totalResources += group.resources.length;
  }

  for (const booking of bookingsList) {
    await saveBooking(workspaceId, establishmentId, booking);
  }

  return {
    groupsCount: groups.length,
    resourcesCount: totalResources,
    bookingsCount: bookingsList.length,
  };
}
