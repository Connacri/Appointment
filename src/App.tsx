/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PlanningTimeline } from './components/PlanningTimeline';
import { LegendBar } from './components/LegendBar';
import { BookingModal } from './components/BookingModal';
import { OfflineBanner } from './components/OfflineBanner';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { SupabaseAuthGate } from './services/supabase/SupabaseAuthGate';
import { WorkspaceProvider } from './services/supabase/WorkspaceContext';
import { VideoBubble } from './services/VideoBubbleBridge';
import { PullToRefresh } from './components/PullToRefresh';

/**
 * Secondary views are code-split: Vite emits one chunk per module and the chunk
 * is only fetched the first time the user opens that view. The planning screen
 * (the landing view) stays eager so first paint is never blocked.
 */
const MyBookingsView = React.lazy(() =>
  import('./components/MyBookingsView').then((m) => ({ default: m.MyBookingsView })),
);
const ReportsView = React.lazy(() =>
  import('./components/ReportsView').then((m) => ({ default: m.ReportsView })),
);
const BookingAnalyticsView = React.lazy(() =>
  import('./components/BookingAnalyticsView').then((m) => ({ default: m.BookingAnalyticsView })),
);
const HousekeepingView = React.lazy(() =>
  import('./components/HousekeepingView').then((m) => ({ default: m.HousekeepingView })),
);
const BillingInvoicingView = React.lazy(() =>
  import('./components/BillingInvoicingView').then((m) => ({ default: m.BillingInvoicingView })),
);
const ChannelManagerView = React.lazy(() =>
  import('./components/ChannelManagerView').then((m) => ({ default: m.ChannelManagerView })),
);
const TasksManagementView = React.lazy(() =>
  import('./components/TasksManagementView').then((m) => ({ default: m.TasksManagementView })),
);
const StockManagementView = React.lazy(() =>
  import('./components/StockManagementView').then((m) => ({ default: m.StockManagementView })),
);
const DynamicPricingView = React.lazy(() =>
  import('./components/DynamicPricingView').then((m) => ({ default: m.DynamicPricingView })),
);
const ProUsbLockSystemView = React.lazy(() =>
  import('./components/ProUsbLockSystemView').then((m) => ({ default: m.ProUsbLockSystemView })),
);
const SpaManagementView = React.lazy(() =>
  import('./components/SpaManagementView').then((m) => ({ default: m.SpaManagementView })),
);
const HelpCenterView = React.lazy(() =>
  import('./components/HelpCenterView').then((m) => ({ default: m.HelpCenterView })),
);
const VideoHubView = React.lazy(() =>
  import('./components/VideoHubView').then((m) => ({ default: m.VideoHubView })),
);

/**
 * Modals are code-split and only mounted while open, so their dependencies
 * (QR code generation, IndexedDB tooling, onboarding wizard…) never weigh on
 * the initial payload.
 */
const AgentsCockpitModal = React.lazy(() =>
  import('./components/AgentsCockpitModal').then((m) => ({ default: m.AgentsCockpitModal })),
);
const LegalModal = React.lazy(() =>
  import('./components/LegalModal').then((m) => ({ default: m.LegalModal })),
);
const IndexedDbInspectorModal = React.lazy(() =>
  import('./components/IndexedDbInspectorModal').then((m) => ({ default: m.IndexedDbInspectorModal })),
);
const QrPassModal = React.lazy(() =>
  import('./components/QrPassModal').then((m) => ({ default: m.QrPassModal })),
);
const QrScannerModal = React.lazy(() =>
  import('./components/QrScannerModal').then((m) => ({ default: m.QrScannerModal })),
);
const EstablishmentSetupModal = React.lazy(() =>
  import('./components/EstablishmentSetupModal').then((m) => ({ default: m.EstablishmentSetupModal })),
);
const AboutModal = React.lazy(() =>
  import('./components/AboutModal').then((m) => ({ default: m.AboutModal })),
);

/** Neutral placeholder shown while a view chunk is being fetched. */
const ViewFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-6" aria-busy="true" aria-live="polite">
    <span className="pms-view-loading" />
  </div>
);

class VideoHubErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[HackTube] View rendering failed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center dark:bg-slate-950">
          <div className="text-base font-semibold text-slate-900 dark:text-white">HackTube n’a pas pu être affiché</div>
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">Une erreur JavaScript a interrompu le chargement de cet onglet. Rechargez l’application pour relancer son module.</p>
          <pre className="max-w-full overflow-auto rounded-lg bg-slate-200/70 p-3 text-left text-xs text-rose-700 dark:bg-slate-900 dark:text-rose-300">{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Recharger l’application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainLayout: React.FC = () => {
  const {
    activeView,
    setActiveView,
    isIndexedDBOpen,
    setIsIndexedDBOpen,
    isAboutModalOpen,
    setIsAboutModalOpen,
    activeQrPassBooking,
    setActiveQrPassBooking,
    isQrScannerOpen,
    setIsQrScannerOpen,
    isEstablishmentModalOpen,
    setIsEstablishmentModalOpen,
    isCockpitOpen,
    isLegalModalOpen,
    hasOnboarded,
    refreshWorkspaces,
  } = useApp();

  const [hasOpenedVideoHub, setHasOpenedVideoHub] = React.useState(activeView === 'videos');

  React.useEffect(() => {
    const openHackTube = (url?: string | null, openQuickAdd = false) => {
      if (url) {
        try { localStorage.setItem('appointment_pending_video_share', url); } catch { /* storage may be unavailable */ }
      }
      if (openQuickAdd || url) {
        try { localStorage.setItem('appointment_open_hacktube_quick_add', '1'); } catch { /* storage may be unavailable */ }
        setActiveView('videos');
      }
    };

    const receiveVideoShare = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string; openQuickAdd?: boolean }>).detail;
      if (!detail?.url && detail?.openQuickAdd) {
        // The user tapped the bubble: read the clipboard only now, with the app foregrounded.
        VideoBubble.getPendingShare()
          .then((pending) => {
            openHackTube(pending?.url, true);
            if (pending?.url) {
              window.dispatchEvent(new CustomEvent('appointment-video-share', { detail: { url: pending.url, openQuickAdd: true } }));
            }
          })
          .catch(() => openHackTube(undefined, true));
        return;
      }
      openHackTube(detail?.url, Boolean(detail?.openQuickAdd));
    };

    window.addEventListener('appointment-video-share', receiveVideoShare);
    VideoBubble.getPendingShare()
      .then((pending) => {
        if (pending?.url || pending?.openQuickAdd) openHackTube(pending.url, pending.openQuickAdd);
      })
      .catch(() => { /* Native bridge is unavailable in the web build. */ });

    return () => window.removeEventListener('appointment-video-share', receiveVideoShare);
  }, [setActiveView]);


  // Pull-to-refresh reloads remote data only. It must never reload the page:
  // that would destroy the HackTube player, open forms and local state.
  const handlePullRefresh = React.useCallback(async () => {
    await refreshWorkspaces();
    window.dispatchEvent(new CustomEvent('appointment-refresh'));
  }, [refreshWorkspaces]);

  React.useEffect(() => {
    const handleRefreshRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ onComplete?: () => void }>).detail;
      void handlePullRefresh().finally(() => detail?.onComplete?.());
    };
    window.addEventListener('appointment-refresh-request', handleRefreshRequest);
    return () => window.removeEventListener('appointment-refresh-request', handleRefreshRequest);
  }, [handlePullRefresh]);

  React.useEffect(() => {
    if (activeView === 'videos') setHasOpenedVideoHub(true);
  }, [activeView]);

  const isSetupModalVisible = isEstablishmentModalOpen || !hasOnboarded;

  return (
    <PullToRefresh
      className="flex flex-col h-[100dvh] min-h-0 w-full max-w-full overflow-hidden pms-canvas font-sans"
      onRefresh={handlePullRefresh}
    >
      {/* Top Full-Width Unified Header matching szsz.png */}
      <TopBar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Right Main Working View */}
        <div className="relative z-0 flex-1 flex flex-col h-full overflow-hidden min-w-0">

          <main key={activeView} className="flex-1 flex flex-col overflow-hidden relative pms-fade">
            <Suspense fallback={<ViewFallback />}>
              {activeView === 'planning' && (
                <>
                  <PlanningTimeline />
                  <LegendBar />
                </>
              )}

              {activeView === 'tasks' && <TasksManagementView />}

              {activeView === 'stock' && <StockManagementView />}

              {activeView === 'pricing' && <DynamicPricingView />}

              {activeView === 'analytics' && <BookingAnalyticsView />}

              {activeView === 'billing' && <BillingInvoicingView />}

              {activeView === 'my_bookings' && <MyBookingsView />}

              {activeView === 'housekeeping' && <HousekeepingView />}

              {activeView === 'channels' && <ChannelManagerView />}

              {activeView === 'reports' && <ReportsView />}

              {activeView === 'prousb' && <ProUsbLockSystemView />}

              {activeView === 'spa' && <SpaManagementView />}

              {activeView === 'help' && <HelpCenterView />}

            </Suspense>
          </main>

          {/* Keep HackTube mounted after first use: changing workspace views must not
              destroy its cross-origin media iframe or reset the current playback. */}
          <Suspense fallback={activeView === 'videos' ? <ViewFallback /> : null}>
            {hasOpenedVideoHub && (
              <div
                className={`absolute inset-0 transition-opacity duration-150 ${
                  activeView === 'videos'
                    ? 'z-10 opacity-100'
                    : '-z-10 opacity-0 pointer-events-none'
                }`}
                aria-hidden={activeView !== 'videos'}
              >
                <VideoHubErrorBoundary><VideoHubView /></VideoHubErrorBoundary>
              </div>
            )}
          </Suspense>
        </div>
      </div>

      {/* Global Interactive Modals — mounted on demand */}
      <BookingModal />
      <Suspense fallback={null}>
        {isCockpitOpen && <AgentsCockpitModal />}
        {isLegalModalOpen && <LegalModal />}
        {isIndexedDBOpen && (
          <IndexedDbInspectorModal
            isOpen={isIndexedDBOpen}
            onClose={() => setIsIndexedDBOpen(false)}
          />
        )}
        {activeQrPassBooking && (
          <QrPassModal
            booking={activeQrPassBooking}
            onClose={() => setActiveQrPassBooking(null)}
          />
        )}
        {isQrScannerOpen && (
          <QrScannerModal
            isOpen={isQrScannerOpen}
            onClose={() => setIsQrScannerOpen(false)}
          />
        )}
        {isSetupModalVisible && (
          <EstablishmentSetupModal
            isOpen={isSetupModalVisible}
            onClose={() => setIsEstablishmentModalOpen(false)}
            isFirstLaunch={!hasOnboarded}
          />
        )}
        {isAboutModalOpen && (
          <AboutModal
            isOpen={isAboutModalOpen}
            onClose={() => setIsAboutModalOpen(false)}
          />
        )}
        <ThemeSelectorModal />
      </Suspense>
    </PullToRefresh>
  );
};

export default function App() {
  return (
    <SupabaseAuthGate>
      <WorkspaceProvider>
        <AppProvider>
          <MainLayout />
        </AppProvider>
      </WorkspaceProvider>
    </SupabaseAuthGate>
  );
}
