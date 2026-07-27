-- PostgREST exposes `public`, so the helper added alongside the storage RLS fix
-- was reachable at /rest/v1/rpc/certificate_object_belongs_to_user, where it
-- answers "does this object path belong to this user id?" for arbitrary inputs.
-- That is an ownership oracle we do not need to expose. RLS can still call it
-- from a schema PostgREST does not serve.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.certificate_object_belongs_to_user(
  p_object_name text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    p_user_id is not null
    and p_object_name is not null
    and (
      -- {certType}/previews/{userId}/{file}
      ((storage.foldername(p_object_name))[2] = 'previews'
        and (storage.foldername(p_object_name))[3] = p_user_id::text)
      -- cp12/{userId}/{file}  (cp12 finals are keyed on the user)
      or (storage.foldername(p_object_name))[2] = p_user_id::text
      -- {certType}/{jobId}/{file}  (all other finals are keyed on the job)
      or exists (
        select 1 from public.jobs j
        where j.id::text = (storage.foldername(p_object_name))[2]
          and j.user_id = p_user_id
      )
    );
$$;

revoke all on function private.certificate_object_belongs_to_user(text, uuid) from public, anon;
grant execute on function private.certificate_object_belongs_to_user(text, uuid) to authenticated, service_role;

-- Repoint the policies, then retire the publicly-exposed copy.
drop policy if exists certificates_owner_select on storage.objects;
drop policy if exists certificates_owner_insert on storage.objects;
drop policy if exists certificates_owner_update on storage.objects;
drop policy if exists certificates_owner_delete on storage.objects;

create policy certificates_owner_select on storage.objects for select to authenticated
using (bucket_id = 'certificates' and private.certificate_object_belongs_to_user(name, (select auth.uid())));

create policy certificates_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'certificates' and private.certificate_object_belongs_to_user(name, (select auth.uid())));

create policy certificates_owner_update on storage.objects for update to authenticated
using (bucket_id = 'certificates' and private.certificate_object_belongs_to_user(name, (select auth.uid())))
with check (bucket_id = 'certificates' and private.certificate_object_belongs_to_user(name, (select auth.uid())));

create policy certificates_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'certificates' and private.certificate_object_belongs_to_user(name, (select auth.uid())));

drop function if exists public.certificate_object_belongs_to_user(text, uuid);
