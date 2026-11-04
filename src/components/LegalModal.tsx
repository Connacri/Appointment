import React, { useEffect, useState } from 'react';
import {
  X, ShieldCheck, Trash2, ExternalLink, AlertTriangle, CheckCircle2,
  LockKeyhole, FileText, Database, HardDrive, Cloud, ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';

type LegalSection = 'documents' | 'local-data';

export const LegalModal: React.FC = () => {
  const { isLegalModalOpen, setIsLegalModalOpen, language, purgeAllUserData } = useApp();
  const [section, setSection] = useState<LegalSection>('documents');
  const [confirmStep, setConfirmStep] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [hasPurged, setHasPurged] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => isFr ? fr : isAr ? ar : en;

  useEffect(() => {
    if (!isLegalModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPurging) {
        setIsLegalModalOpen(false);
        setConfirmStep(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLegalModalOpen, isPurging, setIsLegalModalOpen]);

  useEffect(() => {
    if (!isLegalModalOpen) {
      setSection('documents');
      setConfirmStep(false);
      setPurgeError(null);
      setHasPurged(false);
    }
  }, [isLegalModalOpen]);

  if (!isLegalModalOpen) return null;

  const close = () => {
    if (isPurging) return;
    setIsLegalModalOpen(false);
    setConfirmStep(false);
  };

  const executeLocalPurge = async () => {
    setIsPurging(true);
    setPurgeError(null);
    try {
      await purgeAllUserData();
      setHasPurged(true);
      setConfirmStep(false);
    } catch (error) {
      console.error('[LegalModal] Local data purge failed:', error);
      setPurgeError(error instanceof Error ? error.message : t('La suppression locale a échoué.', 'Local deletion failed.', 'فشل حذف البيانات المحلية.'));
    } finally {
      setIsPurging(false);
    }
  };

  const documents = [
    {
      icon: LockKeyhole,
      title: t('Politique de confidentialité', 'Privacy policy', 'سياسة الخصوصية'),
      description: t('Données collectées, finalités, conservation et droits des utilisateurs.', 'Data collected, purposes, retention and user rights.', 'البيانات المجمعة والأغراض ومدة الاحتفاظ وحقوق المستخدمين.'),
      href: `/privacy/${language}/`,
      action: t('Lire la politique', 'Read policy', 'قراءة السياسة'),
    },
    {
      icon: FileText,
      title: t('Suppression du compte', 'Account deletion', 'حذف الحساب'),
      description: t('Procédure et portail de demande de suppression du compte.', 'Account deletion procedure and request portal.', 'إجراءات وبوابة طلب حذف الحساب.'),
      href: `/delete-account/${language}/`,
      action: t('Ouvrir le portail', 'Open portal', 'فتح البوابة'),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-sm animate-in fade-in sm:p-5"
      dir={isAr ? 'rtl' : 'ltr'}
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-dialog-title"
        className="my-auto flex max-h-[min(820px,94dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_30px_100px_-24px_rgba(0,0,0,.65)] dark:border-slate-700 dark:bg-slate-950 sm:rounded-3xl"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blue-500/10 to-transparent" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[.16em] text-blue-600 dark:text-blue-400">Appointment · Trust Center</div>
                <h2 id="legal-dialog-title" className="truncate text-base font-bold text-slate-950 dark:text-white sm:text-lg">
                  {getTranslation('legalTitle', language)}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('Transparence, confidentialité et contrôle de vos données.', 'Transparency, privacy and control over your data.', 'الشفافية والخصوصية والتحكم في بياناتك.')}
                </p>
              </div>
            </div>
            <button type="button" onClick={close} disabled={isPurging} aria-label={t('Fermer', 'Close', 'إغلاق')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[190px_minmax(0,1fr)]">
          <nav aria-label={t('Sections légales', 'Legal sections', 'الأقسام القانونية')} className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex-col md:gap-1 md:border-b-0 md:border-e md:p-4">
            <button type="button" onClick={() => { setSection('documents'); setConfirmStep(false); }} className={`flex min-w-max items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-xs font-semibold transition md:w-full ${section === 'documents' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
              <FileText size={16} />{t('Documents', 'Documents', 'المستندات')}
            </button>
            <button type="button" onClick={() => { setSection('local-data'); setConfirmStep(false); }} className={`flex min-w-max items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-xs font-semibold transition md:w-full ${section === 'local-data' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
              <Database size={16} />{t('Mes données', 'My data', 'بياناتي')}
            </button>
            <div className="hidden flex-1 md:block" />
            <div className="hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30 md:block">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><LockKeyhole size={12} />{t('Contrôle utilisateur', 'User control', 'تحكم المستخدم')}</div>
              <p className="text-[10px] leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">{t('Les actions de cette fenêtre sont explicites et déclenchées par vous.', 'Actions in this window are explicit and user initiated.', 'الإجراءات في هذه النافذة صريحة ويبدأها المستخدم.')}</p>
            </div>
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {purgeError && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{purgeError}</div>}

            {section === 'documents' && (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600 dark:text-blue-400">{t('Références & droits', 'References & rights', 'المراجع والحقوق')}</div>
                  <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{t('Vos informations, en toute clarté', 'Your information, clearly explained', 'معلوماتك بوضوح')}</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('Consultez les documents officiels pour comprendre le traitement des données et exercer vos droits.', 'Read the official documents to understand data processing and exercise your rights.', 'راجع المستندات الرسمية لفهم معالجة البيانات وممارسة حقوقك.')}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {documents.map((document) => {
                    const Icon = document.icon;
                    return (
                      <a key={document.href} href={document.href} target="_blank" rel="noopener noreferrer" className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-950/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800">
                        <div className="flex items-center justify-between">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon size={18} /></span>
                          <ArrowUpRight size={16} className="text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-500" />
                        </div>
                        <div className="mt-4 text-sm font-bold text-slate-900 dark:text-white">{document.title}</div>
                        <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{document.description}</p>
                        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">{document.action}<ExternalLink size={12} /></div>
                      </a>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"><ShieldCheck size={17} /></span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{t('Contact confidentialité', 'Privacy contact', 'جهة الاتصال للخصوصية')}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('Pour toute question relative à la confidentialité et aux données personnelles :', 'For questions about privacy and personal data:', 'للاستفسارات المتعلقة بالخصوصية والبيانات الشخصية:')}</p>
                      <a href="mailto:ramzi.guedouar@gmail.com" className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">ramzi.guedouar@gmail.com</a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === 'local-data' && (
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600 dark:text-blue-400">{t('Stockage & effacement', 'Storage & deletion', 'التخزين والحذف')}</div>
                  <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{t('Gérez les données de cet appareil', 'Manage data on this device', 'إدارة بيانات هذا الجهاز')}</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('La purge intégrée agit sur les données locales de l’application. Elle ne remplace pas une demande de suppression de compte.', 'The in-app purge affects local application data. It does not replace an account deletion request.', 'تؤثر عملية المسح داخل التطبيق على البيانات المحلية فقط ولا تحل محل طلب حذف الحساب.')}</p>
                </div>

                {hasPurged ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <div className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={20} />{t('Purge locale terminée', 'Local purge completed', 'اكتمل المسح المحلي')}</div>
                    <p className="mt-2 text-xs leading-relaxed opacity-80">{t('Les données locales gérées par Appointment ont été effacées de cet appareil. Les données cloud et le compte ne sont pas supprimés par cette action.', 'Appointment-managed local data has been cleared from this device. Cloud data and the account are not deleted by this action.', 'تم مسح البيانات المحلية التي يديرها Appointment من هذا الجهاز. لا تحذف هذه العملية بيانات السحابة أو الحساب.')}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white"><HardDrive size={16} className="text-blue-500" />IndexedDB & stockage local</div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('Réservations, ressources, factures locales, préférences et données de fonctionnement stockées sur cet appareil.', 'Bookings, resources, local invoices, preferences and operational data stored on this device.', 'الحجوزات والموارد والفواتير المحلية والتفضيلات وبيانات التشغيل المخزنة على هذا الجهاز.')}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white"><Cloud size={16} className="text-violet-500" />Supabase Cloud</div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('Les données du workspace distant ne sont pas supprimées par la purge locale. Utilisez la procédure de suppression de compte.', 'Remote workspace data is not removed by the local purge. Use the account deletion procedure.', 'لا تُحذف بيانات مساحة العمل البعيدة عبر المسح المحلي. استخدم إجراء حذف الحساب.')}</p>
                        <a href={`/delete-account/${language}/`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400">{t('Voir la procédure', 'View procedure', 'عرض الإجراء')}<ArrowUpRight size={12} /></a>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-900/70">
                      <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200"><AlertTriangle size={16} />{t('Effacement des données locales', 'Clear local data', 'مسح البيانات المحلية')}</div>
                      <div className="space-y-3 bg-white p-4 dark:bg-slate-900">
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{getTranslation('deleteAccountWarning', language)}</p>
                        {!confirmStep ? (
                          <button type="button" onClick={() => setConfirmStep(true)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 sm:w-auto"><Trash2 size={15} />{t('Effacer les données locales', 'Clear local data', 'مسح البيانات المحلية')}</button>
                        ) : (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                            <p className="text-xs font-bold text-rose-900 dark:text-rose-200">{t('Confirmer la purge locale ?', 'Confirm local purge?', 'تأكيد المسح المحلي؟')}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-rose-800/80 dark:text-rose-200/70">{t('Cette opération est irréversible sur cet appareil. Elle ne supprime ni le compte ni les données distantes.', 'This operation is irreversible on this device. It does not delete the account or remote data.', 'هذه العملية نهائية على هذا الجهاز ولا تحذف الحساب أو البيانات البعيدة.')}</p>
                            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <button type="button" onClick={() => setConfirmStep(false)} disabled={isPurging} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t('Annuler', 'Cancel', 'إلغاء')}</button>
                              <button type="button" onClick={executeLocalPurge} disabled={isPurging} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60"><Trash2 size={14} />{isPurging ? t('Suppression…', 'Deleting…', 'جارٍ الحذف…') : t('Confirmer l’effacement local', 'Confirm local deletion', 'تأكيد الحذف المحلي')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </main>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="min-w-0 text-[10px] text-slate-400">{t('Appointment · Centre de confidentialité', 'Appointment · Privacy center', 'Appointment · مركز الخصوصية')}</div>
          <button type="button" onClick={close} disabled={isPurging} className="h-9 shrink-0 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{t('Fermer', 'Close', 'إغلاق')}</button>
        </footer>
      </section>
    </div>
  );
};
