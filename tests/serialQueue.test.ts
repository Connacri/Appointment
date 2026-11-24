import assert from 'node:assert/strict';
import test from 'node:test';
import { runSerialQueue } from '../src/db/serialQueue';

test('serial queue does not start the next P2P task before the prior task advances', async () => {
  const order: string[] = [];
  let complete = 0;

  runSerialQueue(['a', 'b', 'c'], (item, next) => {
    order.push('start:' + item);
    queueMicrotask(() => {
      order.push('commit:' + item);
      next();
    });
  }, () => {
    complete += 1;
    order.push('complete');
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order, [
    'start:a', 'commit:a',
    'start:b', 'commit:b',
    'start:c', 'commit:c',
    'complete',
  ]);
  assert.equal(complete, 1);
});

test('serial queue handles an empty page without invoking a task', () => {
  let taskCount = 0;
  let completeCount = 0;
  runSerialQueue([], () => { taskCount += 1; }, () => { completeCount += 1; });
  assert.equal(taskCount, 0);
  assert.equal(completeCount, 1);
});
