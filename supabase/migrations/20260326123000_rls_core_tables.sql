-- Owner-based RLS for the authenticated app surface.
-- Note: if you have legacy rows with null user_id values, backfill them before enabling
-- these policies or those rows will no longer be visible to signed-in users.

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

create or replace function public.is_invoice_owner(p_invoice_id uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  owned boolean := false;
begin
  if to_regclass('public.invoices') is null then
    return false;
  end if;

  execute $sql$
    select exists (
      select 1
      from public.invoices
      where id = $1
        and user_id = auth.uid()
    )
  $sql$
  into owned
  using p_invoice_id;

  return owned;
end;
$$;

create or replace function public.next_job_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_seq integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if auth.uid() <> p_user_id then
    raise exception 'Cannot generate a job code for another user';
  end if;

  insert into public.job_code_counters (user_id, seq)
  values (p_user_id, 1)
  on conflict (user_id)
  do update set seq = public.job_code_counters.seq + 1
  returning seq into next_seq;

  return lpad(next_seq::text, 8, '0');
end;
$$;

revoke all on function public.next_job_code(uuid) from public;
grant execute on function public.next_job_code(uuid) to authenticated, service_role;

alter table if exists public.profiles enable row level security;
drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

alter table if exists public.job_code_counters enable row level security;
drop policy if exists job_code_counters_owner_all on public.job_code_counters;
create policy job_code_counters_owner_all
on public.job_code_counters
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table if exists public.clients enable row level security;
drop policy if exists clients_owner_all on public.clients;
create policy clients_owner_all
on public.clients
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if to_regclass('public.contacts') is null then
    return;
  end if;

  execute 'alter table public.contacts enable row level security';
  execute 'drop policy if exists contacts_owner_all on public.contacts';
  execute $sql$
    create policy contacts_owner_all
    on public.contacts
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid())
  $sql$;
end;
$$;

alter table if exists public.jobs enable row level security;
drop policy if exists jobs_owner_all on public.jobs;
create policy jobs_owner_all
on public.jobs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table if exists public.job_items enable row level security;
drop policy if exists job_items_owner_all on public.job_items;
create policy job_items_owner_all
on public.job_items
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

alter table if exists public.job_fields enable row level security;
drop policy if exists job_fields_owner_all on public.job_fields;
create policy job_fields_owner_all
on public.job_fields
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

alter table if exists public.job_photos enable row level security;
drop policy if exists job_photos_owner_all on public.job_photos;
create policy job_photos_owner_all
on public.job_photos
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

do $$
begin
  if to_regclass('public.photos') is null then
    return;
  end if;

  execute 'alter table public.photos enable row level security';
  execute 'drop policy if exists photos_owner_all on public.photos';
  execute $sql$
    create policy photos_owner_all
    on public.photos
    for all
    to authenticated
    using (public.is_job_owner(job_id))
    with check (public.is_job_owner(job_id))
  $sql$;
end;
$$;

do $$
begin
  if to_regclass('public.signatures') is null then
    return;
  end if;

  execute 'alter table public.signatures enable row level security';
  execute 'drop policy if exists signatures_owner_all on public.signatures';
  execute $sql$
    create policy signatures_owner_all
    on public.signatures
    for all
    to authenticated
    using (public.is_job_owner(job_id))
    with check (public.is_job_owner(job_id))
  $sql$;
end;
$$;

alter table if exists public.reports enable row level security;
drop policy if exists reports_owner_all on public.reports;
create policy reports_owner_all
on public.reports
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

alter table if exists public.report_deliveries enable row level security;
drop policy if exists report_deliveries_owner_all on public.report_deliveries;
create policy report_deliveries_owner_all
on public.report_deliveries
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

alter table if exists public.certificates enable row level security;
drop policy if exists certificates_owner_all on public.certificates;
create policy certificates_owner_all
on public.certificates
for all
to authenticated
using (
  user_id = auth.uid()
  or public.is_job_owner(job_id)
)
with check (
  user_id = auth.uid()
  or public.is_job_owner(job_id)
);

