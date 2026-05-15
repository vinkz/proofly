alter table jobs
  add column if not exists delivered_at timestamptz;
