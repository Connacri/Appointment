import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PULL_MAX_PX,
  PULL_TRIGGER_PX,
  areAncestorsAtTop,
  dampenPullDistance,
  resolvePullPhase,
  shouldTriggerRefresh,
} from '../src/utils/pullToRefresh';

test('a long mostly-vertical downward drag arms the refresh', () => {
  assert.equal(resolvePullPhase({ deltaX: 10, deltaY: PULL_TRIGGER_PX }), 'armed');
});

test('a short downward drag is only pulling, never armed', () => {
  assert.equal(resolvePullPhase({ deltaX: 0, deltaY: PULL_TRIGGER_PX - 1 }), 'pulling');
});

test('horizontal, upward or zero drags are idle', () => {
  assert.equal(resolvePullPhase({ deltaX: 200, deltaY: 120 }), 'idle');
  assert.equal(resolvePullPhase({ deltaX: 0, deltaY: -150 }), 'idle');
  assert.equal(resolvePullPhase({ deltaX: 0, deltaY: 0 }), 'idle');
});

test('shouldTriggerRefresh requires top start and no refresh in flight', () => {
  const delta = { deltaX: 0, deltaY: 160 };
  assert.equal(shouldTriggerRefresh({ delta, startedAtTop: true, isRefreshing: false }), true);
  assert.equal(shouldTriggerRefresh({ delta, startedAtTop: false, isRefreshing: false }), false);
  assert.equal(shouldTriggerRefresh({ delta, startedAtTop: true, isRefreshing: true }), false);
});

test('dampenPullDistance is capped and never negative', () => {
  assert.equal(dampenPullDistance(-20), 0);
  assert.equal(dampenPullDistance(0), 0);
  assert.equal(dampenPullDistance(10000), PULL_MAX_PX);
  assert.ok(dampenPullDistance(100) < 100);
});

test('a scrolled ancestor blocks the pull, a non-scrollable one does not', () => {
  const scrolled = { overflowY: 'auto', scrollTop: 40, scrollHeight: 900, clientHeight: 500 };
  const atTop = { overflowY: 'auto', scrollTop: 0, scrollHeight: 900, clientHeight: 500 };
  const notScrollable = { overflowY: 'auto', scrollTop: 0, scrollHeight: 400, clientHeight: 400 };
  const hidden = { overflowY: 'hidden', scrollTop: 30, scrollHeight: 900, clientHeight: 500 };
  assert.equal(areAncestorsAtTop([atTop, notScrollable, hidden]), true);
  assert.equal(areAncestorsAtTop([atTop, scrolled]), false);
  assert.equal(areAncestorsAtTop([]), true);
});
