-- Ensure pgcrypto is available for hashing CNPJ values
create extension if not exists pgcrypto;

-- Add a hash column to enforce uniqueness without storing plain CNPJ
alter table if exists pj.companies
  add column if not exists cnpj_hash text;

create unique index if not exists company_cnpj_hash_idx
  on pj.companies (cnpj_hash)
  where cnpj_hash is not null;

create or replace function pj.create_company_with_owner(
  company_name text,
  cnpj text default null,
  monthly_revenue decimal(15,2) default 0,
  activity text default null
)
returns uuid
language plpgsql
security definer
set search_path = pj, public
as $$
declare
  target_company uuid;
  duplicate_company uuid;
  encrypted_cnpj text;
  sanitized_activity text;
  sanitized_cnpj text;
  cnpj_hash_value text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Return existing company when membership already exists
  select company_id into target_company
  from pj.company_members
  where profile_id = auth.uid()
  order by created_at asc
  limit 1;

  if target_company is not null then
    return target_company;
  end if;

  sanitized_activity := nullif(trim(activity), '');
  sanitized_cnpj := nullif(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), '');

  if sanitized_cnpj is not null then
    cnpj_hash_value := encode(digest(sanitized_cnpj, 'sha256'), 'hex');

    select id into duplicate_company
    from pj.companies
    where cnpj_hash = cnpj_hash_value
    limit 1;

    if duplicate_company is not null then
      raise exception 'CNPJ já cadastrado'
        using errcode = '23505';
    end if;

    select public.encrypt_sensitive(sanitized_cnpj) into encrypted_cnpj;
  else
    encrypted_cnpj := null;
    cnpj_hash_value := null;
  end if;

  insert into pj.companies (name, activity, created_by, cnpj_encrypted, cnpj_hash, monthly_revenue)
  values (
    coalesce(nullif(trim(company_name), ''), 'Empresa sem nome'),
    sanitized_activity,
    auth.uid(),
    encrypted_cnpj,
    cnpj_hash_value,
    coalesce(monthly_revenue, 0)
  )
  returning id into target_company;

  insert into pj.company_members (company_id, profile_id, role)
  values (target_company, auth.uid(), 'owner');

  perform pj.create_default_categories(target_company);

  return target_company;
end;
$$;
