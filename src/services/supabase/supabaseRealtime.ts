import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const WORKSPACE_REALTIME_TABLES = [
  'bookings',
  'establishments',
  'resource_groups',
  'resources',
  'pms_tasks',
  'stock_items',
  'dynamic_rates',
  'stock_suppliers',
  'purchase_orders',
  'staff_members',
] as const;

/** Subscribe to workspace-scoped business changes. Payloads are deliberately
 * treated only as invalidation signals: the normal sync engine re-reads rows
 * under RLS and applies its version/tombstone/Outbox safeguards locally.
 */
export function subscribeWorkspaceRealtime(
  client: SupabaseClient<Database>,
  workspaceId: string,
  onChange: () => void,
  onStatus?: (status: string) => void,
) {
  if (!workspaceId.trim()) throw new Error('A workspace ID is required for Realtime.');
  const channel = client.channel('appointment-workspace-' + workspaceId);
  for (const table of WORKSPACE_REALTIME_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: 'workspace_id=eq.' + workspaceId },
      onChange,
    );
  }
  channel.subscribe((status) => {
    onStatus?.(status);
    if (status === 'SUBSCRIBED') onChange();
  });
  return channel;
}