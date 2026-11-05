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
import { SupabaseAuthGate } from './services/supabase/SupabaseAuthGate';
import { WorkspaceProvider } from './services/supabase/WorkspaceContext';

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

const MainLayout: React.FC = () => {
  const {
    activeView,
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
  } = useApp();

  const isSetupModalVisible = isEstablishmentModalOpen || !hasOnboarded;

  return (
    <div className="flex flex-col h-[100dvh] min-h-0 w-full max-w-full overflow-hidden pms-canvas font-sans">
      <OfflineBanner />

      {/* Top Full-Width Unified Header matching szsz.png */}
      <TopBar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Right Main Working View */}
        <div className="relative z-0 flex-1 flex flex-col h-full overflow-hidden min-w-0">

          <main className="flex-1 flex flex-col overflow-hidden relative">
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
      </Suspense>
    </div>
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
