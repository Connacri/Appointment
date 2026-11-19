import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findPersonalWorkspace,
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
