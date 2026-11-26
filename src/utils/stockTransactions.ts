import type { StockItem, StockMovement } from '../types/booking';

export type StockCurrentBatch = ReadonlyMap<string, Record<string, unknown>>;

export interface StockAtomicMutation {
  entity: 'stock_item' | 'stock_movement';
  entityId: string;
  payload: Record<string, unknown>;
  applyToCurrent?: (currentPayload?: Record<string, unknown>, currentBatch?: StockCurrentBatch) => Record<string, unknown>;
  toOutboxPayload?: (currentPayload?: Record<string, unknown>, currentBatch?: StockCurrentBatch) => Record<string, unknown>;
  skipIfCurrent?: (currentPayload?: Record<string, unknown>, currentBatch?: StockCurrentBatch) => boolean;
  skipOutbox?: boolean;
}

export const stockMutationKey = (entity: StockAtomicMutation['entity'], entityId: string) =>
  `${entity}:${entityId}`;

function latestStockItem(fallback: StockItem, currentPayload?: Record<string, unknown>, currentBatch?: StockCurrentBatch): StockItem {
  const current = currentBatch?.get(stockMutationKey('stock_item', fallback.id)) ?? currentPayload;
  const item = { ...fallback, ...(current ?? {}) } as StockItem;
  if (item.id !== fallback.id || !Number.isFinite(item.quantity) || item.quantity < 0) {
    throw new Error(`Projection de stock invalide pour ${fallback.name}.`);
  }
  return item;
}

function createMovementMutation(
  movement: StockMovement,
  fallbackItem: StockItem,
  resolveDelta: (currentItem: StockItem) => number = () => movement.delta,
): StockAtomicMutation {
  return {
    entity: 'stock_movement',
    entityId: movement.id,
    payload: movement as unknown as Record<string, unknown>,
    applyToCurrent: (_current, currentBatch) => {
      const item = latestStockItem(fallbackItem, undefined, currentBatch);
      const delta = resolveDelta(item);
      if (!Number.isFinite(delta) || delta === 0) throw new Error(`Variation de stock invalide pour ${item.name}.`);
      return { ...movement, itemName: item.name, delta } as unknown as Record<string, unknown>;
    },
  };
}

/** Cloud stock rows retain their pre-movement quantity; the movement RPC applies the delta once.
 * P2P receives the final local stock projection and the append-only movement record.
 */
export function buildStockDeltaMutations(input: {
  item: StockItem; delta: number; reason: string; actor: string; timestamp: string; movementId: string; room?: string;
}): StockAtomicMutation[] {
  const { item, delta, reason, actor, timestamp, movementId, room } = input;
  if (!item.id.trim() || !item.name.trim() || !Number.isFinite(item.quantity) || item.quantity < 0) {
    throw new Error('Article ou projection de stock invalide.');
  }
  if (!movementId.trim() || !Number.isFinite(delta) || delta === 0) throw new Error('Identifiant ou variation de stock invalide.');
  if (!reason.trim() || !actor.trim() || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error('Motif, opérateur et horodatage sont obligatoires pour un mouvement de stock.');
  }
  const movement: StockMovement = {
    id: movementId, timestamp, itemId: item.id, itemName: item.name, delta,
    reason: reason.trim(), room, user: actor.trim(),
  };
  return [
    {
      entity: 'stock_item', entityId: item.id, payload: item as unknown as Record<string, unknown>,
      applyToCurrent: (current, batch) => {
        const latest = latestStockItem(item, current, batch);
        const quantity = latest.quantity + delta;
        if (!Number.isFinite(quantity) || quantity < 0) {
          throw new Error(`Stock insuffisant pour ${latest.name} : disponible ${latest.quantity}, demandé ${Math.abs(delta)}.`);
        }
        return { ...latest, quantity } as unknown as Record<string, unknown>;
      },
      toOutboxPayload: (current, batch) => latestStockItem(item, current, batch) as unknown as Record<string, unknown>,
      skipOutbox: true,
    },
    createMovementMutation(movement, item),
  ];
}

/** Physical-count updates calculate the ledger delta from the latest committed quantity. */
export function buildStockItemUpdateMutations(input: {
  updatedItem: StockItem; currentItem: StockItem; actor: string; timestamp: string; movementId: string;
}): StockAtomicMutation[] {
  const { updatedItem, currentItem, actor, timestamp, movementId } = input;
  if (!updatedItem.id.trim() || !updatedItem.name.trim() || !updatedItem.unit.trim()
    || updatedItem.quantity < 0 || !Number.isFinite(updatedItem.quantity)
    || updatedItem.minThreshold < 0 || !Number.isFinite(updatedItem.minThreshold)
    || updatedItem.unitCost < 0 || !Number.isFinite(updatedItem.unitCost)) {
    throw new Error('Données article ou quantités invalides.');
  }
  if (!actor.trim() || !Number.isFinite(Date.parse(timestamp))) throw new Error('Opérateur ou horodatage invalide.');
  const movement: StockMovement = {
    id: movementId, timestamp, itemId: updatedItem.id, itemName: updatedItem.name,
    delta: updatedItem.quantity - currentItem.quantity, reason: 'Ajustement inventaire', user: actor.trim(),
  };
  return [
    {
      entity: 'stock_item', entityId: updatedItem.id, payload: updatedItem as unknown as Record<string, unknown>,
      applyToCurrent: (current, batch) => {
        const latest = latestStockItem(currentItem, current, batch);
        return { ...latest, ...updatedItem, quantity: updatedItem.quantity } as unknown as Record<string, unknown>;
      },
      toOutboxPayload: (current, batch) => {
        const latest = latestStockItem(currentItem, current, batch);
        return { ...latest, ...updatedItem, quantity: latest.quantity } as unknown as Record<string, unknown>;
      },
    },
    {
      ...createMovementMutation(movement, currentItem, (latest) => updatedItem.quantity - latest.quantity),
      skipIfCurrent: (_current, batch) => updatedItem.quantity === latestStockItem(currentItem, undefined, batch).quantity,
    },
  ];
}

/** New item and opening movement are atomic; remote stock starts at zero before the movement RPC. */
export function buildStockItemCreationMutations(item: StockItem, actor: string, timestamp: string, movementId: string): StockAtomicMutation[] {
  if (!item.id.trim() || !item.name.trim() || !item.unit.trim()
    || !Number.isFinite(item.quantity) || item.quantity < 0
    || !Number.isFinite(item.minThreshold) || item.minThreshold < 0
    || !Number.isFinite(item.unitCost) || item.unitCost < 0) {
    throw new Error('Données du nouvel article invalides.');
  }
  if (!actor.trim() || !Number.isFinite(Date.parse(timestamp)) || !movementId.trim()) {
    throw new Error('Opérateur, horodatage et identifiant du mouvement initial sont obligatoires.');
  }
  const base = { ...item, quantity: 0 };
  const rows: StockAtomicMutation[] = [{
    entity: 'stock_item', entityId: item.id, payload: base as unknown as Record<string, unknown>,
    applyToCurrent: (current) => {
      if (current) throw new Error(`L’article ${item.name} existe déjà.`);
      return item as unknown as Record<string, unknown>;
    },
    toOutboxPayload: () => base as unknown as Record<string, unknown>,
  }];
  if (item.quantity > 0) {
    const movement: StockMovement = {
      id: movementId, timestamp, itemId: item.id, itemName: item.name,
      delta: item.quantity, reason: 'Stock initial', user: actor,
    };
    rows.push(createMovementMutation(movement, item));
  }
  return rows;
}
