import assert from 'node:assert/strict';
import test from 'node:test';
import { subscribeWorkspaceRealtime, WORKSPACE_REALTIME_TABLES } from '../src/services/supabase/supabaseRealtime';

test('workspace Realtime subscribes only to workspace-scoped business tables', () => {
  const registrations: Array<{ event: string; filter: Record<string, string> }> = [];
  let subscribed = '';
  const channel = {
    on(event: string, filter: Record<string, string>, _callback: () => void) {
      registrations.push({ event, filter });
      return this;
    },
    subscribe(callback: (status: string) => void) {
      callback('SUBSCRIBED');
      return this;
    },
  };
  const client = { channel: (name: string) => { subscribed = name; return channel; } } as never;
  let invalidations = 0;
  const statuses: string[] = [];
  subscribeWorkspaceRealtime(client, 'workspace-123', () => { invalidations += 1; }, (status) => statuses.push(status));

  assert.equal(subscribed, 'appointment-workspace-workspace-123');
  assert.equal(registrations.length, WORKSPACE_REALTIME_TABLES.length);
  assert.equal(invalidations, 1);
  assert.deepEqual(statuses, ['SUBSCRIBED']);
  for (const registration of registrations) {
    assert.equal(registration.event, 'postgres_changes');
    assert.equal(registration.filter.event, '*');
    assert.equal(registration.filter.schema, 'public');
    assert.equal(registration.filter.filter, 'workspace_id=eq.workspace-123');
    assert.ok(WORKSPACE_REALTIME_TABLES.includes(registration.filter.table as typeof WORKSPACE_REALTIME_TABLES[number]));
  }
});

test('workspace Realtime refuses an empty workspace scope', () => {
  assert.throws(() => subscribeWorkspaceRealtime({} as never, '  ', () => undefined), /workspace ID is required/);
});