alter table if exists public.cp12_appliances enable row level security;
drop policy if exists cp12_appliances_owner_all on public.cp12_appliances;
create policy cp12_appliances_owner_all
on public.cp12_appliances
for all
to authenticated
using (
  user_id = auth.uid()
  or public.is_job_owner(job_id)
)
with check (
  user_id = auth.uid()
  or public.is_job_owner(job_id)
);

alter table if exists public.job_records enable row level security;
drop policy if exists job_records_owner_all on public.job_records;
create policy job_records_owner_all
on public.job_records
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

do $$
begin
  if to_regclass('public.job_sheets') is null then
    return;
  end if;

  execute 'alter table public.job_sheets enable row level security';
  execute 'drop policy if exists job_sheets_owner_all on public.job_sheets';
  execute $sql$
    create policy job_sheets_owner_all
    on public.job_sheets
    for all
    to authenticated
    using (public.is_job_owner(job_id))
    with check (public.is_job_owner(job_id))
  $sql$;
end;
$$;

alter table if exists public.job_files enable row level security;
drop policy if exists job_files_owner_all on public.job_files;
create policy job_files_owner_all
on public.job_files
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

alter table if exists public.fga_readings enable row level security;
drop policy if exists fga_readings_owner_all on public.fga_readings;
create policy fga_readings_owner_all
on public.fga_readings
for all
to authenticated
using (public.is_job_owner(job_id))
with check (public.is_job_owner(job_id));

alter table if exists public.templates enable row level security;
drop policy if exists templates_select_visible on public.templates;
create policy templates_select_visible
on public.templates
for select
to authenticated
using (
  is_public = true
  or coalesce(user_id, created_by) = auth.uid()
);

drop policy if exists templates_insert_owner on public.templates;
create policy templates_insert_owner
on public.templates
for insert
to authenticated
with check (coalesce(user_id, created_by) = auth.uid());

drop policy if exists templates_update_owner on public.templates;
create policy templates_update_owner
on public.templates
for update
to authenticated
using (coalesce(user_id, created_by) = auth.uid())
with check (coalesce(user_id, created_by) = auth.uid());

drop policy if exists templates_delete_owner on public.templates;
create policy templates_delete_owner
on public.templates
for delete
to authenticated
using (coalesce(user_id, created_by) = auth.uid());

alter table if exists public.template_items enable row level security;
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

do $$
begin
  if to_regclass('public.invoices') is null then
    return;
  end if;

  execute 'alter table public.invoices enable row level security';
  execute 'drop policy if exists invoices_owner_all on public.invoices';
  execute $sql$
    create policy invoices_owner_all
    on public.invoices
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid())
  $sql$;
end;
$$;

do $$
begin
  if to_regclass('public.invoice_line_items') is null then
    return;
  end if;

  execute 'alter table public.invoice_line_items enable row level security';
  execute 'drop policy if exists invoice_line_items_owner_all on public.invoice_line_items';
  execute $sql$
    create policy invoice_line_items_owner_all
    on public.invoice_line_items
    for all
    to authenticated
    using (public.is_invoice_owner(invoice_id))
    with check (public.is_invoice_owner(invoice_id))
  $sql$;
end;
$$;

do $$
begin
  if to_regclass('public.reminders') is null then
    return;
  end if;

  execute 'alter table public.reminders enable row level security';
  execute 'drop policy if exists reminders_owner_all on public.reminders';
  execute $sql$
    create policy reminders_owner_all
    on public.reminders
    for all
    to authenticated
    using (
      user_id = auth.uid()
      or public.is_job_owner(job_id)
    )
    with check (
      user_id = auth.uid()
      or public.is_job_owner(job_id)
    )
  $sql$;
end;
$$;

do $$
begin
  if to_regclass('public.usage_counters') is null then
    return;
  end if;

  execute 'alter table public.usage_counters enable row level security';
  execute 'drop policy if exists usage_counters_owner_all on public.usage_counters';
  execute $sql$
    create policy usage_counters_owner_all
    on public.usage_counters
    for all
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid())
  $sql$;
end;
$$;
