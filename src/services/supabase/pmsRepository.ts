import { requireSupabase } from './supabaseClient';
import type { TimelineBooking, ResourceGroup, ResourceItem, HotelEstablishment, PmsTask, StockItem, StockMovement } from '../../types/booking';

type WorkspaceId = string;
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data.');
  return result.data;
}

export async function createWorkspace(name: string) {
  // Workspaces table insertion bypassed per user requirement to avoid RLS violations
  return { id: 'default_workspace', name };
}

export async function listWorkspaces() {
  const db = requireSupabase();
  try {
    const { data, error } = await db.from('workspaces').select('id,name,owner_id,workspace_members!inner(role)').order('created_at');
    if (error) {
      console.warn('[Supabase] Could not list workspaces:', error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export async function listEstablishments(workspaceId: WorkspaceId): Promise<HotelEstablishment[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('establishments').select('*').eq('workspace_id', workspaceId).eq('is_active', true).is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id:r.id, code:r.code, name:r.name, city:r.city ?? '', stars:r.stars, taxRate:Number(r.tax_rate), checkInTime:r.check_in_time.slice(0,5), checkOutTime:r.check_out_time.slice(0,5), facilities:r.facilities ?? [] }));
}

export async function saveEstablishment(workspaceId: WorkspaceId, item: HotelEstablishment & { domain?: 'hotel'|'resort'; currency?: string }) {
  const db = requireSupabase();
  return unwrap(await db.from('establishments').upsert({ id:item.id, workspace_id:workspaceId, code:item.code, name:item.name, city:item.city, stars:item.stars, tax_rate:item.taxRate, check_in_time:item.checkInTime, check_out_time:item.checkOutTime, facilities:item.facilities, domain:item.domain ?? 'hotel', currency:item.currency ?? 'DZD' }).select().single());
}

export async function listResourceGroups(workspaceId: WorkspaceId, establishmentId?: string): Promise<ResourceGroup[]> {
  const db = requireSupabase();
  let q = db.from('resource_groups').select('*,resources(*)').eq('workspace_id',workspaceId).is('deleted_at',null).order('sort_order');
  if (establishmentId) q = q.eq('establishment_id',establishmentId);
  const {data,error} = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((g:any)=>({id:g.id,name:g.name,sector:g.domain,icon:g.icon ?? undefined,resources:(g.resources ?? []).map((r:any)=>({id:r.id,name:r.name,type:r.resource_type,sector:r.domain,pricePerDay:Number(r.price_per_day),housekeepingStatus:r.housekeeping_status,capacity:r.capacity ?? undefined,building:r.building ?? undefined,floor:r.floor ?? undefined,view:r.view ?? undefined,beds:r.beds ?? undefined,sizeM2:r.size_m2===null?undefined:Number(r.size_m2),amenities:r.amenities ?? [],establishmentId:r.establishment_id}))}));
}

export async function saveResourceGroup(workspaceId: WorkspaceId, establishmentId: string, group: ResourceGroup) {
  const db = requireSupabase();
  unwrap(await db.from('resource_groups').upsert({id:group.id,workspace_id:workspaceId,establishment_id:establishmentId,name:group.name,domain:group.sector,icon:group.icon ?? null}).select().single());
  for (const r of group.resources) await saveResource(workspaceId,establishmentId,group.id,r);
}

export async function saveResource(workspaceId: WorkspaceId, establishmentId: string, groupId: string|null, item: ResourceItem) {
  const db = requireSupabase();
  return unwrap(await db.from('resources').upsert({id:item.id,workspace_id:workspaceId,establishment_id:establishmentId,group_id:groupId,name:item.name,resource_type:item.type,domain:item.sector,price_per_day:item.pricePerDay,capacity:item.capacity ?? null,housekeeping_status:item.housekeepingStatus ?? 'clean',building:item.building ?? null,floor:item.floor ?? null,view:item.view ?? null,beds:item.beds ?? null,size_m2:item.sizeM2 ?? null,amenities:item.amenities ?? []}).select().single());
}

export async function listBookings(workspaceId: WorkspaceId, establishmentId?: string): Promise<TimelineBooking[]> {
  const db = requireSupabase();
  let q = db.from('bookings').select('*').eq('workspace_id',workspaceId).is('deleted_at',null).order('start_date');
  if (establishmentId) q = q.eq('establishment_id',establishmentId);
  const {data,error} = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r:any)=>({id:r.id,resourceId:r.resource_id,resourceName:r.resource_name,sector:r.domain,guestName:r.guest_name,guestEmail:r.guest_email ?? '',guestPhone:r.guest_phone ?? '',startDate:r.start_date,endDate:r.end_date,status:r.status,totalPrice:Number(r.total_price),paymentStatus:r.payment_status,notes:r.notes ?? undefined,adults:r.adults,children:r.children,mealPlan:r.meal_plan ?? undefined,originChannel:r.origin_channel ?? undefined,extras:r.extras ?? [],occupantsList:r.occupants ?? [],customMetadata:r.guest_metadata ?? {}}));
}

export async function saveBooking(workspaceId: WorkspaceId, establishmentId: string, b: TimelineBooking) {
  const db = requireSupabase();
  const {data:auth} = await db.auth.getUser();
  return unwrap(await db.from('bookings').upsert({id:b.id,workspace_id:workspaceId,establishment_id:establishmentId,resource_id:b.resourceId,domain:b.sector,resource_name:b.resourceName,guest_name:b.guestName,guest_email:b.guestEmail || null,guest_phone:b.guestPhone || null,start_date:b.startDate,end_date:b.endDate,status:b.status,total_price:b.totalPrice,payment_status:b.paymentStatus,adults:b.adults ?? 1,children:b.children ?? 0,notes:b.notes ?? null,meal_plan:b.mealPlan ?? null,origin_channel:b.originChannel ?? null,extras:b.extras ?? [],occupants:b.occupantsList ?? [],guest_metadata:b.customMetadata ?? {},created_by:auth.user?.id ?? null}).select().single());
}

export async function deleteBooking(id: string) {
  const db = requireSupabase();
  const {error} = await db.from('bookings').update({deleted_at:new Date().toISOString()}).eq('id',id);
  if (error) throw new Error(error.message);
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

export async function syncCardLockMdbToSupabase(
  groups: ResourceGroup[],
  bookingsList: TimelineBooking[]
): Promise<{ groupsCount: number; resourcesCount: number; bookingsCount: number }> {
  const db = requireSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('Authentification Supabase requise pour la synchronisation cloud.');

  let wsId = 'default_workspace';
  try {
    const workspaces = await listWorkspaces();
    if (workspaces[0]?.id) wsId = workspaces[0].id;
  } catch {
    wsId = 'default_workspace';
  }

  // Ensure default establishment exists
  const establishments = await listEstablishments(wsId);
  let estId = establishments[0]?.id;
  if (!estId) {
    estId = 'adef_cv';
    await saveEstablishment(wsId, {
      id: estId,
      code: 'HTL-ORAN',
      name: 'Appointment Hotel & Resort',
      city: 'Oran',
      stars: 4,
      taxRate: 19,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      facilities: ['WiFi', 'Parking', 'Climatisation', 'proUSB'],
      domain: 'hotel',
      currency: 'DZD',
    });
  }

  let totalResources = 0;
  for (const group of groups) {
    await saveResourceGroup(wsId, estId, group);
    totalResources += group.resources.length;
  }

  for (const booking of bookingsList) {
    await saveBooking(wsId, estId, booking);
  }

  return {
    groupsCount: groups.length,
    resourcesCount: totalResources,
    bookingsCount: bookingsList.length,
  };
}
