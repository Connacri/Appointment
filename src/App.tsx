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
import { OfflineBanner } from './components/OfflineBanner';
import { SyncTerminal } from './components/SyncTerminal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { SupabaseAuthGate } from './services/supabase/SupabaseAuthGate';
import { WorkspaceProvider } from './services/supabase/WorkspaceContext';
import { PullToRefresh } from './components/PullToRefresh';
import { useBrandIconSync } from './hooks/useBrandIconSync';

const BookingModal = React.lazy(() =>
  import('./components/BookingModal').then((m) => ({ default: m.BookingModal })),
);

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
const EventLogView = React.lazy(() =>
  import('./components/EventLogView').then((m) => ({ default: m.EventLogView })),
);
const BookingAnalyticsView = React.lazy(() =>
  import('./components/BookingAnalyticsView').then((m) => ({ default: m.BookingAnalyticsView })),
);
const HousekeepingView = React.lazy(() =>
  import('./components/HousekeepingView').then((m) => ({ default: m.HousekeepingView })),
);
const LostPropertyView = React.lazy(() =>
  import('./components/LostPropertyView').then((m) => ({ default: m.LostPropertyView })),
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
const RoleManagementView = React.lazy(() =>
  import('./components/RoleManagementView').then((m) => ({ default: m.RoleManagementView })),
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

/**
 * Safety net for the working area: a rendering exception used to unmount the
 * whole React tree and leave a blank page behind the dialogs. The boundary keeps
 * the shell, explains what happened and offers a retry without a full reload.
 */
class ViewErrorBoundary extends React.Component<
  { children: React.ReactNode; language: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[App] View rendering failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isFr = this.props.language === 'fr';
    const isAr = this.props.language === 'ar';
    return (
      <div
        role="alert"
        className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 bg-[rgb(var(--pms-canvas))] p-6 text-center"
      >
        <div className="text-base font-semibold text-slate-900 dark:text-white">
          {isFr ? 'Cet écran n’a pas pu être affiché' : isAr ? 'تعذّر عرض هذه الشاشة' : 'This screen could not be displayed'}
        </div>
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
          {isFr
            ? 'Vos données sont intactes. Réessayez, puis rechargez l’application si le problème persiste.'
            : isAr
            ? 'بياناتك سليمة. أعد المحاولة، ثم أعد تحميل التطبيق إذا استمرت المشكلة.'
            : 'Your data is intact. Try again, then reload the app if the problem persists.'}
        </p>
        <pre className="max-w-full overflow-auto rounded-lg bg-slate-200/70 p-3 text-left text-xs text-rose-700 dark:bg-slate-900 dark:text-rose-300">{this.state.error.message}</pre>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isFr ? 'Réessayer' : isAr ? 'إعادة المحاولة' : 'Try again'}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {isFr ? 'Recharger l’application' : isAr ? 'إعادة تحميل التطبيق' : 'Reload the app'}
          </button>
        </div>
      </div>
    );
  }
}

