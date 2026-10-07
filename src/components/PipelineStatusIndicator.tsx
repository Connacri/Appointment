import React, { useState, useEffect, useRef } from 'react';
import {
  GitBranch,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Terminal,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DeploymentLogs } from './DeploymentLogs';

export type PipelineStatus = 'success' | 'in_progress' | 'queued' | 'failure';

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: string;
}

export interface PipelineRun {
  id: number;
  workflowName: string;
  commitHash: string;
  commitMessage: string;
  branch: string;
  status: PipelineStatus;
  startedAt: string;
  duration: string;
  trigger: string;
  steps: WorkflowStep[];
}

export const PipelineStatusIndicator: React.FC = () => {
  const { language, setIsCockpitOpen } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initial mock workflow run based on GitHub Actions API
  const [currentRun, setCurrentRun] = useState<PipelineRun>({
    id: 482,
    workflowName: 'Production Signed Release & Cloud Deploy',
    commitHash: '7f3a9d2',
    commitMessage: 'feat: add booking analytics, objectbox & strict domain RBAC',
    branch: 'main',
    status: 'success',
    startedAt: 'Il y a 3 minutes',
    duration: '1m 48s',
    trigger: 'workflow_dispatch',
    steps: [
      { name: 'Checkout repository & audit git state', status: 'completed', duration: '4s' },
      { name: 'Setup Java 17 Temurin & Node.js 22', status: 'completed', duration: '12s' },
      { name: 'Decode Keystore from ANDROID_KEYSTORE_BASE64', status: 'completed', duration: '2s' },
      { name: 'Build signed APK & AAB (assembleRelease + bundleRelease)', status: 'completed', duration: '42s' },
      { name: 'apksigner verify SHA-256 fingerprint (APK & AAB)', status: 'completed', duration: '6s' },
      { name: 'Publish GitHub Releases (Signed APK & AAB)', status: 'completed', duration: '14s' },
      { name: 'Deploy Google Play & Update Production Website', status: 'completed', duration: '28s' },
    ],
  });

  const [isTriggering, setIsTriggering] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handler to Trigger a fresh Build & Deployment
  const handleTriggerBuild = () => {
    if (isTriggering) return;
    setIsTriggering(true);

    const newId = currentRun.id + 1;
    const initialSteps: WorkflowStep[] = [
      { name: 'Checkout repository & audit git state', status: 'pending' },
      { name: 'Setup Java 17 Temurin & Node.js 22', status: 'pending' },
      { name: 'Decode Keystore from ANDROID_KEYSTORE_BASE64', status: 'pending' },
      { name: 'Build signed APK & AAB (assembleRelease + bundleRelease)', status: 'pending' },
      { name: 'apksigner verify SHA-256 fingerprint (APK & AAB)', status: 'pending' },
      { name: 'Publish GitHub Releases (Signed APK & AAB)', status: 'pending' },
      { name: 'Deploy Google Play & Update Production Website', status: 'pending' },
    ];

    // 1. Queued state
    setCurrentRun({
      id: newId,
      workflowName: 'Production Signed Release & Cloud Deploy',
      commitHash: Math.random().toString(16).substring(2, 9),
      commitMessage: 'chore(ci): manual workflow_dispatch release trigger',
      branch: 'main',
      status: 'queued',
      startedAt: 'À l\'instant',
      duration: '0s',
      trigger: 'manual by user',
      steps: initialSteps,
    });
    setCurrentStepIndex(0);

    // 2. Start running steps incrementally
    setTimeout(() => {
      setCurrentRun((prev) => ({
        ...prev,
        status: 'in_progress',
        steps: prev.steps.map((s, idx) => (idx === 0 ? { ...s, status: 'running' } : s)),
      }));

      // Simulate steps progressing
      const stepDurations = [700, 900, 600, 1400, 800, 1100, 1200];
      let accumulated = 0;

      stepDurations.forEach((dur, idx) => {
        accumulated += dur;
        setTimeout(() => {
          setCurrentStepIndex(idx + 1);
          setCurrentRun((prev) => {
            const nextSteps = prev.steps.map((step, sIdx) => {
              if (sIdx < idx) return { ...step, status: 'completed' as const, duration: `${Math.round(stepDurations[sIdx] / 100)}s` };
              if (sIdx === idx) return { ...step, status: 'completed' as const, duration: `${Math.round(dur / 100)}s` };
              if (sIdx === idx + 1) return { ...step, status: 'running' as const };
              return step;
            });

            const isLast = idx === stepDurations.length - 1;
            return {
              ...prev,
              status: isLast ? 'success' : 'in_progress',
              duration: isLast ? '1m 24s' : `${Math.round(accumulated / 1000)}s`,
              steps: nextSteps,
            };
          });

          if (idx === stepDurations.length - 1) {
            setIsTriggering(false);
          }
        }, accumulated);
      });
    }, 900);
  };

  const getStatusBadge = (status: PipelineStatus) => {
    switch (status) {
      case 'success':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-500',
          textColor: 'text-emerald-700 dark:text-emerald-400',
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800',
          label: 'Success',
        };
      case 'in_progress':
      case 'queued':
        return {
          icon: status === 'in_progress' ? RotateCw : Clock,
          color: status === 'in_progress' ? 'text-blue-500 animate-spin' : 'text-amber-500 animate-pulse',
          textColor: status === 'in_progress' ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400',
          bg: status === 'in_progress' ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800' : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800',
          label: 'Pending',
        };
      case 'failure':
        return {
          icon: AlertCircle,
          color: 'text-rose-500',
          textColor: 'text-rose-700 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800',
          label: 'Failed',
        };
    }
  };

  const specificStatus: 'Pending' | 'Success' | 'Failed' =
    currentRun.status === 'success'
      ? 'Success'
      : currentRun.status === 'failure'
      ? 'Failed'
      : 'Pending';

  const badge = getStatusBadge(currentRun.status);
  const StatusIcon = badge.icon;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* TopBar Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all select-none ${badge.bg} hover:opacity-90 active:scale-98`}
        title={`Pipeline: ${specificStatus} · Last run duration: ${currentRun.duration} (Run #${currentRun.id})`}
      >
        <span className="relative flex h-2 w-2">
          {currentRun.status === 'in_progress' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              currentRun.status === 'success'
                ? 'bg-emerald-500'
                : currentRun.status === 'failure'
                ? 'bg-rose-500'
                : currentRun.status === 'in_progress'
                ? 'bg-blue-500'
                : 'bg-amber-500'
            }`}
          ></span>
        </span>

        <StatusIcon size={14} className={badge.color} />

        {/* Specific Status Label: Pending, Success, Failed */}
        <span className="flex items-center gap-1 text-[11px]">
          <span className="hidden xl:inline text-slate-500 dark:text-slate-400 font-mono">
            CI #{currentRun.id} ·
          </span>
          <span className={`font-bold ${badge.textColor}`}>
            {specificStatus}
          </span>
        </span>

        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Hover Tooltip: Showing Last Run Duration */}
      {isHovered && !isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-40 bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-sans px-3 py-2 rounded-xl shadow-xl border border-slate-700/80 whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-blue-400 shrink-0" />
            <span className="text-slate-300">
              Last run duration: <strong className="font-mono text-emerald-400 font-bold">{currentRun.duration}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span>Status: <strong className={badge.textColor}>{specificStatus}</strong></span>
            <span>·</span>
            <span>Run #{currentRun.id}</span>
            <span>·</span>
            <span>{currentRun.startedAt}</span>
          </div>
        </div>
      )}

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg">
                <GitBranch size={16} />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block leading-tight">
                  GitHub Actions Pipeline
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <span>run #{currentRun.id}</span>
                  <span>·</span>
                  <span className="text-blue-500">{currentRun.branch}</span>
                  <span>·</span>
                  <span>{currentRun.commitHash}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-3.5 space-y-3.5 text-xs">
            {/* Status & Timing Banner */}
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
              <div className="flex items-center gap-2">
                <StatusIcon size={16} className={badge.color} />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block flex items-center gap-1.5">
                    <span>Status:</span>
                    <span className={badge.textColor}>{specificStatus}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentRun.startedAt} · Durée : {currentRun.duration}
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold uppercase">
                {specificStatus}
              </span>
            </div>

            {/* Quick Status Preview / Simulation Switcher */}
            <div className="flex items-center justify-between p-2 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl text-[11px]">
              <span className="text-slate-500 text-[10px] font-medium">Aperçu statut :</span>
              <div className="flex items-center gap-1">
                {(['Pending', 'Success', 'Failed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      const mappedStatus: PipelineStatus =
                        st === 'Success' ? 'success' : st === 'Failed' ? 'failure' : 'queued';
                      setCurrentRun((prev) => ({
                        ...prev,
                        status: mappedStatus,
                        duration: st === 'Failed' ? '38s (failed)' : st === 'Pending' ? '12s (queued)' : '1m 48s',
                      }));
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                      specificStatus === st
                        ? st === 'Success'
                          ? 'bg-emerald-600 text-white'
                          : st === 'Failed'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-600 text-white'
                        : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Commit message */}
            <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
              {currentRun.commitMessage}
            </div>

            {/* Steps Progress Checklist */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Étapes du Workflow (AGENTS.md §2 & §16)
              </span>

              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                {currentRun.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-1.5 rounded text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {step.status === 'completed' ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : step.status === 'running' ? (
                        <RotateCw size={13} className="text-blue-500 animate-spin shrink-0" />
                      ) : (
                        <Clock size={13} className="text-slate-400 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          step.status === 'running'
                            ? 'font-bold text-blue-600 dark:text-blue-400'
                            : step.status === 'completed'
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.name}
                      </span>
                    </div>

                    <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                      {step.status === 'completed' ? step.duration : step.status === 'running' ? '...' : 'queued'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar: Trigger Build & Logs Buttons */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <button
                onClick={handleTriggerBuild}
                disabled={isTriggering}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isTriggering ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    <span>Exécution du build...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-current" />
                    <span>Trigger Build</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsLogsOpen(true);
                }}
                className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-200 font-mono text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 border border-slate-700"
                title="Consulter les logs de build temps réel"
              >
                <Terminal size={14} className="text-emerald-400" />
                <span>Logs</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsCockpitOpen(true);
                }}
                className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                title="Ouvrir les détails CI/CD dans le Cockpit"
              >
                <ShieldCheck size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time GitHub Actions Deployment Logs Modal */}
      <DeploymentLogs
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        runId={currentRun.id}
        commitHash={currentRun.commitHash}
        branch={currentRun.branch}
        isLive={isTriggering}
      />
    </div>
  );
};
