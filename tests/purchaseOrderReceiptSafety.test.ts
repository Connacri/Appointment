import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PURCHASE_ORDER_RECEIPT_BLOCKED_REASON } from '../src/utils/purchaseOrderReceipt';

test('purchase-order receipt exposes an explicit fail-closed reason until atomic commit exists', () => {
  assert.match(PURCHASE_ORDER_RECEIPT_BLOCKED_REASON, /transaction atomique/);
  assert.match(PURCHASE_ORDER_RECEIPT_BLOCKED_REASON, /Outbox\/P2P/);
});
