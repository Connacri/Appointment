import React from 'react';
import { WifiOff, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';

export const OfflineBanner: React.FC = () => {
  const { isOffline, setIsOffline, language, cloudSyncStatus, forceSupabaseSync } = useApp();

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between text-xs font-medium z-30 shrink-0 shadow-xs">
      <div className="flex items-center gap-2">
        <WifiOff size={16} className="shrink-0" />
        <span>
          <strong>{getTranslation('offlineTitle', language)} :</strong>{' '}
          {getTranslation('offlineDesc', language)}
          {cloudSyncStatus.pendingCount > 0 && (
            <span className="ms-1.5 font-bold">
              ({getTranslation('supabaseStatusPending', language).replace('{count}', String(cloudSyncStatus.pendingCount))})
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator === 'undefined' || navigator.onLine) {
            setIsOffline(false);
            void forceSupabaseSync();
          }
        }}
        className="px-2.5 py-1 bg-slate-950 text-white rounded text-[11px] font-bold hover:bg-slate-800 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
      >
        <RotateCcw size={12} />
        <span>{getTranslation('supabaseForceSyncBtn', language)}</span>
      </button>
    </div>
  );
};
