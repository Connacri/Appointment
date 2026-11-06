import React from 'react';
import { useApp } from '../context/AppContext';
import { APP_THEMES } from '../data/themes';
import { getTranslation } from '../i18n/translations';
import { X, Check, Sun, Moon, Palette, Sparkles } from 'lucide-react';
import { AppThemeId } from '../types/booking';

export const ThemeSelectorModal: React.FC = () => {
  const {
    isThemeModalOpen,
    setIsThemeModalOpen,
    theme,
    setTheme,
    appTheme,
    setAppTheme,
    language,
    playFeedback,
  } = useApp();

  if (!isThemeModalOpen) return null;

  const isRTL = language === 'ar';

  const handleSelectTheme = (id: AppThemeId) => {
    setAppTheme(id);
    playFeedback('click');
  };

  const handleToggleMode = (mode: 'light' | 'dark') => {
    setTheme(mode);
    playFeedback('click');
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Palette size={20} />
            </div>
            <div className="min-w-0">
              <h2
                id="theme-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                {getTranslation('chooseTheme', language)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {getTranslation('themeSubtitle', language)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Light / Dark Mode Toggle inside Header */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleToggleMode('light')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={getTranslation('themeModeLight', language)}
              >
                <Sun size={13} className="text-amber-500" />
                <span className="hidden sm:inline">{getTranslation('themeModeLight', language)}</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode('dark')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={getTranslation('themeModeDark', language)}
              >
                <Moon size={13} className="text-blue-400" />
                <span className="hidden sm:inline">{getTranslation('themeModeDark', language)}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsThemeModalOpen(false)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content - Scrollable Theme Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {APP_THEMES.map((item) => {
              const isSelected = appTheme === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectTheme(item.id)}
                  className={`group relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/30 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
                  }`}
                >
                  {/* Top Row: Title & Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {item.name[language] || item.name.fr}
                      </h3>
                      <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.badge[language] || item.badge.fr}
                      </span>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 dark:border-slate-700 text-transparent group-hover:border-slate-400'
                      }`}
                    >
                      <Check size={13} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </div>
                  </div>

                  {/* Subtitle / Inspiration */}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3 line-clamp-2">
                    {item.subtitle[language] || item.subtitle.fr}
                  </p>

                  {/* Color Swatch Bar (Visual palette representation from photo) */}
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 mb-3">
                    {item.colors.map((c, i) => (
                      <div
                        key={i}
                        className="flex-1 h-5 rounded-md shadow-2xs border border-black/10 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>

                  {/* Micro Visual Preview Mock */}
                  <div
                    className="mt-auto p-2.5 rounded-lg border text-[10px] flex items-center justify-between transition-colors"
                    style={{
                      borderLeftWidth: !isRTL ? '4px' : '1px',
                      borderRightWidth: isRTL ? '4px' : '1px',
                      borderLeftColor: !isRTL ? item.stripColor : undefined,
                      borderRightColor: isRTL ? item.stripColor : undefined,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.accentColor }}
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isSelected
                          ? getTranslation('activeThemeBadge', language)
                          : getTranslation('applyThemeButton', language)}
                      </span>
                    </div>
                    <Sparkles
                      size={12}
                      className={isSelected ? 'text-blue-500' : 'text-slate-400'}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'fr'
              ? 'Le thème et le mode clair/sombre sont sauvegardés automatiquement.'
              : language === 'ar'
              ? 'يتم حفظ السمة المحددة والوضع النهاري/الليلي تلقائياً على جهازك.'
              : 'Selected theme and light/dark mode are automatically saved.'}
          </div>

          <button
            type="button"
            onClick={() => setIsThemeModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            {language === 'fr' ? 'Terminé' : language === 'ar' ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
