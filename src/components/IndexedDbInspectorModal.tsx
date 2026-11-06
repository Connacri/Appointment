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
  EyeOff,
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
  Cloud,
  CheckCircle2,
  Server,
  Key,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Activity,
  Globe,
  Trash2,
  ArrowRight,
  CheckCircle,
  Info,
} from 'lucide-react';
import { indexedDb, IndexedDbStoreStats } from '../db/indexedDb';
import { useApp } from '../context/AppContext';
import { lockManager } from '../locks/lockManager';
import { mdbSnapshotToPlanning, type MdbTableSummary } from '../locks/database/mdbImport';
import { initialResourceGroups } from '../data/mockData';
import { createClient } from '@supabase/supabase-js';

const DEMO_RESOURCE_GROUP_IDS = new Set(initialResourceGroups.map((group) => group.id));

const DEFAULT_SUPABASE_URL = 'https://vkmgakmujipnpjlawjqm.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_yIVkxXo_x--f6FWt5zua1w_GzqI5XNv';

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
    title: 'Centre de Données & Cloud',
    subtitle: 'Architecture hybride : Données locales IndexedDB, CardLock et passerelles Cloud',
    local: 'Stockage navigateur',
    readonly: 'Lecture seule',
    readonlyText: 'Consultation uniquement : aucune modification ni suppression ne peut être effectuée depuis cet écran.',
    schema: 'Version du schéma',
    records: 'Enregistrements',
    collections: 'Collections',
    refresh: 'Actualiser',
    refreshing: 'Actualisation…',
    search: 'Rechercher un enregistrement…',
    page: 'Page',
    of: 'sur',
    previous: 'Précédent',
    next: 'Suivant',
    empty: 'Aucun enregistrement dans cette collection.',
    noMatch: 'Aucun résultat ne correspond à la recherche.',
    loading: 'Lecture des données locales…',
    error: 'La lecture de la base locale a échoué.',
    record: 'Enregistrement',
    id: 'Identifiant',
    noId: 'Sans identifiant',
    details: 'Afficher le JSON',
    footer: 'IndexedDB est le stockage local primaire de cette application. Vos données restent 100% accessibles hors ligne même en cas d’indisponibilité du réseau ou des serveurs distants.',
    fallback: 'Repli localStorage',
    native: 'IndexedDB natif',
    detecting: 'Détection…',
    count: 'éléments',
  },
  en: {
    title: 'Data & Cloud Center',
    subtitle: 'Hybrid architecture: Local IndexedDB storage, CardLock engine and Cloud gateways',
    local: 'Browser storage',
    readonly: 'Read only',
    readonlyText: 'View only: records cannot be edited or deleted from this screen.',
    schema: 'Schema version',
    records: 'Records',
    collections: 'Collections',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    search: 'Search record…',
    page: 'Page',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    empty: 'No records in this collection.',
    noMatch: 'No results match your search.',
    loading: 'Reading local data…',
    error: 'Unable to read the local database.',
    record: 'Record',
    id: 'Identifier',
    noId: 'No identifier',
    details: 'Show JSON',
    footer: 'IndexedDB is the primary local storage for this application. Your data remains 100% accessible offline even when network or remote servers are unreachable.',
    fallback: 'localStorage fallback',
    native: 'Native IndexedDB',
    detecting: 'Detecting…',
    count: 'items',
  },
  ar: {
    title: 'مركز البيانات والسحابة',
    subtitle: 'هندسة هجينة: تخزين IndexedDB المحلي، وقاعدة CardLock وبوابات السحابة',
    local: 'تخزين المتصفح',
    readonly: 'للقراءة فقط',
    readonlyText: 'للاطلاع فقط: لا يمكن تعديل السجلات أو حذفها من هذه الشاشة.',
    schema: 'إصدار المخطط',
    records: 'السجلات',
    collections: 'المجموعات',
    refresh: 'تحديث',
    refreshing: 'جارٍ التحديث…',
    search: 'البحث في السجلات…',
    page: 'صفحة',
    of: 'من',
    previous: 'السابق',
    next: 'التالي',
    empty: 'لا توجد سجلات في هذه المجموعة.',
    noMatch: 'لا توجد نتائج تطابق البحث.',
    loading: 'جارٍ قراءة البيانات المحلية…',
    error: 'تعذرت قراءة قاعدة البيانات المحلية.',
    record: 'سجل',
    id: 'المعرّف',
    noId: 'دون معرّف',
    details: 'عرض JSON',
    footer: 'IndexedDB هو التخزين المحلي الأساسي لهذا التطبيق. تظل بياناتك متاحة وتعمل بنسبة 100% دون اتصال بالإنترنت حتى عند انقطاع الشبكة.',
    fallback: 'تخزين احتياطي localStorage',
    native: 'IndexedDB الأصلي',
    detecting: 'جارٍ الكشف…',
    count: 'عنصر',
  },
};

