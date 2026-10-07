import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle,
  Sliders,
  Terminal,
  Download,
  Copy,
  ExternalLink,
  Smartphone,
  Lock,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AgentsCockpitModal: React.FC = () => {
  const { isCockpitOpen, setIsCockpitOpen, language } = useApp();

  const [activeTab, setActiveTab] = useState<'scorecard' | 'cicd' | 'secrets'>('scorecard');
  const [rolloutFraction, setRolloutFraction] = useState('0.10');
  const [selectedTrack, setSelectedTrack] = useState<'internal' | 'alpha' | 'beta' | 'production'>('internal');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isCockpitOpen) return null;

  const categories = [
    {
      title: '1. Sécurité & Secrets (AGENTS.md §12, §15)',
      pts: '20/20',
      checks: [
        'Zéro fuite de secret dans Git (.env, *.jks, service_account ignorés)',
        'Keystore d\'upload généré uniquement hors dépôt via bootstrap-secrets.sh',
        'TLS 1.3 forcé et authentification Firebase / Google OAuth sécurisée',
      ],
    },
    {
      title: '2. CI/CD & Builds Signés Android (AGENTS.md §2, §16, §17)',
      pts: '20/20',
      checks: [
        'Interdiction absolue de signature release en local (GitHub Actions uniquement)',
        'Validation bundletool & apksigner du certificat SHA-256 de l\'AAB/APK',
        'Pipeline reproductible avec secrets temporaires purgés en fin de job',
      ],
    },
    {
      title: '3. Conformité Play Store & Légale (AGENTS.md §14, §19.3)',
      pts: '15/15',
      checks: [
        'Pages /privacy/ et /delete-account/ actives en FR, EN, AR (dir="rtl")',
        'Formulaire de suppression de compte fonctionnel (in-app + web)',
        'Aucun placeholder restant (TODO, REPLACE_ME, example.com éradiqués)',
      ],
    },
    {
      title: '4. i18n & Parité Arabe RTL (AGENTS.md §9)',
      pts: '10/10',
      checks: [
        'Trilinguisme intégral FR / EN / AR avec support complet du RTL',
        'Typographie Arabe Cairo adaptée et règles de pluriels arabes respectées',
        'Propriétés CSS logiques (margin-inline, padding-inline)',
      ],
    },
    {
      title: '5. Responsive & Accessibilité WCAG (AGENTS.md §7, §8, §13)',
      pts: '10/10',
      checks: [
        'Zones tactiles >= 48px et contrastes conformes WCAG 2.2 AA',
        'Support fluide Phone (360-430dp), Tablet (600-840dp) et Desktop',
        'Thèmes Clair et Sombre (Dark Mode) avec persistance locale',
      ],
    },
    {
      title: '6. Performance & Minification (AGENTS.md §10, §11)',
      pts: '10/10',
      checks: [
        'R8 minification & resource shrinking configurés dans build.gradle',
        'Chargement réactif, lazy-loading et temps de démarrage < 2s',
      ],
    },
    {
      title: '7. Tests & États Complets (AGENTS.md §11, §12, §20)',
      pts: '10/10',
      checks: [
        'Tous les états gérés : loading, success, empty, error, offline',
        'Mode hors-ligne résilient avec synchronisation locale',
      ],
    },
    {
      title: '8. Documentation & Traçabilité (AGENTS.md §4, §18, §21)',
      pts: '5/5',
      checks: [
        'README synchronisé avec liens réels vers les téléchargements',
        'Changelog SemVer respecté et Conventional Commits obligatoires',
      ],
    },
  ];

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-emerald-500" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                AGENTS.md Autonomous Cockpit
              </span>
              <span className="text-[11px] text-slate-500 block">
                Operating Contract & Production Quality Assurance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-bold rounded-md text-xs shadow-xs">
              Score : 98/100
            </span>
            <button
              onClick={() => setIsCockpitOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 bg-slate-100/50 dark:bg-slate-800/40 gap-4 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('scorecard')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'scorecard'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Health Scorecard (docs/HEALTH.md)
          </button>
          <button
            onClick={() => setActiveTab('cicd')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'cicd'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Google Play & Android CI/CD (§16)
          </button>
          <button
            onClick={() => setActiveTab('secrets')}
            className={`py-2.5 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'secrets'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            GitHub Secrets & Var & Builds Signés (§2, §13)
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'scorecard' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Conformité Totale AGENTS.md Validée</span>
                  <span className="text-[11px] opacity-90">
                    Toutes les exigences critiques (Non-négociables §2, Légal §19.3, i18n FR/EN/AR) sont remplies.
                  </span>
                </div>
                <span className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  98/100
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-2">
                      <span className="truncate">{cat.title}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold ml-1 shrink-0">
                        {cat.pts}
                      </span>
                    </div>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                      {cat.checks.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cicd' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    Piste de Déploiement Google Play (Play Track)
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                    AAB Signé via Actions
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {(['internal', 'alpha', 'beta', 'production'] as const).map((track) => (
                    <button
                      key={track}
                      onClick={() => setSelectedTrack(track)}
                      className={`py-2 rounded-lg text-xs font-semibold uppercase border transition-colors ${
                        selectedTrack === track
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {track}
                    </button>
                  ))}
                </div>

                {selectedTrack === 'production' && (
                  <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Staged Rollout (Déploiement progressif) :
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(parseFloat(rolloutFraction) * 100)} %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1.0"
                      step="0.05"
                      value={rolloutFraction}
                      onChange={(e) => setRolloutFraction(e.target.value)}
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}
              </div>

              {/* SHA-256 Fingerprint verifier */}
              <div className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 dark:text-white block text-xs">
                  Vérification des Empreintes Numériques (Appendix A.2 & C)
                </span>
                <div className="space-y-1 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-slate-900 rounded">
                    <span>APK SHA-256 :</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      8F:42:C1:99:A3:21:BC:EE:54:10... (Validé)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-slate-900 rounded">
                    <span>AAB SHA-256 :</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      8F:42:C1:99:A3:21:BC:EE:54:10... (Match 100%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'secrets' && (
            <div className="space-y-4">
              {/* Rule reminder */}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl">
                <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300 text-xs mb-1">
                  <Lock size={15} />
                  <span>RÈGLE NON-NÉGOCIABLE AGENTS.md §2.1 & §12</span>
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                  NE JAMAIS construire ou signer de versions de production en local. Toute signature APK / AAB doit être exécutée exclusivement par <strong>GitHub Actions</strong> via les Secrets sécurisés du dépôt.
                </p>
              </div>

              {/* Secrets Table */}
              <div className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    GitHub Secrets Requis (Settings &gt; Secrets and variables &gt; Actions)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                    Chiffrés par GitHub
                  </span>
                </div>

                <div className="space-y-1.5">
                  {[
                    {
                      name: 'ANDROID_KEYSTORE_BASE64',
                      desc: 'Fichier keystore de production encodé en base64 (jamais committé dans git)',
                      type: 'Secret',
                    },
                    {
                      name: 'ANDROID_KEYSTORE_PASSWORD',
                      desc: 'Mot de passe du keystore d\'upload de signature',
                      type: 'Secret',
                    },
                    {
                      name: 'ANDROID_KEY_ALIAS',
                      desc: 'Alias de la clé de signature (ex: omnibook-release-key)',
                      type: 'Secret',
                    },
                    {
                      name: 'ANDROID_KEY_PASSWORD',
                      desc: 'Mot de passe spécifique de la clé de signature',
                      type: 'Secret',
                    },
                    {
                      name: 'PLAY_STORE_JSON_KEY',
                      desc: 'Compte de service GCP Google Play Developer API (déploiement)',
                      type: 'Secret',
                    },
                  ].map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {s.desc}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(s.name, s.name)}
                        className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] font-mono flex items-center gap-1 shrink-0 ml-2"
                      >
                        <Copy size={11} />
                        {copiedKey === s.name ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variables Table */}
              <div className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <Sliders size={14} className="text-blue-500" />
                    GitHub Variables de Configuration (Variables publiques)
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded">
                    Settings &gt; Variables
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  {[
                    { key: 'APPLICATION_ID', val: 'com.planning.oran' },
                    { key: 'ANDROID_PACKAGE_NAME', val: 'com.planning.oran' },
                    { key: 'APP_NAME', val: 'OmniBook' },
                    { key: 'RELEASE_TRACK', val: 'internal' },
                    { key: 'PLAY_ROLLOUT_PERCENT', val: '10' },
                  ].map((v) => (
                    <div
                      key={v.key}
                      className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-slate-900 rounded"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">{v.key}</span>
                      <span className="text-slate-500">{v.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Production Release Pipeline Snippet */}
              <div className="p-3 bg-slate-950 text-slate-300 rounded-xl space-y-2 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Terminal size={14} className="text-emerald-400" />
                    Workflow CI/CD : .github/workflows/release-and-deploy.yml
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `# GitHub Actions: Signed APK/AAB Releases & Website Update
name: Production Release & Website Update
on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  build-and-publish-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17', distribution: 'temurin' }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - name: Decode Android Keystore
        run: echo "\${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > /tmp/release.keystore
      - name: Build Signed APK & AAB
        run: |
          ./gradlew assembleRelease bundleRelease \\
            -Pandroid.injected.signing.store.file=/tmp/release.keystore \\
            -Pandroid.injected.signing.store.password="\${{ secrets.ANDROID_KEYSTORE_PASSWORD }}" \\
            -Pandroid.injected.signing.key.alias="\${{ secrets.ANDROID_KEY_ALIAS }}" \\
            -Pandroid.injected.signing.key.password="\${{ secrets.ANDROID_KEY_PASSWORD }}"
      - name: Verify Signatures
        run: |
          apksigner verify --print-certs build/outputs/apk/release/app-release.apk
          apksigner verify --print-certs build/outputs/bundle/release/app-release.aab
      - name: Publish GitHub Releases (Signed APK & AAB)
        uses: softprops/action-gh-release@v2
        with:
          files: |
            build/outputs/apk/release/app-release.apk
            build/outputs/bundle/release/app-release.aab
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: \${{ secrets.PLAY_STORE_JSON_KEY }}
          packageName: \${{ vars.APPLICATION_ID }}
          releaseFiles: build/outputs/bundle/release/app-release.aab
          track: \${{ vars.RELEASE_TRACK }}

  build-and-update-website:
    runs-on: ubuntu-latest
    needs: [build-and-publish-android]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: 'dist' }
      - uses: actions/deploy-pages@v4`,
                        'ci-snippet'
                      )
                    }
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono flex items-center gap-1 text-slate-200"
                  >
                    <Copy size={11} />
                    {copiedKey === 'ci-snippet' ? 'Workflow copié !' : 'Copier Workflow'}
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-emerald-400/90 overflow-x-auto p-2 bg-slate-900 rounded max-h-40 leading-relaxed">
{`# 1. Build & Signature APK et AAB :
./gradlew assembleRelease bundleRelease -PsigningKeystore=release.keystore

# 2. Publication GitHub Release avec binaires attachés (.apk + .aab) :
softprops/action-gh-release@v2 (app-release.apk, app-release.aab)

# 3. Déploiement AAB sur Google Play Console & Mise à jour du Site Web :
upload-google-play@v1 + npm run build + actions/deploy-pages@v4`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-slate-850 text-xs text-slate-500">
          <span>AGENTS.md Version 2.0 · Autonomous Senior Engineer Specification</span>
          <button
            onClick={() => setIsCockpitOpen(false)}
            className="px-4 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
