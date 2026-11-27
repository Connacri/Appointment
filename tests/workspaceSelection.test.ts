import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findAccessibleWorkspace,
  findPersonalWorkspace,
  isWorkspaceNetworkError,
  PERSONAL_WORKSPACE_NAME,
  personalWorkspaceIdForUser,
  selectPersonalWorkspaceId,
  type WorkspaceCandidate,
} from '../src/services/supabase/workspaceSelection';

const userId = '11111111-2222-4333-8444-555555555555';
const otherUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const personalWorkspace: WorkspaceCandidate = {
  id: personalWorkspaceIdForUser(userId),
  name: PERSONAL_WORKSPACE_NAME,
  owner_id: userId,
};

test('personal workspace id is the stable authenticated account id', () => {
  assert.equal(personalWorkspaceIdForUser(`  ${userId}  `), userId);
  assert.equal(personalWorkspaceIdForUser(''), '');
});

test('personal workspace selection ignores workspaces owned by another account', () => {
  const workspaces: WorkspaceCandidate[] = [
    { ...personalWorkspace, id: 'other-personal', owner_id: otherUserId },
  ];
  assert.equal(findPersonalWorkspace(workspaces, userId), undefined);
  assert.equal(selectPersonalWorkspaceId(workspaces, userId), '');
});

test('personal workspace selection ignores same-owner workspaces with a different name', () => {
  const workspaces: WorkspaceCandidate[] = [
    { ...personalWorkspace, id: 'shared', name: 'Shared team' },
  ];
  assert.equal(selectPersonalWorkspaceId(workspaces, userId), '');
});

test('personal workspace selection returns the owned personal workspace', () => {
  const workspaces: WorkspaceCandidate[] = [
    { id: 'shared', name: 'Shared team', owner_id: otherUserId },
    personalWorkspace,
  ];
  assert.equal(selectPersonalWorkspaceId(workspaces, userId), personalWorkspace.id);
});

test('personal workspace selection ignores a renamed shared workspace', () => {
  const workspaces: WorkspaceCandidate[] = [
    { ...personalWorkspace, id: 'shared', name: PERSONAL_WORKSPACE_NAME },
    { ...personalWorkspace, name: 'Mon espace renommé' },
  ];
  assert.equal(selectPersonalWorkspaceId(workspaces, userId), personalWorkspace.id);
});

test('personal workspace selection requires the stable account id as workspace id', () => {
  const workspaces: WorkspaceCandidate[] = [
    { ...personalWorkspace, id: otherUserId, owner_id: otherUserId },
  ];
  assert.equal(selectPersonalWorkspaceId(workspaces, userId), '');
});

test('personal workspace selection requires an authenticated user', () => {
  assert.equal(selectPersonalWorkspaceId([personalWorkspace], ''), '');
});

test('isWorkspaceNetworkError identifies fetch/network errors without masking RLS/auth errors', () => {
  assert.equal(isWorkspaceNetworkError(new TypeError('Failed to fetch')), true);
  assert.equal(isWorkspaceNetworkError(new Error('NetworkError when attempting to fetch resource.')), true);
  assert.equal(isWorkspaceNetworkError(new Error('new row violates row-level security policy')), false);
  assert.equal(isWorkspaceNetworkError(new Error('Invalid API key')), false);
  assert.equal(isWorkspaceNetworkError(null), false);
});

test('a staff account with one shared workspace selects it instead of its empty personal workspace', () => {
  const shared = {
    id: 'hotel-workspace',
    name: 'Hotel PMS',
    owner_id: otherUserId,
    workspace_members: [{ role: 'receptionist' }],
  };
  assert.equal(findAccessibleWorkspace([personalWorkspace, shared], userId, personalWorkspace.id)?.id, shared.id);
});

test('a previously selected shared workspace remains selected when several are accessible', () => {
  const sharedA = { id: 'hotel-a', name: 'Hotel A', owner_id: otherUserId, workspace_members: [{ role: 'admin' }] };
  const sharedB = { id: 'hotel-b', name: 'Hotel B', owner_id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', workspace_members: [{ role: 'manager' }] };
  assert.equal(findAccessibleWorkspace([personalWorkspace, sharedA, sharedB], userId, sharedB.id)?.id, sharedB.id);
  assert.equal(findAccessibleWorkspace([personalWorkspace, sharedA, sharedB], userId, personalWorkspace.id), undefined);
});

test('personal workspace remains the fallback when the user has no shared membership', () => {
  assert.equal(findAccessibleWorkspace([personalWorkspace], userId)?.id, personalWorkspace.id);
});
