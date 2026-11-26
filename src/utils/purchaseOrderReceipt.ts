/**
 * Purchase-order receiving remains disabled until its local command atomically
 * commits the order, stock projections, movement ledger and replication intent.
 */
export const PURCHASE_ORDER_RECEIPT_BLOCKED_REASON =
  'Réception bloquée : la transaction atomique commande + quantités de stock + mouvements + Outbox/P2P n’est pas encore disponible.';
