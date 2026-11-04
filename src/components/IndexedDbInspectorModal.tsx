import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Database,
  X,
  Layers3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  LockKeyhole,
  CalendarDays,
  Receipt,
  Boxes,
  Search,
  HardDrive,
  ShieldCheck,
  FileJson,
  ChevronDown,
  Upload,
  Download,
  ShieldAlert,
} from 'lucide-react';
import { indexedDb, IndexedDbStoreStats } from '../db/indexedDb';
import { useApp } from '../context/AppContext';
import { lockManager } from '../locks/lockManager';
import { mdbSnapshotToPlanning, type MdbTableSummary } from '../locks/database/mdbImport';
import { initialResourceGroups } from '../data/mockData';

const DEMO_RESOURCE_GROUP_IDS = new Set(initialResourceGroups.map((group) => group.id));
import { createClient } from '@supabase/supabase-js';

type StoreName = 'bookings' | 'invoices' | 'resources';

const STORE_META: Record<StoreName, { icon: React.ElementType; label: { fr: string; en: string; ar: string }; description: { fr: string; en: string; ar: string } }> = {
  bookings: {
    icon: CalendarDays,
    label: { fr: 'Réservations', en: 'Bookings', ar: 'الحجوزات' },
    description: { fr: 'Séjours et réservations enregistrés localement', en: 'Stays and bookings stored locally', ar: 'الإقامات والحجوزات المخزنة محلياً' },
  },
  invoices: {
    icon: Receipt,
    label: { fr: 'Factures', en: 'Invoices', ar: 'الفواتير' },
    description: { fr: 'Documents de facturation locaux', en: 'Local billing documents', ar: 'مستندات الفوترة المحلية' },
  },
  resources: {
    icon: Boxes,
    label: { fr: 'Ressources', en: 'Resources', ar: 'الموارد' },
    description: { fr: 'Unités et ressources opérationnelles', en: 'Operational units and resources', ar: 'الوحدات والموارد التشغيلية' },
  },
};

const COPY = {
  fr: {
    title: 'Base de données locale',
    subtitle: 'Explorateur des données enregistrées sur cet appareil',
    local: 'Stockage navigateur',
    readonly: 'Lecture seule',
    readonlyText: 'Consultation uniquement : aucune modification ni suppression ne peut être effectuée depuis cet écran.',
    schema: 'Version du schéma',
    records: 'Enregistrements',
    collections: 'Collections',
    refresh: 'Actualiser',
    refreshing: 'Actualisation…',
    search: 'Rechercher dans cette page…',
    page: 'Page',
    of: 'sur',
    previous: 'Précédent',
    next: 'Suivant',
    empty: 'Aucun enregistrement dans cette collection.',
    noMatch: 'Aucun résultat sur cette page.',
    loading: 'Lecture des données locales…',
    error: 'La lecture de la base locale a échoué.',
    record: 'Enregistrement',
    id: 'Identifiant',
    noId: 'Sans identifiant',
    details: 'Afficher le JSON',
    footer: 'IndexedDB est le stockage local de cette application. Cet écran ne représente pas la base Supabase distante ni son état de synchronisation.',
    fallback: 'Repli localStorage',
    native: 'IndexedDB natif',
    detecting: 'Détection…',
    count: 'éléments',
  },
  en: {
    title: 'Local database',
    subtitle: 'Explore data stored on this device',
    local: 'Browser storage',
    readonly: 'Read only',
    readonlyText: 'View only: records cannot be edited or deleted from this screen.',
    schema: 'Schema version',
    records: 'Records',
    collections: 'Collections',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    search: 'Search this page…',
    page: 'Page',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    empty: 'No records in this collection.',
    noMatch: 'No results on this page.',
    loading: 'Reading local data…',
    error: 'Unable to read the local database.',
    record: 'Record',
    id: 'Identifier',
    noId: 'No identifier',
    details: 'Show JSON',
    footer: 'IndexedDB is this application’s local storage. This screen does not represent the remote Supabase database or its synchronization state.',
    fallback: 'localStorage fallback',
    native: 'Native IndexedDB',
    detecting: 'Detecting…',
    count: 'items',
  },
  ar: {
    title: 'قاعدة البيانات المحلية',
    subtitle: 'استعراض البيانات المحفوظة على هذا الجهاز',
    local: 'تخزين المتصفح',
    readonly: 'للقراءة فقط',
    readonlyText: 'للاطلاع فقط: لا يمكن تعديل السجلات أو حذفها من هذه الشاشة.',
    schema: 'إصدار المخطط',
    records: 'السجلات',
    collections: 'المجموعات',
    refresh: 'تحديث',
    refreshing: 'جارٍ التحديث…',
    search: 'البحث في هذه الصفحة…',
    page: 'صفحة',
    of: 'من',
    previous: 'السابق',
    next: 'التالي',
    empty: 'لا توجد سجلات في هذه المجموعة.',
    noMatch: 'لا توجد نتائج في هذه الصفحة.',
    loading: 'جارٍ قراءة البيانات المحلية…',
    error: 'تعذرت قراءة قاعدة البيانات المحلية.',
    record: 'سجل',
    id: 'المعرّف',
    noId: 'دون معرّف',
    details: 'عرض JSON',
    footer: 'IndexedDB هو التخزين المحلي للتطبيق. لا تمثل هذه الشاشة قاعدة Supabase البعيدة أو حالة المزامنة معها.',
    fallback: 'تخزين احتياطي localStorage',
    native: 'IndexedDB الأصلي',
    detecting: 'جارٍ الكشف…',
    count: 'عنصر',
  },
};


