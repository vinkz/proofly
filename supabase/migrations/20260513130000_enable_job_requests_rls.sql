alter table if exists public.job_requests
  enable row level security;

drop policy if exists "Engineers can read their own job requests" on public.job_requests;

create policy "Engineers can read their own job requests"
on public.job_requests
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    user_id = (select auth.uid())
    or assigned_engineer_id = (select auth.uid())
    or lower(coalesce(pending_engineer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    or lower(coalesce(engineer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

comment on policy "Engineers can read their own job requests" on public.job_requests is
  'Read-only owner policy for authenticated engineers. Public request creation, claim, schedule, dismiss, and prefill flows must continue through server actions using explicit token/ownership validation.';
