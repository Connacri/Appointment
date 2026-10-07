import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Copy,
  Download,
  Search,
  CheckCircle2,
  RotateCw,
  Clock,
  AlertCircle,
  X,
  Play,
  Maximize2,
  Minimize2,
  ArrowDown,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface LogLine {
  id: string;
  timestamp: string;
  stepId: number;
  stepName: string;
  level: 'info' | 'cmd' | 'success' | 'warn' | 'error';
  message: string;
}

interface DeploymentLogsProps {
  isOpen: boolean;
  onClose: () => void;
  runId?: number;
  commitHash?: string;
  branch?: string;
  isLive?: boolean;
}

export const DeploymentLogs: React.FC<DeploymentLogsProps> = ({
  isOpen,
  onClose,
  runId = 482,
  commitHash = '7f3a9d2',
  branch = 'main',
  isLive = false,
}) => {
  const { language } = useApp();
  const [selectedStep, setSelectedStep] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const initialLogLines: LogLine[] = [
    // Step 1: Checkout & Audit
    { id: '1', timestamp: '06:04:02.102Z', stepId: 1, stepName: 'Checkout & Git Audit', level: 'cmd', message: '$ git clone --depth=1 https://github.com/omnibook/applet.git .' },
    { id: '2', timestamp: '06:04:03.220Z', stepId: 1, stepName: 'Checkout & Git Audit', level: 'info', message: 'Checking out commit 7f3a9d2 on branch refs/heads/main' },
    { id: '3', timestamp: '06:04:03.450Z', stepId: 1, stepName: 'Checkout & Git Audit', level: 'info', message: 'Verifying Git clean tree status (AGENTS.md §3 compliance)' },
    { id: '4', timestamp: '06:04:04.010Z', stepId: 1, stepName: 'Checkout & Git Audit', level: 'success', message: '✔ Git audit complete: 0 untracked files, branch clean.' },

    // Step 2: Environment setup
    { id: '5', timestamp: '06:04:04.550Z', stepId: 2, stepName: 'Setup Toolchains', level: 'cmd', message: '$ actions/setup-java@v4 --java-version=17 --distribution=temurin' },
    { id: '6', timestamp: '06:04:07.120Z', stepId: 2, stepName: 'Setup Toolchains', level: 'info', message: 'Setting up Eclipse Temurin JDK 17.0.12+7 (x64)' },
    { id: '7', timestamp: '06:04:09.300Z', stepId: 2, stepName: 'Setup Toolchains', level: 'cmd', message: '$ actions/setup-node@v4 --node-version=22.14.0 --cache=npm' },
    { id: '8', timestamp: '06:04:11.890Z', stepId: 2, stepName: 'Setup Toolchains', level: 'success', message: '✔ Toolchain ready: Gradle 8.10, Node v22.14.0, Vite 8.3' },

    // Step 3: Decrypt Secrets
    { id: '9', timestamp: '06:04:12.400Z', stepId: 3, stepName: 'Decode Keystore Secret', level: 'cmd', message: '$ echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > /tmp/release.keystore' },
    { id: '10', timestamp: '06:04:13.010Z', stepId: 3, stepName: 'Decode Keystore Secret', level: 'info', message: 'Validating keystore format: JKS certificate chain length: 1' },
    { id: '11', timestamp: '06:04:13.620Z', stepId: 3, stepName: 'Decode Keystore Secret', level: 'warn', message: 'AGENTS.md §2.1 enforcement: local release builds blocked, executing in isolated GitHub runner.' },
    { id: '12', timestamp: '06:04:14.200Z', stepId: 3, stepName: 'Decode Keystore Secret', level: 'success', message: '✔ Keystore loaded securely into memory, chmod 0600 enforced.' },

    // Step 4: Build Signed APK & AAB
    { id: '13', timestamp: '06:04:14.800Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'cmd', message: '$ ./gradlew assembleRelease bundleRelease --no-daemon --parallel -PminifyWithR8=true' },
    { id: '14', timestamp: '06:04:22.400Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'info', message: ':app:preReleaseBuild UP-TO-DATE' },
    { id: '15', timestamp: '06:04:31.900Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'info', message: ':app:compileReleaseKotlin [OmniBook Domain Modules, ObjectBox Entities]' },
    { id: '16', timestamp: '06:04:45.100Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'info', message: ':app:minifyReleaseWithR8: Shrinking resources, bytecode optimizations applied.' },
    { id: '17', timestamp: '06:04:54.300Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'info', message: ':app:signReleaseBundle & signReleaseApk with alias [omnibook-release-key]' },
    { id: '18', timestamp: '06:04:58.200Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'success', message: '✔ Signed APK ready: build/outputs/apk/release/app-release.apk (15.2 MB)' },
    { id: '19', timestamp: '06:04:59.100Z', stepId: 4, stepName: 'Build Signed APK & AAB', level: 'success', message: '✔ Signed AAB ready: build/outputs/bundle/release/app-release.aab (18.4 MB)' },

    // Step 5: apksigner Verify
    { id: '20', timestamp: '06:04:59.810Z', stepId: 5, stepName: 'apksigner Verify SHA-256', level: 'cmd', message: '$ apksigner verify --print-certs --verbose build/outputs/apk/release/app-release.apk build/outputs/bundle/release/app-release.aab' },
    { id: '21', timestamp: '06:05:01.300Z', stepId: 5, stepName: 'apksigner Verify SHA-256', level: 'info', message: 'Signer certificate DN: CN=OmniBook Production, O=OmniBook SAS, C=FR' },
    { id: '22', timestamp: '06:05:02.100Z', stepId: 5, stepName: 'apksigner Verify SHA-256', level: 'info', message: 'SHA-256 digest: 8F:42:C1:99:A3:21:BC:EE:54:10:98:DF:4A:8C:7E:5B:3D:12:90:FA:BB:61:9A:8C' },
    { id: '23', timestamp: '06:05:03.400Z', stepId: 5, stepName: 'apksigner Verify SHA-256', level: 'success', message: '✔ Verified: V1, V2, V3 APK signature scheme valid. Matches Google Play Console certificate.' },

    // Step 6: Publish GitHub Releases (APK & AAB)
    { id: '24', timestamp: '06:05:04.100Z', stepId: 6, stepName: 'Publish GitHub Releases', level: 'cmd', message: '$ softprops/action-gh-release@v2 --tag=v2026.10.2 --files=app-release.apk,app-release.aab' },
    { id: '25', timestamp: '06:05:07.400Z', stepId: 6, stepName: 'Publish GitHub Releases', level: 'info', message: 'Creating release tag [v2026.10.2] with auto-generated changelog.' },
    { id: '26', timestamp: '06:05:11.800Z', stepId: 6, stepName: 'Publish GitHub Releases', level: 'info', message: 'Uploading binary asset: app-release.apk (15.2 MB) [application/vnd.android.package-archive]' },
    { id: '27', timestamp: '06:05:16.200Z', stepId: 6, stepName: 'Publish GitHub Releases', level: 'info', message: 'Uploading binary asset: app-release.aab (18.4 MB) [application/octet-stream]' },
    { id: '28', timestamp: '06:05:18.000Z', stepId: 6, stepName: 'Publish GitHub Releases', level: 'success', message: '✔ GitHub Release v2026.10.2 published with signed APK & AAB attachments.' },

    // Step 7: Deploy Play Store & Update Website
    { id: '29', timestamp: '06:05:18.700Z', stepId: 7, stepName: 'Deploy Play Store & Website', level: 'cmd', message: '$ r0adkll/upload-google-play@v1 --track=internal --rollout=0.10' },
    { id: '30', timestamp: '06:05:25.200Z', stepId: 7, stepName: 'Deploy Play Store & Website', level: 'info', message: 'Uploaded release track [internal] versionCode: 2026102601' },
    { id: '31', timestamp: '06:05:27.100Z', stepId: 7, stepName: 'Deploy Play Store & Website', level: 'cmd', message: '$ npm run build && actions/deploy-pages@v4' },
    { id: '32', timestamp: '06:05:36.400Z', stepId: 7, stepName: 'Deploy Play Store & Website', level: 'info', message: 'vite v8.3.0 building for production... 42 modules transformed, dist/ generated.' },
    { id: '33', timestamp: '06:05:42.800Z', stepId: 7, stepName: 'Deploy Play Store & Website', level: 'info', message: 'Deploying updated static website build to production hosting (Pages/Cloud Run)' },
    { id: '34', timestamp: '06:05:46.000Z', stepId: 7, stepName: 'Deploy Play Store & Website', level: 'success', message: '✔ Pipeline finished in 1m 44s: Signed APK/AAB published & Website updated successfully!' },
  ];

  const [logs, setLogs] = useState<LogLine[]>(initialLogLines);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, selectedStep]);

  if (!isOpen) return null;

  // Filter logs by step and search query
  const filteredLogs = logs.filter((line) => {
    if (selectedStep !== 'all' && line.stepId !== selectedStep) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        line.message.toLowerCase().includes(q) ||
        line.stepName.toLowerCase().includes(q) ||
        line.timestamp.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.stepName}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.stepName}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `github-actions-run-${runId}-${commitHash}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stepsList = [
    { id: 1, name: '1. Checkout' },
    { id: 2, name: '2. Toolchains' },
    { id: 3, name: '3. Secrets' },
    { id: 4, name: '4. Build APK & AAB' },
    { id: 5, name: '5. apksigner' },
    { id: 6, name: '6. GitHub Releases' },
    { id: 7, name: '7. Play Store & Web' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullScreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-5xl h-[85vh] max-h-[850px]'
        }`}
      >
        {/* Terminal Title Bar */}
        <div className="h-12 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
          {/* Left: Window controls & Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block cursor-pointer hover:opacity-80" onClick={onClose} />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block cursor-pointer hover:opacity-80" onClick={() => setIsFullScreen(!isFullScreen)} />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
              <Terminal size={14} className="text-emerald-400" />
              <span className="font-bold text-white">GitHub Actions Logs</span>
              <span className="text-slate-500">·</span>
              <span className="text-blue-400">run #{runId}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 font-mono text-[11px]">{branch}@{commitHash}</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {language === 'fr' ? 'Sortie Console Réelle' : 'Real-time Console'}
            </span>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title={isFullScreen ? 'Réduire' : 'Plein écran'}
            >
              {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter & Toolbar Bar */}
        <div className="p-2.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Step Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedStep('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors shrink-0 ${
                selectedStep === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Tous les logs ({logs.length})
            </button>

            {stepsList.map((step) => (
              <button
                key={step.id}
                onClick={() => setSelectedStep(step.id)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-colors shrink-0 ${
                  selectedStep === step.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {step.name}
              </button>
            ))}
          </div>

          {/* Search, Auto-Scroll, Copy & Download */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'fr' ? 'Filtrer les lignes...' : 'Filter output...'}
                className="h-7 pl-6 pr-2 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 sm:w-44"
              />
            </div>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1 transition-colors border ${
                autoScroll
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Défilement automatique"
            >
              <ArrowDown size={12} className={autoScroll ? 'animate-bounce' : ''} />
              <span className="hidden sm:inline">Auto-scroll</span>
            </button>

            <button
              onClick={handleCopyLogs}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-mono border border-slate-700"
              title="Copier les logs filtrés"
            >
              <Copy size={13} />
              <span className="hidden sm:inline">{isCopied ? 'Copié !' : 'Copier'}</span>
            </button>

            <button
              onClick={handleDownloadLogs}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-mono border border-slate-700"
              title="Télécharger le fichier .log"
            >
              <Download size={13} />
              <span className="hidden sm:inline">.log</span>
            </button>
          </div>
        </div>

        {/* Monospace Terminal Output Body */}
        <div
          ref={logsContainerRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-[11px] sm:text-xs leading-relaxed space-y-1 bg-slate-950 text-slate-300 select-text selection:bg-blue-600/30 selection:text-white"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              Aucune ligne ne correspond à la recherche "{searchQuery}".
            </div>
          ) : (
            filteredLogs.map((log) => {
              const levelColor =
                log.level === 'cmd'
                  ? 'text-cyan-300 font-bold'
                  : log.level === 'success'
                  ? 'text-emerald-400 font-medium'
                  : log.level === 'warn'
                  ? 'text-amber-400'
                  : log.level === 'error'
                  ? 'text-rose-400 font-bold'
                  : 'text-slate-300';

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 sm:gap-3 py-0.5 px-1.5 rounded hover:bg-slate-900/80 transition-colors group"
                >
                  {/* Timestamp */}
                  <span className="text-slate-600 text-[10px] select-none shrink-0 font-mono pt-0.5">
                    {log.timestamp}
                  </span>

                  {/* Step tag */}
                  <span className="text-slate-500 text-[10px] bg-slate-900 px-1 rounded select-none shrink-0 border border-slate-800 font-mono hidden md:inline">
                    {log.stepName}
                  </span>

                  {/* Message */}
                  <span className={`flex-1 break-all whitespace-pre-wrap ${levelColor}`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Terminal Footer Bar */}
        <div className="h-8 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>Terminal: UTF-8</span>
            <span>Lignes: {filteredLogs.length}</span>
            <span className="text-emerald-400">Statut: Exit Code 0 (Success)</span>
          </div>

          <div className="flex items-center gap-2">
            <span>AGENTS.md §2 CI/CD Verification Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};
