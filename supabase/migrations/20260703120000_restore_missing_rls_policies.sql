-- The 2026-07-03 security audit found the live database out of sync with
-- 20260326123000_rls_core_tables.sql: is_job_owner() was missing, job_items /
-- report_deliveries / template_items had RLS enabled but no policies, and a
-- legacy "Authenticated users can read profiles" policy (USING true, role
-- public) exposed every engineer profile — including bank details — to anyone
-- holding the anon key. Re-assert the missing pieces (idempotent), drop the
-- exposed-profiles policy, and clear the two Supabase security-advisor
-- warnings on set_updated_at / handle_new_user.

-- CRITICAL: profiles were readable by anon/authenticated without ownership.
drop policy if exists "Authenticated users can read profiles" on public.profiles;

create or replace function public.is_job_owner(p_job_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where id = p_job_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists job_items_owner_all on public.job_items;
create policy job_items_owner_all
on public.job_items
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

drop policy if exists report_deliveries_owner_all on public.report_deliveries;
create policy report_deliveries_owner_all
on public.report_deliveries
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

drop policy if exists template_items_select_visible on public.template_items;
create policy template_items_select_visible
on public.template_items
for select
to authenticated
using (
  exists (
    select 1
    from public.templates t
    where t.id = template_items.template_id
      and (
        t.is_public = true
        or coalesce(t.user_id, t.created_by) = auth.uid()
      )
  )
);

drop policy if exists template_items_insert_owner on public.template_items;
create policy template_items_insert_owner
on public.template_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.templates t
    where t.id = template_items.template_id
      and coalesce(t.user_id, t.created_by) = auth.uid()
  )
);

drop policy if exists template_items_update_owner on public.template_items;
create policy template_items_update_owner
on public.template_items
for update
to authenticated
using (
  exists (
    select 1
    from public.templates t
    where t.id = template_items.template_id
      and coalesce(t.user_id, t.created_by) = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.templates t
    where t.id = template_items.template_id
      and coalesce(t.user_id, t.created_by) = auth.uid()
  )
);

drop policy if exists template_items_delete_owner on public.template_items;
create policy template_items_delete_owner
on public.template_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.templates t
    where t.id = template_items.template_id
      and coalesce(t.user_id, t.created_by) = auth.uid()
  )
);

-- Advisor: function_search_path_mutable
alter function public.set_updated_at() set search_path = public;

-- Advisor: SECURITY DEFINER function executable by anon/authenticated. It is a
-- trigger function (auth.users on-insert) and never needs direct execution.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
