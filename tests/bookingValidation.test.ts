import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidCalendarDate,
  shouldMarkPaymentAsPaid,
} from '../src/utils/bookingValidation';

test('accepts real ISO calendar dates', () => {
  assert.equal(isValidCalendarDate('2026-11-02'), true);
  assert.equal(isValidCalendarDate('2024-02-29'), true);
});

test('rejects impossible or non-ISO calendar dates', () => {
  assert.equal(isValidCalendarDate('2026-02-31'), false);
  assert.equal(isValidCalendarDate('2025-02-29'), false);
  assert.equal(isValidCalendarDate('02/11/2026'), false);
  assert.equal(isValidCalendarDate('2026-13-01'), false);
});

test('pending payment stays pending when cash was not received', () => {
  assert.equal(shouldMarkPaymentAsPaid('pending', false), false);
  assert.equal(shouldMarkPaymentAsPaid(undefined, false), false);
});

test('payment settles only after explicit cash receipt or if already paid', () => {
  assert.equal(shouldMarkPaymentAsPaid('pending', true), true);
  assert.equal(shouldMarkPaymentAsPaid('paid', false), true);
});
import { waitForTransactionCompletion } from '../src/db/indexedDbTransaction';

test('IndexedDB writes resolve only after the transaction commits', async () => {
  const transaction = new EventTarget() as EventTarget & { error: DOMException | null };
  transaction.error = null;
  let settled = false;
  const completion = waitForTransactionCompletion(
    transaction as unknown as IDBTransaction,
    'test write'
  ).then(() => {
    settled = true;
  });

  // A request may succeed while its containing transaction is still pending.
  await Promise.resolve();
  assert.equal(settled, false);

  transaction.dispatchEvent(new Event('complete'));
  await completion;
  assert.equal(settled, true);
});

test('IndexedDB transaction abort rejects the write promise', async () => {
  const transaction = new EventTarget() as EventTarget & { error: DOMException | null };
  transaction.error = new DOMException('Quota exceeded', 'QuotaExceededError');
  const completion = waitForTransactionCompletion(
    transaction as unknown as IDBTransaction,
    'test write'
  );

  transaction.dispatchEvent(new Event('abort'));
  await assert.rejects(completion, /Quota exceeded/);
});

test('IndexedDB transaction errors reject instead of reporting success', async () => {
  const transaction = new EventTarget() as EventTarget & { error: DOMException | null };
  transaction.error = new DOMException('Constraint violation', 'ConstraintError');
  const completion = waitForTransactionCompletion(
    transaction as unknown as IDBTransaction,
    'test write'
  );

  transaction.dispatchEvent(new Event('error'));
  await assert.rejects(completion, /Constraint violation/);
});
