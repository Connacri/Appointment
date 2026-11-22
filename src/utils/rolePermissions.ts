import { BUILT_IN_ROLES, ALL_APP_TAB_IDS } from '../data/roles';
import type {
  AppTabId,
  RoleCategory,
  RoleDefinition,
  RoleIconName,
  RolePermissions,
  StoredRolesPayload,
  UserRole,
} from '../types/roles';

export const ROLES_STORAGE_KEY = 'omnibook_roles_config_v1';

const VALID_TABS_SET = new Set<string>(ALL_APP_TAB_IDS);

export function normalizeLegacyRoleId(roleId: string | null | undefined): UserRole {
  if (!roleId) return 'manager';
  if (roleId === 'staff') return 'room_attendant';
  return roleId;
}

export function sanitizeAllowedTabs(tabs: unknown): AppTabId[] {
  if (!Array.isArray(tabs)) return ['tasks'];
  const unique: AppTabId[] = [];
  for (const tab of tabs) {
    if (typeof tab === 'string' && VALID_TABS_SET.has(tab) && !unique.includes(tab as AppTabId)) {
      unique.push(tab as AppTabId);
    }
  }
  return unique.length > 0 ? unique : ['tasks'];
}

export function mergeRolesWithStoredConfig(stored?: Partial<StoredRolesPayload> | null): RoleDefinition[] {
  const overrides = stored?.builtInOverrides || {};
  const builtIns: RoleDefinition[] = BUILT_IN_ROLES.map((base) => {
    const patch = overrides[base.id];
    if (!patch) {
      return {
        ...base,
        label: { ...base.label },
        description: { ...base.description },
        allowedTabs: [...base.allowedTabs],
        permissions: { ...base.permissions },
      };
    }
    const mergedPermissions: RolePermissions = {
      ...base.permissions,
      ...(patch.permissions || {}),
    };
    const mergedTabs = patch.allowedTabs
      ? sanitizeAllowedTabs(patch.allowedTabs)
      : [...base.allowedTabs];
    // Ensure management roles always keep access to 'roles' if canManageRoles is true
    if (mergedPermissions.canManageRoles && !mergedTabs.includes('roles')) {
      mergedTabs.push('roles');
    }
    return {
      ...base,
      label: patch.label ? { ...base.label, ...patch.label } : { ...base.label },
      description: patch.description ? { ...base.description, ...patch.description } : { ...base.description },
      category: patch.category || base.category,
      iconName: patch.iconName || base.iconName,
      allowedTabs: mergedTabs,
      permissions: mergedPermissions,
    };
  });

  const customRoles: RoleDefinition[] = Array.isArray(stored?.customRoles)
    ? stored!.customRoles
        .filter((r) => r && typeof r.id === 'string' && r.id.trim().length > 0 && !BUILT_IN_ROLES.some((b) => b.id === r.id))
        .map((r) => {
          const allowedTabs = sanitizeAllowedTabs(r.allowedTabs);
          const permissions: RolePermissions = {
            canManageBookings: Boolean(r.permissions?.canManageBookings),
            canManageHousekeeping: Boolean(r.permissions?.canManageHousekeeping),
            canManageTasks: Boolean(r.permissions?.canManageTasks),
            canManageStock: Boolean(r.permissions?.canManageStock),
            canManageLostProperty: Boolean(r.permissions?.canManageLostProperty),
            canIssueKeyCards: Boolean(r.permissions?.canIssueKeyCards),
            canManageRoles: Boolean(r.permissions?.canManageRoles),
            isClientPortal: Boolean(r.permissions?.isClientPortal),
          };
          if (permissions.canManageRoles && !allowedTabs.includes('roles')) {
            allowedTabs.push('roles');
          }
          return {
            id: r.id,
            label: {
              fr: r.label?.fr || r.label?.en || r.id,
              en: r.label?.en || r.label?.fr || r.id,
              ar: r.label?.ar || r.label?.fr || r.label?.en || r.id,
            },
            description: {
              fr: r.description?.fr || '',
              en: r.description?.en || r.description?.fr || '',
              ar: r.description?.ar || r.description?.fr || '',
            },
            category: (r.category || 'guest_services') as RoleCategory,
            iconName: (r.iconName || 'UserCog') as RoleIconName,
            isBuiltIn: false,
            allowedTabs,
            permissions,
          };
        })
    : [];

  return [...builtIns, ...customRoles];
}

