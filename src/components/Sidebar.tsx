import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Receipt,
  BarChart3,
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
  LogOut,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { DomainType } from '../types/booking';
import { APP_THEMES } from '../data/themes';
import { supabase } from '../services/supabase/supabaseClient';

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
    currentRole,
    setCurrentRole,
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
  } = useApp();

  // Collapsible state persisted to localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('omnibook_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('omnibook_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  const [isMobileProfileExpanded, setIsMobileProfileExpanded] = useState(false);
  const [isMobilePreferencesExpanded, setIsMobilePreferencesExpanded] = useState(false);
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

  const renderContent = (isMobileView: boolean) => {
    const showCompact = isCollapsed && !isMobileView;

    return (
      <div className="flex-1 min-h-0 w-full workspace-sidebar-scroll overflow-y-auto overscroll-y-contain pb-10 flex flex-col select-none">
        {/* Brand Header */}
        <div className={`min-h-[64px] border-b border-slate-200 dark:border-white/5 flex items-center shrink-0 ${showCompact ? 'flex-col justify-center px-1 py-2 gap-1.5' : 'justify-between px-4'}`}>
          {!showCompact ? (
            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
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
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0" title={getTranslation('brandName', language)}>
              AP
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
              onClick={toggleCollapse}
              className={`rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                showCompact ? 'w-8 h-8' : 'w-8 h-8 ml-auto rtl:ml-0 rtl:mr-auto'
              }`}
              title={showCompact ? getTranslation('sidebarExpand', language) : getTranslation('sidebarCollapse', language)}
              aria-label={showCompact ? getTranslation('sidebarExpand', language) : getTranslation('sidebarCollapse', language)}
            >
              {showCompact ? (isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
            </button>
          )}
        </div>

        {/* Global Navigation List: unified for desktop, tablet, and mobile */}
        <nav
          aria-label={language === 'fr' ? 'Navigation principale' : language === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}
          className={`py-2.5 ${showCompact ? 'px-1.5' : 'px-3'} flex-none border-b border-slate-200/80 dark:border-slate-800/80`}
        >
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.view)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={`workspace-nav-item cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors ${
                    showCompact
                      ? `mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm font-bold ring-2 ring-blue-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
                        }`
                      : `w-full flex items-center gap-3 px-3 min-h-11 py-2.5 rounded-xl text-xs font-semibold ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
                        }`
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  {!showCompact && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile profile switcher: collapsible */}
        {isMobileView && (
          <section className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/60 shrink-0">
            <button
              type="button"
              aria-expanded={isMobileProfileExpanded}
              onClick={() => setIsMobileProfileExpanded((expanded) => !expanded)}
              className="flex w-full min-h-9 items-center justify-between gap-2 text-left rtl:text-right cursor-pointer"
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
                      className={`flex min-h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left rtl:text-right text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer ${
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

        {/* Drawer preferences: Language, Theme & Sound */}
        {!showCompact && (
          <section className="px-3 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/70 space-y-2 shrink-0">
            <button
              type="button"
              aria-expanded={isMobilePreferencesExpanded}
              onClick={() => setIsMobilePreferencesExpanded((expanded) => !expanded)}
              className="flex w-full min-h-9 items-center justify-between gap-2 cursor-pointer"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Palette size={13} className="text-amber-500" />
                {language === 'fr' ? 'Thème & Langue' : language === 'ar' ? 'السمة واللغة' : 'Theme & Language'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {language === 'ar' ? 'عربي' : language.toUpperCase()} · {theme === 'dark' ? (language === 'ar' ? 'ليلي' : 'Dark') : (language === 'ar' ? 'نهاري' : 'Light')}
                </span>
                <ChevronDown size={15} className={`text-slate-400 transition-transform ${isMobilePreferencesExpanded ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {isMobilePreferencesExpanded && (
              <div className="space-y-2">
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{language === 'fr' ? 'Langue' : language === 'ar' ? 'اللغة' : 'Language'}</span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-1">
                    {(['fr', 'en', 'ar'] as const).map((locale) => (
                      <button key={locale} type="button" onClick={() => setLanguage(locale)} className={'min-h-8 rounded-md text-[11px] font-bold transition-colors cursor-pointer ' + (language === locale ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white')}>
                        {locale === 'ar' ? 'العربية' : locale.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-2 text-[11px] text-slate-700 dark:text-slate-300">
                    <span>{language === 'fr' ? 'Devise' : language === 'ar' ? 'العملة' : 'Currency'}</span>
                    <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="max-w-[5.5rem] min-w-0 bg-transparent text-right rtl:text-left text-[11px] font-bold text-amber-600 dark:text-amber-300 outline-none">
                      <option value="DZD">DZD (DA)</option><option value="DA">DA</option><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option><option value="SAR">SAR</option><option value="RMB">RMB (¥)</option><option value="CAD">CAD ($)</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-500" />}
                    {theme === 'dark' ? (language === 'fr' ? 'Mode clair' : language === 'ar' ? 'الوضع النهاري' : 'Light mode') : (language === 'fr' ? 'Mode sombre' : language === 'ar' ? 'الوضع الليلي' : 'Dark mode')}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={toggleSound} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    {isSoundEnabled ? <Volume2 size={14} className="text-emerald-500" /> : <VolumeX size={14} className="text-slate-400" />}
                    {isSoundEnabled ? (language === 'fr' ? 'Sons activés' : language === 'ar' ? 'الأصوات مفعلة' : 'Sound on') : (language === 'fr' ? 'Sons coupés' : language === 'ar' ? 'الأصوات معطلة' : 'Sound off')}
                  </button>
                  <button type="button" onClick={() => { setIsEstablishmentModalOpen(true); setIsSidebarMobileOpen(false); }} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    <Sliders size={14} className="text-blue-500" />
                    {language === 'fr' ? 'Établissement' : language === 'ar' ? 'المؤسسة' : 'Property'}
                  </button>
                </div>

                {/* Multi-Theme Selector */}
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
                      {language === 'fr' ? 'Galerie (8 thèmes)' : language === 'ar' ? 'معرض السمات (8)' : 'Gallery (8 themes)'}
                    </button>
                  </div>
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



        {/* Sidebar Footer: Theme Gallery, Mode Switcher, IndexedDB, Legal & About */}
        <div className={`border-t border-slate-200 dark:border-white/5 space-y-1.5 bg-slate-100/60 dark:bg-slate-950/40 shrink-0 ${showCompact ? 'p-1.5 flex flex-col items-center' : 'p-3'}`}>
          {/* Visual Themes Modal Opener */}
          <button
            type="button"
            onClick={() => {
              setIsThemeModalOpen(true);
              setIsSidebarMobileOpen(false);
            }}
            className={`cursor-pointer transition-colors shadow-2xs ${
              showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
            title={language === 'fr' ? 'Changer de thème visuel et de palette' : language === 'ar' ? 'تغيير السمة ولوحة الألوان' : 'Change theme & visual palette'}
            aria-label={language === 'fr' ? 'Thèmes Visuels' : language === 'ar' ? 'السمات والألوان' : 'Visual Themes'}
          >
            <Palette size={16} className="text-amber-500 shrink-0" />
            {!showCompact && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{language === 'fr' ? 'Thèmes Visuels' : language === 'ar' ? 'السمات والألوان' : 'Visual Themes'}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">8+</span>
              </div>
            )}
          </button>

          {/* Quick Light/Dark Toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`cursor-pointer transition-colors shadow-2xs ${
              showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
            title={theme === 'dark' ? (language === 'fr' ? 'Passer au mode clair' : language === 'ar' ? 'التحويل إلى الوضع النهاري' : 'Switch to light mode') : (language === 'fr' ? 'Passer au mode sombre' : language === 'ar' ? 'التحويل إلى الوضع الليلي' : 'Switch to dark mode')}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} className="text-amber-400 shrink-0" /> : <Moon size={16} className="text-blue-500 shrink-0" />}
            {!showCompact && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{theme === 'dark' ? (language === 'fr' ? 'Mode clair' : language === 'ar' ? 'الوضع النهاري' : 'Light mode') : (language === 'fr' ? 'Mode sombre' : language === 'ar' ? 'الوضع الليلي' : 'Dark mode')}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono">{theme}</span>
              </div>
            )}
          </button>

          {/* Local Data (IndexedDB) */}
          <button
            type="button"
            onClick={() => {
              setIsIndexedDBOpen(true);
              setIsSidebarMobileOpen(false);
            }}
            className={`cursor-pointer transition-colors shadow-2xs ${
              showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
            title={language === 'fr' ? 'Consulter les données enregistrées localement' : language === 'ar' ? 'عرض البيانات المخزنة محلياً' : 'Inspect locally stored data'}
            aria-label={language === 'fr' ? 'Données locales' : language === 'ar' ? 'البيانات المحلية' : 'Local Data'}
          >
            <Database size={16} className="text-cyan-500 shrink-0" />
            {!showCompact && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{language === 'fr' ? 'Données locales' : language === 'ar' ? 'البيانات المحلية' : 'Local Data'}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{language === 'fr' ? 'Navigateur' : language === 'ar' ? 'المتصفح' : 'Browser'}</span>
              </div>
            )}
          </button>

          {/* Legal Modal */}
          <button
            type="button"
            onClick={() => {
              setIsLegalModalOpen(true);
              setIsSidebarMobileOpen(false);
            }}
            className={`cursor-pointer transition-colors ${
              showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-850'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-850'
            }`}
            title={language === 'fr' ? 'Politique de Confidentialité et Suppression de Compte' : language === 'ar' ? 'سياسة الخصوصية وحذف الحساب' : 'Privacy Policy & Account Deletion'}
            aria-label={language === 'fr' ? 'Légal & Confidentialité' : language === 'ar' ? 'الخصوصية والحساب' : 'Legal & Privacy'}
          >
            <FileText size={16} className="shrink-0" />
            {!showCompact && (
              <span className="truncate">
                {language === 'fr' ? 'Légal & Confidentialité' : language === 'ar' ? 'الخصوصية والحساب' : 'Legal & Privacy'}
              </span>
            )}
          </button>

          {/* Appointment Académie & Tutoriels (Directly above À Propos) */}
          <button
            type="button"
            onClick={() => {
              setActiveView('help');
              setIsSidebarMobileOpen(false);
            }}
            className={`cursor-pointer transition-colors shadow-2xs ${
              activeView === 'help'
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60'
            }`}
            title={language === 'fr' ? 'Appointment Académie & Tutoriels' : language === 'ar' ? 'أكاديمية ودروس Appointment' : 'Appointment Academy & Tutorials'}
            aria-label={language === 'fr' ? 'Appointment Académie' : language === 'ar' ? 'أكاديمية Appointment' : 'Appointment Academy'}
          >
            <GraduationCap size={16} className={`shrink-0 ${activeView === 'help' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            {!showCompact && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate font-bold">
                  {language === 'fr' ? 'Appointment Académie' : language === 'ar' ? 'أكاديمية Appointment' : 'Appointment Academy'}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  activeView === 'help' ? 'bg-white/20 text-white' : 'bg-blue-200/70 dark:bg-blue-900/70 text-blue-800 dark:text-blue-200'
                }`}>
                  PRO
                </span>
              </div>
            )}
          </button>

          {/* About Modal */}
          <button
            type="button"
            onClick={() => {
              setIsAboutModalOpen(true);
              setIsSidebarMobileOpen(false);
            }}
            className={`cursor-pointer transition-colors ${
              showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
            }`}
            title={language === 'fr' ? 'À Propos de FORSLOG LTD et du Développeur S.M. Ramzi Guedouar' : language === 'ar' ? 'حول FORSLOG LTD والمطور رمزي قدوار' : 'About FORSLOG LTD & Developer S.M. Ramzi Guedouar'}
            aria-label="About"
          >
            <Info size={16} className="shrink-0 text-cyan-600 dark:text-cyan-400" />
            {!showCompact && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{language === 'fr' ? 'À Propos' : language === 'ar' ? 'حول النظام' : 'About'}</span>
                <span className="text-[10px] text-cyan-800 dark:text-cyan-300 font-mono bg-cyan-200/70 dark:bg-cyan-900/60 px-1.5 py-0.5 rounded">FORSLOG</span>
              </div>
            )}
          </button>

          {/* Déconnexion / Logout */}
          <button
            type="button"
            onClick={async () => {
              if (supabase) {
                try {
                  await supabase.auth.signOut();
                } catch (e) {
                  console.warn('Sign out error:', e);
                }
              }
              setCurrentRole('client');
              setIsSidebarMobileOpen(false);
            }}
            className={`cursor-pointer transition-colors ${
              showCompact
                ? 'mx-auto w-10 h-10 min-h-10 flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/80'
                : 'w-full flex items-center gap-2.5 px-3 min-h-[42px] py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/80'
            }`}
            title={language === 'fr' ? 'Déconnexion de la session' : language === 'ar' ? 'تسجيل الخروج من الجلسة' : 'Log out from session'}
            aria-label={language === 'fr' ? 'Déconnexion' : language === 'ar' ? 'تسجيل الخروج' : 'Log out'}
          >
            <LogOut size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            {!showCompact && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate font-bold text-rose-700 dark:text-rose-300">
                  {language === 'fr' ? 'Déconnexion' : language === 'ar' ? 'تسجيل الخروج' : 'Log out'}
                </span>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono uppercase font-bold">
                  {currentRole}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Collapsible Sidebar */}
      <aside
        className={`workspace-sidebar hidden md:flex text-slate-700 dark:text-slate-300 flex-col shrink-0 border-r border-slate-200 dark:border-slate-800/80 transition-[width] duration-200 ease-out z-30 backdrop-blur-md ${
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
            className={`relative z-10 flex h-[100dvh] max-h-[100dvh] min-h-0 w-[min(20rem,88vw)] max-w-[88vw] flex-col overflow-hidden border-r border-[rgb(var(--pms-border))] bg-[rgb(var(--pms-surface))] text-slate-800 dark:text-slate-300 shadow-2xl pms-drawer ${isRtl ? 'mr-auto border-l border-r-0' : 'ml-0'}`}
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
