import { requireSupabase } from './supabaseClient';
import type { Database, Json } from './database.types';
import type {
  TimelineBooking, ResourceGroup, ResourceItem, HotelEstablishment, EstablishmentSyncRecord,
  PmsTask, StockItem, StockMovement, StockSupplier, PurchaseOrderRecord,
} from '../../types/booking';
import type { StaffMemberRecord } from '../../types/roles';
import type { EstablishmentProfile } from '../../types/establishment';
import type { P2pEntity } from '../p2p/protocol';
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

export async function deleteTask(workspaceId: WorkspaceId, taskId: string): Promise<void> {
  if (!workspaceId.trim() || !taskId.trim()) throw new Error('Workspace et tâche requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('pms_tasks').update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', taskId).is('deleted_at', null).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;
  const { data: tombstone, error: verifyError } = await db.from('pms_tasks').select('id')
    .eq('workspace_id', workspaceId).eq('id', taskId).not('deleted_at', 'is', null).maybeSingle();
  if (verifyError) throw new Error(verifyError.message);
  if (!tombstone) throw new Error('Tâche absente ou inaccessible dans ce workspace.');
}

export async function listStockItems(workspaceId: WorkspaceId, establishmentId: string): Promise<StockItem[]> {
  const db = requireSupabase();
  const {data,error} = await db.from('stock_items').select('*').eq('workspace_id',workspaceId).eq('establishment_id',establishmentId).is('deleted_at',null).order('category');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({id:r.id,category:r.category,name:r.name,unit:r.unit,quantity:Number(r.quantity),minThreshold:Number(r.min_threshold),unitCost:Number(r.unit_cost),preferredSupplierId:r.preferred_supplier_id ?? undefined}));
}

export async function saveStockItem(workspaceId: WorkspaceId, establishmentId: string, i: StockItem) {
  const db = requireSupabase();
  return unwrap(await db.from('stock_items').upsert({id:i.id,workspace_id:workspaceId,establishment_id:establishmentId,category:i.category,name:i.name,unit:i.unit,quantity:i.quantity,min_threshold:i.minThreshold,unit_cost:i.unitCost,preferred_supplier_id:i.preferredSupplierId ?? null}).select().single());
}

export async function deleteStockItem(workspaceId: WorkspaceId, itemId: string): Promise<void> {
  if (!workspaceId.trim() || !itemId.trim()) throw new Error('Workspace et article stock requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('stock_items').update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', itemId).is('deleted_at', null).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;
  const { data: tombstone, error: verifyError } = await db.from('stock_items').select('id')
    .eq('workspace_id', workspaceId).eq('id', itemId).not('deleted_at', 'is', null).maybeSingle();
  if (verifyError) throw new Error(verifyError.message);
  if (!tombstone) throw new Error('Article stock absent ou inaccessible dans ce workspace.');
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


/** Workspace- and establishment-scoped supplier CRUD. Deletes are tombstones. */
export async function listStockSuppliers(workspaceId: WorkspaceId, establishmentId: string): Promise<StockSupplier[]> {
  if (!workspaceId.trim() || !establishmentId.trim()) throw new Error('Workspace et établissement requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('stock_suppliers').select('*')
    .eq('workspace_id', workspaceId).eq('establishment_id', establishmentId)
    .is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id, name: row.name, category: row.category,
    contactName: row.contact_name ?? undefined, phone: row.phone ?? undefined,
    email: row.email ?? undefined, preferredChannel: row.preferred_channel as StockSupplier['preferredChannel'],
    notes: row.notes ?? undefined,
  }));
}

export async function saveStockSupplier(workspaceId: WorkspaceId, establishmentId: string, supplier: StockSupplier) {
  if (!workspaceId.trim() || !establishmentId.trim() || !supplier.id.trim() || !supplier.name.trim()) {
    throw new Error('Workspace, établissement, identifiant et nom fournisseur obligatoires.');
  }
  const db = requireSupabase();
  return unwrap(await db.from('stock_suppliers').upsert({
    id: supplier.id, workspace_id: workspaceId, establishment_id: establishmentId,
    name: supplier.name.trim(), category: supplier.category.trim() || 'Général',
    contact_name: supplier.contactName ?? null, phone: supplier.phone ?? null,
    email: supplier.email ?? null, preferred_channel: supplier.preferredChannel,
    notes: supplier.notes ?? null, deleted_at: null,
  }).select().single());
}

