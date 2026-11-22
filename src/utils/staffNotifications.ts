import type { Language, PmsTask, PurchaseOrderRecord, ResourceItem, StockItem, TimelineBooking } from '../types/booking';
import type { AppTabId, RoleDefinition } from '../types/roles';

export type StaffNotificationSeverity = 'urgent' | 'action' | 'info';
export type StaffNotificationKind =
  | 'task_urgent'
  | 'task_pending'
  | 'task_doing'
  | 'room_dirty'
  | 'room_cleaning'
  | 'guest_alert'
  | 'stock_rupture'
  | 'stock_low'
  | 'purchase_order_draft';

export interface StaffNotification {
  id: string;
  kind: StaffNotificationKind;
  severity: StaffNotificationSeverity;
  title: string;
  description: string;
  roomLabel: string;
  assignee?: string;
  isMine: boolean;
  targetView: AppTabId;
  taskId?: string;
  resourceId?: string;
  stockItemId?: string;
  purchaseOrderId?: string;
  timestamp: string;
}

export const READ_NOTIFS_STORAGE_KEY = 'omnibook_read_staff_notifs_v1';

export function loadReadNotificationIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(ids: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {
    // Ignore storage quota issues
  }
}

function normalizeName(v?: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isTaskRelevantToRole(task: PmsTask, role: RoleDefinition): boolean {
  if (role.category === 'management' || role.category === 'front_office' || role.id === 'gouvernante') {
    return true;
  }
  if (role.category === 'housekeeping') {
    return task.category !== 'Maintenance';
  }
  if (role.category === 'maintenance') {
    return task.category === 'Maintenance';
  }
  if (role.id === 'room_service') {
    return task.category === 'Livraison' || task.category === 'Minibar & accueil';
  }
  return true;
}

export interface DeriveStaffNotificationsInput {
  role: RoleDefinition;
  tasks: PmsTask[];
  rooms: ResourceItem[];
  bookings: TimelineBooking[];
  stockItems?: StockItem[];
  purchaseOrders?: PurchaseOrderRecord[];
  language: Language;
  activeOperatorName?: string;
}

export function deriveStaffNotifications(input: DeriveStaffNotificationsInput): StaffNotification[] {
  const { role, tasks, rooms, bookings, stockItems = [], purchaseOrders = [], language, activeOperatorName } = input;
  if (role.permissions.isClientPortal) return [];

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);
  const normOp = normalizeName(activeOperatorName);
  const todayStr = new Date().toISOString().slice(0, 10);

  const items: StaffNotification[] = [];

  // 1. Open tasks relevant to the role
  if (role.allowedTabs.includes('tasks') || role.permissions.canManageTasks) {
    for (const task of tasks) {
      if (task.status === 'done' || task.status === 'cancel') continue;
      if (!isTaskRelevantToRole(task, role)) continue;

      const isMine = Boolean(normOp && normalizeName(task.assignee).includes(normOp));
      const isUrgent = task.priority === 'urgent';
      const kind: StaffNotificationKind = isUrgent
        ? 'task_urgent'
        : task.status === 'doing'
        ? 'task_doing'
        : 'task_pending';

      items.push({
        id: `notif_task_${task.id}_${task.status}_${task.priority}`,
        kind,
        severity: isUrgent ? 'urgent' : 'action',
        title: isUrgent
          ? `${t('Tâche urgente', 'Urgent task', 'مهمة عاجلة')} · ${task.room}`
          : task.status === 'doing'
          ? `${t('En cours', 'In progress', 'قيد التنفيذ')} · ${task.room}`
          : `${t('Nouvelle tâche', 'Assigned task', 'مهمة مسندة')} · ${task.room}`,
        description: `${task.typeName}${task.assignee ? ` — ${task.assignee}` : ''}`,
        roomLabel: task.room,
        assignee: task.assignee,
        isMine,
        targetView: 'tasks',
        taskId: task.id,
        timestamp: task.date,
      });
    }
  }

  // 2. Rooms awaiting cleaning or currently being cleaned
  if (role.allowedTabs.includes('housekeeping') || role.permissions.canManageHousekeeping) {
    for (const room of rooms) {
      if (room.housekeepingStatus === 'dirty') {
        items.push({
          id: `notif_room_dirty_${room.id}`,
          kind: 'room_dirty',
          severity: 'urgent',
          title: `${t('Chambre à nettoyer', 'Room needs cleaning', 'غرفة تحتاج تنظيف')} · ${room.name}`,
          description: `${room.type}${room.floor ? ` · ${t('Étage', 'Floor', 'طابق')} ${room.floor}` : ''}`,
          roomLabel: room.name,
          isMine: false,
          targetView: 'housekeeping',
          resourceId: room.id,
          timestamp: todayStr,
        });
      } else if (room.housekeepingStatus === 'cleaning') {
        items.push({
          id: `notif_room_cleaning_${room.id}`,
          kind: 'room_cleaning',
          severity: 'info',
          title: `${t('Nettoyage en cours', 'Cleaning in progress', 'التنظيف جارٍ')} · ${room.name}`,
          description: `${room.type}${room.floor ? ` · ${t('Étage', 'Floor', 'طابق')} ${room.floor}` : ''}`,
          roomLabel: room.name,
          isMine: false,
          targetView: 'housekeeping',
          resourceId: room.id,
          timestamp: todayStr,
        });
      }
    }
  }

  // 3. Guest alerts relevant to housekeeping / operations
  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    for (const alert of booking.guestAlerts || []) {
      const relevant =
        role.category === 'management' ||
        role.category === 'front_office' ||
        role.id === 'gouvernante' ||
        alert.source === 'housekeeping';
      if (!relevant) continue;

      const targetView: AppTabId = role.allowedTabs.includes('lost_property')
        ? 'lost_property'
        : role.allowedTabs.includes('tasks')
        ? 'tasks'
        : role.allowedTabs[0] || 'tasks';

      items.push({
        id: `notif_alert_${booking.id}_${alert.id}`,
        kind: 'guest_alert',
        severity: 'action',
        title: `${t('Alerte chambre', 'Room alert', 'تنبيه غرفة')} · ${booking.resourceName}`,
        description: alert.text,
        roomLabel: booking.resourceName,
        assignee: alert.createdBy,
        isMine: false,
        targetView,
        timestamp: alert.createdAt.slice(0, 10),
      });
    }
  }

  // 4. Stock rupture / low-stock alerts & pending orders for stock-managing roles
  if (role.permissions.canManageStock || role.allowedTabs.includes('stock')) {
    for (const item of stockItems) {
      if (item.quantity === 0) {
        items.push({
          id: `notif_stock_rupture_${item.id}_${item.quantity}`,
          kind: 'stock_rupture',
          severity: 'urgent',
          title: `${t('Rupture de stock — À commander', 'Out of stock — Reorder now', 'نفاد المخزون — يجب الطلب')} · ${item.name}`,
          description: `${item.category} · 0 ${item.unit} (${t('seuil', 'min', 'الحد')}: ${item.minThreshold}) — ${t('Cliquer pour lancer la commande', 'Click to launch order', 'انقر لإصدار طلب الشراء')}`,
          roomLabel: item.category,
          isMine: false,
          targetView: 'stock',
          stockItemId: item.id,
          timestamp: todayStr,
        });
      } else if (item.quantity <= item.minThreshold) {
        items.push({
          id: `notif_stock_low_${item.id}_${item.quantity}`,
          kind: 'stock_low',
          severity: 'action',
          title: `${t('Stock bas à commander', 'Low stock — Reorder', 'مخزون منخفض للطلب')} · ${item.name}`,
          description: `${item.quantity} ${item.unit} (${t('seuil', 'min', 'الحد')}: ${item.minThreshold}) — ${t('Éditer & confirmer commande', 'Edit & confirm order', 'تعديل وتأكيد الطلب')}`,
          roomLabel: item.category,
          isMine: false,
          targetView: 'stock',
          stockItemId: item.id,
          timestamp: todayStr,
        });
      }
    }

    for (const po of purchaseOrders) {
      if (po.status === 'draft' || po.status === 'confirmed') {
        items.push({
          id: `notif_po_${po.id}_${po.status}`,
          kind: 'purchase_order_draft',
          severity: 'action',
          title:
            po.status === 'draft'
              ? `${t('Commande brouillon à confirmer', 'Draft order to confirm', 'مسودة طلب للتأكيد')} · ${po.orderNumber}`
              : `${t('Commande confirmée à envoyer', 'Confirmed order ready to send', 'طلب مؤكد جاهز للإرسال')} · ${po.orderNumber}`,
          description: `${po.supplierName} · ${po.items.length} ${t('article(s)', 'item(s)', 'أصناف')}`,
          roomLabel: po.supplierName,
          isMine: false,
          targetView: 'stock',
          purchaseOrderId: po.id,
          timestamp: po.createdAt.slice(0, 10),
        });
      }
    }
  }

  const severityRank: Record<StaffNotificationSeverity, number> = {
    urgent: 0,
    action: 1,
    info: 2,
  };

  return items.sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.timestamp.localeCompare(a.timestamp);
  });
}
