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
  Plus,
  Settings2,
  X,
  Link2,
  Calendar,
  AlertCircle,
  HelpCircle,
  Percent,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChannelConnection, ChannelAlert, SyncLogEvent, AlertSeverity, ChannelSyncType } from '../types/channel';
import { initialChannels, initialAlerts, initialSyncLogs } from '../data/channelMockData';

export const ChannelManagerView: React.FC = () => {
  const { language, currentDomain, resourceGroups } = useApp();

  const [activeTab, setActiveTab] = useState<'alerts' | 'channels' | 'parity' | 'logs' | 'keystore_guide'>('alerts');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [logDirectionFilter, setLogDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  const [channels, setChannels] = useState<ChannelConnection[]>(initialChannels);
  const [alerts, setAlerts] = useState<ChannelAlert[]>(initialAlerts);
  const [syncLogs, setSyncLogs] = useState<SyncLogEvent[]>(initialSyncLogs);

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [isAddChannelModalOpen, setIsAddChannelModalOpen] = useState(false);
  const [configuringChannel, setConfiguringChannel] = useState<ChannelConnection | null>(null);
  const [resolvingAlert, setResolvingAlert] = useState<ChannelAlert | null>(null);
  const [selectedResolutionOption, setSelectedResolutionOption] = useState<'reassign' | 'upgrade' | 'cancel'>('reassign');

  // New Channel Form State
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelProvider, setNewChannelProvider] = useState('booking');
  const [newChannelSyncType, setNewChannelSyncType] = useState<ChannelSyncType>('2_way_xml');
  const [newChannelMarkup, setNewChannelMarkup] = useState('15');
  const [newChannelThreshold, setNewChannelThreshold] = useState('1');
  const [newChannelApiKey, setNewChannelApiKey] = useState('');

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

  // Domain resources for mapping
  const domainResources = useMemo(() => {
    return resourceGroups
      .filter((g) => g.sector === currentDomain)
      .flatMap((g) => g.resources);
  }, [resourceGroups, currentDomain]);

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
          c.id === id ? { ...c, lastSyncAt: language === 'fr' ? 'À l\'instant' : language === 'ar' ? 'الآن' : 'Just now', status: 'connected' } : c
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
          payloadSummary: language === 'fr' ? 'Disponibilités et tarifs poussés en XML 2-way · 0 conflit.' : 'Inventory & rates pushed via 2-way XML · 0 conflicts.',
          durationMs: 245,
        },
        ...prev,
      ]);
      setSyncingChannelId(null);
    }, 1100);
  };

  // Trigger sync all channels
  const handleSyncAll = () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);

    setTimeout(() => {
      setChannels((prev) =>
        prev.map((c) => (c.domain === currentDomain ? { ...c, lastSyncAt: language === 'fr' ? 'À l\'instant' : language === 'ar' ? 'الآن' : 'Just now' } : c))
      );
      setSyncLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          channelName: 'GLOBAL_SYNC_HUB',
          direction: 'outbound',
          action: 'BATCH_ALL_CHANNELS_SYNC',
          status: 'success',
          payloadSummary: language === 'fr' ? `Synchronisation globale réussie pour tous les canaux ${currentDomain.toUpperCase()}.` : `Global sync completed for all ${currentDomain.toUpperCase()} channels.`,
          durationMs: 412,
        },
        ...prev,
      ]);
      setIsSyncingAll(false);
    }, 1400);
  };

  // Submit New Channel
  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const providerIcons: Record<string, string> = {
      booking: '🏨',
      airbnb: '🏠',
      expedia: '✈️',
      agoda: '🌏',
      doctolib: '🩺',
      google: '🔍',
      thefork: '🍴',
      ical: '📅',
    };

    const newChan: ChannelConnection = {
      id: `chan_${Date.now()}`,
      name: newChannelName.trim(),
      domain: currentDomain,
      logo: providerIcons[newChannelProvider] || '🌐',
      syncType: newChannelSyncType,
      status: 'connected',
      isActive: true,
      lastSyncAt: language === 'fr' ? 'À l\'instant' : language === 'ar' ? 'الآن' : 'Just now',
      latencyMs: Math.floor(Math.random() * 200) + 120,
      mappedUnitsCount: Math.min(domainResources.length, 6),
      totalUnitsCount: Math.max(domainResources.length, 6),
      markupPercent: parseFloat(newChannelMarkup) || 15,
      autoStopSellThreshold: parseInt(newChannelThreshold, 10) || 1,
      webhookStatus: 'active',
      apiUrl: newChannelApiKey ? `https://api.gateway.omnibook.io/v1/${newChannelProvider}` : undefined,
    };

    setChannels((prev) => [newChan, ...prev]);
    setSyncLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        channelName: newChan.name,
        direction: 'outbound',
        action: 'CHANNEL_CONNECTION_INITIALIZED',
        status: 'success',
        payloadSummary: `Nouveau canal "${newChan.name}" lié avec succès en protocole ${newChan.syncType.toUpperCase()}.`,
        durationMs: 180,
      },
      ...prev,
    ]);

    setIsAddChannelModalOpen(false);
    setNewChannelName('');
    setNewChannelApiKey('');
  };

  // Save Configured Channel
  const handleSaveConfig = () => {
    if (!configuringChannel) return;
    setChannels((prev) =>
      prev.map((c) => (c.id === configuringChannel.id ? configuringChannel : c))
    );
    setSyncLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        channelName: configuringChannel.name,
        direction: 'outbound',
        action: 'CONFIG_UPDATED',
        status: 'success',
        payloadSummary: `Configuration mise à jour : majoration +${configuringChannel.markupPercent}%, stop-sell seuil ${configuringChannel.autoStopSellThreshold} unité(s).`,
        durationMs: 95,
      },
      ...prev,
    ]);
    setConfiguringChannel(null);
  };

  // Resolve Alert via workflow
  const handleExecuteResolution = () => {
    if (!resolvingAlert) return;

    setAlerts((prev) =>
      prev.map((a) => (a.id === resolvingAlert.id ? { ...a, isResolved: true } : a))
    );

    const resolutionText =
      selectedResolutionOption === 'reassign'
        ? 'Client réassigné sur unité libre de même catégorie avec notification automatique.'
        : selectedResolutionOption === 'upgrade'
        ? 'Surclassement offert validé sur catégorie supérieure, tarif maintenu.'
        : 'Réservation annulée sans frais avec remboursement instantané et mise à jour OTA.';

    setSyncLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        channelName: resolvingAlert.channelName,
        direction: 'inbound',
        action: 'CONFLICT_RESOLVED',
        status: 'success',
        payloadSummary: `Résolution alerte #${resolvingAlert.id} : ${resolutionText}`,
        durationMs: 140,
      },
      ...prev,
    ]);

    setResolvingAlert(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex-1 p-3 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-4 md:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="text-blue-500 shrink-0" size={22} />
              <span>
                {language === 'fr'
                  ? 'Channel Manager & Centre d\'Alertes OTA'
                  : language === 'ar'
                  ? 'إدارة القنوات والتنبيهات المباشرة'
                  : 'Channel Manager & OTA Alerts Hub'}
              </span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase shrink-0">
              2-Way XML & iCal
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? `Synchronisation bidirectionnelle des réservations, disponibilités et tarifs · Domaine : ${currentDomain.toUpperCase()}`
              : language === 'ar'
              ? `مزامنة ثنائية الاتجاه للمخزون والأسعار والقنوات · النطاق : ${currentDomain.toUpperCase()}`
              : `Bidirectional synchronization of inventory, rates and reservations · Domain: ${currentDomain.toUpperCase()}`}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAddChannelModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition-all"
          >
            <Plus size={14} />
            <span>{language === 'fr' ? 'Connecter un Canal' : language === 'ar' ? 'إضافة قناة' : 'Connect Channel'}</span>
          </button>

          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
            <span>{isSyncingAll ? (language === 'fr' ? 'Synchro...' : 'Syncing...') : (language === 'fr' ? 'Tout Synchroniser' : 'Sync All')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
        {/* Active Channels */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">{language === 'fr' ? 'Canaux Connectés' : 'Active Channels'}</span>
            <Radio size={16} className="text-emerald-500" />
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {domainChannels.filter((c) => c.isActive).length} / {domainChannels.length}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5 truncate">
            100% connectivité temps réel
          </span>
        </div>

        {/* Unresolved Alerts */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">{language === 'fr' ? 'Alertes & Conflits' : 'Alerts & Conflicts'}</span>
            <AlertTriangle size={16} className={criticalCount > 0 ? 'text-rose-500 animate-bounce' : 'text-amber-500'} />
          </div>
          <div className={`text-xl md:text-2xl font-bold font-mono tabular-nums ${criticalCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
            {activeAlertsCount}
          </div>
          <span className={`text-[10px] font-semibold block mt-0.5 truncate ${criticalCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {criticalCount} {language === 'fr' ? 'surréservation(s) critique(s)' : 'critical conflicts'}
          </span>
        </div>

        {/* Sync Latency */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">{language === 'fr' ? 'Latence Réseau' : 'Sync Latency'}</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            195 ms
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5 truncate">
            Flux Webhook 2-Way ultra-rapide
          </span>
        </div>

        {/* Direct Engine Volume */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">{language === 'fr' ? 'Part Ventes Directes' : 'Direct Booking Share'}</span>
            <TrendingUp size={16} className="text-purple-500" />
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 tabular-nums">
            68.4 %
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
            0% commission OTA économisée
          </span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto text-xs font-semibold no-scrollbar">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all shrink-0 ${
            activeTab === 'alerts'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert size={15} />
          <span>{language === 'fr' ? 'Centre d\'Alertes' : language === 'ar' ? 'مركز التنبيهات' : 'Alerts Center'}</span>
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
          <span>{language === 'fr' ? 'Canaux & Mappage' : language === 'ar' ? 'القنوات والتوزيع' : 'Channels & Mapping'} ({domainChannels.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('parity')}
          className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-all shrink-0 ${
            activeTab === 'parity'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Percent size={15} />
          <span>{language === 'fr' ? 'Parité Tarifaire & Commissions' : language === 'ar' ? 'مقارنة الأسعار والعمولات' : 'Rate Parity & Commissions'}</span>
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
          <span>{language === 'fr' ? 'Journal Événements XML' : language === 'ar' ? 'سجل العمليات' : 'Sync Logs'}</span>
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
          <span>{language === 'fr' ? 'Assistant Keystore CI' : 'Keystore CI Guide'}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono">
            com.planning.oran
          </span>
        </button>
      </div>

      {/* TAB 1: ALERTS CENTER */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Severity Filter Controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-slate-400 text-[11px] mr-1">Filtrer :</span>
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
                Critiques ({domainAlerts.filter((a) => a.severity === 'critical').length})
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
                Attention ({domainAlerts.filter((a) => a.severity === 'warning').length})
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
                    className={`p-3.5 md:p-4 rounded-xl border transition-all ${
                      alt.isResolved
                        ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : isCrit
                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 shadow-xs'
                        : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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

                          <span className="text-[10px] text-slate-400 font-mono">
                            {alt.timestamp}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                          {alt.title[language] || alt.title.en}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {alt.description[language] || alt.description.en}
                        </p>

                        <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 mt-2">
                          <strong className="block text-emerald-600 dark:text-emerald-400 mb-0.5 text-[10px] uppercase">
                            Action Recommandée :
                          </strong>
                          {alt.recommendedAction[language] || alt.recommendedAction.en}
                        </div>
                      </div>

                      {/* Action Button */}
                      {!alt.isResolved ? (
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setResolvingAlert(alt);
                              setSelectedResolutionOption('reassign');
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCheck size={14} />
                            <span>Résoudre le Conflit</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 shrink-0">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
            {domainChannels.map((channel) => (
              <div
                key={channel.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-3"
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
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
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
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Mappage :</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      {channel.mappedUnitsCount}/{channel.totalUnitsCount} unités
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Majoration :</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
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
                      onClick={() => setConfiguringChannel(channel)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Configurer Mappage & Paramètres"
                    >
                      <Settings2 size={13} />
                      <span>Configurer</span>
                    </button>

                    <button
                      onClick={() => handleSyncChannel(channel.id)}
                      disabled={syncingChannelId === channel.id}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
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

      {/* TAB 3: PARITY & COMMISSIONS MATRIX */}
      {activeTab === 'parity' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Percent size={16} className="text-emerald-500" />
                  Comparateur de Parité Tarifaire & Marges Net
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visualisez l'impact des commissions OTA sur votre tarif net et protégez vos ventes directes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Règle de Parité :</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px] rounded">
                  Majorations Appliquées
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Ressource</th>
                    <th className="py-2.5 px-3 font-mono">Tarif Direct (0% OTA)</th>
                    <th className="py-2.5 px-3 font-mono">Booking.com (+15%)</th>
                    <th className="py-2.5 px-3 font-mono">Airbnb (+12%)</th>
                    <th className="py-2.5 px-3 font-mono">Expedia (+18%)</th>
                    <th className="py-2.5 px-3 font-mono">Gain Net Direct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {domainResources.map((res) => {
                    const direct = res.pricePerDay || 100;
                    const bookingPrice = Math.round(direct * 1.15);
                    const airbnbPrice = Math.round(direct * 1.12);
                    const expediaPrice = Math.round(direct * 1.18);
                    const commissionSaved = Math.round(direct * 0.15);

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                          {res.name}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {direct} €
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 tabular-nums">
                          {bookingPrice} € <span className="text-[10px] text-slate-400 font-sans">(-{Math.round(bookingPrice * 0.15)}€ com.)</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 tabular-nums">
                          {airbnbPrice} € <span className="text-[10px] text-slate-400 font-sans">(-{Math.round(airbnbPrice * 0.12)}€ com.)</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 tabular-nums">
                          {expediaPrice} € <span className="text-[10px] text-slate-400 font-sans">(-{Math.round(expediaPrice * 0.18)}€ com.)</span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                          +{commissionSaved} € / nuit
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOGS & WEBHOOKS */}
      {activeTab === 'logs' && (
        <div className="p-4 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-2">
            <span className="font-bold text-white flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              Journal Temps Réel des Événements XML / iCal (Webhook Stream)
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={() => setLogDirectionFilter('all')}
                className={`px-2 py-0.5 rounded transition-colors ${logDirectionFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
              >
                Tous
              </button>
              <button
                onClick={() => setLogDirectionFilter('inbound')}
                className={`px-2 py-0.5 rounded transition-colors ${logDirectionFilter === 'inbound' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
              >
                Inbound
              </button>
              <button
                onClick={() => setLogDirectionFilter('outbound')}
                className={`px-2 py-0.5 rounded transition-colors ${logDirectionFilter === 'outbound' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
              >
                Outbound
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {syncLogs
              .filter((log) => logDirectionFilter === 'all' || log.direction === logDirectionFilter)
              .map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 p-2 bg-slate-900/80 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">{log.timestamp}</span>
                  <span className="text-cyan-400 font-bold shrink-0">[{log.channelName}]</span>
                  <span className="text-amber-300 font-medium shrink-0">{log.action}</span>
                  <span className="text-slate-300 flex-1 min-w-0 truncate">{log.payloadSummary}</span>
                  <span className="text-slate-500 text-[10px] shrink-0 tabular-nums">{log.durationMs}ms</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 5: KEYSTORE GUIDE (CI SECRETS) */}
      {activeTab === 'keystore_guide' && (
        <div className="p-4 md:p-5 bg-slate-900 text-slate-200 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center gap-2.5">
            <KeyRound size={22} className="text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Configuration Déploiement Android & Keystore (com.planning.oran)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Identifiant de l'application Play Store : <code className="text-amber-300 font-mono">com.planning.oran</code>
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg text-xs space-y-2 text-amber-200">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Package name officiel configuré : com.planning.oran</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-300/90">
              L'Application ID est rigoureusement fixé à <code className="text-white">com.planning.oran</code> conformément à votre instruction et au contrat AGENTS.md.
            </p>
          </div>

          {/* Quick Command */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-cyan-400">Commande keytool avec votre package com.planning.oran :</div>
            <div className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-emerald-400 flex items-center justify-between gap-2 overflow-x-auto">
              <span className="truncate">keytool -genkeypair -v -storetype JKS -keystore planning-oran.keystore -alias oran-release-key -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Planning Oran, OU=Dev, O=Planning, C=DZ"</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    'keytool -genkeypair -v -storetype JKS -keystore planning-oran.keystore -alias oran-release-key -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Planning Oran, OU=Dev, O=Planning, C=DZ"',
                    'keytool-oran'
                  )
                }
                className="p-1.5 hover:bg-slate-800 rounded text-slate-300 shrink-0"
              >
                {copiedKey === 'keytool-oran' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CONNECT NEW CHANNEL */}
      {isAddChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="text-blue-500" size={18} />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Connecter un Nouveau Canal OTA
                </h3>
              </div>
              <button
                onClick={() => setIsAddChannelModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Plateforme ou Fournisseur :
                </label>
                <select
                  value={newChannelProvider}
                  onChange={(e) => {
                    setNewChannelProvider(e.target.value);
                    if (e.target.value === 'booking') setNewChannelName('Booking.com Pro');
                    if (e.target.value === 'airbnb') setNewChannelName('Airbnb Instant');
                    if (e.target.value === 'expedia') setNewChannelName('Expedia Direct');
                    if (e.target.value === 'doctolib') setNewChannelName('Doctolib Cabinet API');
                    if (e.target.value === 'ical') setNewChannelName('Flux Calendrier iCal');
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="booking">Booking.com (XML 2-Way)</option>
                  <option value="airbnb">Airbnb Pro (XML / iCal)</option>
                  <option value="expedia">Expedia Partner Central (XML)</option>
                  <option value="agoda">Agoda YCS (XML)</option>
                  <option value="doctolib">Doctolib Santé API (REST)</option>
                  <option value="google">Google Hotels Free Links</option>
                  <option value="thefork">TheFork / TripAdvisor</option>
                  <option value="ical">Calendrier iCal Personnalisé (.ics)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom d'affichage du canal * :
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="ex: Booking.com Principal"
                  className="w-full h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Protocole :
                  </label>
                  <select
                    value={newChannelSyncType}
                    onChange={(e) => setNewChannelSyncType(e.target.value as ChannelSyncType)}
                    className="w-full h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="2_way_xml">2-Way XML</option>
                    <option value="ical">iCal Feed</option>
                    <option value="rest_api">REST API</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Majoration tarifaire (%) :
                  </label>
                  <input
                    type="number"
                    value={newChannelMarkup}
                    onChange={(e) => setNewChannelMarkup(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Clé API / Token de Connexion (optionnel) :
                </label>
                <input
                  type="password"
                  value={newChannelApiKey}
                  onChange={(e) => setNewChannelApiKey(e.target.value)}
                  placeholder="xml_sec_key_••••••••"
                  className="w-full h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddChannelModalOpen(false)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Connecter & Synchroniser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURE CHANNEL & ROOM MAPPING */}
      {configuringChannel && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{configuringChannel.logo}</span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Paramètres : {configuringChannel.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID : {configuringChannel.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConfiguringChannel(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Parameters grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Majoration commission (%) :
                  </label>
                  <input
                    type="number"
                    value={configuringChannel.markupPercent}
                    onChange={(e) =>
                      setConfiguringChannel({
                        ...configuringChannel,
                        markupPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-8 px-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Seuil Stop-Sell auto :
                  </label>
                  <input
                    type="number"
                    value={configuringChannel.autoStopSellThreshold}
                    onChange={(e) =>
                      setConfiguringChannel({
                        ...configuringChannel,
                        autoStopSellThreshold: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full h-8 px-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Resource Mapping Checklist */}
              <div>
                <span className="font-bold text-slate-900 dark:text-white block mb-1.5">
                  Mappage des unités / chambres :
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {domainResources.map((res) => {
                    const icalExportUrl = `https://api.omnibook.io/v1/ical/export/${configuringChannel.id}/${res.id}.ics`;

                    return (
                      <div
                        key={res.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {res.name}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(icalExportUrl, `ical-${res.id}`)}
                          className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[10px] font-mono flex items-center gap-1"
                          title="Copier lien export iCal pour ce canal"
                        >
                          <Link2 size={11} />
                          <span>{copiedKey === `ical-${res.id}` ? 'Copié !' : 'Lien iCal'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setConfiguringChannel(null)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Enregistrer les Modifications
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFLICT RESOLUTION WORKFLOW */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-rose-500" size={20} />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Résolution du Conflit OTA (#{resolvingAlert.id})
                </h3>
              </div>
              <button
                onClick={() => setResolvingAlert(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1">
                <span className="font-bold text-rose-900 dark:text-rose-200 block text-xs">
                  {resolvingAlert.title[language] || resolvingAlert.title.en}
                </span>
                <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                  {resolvingAlert.description[language] || resolvingAlert.description.en}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-900 dark:text-white block mb-2">
                  Sélectionnez l'action de résolution immédiate :
                </span>
                <div className="space-y-2">
                  <label
                    onClick={() => setSelectedResolutionOption('reassign')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedResolutionOption === 'reassign'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      checked={selectedResolutionOption === 'reassign'}
                      onChange={() => setSelectedResolutionOption('reassign')}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold">
                        Option 1 : Réassignation automatique vers unité libre équivalente
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Transfère la réservation vers une chambre disponible de même catégorie sans surcoût et envoie un SMS de confirmation.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setSelectedResolutionOption('upgrade')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedResolutionOption === 'upgrade'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      checked={selectedResolutionOption === 'upgrade'}
                      onChange={() => setSelectedResolutionOption('upgrade')}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold">
                        Option 2 : Surclassement offert (Suite / Catégorie Prestige)
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Fidélise le client en le positionnant sur la catégorie supérieure sans supplément tarifaire.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setSelectedResolutionOption('cancel')}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedResolutionOption === 'cancel'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      checked={selectedResolutionOption === 'cancel'}
                      onChange={() => setSelectedResolutionOption('cancel')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold">
                        Option 3 : Annuler la réservation OTA avec remboursement intégral
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Notifie l'OTA (Booking / Airbnb) d'un incident technique, déclenche le remboursement automatique sans pénalité pour l'établissement.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleExecuteResolution}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Exécuter & Synchroniser l'OTA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
