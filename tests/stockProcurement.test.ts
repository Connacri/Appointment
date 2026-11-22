import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyStockDeductions,
  buildRecommendedOrderItems,
  buildSupplierDispatchUrl,
  formatSupplierOrderMessage,
  normalizePhoneForWhatsApp,
} from '../src/utils/stockProcurement';
import type { PurchaseOrderRecord, StockItem } from '../src/types/booking';

const sampleStock: StockItem[] = [
  { id: 's1', name: 'Savon solide', category: 'Accueil', quantity: 5, minThreshold: 4, unit: 'pcs', unitCost: 80 },
  { id: 's2', name: 'Eau minérale 50cl', category: 'Minibar', quantity: 2, minThreshold: 6, unit: 'btl', unitCost: 45 },
  { id: 's3', name: 'Serviette bain', category: 'Linge', quantity: 20, minThreshold: 5, unit: 'pcs', unitCost: 900 },
];

test('applyStockDeductions deducts atomically, clamps at 0, and detects low stock & ruptures', () => {
  const result = applyStockDeductions(sampleStock, [
    { itemId: 's1', quantity: 2 }, // 5 -> 3 (<= 4 => lowStock)
    { itemId: 's2', quantity: 5 }, // 2 -> 0 (clamped => lowStock + ruptured)
    { itemId: 's3', quantity: 3 }, // 20 -> 17 (> 5 => ok)
  ]);

  assert.equal(result.appliedLines.length, 3);
  assert.equal(result.updatedStockItems.find((i) => i.id === 's1')?.quantity, 3);
  assert.equal(result.updatedStockItems.find((i) => i.id === 's2')?.quantity, 0);
  assert.equal(result.updatedStockItems.find((i) => i.id === 's3')?.quantity, 17);

  assert.deepEqual(
    result.lowStockTriggered.map((i) => i.id),
    ['s1', 's2']
  );
  assert.deepEqual(
    result.rupturedItems.map((i) => i.id),
    ['s2']
  );
});

test('buildRecommendedOrderItems targets items at or below minThreshold with positive orderQty', () => {
  const items: StockItem[] = [
    { id: 'a', name: 'Gel douche', category: 'Accueil', quantity: 0, minThreshold: 5, unit: 'pcs', unitCost: 120 },
    { id: 'b', name: 'Draps', category: 'Linge', quantity: 10, minThreshold: 10, unit: 'pcs', unitCost: 1500 },
    { id: 'c', name: 'Ampoule LED', category: 'Maintenance', quantity: 12, minThreshold: 4, unit: 'pcs', unitCost: 300 },
  ];

  const orderItems = buildRecommendedOrderItems(items);
  assert.deepEqual(
    orderItems.map((i) => i.itemId),
    ['a', 'b']
  );
  assert.ok(orderItems.every((i) => i.orderQty >= 1));
  assert.equal(orderItems[0].orderQty, 10); // max(10, 10, 10) - 0
  assert.equal(orderItems[1].orderQty, 10); // max(20, 15, 10) - 10
});

test('normalizePhoneForWhatsApp & buildSupplierDispatchUrl generate valid WhatsApp, Email, and SMS URLs', () => {
  assert.equal(normalizePhoneForWhatsApp('+213 550 12 34 56'), '213550123456');
  assert.equal(normalizePhoneForWhatsApp('00213-550-12-34-56'), '213550123456');

  const waUrl = buildSupplierDispatchUrl({
    channel: 'whatsapp',
    phone: '+213 550 12 34 56',
    subject: 'CMD-001',
    message: 'Bonjour fournisseur',
  });
  assert.ok(waUrl?.startsWith('https://wa.me/213550123456?text='));

  const mailUrl = buildSupplierDispatchUrl({
    channel: 'email',
    email: 'orders@supplier.dz',
    subject: 'Bon de commande',
    message: 'Détails commande',
  });
  assert.ok(mailUrl?.startsWith('mailto:orders%40supplier.dz?subject='));

  const smsUrl = buildSupplierDispatchUrl({
    channel: 'sms',
    phone: '+213550123456',
    subject: 'CMD',
    message: 'Urgent',
  });
  assert.ok(smsUrl?.startsWith('sms:+213550123456?body='));
});

test('formatSupplierOrderMessage formats trilingual purchase orders accurately', () => {
  const order: Pick<PurchaseOrderRecord, 'orderNumber' | 'supplierName' | 'items' | 'note' | 'createdAt'> = {
    orderNumber: 'CMD-202611-101',
    supplierName: 'Oran Hygiène SARL',
    createdAt: '2026-11-20T10:00:00Z',
    note: 'Livraison matin souhaitée',
    items: [
      { itemId: 's1', itemName: 'Savon solide', unit: 'pcs', currentQty: 0, minThreshold: 5, orderQty: 20, unitCost: 80 },
    ],
  };

  const frMsg = formatSupplierOrderMessage({ order, establishmentName: 'Hôtel Horizon', currency: 'DA', language: 'fr' });
  assert.match(frMsg, /BON DE COMMANDE CMD-202611-101/);
  assert.match(frMsg, /Hôtel Horizon/);
  assert.match(frMsg, /Oran Hygiène SARL/);
  assert.match(frMsg, /Savon solide — 20 pcs/);
  assert.match(frMsg, /1.?600 DA/);

  const arMsg = formatSupplierOrderMessage({ order, establishmentName: 'فندق الأفق', currency: 'دج', language: 'ar' });
  assert.match(arMsg, /طلب شراء رقم CMD-202611-101/);
});
