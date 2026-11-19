-- data-contract: policy-only (no schema or generated-type change)
-- A new account could insert its owned workspace but not the matching owner
-- membership: workspace_members_insert_allowed selects from workspaces, while
-- workspaces_select_member required an existing membership. Let the owner see
-- its own workspace row directly to break that circular RLS dependency.
drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.has_workspace_access(id)
  );

-- Repair accounts whose personal workspace exists without its owner membership.
-- Idempotent, additive, and constrained by the existing unique (workspace_id,user_id).
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1
  from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_id
)
on conflict (workspace_id, user_id) do nothing;
