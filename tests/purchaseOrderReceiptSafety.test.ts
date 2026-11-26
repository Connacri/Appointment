import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPurchaseOrderReceiptPlan } from '../src/utils/purchaseOrderReceipt';
import type { PurchaseOrderRecord, StockItem } from '../src/types/booking';

const stock: StockItem[] = [
  { id: 'soap', category: 'Produits de bain', name: 'Savon', unit: 'pièce', quantity: 4, minThreshold: 2, unitCost: 20 },
  { id: 'water', category: 'Minibar', name: 'Eau', unit: 'bouteille', quantity: 10, minThreshold: 3, unitCost: 30 },
];
const order: PurchaseOrderRecord = {
  id: 'po-1',
  orderNumber: 'CMD-202611-001',
  createdAt: '2026-11-26T10:00:00.000Z',
  supplierName: 'Fournisseur',
  createdBy: 'Admin',
  status: 'confirmed',
  items: [
    { itemId: 'soap', itemName: 'Savon', unit: 'pièce', currentQty: 4, minThreshold: 2, orderQty: 5, unitCost: 20 },
    { itemId: 'soap', itemName: 'Savon', unit: 'pièce', currentQty: 4, minThreshold: 2, orderQty: 2, unitCost: 20 },
    { itemId: 'water', itemName: 'Eau', unit: 'bouteille', currentQty: 10, minThreshold: 3, orderQty: 3, unitCost: 30 },
  ],
};

test('purchase receipt aggregates duplicate lines and emits matching stock movements', () => {
  const plan = buildPurchaseOrderReceiptPlan(order, stock, 'Admin', '2026-11-26T12:00:00.000Z', () => 'movement-id');
  assert.equal(plan.purchaseOrder.status, 'received');
  assert.equal(plan.purchaseOrder.receivedAt, '2026-11-26T12:00:00.000Z');
  assert.equal(plan.stockItems.find((item) => item.id === 'soap')?.quantity, 11);
  assert.equal(plan.stockItems.find((item) => item.id === 'water')?.quantity, 13);
  assert.deepEqual(plan.movements.map((movement) => [movement.itemId, movement.delta]), [['soap', 7], ['water', 3]]);
  assert.equal(plan.mutations.length, 5);
  assert.equal(plan.mutations.filter((mutation) => mutation.entity === 'stock_movement').length, 2);
  assert.deepEqual(new Set(plan.mutations.map((mutation) => mutation.entity)), new Set(['purchase_order', 'stock_item', 'stock_movement']));
});

test('purchase receipt rejects missing stock items and invalid quantities', () => {
  assert.throws(() => buildPurchaseOrderReceiptPlan(order, stock.filter((item) => item.id !== 'soap'), 'Admin', '2026-11-26T12:00:00.000Z', () => 'm'), /n’existe plus/);
  const invalid = { ...order, items: [{ ...order.items[0], orderQty: 0 }] };
  assert.throws(() => buildPurchaseOrderReceiptPlan(invalid, stock, 'Admin', '2026-11-26T12:00:00.000Z', () => 'm'), /Quantité commandée invalide/);
});

test('purchase receipt rejects an already received order', () => {
  assert.throws(() => buildPurchaseOrderReceiptPlan({ ...order, status: 'received' }, stock, 'Admin', '2026-11-26T12:00:00.000Z', () => 'm'), /confirmées ou envoyées/);
});
