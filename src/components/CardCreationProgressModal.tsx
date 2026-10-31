/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CardCreationProgressModal
 * Indicateur circulaire de progression immersif affiché lors de l'encodage de TOUTE carte proUSB.
 * Répond à la contrainte : « avec toujours un circular progress lors de la création ».
 */

import React from 'react';
import { Radio, Usb, CheckCircle2 } from 'lucide-react';

export interface CardCreationProgressModalProps {
  isOpen: boolean;
  progress: number; // 0 - 100
  cardTitle: string; // Ex: "Carte Client · Chambre 101" ou "Passe Général Master"
  statusText?: string; // Ex: "Écriture RFID de la trame en cours..."
}

export const CardCreationProgressModal: React.FC<CardCreationProgressModalProps> = ({
  isOpen,
  progress,
  cardTitle,
  statusText,
}) => {
  if (!isOpen) return null;

  // Calcul du tracé circulaire SVG (rayon 42, circonférence ~ 263.89)
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  const currentStep =
    progress < 25
      ? "Initialisation de l'encodeur USB..."
      : progress < 55
      ? 'Encodage de la trame proUSB RFID...'
      : progress < 90
      ? 'Vérification et relecture de contrôle...'
      : progress < 100
      ? 'Finalisation du bip sonore...'
      : 'Carte programmée avec succès !';

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Progression de création de carte"
    >
      <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 dark:border-blue-400/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow de fond */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-blue-500/10 dark:bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Badge en-tête */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-4">
          <Radio size={13} className="animate-pulse text-blue-600 dark:text-blue-400" />
          <span>Encodeur proUSB en écriture</span>
        </div>

        {/* Titre de la carte en cours */}
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1 px-2 line-clamp-1">
          {cardTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          {statusText || "Veuillez laisser la carte sur l'encodeur"}
        </p>

        {/* Grand Circular Progress SVG */}
        <div className="relative w-36 h-36 flex items-center justify-center my-2">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            {/* Cercle de fond (piste) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="7"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Cercle de progression dynamique */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-blue-600 dark:text-blue-400 transition-all duration-300 ease-out"
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Contenu central dans le cercle */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {progress >= 100 ? (
              <CheckCircle2 size={36} className="text-emerald-500 animate-in zoom-in-75 duration-200" />
            ) : (
              <>
                <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                  {Math.round(progress)}%
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  progression
                </span>
              </>
            )}
          </div>
        </div>

        {/* Étape textuelle */}
        <div className="w-full mt-5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-center gap-2">
          <Usb size={14} className={progress < 100 ? 'text-blue-500 animate-pulse' : 'text-emerald-500'} />
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
            {currentStep}
          </span>
        </div>
      </div>
    </div>
  );
};