export async function deleteStockSupplier(workspaceId: WorkspaceId, supplierId: string): Promise<void> {
  if (!workspaceId.trim() || !supplierId.trim()) throw new Error('Workspace et fournisseur requis.');
  const db = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await db.from('stock_suppliers').update({ deleted_at: now })
    .eq('workspace_id', workspaceId).eq('id', supplierId).is('deleted_at', null).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;
  const { data: tombstone, error: verifyError } = await db.from('stock_suppliers').select('id')
    .eq('workspace_id', workspaceId).eq('id', supplierId).not('deleted_at', 'is', null).maybeSingle();
  if (verifyError) throw new Error(verifyError.message);
  if (!tombstone) throw new Error('Fournisseur absent ou inaccessible dans ce workspace.');
}

/** Purchase-order CRUD retains the complete line snapshot in JSONB. */
export async function listPurchaseOrders(workspaceId: WorkspaceId, establishmentId: string): Promise<PurchaseOrderRecord[]> {
  if (!workspaceId.trim() || !establishmentId.trim()) throw new Error('Workspace et établissement requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('purchase_orders').select('*')
    .eq('workspace_id', workspaceId).eq('establishment_id', establishmentId)
    .is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id, orderNumber: row.order_number, createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined, sentAt: row.sent_at ?? undefined,
    sentVia: (row.sent_via ?? undefined) as PurchaseOrderRecord['sentVia'],
    receivedAt: row.received_at ?? undefined, supplierId: row.supplier_id ?? undefined,
    supplierName: row.supplier_name, supplierPhone: row.supplier_phone ?? undefined,
    supplierEmail: row.supplier_email ?? undefined, createdBy: row.created_by,
    status: row.status as PurchaseOrderRecord['status'], note: row.note ?? undefined,
    items: Array.isArray(row.items) ? row.items as unknown as PurchaseOrderRecord['items'] : [],
  }));
}

export async function savePurchaseOrder(workspaceId: WorkspaceId, establishmentId: string, order: PurchaseOrderRecord) {
  if (!workspaceId.trim() || !establishmentId.trim() || !order.id.trim() || !order.orderNumber.trim()) {
    throw new Error('Workspace, établissement, commande et numéro de commande obligatoires.');
  }
  if (!Array.isArray(order.items) || order.items.some((item) =>
    !item.itemId.trim() || !Number.isFinite(item.orderQty) || item.orderQty < 0
    || !Number.isFinite(item.unitCost) || item.unitCost < 0
  )) throw new Error('Lignes de commande invalides.');
  const db = requireSupabase();
  const payload: Database['public']['Tables']['purchase_orders']['Insert'] = {
    id: order.id, workspace_id: workspaceId, establishment_id: establishmentId,
    order_number: order.orderNumber, supplier_id: order.supplierId ?? null,
    supplier_name: order.supplierName, supplier_phone: order.supplierPhone ?? null,
    supplier_email: order.supplierEmail ?? null, created_by: order.createdBy,
    status: order.status, note: order.note ?? null, items: order.items as unknown as Json,
    confirmed_at: order.confirmedAt ?? null, sent_at: order.sentAt ?? null,
    sent_via: order.sentVia ?? null, received_at: order.receivedAt ?? null,
    created_at: order.createdAt, deleted_at: null,
  };
  return unwrap(await db.from('purchase_orders').upsert(payload).select().single());
}

export async function deletePurchaseOrder(workspaceId: WorkspaceId, orderId: string): Promise<void> {
  if (!workspaceId.trim() || !orderId.trim()) throw new Error('Workspace et commande requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('purchase_orders').update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', orderId).is('deleted_at', null).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;
  const { data: tombstone, error: verifyError } = await db.from('purchase_orders').select('id')
    .eq('workspace_id', workspaceId).eq('id', orderId).not('deleted_at', 'is', null).maybeSingle();
  if (verifyError) throw new Error(verifyError.message);
  if (!tombstone) throw new Error('Commande absente ou inaccessible dans ce workspace.');
}