const MANAGEMENT_COPY = {
  fr: {tableInventory:'Inventaire de toutes les tables MDB',table:'Table',rows:'Lignes',columns:'Colonnes',system:'Système Access',unreadable:'illisible',center:'Centre de données',localTab:'Local & CardLock',supabaseTab:'Supabase',neonTab:'Neon',backupTab:'Sauvegarde',localTitle:'Importer la base proUSB CardLock',localPath:'Chemin attendu : C:\\Program Files (x86)\\proUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',localWarning:'Dans Windows, privilégiez la copie VirtualStore si CardLock.exe modifie la base. Sélectionnez le fichier : le navigateur ne peut pas lire ce chemin automatiquement.',chooseFile:'Choisir CardLock.mdb',analyzing:'Analyse…',confirm:(r:number,g:number,c:number)=>`CardLock : ${r} chambres, ${g} séjours, ${c} cartes.\n\nImporter les chambres et séjours dans le planning ?`,stale:'Fichier ancien : vérifiez la copie VirtualStore.',cancelled:'Analyse terminée. Import annulé ; aucune donnée du planning modifiée.',done:(b:number,r:number,g:number,c:number,w:number)=>`Import terminé : ${b} bâtiments, ${r} chambres, ${g} séjours, ${c} cartes.${w?` ${w} avertissement(s).`:''}`,importError:'Import CardLock impossible.',projectUrl:'Project URL',publishable:'Publishable key',anon:'Anon key (legacy)',keyHint:'Clés publiques protégées par RLS. Ne saisissez jamais une service_role key. Publishable est prioritaire.',test:'Tester la connexion',save:'Enregistrer et appliquer',invalid:'URL HTTPS et clé publique obligatoires',testing:'Test en cours…',connected:'Connexion API et table workspaces accessibles',testError:'Échec de connexion Supabase',saved:'Configuration publique enregistrée. Rechargement pour appliquer au client principal…',neonWarning:'Un connecteur PostgreSQL côté serveur est requis. Le navigateur et le lanceur Edge ne peuvent pas ouvrir une connexion PostgreSQL directe de manière sûre. Ne stockez jamais cette chaîne dans le navigateur.',neonLabel:'Direct connection string (saisie temporaire uniquement)',neonPlaceholder:'postgresql://user:password@host/db?sslmode=require',neonNotice:'Connecteur serveur Neon absent. La chaîne ne sera pas enregistrée ni testée. Backend sécurisé, gestionnaire de secrets et TLS requis.',clear:'Effacer la chaîne saisie',backupTitle:'Sauvegarde locale exportable',backupHint:'Inclut les collections IndexedDB et l’instantané CardLock. Joignez le fichier manuellement à Gmail ou importez-le dans Drive. OAuth Gmail/Drive non configuré.',preparing:'Préparation…',downloaded:'Sauvegarde téléchargée. Joignez-la à Gmail ou déposez-la dans Drive.',backupError:'Échec de la sauvegarde.',download:'Télécharger la sauvegarde'},
  en: {tableInventory:'All MDB tables inventory',table:'Table',rows:'Rows',columns:'Columns',system:'Access system',unreadable:'unreadable',center:'Data center',localTab:'Local & CardLock',supabaseTab:'Supabase',neonTab:'Neon',backupTab:'Backup',localTitle:'Import proUSB CardLock database',localPath:'Expected path: C:\\Program Files (x86)\\proUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',localWarning:'On Windows, prefer the VirtualStore copy if CardLock.exe updates the database. Select the file manually; browsers cannot read this path automatically.',chooseFile:'Choose CardLock.mdb',analyzing:'Analyzing…',confirm:(r:number,g:number,c:number)=>`CardLock: ${r} rooms, ${g} stays, ${c} cards.\n\nImport rooms and stays into planning?`,stale:'Old file: check the VirtualStore copy.',cancelled:'Analysis complete. Import cancelled; planning data was not changed.',done:(b:number,r:number,g:number,c:number,w:number)=>`Import complete: ${b} buildings, ${r} rooms, ${g} stays, ${c} cards.${w?` ${w} warning(s).`:''}`,importError:'CardLock import failed.',projectUrl:'Project URL',publishable:'Publishable key',anon:'Anon key (legacy)',keyHint:'Public keys protected by RLS. Never enter a service_role key. Publishable takes precedence.',test:'Test connection',save:'Save and apply',invalid:'HTTPS URL and public key are required',testing:'Testing…',connected:'API reachable and workspaces table available',testError:'Supabase connection failed',saved:'Configuration saved. Reloading to apply…',neonWarning:'A server-side PostgreSQL connector is required. The browser and Edge launcher cannot safely open a direct PostgreSQL connection. Never store this string in the browser.',neonLabel:'Direct connection string (temporary input only)',neonPlaceholder:'postgresql://user:password@host/db?sslmode=require',neonNotice:'No Neon server connector. The string will not be saved or tested. A secure backend, secret manager and TLS are required.',clear:'Clear entered string',backupTitle:'Downloadable local backup',backupHint:'Includes IndexedDB collections and CardLock snapshot. Manually attach it to Gmail or upload to Drive. Gmail/Drive OAuth is not configured.',preparing:'Preparing…',downloaded:'Backup downloaded. Attach it to Gmail or upload to Drive.',backupError:'Backup failed.',download:'Download backup'},
  ar: {tableInventory:'جرد جميع جداول MDB',table:'الجدول',rows:'الصفوف',columns:'الأعمدة',system:'نظام Access',unreadable:'غير قابل للقراءة',center:'مركز البيانات',localTab:'محلي وCardLock',supabaseTab:'Supabase',neonTab:'Neon',backupTab:'نسخة احتياطية',localTitle:'استيراد قاعدة proUSB CardLock',localPath:'المسار المتوقع: C:\\Program Files (x86)\\proUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',localWarning:'في Windows، استخدم نسخة VirtualStore إذا كان CardLock.exe يحدّث القاعدة. اختر الملف يدوياً؛ لا يستطيع المتصفح قراءة المسار تلقائياً.',chooseFile:'اختيار CardLock.mdb',analyzing:'جارٍ التحليل…',confirm:(r:number,g:number,c:number)=>`CardLock: ${r} غرفة و${g} إقامة و${c} بطاقة.\n\nهل تريد استيراد الغرف والإقامات إلى التخطيط؟`,stale:'الملف قديم: تحقق من نسخة VirtualStore.',cancelled:'اكتمل التحليل. تم إلغاء الاستيراد ولم تتغير بيانات التخطيط.',done:(b:number,r:number,g:number,c:number,w:number)=>`اكتمل الاستيراد: ${b} مبنى و${r} غرفة و${g} إقامة و${c} بطاقة.${w?` ${w} تحذير.`:''}`,importError:'تعذر استيراد CardLock.',projectUrl:'رابط المشروع',publishable:'مفتاح Publishable',anon:'مفتاح Anon (قديم)',keyHint:'مفاتيح عامة محمية بسياسات RLS. لا تدخل service_role أبداً. لمفتاح Publishable الأولوية.',test:'اختبار الاتصال',save:'حفظ وتطبيق',invalid:'يلزم رابط HTTPS ومفتاح عام',testing:'جارٍ الاختبار…',connected:'الواجهة متاحة وجدول workspaces يعمل',testError:'فشل الاتصال بـ Supabase',saved:'تم حفظ الإعدادات. جارٍ إعادة التحميل…',neonWarning:'يلزم موصل PostgreSQL على الخادم. لا يمكن للمتصفح ومشغل Edge فتح اتصال مباشر آمن. لا تخزن السلسلة في المتصفح.',neonLabel:'سلسلة الاتصال المباشر (إدخال مؤقت)',neonPlaceholder:'postgresql://user:password@host/db?sslmode=require',neonNotice:'موصل Neon غير متوفر. لن تُحفظ السلسلة أو تُختبر. يلزم خادم آمن ومدير أسرار وTLS.',clear:'مسح السلسلة',backupTitle:'نسخة احتياطية محلية',backupHint:'تتضمن مجموعات IndexedDB ولقطة CardLock. أرفق الملف يدوياً في Gmail أو ارفعه إلى Drive. لم تتم تهيئة OAuth.',preparing:'جارٍ الإعداد…',downloaded:'تم تنزيل النسخة. أرفقها في Gmail أو ارفعها إلى Drive.',backupError:'فشل النسخ الاحتياطي.',download:'تنزيل النسخة'}
} as const;

