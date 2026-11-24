/**
 * Run callback-driven IndexedDB work one item at a time.
 *
 * The next item must not start until the current item's IDB requests have been
 * queued. This is required when each item reads and advances a shared sequence.
 */
export function runSerialQueue<T>(
  items: readonly T[],
  process: (item: T, next: () => void) => void,
  onComplete: () => void,
): void {
  let index = 0;
  const next = (): void => {
    if (index >= items.length) {
      onComplete();
      return;
    }
    const item = items[index++];
    process(item, next);
  };
  next();
}
