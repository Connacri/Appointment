import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Receipt,
  BarChart3,
  Hotel,
  Palmtree,
  Sparkles,
  Database,
  ClipboardList,
  Boxes,
  KeyRound,
  CheckCircle2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Coins,
  Globe,
  Flower2,
  Info,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Sliders,
  ShieldCheck,
  User,
  Palette,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { domainConfigs } from '../data/mockData';
import { DomainType } from '../types/booking';
import { APP_THEMES } from '../data/themes';

export const Sidebar: React.FC = () => {
  const {
    language,
    setLanguage,
    activeView,
    setActiveView,
    theme,
    setTheme,
    appTheme,
    setAppTheme,
    setIsThemeModalOpen,
    currentDomain,
    setCurrentDomain,
    currentRole,
    setCurrentRole,
    activeSector,
    setActiveSector,
    setIsLegalModalOpen,
    setIsIndexedDBOpen,
    setIsAboutModalOpen,
    setIsEstablishmentModalOpen,
    currency,
    setCurrency,
    isSoundEnabled,
    toggleSound,
    isSidebarMobileOpen,
    setIsSidebarMobileOpen,
    activeWorkspaceId,
    workspaces,
    setActiveWorkspaceId,
    refreshWorkspaces,
    createWorkspace,
    isWorkspaceLoading,
    workspaceError,
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileProfileExpanded, setIsMobileProfileExpanded] = useState(false);
  const [isMobilePreferencesExpanded, setIsMobilePreferencesExpanded] = useState(true);
  const [workspaceFormOpen, setWorkspaceFormOpen] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const isRtl = language === 'ar';

  // Keep the page fixed while the mobile navigation drawer is open.
  useEffect(() => {
    if (!isSidebarMobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarMobileOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSidebarMobileOpen, setIsSidebarMobileOpen]);

  // Strictly filter navigation items by Role AND Domain for Hotel & Resort
  const allNavItems = [
    {
      id: 'help',
      label: language === 'fr' ? 'Centre d’aide & Tutoriels' : language === 'ar' ? 'مركز المساعدة والدروس' : 'Help Center & Tutorials',
      icon: BookOpen,
      view: 'help' as const,
      roles: ['admin', 'manager', 'receptionist', 'staff', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'planning',
      label: language === 'fr' ? 'Planning Gantt' : language === 'ar' ? 'مخطط الحجوزات' : 'Gantt Planning',
      icon: CalendarDays,
      view: 'planning' as const,
      roles: ['manager', 'receptionist', 'staff', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'analytics',
      label: currentDomain === 'resort'
        ? (language === 'fr' ? 'Analytics Resort & Villas (D3)' : language === 'ar' ? 'تحليلات المنتجع والفيلات' : 'Resort Analytics (D3)')
        : (language === 'fr' ? 'Booking Analytics (D3)' : language === 'ar' ? 'تحليلات الحجوزات' : 'Booking Analytics (D3)'),
      icon: BarChart3,
      view: 'analytics' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'billing',
      label: language === 'fr' ? 'Facturation & Devis' : language === 'ar' ? 'الفواتير وعروض الأسعار' : 'Billing & Quotes',
      icon: Receipt,
      view: 'billing' as const,
      roles: ['manager', 'receptionist', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'my_bookings',
      label: currentDomain === 'resort'
        ? (language === 'fr' ? 'Séjours & Villas Resort' : language === 'ar' ? 'إقامات وفلل المنتجع' : 'Resort Bookings')
        : (language === 'fr' ? 'Séjours & Réservations' : language === 'ar' ? 'الحجوزات والإقامات' : 'My Bookings'),
      icon: LayoutDashboard,
      view: 'my_bookings' as const,
      roles: ['manager', 'receptionist', 'client'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'housekeeping',
      label: currentDomain === 'resort'
        ? (language === 'fr' ? 'Gouvernance & Entretien Villas' : language === 'ar' ? 'خدمة الغرف وصيانة الفلل' : 'Resort Housekeeping')
        : (language === 'fr' ? 'Housekeeping & Étages' : language === 'ar' ? 'خدمة الغرف والأدوار' : 'Housekeeping & Rooms'),
      icon: Sparkles,
      view: 'housekeeping' as const,
      roles: ['manager', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'tasks',
      label: language === 'fr' ? 'Tâches PMS & Remise en État' : language === 'ar' ? 'مهام التشغيل والصيانة' : 'PMS Tasks',
      icon: ClipboardList,
      view: 'tasks' as const,
      roles: ['manager', 'receptionist', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'stock',
      label: language === 'fr' ? 'Stock & Équipements' : language === 'ar' ? 'المخزون والمستلزمات' : 'Inventory & Supplies',
      icon: Boxes,
      view: 'stock' as const,
      roles: ['manager', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'pricing',
      label: language === 'fr' ? 'Yield & Tarifs Dynamiques' : language === 'ar' ? 'التسعير الديناميكي' : 'Yield & Pricing',
      icon: Coins,
      view: 'pricing' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'channels',
      label: language === 'fr' ? 'Channel Manager (OTA)' : language === 'ar' ? 'مدير القنوات الموزعة' : 'Channel Manager',
      icon: Globe,
      view: 'channels' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'prousb',
      label: language === 'fr' ? 'Serrures proUSB (WebHID)' : language === 'ar' ? 'أقفال proUSB الذكية' : 'proUSB Locks (WebHID)',
      icon: KeyRound,
      view: 'prousb' as const,
      roles: ['manager', 'receptionist'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'spa',
      label: language === 'fr' ? 'Spa & Espace Bien-Être' : language === 'ar' ? 'السبا والعافية' : 'Spa & Wellness',
      icon: Flower2,
      view: 'spa' as const,
      roles: ['manager', 'receptionist', 'client', 'staff'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
    {
      id: 'reports',
      label: language === 'fr' ? 'Rapports d\'Activité' : language === 'ar' ? 'التقارير والإحصائيات' : 'Performance Reports',
      icon: FileText,
      view: 'reports' as const,
      roles: ['manager'],
      domains: ['hotel', 'resort'] as DomainType[],
    },
  ];

  const navItems = allNavItems.filter(
    (item) => (currentRole === 'admin' || item.roles.includes(currentRole)) && item.domains.includes(currentDomain)
  );

  const handleNavClick = (view: any) => {
    setActiveView(view);
    setIsSidebarMobileOpen(false);
  };

  const renderContent = (isMobileView: boolean) => (
    <div className={`flex flex-col min-h-full select-none ${isMobileView ? "workspace-sidebar-scroll overflow-y-auto overscroll-y-contain" : "h-full min-h-0 overflow-hidden"}`}>
      {/* Brand Header */}
      <div className="min-h-[68px] border-b border-slate-200 dark:border-white/5 px-4 flex items-center justify-between shrink-0">
        {(!isCollapsed || isMobileView) && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              AP
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight leading-none truncate">
                {getTranslation('brandName', language)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                Front Desk & Resort PMS
              </span>
            </div>
          </div>
        )}

        {isMobileView ? (
          <button
            type="button"
            onClick={() => setIsSidebarMobileOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ml-auto rtl:ml-0 rtl:mr-auto transition-colors"
            title={language === 'fr' ? 'Fermer le menu' : language === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors ml-auto rtl:ml-0 rtl:mr-auto cursor-pointer"
            title={
              isCollapsed
                ? (language === 'fr' ? 'Agrandir le menu' : language === 'ar' ? 'توسيع القائمة' : 'Expand sidebar')
                : (language === 'fr' ? 'Réduire le menu' : language === 'ar' ? 'طي القائمة' : 'Collapse sidebar')
            }
          >
            {isCollapsed ? (isRtl ? <ChevronLeft size={17} /> : <ChevronRight size={17} />) : (isRtl ? <ChevronRight size={17} /> : <ChevronLeft size={17} />)}
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      <section className={`shrink-0 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/70 px-3 py-3 space-y-2 ${isCollapsed && !isMobileView ? 'items-center' : ''}`}>
        {(!isCollapsed || isMobileView) ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {language === 'fr' ? 'Espace de travail' : language === 'ar' ? 'مساحة العمل' : 'Workspace'}
              </span>
              <button
                type="button"
                onClick={() => { setWorkspaceFormOpen((open) => !open); setWorkspaceActionError(null); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-white transition-colors cursor-pointer"
                title={language === 'fr' ? 'Créer un espace' : language === 'ar' ? 'إنشاء مساحة عمل' : 'Create workspace'}
                aria-label="Create workspace"
              >
                <Plus size={14} />
              </button>
            </div>
            <select
              value={activeWorkspaceId}
              onChange={(event) => setActiveWorkspaceId(event.target.value)}
              disabled={isWorkspaceLoading || workspaces.length === 0}
              aria-label={language === 'fr' ? 'Espace de travail actif' : language === 'ar' ? 'مساحة العمل النشطة' : 'Active workspace'}
              title={workspaceError || (language === 'fr' ? 'Espace de travail actif' : language === 'ar' ? 'مساحة العمل النشطة' : 'Active workspace')}
              className="h-9 w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">
                {isWorkspaceLoading
                  ? (language === 'fr' ? 'Chargement…' : language === 'ar' ? 'جارٍ التحميل…' : 'Loading…')
                  : workspaces.length
                  ? (language === 'fr' ? 'Choisir un espace' : language === 'ar' ? 'اختر مساحة' : 'Select workspace')
                  : (language === 'fr' ? 'Aucun espace' : language === 'ar' ? 'لا توجد مساحات' : 'No workspace')}
              </option>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            {(workspaceError || workspaceActionError) && <p role="alert" className="text-[10px] leading-relaxed text-rose-500 dark:text-rose-300">{workspaceActionError || workspaceError}</p>}
            {workspaceError && (
              <button type="button" onClick={() => void refreshWorkspaces()} className="text-[10px] font-semibold text-blue-600 dark:text-blue-300 hover:underline">
                {language === 'fr' ? 'Réessayer' : language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
            )}
            {workspaceFormOpen && (
              <form onSubmit={async (event) => { event.preventDefault(); setWorkspaceActionError(null); try { await createWorkspace(workspaceDraft); setWorkspaceDraft(''); setWorkspaceFormOpen(false); } catch (error) { setWorkspaceActionError(error instanceof Error ? error.message : 'Échec de création.'); } }} className="space-y-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 shadow-sm">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">{language === 'fr' ? 'Nom du nouvel espace' : language === 'ar' ? 'اسم مساحة العمل الجديدة' : 'New workspace name'}</label>
                <input autoFocus value={workspaceDraft} onChange={(event) => setWorkspaceDraft(event.target.value)} maxLength={80} minLength={2} required placeholder={language === 'fr' ? 'Ex. Mon établissement' : language === 'ar' ? 'مثال: فندقي' : 'e.g. My Hotel'} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setWorkspaceFormOpen(false)} className="rounded-md px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">{language === 'fr' ? 'Annuler' : language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                  <button type="submit" disabled={isWorkspaceLoading} className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{language === 'fr' ? 'Créer' : language === 'ar' ? 'إنشاء' : 'Create'}</button>
                </div>
              </form>
            )}
          </>
        ) : (
          <button type="button" onClick={() => setIsCollapsed(false)} title={activeWorkspaceId || 'Workspace'} aria-label="Show workspace selector" className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-300">
            <Database size={16} />
          </button>
        )}
      </section>

      {/* Mobile profile switcher: collapsed by default. */}
      {isMobileView && (
        <section className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/60 shrink-0">
          <button
            type="button"
            aria-expanded={isMobileProfileExpanded}
            onClick={() => setIsMobileProfileExpanded((expanded) => !expanded)}
            className="flex w-full min-h-9 items-center justify-between gap-2 text-left rtl:text-right"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              {language === 'fr' ? 'Profil de travail' : language === 'ar' ? 'ملف العمل' : 'Work profile'}
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
                {currentRole === 'admin' ? 'Admin' : currentRole === 'manager' ? (language === 'fr' ? 'Gérant' : language === 'ar' ? 'مدير' : 'Manager') : currentRole === 'receptionist' ? (language === 'fr' ? 'Réception' : language === 'ar' ? 'استقبال' : 'Front desk') : currentRole === 'staff' ? (language === 'fr' ? 'Étage' : language === 'ar' ? 'طاقم العمل' : 'Staff') : (language === 'fr' ? 'Client' : language === 'ar' ? 'نزيل' : 'Guest')}
              </span>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${isMobileProfileExpanded ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {isMobileProfileExpanded && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {[
                { id: 'admin', label: 'Admin', icon: ShieldCheck },
                { id: 'manager', label: language === 'fr' ? 'Gérant' : language === 'ar' ? 'مدير' : 'Manager', icon: LayoutDashboard },
                { id: 'receptionist', label: language === 'fr' ? 'Réception' : language === 'ar' ? 'استقبال' : 'Front desk', icon: CalendarDays },
                { id: 'staff', label: language === 'fr' ? 'Étage' : language === 'ar' ? 'طاقم العمل' : 'Housekeeping', icon: Sparkles },
                { id: 'client', label: language === 'fr' ? 'Client' : language === 'ar' ? 'نزيل' : 'Guest', icon: User },
              ].map((role) => {
                const RoleIcon = role.icon;
                const isSelected = currentRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setCurrentRole(role.id as any)}
                    className={`flex min-h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left rtl:text-right text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isSelected
                        ? 'border-blue-400/70 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <RoleIcon size={15} className={`shrink-0 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span className="truncate">{role.label}</span>
                    {isSelected && <CheckCircle2 size={13} className="ml-auto rtl:ml-0 rtl:mr-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Drawer preferences: Language & Theme */}
      {(!isCollapsed || isMobileView) && (
        <section className="px-3 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/70 space-y-2 shrink-0">
          <button
            type="button"
            aria-expanded={isMobilePreferencesExpanded}
            onClick={() => setIsMobilePreferencesExpanded((expanded) => !expanded)}
            className="flex w-full min-h-9 items-center justify-between gap-2 cursor-pointer"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Palette size={13} className="text-amber-500" />
              {language === "fr" ? "Thème & Langue" : language === "ar" ? "السمة واللغة" : "Theme & Language"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {language === "ar" ? "عربي" : language.toUpperCase()} · {theme === 'dark' ? (language === 'ar' ? 'ليلي' : 'Dark') : (language === 'ar' ? 'نهاري' : 'Light')}
              </span>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${isMobilePreferencesExpanded ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {isMobilePreferencesExpanded && (
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{language === "fr" ? "Langue" : language === "ar" ? "اللغة" : "Language"}</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-1">
                  {(["fr", "en", "ar"] as const).map((locale) => (
                    <button key={locale} type="button" onClick={() => setLanguage(locale)} className={"min-h-8 rounded-md text-[11px] font-bold transition-colors " + (language === locale ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white")}>
                      {locale === "ar" ? "العربية" : locale.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <span>{language === "fr" ? "Devise" : language === "ar" ? "العملة" : "Currency"}</span>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="max-w-[5.5rem] min-w-0 bg-transparent text-right rtl:text-left text-[11px] font-bold text-amber-600 dark:text-amber-300 outline-none">
                    <option value="DZD">DZD (DA)</option><option value="DA">DA</option><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option><option value="SAR">SAR</option><option value="RMB">RMB (¥)</option><option value="CAD">CAD ($)</option>
                  </select>
                </label>
                <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  {theme === "dark" ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-500" />}
                  {theme === "dark" ? (language === "fr" ? "Mode clair" : language === "ar" ? "الوضع النهاري" : "Light mode") : (language === "fr" ? "Mode sombre" : language === "ar" ? "الوضع الليلي" : "Dark mode")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={toggleSound} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  {isSoundEnabled ? <Volume2 size={14} className="text-emerald-500" /> : <VolumeX size={14} className="text-slate-400" />}
                  {isSoundEnabled ? (language === "fr" ? "Sons activés" : language === "ar" ? "الأصوات مفعلة" : "Sound on") : (language === "fr" ? "Sons coupés" : language === "ar" ? "الأصوات معطلة" : "Sound off")}
                </button>
                <button type="button" onClick={() => { setIsEstablishmentModalOpen(true); setIsSidebarMobileOpen(false); }} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  <Sliders size={14} className="text-blue-500" />
                  {language === "fr" ? "Établissement" : language === "ar" ? "المؤسسة" : "Property"}
                </button>
              </div>

              {/* Multi-Theme Selector (All 8 User Photo Themes + Default) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Palette size={13} className="text-amber-500" />
                    {getTranslation('chooseTheme', language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsThemeModalOpen(true); setIsSidebarMobileOpen(false); }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {language === "fr" ? "Galerie (8 thèmes)" : language === "ar" ? "معرض السمات (8)" : "Gallery (8 themes)"}
                  </button>
                </div>
                {/* 1-tap theme switcher chips inside drawer */}
                <div className="grid grid-cols-3 gap-1.5">
                  {APP_THEMES.map((t) => {
                    const isSelected = appTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAppTheme(t.id)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/40 font-bold shadow-2xs'
                            : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
                        }`}
                        title={t.subtitle[language] || t.subtitle.fr}
                      >
                        <div className="flex items-center gap-0.5 w-full h-2 rounded overflow-hidden shadow-2xs">
                          {t.colors.slice(0, 3).map((c, i) => (
                            <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className="truncate w-full text-center text-[9px] leading-tight">
                          {t.name[language]?.split(' ')[0] || t.name.fr.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Navigation List */}
      <nav aria-label={language === "fr" ? "Navigation principale" : language === "ar" ? "التنقل الرئيسي" : "Main navigation"} className={`py-3 px-2.5 ${isMobileView ? "flex-none overflow-visible" : "flex-1 min-h-0 overflow-y-auto overscroll-y-contain"}`}>
        <div className="pms-stagger flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.view)}
                aria-current={isActive ? "page" : undefined}
                className={`workspace-nav-item w-full flex items-center gap-3 px-3 min-h-11 py-2.5 rounded-xl text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
                }`}
                title={item.label}
              >
                <Icon size={18} className="shrink-0" />
                {(!isCollapsed || isMobileView) && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sidebar Footer: Theme Picker, IndexedDB, Legal & About */}
      <div className="p-3 border-t border-slate-200 dark:border-white/5 space-y-1.5 bg-slate-100/60 dark:bg-slate-950/40 shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsThemeModalOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer shadow-2xs"
          title={language === 'fr' ? 'Changer de thème visuel et de palette' : language === 'ar' ? 'تغيير السمة ولوحة الألوان' : 'Change theme & visual palette'}
        >
          <Palette size={16} className="text-amber-500 shrink-0" />
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{language === 'fr' ? 'Thèmes Visuels' : language === 'ar' ? 'السمات والألوان' : 'Visual Themes'}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">8+</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer shadow-2xs"
          title={theme === 'dark' ? (language === 'fr' ? 'Passer au mode clair' : language === 'ar' ? 'التحويل إلى الوضع النهاري' : 'Switch to light mode') : (language === 'fr' ? 'Passer au mode sombre' : language === 'ar' ? 'التحويل إلى الوضع الليلي' : 'Switch to dark mode')}
        >
          {theme === 'dark' ? <Sun size={16} className="text-amber-400 shrink-0" /> : <Moon size={16} className="text-blue-500 shrink-0" />}
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{theme === 'dark' ? (language === 'fr' ? 'Mode clair' : language === 'ar' ? 'الوضع النهاري' : 'Light mode') : (language === 'fr' ? 'Mode sombre' : language === 'ar' ? 'الوضع الليلي' : 'Dark mode')}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono">{theme}</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsIndexedDBOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer shadow-2xs"
          title={language === 'fr' ? 'Consulter les données enregistrées localement' : language === 'ar' ? 'عرض البيانات المخزنة محلياً' : 'Inspect locally stored data'}
        >
          <Database size={16} className="text-cyan-500 shrink-0" />
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{language === 'fr' ? 'Données locales' : language === 'ar' ? 'البيانات المحلية' : 'Local Data'}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{language === 'fr' ? 'Navigateur' : language === 'ar' ? 'المتصفح' : 'Browser'}</span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsLegalModalOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-850 transition-colors cursor-pointer"
          title={language === 'fr' ? 'Politique de Confidentialité et Suppression de Compte' : language === 'ar' ? 'سياسة الخصوصية وحذف الحساب' : 'Privacy Policy & Account Deletion'}
        >
          <FileText size={16} className="shrink-0" />
          {(!isCollapsed || isMobileView) && (
            <span className="truncate">
              {language === 'fr' ? 'Légal & Confidentialité' : language === 'ar' ? 'الخصوصية والحساب' : 'Legal & Privacy'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsAboutModalOpen(true);
            setIsSidebarMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors cursor-pointer"
          title={language === 'fr' ? 'À Propos de FORSLOG LTD et du Développeur S.M. Ramzi Guedouar' : language === 'ar' ? 'حول FORSLOG LTD والمطور رمزي قدوار' : 'About FORSLOG LTD & Developer S.M. Ramzi Guedouar'}
        >
          <Info size={16} className="shrink-0 text-cyan-600 dark:text-cyan-400" />
          {(!isCollapsed || isMobileView) && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{language === 'fr' ? 'À Propos' : language === 'ar' ? 'حول النظام' : 'About'}</span>
              <span className="text-[10px] text-cyan-800 dark:text-cyan-300 font-mono bg-cyan-200/70 dark:bg-cyan-900/60 px-1.5 py-0.5 rounded">FORSLOG</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`workspace-sidebar hidden md:flex text-slate-700 dark:text-slate-300 flex-col shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/95 dark:bg-slate-950/95 transition-[width] duration-200 ease-out z-30 backdrop-blur-md ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer (Modal Overlay) */}
      {isSidebarMobileOpen && (
        <div
          className="fixed inset-0 z-[9990] md:hidden flex pms-modal-backdrop"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <button
            type="button"
            aria-label={language === 'fr' ? 'Fermer le menu' : language === 'ar' ? 'إغلاق القائمة' : 'Close navigation'}
            className="absolute inset-0 w-full h-full bg-slate-950/70 backdrop-blur-[2px]"
            onClick={() => setIsSidebarMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={language === 'fr' ? 'Navigation principale' : language === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}
            className={`relative z-10 flex h-[100dvh] min-h-0 w-[min(20rem,88vw)] max-w-[88vw] flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-300 shadow-2xl overscroll-contain pms-drawer ${isRtl ? 'mr-auto border-l border-r-0' : 'ml-0'}`}
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
