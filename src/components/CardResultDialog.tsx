/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CardResultDialog — modal affichée après CHAQUE écriture de carte.
 *
 * Succès → dialogue de confirmation vert (trame, chambre, validité).
 * Échec  → alerte rouge avec la cause réelle (aucun rejet silencieux).
 *
 * Jacob's Law : un dialogue modal centré avec un seul bouton « OK » est le
 * patron attendu pour un retour d'action d'importance moyenne.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export interface CardResultDetail {
  label: string;
  value: string;
}

export interface CardResult {
  success: boolean;
  /** Titre principal du dialogue. */
  title: string;
  /** Message expliquant le résultat. */
  message: string;
  /** Lignes optionnelles (chambre, validité, trame…). */
  details?: CardResultDetail[];
}

interface CardResultDialogProps {
  result: CardResult | null;
  onClose: () => void;
}

export const CardResultDialog: React.FC<CardResultDialogProps> = ({ result, onClose }) => {
  if (!result) return null;
  const { success, title, message, details } = result;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="card-result-title"
    >
      <div
        className={`bg-white dark:bg-slate-900 border-2 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden ${
          success ? 'border-emerald-400 dark:border-emerald-600' : 'border-rose-400 dark:border-rose-600'
        }`}
      >
        <div
          className={`flex items-center gap-3 px-5 py-4 ${
            success
              ? 'bg-emerald-50 dark:bg-emerald-950/40'
              : 'bg-rose-50 dark:bg-rose-950/40'
          }`}
        >
          {success ? (
            <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={28} className="text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <h2
            id="card-result-title"
            className={`font-extrabold text-base ${
              success ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
            }`}
          >
            {title}
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{message}</p>

          {details && details.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
              {details.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    {d.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 text-right break-all">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`w-full min-h-[44px] py-2 rounded-xl font-bold text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 ${
              success
                ? 'bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
