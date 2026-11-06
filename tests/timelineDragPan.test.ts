import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  shouldStartTimelineDrag,
  computeTimelineDragScroll,
  TimelineDragState,
} from '../src/utils/timelineDragPan';

test('shouldStartTimelineDrag rejects non-mouse, non-primary click, or interactive targets', () => {
  // Touch pointer should be ignored (native touch-pan handles it)
  assert.equal(
    shouldStartTimelineDrag({
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      isInteractiveTarget: false,
    }),
    false
  );

  // Secondary/right click (button: 2) must not start drag
  assert.equal(
    shouldStartTimelineDrag({
      pointerType: 'mouse',
      button: 2,
      buttons: 2,
      isInteractiveTarget: false,
    }),
    false
  );

  // Mouse hover with 0 buttons pressed must not start drag
  assert.equal(
    shouldStartTimelineDrag({
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      isInteractiveTarget: false,
    }),
    false
  );

  // Clicking an interactive child (e.g. button or input) must not start drag
  assert.equal(
    shouldStartTimelineDrag({
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      isInteractiveTarget: true,
    }),
    false
  );

  // Valid left-click on date header
  assert.equal(
    shouldStartTimelineDrag({
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      isInteractiveTarget: false,
    }),
    true
  );
});

test('computeTimelineDragScroll does not scroll on simple cursor hover (no active drag)', () => {
  const result = computeTimelineDragScroll({
    dragState: null,
    pointerId: 1,
    clientX: 250,
    buttons: 0,
  });

  assert.equal(result.shouldScroll, false);
  assert.equal(result.shouldCancel, false);
  assert.equal(result.hasMoved, false);
});

test('computeTimelineDragScroll cancels drag immediately if user released mouse click (buttons === 0)', () => {
  const mockDragState: TimelineDragState = {
    pointerId: 1,
    capturingEl: null,
    startX: 100,
    startScrollLeft: 500,
    moved: false,
  };

  const result = computeTimelineDragScroll({
    dragState: mockDragState,
    pointerId: 1,
    clientX: 150,
    buttons: 0, // Click was released!
  });

  assert.equal(result.shouldScroll, false);
  assert.equal(result.shouldCancel, true);
});

test('computeTimelineDragScroll scrolls only when user holds the mouse button down and exceeds deadband', () => {
  const mockDragState: TimelineDragState = {
    pointerId: 1,
    capturingEl: null,
    startX: 100,
    startScrollLeft: 500,
    moved: false,
  };

  // Tiny movement below deadband threshold (e.g. 2px)
  const belowThreshold = computeTimelineDragScroll({
    dragState: mockDragState,
    pointerId: 1,
    clientX: 102,
    buttons: 1,
    minDistanceThreshold: 4,
  });
  assert.equal(belowThreshold.shouldScroll, false);
  assert.equal(belowThreshold.hasMoved, false);

  // Active drag to the left (clientX increases by 50px -> calendar scrolls left by 50px)
  const activeDrag = computeTimelineDragScroll({
    dragState: mockDragState,
    pointerId: 1,
    clientX: 150,
    buttons: 1,
    minDistanceThreshold: 4,
  });
  assert.equal(activeDrag.shouldScroll, true);
  assert.equal(activeDrag.newScrollLeft, 450);
  assert.equal(activeDrag.hasMoved, true);
  assert.equal(activeDrag.shouldCancel, false);
});
