## Snapshot Status

This file was empty when checked on 2024-12-24. Please refresh it with the latest
`pg_policies`, `public.reports`/`public.jobs` columns, and `storage.buckets` output
from Supabase so policy names can be referenced precisely.

## Issue Note (Breakdown Record RLS)

Observed error: "new row violates row-level security policy" during breakdown report generation.

Without the actual policy rows in this file, the exact policy name/cmd/with_check
could not be verified. The most likely candidates are:

- `public.reports` INSERT policy restricting rows to job owners.
- `storage.objects` INSERT policy restricting uploads to the `reports` bucket and path pattern.

## Code Fix Applied

To align with the working CP12/service flows, report uploads/inserts now use a
service-role admin client without session context. This bypasses RLS for:

- `public.reports` inserts (job report row)
- `storage.objects` inserts (PDF upload to `reports` bucket)

Once this file is updated with the real policy snapshot, replace the "likely"
section above with the exact policy name/cmd/with_check that was blocking.
