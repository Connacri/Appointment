import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_ROLES } from '../src/data/roles';
import {
  getRoleUiCapabilities,
  isTabAllowedForRole,
  mergeRolesWithStoredConfig,
  normalizeLegacyRoleId,
  resolveFallbackTabForRole,
  resolveGuestAlertSourceForRole,
  resolveRoleDefinition,
  sanitizeAllowedTabs,
  slugifyCustomRoleId,
} from '../src/utils/rolePermissions';
import {
  applyStaffAssignmentUpdate,
  applyStaffPromotionOrTransfer,
  buildStaffMemberRecord,
  getDefaultTasksForRole,
} from '../src/utils/staffHr';
import type { RoleDefinition } from '../src/types/roles';

test('built-in roles include Femme/Valet de chambre, Gouvernante/Gouvernant, Plombier, Menuisier, Responsable, and hotel trades', () => {
  const ids = new Set(BUILT_IN_ROLES.map((r) => r.id));
  for (const expected of [
    'admin',
    'manager',
    'responsable',
    'chef_du_personnel',
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

  const hrManager = resolveRoleDefinition(BUILT_IN_ROLES, 'chef_du_personnel');
  assert.match(hrManager.label.fr, /Chef du Personnel/i);
});

test('roles management tab is restricted to Admin, Gérant (manager), Responsable, and Chef du Personnel by default', () => {
  const rolesWithTab = BUILT_IN_ROLES.filter((r) => r.allowedTabs.includes('roles')).map((r) => r.id);
  assert.deepEqual(rolesWithTab.sort(), ['admin', 'chef_du_personnel', 'manager', 'responsable']);
});

test('operational and trade roles only display necessary tabs', () => {
  const roomAttendant = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');
  assert.deepEqual(roomAttendant.allowedTabs, ['tasks', 'housekeeping', 'lost_property']);
  assert.equal(isTabAllowedForRole(roomAttendant, 'planning'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'stock'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'analytics'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'billing'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'pricing'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'channels'), false);
  assert.equal(isTabAllowedForRole(roomAttendant, 'roles'), false);
  assert.equal(resolveFallbackTabForRole(roomAttendant, 'planning'), 'tasks');

  const plumber = resolveRoleDefinition(BUILT_IN_ROLES, 'plumber');
  assert.deepEqual(plumber.allowedTabs, ['tasks', 'housekeeping', 'stock', 'events']);
  assert.equal(isTabAllowedForRole(plumber, 'analytics'), false);
  assert.equal(isTabAllowedForRole(plumber, 'billing'), false);

  const carpenter = resolveRoleDefinition(BUILT_IN_ROLES, 'carpenter');
  assert.deepEqual(carpenter.allowedTabs, ['tasks', 'housekeeping', 'stock', 'events']);
});

test('getRoleUiCapabilities blocks Gantt, currency, USB, and admin tools for room_attendant while keeping them for manager', () => {
  const roomAttendant = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');
  const raCaps = getRoleUiCapabilities(roomAttendant);
  assert.equal(raCaps.canViewPlanningOrBookings, false);
  assert.equal(raCaps.canUseCurrencySwitcher, false);
  assert.equal(raCaps.canUseUsbTools, false);
  assert.equal(raCaps.canUseAdminSystemTools, false);
  assert.equal(raCaps.isFocusedOperationalRole, true);

  const manager = resolveRoleDefinition(BUILT_IN_ROLES, 'manager');
  const mgrCaps = getRoleUiCapabilities(manager);
  assert.equal(mgrCaps.canViewPlanningOrBookings, true);
  assert.equal(mgrCaps.canUseCurrencySwitcher, true);
  assert.equal(mgrCaps.canUseUsbTools, true);
  assert.equal(mgrCaps.canUseAdminSystemTools, true);
  assert.equal(mgrCaps.isFocusedOperationalRole, false);
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

test('chef_du_personnel role and staffHr utilities manage hiring by role/tasks, assignment, and promotions', () => {
  const hrRole = resolveRoleDefinition(BUILT_IN_ROLES, 'chef_du_personnel');
  assert.equal(hrRole.permissions.canManageRoles, true);
  assert.equal(hrRole.permissions.canManageTasks, true);
  assert.equal(hrRole.permissions.canManageBookings, false);
  assert.ok(hrRole.allowedTabs.includes('roles'));
  assert.ok(hrRole.allowedTabs.includes('tasks'));

  const attendantRole = resolveRoleDefinition(BUILT_IN_ROLES, 'room_attendant');
  const starterTasks = getDefaultTasksForRole(attendantRole, 'fr');
  assert.ok(starterTasks.length >= 3);

  const created = buildStaffMemberRecord({
    fullName: 'Nadia Benali',
    roleId: 'room_attendant',
    assignment: 'Étage 1',
    shift: 'Matin',
    defaultTasks: starterTasks,
    approvedBy: 'Chef du Personnel',
    nowIso: '2026-11-01T08:00:00Z',
  });
  assert.equal(created.roleId, 'room_attendant');
  assert.equal(created.history[0]?.type, 'hired');

  const assigned = applyStaffAssignmentUpdate(created, {
    assignment: 'Étage 2 & 3',
    shift: 'Soir',
    note: 'Renfort week-end',
    approvedBy: 'Chef du Personnel',
    nowIso: '2026-11-10T09:00:00Z',
  });
  assert.equal(assigned.assignment, 'Étage 2 & 3');
  assert.equal(assigned.shift, 'Soir');
  assert.equal(assigned.history[0]?.type, 'assigned');

  const gouvRole = resolveRoleDefinition(BUILT_IN_ROLES, 'gouvernante');
  const promoted = applyStaffPromotionOrTransfer(assigned, {
    newRoleId: 'gouvernante',
    newAssignment: 'Tous les étages',
    newShift: 'Matin',
    defaultTasks: getDefaultTasksForRole(gouvRole, 'fr'),
    changeType: 'promoted',
    note: 'Excellente qualité de service',
    approvedBy: 'Chef du Personnel',
    nowIso: '2026-11-20T10:00:00Z',
  });
  assert.equal(promoted.roleId, 'gouvernante');
  assert.equal(promoted.assignment, 'Tous les étages');
  assert.equal(promoted.history.length, 3);
  assert.equal(promoted.history[0]?.type, 'promoted');
  assert.equal(promoted.history[0]?.fromRoleId, 'room_attendant');
  assert.equal(promoted.history[0]?.toRoleId, 'gouvernante');
});
