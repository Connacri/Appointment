export interface TimelineDragState {
  pointerId: number;
  capturingEl: HTMLElement | null;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

export interface StartDragParams {
  pointerType: string;
  button: number;
  buttons: number;
  isInteractiveTarget: boolean;
}

/**
 * Checks whether horizontal drag-panning should initiate.
 * Only left-click mouse down with primary button held (buttons & 1 === 1)
 * on non-interactive header regions is allowed.
 */
export function shouldStartTimelineDrag(params: StartDragParams): boolean {
  if (params.pointerType !== 'mouse') return false;
  if (params.button !== 0) return false;
  if ((params.buttons & 1) !== 1) return false;
  if (params.isInteractiveTarget) return false;
  return true;
}

export interface DragScrollParams {
  dragState: TimelineDragState | null;
  pointerId: number;
  clientX: number;
  buttons: number;
  minDistanceThreshold?: number;
}

export interface DragScrollResult {
  shouldScroll: boolean;
  newScrollLeft: number;
  shouldCancel: boolean;
  hasMoved: boolean;
}

/**
 * Computes new scroll offset during pointer move.
 * CRITICAL: If the user is simply hovering or has released the primary click (buttons & 1 !== 1),
 * drag must NOT scroll and should immediately cancel/reset.
 */
export function computeTimelineDragScroll(params: DragScrollParams): DragScrollResult {
  const { dragState, pointerId, clientX, buttons, minDistanceThreshold = 4 } = params;

  // No active drag state or mismatched pointer: hover only, never scroll
  if (!dragState || dragState.pointerId !== pointerId) {
    return { shouldScroll: false, newScrollLeft: 0, shouldCancel: false, hasMoved: false };
  }

  // Primary mouse button is not currently held down: cancel drag immediately
  if ((buttons & 1) !== 1) {
    return { shouldScroll: false, newScrollLeft: 0, shouldCancel: true, hasMoved: dragState.moved };
  }

  const dx = clientX - dragState.startX;
  const hasMoved = dragState.moved || Math.abs(dx) >= minDistanceThreshold;

  if (!hasMoved) {
    return {
      shouldScroll: false,
      newScrollLeft: dragState.startScrollLeft,
      shouldCancel: false,
      hasMoved: false,
    };
  }

  return {
    shouldScroll: true,
    newScrollLeft: dragState.startScrollLeft - dx,
    shouldCancel: false,
    hasMoved: true,
  };
}