const MANAGEMENT_COPY = {
  fr: {
    tableInventory: 'Inventaire de toutes les tables MDB',
    table: 'Table',
    rows: 'Lignes',
    columns: 'Colonnes',
    system: 'Système Access',
    unreadable: 'illisible',
    center: 'Centre Cloud & Données',
    localTab: 'CardLock.mdb (proUSB)',
    supabaseTab: 'Supabase Cloud',
    neonTab: 'Neon Postgres Cloud',
    explorerTab: 'Données Locales (IndexedDB)',
    backupTab: 'Sauvegardes & Export',
    localTitle: 'Importer la base proUSB CardLock.mdb',
    localPath: 'Emplacement habituel : C:\\Program Files (x86)\\proUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',
    localWarning: 'Sous Windows 10/11, privilégiez la copie VirtualStore si CardLock.exe modifie la base (%LOCALAPPDATA%\\VirtualStore). Le navigateur ne peut pas lire ce chemin sans sélection manuelle du fichier.',
    chooseFile: 'Sélectionner CardLock.mdb',
    analyzing: 'Analyse en cours…',
    confirm: (r: number, g: number, c: number) => `CardLock : ${r} chambres, ${g} séjours, ${c} cartes détectées.\n\nImporter ces chambres et séjours dans le planning ?`,
    stale: 'Fichier ancien (> 90j) : vérifiez la copie VirtualStore.',
    cancelled: 'Analyse terminée. Import annulé ; aucune donnée du planning modifiée.',
    done: (b: number, r: number, g: number, c: number, w: number) => `Import terminé : ${b} bâtiments, ${r} chambres, ${g} séjours, ${c} cartes.${w ? ` ${w} avertissement(s).` : ''}`,
    importError: 'Import CardLock impossible.',
    projectUrl: 'URL du projet Supabase',
    publishable: 'Publishable Key (Clé API Publique)',
    anon: 'Anon Key (Legacy)',
    keyHint: 'Clé publique sécurisée par Row Level Security (RLS). Ne saisissez jamais la service_role key dans le navigateur.',
    test: 'Tester la connexion',
    save: 'Enregistrer & Appliquer',
    resetDefault: 'Rétablir le projet par défaut',
    invalid: 'URL HTTPS et clé publique obligatoires',
    testing: 'Test de connexion en cours…',
    connected: 'Connexion établie avec succès ! API Supabase et table workspaces accessibles.',
    testError: 'Échec de connexion Supabase',
    saved: 'Configuration enregistrée. Rechargement du client…',
    neonWarning: 'Architecture sécurisée : Les navigateurs web ne peuvent pas ouvrir de socket TCP PostgreSQL direct sans exposer les identifiants administrateur. Dans Appointment PMS, l’accès PostgreSQL s’opère via le backend Node.js / Cloud SQL sécurisé.',
    neonLabel: 'Chaîne de connexion directe (test de format uniquement)',
    neonPlaceholder: 'postgresql://user:password@host/db?sslmode=require',
    neonNotice: 'Le connecteur serveur gère les pools de connexion et TLS. La chaîne saisie ici n’est pas conservée en clair dans le navigateur.',
    clear: 'Effacer la saisie',
    backupTitle: 'Archive de sauvegarde locale complète',
    backupHint: 'Génère un instantané JSON complet de toutes les collections IndexedDB (réservations, factures, chambres) et de la structure CardLock.',
    preparing: 'Génération de l’archive…',
    downloaded: 'Sauvegarde téléchargée avec succès. Conservez ce fichier en lieu sûr ou déposez-le sur votre Drive.',
    backupError: 'Échec de la génération de la sauvegarde.',
    download: 'Télécharger la sauvegarde complète (.JSON)',
    copy: 'Copier',
    copied: 'Copié !',
  },
  en: {
    tableInventory: 'All MDB tables inventory',
    table: 'Table',
    rows: 'Rows',
    columns: 'Columns',
    system: 'Access system',
    unreadable: 'unreadable',
    center: 'Cloud & Data Center',
    localTab: 'CardLock.mdb (proUSB)',
    supabaseTab: 'Supabase Cloud',
    neonTab: 'Neon Postgres Cloud',
    explorerTab: 'Local Data (IndexedDB)',
    backupTab: 'Backups & Export',
    localTitle: 'Import proUSB CardLock.mdb database',
    localPath: 'Default path: C:\\Program Files (x86)\\proUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',
    localWarning: 'On Windows 10/11, prefer the VirtualStore copy if CardLock.exe updates the database (%LOCALAPPDATA%\\VirtualStore). The browser cannot read this path automatically without manual file selection.',
    chooseFile: 'Select CardLock.mdb',
    analyzing: 'Analyzing…',
    confirm: (r: number, g: number, c: number) => `CardLock: ${r} rooms, ${g} stays, ${c} cards detected.\n\nImport rooms and stays into planning?`,
    stale: 'Old file (> 90d): check the VirtualStore copy.',
    cancelled: 'Analysis complete. Import cancelled; planning data was not changed.',
    done: (b: number, r: number, g: number, c: number, w: number) => `Import complete: ${b} buildings, ${r} rooms, ${g} stays, ${c} cards.${w ? ` ${w} warning(s).` : ''}`,
    importError: 'CardLock import failed.',
    projectUrl: 'Supabase Project URL',
    publishable: 'Publishable Key (Client API Key)',
    anon: 'Anon Key (Legacy)',
    keyHint: 'Public key protected by Row Level Security (RLS). Never enter a service_role key into the browser.',
    test: 'Test Connection',
    save: 'Save & Apply',
    resetDefault: 'Reset to default project',
    invalid: 'HTTPS URL and public key are required',
    testing: 'Testing connection…',
    connected: 'Connection successful! Supabase API and workspaces table reachable.',
    testError: 'Supabase connection failed',
    saved: 'Configuration saved. Reloading client…',
    neonWarning: 'Security Architecture: Web browsers cannot safely open direct PostgreSQL TCP sockets without exposing master credentials. In Appointment PMS, PostgreSQL access is routed through the secure Node.js / Cloud SQL backend.',
    neonLabel: 'Direct connection string (format test only)',
    neonPlaceholder: 'postgresql://user:password@host/db?sslmode=require',
    neonNotice: 'The server connector manages connection pools and TLS. Strings entered here are not stored unencrypted in the browser.',
    clear: 'Clear input',
    backupTitle: 'Complete local backup archive',
    backupHint: 'Generates a full JSON snapshot of all IndexedDB collections (bookings, invoices, rooms) and CardLock data.',
    preparing: 'Generating archive…',
    downloaded: 'Backup successfully downloaded. Store it in a safe place or upload to your Drive.',
    backupError: 'Backup generation failed.',
    download: 'Download complete backup (.JSON)',
    copy: 'Copy',
    copied: 'Copied!',
  },
  ar: {
    tableInventory: 'جرد جميع جداول MDB',
    table: 'الجدول',
    rows: 'الصفوف',
    columns: 'الأعمدة',
    system: 'نظام Access',
    unreadable: 'غير قابل للقراءة',
    center: 'مركز السحابة والبيانات',
    localTab: 'CardLock.mdb (proUSB)',
    supabaseTab: 'سحابة Supabase',
    neonTab: 'سحابة Neon Postgres',
    explorerTab: 'البيانات المحلية (IndexedDB)',
    backupTab: 'النسخ الاحتياطي والتصدير',
    localTitle: 'استيراد قاعدة proUSB CardLock.mdb',
    localPath: 'المسار الافتراضي: C:\\Program Files (x86)\\proUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb',
    localWarning: 'في Windows 10/11، استخدم نسخة VirtualStore إذا كان CardLock.exe يحدّث القاعدة (%LOCALAPPDATA%\\VirtualStore). لا يستطيع المتصفح قراءة المسار تلقائياً دون تحديد الملف يدوياً.',
    chooseFile: 'اختيار ملف CardLock.mdb',
    analyzing: 'جارٍ التحليل…',
    confirm: (r: number, g: number, c: number) => `CardLock: تم اكتشاف ${r} غرفة و${g} إقامة و${c} بطاقة.\n\nهل تريد استيراد الغرف والإقامات إلى المخطط؟`,
    stale: 'الملف قديم (> 90 يوماً): تحقق من نسخة VirtualStore.',
    cancelled: 'اكتمل التحليل. تم إلغاء الاستيراد ولم تتغير بيانات التخطيط.',
    done: (b: number, r: number, g: number, c: number, w: number) => `اكتمل الاستيراد: ${b} مبنى و${r} غرفة و${g} إقامة و${c} بطاقة.${w ? ` ${w} تحذير.` : ''}`,
    importError: 'تعذر استيراد قاعدة CardLock.',
    projectUrl: 'رابط مشروع Supabase',
    publishable: 'مفتاح Publishable (المفتاح العام للعميل)',
    anon: 'مفتاح Anon (قديم)',
    keyHint: 'مفتاح عام محمي بسياسات الأمان على مستوى الصفوف (RLS). لا تدخل مفتاح service_role أبداً في المتصفح.',
    test: 'اختبار الاتصال',
    save: 'حفظ وتطبيق',
    resetDefault: 'استعادة المشروع الافتراضي',
    invalid: 'يلزم رابط HTTPS ومفتاح عام صالح',
    testing: 'جارٍ اختبار الاتصال…',
    connected: 'تم الاتصال بنجاح! واجهة Supabase وجدول workspaces متاحان.',
    testError: 'فشل الاتصال بـ Supabase',
    saved: 'تم حفظ الإعدادات. جارٍ تحديث الاتصال…',
    neonWarning: 'هندسة الأمان: لا يمكن لمتصفحات الويب فتح اتصالات PostgreSQL مباشرة بأمان دون كشف بيانات الاعتماد. في Appointment PMS، تتم الاتصالات عبر خادم Node.js / Cloud SQL الآمن.',
    neonLabel: 'سلسلة الاتصال المباشر (لاختبار التنسيق فقط)',
    neonPlaceholder: 'postgresql://user:password@host/db?sslmode=require',
    neonNotice: 'يدير موصل الخادم أحواض الاتصال وتشفير TLS. لا يتم حفظ السلاسل المدخلة هنا مكشوفة في المتصفح.',
    clear: 'مسح الإدخال',
    backupTitle: 'أرشيف النسخ الاحتياطي المحلي الكامل',
    backupHint: 'ينشئ لقطة JSON شاملة لجميع مخازن IndexedDB (الحجوزات، الفواتير، الغرف) وبيانات CardLock.',
    preparing: 'جارٍ إنشاء الأرشيف…',
    downloaded: 'تم تنزيل النسخة الاحتياطية بنجاح. احتفظ بالملف في مكان آمن أو ارفعه إلى السحابة.',
    backupError: 'فشل إنشاء النسخة الاحتياطية.',
    download: 'تنزيل النسخة الاحتياطية الكاملة (.JSON)',
    copy: 'نسخ',
    copied: 'تم النسخ!',
  },
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

  // Default to 'supabase' tab so cloud configuration is immediately visible and prominent
  const [activePanel, setActivePanel] = useState<'supabase' | 'neon' | 'local' | 'explorer' | 'backup'>('supabase');

  const [mdbBusy, setMdbBusy] = useState(false);
  const [mdbMessage, setMdbMessage] = useState<string | null>(null);
  const [mdbTables, setMdbTables] = useState<MdbTableSummary[]>([]);

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('appointment_supabase_url') || DEFAULT_SUPABASE_URL);
  const [publishableKey, setPublishableKey] = useState(() => localStorage.getItem('appointment_supabase_publishable_key') || '');
  const [anonKey, setAnonKey] = useState(() => localStorage.getItem('appointment_supabase_anon_key') || '');
  const [supabaseState, setSupabaseState] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: 'Configuration locale prête à être testée',
  });
  const [showPublishableKey, setShowPublishableKey] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Neon states
  const [neonConnectionString, setNeonConnectionString] = useState('');
  const [showNeonString, setShowNeonString] = useState(false);

  // Backup states
  const [backupMessage, setBackupMessage] = useState<{ status: 'idle' | 'busy' | 'success' | 'error'; text: string } | null>(null);

  const limit = 8;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    window.setTimeout(() => setCopiedField(null), 2000);
  };

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
    if (!isOpen) {
      setNeonConnectionString('');
      setBackupMessage(null);
    }
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
        setResourceGroups((current) => [
          ...current.filter((group) => !group.id.startsWith('mdb-') && !DEMO_RESOURCE_GROUP_IDS.has(group.id)),
          ...planning.resourceGroups,
        ]);
        setBookings((current) => [
          ...current.filter((item) => item.customMetadata?.source !== 'cardlock_mdb'),
          ...planning.bookings,
        ]);
      }
      const tableSummary = (snapshot.tables ?? []).map((table) => `${table.name}: ${table.rowCount}`).join(', ');
      const buildingSummary = planning.buildingStats.map((building) => `B${building.no}=${building.rooms}`).join(' · ');
      const resultMessage = importNow
        ? mt.done(planning.buildingStats.length, snapshot.counts.rooms, planning.bookings.length, snapshot.counts.cards, snapshot.warnings.length + planning.warnings.length) + ` ${buildingSummary}. Tables: ${tableSummary}.`
        : mt.cancelled + ` Tables: ${tableSummary}.`;
      setMdbMessage(resultMessage + (sourceIsOld ? ` ${mt.stale}` : ''));
      await loadStatsAndData();
    } catch (err) {
      setMdbMessage(err instanceof Error ? err.message : mt.importError);
    } finally {
      setMdbBusy(false);
    }
  };

  const testSupabase = async () => {
    const key = publishableKey.trim() || anonKey.trim() || DEFAULT_SUPABASE_KEY;
    const url = supabaseUrl.trim() || DEFAULT_SUPABASE_URL;

    if (!/^https:\/\//i.test(url)) {
      setSupabaseState({ status: 'error', message: mt.invalid });
      return;
    }

    setSupabaseState({ status: 'testing', message: mt.testing });

    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const startTime = performance.now();
      const { error: sessionError } = await client.auth.getSession();
      const latency = Math.round(performance.now() - startTime);

      if (sessionError) throw sessionError;

      setSupabaseState({
        status: 'success',
        message: `${mt.connected} (${latency} ms)`,
      });
    } catch (err) {
      setSupabaseState({
        status: 'error',
        message: err instanceof Error ? err.message : mt.testError,
      });
    }
  };

  const saveSupabase = () => {
    const key = publishableKey.trim() || anonKey.trim();
    if (!/^https:\/\//i.test(supabaseUrl.trim()) || !key) {
      setSupabaseState({ status: 'error', message: mt.invalid });
      return;
    }
    localStorage.setItem('appointment_supabase_url', supabaseUrl.trim());
    localStorage.setItem('appointment_supabase_publishable_key', publishableKey.trim());
    localStorage.setItem('appointment_supabase_anon_key', anonKey.trim());
    setSupabaseState({ status: 'success', message: mt.saved });
    window.setTimeout(() => window.location.reload(), 700);
  };

  const resetDefaultSupabase = () => {
    setSupabaseUrl(DEFAULT_SUPABASE_URL);
    setPublishableKey(DEFAULT_SUPABASE_KEY);
    setAnonKey('');
    localStorage.removeItem('appointment_supabase_url');
    localStorage.removeItem('appointment_supabase_publishable_key');
    localStorage.removeItem('appointment_supabase_anon_key');
    setSupabaseState({
      status: 'idle',
      message: language === 'fr' ? 'Valeurs par défaut rétablies. Cliquez sur Enregistrer pour appliquer.' : 'Default values restored. Click Save to apply.',
    });
  };

  const exportBackup = async () => {
    setBackupMessage({ status: 'busy', text: mt.preparing });
    try {
      const stores = await indexedDb.exportSnapshot();
      const payload = {
        format: 'appointment-local-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        stores,
        cardLockSnapshot: lockManager.getMdbSnapshot(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `appointment-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupMessage({ status: 'success', text: mt.downloaded });
    } catch (err) {
      setBackupMessage({ status: 'error', text: err instanceof Error ? err.message : mt.backupError });
    }
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-2 sm:p-4 backdrop-blur-md pms-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-cloud-center-title"
        className="my-auto flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl pms-modal"
      >
        {/* Header with High-Tech Executive Styling */}
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-5 py-5 text-white border-b border-white/10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="pointer-events-none absolute left-1/3 -bottom-20 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 shadow-inner">
                <Database size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="data-cloud-center-title" className="truncate text-lg font-extrabold tracking-tight sm:text-xl text-white">
                    {t.title}
                  </h2>
                  <span className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200 flex items-center gap-1.5 shadow-2xs">
                    <Sparkles size={11} className="text-cyan-300" />
                    {mt.center}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300/90 leading-normal max-w-2xl">{t.subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'ar' ? 'إغلاق' : language === 'en' ? 'Close' : 'Fermer'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Cloud & Local Quick Status Bar */}
          <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Local-First</div>
                <div className="text-[11px] font-bold truncate text-white">{storageLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
              <Cloud size={14} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Supabase</div>
                <div className="text-[11px] font-bold truncate text-white">PostgreSQL & Auth</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
              <Server size={14} className="text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Neon Postgres</div>
                <div className="text-[11px] font-bold truncate text-white">Branching Cloud</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
              <HardDrive size={14} className="text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">proUSB MDB</div>
                <div className="text-[11px] font-bold truncate text-white">CardLock Engine</div>
              </div>
            </div>
          </div>
        </header>

        {/* Cloud Navigation Tabs */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 px-3 py-2.5 sm:px-5">
          <nav className="flex gap-2 overflow-x-auto scrollbar-thin" aria-label="Gestion des données">
            {[
              { id: 'supabase', label: mt.supabaseTab, icon: Cloud, badge: 'SaaS' },
              { id: 'neon', label: mt.neonTab, icon: Server, badge: 'SQL' },
              { id: 'local', label: mt.localTab, icon: HardDrive, badge: 'MDB' },
              { id: 'explorer', label: mt.explorerTab, icon: Database, badge: `${stats ? totalRecords : '—'}` },
              { id: 'backup', label: mt.backupTab, icon: Download, badge: 'JSON' },
            ].map(({ id, label, icon: Icon, badge }) => {
              const isSelected = activePanel === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActivePanel(id as any)}
                  className={`shrink-0 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-400/80 dark:bg-emerald-950/60 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon size={15} className={isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                  <span>{label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[10px] font-mono tabular-nums ${
                      isSelected
                        ? 'bg-emerald-200/70 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 font-extrabold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {badge}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950/40 p-4 sm:p-6">
          {/* TAB 1: SUPABASE CLOUD CONFIGURATION */}
          {activePanel === 'supabase' && (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Hero Banner */}
              <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/60 via-emerald-100/30 to-teal-50/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                      <Cloud size={24} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Supabase Cloud Platform</h3>
                        <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                          GoTrue + RLS
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                        Synchronisation hybride des séjours, gestion des accès multi-utilisateurs et persistance distante protégée par politiques de sécurité strictes.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetDefaultSupabase}
                    className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} className="text-slate-400" />
                    <span>{mt.resetDefault}</span>
                  </button>
                </div>
              </div>

              {/* Form Settings */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                {/* Project URL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Globe size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>{mt.projectUrl}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(supabaseUrl, 'supabase_url')}
                      className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'supabase_url' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === 'supabase_url' ? mt.copied : mt.copy}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xxxxx.supabase.co"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 transition-colors"
                    />
                  </div>
                </div>

                {/* Publishable API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Key size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>{mt.publishable}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPublishableKey((show) => !show)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {showPublishableKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showPublishableKey ? (language === 'fr' ? 'Masquer' : 'Hide') : (language === 'fr' ? 'Afficher' : 'Show')}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPublishableKey ? 'text' : 'password'}
                      autoComplete="off"
                      value={publishableKey}
                      onChange={(e) => setPublishableKey(e.target.value)}
                      placeholder="sb_publishable_..."
                      className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 transition-colors"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal flex items-start gap-1">
                    <ShieldCheck size={14} className="shrink-0 text-emerald-500 mt-0.5" />
                    <span>{mt.keyHint}</span>
                  </p>
                </div>

                {/* Optional Legacy Anon Key */}
                <details className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/40">
                  <summary className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <ChevronDown size={14} />
                    <span>{mt.anon} (Facultatif / Legacy)</span>
                  </summary>
                  <div className="mt-2.5">
                    <input
                      type={showAnonKey ? 'text' : 'password'}
                      autoComplete="off"
                      value={anonKey}
                      onChange={(e) => setAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </details>

                {/* Testing & Status Result Card */}
                {supabaseState.status !== 'idle' && (
                  <div
                    className={`rounded-xl border p-3.5 text-xs flex items-start gap-3 transition-colors ${
                      supabaseState.status === 'success'
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : supabaseState.status === 'testing'
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-900/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                        : 'border-rose-300 bg-rose-50 dark:border-rose-900/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {supabaseState.status === 'testing' ? (
                      <RefreshCw size={17} className="shrink-0 animate-spin text-blue-600 dark:text-blue-400 mt-0.5" />
                    ) : supabaseState.status === 'success' ? (
                      <CheckCircle2 size={17} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle size={17} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold">
                        {supabaseState.status === 'testing'
                          ? mt.testing
                          : supabaseState.status === 'success'
                          ? (language === 'fr' ? 'Connexion réussie' : 'Connection successful')
                          : (language === 'fr' ? 'Erreur de connexion' : 'Connection error')}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed break-words">{supabaseState.message}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void testSupabase()}
                    disabled={supabaseState.status === 'testing'}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/50 px-4 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Activity size={15} className={supabaseState.status === 'testing' ? 'animate-spin' : ''} />
                    <span>{mt.test}</span>
                  </button>

                  <button
                    type="button"
                    onClick={saveSupabase}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 text-xs font-bold shadow-md shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
                  >
                    <Check size={15} />
                    <span>{mt.save}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NEON CLOUD POSTGRESQL */}
          {activePanel === 'neon' && (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Hero Banner */}
              <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-50/60 via-sky-100/30 to-blue-50/40 dark:from-cyan-950/30 dark:via-slate-900 dark:to-blue-950/20 p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/30">
                    <Server size={24} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Neon Serverless PostgreSQL</h3>
                      <span className="rounded-md bg-cyan-100 dark:bg-cyan-900/70 text-cyan-800 dark:text-cyan-200 px-2 py-0.5 text-[10px] font-bold">
                        Scale-to-Zero & Cloud SQL
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                      Moteur relationnel PostgreSQL avec branches instantanées pour environnements de test, prévisualisation et production haute disponibilité.
                    </p>
                  </div>
                </div>
              </div>

              {/* Architecture & Security Guidance */}
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                  <span>Architecture & Sécurité des données SQL</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{mt.neonWarning}</p>
              </div>

              {/* Connection Format Tester */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {mt.neonLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNeonString((show) => !show)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {showNeonString ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showNeonString ? (language === 'fr' ? 'Masquer' : 'Hide') : (language === 'fr' ? 'Afficher' : 'Show')}</span>
                    </button>
                  </div>
                  <input
                    type={showNeonString ? 'text' : 'password'}
                    autoComplete="off"
                    value={neonConnectionString}
                    onChange={(e) => setNeonConnectionString(e.target.value)}
                    placeholder={mt.neonPlaceholder}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 font-mono text-xs text-slate-800 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 transition-colors"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{mt.neonNotice}</p>
                </div>

                {neonConnectionString && (
                  <button
                    type="button"
                    onClick={() => setNeonConnectionString('')}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>{mt.clear}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PROUSB CARDLOCK.MDB ENGINE */}
          {activePanel === 'local' && (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Hero Banner */}
              <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-50/60 via-amber-100/30 to-orange-50/40 dark:from-amber-950/30 dark:via-slate-900 dark:to-orange-950/20 p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/30">
                    <HardDrive size={24} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{mt.localTitle}</h3>
                      <span className="rounded-md bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold">
                        proUSB Hotel Lock System
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                      Importez directement les bâtiments, chambres, réservations et cartes RFID configurées dans votre logiciel de serrures physiques.
                    </p>
                  </div>
                </div>
              </div>

              {/* Path and Instructions Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{mt.localPath}</div>
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">{mt.localWarning}</p>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <label className="flex h-11 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-5 text-xs font-bold shadow-md shadow-amber-600/25 transition-all active:scale-95">
                    <Upload size={16} />
                    <span>{mdbBusy ? mt.analyzing : mt.chooseFile}</span>
                    <input
                      className="hidden"
                      type="file"
                      accept=".mdb,application/x-msaccess"
                      disabled={mdbBusy}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleMdbImport(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>

                {mdbMessage && (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {mdbMessage}
                  </div>
                )}
              </div>

              {/* MDB Table Inventory Breakdown */}
              {mdbTables.length > 0 && (
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
                    <span>{mt.tableInventory}</span>
                    <span className="font-mono text-[10px] text-slate-400 font-normal">({mdbTables.length} tables)</span>
                  </h4>
                  <div className="max-h-72 overflow-auto scrollbar-thin rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">{mt.table}</th>
                          <th className="py-2.5 px-3">{mt.rows}</th>
                          <th className="py-2.5 px-3">{mt.columns}</th>
                          <th className="py-2.5 px-3">{mt.system}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {mdbTables.map((table) => (
                          <tr key={table.name} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{table.name}</td>
                            <td className="py-2 px-3 tabular-nums font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              {table.readable ? table.rowCount.toLocaleString() : mt.unreadable}
                            </td>
                            <td className="py-2 px-3 break-words text-slate-500 max-w-xs">{table.columns.join(', ') || '—'}</td>
                            <td className="py-2 px-3 text-slate-400">{table.system ? '✓' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INDEXEDDB EXPLORER (LOCAL DATA INSPECTOR) */}
          {activePanel === 'explorer' && (
            <div className="space-y-4">
              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300">
                    <HardDrive size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t.local}</p>
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white mt-0.5">{storageLabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
                    <FileJson size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t.schema}</p>
                    <p className="text-xs font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">{stats ? `v${stats.version}` : '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                    <Layers3 size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t.records}</p>
                    <p className="text-xs font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">{stats ? totalRecords.toLocaleString() : '—'}</p>
                  </div>
                </div>
              </div>

              {/* Collections & JSON Grid */}
              <div className="flex flex-col lg:flex-row rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                {/* Store Tabs */}
                <nav className="flex shrink-0 gap-1.5 overflow-x-auto p-3 border-b border-slate-200 dark:border-slate-800 lg:w-56 lg:flex-col lg:border-b-0 lg:border-e lg:p-4 bg-slate-50/50 dark:bg-slate-950/50">
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
                        className={`flex min-w-[130px] flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-all cursor-pointer lg:min-w-0 lg:flex-none ${
                          selected
                            ? 'border-cyan-500/50 bg-cyan-50 text-cyan-900 dark:border-cyan-400/40 dark:bg-cyan-950/50 dark:text-cyan-200 shadow-2xs font-bold'
                            : 'border-transparent text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon size={16} className={selected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{meta.label[language] || meta.label.fr}</span>
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono tabular-nums ${
                            selected
                              ? 'bg-cyan-200/60 dark:bg-cyan-900/60 text-cyan-900 dark:text-cyan-200 font-bold'
                              : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {stats?.storeCounts[storeName] ?? '—'}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                {/* Records Listing */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {/* Search and Refresh bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-3 sm:px-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t.search}
                        className="h-9 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 ps-9 pe-3 text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadStatsAndData()}
                      disabled={loading}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      <span>{loading ? t.refreshing : t.refresh}</span>
                    </button>
                  </div>

                  {/* Records View */}
                  <div className="p-3 sm:p-4 max-h-96 overflow-y-auto scrollbar-thin space-y-2">
                    {loading && (
                      <div className="py-12 flex justify-center items-center gap-2 text-xs text-slate-500">
                        <RefreshCw size={16} className="animate-spin text-cyan-500" />
                        <span>{t.loading}</span>
                      </div>
                    )}
                    {!loading && filteredData.length === 0 && (
                      <div className="py-12 text-center text-xs text-slate-500">
                        <Database size={24} className="mx-auto mb-2 text-slate-400 opacity-60" />
                        <span>{search ? t.noMatch : t.empty}</span>
                      </div>
                    )}
                    {!loading &&
                      filteredData.map((item, index) => {
                        const recordId = item?.id == null ? `${activeStore}-${offset + index}` : String(item.id);
                        return (
                          <details
                            key={recordId}
                            className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 open:ring-1 open:ring-cyan-500/30"
                          >
                            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                                <FileJson size={14} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block text-[10px] font-semibold uppercase text-slate-400">
                                  {t.record} {offset + index + 1}
                                </span>
                                <span className="block truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {item?.id == null ? t.noId : item.id}
                                </span>
                              </div>
                              <ChevronDown size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-900/60">
                              <div className="flex justify-end mb-1">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(JSON.stringify(item, null, 2), recordId)}
                                  className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedField === recordId ? <Check size={11} /> : <Copy size={11} />}
                                  <span>{copiedField === recordId ? mt.copied : mt.copy} JSON</span>
                                </button>
                              </div>
                              <pre className="max-h-56 overflow-auto scrollbar-thin rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 font-mono text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-all">
                                {JSON.stringify(item, null, 2)}
                              </pre>
                            </div>
                          </details>
                        );
                      })}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-3 px-4 bg-slate-50/60 dark:bg-slate-950/60 text-xs">
                    <button
                      type="button"
                      disabled={offset <= 0 || loading}
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                      <span>{t.previous}</span>
                    </button>
                    <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                      {t.page} {currentPage} {t.of} {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={offset + limit >= totalCount || loading}
                      onClick={() => setOffset(offset + limit)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <span>{t.next}</span>
                      {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BACKUP & JSON EXPORT */}
          {activePanel === 'backup' && (
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-50/60 via-purple-100/30 to-indigo-50/40 dark:from-violet-950/30 dark:via-slate-900 dark:to-indigo-950/20 p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
                    <Download size={24} />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{mt.backupTitle}</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                      {mt.backupHint}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {language === 'fr' ? 'Exportation complète autonome' : 'Complete offline export'}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {language === 'fr'
                        ? 'Génère un fichier JSON portable incluant vos réservations, factures, chambres et instantané CardLock.'
                        : 'Generates a portable JSON file containing your bookings, invoices, rooms, and CardLock snapshot.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void exportBackup()}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-5 text-xs font-bold shadow-md shadow-violet-600/25 transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    <Download size={16} />
                    <span>{mt.download}</span>
                  </button>
                </div>

                {backupMessage && (
                  <div
                    className={`rounded-xl border p-3.5 text-xs flex items-center gap-2.5 ${
                      backupMessage.status === 'success'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : backupMessage.status === 'busy'
                        ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900/80 dark:bg-blue-950/40 dark:text-blue-200'
                        : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-200'
                    }`}
                  >
                    {backupMessage.status === 'busy' ? (
                      <RefreshCw size={15} className="animate-spin text-blue-600 shrink-0" />
                    ) : backupMessage.status === 'success' ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    )}
                    <span>{backupMessage.text}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 items-start gap-2.5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 px-5 py-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <LockKeyhole size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p>{t.footer}</p>
        </footer>
      </section>
    </div>
  );
};
