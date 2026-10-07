import React, { useState } from 'react';
import {
  X,
  Shield,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';

export const LegalModal: React.FC = () => {
  const {
    isLegalModalOpen,
    setIsLegalModalOpen,
    language,
    purgeAllUserData,
  } = useApp();

  const [hasPurged, setHasPurged] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  if (!isLegalModalOpen) return null;

  const handleExecutePurge = () => {
    purgeAllUserData();
    setHasPurged(true);
    setTimeout(() => {
      setHasPurged(false);
      setConfirmStep(false);
      setIsLegalModalOpen(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-500" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {getTranslation('legalTitle', language)}
            </span>
          </div>
          <button
            onClick={() => {
              setIsLegalModalOpen(false);
              setConfirmStep(false);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {hasPurged ? (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="font-bold text-sm">
                {getTranslation('deleteSuccessToast', language)}
              </p>
              <p className="text-[11px] opacity-80">
                Toutes les réservations et données locales ont été détruites conformément à l\'article 19 de AGENTS.md.
              </p>
            </div>
          ) : (
            <>
              {/* Public Legal Links */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Documents légaux et conformité Play Store (AGENTS.md §19.3) :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`/privacy/${language}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between font-medium text-slate-700 dark:text-slate-200"
                  >
                    <span>Politique de Confidentialité</span>
                    <ExternalLink size={13} className="text-slate-400" />
                  </a>

                  <a
                    href={`/delete-account/${language}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between font-medium text-slate-700 dark:text-slate-200"
                  >
                    <span>Portail Web de Suppression</span>
                    <ExternalLink size={13} className="text-slate-400" />
                  </a>
                </div>
              </div>

              {/* In-App Deletion Section */}
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2.5 text-rose-900 dark:text-rose-200">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                  <AlertTriangle size={16} />
                  <span>Droit à l'effacement et purge des données (In-App)</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {getTranslation('deleteAccountWarning', language)}
                </p>

                {!confirmStep ? (
                  <button
                    onClick={() => setConfirmStep(true)}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>{getTranslation('deleteAccountInAppBtn', language)}</span>
                  </button>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-rose-200 dark:border-rose-800">
                    <p className="font-semibold text-center text-xs">
                      Confirmez-vous la purge immédiate de vos données ?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmStep(false)}
                        className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-medium hover:bg-slate-300 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleExecutePurge}
                        className="flex-1 py-1.5 bg-rose-700 text-white rounded font-bold hover:bg-rose-800 transition-colors"
                      >
                        Oui, tout effacer
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <p>Responsable du traitement : <strong>ramzi.guedouar@gmail.com</strong></p>
                <p>Conservation des données comptables : 10 ans selon les obligations fiscales légales.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