/** Staff HR records are scoped to one physical establishment. */
export async function listStaffMembers(workspaceId: WorkspaceId, establishmentId: string): Promise<StaffMemberRecord[]> {
  if (!workspaceId.trim() || !establishmentId.trim()) throw new Error('Workspace et établissement requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('staff_members').select('*')
    .eq('workspace_id', workspaceId).eq('establishment_id', establishmentId)
    .is('deleted_at', null).order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id, fullName: row.full_name, phone: row.phone ?? undefined,
    roleId: row.role_id as StaffMemberRecord['roleId'], assignment: row.assignment,
    shift: row.shift as StaffMemberRecord['shift'],
    defaultTasks: Array.isArray(row.default_tasks) ? row.default_tasks as string[] : [],
    status: row.employment_status as StaffMemberRecord['status'],
    hiredAt: row.hired_at,
    history: Array.isArray(row.history) ? row.history as unknown as StaffMemberRecord['history'] : [],
  }));
}

export async function saveStaffMember(workspaceId: WorkspaceId, establishmentId: string, member: StaffMemberRecord) {
  if (!workspaceId.trim() || !establishmentId.trim() || !member.id.trim() || !member.fullName.trim()) {
    throw new Error('Workspace, établissement, identifiant et nom du membre du personnel obligatoires.');
  }
  const db = requireSupabase();
  const payload: Database['public']['Tables']['staff_members']['Insert'] = {
    id: member.id, workspace_id: workspaceId, establishment_id: establishmentId,
    full_name: member.fullName.trim(), phone: member.phone ?? null, role_id: member.roleId,
    assignment: member.assignment, shift: member.shift, default_tasks: member.defaultTasks,
    employment_status: member.status, hired_at: member.hiredAt,
    history: member.history as unknown as Json,
    deleted_at: null,
  };
  return unwrap(await db.from('staff_members').upsert(payload).select().single());
}

export async function deleteStaffMember(workspaceId: WorkspaceId, memberId: string): Promise<void> {
  if (!workspaceId.trim() || !memberId.trim()) throw new Error('Workspace et membre du personnel requis.');
  const db = requireSupabase();
  const { data, error } = await db.from('staff_members').update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', memberId).is('deleted_at', null).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;
  const { data: tombstone, error: verifyError } = await db.from('staff_members').select('id')
    .eq('workspace_id', workspaceId).eq('id', memberId).not('deleted_at', 'is', null).maybeSingle();
  if (verifyError) throw new Error(verifyError.message);
  if (!tombstone) throw new Error('Membre du personnel absent ou inaccessible dans ce workspace.');
}

/** Stock movements are append-only; retries must match the immutable original row. */
/** Apply the append-only movement and its stock projection in one PostgreSQL transaction. */
export async function saveStockMovement(workspaceId: WorkspaceId, establishmentId: string, movement: StockMovement): Promise<number> {
  if (!workspaceId.trim() || !establishmentId.trim() || !movement.id.trim() || !movement.itemId.trim()
    || !Number.isFinite(movement.delta) || movement.delta === 0 || !movement.reason.trim()) {
    throw new Error('Mouvement de stock invalide ou non rattaché à un établissement.');
  }
  const timestamp = new Date(
    movement.timestamp.includes('T') ? movement.timestamp : `${movement.timestamp.replace(' ', 'T')}Z`,
  );
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Horodatage du mouvement invalide.');
  const db = requireSupabase();
  const { data, error } = await db.rpc('apply_stock_movement', {
    p_workspace_id: workspaceId,
    p_establishment_id: establishmentId,
    p_movement_id: movement.id,
    p_item_id: movement.itemId,
    p_timestamp: timestamp.toISOString(),
    p_delta: movement.delta,
    p_reason: movement.reason.trim(),
    ...(movement.room ? { p_room: movement.room } : {}),
    ...(movement.user ? { p_actor_name: movement.user } : {}),
  });
  if (error) throw new Error(error.message);
  const quantity = Number(data);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Réponse invalide du registre de stock après application du mouvement.');
  }
  return quantity;
}

