/**
 * Pure decision helpers for the mobile pull-to-refresh gesture.
 * Kept free of DOM access so they can be unit-tested with node:test.
 */
export const PULL_TRIGGER_PX = 100;
export const PULL_MAX_PX = 128;
export const PULL_DIRECTION_RATIO = 1.4;

export interface PullDelta {
  deltaX: number;
  deltaY: number;
}

export type PullPhase = 'idle' | 'pulling' | 'armed';

export interface ScrollableAncestor {
  overflowY: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function isMostlyVertical({ deltaX, deltaY }: PullDelta): boolean {
  return deltaY > 0 && deltaY > Math.abs(deltaX) * PULL_DIRECTION_RATIO;
}

export function dampenPullDistance(deltaY: number): number {
  if (!(deltaY > 0)) return 0;
  return Math.min(PULL_MAX_PX, deltaY * 0.55);
}

export function resolvePullPhase(delta: PullDelta): PullPhase {
  if (!isMostlyVertical(delta)) return 'idle';
  return delta.deltaY >= PULL_TRIGGER_PX ? 'armed' : 'pulling';
}

export function shouldTriggerRefresh(args: {
  delta: PullDelta;
  startedAtTop: boolean;
  isRefreshing: boolean;
}): boolean {
  if (!args.startedAtTop || args.isRefreshing) return false;
  return resolvePullPhase(args.delta) === 'armed';
}

export function areAncestorsAtTop(ancestors: ScrollableAncestor[]): boolean {
  return ancestors.every((ancestor) => {
    const overflowScrolls =
      ancestor.overflowY === 'auto' ||
      ancestor.overflowY === 'scroll' ||
      ancestor.overflowY === 'overlay';
    const isScrollable = overflowScrolls && ancestor.scrollHeight > ancestor.clientHeight;
    return !isScrollable || ancestor.scrollTop <= 0;
  });
}
