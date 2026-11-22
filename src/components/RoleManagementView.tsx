import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eye,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../i18n/translations';
import {
  APP_TAB_META,
  AVAILABLE_ROLE_ICONS,
  DEFAULT_CUSTOM_ROLE_PERMISSIONS,
  PERMISSION_OPTION_META,
  ROLE_CATEGORY_META,
} from '../data/roles';
import type {
  AppTabId,
  RoleCategory,
  RoleDefinition,
  RoleIconName,
  RolePermissions,
} from '../types/roles';
import { RoleIcon } from './RoleIcon';

interface RoleFormState {
  editingRoleId: string | null;
  isBuiltIn: boolean;
  nameFr: string;
  nameEn: string;
  nameAr: string;
  descFr: string;
  descEn: string;
  descAr: string;
  category: RoleCategory;
  iconName: RoleIconName;
  allowedTabs: AppTabId[];
  permissions: RolePermissions;
}

const PRESET_TEMPLATES: Array<{
  id: string;
  label: { fr: string; en: string; ar: string };
  category: RoleCategory;
  iconName: RoleIconName;
  allowedTabs: AppTabId[];
  permissions: RolePermissions;
}> = [
  {
    id: 'preset_housekeeping',
    label: { fr: 'Modèle Étage / Chambre', en: 'Housekeeping Template', ar: 'نموذج خدمة الغرف' },
    category: 'housekeeping',
    iconName: 'Bed',
    allowedTabs: ['housekeeping', 'tasks', 'lost_property', 'stock'],
    permissions: {
      canManageBookings: false,
      canManageHousekeeping: true,
      canManageTasks: true,
      canManageStock: true,
      canManageLostProperty: true,
      canIssueKeyCards: false,
      canManageRoles: false,
      isClientPortal: false,
    },
  },
  {
    id: 'preset_maintenance',
    label: { fr: 'Modèle Technique / Artisan', en: 'Maintenance / Trade', ar: 'نموذج الصيانة والحرف' },
    category: 'maintenance',
    iconName: 'Wrench',
    allowedTabs: ['tasks', 'housekeeping', 'stock', 'events'],
    permissions: {
      canManageBookings: false,
      canManageHousekeeping: true,
      canManageTasks: true,
      canManageStock: true,
      canManageLostProperty: false,
      canIssueKeyCards: false,
      canManageRoles: false,
      isClientPortal: false,
    },
  },
  {
    id: 'preset_guest_service',
    label: { fr: 'Modèle Service Client / F&B', en: 'Guest Service / F&B', ar: 'نموذج خدمة النزلاء' },
    category: 'guest_services',
    iconName: 'UtensilsCrossed',
    allowedTabs: ['tasks', 'my_bookings', 'stock', 'lost_property'],
    permissions: {
      canManageBookings: false,
      canManageHousekeeping: false,
      canManageTasks: true,
      canManageStock: true,
      canManageLostProperty: true,
      canIssueKeyCards: false,
      canManageRoles: false,
      isClientPortal: false,
    },
  },
  {
    id: 'preset_front_office',
    label: { fr: 'Modèle Accueil / Réception', en: 'Front Office Template', ar: 'نموذج الاستقبال' },
    category: 'front_office',
    iconName: 'Briefcase',
    allowedTabs: ['planning', 'my_bookings', 'billing', 'lost_property', 'tasks', 'prousb', 'spa'],
    permissions: {
      canManageBookings: true,
      canManageHousekeeping: false,
      canManageTasks: true,
      canManageStock: false,
      canManageLostProperty: true,
      canIssueKeyCards: true,
      canManageRoles: false,
      isClientPortal: false,
    },
  },
  {
    id: 'preset_supervisor',
    label: { fr: 'Modèle Responsable', en: 'Supervisor Template', ar: 'نموذج مسؤول القسم' },
    category: 'management',
    iconName: 'UserCog',
    allowedTabs: ['planning', 'housekeeping', 'tasks', 'stock', 'lost_property', 'my_bookings', 'reports', 'events', 'roles'],
    permissions: {
      canManageBookings: true,
      canManageHousekeeping: true,
      canManageTasks: true,
      canManageStock: true,
      canManageLostProperty: true,
      canIssueKeyCards: true,
      canManageRoles: true,
      isClientPortal: false,
    },
  },
];

