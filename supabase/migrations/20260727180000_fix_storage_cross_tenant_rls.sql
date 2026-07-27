-- Close cross-tenant read/write access to stored customer files.
--
-- Until now every storage.objects policy lived only in the Supabase dashboard,
-- so none of this was reviewable in the repo. Several of those policies granted
-- the `authenticated` role bucket-wide access with no ownership predicate at
-- all. Because permissive RLS policies are OR'd together, those wide grants
-- overrode the correctly-scoped ones sitting next to them: any signed-in user
-- could list, download, overwrite and delete every other tenant's certificates,
-- invoices and job photos.
--
-- Confirmed against production before writing this: an account owning zero
-- records could see all 208 objects in `certificates` and all 14 in `invoices`.
--
-- This migration replaces those grants with ownership-scoped equivalents and
-- brings the whole storage policy set under version control.
--
-- Path layouts this encodes (verified against live object names):
--   certificates  cp12/{userId}/{file}                  <- cp12 finals key on USER
--   certificates  {certType}/{jobId}/{file}             <- other finals key on JOB
--   certificates  {certType}/previews/{userId}/{file}
--   invoices      {userId}/{invoiceId}.pdf
--   job-photos    {userId}/{jobId}/{file}
--
-- Note: the app serves nearly all of these files through the service role,
-- which bypasses RLS entirely. These policies govern the direct storage API
-- reachable with a user's own anon-key JWT, which is what was exposed.

-- ---------------------------------------------------------------------------
-- certificates ownership predicate
-- ---------------------------------------------------------------------------

-- The `certificates` bucket mixes three path layouts, so the predicate is
-- factored out rather than repeated across four policies where it could drift.
-- SECURITY DEFINER so the jobs lookup does not re-enter jobs' own RLS from
-- inside a storage policy; the user id is passed in and compared explicitly,
-- never taken from the caller's session inside the function.
create or replace function public.certificate_object_belongs_to_user(
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
      (
        (storage.foldername(p_object_name))[2] = 'previews'
        and (storage.foldername(p_object_name))[3] = p_user_id::text
      )
      -- cp12/{userId}/{file}  (cp12 finals are keyed on the user)
      or (storage.foldername(p_object_name))[2] = p_user_id::text
      -- {certType}/{jobId}/{file}  (all other finals are keyed on the job)
      or exists (
        select 1
        from public.jobs j
        where j.id::text = (storage.foldername(p_object_name))[2]
          and j.user_id = p_user_id
      )
    );
$$;

revoke all on function public.certificate_object_belongs_to_user(text, uuid) from public, anon;
grant execute on function public.certificate_object_belongs_to_user(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

-- The wide-open grant: ALL commands, whole bucket, no ownership check.
drop policy if exists certificates_bucket_all_authenticated on storage.objects;

-- Substring matching on the object name: `position(auth.uid() in name) > 0`
-- matches anywhere in the path, so it is both too loose and too weak to keep.
drop policy if exists certificates_read_own on storage.objects;
drop policy if exists certificates_upload_own on storage.objects;

-- Superseded by the combined predicate below (only ever matched previews).
drop policy if exists certificates_read_own_v3 on storage.objects;
drop policy if exists certificates_upload_own_v3 on storage.objects;

-- Keyed on storage.objects.owner, which is null for the ~90% of certificate
-- objects written by the service role, so these never matched in practice.
drop policy if exists "Users can read their certificates objects" on storage.objects;
drop policy if exists "Users can update their certificates objects" on storage.objects;
drop policy if exists "Users can delete their certificates objects" on storage.objects;
drop policy if exists "Users can upload their certificates objects" on storage.objects;

create policy certificates_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'certificates'
  and public.certificate_object_belongs_to_user(name, (select auth.uid()))
);

create policy certificates_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'certificates'
  and public.certificate_object_belongs_to_user(name, (select auth.uid()))
);

create policy certificates_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'certificates'
  and public.certificate_object_belongs_to_user(name, (select auth.uid()))
)
with check (
  bucket_id = 'certificates'
  and public.certificate_object_belongs_to_user(name, (select auth.uid()))
);

create policy certificates_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'certificates'
  and public.certificate_object_belongs_to_user(name, (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- invoices  ({userId}/{invoiceId}.pdf)
-- ---------------------------------------------------------------------------

-- All four granted the whole bucket to any authenticated user.
drop policy if exists "Invoices read" on storage.objects;
drop policy if exists "Invoices update" on storage.objects;
drop policy if exists "Invoices delete" on storage.objects;
drop policy if exists "Invoices upload" on storage.objects;

create policy invoices_owner_select
on storage.objects
for select
to authenticated
using (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy invoices_owner_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy invoices_owner_update
on storage.objects
for update
to authenticated
using (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy invoices_owner_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- job-photos  ({userId}/{jobId}/{file})
-- ---------------------------------------------------------------------------

-- These checked only `auth.uid() is not null` -- i.e. "is anyone logged in".
drop policy if exists "Users can read their own job photos" on storage.objects;
drop policy if exists "Users can delete their job photos" on storage.objects;
drop policy if exists "Users can upload their own job photos" on storage.objects;

create policy job_photos_owner_select
on storage.objects
for select
to authenticated
using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy job_photos_owner_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy job_photos_owner_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- photos (legacy bucket, currently empty -- closed before it gets used again)
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read job photos" on storage.objects;
drop policy if exists "Authenticated users can delete job photos" on storage.objects;

-- `own objects rw` and `user can access own photos files 1io9m69_0` already
-- scope this bucket by folder/owner and are left in place.
