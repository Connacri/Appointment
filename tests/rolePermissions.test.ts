import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_ROLES } from '../src/data/roles';
import {
  isTabAllowedForRole,
  mergeRolesWithStoredConfig,
  normalizeLegacyRoleId,
  resolveFallbackTabForRole,
  resolveGuestAlertSourceForRole,
  resolveRoleDefinition,
  sanitizeAllowedTabs,
  slugifyCustomRoleId,
} from '../src/utils/rolePermissions';
import type { RoleDefinition } from '../src/types/roles';

test('built-in roles include Femme/Valet de chambre, Gouvernante/Gouvernant, Plombier, Menuisier, Responsable, and hotel trades', () => {
  const ids = new Set(BUILT_IN_ROLES.map((r) => r.id));
  for (const expected of [
    'admin',
    'manager',
    'responsable',
    'receptionist',
    'concierge',
    'night_auditor',
    'gouvernante',
    'room_attendant',
    'laundry_attendant',
    'plumber',
    'carpenter',
    'electrician',
    'hvac_tech',
    'maintenance_tech',
    'room_service',
    'spa_therapist',
    'security',
    'client',
  ]) {
    assert.ok(ids.has(expected), `Expected built-in role ${expected} to exist`);
  }

  const roomAttendant = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');
  assert.match(roomAttendant.label.fr, /Femme \/ Valet de chambre/i);

  const gouvernante = resolveRoleDefinition(BUILT_IN_ROLES, 'gouvernante');
  assert.match(gouvernante.label.fr, /Gouvernante \/ Gouvernant/i);
});

test('roles management tab is restricted to Admin, Gérant (manager), and Responsable by default', () => {
  const rolesWithTab = BUILT_IN_ROLES.filter((r) => r.allowedTabs.includes('roles')).map((r) => r.id);
  assert.deepEqual(rolesWithTab.sort(), ['admin', 'manager', 'responsable']);
});

test('operational and trade roles only display necessary tabs', () => {
  const roomAttendant = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');
  assert.deepEqual(roomAttendant.allowedTabs, ['housekeeping', 'tasks', 'lost_property', 'stock']);
  assert.equal(isTabAllowedForRole(roomAttendant, 'billing'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'pricing'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'channels'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'roles'), false);

  const plumber = resolveRoleDefinition(BUILT_IN_ROLES, 'plumber');
  assert.deepEqual(plumber.allowedTabs, ['tasks', 'housekeeping', 'stock', 'events']);
  assert.equal(isTabAllowedForRole(plumber, 'analytics'), false);
  assert.equal(isTabAllowedForRole(plumber, 'billing'), false);

  const carpenter = resolveRoleDefinition(BUILT_IN_ROLES, 'carpenter');
  assert.deepEqual(carpenter.allowedTabs, ['tasks', 'housekeeping', 'stock', 'events']);
});

test('legacy staff role id normalizes to room_attendant', () => {
  assert.equal(normalizeLegacyRoleId('staff'), 'room_attendant');
  const resolved = resolveRoleDefinition(BUILT_IN_ROLES, 'staff');
  assert.equal(resolved.id, 'room_attendant');
});

test('mergeRolesWithStoredConfig appends custom roles and applies built-in overrides safely', () => {
  const customRole: RoleDefinition = {
    id: 'custom_pisciniste',
    label: { fr: 'Pisciniste', en: 'Pool Technician', ar: 'فني المسبح' },
    description: { fr: 'Entretien bassin', en: 'Pool upkeep', ar: 'صيانة المسبح' },
    category: 'maintenance',
    iconName: 'Wrench',
    isBuiltIn: false,
    allowedTabs: ['tasks', 'stock'],
    permissions: {
      canManageBookings: false,
      canManageHousekeeping: false,
      canManageTasks: true,
      canManageStock: true,
      canManageLostProperty: false,
      canIssueKeyCards: false,
      canManageRoles: false,
      isClientPortal: false,
    },
  };

  const merged = mergeRolesWithStoredConfig({
    customRoles: [customRole],
    builtInOverrides: {
      plumber: {
        allowedTabs: ['tasks', 'stock'],
      },
    },
  });

  const plumber = resolveRoleDefinition(merged, 'plumber');
  assert.deepEqual(plumber.allowedTabs, ['tasks', 'stock']);

  const pisciniste = resolveRoleDefinition(merged, 'custom_pisciniste');
  assert.equal(pisciniste.id, 'custom_pisciniste');
  assert.equal(pisciniste.isBuiltIn, false);
  assert.deepEqual(pisciniste.allowedTabs, ['tasks', 'stock']);
});

test('resolveFallbackTabForRole redirects disallowed views to first allowed tab while keeping help accessible', () => {
  const plumber = resolveRoleDefinition(BUILT_IN_ROLES, 'plumber');
  assert.equal(resolveFallbackTabForRole(plumber, 'pricing'), 'tasks');
  assert.equal(resolveFallbackTabForRole(plumber, 'roles'), 'tasks');
  assert.equal(resolveFallbackTabForRole(plumber, 'stock'), 'stock');
  assert.equal(isTabAllowedForRole(plumber, 'help'), true);
});

test('sanitizeAllowedTabs filters invalid tab ids and never returns empty array', () => {
  assert.deepEqual(sanitizeAllowedTabs(['invalid_tab']), ['tasks']);
  assert.deepEqual(sanitizeAllowedTabs(['tasks', 'stock', 'tasks', 'bad']), ['tasks', 'stock']);
});

test('resolveGuestAlertSourceForRole maps categories accurately', () => {
  assert.equal(resolveGuestAlertSourceForRole(resolveRoleDefinition(BUILT_IN_ROLES, 'manager')), 'management');
  assert.equal(resolveGuestAlertSourceForRole(resolveRoleDefinition(BUILT_IN_ROLES, 'plumber')), 'housekeeping');
  assert.equal(resolveGuestAlertSourceForRole(resolveRoleDefinition(BUILT_IN_ROLES, 'gouvernante')), 'housekeeping');
  assert.equal(resolveGuestAlertSourceForRole(resolveRoleDefinition(BUILT_IN_ROLES, 'receptionist')), 'reception');
});

test('slugifyCustomRoleId generates unique non-colliding identifiers', () => {
  const first = slugifyCustomRoleId('Maître d’hôtel', ['custom_maitre_d_hotel']);
  assert.equal(first, 'custom_maitre_d_hotel_2');
});
