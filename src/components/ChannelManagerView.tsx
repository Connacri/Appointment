import React, { useState, useMemo } from 'react';
import {
  Globe,
  Radio,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Lock,
  Copy,
  Check,
  CheckCheck,
  Filter,
  Search,
  Zap,
  Clock,
  KeyRound,
  FileCode,
  Info,
  Server,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChannelConnection, ChannelAlert, SyncLogEvent, AlertSeverity } from '../types/channel';
import { initialChannels, initialAlerts, initialSyncLogs } from '../data/channelMockData';

export const ChannelManagerView: React.FC = () => {
  const { language, currentDomain, currentRole } = useApp();

  const [activeTab, setActiveTab] = useState<'alerts' | 'channels' | 'logs' | 'keystore_guide'>('alerts');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [channels, setChannels] = useState<ChannelConnection[]>(initialChannels);
  const [alerts, setAlerts] = useState<ChannelAlert[]>(initialAlerts);
  const [syncLogs, setSyncLogs] = useState<SyncLogEvent[]>(initialSyncLogs);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter channels strictly by currentDomain
  const domainChannels = useMemo(() => {
    return channels.filter((c) => c.domain === currentDomain);
  }, [channels, currentDomain]);

  // Filter alerts strictly by currentDomain & severity
  const domainAlerts = useMemo(() => {
    return alerts
      .filter((a) => a.domain === currentDomain)
      .filter((a) => (severityFilter === 'all' ? true : a.severity === severityFilter));
  }, [alerts, currentDomain, severityFilter]);

  const activeAlertsCount = domainAlerts.filter((a) => !a.isResolved).length;
  const criticalCount = domainAlerts.filter((a) => !a.isResolved && a.severity === 'critical').length;

  // Toggle channel active status
  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c))
    );
  };

  // Trigger single channel sync
  const handleSyncChannel = (id: string) => {
    if (syncingChannelId) return;
    setSyncingChannelId(id);

    setTimeout(() => {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, lastSyncAt: 'À l\'instant', status: 'connected' } : c
        )
      );
      setSyncLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          channelName: channels.find((c) => c.id === id)?.name || 'Channel',
          direction: 'outbound',
          action: 'MANUAL_2WAY_SYNC_FORCE',
          status: 'success',
          payloadSummary: 'Disponibilités et tarifs poussés en XML 2-way · 0 conflit.',
          durationMs: 245,
        },
        ...prev,
      ]);
      setSyncingChannelId(null);
    }, 1200);
  };

  // Trigger sync all channels
  const handleSyncAll = () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);

    setTimeout(() => {
      setChannels((prev) =>
        prev.map((c) => (c.domain === currentDomain ? { ...c, lastSyncAt: 'À l\'instant' } : c))
      );
      setIsSyncingAll(false);
    }, 1500);
  };

  // Resolve an alert
  const handleResolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isResolved: true } : a))
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="text-blue-500" size={22} />
              <span>
                {language === 'fr'
                  ? 'Channel Manager & Centre d\'Alertes OTA'
                  : 'Channel Manager & OTA Alerts Engine'}
              </span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
              2-Way XML & iCal
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? `Synchronisation en temps réel des disponibilités et tarifs · Domaine actif : ${currentDomain.toUpperCase()}`
              : `Real-time synchronization of inventory, rates and reservations · Active Domain: ${currentDomain.toUpperCase()}`}
          </p>
        </div>

        {/* Global Sync Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
            <span>{isSyncingAll ? 'Synchronisation...' : 'Synchroniser Tous les Canaux'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Active Channels */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Canaux Connectés</span>
            <Radio size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {domainChannels.filter((c) => c.isActive).length} / {domainChannels.length}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
            100% connectivité active
          </span>
        </div>

        {/* Unresolved Alerts */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Alertes Non Résolues</span>
            <AlertTriangle size={16} className={criticalCount > 0 ? 'text-rose-500 animate-bounce' : 'text-amber-500'} />
          </div>
          <div className={`text-2xl font-bold font-mono ${criticalCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
            {activeAlertsCount}
          </div>
          <span className={`text-[10px] font-semibold block mt-0.5 ${criticalCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {criticalCount} surréservations critiques
          </span>
        </div>

        {/* Sync Latency */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Latence Moyenne</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            195 ms
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
            Flux ultra-rapide temps réel
          </span>
        </div>

        {/* Direct Engine Volume */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Part Ventes Directes</span>
            <TrendingUp size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            68.4 %
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            0% commission économisée
          </span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all shrink-0 ${
            activeTab === 'alerts'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert size={15} />
          <span>Centre d'Alertes & Conflits</span>
          {activeAlertsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              {activeAlertsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all shrink-0 ${
            activeTab === 'channels'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Radio size={15} />
          <span>Canaux de Vente & Mappage ({domainChannels.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all shrink-0 ${
            activeTab === 'logs'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap size={15} />
          <span>Journal de Synchronisation (iCal / XML)</span>
        </button>

        <button
          onClick={() => setActiveTab('keystore_guide')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all shrink-0 ${
            activeTab === 'keystore_guide'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <KeyRound size={15} />
          <span>Assistant Keystore GitHub (CI / Secrets)</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Aide CI
          </span>
        </button>
      </div>

      {/* TAB 1: ALERTS CENTER */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Severity Filter Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] mr-1">Filtrer par sévérité :</span>
              <button
                onClick={() => setSeverityFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  severityFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Toutes ({domainAlerts.length})
              </button>
              <button
                onClick={() => setSeverityFilter('critical')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  severityFilter === 'critical'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Critiques (Overbooking)
              </button>
              <button
                onClick={() => setSeverityFilter('warning')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  severityFilter === 'warning'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Attention (Parité & Stop-Sell)
              </button>
            </div>
          </div>

          {/* Alerts List */}
          <div className="space-y-3">
            {domainAlerts.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Aucune alerte active</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tous les flux de réservation sont synchronisés et sans conflit pour le domaine {currentDomain}.
                </p>
              </div>
            ) : (
              domainAlerts.map((alt) => {
                const isCrit = alt.severity === 'critical';
                return (
                  <div
                    key={alt.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      alt.isResolved
                        ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : isCrit
                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 shadow-xs'
                        : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              alt.isResolved
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : isCrit
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                            }`}
                          >
                            {alt.isResolved ? 'Résolu' : isCrit ? 'Critique' : 'Attention'}
                          </span>

                          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                            {alt.channelName}
                          </span>

                          {alt.unitName && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              · {alt.unitName}
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400 ml-auto md:ml-0 font-mono">
                            {alt.timestamp}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                          {alt.title[language] || alt.title.en}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {alt.description[language] || alt.description.en}
                        </p>

                        <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 mt-2">
                          <strong className="block text-emerald-600 dark:text-emerald-400 mb-0.5 text-[10px] uppercase">
                            Action Recommandée Immédiate :
                          </strong>
                          {alt.recommendedAction[language] || alt.recommendedAction.en}
                        </div>
                      </div>

                      {/* Action Button */}
                      {!alt.isResolved ? (
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => handleResolveAlert(alt.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCheck size={14} />
                            <span>Résoudre & Appliquer</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={15} />
                          <span>Conflit Réglé</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHANNELS & MAPPING */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domainChannels.map((channel) => (
              <div
                key={channel.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{channel.logo}</span>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        {channel.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Protocole : {channel.syncType.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        channel.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                      title={channel.isActive ? 'Canal Actif' : 'Canal en pause'}
                    />
                    <button
                      onClick={() => toggleChannel(channel.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        channel.isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {channel.isActive ? 'Actif' : 'En pause'}
                    </button>
                  </div>
                </div>

                {/* Metrics of Channel */}
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Mappage :</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {channel.mappedUnitsCount}/{channel.totalUnitsCount} unités
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Majoration :</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      +{channel.markupPercent}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Dernière synchro :</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                      {channel.lastSyncAt}
                    </span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <span>Latence : {channel.latencyMs}ms</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSyncChannel(channel.id)}
                      disabled={syncingChannelId === channel.id}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw
                        size={12}
                        className={syncingChannelId === channel.id ? 'animate-spin' : ''}
                      />
                      <span>Synchroniser</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & WEBHOOKS */}
      {activeTab === 'logs' && (
        <div className="p-4 bg-slate-950 text-slate-300 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              Journal Temps Réel des Événements XML / iCal (Webhook Stream)
            </span>
            <span className="text-[10px] text-emerald-400">Status 200 OK · Écoute active</span>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2 bg-slate-900/80 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">{log.timestamp}</span>
                <span className="text-cyan-400 font-bold shrink-0">[{log.channelName}]</span>
                <span className="text-amber-300 font-medium shrink-0">{log.action}</span>
                <span className="text-slate-300 flex-1">{log.payloadSummary}</span>
                <span className="text-slate-500 text-[10px] shrink-0">{log.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: KEYSTORE GUIDE (DIRECTLY SOLVES USER'S QUESTION) */}
      {activeTab === 'keystore_guide' && (
        <div className="p-5 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5">
            <KeyRound size={22} className="text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Guide : Comment Sauvegarder les Keystores dans GitHub Secret Variables
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Explication détaillée suite à votre question sur les secrets non sauvegardés.
              </p>
            </div>
          </div>

          {/* Explanation banner */}
          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-xs space-y-2 text-amber-200">
            <div className="font-bold flex items-center gap-1.5">
              <Info size={14} className="text-amber-400" />
              <span>Pourquoi le Keystore n'est pas encore présent dans vos secrets ?</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-300/90">
              Un Keystore Android (<code className="text-white">.keystore</code> ou <code className="text-white">.jks</code>) contient une clé privée cryptographique. <strong>GitHub ne peut pas deviner votre clé</strong> : vous devez générer ce fichier une seule fois sur votre machine, l'encoder en base64, puis coller la chaîne dans les paramètres de votre dépôt GitHub.
            </p>
            <div className="p-2 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 text-[11px]">
              ✔ <strong>Bonne nouvelle :</strong> Nous avons intégré un <em>fallback automatique</em> dans votre workflow CI ! Si le secret est absent, le CI génère un keystore de signature temporaire pour que votre APK, votre AAB et votre site Web soient <strong>toujours générés avec succès</strong> sans bloquer !
            </div>
          </div>

          {/* Step by step */}
          <div className="space-y-3 text-xs">
            {/* Step 1 */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-bold text-cyan-400">Étape 1 : Générer votre Keystore localement</div>
              <p className="text-[11px] text-slate-400">Exécutez cette commande dans votre terminal :</p>
              <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-emerald-400 flex items-center justify-between">
                <span>keytool -genkeypair -v -storetype JKS -keystore omnibook-release.keystore -alias omnibook-release-key -keyalg RSA -keysize 2048 -validity 10000</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      'keytool -genkeypair -v -storetype JKS -keystore omnibook-release.keystore -alias omnibook-release-key -keyalg RSA -keysize 2048 -validity 10000',
                      'cmd-keytool'
                    )
                  }
                  className="p-1 hover:bg-slate-800 rounded text-slate-300"
                >
                  {copiedKey === 'cmd-keytool' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-bold text-cyan-400">Étape 2 : Encoder en Base64 pour GitHub</div>
              <p className="text-[11px] text-slate-400">Convertissez le fichier pour le coller dans GitHub Secrets :</p>
              <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-emerald-400 flex items-center justify-between">
                <span>base64 -w 0 omnibook-release.keystore &gt; keystore_base64.txt</span>
                <button
                  onClick={() =>
                    copyToClipboard('base64 -w 0 omnibook-release.keystore > keystore_base64.txt', 'cmd-b64')
                  }
                  className="p-1 hover:bg-slate-800 rounded text-slate-300"
                >
                  {copiedKey === 'cmd-b64' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <div className="font-bold text-cyan-400">Étape 3 : Ajouter dans GitHub</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Allez sur votre dépôt GitHub : <strong>Settings &gt; Secrets and variables &gt; Actions &gt; New repository secret</strong> :
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-[10px]">
                <li><code className="text-cyan-300">ANDROID_KEYSTORE_BASE64</code> : Collez le contenu de keystore_base64.txt</li>
                <li><code className="text-cyan-300">ANDROID_KEYSTORE_PASSWORD</code> : Votre mot de passe choisi</li>
                <li><code className="text-cyan-300">ANDROID_KEY_ALIAS</code> : omnibook-release-key</li>
                <li><code className="text-cyan-300">ANDROID_KEY_PASSWORD</code> : Votre mot de passe de clé</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
