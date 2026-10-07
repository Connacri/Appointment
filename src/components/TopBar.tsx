import React from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import { PipelineStatusIndicator } from './PipelineStatusIndicator';

export const TopBar: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    searchQuery,
    setSearchQuery,
    dateRangeMode,
    setDateRangeMode,
    currentBaseDate,
    shiftDays,
    setIsNewBookingModalOpen,
    setNewBookingInitialSlot,
    isOffline,
    setIsOffline,
    activeSector,
    setActiveSector,
  } = useApp();

  // Helper to format date display
  const formatDateDisplay = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const [y, m, d] = currentBaseDate.split('-').map(Number);
  const endDateObj = new Date(y, m - 1, d);
  endDateObj.setDate(endDateObj.getDate() + (dateRangeMode === 'two_weeks' ? 13 : 27));
  const endDateFormatted = endDateObj.toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-EG' : 'en-US',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 md:px-4 gap-2 z-20 shrink-0">
      {/* Left zone: Search & Sector filter */}
      <div className="flex items-center gap-2 max-w-xs sm:max-w-sm shrink min-w-0">
        <div className="relative flex-1 min-w-[100px]">
          <Search
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'fr'
                ? 'Rechercher...'
                : language === 'ar'
                ? 'بحث...'
                : 'Search...'
            }
            className="w-full h-9 pl-8 pr-3 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
          />
        </div>

        {/* Sector Quick Dropdown */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveSector('all')}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              activeSector === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {getTranslation('sectorAll', language)}
          </button>
          <button
            onClick={() => setActiveSector('hotel')}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              activeSector === 'hotel'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Hôtel
          </button>
          <button
            onClick={() => setActiveSector('clinic')}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              activeSector === 'clinic'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Clinique
          </button>
          <button
            onClick={() => setActiveSector('wellness')}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              activeSector === 'wellness'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Spa/RDV
          </button>
        </div>
      </div>

      {/* Center Zone: Date navigation & range pills */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Step buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => shiftDays(-14)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Précédent (2 semaines)"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => shiftDays(-1)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Précédent (1 jour)"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="px-2 text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
            {formatDateDisplay(currentBaseDate)} - {endDateFormatted}
          </span>

          <button
            onClick={() => shiftDays(1)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Suivant (1 jour)"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => shiftDays(14)}
            className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
            title="Suivant (2 semaines)"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        {/* Two Weeks / One Month toggle */}
        <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => setDateRangeMode('two_weeks')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              dateRangeMode === 'two_weeks'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {language === 'fr' ? '14 Jours' : language === 'ar' ? 'أسبوعان' : 'Two Weeks'}
          </button>
          <button
            onClick={() => setDateRangeMode('one_month')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              dateRangeMode === 'one_month'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {language === 'fr' ? '1 Mois' : language === 'ar' ? 'شهر واحد' : 'One Month'}
          </button>
        </div>
      </div>

      {/* Right Zone: Add Booking CTA, Offline toggle, Language & Theme */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* GitHub Actions Pipeline Status Indicator */}
        <PipelineStatusIndicator />

        {/* Offline simulator toggle button */}
        <button
          onClick={() => setIsOffline(!isOffline)}
          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
            isOffline
              ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={isOffline ? 'Mode Hors-Ligne ACTIF' : 'Simuler Mode Hors-ligne'}
        >
          {isOffline ? <WifiOff size={16} /> : <Wifi size={16} />}
          <span className="hidden xl:inline text-[11px]">
            {isOffline ? 'Offline' : 'Online'}
          </span>
        </button>

        {/* Language selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-semibold">
          {(['fr', 'en', 'ar'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-1.5 py-1 rounded uppercase transition-colors ${
                language === lang
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title="Toggle Light / Dark Theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Primary Action Button: + New Booking matching green or cyan button in screenshot */}
        <button
          onClick={() => {
            setNewBookingInitialSlot(null);
            setIsNewBookingModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">
            {language === 'fr'
              ? '+ Nouveau Rendez-vous'
              : language === 'ar'
              ? '+ حجز جديد'
              : '+ New Booking'}
          </span>
          <span className="sm:hidden">
            {language === 'fr' ? 'Nouveau' : language === 'ar' ? 'جديد' : 'New'}
          </span>
        </button>
      </div>
    </header>
  );
};