export function loadStoredRolesPayload(): StoredRolesPayload {
  if (typeof localStorage === 'undefined') {
    return { customRoles: [], builtInOverrides: {} };
  }
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return { customRoles: [], builtInOverrides: {} };
    const parsed = JSON.parse(raw) as Partial<StoredRolesPayload>;
    return {
      customRoles: Array.isArray(parsed.customRoles) ? parsed.customRoles : [],
      builtInOverrides: parsed.builtInOverrides && typeof parsed.builtInOverrides === 'object' ? parsed.builtInOverrides : {},
    };
  } catch {
    return { customRoles: [], builtInOverrides: {} };
  }
}

export function saveStoredRolesPayload(payload: StoredRolesPayload): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[roles] Failed to persist roles config:', error);
  }
}

export function resolveRoleDefinition(roles: RoleDefinition[], roleId: UserRole): RoleDefinition {
  const normalized = normalizeLegacyRoleId(roleId);
  return roles.find((r) => r.id === normalized) || roles.find((r) => r.id === 'manager') || BUILT_IN_ROLES[1];
}

export function isTabAllowedForRole(role: RoleDefinition, view: string): boolean {
  // 'help' (Appointment Academy) is an informational footer view available to all roles
  if (view === 'help') return true;
  if (role.id === 'admin') {
    return role.allowedTabs.includes(view as AppTabId) || VALID_TABS_SET.has(view);
  }
  return role.allowedTabs.includes(view as AppTabId);
}

export function resolveFallbackTabForRole(role: RoleDefinition, currentView: string): AppTabId {
  if (isTabAllowedForRole(role, currentView) && VALID_TABS_SET.has(currentView)) {
    return currentView as AppTabId;
  }
  return role.allowedTabs[0] || 'planning';
}

export function resolveGuestAlertSourceForRole(role: RoleDefinition): 'housekeeping' | 'reception' | 'management' {
  if (role.category === 'management') return 'management';
  if (role.category === 'housekeeping' || role.category === 'maintenance') return 'housekeeping';
  return 'reception';
}

export function slugifyCustomRoleId(name: string, existingIds: string[]): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom_role';
  const candidate = `custom_${base}`;
  if (!existingIds.includes(candidate)) return candidate;
  let idx = 2;
  while (existingIds.includes(`${candidate}_${idx}`)) {
    idx += 1;
  }
  return `${candidate}_${idx}`;
}

export interface RoleUiCapabilities {
  canViewPlanningOrBookings: boolean;
  canUseCurrencySwitcher: boolean;
  canUseUsbTools: boolean;
  canUseAdminSystemTools: boolean;
  isFocusedOperationalRole: boolean;
}

export function getRoleUiCapabilities(role: RoleDefinition): RoleUiCapabilities {
  const canViewPlanningOrBookings =
    role.permissions.canManageBookings ||
    role.allowedTabs.includes('planning') ||
    role.allowedTabs.includes('my_bookings');
  const canUseCurrencySwitcher =
    role.permissions.canManageBookings ||
    role.allowedTabs.includes('billing') ||
    role.allowedTabs.includes('pricing') ||
    role.allowedTabs.includes('analytics') ||
    role.allowedTabs.includes('planning');
  const canUseUsbTools =
    role.permissions.canIssueKeyCards || role.allowedTabs.includes('prousb');
  const canUseAdminSystemTools =
    role.permissions.canManageRoles || role.permissions.canManageBookings;
  const isFocusedOperationalRole =
    !role.permissions.isClientPortal &&
    !canViewPlanningOrBookings &&
    !canUseAdminSystemTools &&
    !role.allowedTabs.includes('analytics') &&
    !role.allowedTabs.includes('billing');

  return {
    canViewPlanningOrBookings,
    canUseCurrencySwitcher,
    canUseUsbTools,
    canUseAdminSystemTools,
    isFocusedOperationalRole,
  };
}

