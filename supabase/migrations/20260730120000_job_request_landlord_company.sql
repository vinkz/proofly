-- The public request form has always collected "Company (optional)" and always
-- thrown it away: the client never sent it and the table had nowhere to put it.
--
-- It matters more than it looks. The value reaches the certificate as the
-- `landlord_company` job field (see createSoloJob), and for a letting agent
-- filling the form on a landlord's behalf the agency name is the detail that
-- makes the record identify the right responsible person under GSIUR 1998
-- Reg 36(3)(c) — "the name and address of the landlord or agent".
alter table if exists public.job_requests
  add column if not exists landlord_company text;

comment on column public.job_requests.landlord_company is
  'Letting agency or landlord company from the public request form. Flows to the job field landlord_company, and to clients.organization when the engineer accepts the request.';
