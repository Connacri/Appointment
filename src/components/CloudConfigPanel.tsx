import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Key,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useApp, type CloudRecoveryReport } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
  readSupabaseRuntimeConfig,
  resetSupabaseRuntimeConfig,
  saveSupabaseRuntimeConfig,
} from '../services/supabase/supabaseClient';
import {
  clearFirebaseCloudConfig,
  isFirebaseFirestoreConfigured,
  isFirebaseRtdbConfigured,
  parseFirebaseConfigInput,
  readFirebaseCloudConfig,
  saveFirebaseCloudConfig,
  testFirebaseCloudConnection,
  type FirebaseCloudConfig,
} from '../services/cloud/firebaseRecovery';
import type { EstablishmentProfile } from '../types/establishment';

interface CloudConfigPanelProps {
  onRecoveredProfile?: (profile: Partial<EstablishmentProfile>) => void;
}

export const CloudConfigPanel: React.FC<CloudConfigPanelProps> = ({ onRecoveredProfile }) => {
  const {
    language,
    isOffline,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    refreshWorkspaces,
    triggerCloudRecovery,
  } = useApp();

  const initialSupabase = useMemo(() => readSupabaseRuntimeConfig(), []);
  const initialFirebase = useMemo(() => readFirebaseCloudConfig(), []);

  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState(initialSupabase.url);
  const [supabasePublishableKey, setSupabasePublishableKey] = useState(
    initialSupabase.publishableKey || (initialSupabase.isDefault ? DEFAULT_SUPABASE_PUBLISHABLE_KEY : ''),
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialSupabase.anonKey);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    tone: 'idle' | 'busy' | 'success' | 'error';
    text: string;
  }>({ tone: 'idle', text: '' });

  // Firebase (Firestore / RTDB) state
  const [fbConfig, setFbConfig] = useState<FirebaseCloudConfig>(initialFirebase);
  const [showFbApiKey, setShowFbApiKey] = useState(false);
  const [showJsonImporter, setShowJsonImporter] = useState(false);
  const [jsonSnippet, setJsonSnippet] = useState('');
  const [firebaseStatus, setFirebaseStatus] = useState<{
    tone: 'idle' | 'busy' | 'success' | 'error';
    text: string;
  }>({ tone: 'idle', text: '' });

  // Global cloud recovery feedback
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{
    tone: 'idle' | 'success' | 'warning' | 'error';
    text: string;
  }>({ tone: 'idle', text: '' });

  const firestoreConfigured = isFirebaseFirestoreConfigured(fbConfig);
  const rtdbConfigured = isFirebaseRtdbConfigured(fbConfig);
  const supabaseConfigured = Boolean(supabaseUrl.trim() && (supabasePublishableKey.trim() || supabaseAnonKey.trim()));

  const formatReportNotice = (report: CloudRecoveryReport) => {
    if (report.skippedOffline) {
      return { tone: 'warning' as const, text: getTranslation('cloudStatusOffline', language) };
    }
    const total =
      report.recoveredGroupsCount +
      report.recoveredBookingsCount +
      report.recoveredTasksCount +
      report.recoveredStockCount;
    if (report.recoveredProfile && onRecoveredProfile) {
      onRecoveredProfile(report.recoveredProfile);
    }
    if (report.warnings.length > 0 && total === 0) {
      return { tone: 'error' as const, text: report.warnings.join(' · ') };
    }
    if (report.sources.length === 0 || (total === 0 && !report.recoveredProfile)) {
      return { tone: 'warning' as const, text: getTranslation('cloudRecoveryNone', language) };
    }
    const summary = getTranslation('cloudRecoverySummary', language)
      .replace('{sources}', report.sources.join(' + '))
      .replace('{groups}', String(report.recoveredGroupsCount))
      .replace('{bookings}', String(report.recoveredBookingsCount))
      .replace('{tasks}', String(report.recoveredTasksCount))
      .replace('{stock}', String(report.recoveredStockCount));
    return {
      tone: 'success' as const,
      text: report.warnings.length > 0 ? `${summary} (${report.warnings.join(' · ')})` : summary,
    };
  };

  const runImmediateRecovery = async () => {
    setIsRecovering(true);
    try {
      await refreshWorkspaces();
      const report = await triggerCloudRecovery();
      setRecoveryNotice(formatReportNotice(report));
    } catch (err) {
      setRecoveryNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Erreur lors de la récupération cloud.',
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleTestSupabase = async () => {
    const url = supabaseUrl.trim();
    const key = supabasePublishableKey.trim() || supabaseAnonKey.trim();
    if (!/^https:\/\//i.test(url) || !key) {
      setSupabaseStatus({
        tone: 'error',
        text: language === 'fr' ? 'URL HTTPS et clé publique obligatoires.' : 'HTTPS URL and public key are required.',
      });
      return;
    }
    setSupabaseStatus({
      tone: 'busy',
      text: language === 'fr' ? 'Test de connexion Supabase…' : 'Testing Supabase connection…',
    });
    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const t0 = performance.now();
      const { error } = await client.auth.getSession();
      const latency = Math.round(performance.now() - t0);
      if (error) throw error;
      setSupabaseStatus({
        tone: 'success',
        text:
          language === 'fr'
            ? `Connexion Supabase établie (${latency} ms).`
            : `Supabase connection succeeded (${latency} ms).`,
      });
    } catch (err) {
      setSupabaseStatus({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Échec de connexion Supabase.',
      });
    }
  };

  const handleSaveSupabase = async () => {
    const url = supabaseUrl.trim();
    const pub = supabasePublishableKey.trim();
    const anon = supabaseAnonKey.trim();
    if (!/^https:\/\//i.test(url) || (!pub && !anon)) {
      setSupabaseStatus({
        tone: 'error',
        text: language === 'fr' ? 'URL HTTPS et clé publique obligatoires.' : 'HTTPS URL and public key are required.',
      });
      return;
    }
    saveSupabaseRuntimeConfig(url, pub, anon);
    setSupabaseStatus({
      tone: 'success',
      text: language === 'fr' ? 'Configuration Supabase enregistrée.' : 'Supabase configuration saved.',
    });
    await runImmediateRecovery();
  };

  const handleResetSupabase = async () => {
    resetSupabaseRuntimeConfig();
    setSupabaseUrl(DEFAULT_SUPABASE_URL);
    setSupabasePublishableKey(DEFAULT_SUPABASE_PUBLISHABLE_KEY);
    setSupabaseAnonKey('');
    setSupabaseStatus({
      tone: 'success',
      text: language === 'fr' ? 'Projet Supabase par défaut rétabli.' : 'Default Supabase project restored.',
    });
    await runImmediateRecovery();
  };

  const handleParseFirebaseJson = () => {
    try {
      const parsed = parseFirebaseConfigInput(jsonSnippet);
      setFbConfig((prev) => ({ ...prev, ...parsed }));
      setJsonSnippet('');
      setShowJsonImporter(false);
      setFirebaseStatus({
        tone: 'success',
        text:
          language === 'fr'
            ? 'Configuration Firebase extraite. Cliquez sur « Enregistrer & récupérer » pour activer.'
            : 'Firebase config parsed. Click "Save & recover" to activate.',
      });
    } catch (err) {
      setFirebaseStatus({
        tone: 'error',
        text: err instanceof Error ? err.message : 'JSON Firebase invalide.',
      });
    }
  };

  const handleTestFirebase = async () => {
    if (!firestoreConfigured && !rtdbConfigured) {
      setFirebaseStatus({
        tone: 'error',
        text:
          language === 'fr'
            ? 'Renseignez un Project ID (Firestore) ou une Database URL (Realtime Database).'
            : 'Provide a Project ID (Firestore) or Database URL (Realtime Database).',
      });
      return;
    }
    setFirebaseStatus({
      tone: 'busy',
      text: language === 'fr' ? 'Test Firestore / Realtime Database…' : 'Testing Firestore / Realtime Database…',
    });
    const res = await testFirebaseCloudConnection(fbConfig);
    const messages: string[] = [];
    let anyError = false;
    if (res.firestore.configured) {
      if (res.firestore.ok) {
        messages.push(`Firestore OK (${res.firestore.latencyMs ?? 0} ms)`);
      } else {
        anyError = true;
        messages.push(`Firestore : ${res.firestore.error ?? 'échec'}`);
      }
    }
    if (res.realtimeDatabase.configured) {
      if (res.realtimeDatabase.ok) {
        messages.push(`Realtime DB OK (${res.realtimeDatabase.latencyMs ?? 0} ms)`);
      } else {
        anyError = true;
        messages.push(`Realtime DB : ${res.realtimeDatabase.error ?? 'échec'}`);
      }
    }
    setFirebaseStatus({
      tone: anyError ? 'error' : 'success',
      text: messages.join(' · '),
    });
  };

  const handleSaveFirebase = async () => {
    if (!firestoreConfigured && !rtdbConfigured) {
      setFirebaseStatus({
        tone: 'error',
        text:
          language === 'fr'
            ? 'Renseignez un Project ID (Firestore) ou une Database URL (Realtime Database).'
            : 'Provide a Project ID (Firestore) or Database URL (Realtime Database).',
      });
      return;
    }
    saveFirebaseCloudConfig(fbConfig);
    setFirebaseStatus({
      tone: 'success',
      text: language === 'fr' ? 'Configuration Firebase enregistrée.' : 'Firebase configuration saved.',
    });
    await runImmediateRecovery();
  };

  const handleClearFirebase = () => {
    clearFirebaseCloudConfig();
    setFbConfig({});
    setFirebaseStatus({
      tone: 'idle',
      text: language === 'fr' ? 'Configuration Firebase effacée.' : 'Firebase configuration cleared.',
    });
  };

  return (
    <div className="space-y-5 pms-fade text-xs">
      {/* Intro & Auto-Detection Banner */}
      <section className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/25 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Cloud size={17} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-balance">{getTranslation('cloudConfigIntroTitle', language)}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-pretty">
              {getTranslation('cloudConfigIntroDesc', language)}
            </p>
          </div>

          <button
            type="button"
            disabled={isRecovering || isOffline}
            onClick={() => void runImmediateRecovery()}
            className="min-h-11 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RefreshCw size={15} className={isRecovering ? 'animate-spin' : ''} />
            <span>
              {isRecovering
                ? getTranslation('cloudRecovering', language)
                : getTranslation('cloudDetectAndRecoverBtn', language)}
            </span>
          </button>
        </div>

        {/* Cloud Detection Status Grid (Non-color-only: Icon + Status Text + Engine Name) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-2.5 min-w-0">
            <Cloud size={16} className={supabaseConfigured ? 'text-emerald-600 dark:text-emerald-400 shrink-0' : 'text-slate-400 shrink-0'} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-white truncate">Supabase</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                {supabaseConfigured ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{getTranslation('cloudStatusConfigured', language)}</span>
                  </>
                ) : (
                  <span>{getTranslation('cloudStatusNotConfigured', language)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-2.5 min-w-0">
            <Flame size={16} className={firestoreConfigured ? 'text-amber-600 dark:text-amber-400 shrink-0' : 'text-slate-400 shrink-0'} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-white truncate">Cloud Firestore</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                {firestoreConfigured ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate font-mono">{fbConfig.projectId}</span>
                  </>
                ) : (
                  <span>{getTranslation('cloudStatusNotConfigured', language)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-2.5 min-w-0">
            <Database size={16} className={rtdbConfigured ? 'text-amber-600 dark:text-amber-400 shrink-0' : 'text-slate-400 shrink-0'} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-white truncate">Realtime Database</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                {rtdbConfigured ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{getTranslation('cloudStatusConfigured', language)}</span>
                  </>
                ) : (
                  <span>{getTranslation('cloudStatusNotConfigured', language)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {recoveryNotice.tone !== 'idle' && (
          <div
            role="status"
            className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
              recoveryNotice.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200'
                : recoveryNotice.tone === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200'
            }`}
          >
            {recoveryNotice.tone === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <span className="min-w-0 break-words">{recoveryNotice.text}</span>
          </div>
        )}
      </section>

      {/* SUPABASE CONFIGURATION */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
            <Cloud size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{getTranslation('cloudSupabaseTitle', language)}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleResetSupabase()}
            className="min-h-9 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <RefreshCw size={12} />
            <span>{getTranslation('cloudResetDefault', language)}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="min-w-0">
            <label htmlFor="setup-supabase-url" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span className="inline-flex items-center gap-1.5">
                <Globe size={13} className="text-emerald-600 dark:text-emerald-400" />
                {getTranslation('cloudSupabaseUrlLabel', language)}
              </span>
            </label>
            <input
              id="setup-supabase-url"
              type="url"
              inputMode="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <label htmlFor="setup-supabase-key" className="font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                <Key size={13} className="text-emerald-600 dark:text-emerald-400" />
                {getTranslation('cloudSupabaseKeyLabel', language)}
              </label>
              <button
                type="button"
                onClick={() => setShowSupabaseKey((prev) => !prev)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                {showSupabaseKey ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showSupabaseKey ? getTranslation('cloudHideSecret', language) : getTranslation('cloudShowSecret', language)}</span>
              </button>
            </div>
            <input
              id="setup-supabase-key"
              type={showSupabaseKey ? 'text' : 'password'}
              autoComplete="off"
              value={supabasePublishableKey}
              onChange={(e) => setSupabasePublishableKey(e.target.value)}
              placeholder="sb_publishable_..."
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
          <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <ChevronDown size={14} />
            <span>{getTranslation('cloudSupabaseAnonLabel', language)}</span>
          </summary>
          <div className="mt-2.5">
            <input
              type={showSupabaseKey ? 'text' : 'password'}
              autoComplete="off"
              aria-label={getTranslation('cloudSupabaseAnonLabel', language)}
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
            />
          </div>
        </details>

        {workspaces.length > 0 && (
          <div>
            <label htmlFor="setup-supabase-workspace" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {getTranslation('cloudWorkspaceActiveLabel', language)}
            </label>
            <select
              id="setup-supabase-workspace"
              value={activeWorkspaceId}
              onChange={(e) => {
                if (e.target.value) setActiveWorkspaceId(e.target.value);
              }}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
            >
              <option value="">{getTranslation('cloudWorkspaceSelectPrompt', language)}</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{getTranslation('cloudSupabaseKeyHint', language)}</span>
        </p>

        {supabaseStatus.tone !== 'idle' && (
          <div
            role="status"
            className={`rounded-xl border p-2.5 text-xs flex items-center gap-2 ${
              supabaseStatus.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200'
                : supabaseStatus.tone === 'busy'
                  ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200'
            }`}
          >
            {supabaseStatus.tone === 'busy' ? (
              <RefreshCw size={14} className="animate-spin shrink-0" />
            ) : supabaseStatus.tone === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <AlertCircle size={14} className="shrink-0" />
            )}
            <span className="min-w-0 break-words">{supabaseStatus.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={supabaseStatus.tone === 'busy'}
            onClick={() => void handleTestSupabase()}
            className="min-h-11 px-4 py-2 rounded-xl border border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Activity size={14} />
            <span>{getTranslation('cloudTestConnection', language)}</span>
          </button>
          <button
            type="button"
            disabled={isRecovering}
            onClick={() => void handleSaveSupabase()}
            className="min-h-11 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            <span>{getTranslation('cloudSaveAndRecover', language)}</span>
          </button>
        </div>
      </section>

      {/* FIREBASE FIRESTORE & REALTIME DATABASE CONFIGURATION */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
            <Flame size={17} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{getTranslation('cloudFirebaseTitle', language)}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowJsonImporter((prev) => !prev)}
            className="min-h-9 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
          >
            {getTranslation('cloudFirebasePasteToggle', language)}
          </button>
        </div>

        {showJsonImporter && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2.5">
            <label htmlFor="setup-firebase-json" className="block font-semibold text-slate-700 dark:text-slate-200">
              {getTranslation('cloudFirebasePasteToggle', language)}
            </label>
            <textarea
              id="setup-firebase-json"
              rows={4}
              value={jsonSnippet}
              onChange={(e) => setJsonSnippet(e.target.value)}
              placeholder={'{\n  "apiKey": "AIza...",\n  "projectId": "mon-hotel-pms",\n  "databaseURL": "https://mon-hotel-pms-default-rtdb.firebaseio.com"\n}'}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleParseFirebaseJson}
              className="min-h-10 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
            >
              {getTranslation('cloudFirebasePasteApply', language)}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="min-w-0">
            <label htmlFor="setup-firebase-project" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {getTranslation('cloudFirebaseProjectIdLabel', language)}
            </label>
            <input
              id="setup-firebase-project"
              type="text"
              value={fbConfig.projectId || ''}
              onChange={(e) => setFbConfig((prev) => ({ ...prev, projectId: e.target.value }))}
              placeholder="mon-hotel-pms"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="setup-firebase-rtdb" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {getTranslation('cloudFirebaseDatabaseUrlLabel', language)}
            </label>
            <input
              id="setup-firebase-rtdb"
              type="url"
              inputMode="url"
              value={fbConfig.databaseURL || ''}
              onChange={(e) => setFbConfig((prev) => ({ ...prev, databaseURL: e.target.value }))}
              placeholder="https://mon-hotel-pms-default-rtdb.firebaseio.com"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <label htmlFor="setup-firebase-apikey" className="font-semibold text-slate-700 dark:text-slate-300">
                {getTranslation('cloudFirebaseApiKeyLabel', language)}
              </label>
              <button
                type="button"
                onClick={() => setShowFbApiKey((prev) => !prev)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                {showFbApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showFbApiKey ? getTranslation('cloudHideSecret', language) : getTranslation('cloudShowSecret', language)}</span>
              </button>
            </div>
            <input
              id="setup-firebase-apikey"
              type={showFbApiKey ? 'text' : 'password'}
              autoComplete="off"
              value={fbConfig.apiKey || ''}
              onChange={(e) => setFbConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="AIzaSy..."
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="setup-firebase-root" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {getTranslation('cloudFirebaseRootPathLabel', language)}
            </label>
            <input
              id="setup-firebase-root"
              type="text"
              value={fbConfig.rootPath || ''}
              onChange={(e) => setFbConfig((prev) => ({ ...prev, rootPath: e.target.value }))}
              placeholder="pms / tenants/hotel-oran"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {firebaseStatus.tone !== 'idle' && firebaseStatus.text && (
          <div
            role="status"
            className={`rounded-xl border p-2.5 text-xs flex items-center gap-2 ${
              firebaseStatus.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200'
                : firebaseStatus.tone === 'busy'
                  ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200'
            }`}
          >
            {firebaseStatus.tone === 'busy' ? (
              <RefreshCw size={14} className="animate-spin shrink-0" />
            ) : firebaseStatus.tone === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <AlertCircle size={14} className="shrink-0" />
            )}
            <span className="min-w-0 break-words">{firebaseStatus.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={firebaseStatus.tone === 'busy'}
            onClick={() => void handleTestFirebase()}
            className="min-h-11 px-4 py-2 rounded-xl border border-amber-600 dark:border-amber-500 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Activity size={14} />
            <span>{getTranslation('cloudTestConnection', language)}</span>
          </button>
          <button
            type="button"
            disabled={isRecovering}
            onClick={() => void handleSaveFirebase()}
            className="min-h-11 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            <span>{getTranslation('cloudSaveAndRecover', language)}</span>
          </button>
          {(firestoreConfigured || rtdbConfigured || fbConfig.apiKey) && (
            <button
              type="button"
              onClick={handleClearFirebase}
              className="min-h-11 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>{getTranslation('cloudFirebaseClearBtn', language)}</span>
            </button>
          )}
        </div>
      </section>

      {/* NEON / POSTGRESQL BACKEND NOTE */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 p-4 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <Server size={15} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span>{getTranslation('cloudNeonTitle', language)}</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed text-pretty">
          {getTranslation('cloudNeonDesc', language)}
        </p>
      </section>
    </div>
  );
};