export const IndexedDbInspectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { language, setBookings, setResourceGroups } = useApp();
  const t = COPY[language] || COPY.fr;
  const isRtl = language === 'ar';
  const mt = MANAGEMENT_COPY[language] || MANAGEMENT_COPY.fr;
  const [stats, setStats] = useState<IndexedDbStoreStats | null>(null);
  const [activeStore, setActiveStore] = useState<StoreName>('bookings');
  const [storeData, setStoreData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activePanel, setActivePanel] = useState<'local' | 'supabase' | 'neon' | 'backup'>('local');
  const [mdbBusy, setMdbBusy] = useState(false);
  const [mdbMessage, setMdbMessage] = useState<string | null>(null);
  const [mdbTables, setMdbTables] = useState<MdbTableSummary[]>([]);
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('appointment_supabase_url') || 'https://vkmgakmujipnpjlawjqm.supabase.co');
  const [publishableKey, setPublishableKey] = useState(() => localStorage.getItem('appointment_supabase_publishable_key') || '');
  const [anonKey, setAnonKey] = useState(() => localStorage.getItem('appointment_supabase_anon_key') || '');
  const [supabaseState, setSupabaseState] = useState('Configuration locale non vérifiée');
  const [neonConnectionString, setNeonConnectionString] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const limit = 8;

  const loadStatsAndData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, result] = await Promise.all([
        indexedDb.getStats(),
        indexedDb.queryStore<any>(activeStore, { offset, limit }),
      ]);
      setStats(nextStats);
      setStoreData(result.data);
      setTotalCount(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setStoreData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeStore, offset, t.error]);

  useEffect(() => {
    if (isOpen) void loadStatsAndData();
  }, [isOpen, loadStatsAndData]);

  useEffect(() => {
    if (!isOpen) setNeonConnectionString('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleMdbImport = async (file: File | null) => {
    if (!file) return;
    setMdbBusy(true);
    setMdbMessage(null);
    setMdbTables([]);
    try {
      const snapshot = await lockManager.importMdb(file);
      setMdbTables(snapshot.tables ?? []);
      const sourceIsOld = snapshot.fileLastModified ? (Date.now() - new Date(snapshot.fileLastModified).getTime()) / 86400000 > 90 : false;
      if (snapshot.counts.rooms === 0) {
        throw new Error('Aucune chambre exploitable trouvée dans RoomInfo. L’inventaire existant a été conservé.');
      }
      const planning = mdbSnapshotToPlanning(snapshot);
      const importNow = window.confirm(mt.confirm(snapshot.counts.rooms, snapshot.counts.guests, snapshot.counts.cards));
      if (importNow) {
        setResourceGroups(current => [
          ...current.filter(group => !group.id.startsWith('mdb-') && !DEMO_RESOURCE_GROUP_IDS.has(group.id)),
          ...planning.resourceGroups,
        ]);
        setBookings(current => [
          ...current.filter(item => item.customMetadata?.source !== 'cardlock_mdb'),
          ...planning.bookings,
        ]);
      }
      const tableSummary = (snapshot.tables ?? []).map(table => `${table.name}: ${table.rowCount}`).join(', ');
      const buildingSummary = planning.buildingStats.map(building => `B${building.no}=${building.rooms}`).join(' · ');
      const resultMessage = importNow
        ? mt.done(planning.buildingStats.length, snapshot.counts.rooms, planning.bookings.length, snapshot.counts.cards, snapshot.warnings.length + planning.warnings.length) + ` ${buildingSummary}. Tables: ${tableSummary}.`
        : mt.cancelled + ` Tables: ${tableSummary}.`;
      setMdbMessage(resultMessage + (sourceIsOld ? ` ${mt.stale}` : ''));
      await loadStatsAndData();
    } catch (err) {
      setMdbMessage(err instanceof Error ? err.message : mt.importError);
    } finally { setMdbBusy(false); }
  };

  const testSupabase = async () => {
    const key = publishableKey.trim() || anonKey.trim();
    if (!/^https:\/\//i.test(supabaseUrl.trim()) || !key) { setSupabaseState(mt.invalid); return; }
    setSupabaseState(mt.testing);
    try {
      const client = createClient(supabaseUrl.trim(), key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await client.from('workspaces').select('id').limit(1);
      if (error) throw error;
      setSupabaseState(mt.connected);
    } catch (err) { setSupabaseState(err instanceof Error ? err.message : mt.testError); }
  };

  const saveSupabase = () => {
    const key = publishableKey.trim() || anonKey.trim();
    if (!/^https:\/\//i.test(supabaseUrl.trim()) || !key) { setSupabaseState(mt.invalid); return; }
    localStorage.setItem('appointment_supabase_url', supabaseUrl.trim());
    localStorage.setItem('appointment_supabase_publishable_key', publishableKey.trim());
    localStorage.setItem('appointment_supabase_anon_key', anonKey.trim());
    setSupabaseState(mt.saved);
    window.setTimeout(() => window.location.reload(), 700);
  };

  const exportBackup = async () => {
    setBackupMessage(mt.preparing);
    try {
      const stores = await indexedDb.exportSnapshot();
      const payload = { format: 'appointment-local-backup', version: 1, exportedAt: new Date().toISOString(), stores, cardLockSnapshot: lockManager.getMdbSnapshot() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `appointment-backup-${new Date().toISOString().slice(0,10)}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupMessage(mt.downloaded);
    } catch (err) { setBackupMessage(err instanceof Error ? err.message : mt.backupError); }
  };

  const filteredData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return storeData;
    return storeData.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(term));
  }, [storeData, search]);

  if (!isOpen) return null;

  const totalRecords = stats
    ? stats.storeCounts.bookings + stats.storeCounts.invoices + stats.storeCounts.resources
    : 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const storageLabel = stats?.storageType === 'IndexedDB'
    ? t.native
    : stats?.storageType === 'LocalStorage_Fallback'
      ? t.fallback
      : t.detecting;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-2 backdrop-blur-sm animate-in fade-in sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="indexeddb-inspector-title"
        className="my-auto flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:rounded-3xl"
      >
        <header className="relative shrink-0 overflow-hidden bg-slate-950 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute -right-12 -top-24 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <Database size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="indexeddb-inspector-title" className="truncate text-base font-bold tracking-tight sm:text-lg">{t.title}</h2>
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">{mt.center}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{t.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'ar' ? 'إغلاق' : language === 'en' ? 'Close' : 'Fermer'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-slate-300">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-cyan-300" />
            <p><strong className="text-white">Données locales prioritaires.</strong> Importez CardLock, configurez les accès publics Supabase et consultez les états de sauvegarde. Les identifiants PostgreSQL restent côté serveur.</p>
          </div>
        </header>


        <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
          <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Gestion des données">
            {([['local',mt.localTab],['supabase',mt.supabaseTab],['neon',mt.neonTab],['backup',mt.backupTab]] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setActivePanel(id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${activePanel===id?'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200':'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{label}</button>)}
          </nav>
          {activePanel === 'local' && <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div><p className="text-sm font-semibold text-slate-900 dark:text-white">{mt.localTitle}</p><p className="mt-1 break-all text-[11px] text-slate-500">{mt.localPath}</p><p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{mt.localWarning}</p></div>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-bold text-white hover:bg-cyan-600"><Upload size={15}/>{mdbBusy?mt.analyzing:mt.chooseFile}<input className="hidden" type="file" accept=".mdb,application/x-msaccess" disabled={mdbBusy} onChange={event => { const file=event.target.files?.[0] ?? null; void handleMdbImport(file); event.currentTarget.value=''; }}/></label>
            {mdbMessage && <p role="status" className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">{mdbMessage}</p>}
            {mdbTables.length > 0 && <details className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">{mt.tableInventory} ({mdbTables.length})</summary>
              <div className="mt-3 max-h-72 overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900"><tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th className="py-2 pr-3">{mt.table}</th><th className="py-2 pr-3">{mt.rows}</th><th className="py-2 pr-3">{mt.columns}</th><th className="py-2">{mt.system}</th></tr></thead>
                  <tbody>{mdbTables.map((table) => <tr key={table.name} className="border-b border-slate-100 dark:border-slate-800 align-top">
                    <td className="py-2 pr-3 font-semibold whitespace-nowrap">{table.name}</td>
                    <td className="py-2 pr-3 tabular-nums">{table.readable ? table.rowCount : mt.unreadable}</td>
                    <td className="py-2 pr-3 break-words">{table.columns.join(', ') || '—'}</td>
                    <td className="py-2">{table.system ? '✓' : '—'}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </details>
          </div>}
          {activePanel === 'supabase' && <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">{mt.projectUrl}<input value={supabaseUrl} onChange={e=>setSupabaseUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-normal dark:border-slate-700 dark:bg-slate-950"/></label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">{mt.publishable}<input type="password" autoComplete="off" value={publishableKey} onChange={e=>setPublishableKey(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-normal dark:border-slate-700 dark:bg-slate-950"/></label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">{mt.anon}<input type="password" autoComplete="off" value={anonKey} onChange={e=>setAnonKey(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-normal dark:border-slate-700 dark:bg-slate-950"/></label>
            <p className="text-[11px] text-slate-500 sm:col-span-2">{mt.keyHint}</p>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><button type="button" onClick={()=>void testSupabase()} className="rounded-lg border border-cyan-600 px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{mt.test}</button><button type="button" onClick={saveSupabase} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white">{mt.save}</button><span role="status" className="text-xs text-slate-500">{supabaseState}</span></div>
          </div>}
          {activePanel === 'neon' && <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><ShieldAlert size={16} className="mt-0.5 shrink-0"/><p><strong>{mt.neonWarning}</strong></p></div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">{mt.neonLabel}<input type="password" autoComplete="off" value={neonConnectionString} onChange={e=>setNeonConnectionString(e.target.value)} placeholder={mt.neonPlaceholder} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-normal dark:border-slate-700 dark:bg-slate-950"/></label>
            <p className="text-[11px] text-slate-500">{mt.neonNotice}</p>
            <button type="button" onClick={()=>setNeonConnectionString('')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{mt.clear}</button>
          </div>}
          {activePanel === 'backup' && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{mt.backupTitle}</p><p className="mt-1 text-[11px] text-slate-500">{mt.backupHint}</p>{backupMessage && <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-300">{backupMessage}</p>}</div><button type="button" onClick={()=>void exportBackup()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-bold text-white"><Download size={15}/>{mt.download}</button></div>}
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3 sm:gap-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300"><HardDrive size={17} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.local}</p>
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{storageLabel}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300"><FileJson size={17} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.schema}</p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{stats ? `v${stats.version}` : '—'}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"><Layers3 size={17} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.records}</p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{stats ? totalRecords.toLocaleString() : '—'}</p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <nav aria-label={t.collections} className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:w-56 lg:flex-col lg:gap-1.5 lg:border-b-0 lg:border-e lg:p-4">
            <p className="hidden px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:block">{t.collections}</p>
            {(['bookings', 'invoices', 'resources'] as StoreName[]).map((storeName) => {
              const meta = STORE_META[storeName];
              const Icon = meta.icon;
              const selected = activeStore === storeName;
              return (
                <button
                  type="button"
                  key={storeName}
                  onClick={() => {
                    setActiveStore(storeName);
                    setOffset(0);
                    setSearch('');
                  }}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-w-[135px] flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors lg:min-w-0 lg:flex-none ${selected ? 'border-cyan-500/40 bg-cyan-50 text-cyan-800 shadow-sm dark:border-cyan-400/30 dark:bg-cyan-950/40 dark:text-cyan-200' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-400 dark:hover:border-slate-800 dark:hover:bg-slate-800/60'}`}
                >
                  <Icon size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{meta.label[language] || meta.label.fr}</span>
                    <span className={`mt-0.5 hidden truncate text-[9px] sm:block ${selected ? 'text-cyan-700/80 dark:text-cyan-300/70' : 'text-slate-400'}`}>{meta.description[language] || meta.description.fr}</span>
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono tabular-nums ${selected ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{stats?.storeCounts[storeName] ?? '—'}</span>
                </button>
              );
            })}
          </nav>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950/60">
            <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{STORE_META[activeStore].label[language] || STORE_META[activeStore].label.fr}</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">{totalCount.toLocaleString()} {t.count}</p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.search}
                    aria-label={t.search}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void loadStatsAndData()}
                  disabled={loading}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-cyan-300"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">{loading ? t.refreshing : t.refresh}</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div><strong>{t.error}</strong><p className="mt-1 break-words">{error}</p></div>
                </div>
              )}

              {loading && !error && (
                <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-slate-500">
                  <RefreshCw size={16} className="animate-spin" /> {t.loading}
                </div>
              )}

              {!loading && !error && storeData.length === 0 && (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 text-center dark:border-slate-800 dark:bg-slate-900/50">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Database size={22} /></span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.empty}</p>
                </div>
              )}

              {!loading && !error && storeData.length > 0 && filteredData.length === 0 && (
                <p className="py-12 text-center text-xs text-slate-500">{t.noMatch}</p>
              )}

              {!loading && !error && filteredData.length > 0 && (
                <div className="space-y-2.5">
                  {filteredData.map((item, index) => {
                    const recordId = item?.id == null ? `${activeStore}-${offset + index}` : String(item.id);
                    return (
                      <details key={recordId} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition open:border-cyan-300/70 dark:border-slate-800 dark:bg-slate-900 dark:open:border-cyan-700/70">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 dark:hover:bg-slate-800/60 sm:px-4">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><FileJson size={15} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.record} {offset + index + 1}</span>
                            <span className="mt-0.5 block truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{item?.id == null ? t.noId : item.id}</span>
                          </span>
                          <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-500 dark:bg-slate-800 sm:inline">{STORE_META[activeStore].label[language] || STORE_META[activeStore].label.fr}</span>
                          <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60 sm:p-4">
                          <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[10px] leading-relaxed text-slate-700 whitespace-pre-wrap break-all dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{JSON.stringify(item, null, 2)}</pre>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
              <button
                type="button"
                disabled={offset <= 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"
              >
                {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                <span className="hidden sm:inline">{t.previous}</span>
              </button>
              <span className="text-[10px] font-medium tabular-nums text-slate-500">{t.page} {currentPage} {t.of} {pageCount}</span>
              <button
                type="button"
                disabled={offset + limit >= totalCount || loading}
                onClick={() => setOffset(offset + limit)}
                className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"
              >
                <span className="hidden sm:inline">{t.next}</span>
                {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </main>
        </div>

        <footer className="flex shrink-0 items-start gap-2 border-t border-slate-200 bg-slate-100 px-4 py-3 text-[10px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:px-6">
          <LockKeyhole size={13} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p>{t.footer}</p>
        </footer>
      </section>
    </div>
  );
};
