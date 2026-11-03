/**
 * Resolve only when IndexedDB confirms the whole transaction has committed.
 * Individual IDBRequest success events do not guarantee transaction durability.
 */
export function waitForTransactionCompletion(
  transaction: IDBTransaction,
  operation: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      transaction.removeEventListener('complete', onComplete);
      transaction.removeEventListener('error', onError);
      transaction.removeEventListener('abort', onAbort);
    };

    const fail = (eventName: 'error' | 'abort') => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        transaction.error ??
          new Error(`IndexedDB transaction ${eventName}: ${operation}`)
      );
    };

    const onComplete = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onError = () => fail('error');
    const onAbort = () => fail('abort');

    transaction.addEventListener('complete', onComplete, { once: true });
    transaction.addEventListener('error', onError, { once: true });
    transaction.addEventListener('abort', onAbort, { once: true });
  });
}
