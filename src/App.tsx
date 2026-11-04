/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DomainRoleSelector } from './components/DomainRoleSelector';
import { PlanningTimeline } from './components/PlanningTimeline';
import { LegendBar } from './components/LegendBar';
import { MyBookingsView } from './components/MyBookingsView';
import { ReportsView } from './components/ReportsView';
import { BookingModal } from './components/BookingModal';
import { AgentsCockpitModal } from './components/AgentsCockpitModal';
import { LegalModal } from './components/LegalModal';
import { OfflineBanner } from './components/OfflineBanner';
import { BookingAnalyticsView } from './components/BookingAnalyticsView';
import { HousekeepingView } from './components/HousekeepingView';
import { BillingInvoicingView } from './components/BillingInvoicingView';
import { ChannelManagerView } from './components/ChannelManagerView';
import { TasksManagementView } from './components/TasksManagementView';
import { StockManagementView } from './components/StockManagementView';
import { DynamicPricingView } from './components/DynamicPricingView';
import { IndexedDbInspectorModal } from './components/IndexedDbInspectorModal';
import { QrPassModal } from './components/QrPassModal';
import { QrScannerModal } from './components/QrScannerModal';
import { ProUsbLockSystemView } from './components/ProUsbLockSystemView';
import { SpaManagementView } from './components/SpaManagementView';
import { HelpCenterView } from './components/HelpCenterView';
import { EstablishmentSetupModal } from './components/EstablishmentSetupModal';
import { SupabaseAuthGate } from './services/supabase/SupabaseAuthGate';
import { WorkspaceProvider } from './services/supabase/WorkspaceContext';

import { AboutModal } from './components/AboutModal';

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
    hasOnboarded,
  } = useApp();

  return (
    <div className="flex flex-col h-[100dvh] min-h-0 w-full max-w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      <OfflineBanner />

      {/* Top Full-Width Unified Header matching szsz.png */}
      <TopBar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Right Main Working View */}
        <div className="relative z-0 flex-1 flex flex-col h-full overflow-hidden min-w-0">

          <main className="flex-1 flex flex-col overflow-hidden relative">
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
          </main>
        </div>
      </div>

      {/* Global Interactive Modals */}
      <BookingModal />
      <AgentsCockpitModal />
      <LegalModal />
      <IndexedDbInspectorModal
        isOpen={isIndexedDBOpen}
        onClose={() => setIsIndexedDBOpen(false)}
      />
      <QrPassModal
        booking={activeQrPassBooking}
        onClose={() => setActiveQrPassBooking(null)}
      />
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
      />
      <EstablishmentSetupModal
        isOpen={isEstablishmentModalOpen}
        onClose={() => setIsEstablishmentModalOpen(false)}
        isFirstLaunch={!hasOnboarded}
      />
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
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