export async function listStockMovements(workspaceId: WorkspaceId, establishmentId: string): Promise<StockMovement[]> {
  if (!workspaceId.trim() || !establishmentId.trim()) throw new Error('Workspace et établissement requis.');
  const db = requireSupabase();
  const pageSize = 500;
  const rows: Array<{
    id: string; item_id: string; timestamp: string; delta: number; reason: string;
    room: string | null; actor_name: string | null; stock_items: { name: string } | null;
  }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db.from('stock_movements')
      .select('id,item_id,timestamp,delta,reason,room,actor_name,stock_items!stock_movements_item_tenant_fk(name)')
      .eq('workspace_id', workspaceId).eq('establishment_id', establishmentId)
      .order('timestamp', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if ((data ?? []).length < pageSize) break;
    offset += pageSize;
  }
  return rows.map((row) => ({
    id: row.id, itemId: row.item_id, itemName: row.stock_items?.name ?? row.item_id,
    timestamp: row.timestamp, delta: Number(row.delta), reason: row.reason,
    room: row.room ?? undefined, user: row.actor_name ?? '',
  }));
}

/** Profile fields live in establishments.settings so there is one canonical establishment row. */
export async function saveEstablishmentProfile(
  workspaceId: WorkspaceId,
  establishmentId: string,
  profile: EstablishmentProfile,
): Promise<void> {
  if (!workspaceId.trim() || !establishmentId.trim() || profile.id !== establishmentId || !profile.name.trim()) {
    throw new Error('Le profil doit référencer un établissement réel et nommé.');
  }
  const db = requireSupabase();
  const { data, error } = await db.from('establishments').select('settings')
    .eq('workspace_id', workspaceId).eq('id', establishmentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Établissement absent ou inaccessible dans ce workspace.');
  const settings = data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
    ? data.settings as Record<string, unknown> : {};
  const { error: updateError } = await db.from('establishments').update({
    settings: { ...settings, appointmentProfile: profile as unknown as Json } as unknown as Json,
  }).eq('workspace_id', workspaceId).eq('id', establishmentId);
  if (updateError) throw new Error(updateError.message);
}

export interface SupabaseEntityTombstone {
  entity: P2pEntity;
  entityId: string;
  establishmentId: string;
  deletedAt: string;
  remoteVersion: number;
}

/** Read only explicit server tombstones; absence from an active-row query is not a delete. */
export async function listWorkspaceEntityTombstones(workspaceId: WorkspaceId): Promise<SupabaseEntityTombstone[]> {
  if (!workspaceId.trim()) return [];
  const db = requireSupabase();
  const sources = [
    ['task', 'pms_tasks'],
    ['stock_item', 'stock_items'],
    ['supplier', 'stock_suppliers'],
    ['purchase_order', 'purchase_orders'],
    ['staff_member', 'staff_members'],
  ] as const;
  const pageSize = 500;
  const results = await Promise.all(sources.map(async ([entity, table]) => {
    const rows: SupabaseEntityTombstone[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await db.from(table).select('id,establishment_id,deleted_at,version')
        .eq('workspace_id', workspaceId).not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []).map((row) => ({
        entity, entityId: row.id, establishmentId: row.establishment_id,
        deletedAt: row.deleted_at as string, remoteVersion: Number(row.version),
      } satisfies SupabaseEntityTombstone)));
      if ((data ?? []).length < pageSize) break;
      offset += pageSize;
    }
    return rows;
  }));
  return results.flat().sort((a, b) => a.deletedAt.localeCompare(b.deletedAt) || a.entityId.localeCompare(b.entityId));
}

export async function listEstablishmentProfile(
  workspaceId: WorkspaceId,
  establishmentId: string,
): Promise<EstablishmentProfile | null> {
  if (!workspaceId.trim() || !establishmentId.trim()) return null;
  const db = requireSupabase();
  const { data, error } = await db.from('establishments').select('settings')
    .eq('workspace_id', workspaceId).eq('id', establishmentId).maybeSingle();
  if (error) throw new Error(error.message);
  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const profile = (settings as Record<string, unknown>).appointmentProfile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  return profile as EstablishmentProfile;
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