function createEmptyFormState(): RoleFormState {
  return {
    editingRoleId: null,
    isBuiltIn: false,
    nameFr: '',
    nameEn: '',
    nameAr: '',
    descFr: '',
    descEn: '',
    descAr: '',
    category: 'guest_services',
    iconName: 'UserCog',
    allowedTabs: ['tasks', 'housekeeping'],
    permissions: { ...DEFAULT_CUSTOM_ROLE_PERMISSIONS },
  };
}

function formStateFromRole(role: RoleDefinition): RoleFormState {
  return {
    editingRoleId: role.id,
    isBuiltIn: role.isBuiltIn,
    nameFr: role.label.fr,
    nameEn: role.label.en,
    nameAr: role.label.ar,
    descFr: role.description.fr,
    descEn: role.description.en,
    descAr: role.description.ar,
    category: role.category,
    iconName: role.iconName,
    allowedTabs: [...role.allowedTabs],
    permissions: { ...role.permissions },
  };
}

export const RoleManagementView: React.FC = () => {
  const {
    language,
    roles,
    currentRole,
    setCurrentRole,
    createCustomRole,
    updateRoleConfig,
    deleteCustomRole,
    resetBuiltInRoles,
    hasCustomizedBuiltInRoles,
    activeRoleDefinition,
    playFeedback,
  } = useApp();

  const isRtl = language === 'ar';
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RoleCategory | 'all'>('all');
  const [formState, setFormState] = useState<RoleFormState>(createEmptyFormState);
  const [showMultilingual, setShowMultilingual] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const tabLabelMap = useMemo(() => {
    const map = new Map<AppTabId, string>();
    APP_TAB_META.forEach((item) => {
      map.set(item.id, item.label[language] || item.label.fr);
    });
    return map;
  }, [language]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter((role) => {
      if (categoryFilter !== 'all' && role.category !== categoryFilter) return false;
      if (!q) return true;
      const haystack = `${role.label.fr} ${role.label.en} ${role.label.ar} ${role.description.fr} ${role.description.en} ${role.id}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [roles, categoryFilter, search]);

  const customRolesCount = roles.filter((r) => !r.isBuiltIn).length;
  const builtInRolesCount = roles.filter((r) => r.isBuiltIn).length;

  const showToast = (message: string) => {
    setNotice(message);
    setErrorText(null);
    setTimeout(() => {
      setNotice((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const handleStartCreate = () => {
    playFeedback('click');
    setFormState(createEmptyFormState());
    setErrorText(null);
  };

  const handleSelectEdit = (role: RoleDefinition) => {
    playFeedback('click');
    setFormState(formStateFromRole(role));
    setErrorText(null);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;
    playFeedback('click');
    setFormState((prev) => ({
      ...prev,
      category: preset.category,
      iconName: preset.iconName,
      allowedTabs: [...preset.allowedTabs],
      permissions: { ...preset.permissions },
    }));
  };

  const toggleTab = (tabId: AppTabId) => {
    setFormState((prev) => {
      const exists = prev.allowedTabs.includes(tabId);
      const nextTabs = exists
        ? prev.allowedTabs.filter((id) => id !== tabId)
        : [...prev.allowedTabs, tabId];
      // Prevent locking out all tabs
      if (nextTabs.length === 0) return prev;
      const nextPermissions = { ...prev.permissions };
      if (tabId === 'roles' && !exists) {
        nextPermissions.canManageRoles = true;
      } else if (tabId === 'roles' && exists) {
        nextPermissions.canManageRoles = false;
      }
      return {
        ...prev,
        allowedTabs: nextTabs,
        permissions: nextPermissions,
      };
    });
  };

  const togglePermission = (key: keyof RolePermissions) => {
    setFormState((prev) => {
      const nextVal = !prev.permissions[key];
      const nextPermissions = { ...prev.permissions, [key]: nextVal };
      let nextTabs = [...prev.allowedTabs];

      if (key === 'canManageRoles') {
        if (nextVal && !nextTabs.includes('roles')) nextTabs.push('roles');
        if (!nextVal && nextTabs.length > 1) nextTabs = nextTabs.filter((t) => t !== 'roles');
      }
      if (key === 'canManageHousekeeping' && nextVal && !nextTabs.includes('housekeeping')) {
        nextTabs.push('housekeeping');
      }
      if (key === 'canManageTasks' && nextVal && !nextTabs.includes('tasks')) {
        nextTabs.push('tasks');
      }
      if (key === 'canManageStock' && nextVal && !nextTabs.includes('stock')) {
        nextTabs.push('stock');
      }
      if (key === 'canManageLostProperty' && nextVal && !nextTabs.includes('lost_property')) {
        nextTabs.push('lost_property');
      }
      if (key === 'canIssueKeyCards' && nextVal && !nextTabs.includes('prousb')) {
        nextTabs.push('prousb');
      }

      return {
        ...prev,
        allowedTabs: nextTabs,
        permissions: nextPermissions,
      };
    });
  };

  const handleSaveRole = (e: React.FormEvent, activateAfterSave = false) => {
    e.preventDefault();
    const primaryName =
      (language === 'en' ? formState.nameEn : language === 'ar' ? formState.nameAr : formState.nameFr).trim() ||
      formState.nameFr.trim() ||
      formState.nameEn.trim() ||
      formState.nameAr.trim();

    if (!primaryName) {
      setErrorText(
        language === 'fr'
          ? 'Veuillez saisir un nom pour ce rôle.'
          : language === 'ar'
          ? 'يرجى إدخال اسم لهذا الدور.'
          : 'Please enter a name for this role.'
      );
      return;
    }

    if (formState.allowedTabs.length === 0) {
      setErrorText(
        language === 'fr'
          ? 'Sélectionnez au moins un onglet visible pour ce rôle.'
          : language === 'ar'
          ? 'اختر تبويباً واحداً على الأقل لهذا الدور.'
          : 'Select at least one visible tab for this role.'
      );
      return;
    }

    const labelPayload = {
      fr: formState.nameFr.trim() || primaryName,
      en: formState.nameEn.trim() || primaryName,
      ar: formState.nameAr.trim() || primaryName,
    };

    const primaryDesc =
      (language === 'en' ? formState.descEn : language === 'ar' ? formState.descAr : formState.descFr).trim() ||
      formState.descFr.trim() ||
      formState.descEn.trim() ||
      formState.descAr.trim();

    const descPayload = {
      fr: formState.descFr.trim() || primaryDesc,
      en: formState.descEn.trim() || primaryDesc,
      ar: formState.descAr.trim() || primaryDesc,
    };

    if (formState.editingRoleId) {
      updateRoleConfig(formState.editingRoleId, {
        label: labelPayload,
        description: descPayload,
        category: formState.category,
        iconName: formState.iconName,
        allowedTabs: formState.allowedTabs,
        permissions: formState.permissions,
      });
      playFeedback('success');
      showToast(
        language === 'fr'
          ? `Rôle « ${labelPayload[language] || labelPayload.fr} » mis à jour.`
          : language === 'ar'
          ? `تم تحديث الدور « ${labelPayload.ar} ».`
          : `Role "${labelPayload.en}" updated.`
      );
      if (activateAfterSave) {
        setCurrentRole(formState.editingRoleId);
      }
    } else {
      const created = createCustomRole({
        name: primaryName,
        label: labelPayload,
        description: descPayload,
        category: formState.category,
        iconName: formState.iconName,
        allowedTabs: formState.allowedTabs,
        permissions: formState.permissions,
      });
      playFeedback('success');
      showToast(
        language === 'fr'
          ? `Rôle « ${created.label[language] || created.label.fr} » créé (${created.allowedTabs.length} onglets).`
          : language === 'ar'
          ? `تم إنشاء الدور « ${created.label.ar} ».`
          : `Role "${created.label.en}" created (${created.allowedTabs.length} tabs).`
      );
      if (activateAfterSave) {
        setCurrentRole(created.id);
      } else {
        setFormState(formStateFromRole(created));
      }
    }
  };

  const tabGroups: Array<{
    id: 'operations' | 'management' | 'system';
    title: { fr: string; en: string; ar: string };
  }> = [
    { id: 'operations', title: { fr: 'Opérations & Terrain', en: 'Operations & Floor', ar: 'العمليات الميدانية' } },
    { id: 'management', title: { fr: 'Gestion, Tarifs & Rapports', en: 'Revenue, Billing & Reports', ar: 'الإدارة والمالية والتقارير' } },
    { id: 'system', title: { fr: 'Administration & Logs', en: 'Administration & Logs', ar: 'الإدارة والسجلات' } },
  ];

  const canAccessRoleManager = activeRoleDefinition.allowedTabs.includes('roles') || activeRoleDefinition.permissions.canManageRoles;

  if (!canAccessRoleManager) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <Lock size={22} />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {language === 'fr'
            ? 'Accès réservé à la direction (Admin, Gérant, Responsable)'
            : language === 'ar'
            ? 'هذا القسم مخصص للإدارة والمسؤولين فقط'
            : 'Access restricted to management (Admin, Manager, Supervisor)'}
        </h2>
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex-1 min-w-0 min-h-0 w-full max-w-full overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 p-3 sm:p-5 lg:p-6 space-y-5"
    >
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UserCog size={19} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                {getTranslation('rolesTitle', language)}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {getTranslation('rolesSubtitle', language)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-900 dark:text-white">{builtInRolesCount}</span>
            <span className="text-slate-500 dark:text-slate-400">
              {language === 'fr' ? 'métiers' : language === 'ar' ? 'افتراضي' : 'built-in'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{customRolesCount}</span>
            <span className="text-slate-500 dark:text-slate-400">
              {language === 'fr' ? 'personnalisés' : language === 'ar' ? 'مخصص' : 'custom'}
            </span>
          </div>

          {hasCustomizedBuiltInRoles && (
            <button
              type="button"
              onClick={() => {
                resetBuiltInRoles();
                if (formState.editingRoleId && formState.isBuiltIn) {
                  setFormState(createEmptyFormState());
                }
                showToast(
                  language === 'fr'
                    ? 'Rôles intégrés réinitialisés aux valeurs par défaut.'
                    : language === 'ar'
                    ? 'تمت استعادة الإعدادات الافتراضية للأدوار.'
                    : 'Built-in roles restored to defaults.'
                );
              }}
              className="min-h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw size={14} />
              <span>{getTranslation('rolesResetDefaults', language)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStartCreate}
            className="min-h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus size={15} />
            <span>{getTranslation('rolesNewRoleBtn', language)}</span>
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 text-emerald-700 dark:text-emerald-300 hover:opacity-75 cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Split Grid: Roles Directory (left) + Role Builder Form (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-5 items-start">
        {/* LEFT: Roles Catalog */}
        <section className="space-y-3 min-w-0">
          {/* Search & Department Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-3 shadow-2xs">
            <div className="relative">
              <Search size={15} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={getTranslation('rolesSearchPlaceholder', language)}
                className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-8 rtl:pl-8 rtl:pr-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`min-h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {getTranslation('rolesAllCategories', language)} ({roles.length})
              </button>
              {(Object.keys(ROLE_CATEGORY_META) as RoleCategory[]).map((catKey) => {
                const meta = ROLE_CATEGORY_META[catKey];
                const count = roles.filter((r) => r.category === catKey).length;
                const isSelected = categoryFilter === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategoryFilter(catKey)}
                    className={`min-h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {meta.label[language] || meta.label.fr} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roles Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3">
            {filteredRoles.map((role) => {
              const catMeta = ROLE_CATEGORY_META[role.category];
              const isCurrent = currentRole === role.id;
              const isEditingThis = formState.editingRoleId === role.id;
              const isConfirmingDelete = confirmDeleteId === role.id;

              return (
                <article
                  key={role.id}
                  className={`rounded-2xl border p-3.5 bg-white dark:bg-slate-900 shadow-2xs transition-all flex flex-col justify-between gap-3 ${
                    isEditingThis
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : isCurrent
                      ? 'border-emerald-400 dark:border-emerald-600'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <RoleIcon iconName={role.iconName} size={18} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {role.label[language] || role.label.fr}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${catMeta.badgeClass}`}>
                              {catMeta.label[language] || catMeta.label.fr}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                role.isBuiltIn
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {role.isBuiltIn
                                ? getTranslation('rolesBuiltInBadge', language)
                                : getTranslation('rolesCustomBadge', language)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          <CheckCircle2 size={11} />
                          {getTranslation('rolesActiveBadge', language)}
                        </span>
                      )}
                    </div>

                    {role.description[language] && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {role.description[language] || role.description.fr}
                      </p>
                    )}

                    {/* Visible Tabs Preview */}
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Layers size={11} />
                          {role.allowedTabs.length} {getTranslation('rolesTabsCountLabel', language)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.allowedTabs.slice(0, 5).map((tabId) => (
                          <span
                            key={tabId}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                          >
                            {tabLabelMap.get(tabId) || tabId}
                          </span>
                        ))}
                        {role.allowedTabs.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            +{role.allowedTabs.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentRole(role.id);
                        playFeedback('click');
                      }}
                      disabled={isCurrent}
                      className={`min-h-9 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-default ${
                        isCurrent
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white'
                      }`}
                    >
                      <Eye size={13} />
                      <span>
                        {isCurrent
                          ? getTranslation('rolesActiveBadge', language)
                          : getTranslation('rolesActivateTest', language)}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectEdit(role)}
                        className="min-h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        {language === 'fr' ? 'Configurer' : language === 'ar' ? 'تخصيص' : 'Configure'}
                      </button>

                      {!role.isBuiltIn && (
                        isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                deleteCustomRole(role.id);
                                setConfirmDeleteId(null);
                                if (formState.editingRoleId === role.id) {
                                  setFormState(createEmptyFormState());
                                }
                                showToast(
                                  language === 'fr'
                                    ? `Rôle « ${role.label.fr} » supprimé.`
                                    : language === 'ar'
                                    ? `تم حذف الدور.`
                                    : `Role "${role.label.en}" deleted.`
                                );
                              }}
                              className="min-h-9 px-2.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer hover:bg-rose-500"
                            >
                              {language === 'fr' ? 'Confirmer' : language === 'ar' ? 'تأكيد' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(role.id)}
                            className="min-h-9 w-9 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center cursor-pointer transition-colors"
                            title={language === 'fr' ? 'Supprimer ce rôle' : language === 'ar' ? 'حذف هذا الدور' : 'Delete role'}
                            aria-label={language === 'fr' ? 'Supprimer ce rôle' : 'Delete role'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Role Builder / Editor Form */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <RoleIcon iconName={formState.iconName} size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {formState.editingRoleId
                    ? getTranslation('rolesEditRoleTitle', language)
                    : getTranslation('rolesCreateRoleTitle', language)}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {formState.allowedTabs.length} {getTranslation('rolesTabsCountLabel', language)}
                </p>
              </div>
            </div>
            {formState.editingRoleId && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="min-h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {language === 'fr' ? '+ Nouveau' : language === 'ar' ? '+ جديد' : '+ New'}
              </button>
            )}
          </div>

          {errorText && (
            <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-800 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {errorText}
            </div>
          )}

          {/* Quick Role Templates */}
          {!formState.editingRoleId && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500" />
                {language === 'fr' ? 'Modèles pré-configurés' : language === 'ar' ? 'قوالب جاهزة' : 'Quick templates'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className="min-h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                  >
                    {preset.label[language] || preset.label.fr}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={(e) => handleSaveRole(e, false)} className="space-y-4">
            {/* Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {language === 'fr' ? 'Nom du rôle *' : language === 'ar' ? 'اسم الدور *' : 'Role name *'}
                </span>
                <input
                  type="text"
                  required
                  value={language === 'en' ? formState.nameEn : language === 'ar' ? formState.nameAr : formState.nameFr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormState((prev) => ({
                      ...prev,
                      ...(language === 'en'
                        ? { nameEn: val }
                        : language === 'ar'
                        ? { nameAr: val }
                        : { nameFr: val }),
                    }));
                  }}
                  placeholder={
                    language === 'fr'
                      ? 'Ex: Pisciniste, Bagagiste, Chef de rang...'
                      : language === 'ar'
                      ? 'مثال: مسؤول المسبح، طاهي، موظف استقبال...'
                      : 'e.g. Pool Technician, Bellboy, Maitre D...'
                  }
                  className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {language === 'fr' ? 'Pôle / Service' : language === 'ar' ? 'القسم' : 'Department'}
                </span>
                <select
                  value={formState.category}
                  onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value as RoleCategory }))}
                  className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(ROLE_CATEGORY_META) as RoleCategory[]).map((catKey) => (
                    <option key={catKey} value={catKey}>
                      {ROLE_CATEGORY_META[catKey].label[language] || ROLE_CATEGORY_META[catKey].label.fr}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Optional Multilingual Labels Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowMultilingual((v) => !v)}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showMultilingual
                  ? (language === 'fr' ? 'Masquer les traductions FR / EN / AR' : language === 'ar' ? 'إخفاء الترجمات' : 'Hide FR / EN / AR translations')
                  : (language === 'fr' ? 'Personnaliser les noms FR / EN / AR (optionnel)' : language === 'ar' ? 'تخصيص الأسماء بالعربية والفرنسية والإنجليزية' : 'Customize FR / EN / AR labels (optional)')}
              </button>
              {showMultilingual && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    value={formState.nameFr}
                    onChange={(e) => setFormState((p) => ({ ...p, nameFr: e.target.value }))}
                    placeholder="Nom FR"
                    className="min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                  />
                  <input
                    type="text"
                    value={formState.nameEn}
                    onChange={(e) => setFormState((p) => ({ ...p, nameEn: e.target.value }))}
                    placeholder="Name EN"
                    className="min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                  />
                  <input
                    type="text"
                    dir="rtl"
                    value={formState.nameAr}
                    onChange={(e) => setFormState((p) => ({ ...p, nameAr: e.target.value }))}
                    placeholder="الاسم بالعربية"
                    className="min-h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {language === 'fr' ? 'Description & missions' : language === 'ar' ? 'وصف المهام' : 'Description & responsibilities'}
              </span>
              <input
                type="text"
                value={language === 'en' ? formState.descEn : language === 'ar' ? formState.descAr : formState.descFr}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormState((prev) => ({
                    ...prev,
                    ...(language === 'en'
                      ? { descEn: val }
                      : language === 'ar'
                      ? { descAr: val }
                      : { descFr: val }),
                  }));
                }}
                placeholder={
                  language === 'fr'
                    ? 'Interventions techniques, service en chambre, accueil...'
                    : language === 'ar'
                    ? 'الصيانة، خدمة الغرف، الاستقبال...'
                    : 'Maintenance, room service, front desk...'
                }
                className="w-full min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            {/* Icon Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                {language === 'fr' ? 'Icône du métier' : language === 'ar' ? 'أيقونة الدور' : 'Role icon'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_ROLE_ICONS.map((iconName) => {
                  const selected = formState.iconName === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormState((p) => ({ ...p, iconName }))}
                      aria-pressed={selected}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <RoleIcon iconName={iconName} size={16} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allowed Tabs Picker */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {language === 'fr'
                      ? 'Onglets affichés pour ce rôle'
                      : language === 'ar'
                      ? 'التبويبات الظاهرة لهذا الدور'
                      : 'Tabs visible for this role'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'fr'
                      ? 'Seuls les onglets cochés apparaîtront dans le menu latéral.'
                      : language === 'ar'
                      ? 'ستظهر التبويبات المحددة فقط في القائمة الجانبية.'
                      : 'Only checked tabs will appear in the sidebar.'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        allowedTabs: APP_TAB_META.map((t) => t.id),
                      }))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    {language === 'fr' ? 'Tous' : language === 'ar' ? 'الكل' : 'All'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        allowedTabs: ['tasks', 'housekeeping'],
                      }))
                    }
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    {language === 'fr' ? 'Minimal terrain' : language === 'ar' ? 'الأساسي' : 'Minimal'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {tabGroups.map((grp) => {
                  const groupTabs = APP_TAB_META.filter((t) => t.group === grp.id);
                  return (
                    <div key={grp.id} className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {grp.title[language] || grp.title.fr}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {groupTabs.map((tab) => {
                          const checked = formState.allowedTabs.includes(tab.id);
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              onClick={() => toggleTab(tab.id)}
                              className={`min-h-10 px-2.5 py-1.5 rounded-xl border text-left rtl:text-right flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                                checked
                                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-semibold'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  checked
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                }`}
                              >
                                {checked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="truncate">{tab.label[language] || tab.label.fr}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operational Permission Options */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                {language === 'fr' ? 'Options & Permissions d’action' : language === 'ar' ? 'خيارات وصلاحيات التنفيذ' : 'Operational Permissions'}
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {PERMISSION_OPTION_META.map((opt) => {
                  const enabled = formState.permissions[opt.key];
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => togglePermission(opt.key)}
                      className={`w-full min-h-11 px-3 py-2 rounded-xl border text-left rtl:text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        enabled
                          ? 'border-emerald-400/70 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {opt.label[language] || opt.label.fr}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {opt.hint[language] || opt.hint.fr}
                        </div>
                      </div>
                      <span
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                          enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="flex-1 min-h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Save size={15} />
                <span>
                  {formState.editingRoleId
                    ? (language === 'fr' ? 'Enregistrer les modifications' : language === 'ar' ? 'حفظ التغييرات' : 'Save changes')
                    : (language === 'fr' ? 'Créer le rôle' : language === 'ar' ? 'إنشاء الدور' : 'Create role')}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => handleSaveRole(e, true)}
                className="min-h-11 px-3.5 rounded-xl border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Eye size={14} />
                <span>
                  {language === 'fr' ? 'Enregistrer & Activer' : language === 'ar' ? 'حفظ وتفعيل' : 'Save & Activate'}
                </span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
