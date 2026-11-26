import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StockItem } from '../src/types/booking';
import {
  buildStockDeltaMutations,
  buildStockItemCreationMutations,
  buildStockItemUpdateMutations,
} from '../src/utils/stockTransactions';

const soap: StockItem = {
  id: 'soap', category: 'Produits de bain', name: 'Savon', unit: 'pièce',
  quantity: 10, minThreshold: 2, unitCost: 20,
};

test('stock delta updates the latest projection but keeps the cloud base quantity unchanged', () => {
  const [itemMutation, movementMutation] = buildStockDeltaMutations({
    item: soap, delta: -3, reason: 'Sortie chambre', actor: 'Admin',
    timestamp: '2026-11-26T12:00:00.000Z', movementId: 'movement-1', room: '101',
  });
  const latest = { ...soap, quantity: 15 };
  const batch = new Map([['stock_item:soap', latest as unknown as Record<string, unknown>]]);
  assert.equal(itemMutation.applyToCurrent?.(latest as unknown as Record<string, unknown>, batch).quantity, 12);
  assert.equal(itemMutation.toOutboxPayload?.(latest as unknown as Record<string, unknown>, batch).quantity, 15);
  assert.equal(itemMutation.skipOutbox, true);
  const movement = movementMutation.applyToCurrent?.(undefined, batch);
  assert.equal(movement?.itemName, 'Savon');
  assert.equal(movement?.delta, -3);
  assert.equal(movement?.room, '101');
});

test('stock delta rejects insufficient persisted quantity', () => {
  const [itemMutation] = buildStockDeltaMutations({
    item: soap, delta: -11, reason: 'Sortie', actor: 'Admin',
    timestamp: '2026-11-26T12:00:00.000Z', movementId: 'movement-2',
  });
  assert.throws(
    () => itemMutation.applyToCurrent?.({ id: 'soap', quantity: 10 }),
    /Stock insuffisant/,
  );
});

test('physical inventory adjustment uses latest quantity and skips a zero-delta movement', () => {
  const updated = { ...soap, name: 'Savon hôtelier', quantity: 12 };
  const [, movementMutation] = buildStockItemUpdateMutations({
    updatedItem: updated, currentItem: soap, actor: 'Admin',
    timestamp: '2026-11-26T12:00:00.000Z', movementId: 'movement-3',
  });
  const batch = new Map([['stock_item:soap', { id: 'soap', quantity: 15 }]]);
  assert.equal(movementMutation.applyToCurrent?.(undefined, batch).delta, -3);
  assert.equal(movementMutation.skipIfCurrent?.(undefined, new Map([['stock_item:soap', { id: 'soap', quantity: 12 }] ])), true);
});

test('new stock item and opening movement use separate local and cloud quantities', () => {
  const item = { ...soap, id: 'new-soap', quantity: 5 };
  const [itemMutation, movementMutation] = buildStockItemCreationMutations(
    item, 'Admin', '2026-11-26T12:00:00.000Z', 'movement-4',
  );
  assert.equal(itemMutation.applyToCurrent?.().quantity, 5);
  assert.equal(itemMutation.toOutboxPayload?.().quantity, 0);
  assert.equal(movementMutation.applyToCurrent?.(undefined, new Map([
    ['stock_item:new-soap', item as unknown as Record<string, unknown>],
  ])).delta, 5);
});
