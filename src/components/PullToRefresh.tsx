import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  PULL_TRIGGER_PX,
  ScrollableAncestor,
  areAncestorsAtTop,
  dampenPullDistance,
  resolvePullPhase,
  shouldTriggerRefresh,
} from '../utils/pullToRefresh';

const BLOCKING_SELECTOR =
  'input, textarea, select, button, a, iframe, video, [role="dialog"], [role="slider"], [contenteditable="true"], [data-no-pull-refresh]';
const OPEN_OVERLAY_SELECTOR = '[role="dialog"], [aria-modal="true"]';
const ERROR_VISIBLE_MS = 3500;

type Status = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'error';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  className?: string;
  children: React.ReactNode;
}

function collectAncestors(target: Element, root: Element): ScrollableAncestor[] {
  const ancestors: ScrollableAncestor[] = [];
  let node: Element | null = target;
  while (node) {
    const style = window.getComputedStyle(node);
    ancestors.push({
      overflowY: style.overflowY,
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    });
    if (node === root) break;
    node = node.parentElement;
  }
  return ancestors;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, className, children }) => {
  const { language } = useApp();
  const t = (fr: string, en: string, ar: string) => (language === 'fr' ? fr : language === 'ar' ? ar : en);

  const [status, setStatus] = React.useState<Status>('idle');
  const [distance, setDistance] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState('');

  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const refreshingRef = React.useRef(false);
  const errorTimerRef = React.useRef<number | null>(null);
  const onRefreshRef = React.useRef(onRefresh);

  React.useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  React.useEffect(() => () => {
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
  }, []);

  const reset = () => {
    startRef.current = null;
    setDistance(0);
    setStatus((current) => (current === 'refreshing' || current === 'error' ? current : 'idle'));
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    startRef.current = null;
    if (refreshingRef.current || event.touches.length !== 1) return;

    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest(BLOCKING_SELECTOR)) return;
    if (document.querySelector(OPEN_OVERLAY_SELECTOR)) return;
    if (!areAncestorsAtTop(collectAncestors(target, event.currentTarget))) return;

    startRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || event.touches.length !== 1) return;
    const delta = {
      deltaX: event.touches[0].clientX - start.x,
      deltaY: event.touches[0].clientY - start.y,
    };
    const phase = resolvePullPhase(delta);
    if (phase === 'idle') {
      reset();
      return;
    }
    setDistance(dampenPullDistance(delta.deltaY));
    setStatus(phase);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setStatus('error');
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setStatus('idle');
      setErrorMessage('');
      errorTimerRef.current = null;
    }, ERROR_VISIBLE_MS);
  };

  const runRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setStatus('refreshing');
    setDistance(PULL_TRIGGER_PX * 0.55);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error(t('Réseau indisponible : actualisation impossible.', 'Network unavailable: cannot refresh.', 'الشبكة غير متاحة: تعذر التحديث.'));
      }
      await onRefreshRef.current();
      setStatus('idle');
    } catch (error) {
      console.error('[PullToRefresh] Refresh failed:', error);
      showError(error instanceof Error && error.message
        ? error.message
        : t('Échec de l’actualisation.', 'Refresh failed.', 'فشل التحديث.'));
    } finally {
      refreshingRef.current = false;
      setDistance(0);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || event.changedTouches.length !== 1) {
      reset();
      return;
    }
    const delta = {
      deltaX: event.changedTouches[0].clientX - start.x,
      deltaY: event.changedTouches[0].clientY - start.y,
    };
    if (shouldTriggerRefresh({ delta, startedAtTop: true, isRefreshing: refreshingRef.current })) {
      void runRefresh();
    } else {
      reset();
    }
  };

  const visible = status !== 'idle' && (distance > 0 || status === 'refreshing' || status === 'error');
  const label =
    status === 'refreshing'
      ? t('Actualisation…', 'Refreshing…', 'جارٍ التحديث…')
      : status === 'armed'
        ? t('Relâcher pour actualiser', 'Release to refresh', 'أفلت للتحديث')
        : status === 'error'
          ? errorMessage
          : t('Tirer pour actualiser', 'Pull to refresh', 'اسحب للتحديث');

  return (
    <div
      className={className}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={reset}
    >
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 z-[70] -translate-x-1/2"
          style={{
            top: 'calc(var(--pms-safe-area-top, 0px) + 8px)',
            transform: `translate(-50%, ${Math.max(0, distance - 40)}px)`,
          }}
        >
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg ${
              status === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <RefreshCw size={14} className={status === 'refreshing' ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{label}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
