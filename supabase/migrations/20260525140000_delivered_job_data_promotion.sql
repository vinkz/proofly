alter table if exists public.properties
  add column if not exists next_service_due date;

create index if not exists properties_user_address_postcode_idx
on public.properties(user_id, lower(coalesce(address_line1, '')), lower(coalesce(postcode, '')));

create index if not exists properties_next_service_due_idx
on public.properties(user_id, next_service_due);

do $$
<<backfill>>
declare
  job_rec record;
  fields jsonb;
  client_id uuid;
  property_id uuid;
  client_name text;
  client_email text;
  client_phone text;
  client_company text;
  client_address text;
  client_postcode text;
  property_name text;
  property_line1 text;
  property_line2 text;
  property_town text;
  property_postcode text;
  property_phone text;
  cert_date text;
  base_date timestamptz;
  next_due date;
begin
  for job_rec in
    select *
    from public.jobs
    where user_id is not null
      and lower(coalesce(status, '')) in ('delivered', 'completed', 'closed')
    order by coalesce(delivered_at, completed_at, scheduled_for, created_at) asc nulls last
  loop
    select coalesce(jsonb_object_agg(field_key, value), '{}'::jsonb)
    into fields
    from public.job_fields
    where job_id = job_rec.id
      and value is not null
      and btrim(value) <> '';

    client_name := nullif(btrim(coalesce(fields->>'landlord_name', fields->>'customer_name', job_rec.client_name, '')), '');
    client_email := nullif(btrim(coalesce(fields->>'landlord_email', fields->>'customer_email', fields->>'email', '')), '');
    client_phone := nullif(btrim(coalesce(fields->>'landlord_tel', fields->>'landlord_phone', fields->>'customer_phone', fields->>'phone', '')), '');
    client_company := nullif(btrim(coalesce(fields->>'landlord_company', fields->>'customer_company', '')), '');
    client_address := nullif(btrim(coalesce(
      fields->>'landlord_address',
      concat_ws(', ', nullif(fields->>'landlord_address_line1', ''), nullif(fields->>'landlord_address_line2', ''), nullif(fields->>'landlord_city', ''), nullif(fields->>'landlord_postcode', ''))
    )), '');
    client_postcode := nullif(btrim(coalesce(fields->>'landlord_postcode', fields->>'customer_postcode', '')), '');

    client_id := job_rec.client_id;
    if client_id is null and (client_email is not null or client_phone is not null) then
      select id
      into client_id
      from public.clients c
      where c.user_id = job_rec.user_id
        and (
          (client_email is not null and lower(coalesce(c.email, '')) = lower(client_email))
          or (client_phone is not null and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(client_phone, '\D', '', 'g'))
        )
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    end if;

    if client_id is null and (client_name is not null or client_email is not null or client_phone is not null) then
      insert into public.clients (
        user_id,
        name,
        organization,
        email,
        phone,
        address,
        postcode,
        landlord_name,
        landlord_address
      )
      values (
        job_rec.user_id,
        coalesce(client_name, 'Landlord'),
        client_company,
        client_email,
        client_phone,
        client_address,
        client_postcode,
        client_name,
        client_address
      )
      returning id into client_id;
    elsif client_id is not null then
      update public.clients
      set
        name = coalesce(client_name, name),
        organization = coalesce(client_company, organization),
        email = coalesce(client_email, email),
        phone = coalesce(client_phone, phone),
        address = coalesce(client_address, address),
        postcode = coalesce(client_postcode, postcode),
        landlord_name = coalesce(client_name, landlord_name),
        landlord_address = coalesce(client_address, landlord_address),
        updated_at = now()
      where id = backfill.client_id;
    end if;

    property_name := nullif(btrim(coalesce(fields->>'job_address_name', fields->>'property_name', '')), '');
    property_line1 := nullif(btrim(coalesce(fields->>'job_address_line1', fields->>'property_address_line1', split_part(coalesce(job_rec.address, ''), ',', 1))), '');
    property_line2 := nullif(btrim(coalesce(fields->>'job_address_line2', fields->>'property_address_line2', '')), '');
    property_town := nullif(btrim(coalesce(fields->>'job_address_city', fields->>'property_town', '')), '');
    property_postcode := nullif(btrim(coalesce(fields->>'job_postcode', fields->>'property_postcode', fields->>'postcode', '')), '');
    property_phone := nullif(btrim(coalesce(fields->>'job_tel', fields->>'property_phone', fields->>'tenant_phone', '')), '');
    cert_date := nullif(btrim(coalesce(fields->>'inspection_date', fields->>'completion_date', fields->>'issued_at', '')), '');
    base_date := coalesce(
      case when cert_date ~ '^\d{4}-\d{2}-\d{2}' then cert_date::timestamptz else null end,
      job_rec.delivered_at,
      job_rec.completed_at,
      job_rec.scheduled_for,
      job_rec.created_at
    );
    next_due := case
      when (
        job_rec.job_type in ('safety_check', 'safety_check_service')
        or job_rec.certificate_type = 'cp12'
        or coalesce(job_rec.cert_types, '{}'::text[]) @> array['cp12']::text[]
      )
      and base_date is not null
      then (base_date::date + interval '1 year')::date
      else null
    end;

    property_id := job_rec.property_id;
    if property_id is null and property_line1 is not null and property_postcode is not null then
      select id
      into property_id
      from public.properties p
      where p.user_id = job_rec.user_id
        and lower(coalesce(p.address_line1, '')) = lower(property_line1)
        and lower(coalesce(p.postcode, '')) = lower(property_postcode)
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    end if;

    if property_id is null and property_line1 is not null and property_postcode is not null then
      insert into public.properties (
        user_id,
        client_id,
        name,
        address_line1,
        address_line2,
        town,
        postcode,
        phone,
        next_service_due
      )
      values (
        job_rec.user_id,
        backfill.client_id,
        property_name,
        property_line1,
        property_line2,
        property_town,
        property_postcode,
        property_phone,
        next_due
      )
      returning id into property_id;
    elsif property_id is not null then
      update public.properties
      set
        client_id = coalesce(backfill.client_id, public.properties.client_id),
        name = coalesce(property_name, public.properties.name),
        address_line1 = coalesce(property_line1, public.properties.address_line1),
        address_line2 = coalesce(property_line2, public.properties.address_line2),
        town = coalesce(property_town, public.properties.town),
        postcode = coalesce(property_postcode, public.properties.postcode),
        phone = coalesce(property_phone, public.properties.phone),
        next_service_due = coalesce(next_due, public.properties.next_service_due),
        updated_at = now()
      where id = backfill.property_id;
    end if;

    update public.jobs
    set
      client_id = coalesce(public.jobs.client_id, backfill.client_id),
      property_id = coalesce(public.jobs.property_id, backfill.property_id),
      updated_at = now()
    where id = job_rec.id;
  end loop;
end backfill $$;
