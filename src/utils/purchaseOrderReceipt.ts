import type {
  PurchaseOrderRecord,
  StockItem,
  StockMovement,
} from '../types/booking';

export interface PurchaseOrderReceiptMutation {
  entity: 'purchase_order' | 'stock_item' | 'stock_movement';
  entityId: string;
  payload: Record<string, unknown>;
  applyToCurrent?: (currentPayload?: Record<string, unknown>) => Record<string, unknown>;
}

export interface PurchaseOrderReceiptPlan {
  purchaseOrder: PurchaseOrderRecord;
  stockItems: StockItem[];
  movements: StockMovement[];
  mutations: PurchaseOrderReceiptMutation[];
}

/**
 * Build a deterministic business command before opening the IndexedDB transaction.
 * Every line is validated and duplicate stock-item lines are aggregated so the
 * stock projection and movement ledger cannot diverge.
 */
export function buildPurchaseOrderReceiptPlan(
  order: PurchaseOrderRecord,
  currentStockItems: readonly StockItem[],
  actor: string,
  receivedAt: string,
  createMovementId: () => string,
): PurchaseOrderReceiptPlan {
  if (order.status !== 'confirmed' && order.status !== 'sent') {
    throw new Error('Seules les commandes confirmées ou envoyées peuvent être réceptionnées.');
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new Error('La commande ne contient aucune ligne à réceptionner.');
  }
  if (!Number.isFinite(Date.parse(receivedAt)) || !actor.trim()) {
    throw new Error('Date de réception ou opérateur invalide.');
  }

  const quantities = new Map<string, number>();
  for (const line of order.items) {
    if (!line.itemId.trim() || !Number.isFinite(line.orderQty) || line.orderQty <= 0) {
      throw new Error(`Quantité commandée invalide pour l’article ${line.itemName || line.itemId}.`);
    }
    quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.orderQty);
  }

  const stockById = new Map(currentStockItems.map((item) => [item.id, item]));
  const updatedStockItems = [...currentStockItems];
  const movements: StockMovement[] = [];
  for (const [itemId, quantity] of quantities) {
    const current = stockById.get(itemId);
    if (!current) throw new Error(`L’article ${itemId} de la commande n’existe plus dans le stock.`);
    if (!Number.isFinite(current.quantity) || current.quantity < 0
      || !Number.isFinite(current.quantity + quantity)) {
      throw new Error(`Quantité de stock invalide pour l’article ${current.name}.`);
    }
    const updated = { ...current, quantity: current.quantity + quantity };
    const index = updatedStockItems.findIndex((item) => item.id === itemId);
    updatedStockItems[index] = updated;
    movements.push({
      id: createMovementId(),
      timestamp: receivedAt,
      itemId,
      itemName: current.name,
      delta: quantity,
      reason: `Réception commande ${order.orderNumber}`,
      user: actor,
    });
  }

  const purchaseOrder: PurchaseOrderRecord = {
    ...order,
    status: 'received',
    receivedAt,
  };
  const mutations: PurchaseOrderReceiptMutation[] = [
    { entity: 'purchase_order', entityId: purchaseOrder.id, payload: purchaseOrder as unknown as Record<string, unknown> },
    ...updatedStockItems
      .filter((item) => quantities.has(item.id))
      .map((item) => {
        const delta = quantities.get(item.id) ?? 0;
        const fallback = currentStockItems.find((current) => current.id === item.id) ?? item;
        return {
          entity: 'stock_item' as const,
          entityId: item.id,
          payload: fallback as unknown as Record<string, unknown>,
          applyToCurrent: (currentPayload?: Record<string, unknown>) => {
            const latest = { ...fallback, ...(currentPayload ?? {}) } as StockItem;
            return { ...latest, quantity: Number(latest.quantity) + delta } as unknown as Record<string, unknown>;
          },
          toOutboxPayload: (currentPayload?: Record<string, unknown>) => {
            const latest = { ...fallback, ...(currentPayload ?? {}) } as StockItem;
            return latest as unknown as Record<string, unknown>;
          },
        };
      }),
    ...movements.map((movement) => ({
      entity: 'stock_movement' as const,
      entityId: movement.id,
      payload: movement as unknown as Record<string, unknown>,
    })),
  ];
  return { purchaseOrder, stockItems: updatedStockItems, movements, mutations };
}
