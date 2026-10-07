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
import { ObjectBoxInspectorModal } from './components/ObjectBoxInspectorModal';

const MainLayout: React.FC = () => {
  const { activeView, isObjectBoxOpen, setIsObjectBoxOpen } = useApp();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      <OfflineBanner />

      {/* Top Domain & Role Switcher Bar */}
      <DomainRoleSelector />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Right Main Working View */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <TopBar />

          <main className="flex-1 flex flex-col overflow-hidden relative">
            {activeView === 'planning' && (
              <>
                <PlanningTimeline />
                <LegendBar />
              </>
            )}

            {activeView === 'analytics' && <BookingAnalyticsView />}

            {activeView === 'billing' && <BillingInvoicingView />}

            {activeView === 'my_bookings' && <MyBookingsView />}

            {activeView === 'housekeeping' && <HousekeepingView />}

            {activeView === 'reports' && <ReportsView />}
          </main>
        </div>
      </div>

      {/* Global Interactive Modals */}
      <BookingModal />
      <AgentsCockpitModal />
      <LegalModal />
      <ObjectBoxInspectorModal
        isOpen={isObjectBoxOpen}
        onClose={() => setIsObjectBoxOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
