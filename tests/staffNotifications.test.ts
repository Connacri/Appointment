import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_ROLES } from '../src/data/roles';
import { resolveRoleDefinition } from '../src/utils/rolePermissions';
import { deriveStaffNotifications } from '../src/utils/staffNotifications';
import type { PmsTask, ResourceItem, TimelineBooking } from '../src/types/booking';

const rooms: ResourceItem[] = [
  { id: 'r1', name: '101', type: 'Single', sector: 'hotel', pricePerDay: 90, housekeepingStatus: 'dirty', floor: '1' },
  { id: 'r2', name: '102', type: 'Double', sector: 'hotel', pricePerDay: 110, housekeepingStatus: 'clean', floor: '1' },
];

const tasks: PmsTask[] = [
  {
    id: 't_maint',
    room: '101',
    typeId: 'plm',
    typeName: 'Fuite lavabo',
    category: 'Maintenance',
    assignee: 'Karim',
    date: '2026-11-20',
    status: 'pending',
    priority: 'urgent',
  },
  {
    id: 't_clean_other',
    room: '102',
    typeId: 'clean',
    typeName: 'Nettoyage départ',
    category: 'Ménage',
    assignee: 'Sonia',
    date: '2026-11-20',
    status: 'pending',
    priority: 'urgent',
  },
  {
    id: 't_clean_mine',
    room: '101',
    typeId: 'linen',
    typeName: 'Changement draps',
    category: 'Linge',
    assignee: 'Amina',
    date: '2026-11-20',
    status: 'pending',
    priority: 'normal',
  },
  {
    id: 't_done',
    room: '102',
    typeId: 'clean',
    typeName: 'Recouche',
    category: 'Ménage',
    assignee: 'Amina',
    date: '2026-11-20',
    status: 'done',
    priority: 'normal',
    completedBy: 'Amina',
  },
];

const bookings: TimelineBooking[] = [
  {
    id: 'b1',
    resourceId: 'r2',
    resourceName: '102',
    sector: 'hotel',
    guestName: 'Client Test',
    guestEmail: '',
    guestPhone: '',
    startDate: '2026-11-19',
    endDate: '2026-11-21',
    status: 'checked_in',
    totalPrice: 220,
    paymentStatus: 'paid',
    guestAlerts: [
      { id: 'a_hk', text: 'Serviettes supplémentaires demandées', source: 'housekeeping', createdAt: '2026-11-20T09:00:00Z', createdBy: 'Gouvernante' },
      { id: 'a_rec', text: 'Facture entreprise demandée', source: 'reception', createdAt: '2026-11-20T09:30:00Z', createdBy: 'Réception' },
    ],
  },
];

test('deriveStaffNotifications scopes tasks & alerts for room_attendant and prioritizes personal/urgent items', () => {
  const roomAttendant = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');
  const notifs = deriveStaffNotifications({
    role: roomAttendant,
    tasks,
    rooms,
    bookings,
    language: 'fr',
    activeOperatorName: 'Amina',
  });

  // Excludes Maintenance and done tasks; excludes reception-only guest alert
  assert.equal(notifs.some((n) => n.taskId === 't_maint'), false);
  assert.equal(notifs.some((n) => n.taskId === 't_done'), false);
  assert.equal(notifs.some((n) => n.description.includes('Facture entreprise')), false);

  // Includes open housekeeping tasks, dirty room 101, and housekeeping alert
  assert.ok(notifs.some((n) => n.taskId === 't_clean_mine' && n.isMine === true));
  assert.ok(notifs.some((n) => n.taskId === 't_clean_other' && n.severity === 'urgent'));
  assert.ok(notifs.some((n) => n.kind === 'room_dirty' && n.roomLabel === '101'));
  assert.ok(notifs.some((n) => n.kind === 'guest_alert' && n.description.includes('Serviettes')));

  // Personal task appears first
  assert.equal(notifs[0]?.taskId, 't_clean_mine');

  // Client portal receives zero staff notifications
  const clientRole = resolveRoleDefinition(BUILT_IN_ROLES, 'client');
  assert.deepEqual(
    deriveStaffNotifications({
      role: clientRole,
      tasks,
      rooms,
      bookings,
      language: 'fr',
    }),
    []
  );
});

test('deriveStaffNotifications emits stock_rupture, stock_low, and purchase_order_draft only for stock-capable roles', () => {
  const manager = resolveRoleDefinition(BUILT_IN_ROLES, 'manager');
  const roomAttendant = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');

  const stockItems = [
    { id: 'stk1', name: 'Papier toilette', category: 'Hygiène', quantity: 0, minThreshold: 10, unit: 'rlx', unitCost: 50 },
    { id: 'stk2', name: 'Savon liquide', category: 'Accueil', quantity: 3, minThreshold: 5, unit: 'pcs', unitCost: 120 },
  ];
  const purchaseOrders = [
    {
      id: 'po1',
      orderNumber: 'CMD-202611-900',
      createdAt: '2026-11-20T09:00:00Z',
      createdBy: 'Gérant',
      supplierName: 'Fournisseur Oran',
      channel: 'whatsapp' as const,
      status: 'draft' as const,
      items: [{ itemId: 'stk1', itemName: 'Papier toilette', unit: 'rlx', currentQty: 0, minThreshold: 10, orderQty: 20, unitCost: 50 }],
    },
  ];

  const mgrNotifs = deriveStaffNotifications({
    role: manager,
    tasks: [],
    rooms: [],
    bookings: [],
    stockItems,
    purchaseOrders,
    language: 'fr',
  });

  assert.ok(mgrNotifs.some((n) => n.kind === 'stock_rupture' && n.severity === 'urgent' && n.targetView === 'stock'));
  assert.ok(mgrNotifs.some((n) => n.kind === 'stock_low' && n.targetView === 'stock'));
  assert.ok(mgrNotifs.some((n) => n.kind === 'purchase_order_draft' && n.purchaseOrderId === 'po1'));

  const raNotifs = deriveStaffNotifications({
    role: roomAttendant,
    tasks: [],
    rooms: [],
    bookings: [],
    stockItems,
    purchaseOrders,
    language: 'fr',
  });

  assert.equal(raNotifs.some((n) => n.kind === 'stock_rupture' || n.kind === 'stock_low' || n.kind === 'purchase_order_draft'), false);
});