const MainLayout: React.FC = () => {
  const {
    activeView,
    language,
    isIndexedDBOpen,
    isNewBookingModalOpen,
    selectedBooking,
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
    establishmentProfile,
    activeRoleDefinition,
    deviceMutationAvailability,
    isInitialSyncReady,
    cloudSyncStatus,
    forceSupabaseSync,
    configureSingleDeviceTopology,
  } = useApp();

  const [deviceSetupError, setDeviceSetupError] = React.useState('');
  const [isConfiguringDevice, setIsConfiguringDevice] = React.useState(false);

  const handleConfigureSingleDevice = async () => {
    setDeviceSetupError('');
    setIsConfiguringDevice(true);
    try {
      await configureSingleDeviceTopology();
    } catch (error) {
      setDeviceSetupError(error instanceof Error ? error.message : 'Échec de la configuration du registre.');
    } finally {
      setIsConfiguringDevice(false);
    }
  };

  useBrandIconSync(establishmentProfile?.logoUrl, establishmentProfile?.name);


  // Pull-to-refresh reloads remote data only. It must never reload the page:
  // that would discard open forms and transient local state.
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

  const isSetupModalVisible = isEstablishmentModalOpen || !hasOnboarded;

  return (
    <PullToRefresh
      className="flex flex-col h-[100dvh] min-h-0 w-full max-w-full overflow-hidden pms-canvas font-sans"
      onRefresh={handlePullRefresh}
    >
      {/* Top Full-Width Unified Header matching szsz.png */}
      <TopBar />

      {!deviceMutationAvailability.canMutate && (
        <section
          role="alert"
          className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
            <div>
              <strong>Mode lecture seule — toutes les mutations métier sont bloquées.</strong>{' '}
              <span className="block text-xs opacity-80">La consultation et la navigation restent disponibles.</span>{' '}
              {deviceMutationAvailability.reason === 'registry_missing'
                ? 'Cet établissement ne possède pas encore de registre d’appareils.'
                : deviceMutationAvailability.reason === 'no_coordination_authority'
                  ? 'Le mode multi-appareils exige une autorité de coordination authentifiée.'
                  : deviceMutationAvailability.reason === 'data_not_ready'
                    ? 'Les données locales sont encore en cours de chargement.'
                    : 'L’identité ou les autorisations de cet appareil ne peuvent pas être vérifiées.'}
              {deviceSetupError && <span className="ml-2 block text-rose-700 dark:text-rose-300">{deviceSetupError}</span>}
            </div>
            {deviceMutationAvailability.reason === 'registry_missing' && (
              <button
                type="button"
                disabled={isConfiguringDevice}
                onClick={() => void handleConfigureSingleDevice()}
                className="min-h-9 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950"
              >
                {isConfiguringDevice ? 'Configuration…' : 'Enregistrer cet appareil comme appareil unique'}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Right Main Working View */}
        <div className="relative z-0 flex-1 flex flex-col h-full overflow-hidden min-w-0">

          <main key={activeView} className="flex-1 flex flex-col overflow-hidden relative pms-fade">
            <ViewErrorBoundary language={language}>
              <Suspense fallback={<ViewFallback />}>
                {activeView === 'planning' && activeRoleDefinition.allowedTabs.includes('planning') && (
                  isInitialSyncReady ? (
                    <>
                      <PlanningTimeline />
                      <LegendBar />
                    </>
                  ) : (
                    <section className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5" aria-live="polite" aria-busy={cloudSyncStatus.isSyncing}>
                      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <span className={`mx-auto mb-3 block h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 ${cloudSyncStatus.isSyncing ? 'animate-spin' : ''}`} />
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                          {language === 'fr' ? 'Synchronisation requise avant le Gantt' : language === 'ar' ? 'المزامنة مطلوبة قبل المخطط' : 'Sync required before opening Gantt'}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {cloudSyncStatus.lastError
                            ? cloudSyncStatus.lastError
                            : cloudSyncStatus.phase === 'no_workspace'
                              ? (language === 'fr' ? 'Aucun espace de travail autorisé pour ce compte. Le propriétaire de l’hôtel doit vous ajouter comme membre du workspace.' : language === 'ar' ? 'لا توجد مساحة عمل مصرح بها لهذا الحساب. يجب على مالك الفندق إضافتك كعضو.' : 'This account has no accessible workspace. The hotel owner must add you as a workspace member.')
                              : cloudSyncStatus.isSyncing
                                ? (language === 'fr' ? 'Chargement et vérification des données de cet espace…' : language === 'ar' ? 'جارٍ تحميل بيانات مساحة العمل والتحقق منها…' : 'Loading and verifying this workspace data…')
                                : (language === 'fr' ? 'Le Gantt restera masqué tant que le premier chargement et la vérification de synchronisation ne sont pas terminés.' : language === 'ar' ? 'سيبقى المخطط مخفيًا حتى اكتمال التحميل الأول والتحقق من المزامنة.' : 'Gantt stays hidden until the initial load and sync verification are complete.')}
                        </p>
                        <button
                          type="button"
                          disabled={cloudSyncStatus.isSyncing}
                          onClick={() => void forceSupabaseSync()}
                          className="mt-4 min-h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          {cloudSyncStatus.isSyncing
                            ? (language === 'fr' ? 'Synchronisation…' : language === 'ar' ? 'جارٍ التزامن…' : 'Synchronizing…')
                            : (language === 'fr' ? 'Réessayer la synchronisation' : language === 'ar' ? 'إعادة محاولة المزامنة' : 'Retry synchronization')}
                        </button>
                      </div>
                    </section>
                  )
                )}

                {activeView === 'tasks' && <TasksManagementView />}

                {activeView === 'stock' && <StockManagementView />}

                {activeView === 'pricing' && <DynamicPricingView />}

                {activeView === 'analytics' && <BookingAnalyticsView />}

                {activeView === 'billing' && <BillingInvoicingView />}

                {activeView === 'my_bookings' && <MyBookingsView />}

                {activeView === 'housekeeping' && <HousekeepingView />}

                {activeView === 'lost_property' && <LostPropertyView />}

                {activeView === 'channels' && <ChannelManagerView />}

                {activeView === 'reports' && <ReportsView />}

                {activeView === 'events' && <EventLogView />}

                {activeView === 'prousb' && <ProUsbLockSystemView />}

                {activeView === 'spa' && <SpaManagementView />}

                {activeView === 'roles' && <RoleManagementView />}

                {activeView === 'help' && <HelpCenterView />}

              </Suspense>
            </ViewErrorBoundary>
          </main>

        </div>
      </div>

      {/* Bottom-docked evidence-based Supabase sync terminal */}
      <SyncTerminal />

      {/* Global Interactive Modals — mounted on demand */}
      <Suspense fallback={null}>
        {isNewBookingModalOpen || selectedBooking ? <BookingModal /> : null}
        {isCockpitOpen && (activeRoleDefinition.permissions.canManageRoles || activeRoleDefinition.permissions.canManageBookings) && <AgentsCockpitModal />}
        {isLegalModalOpen && <LegalModal />}
        {isIndexedDBOpen && (activeRoleDefinition.permissions.canManageRoles || activeRoleDefinition.permissions.canManageBookings) && (
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
        {isSetupModalVisible && (activeRoleDefinition.permissions.canManageRoles || activeRoleDefinition.permissions.canManageBookings || !hasOnboarded) && (
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
