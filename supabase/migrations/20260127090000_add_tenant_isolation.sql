-- Add tenant_id to core tables and enforce tenant isolation

-- Helper: resolve tenant_id from metadata
create or replace function public.resolve_tenant_id(
  tenant_id_text text,
  tenant_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved uuid;
begin
  if tenant_id_text is not null and tenant_id_text <> '' then
    resolved := tenant_id_text::uuid;
  elsif tenant_slug is not null and tenant_slug <> '' then
    select id into resolved
    from public.tenants
    where slug = tenant_slug
      and is_active = true
    limit 1;
  end if;

  return resolved;
end;
$$;

-- Current tenant for RLS
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id);

create index if not exists profiles_tenant_id_idx on public.profiles(tenant_id);

alter table pj.companies
  add column if not exists tenant_id uuid references public.tenants(id);
alter table pj.company_members
  add column if not exists tenant_id uuid references public.tenants(id);
alter table pj.company_categories
  add column if not exists tenant_id uuid references public.tenants(id);
alter table pj.company_fixed_costs
  add column if not exists tenant_id uuid references public.tenants(id);
alter table pj.company_transactions
  add column if not exists tenant_id uuid references public.tenants(id);

create index if not exists pj_companies_tenant_id_idx on pj.companies(tenant_id);
create index if not exists pj_company_members_tenant_id_idx on pj.company_members(tenant_id);
create index if not exists pj_company_categories_tenant_id_idx on pj.company_categories(tenant_id);
create index if not exists pj_company_fixed_costs_tenant_id_idx on pj.company_fixed_costs(tenant_id);
create index if not exists pj_company_transactions_tenant_id_idx on pj.company_transactions(tenant_id);

-- Trigger to set tenant_id from company
create or replace function pj.set_tenant_id_from_company()
returns trigger
language plpgsql
security definer
set search_path = pj, public
as $$
declare
  resolved uuid;
begin
  select tenant_id into resolved from pj.companies where id = new.company_id;
  new.tenant_id := resolved;
  return new;
end;
$$;

drop trigger if exists set_tenant_id_company_members on pj.company_members;
create trigger set_tenant_id_company_members
  before insert or update on pj.company_members
  for each row execute function pj.set_tenant_id_from_company();

drop trigger if exists set_tenant_id_company_categories on pj.company_categories;
create trigger set_tenant_id_company_categories
  before insert or update on pj.company_categories
  for each row execute function pj.set_tenant_id_from_company();

drop trigger if exists set_tenant_id_company_fixed_costs on pj.company_fixed_costs;
create trigger set_tenant_id_company_fixed_costs
  before insert or update on pj.company_fixed_costs
  for each row execute function pj.set_tenant_id_from_company();

drop trigger if exists set_tenant_id_company_transactions on pj.company_transactions;
create trigger set_tenant_id_company_transactions
  before insert or update on pj.company_transactions
  for each row execute function pj.set_tenant_id_from_company();

-- Update auth trigger to include tenant_id
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_tenant uuid;
begin
  resolved_tenant := public.resolve_tenant_id(
    new.raw_user_meta_data->>'tenant_id',
    new.raw_user_meta_data->>'tenant_slug'
  );

  insert into public.profiles (id, user_type, full_name, email, monthly_income, tenant_id)
  values (
    new.id,
    coalesce(
      case new.raw_user_meta_data->>'user_type'
        when 'pf' then 'pessoa_fisica'::user_type
        when 'pj' then 'pessoa_juridica'::user_type
        when 'pessoa_fisica' then 'pessoa_fisica'::user_type
        when 'pessoa_juridica' then 'pessoa_juridica'::user_type
        else 'pessoa_fisica'::user_type
      end,
      'pessoa_fisica'::user_type
    ),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Usuário'),
    new.email,
    0,
    resolved_tenant
  );
  return new;
end;
$$;

-- Update company creation to respect tenant_id
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
  encrypted_cnpj text;
  sanitized_activity text;
  resolved_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select tenant_id into resolved_tenant
  from public.profiles
  where id = auth.uid();

  if resolved_tenant is null then
    raise exception 'Tenant not set';
  end if;

  select company_id into target_company
  from pj.company_members
  where profile_id = auth.uid()
  order by created_at asc
  limit 1;

  if target_company is not null then
    return target_company;
  end if;

  if cnpj is not null then
    select public.encrypt_sensitive(cnpj) into encrypted_cnpj;
  end if;

  sanitized_activity := nullif(trim(activity), '');

  insert into pj.companies (name, activity, created_by, cnpj_encrypted, monthly_revenue, tenant_id)
  values (
    coalesce(nullif(trim(company_name), ''), 'Empresa sem nome'),
    sanitized_activity,
    auth.uid(),
    encrypted_cnpj,
    coalesce(monthly_revenue, 0),
    resolved_tenant
  )
  returning id into target_company;

  insert into pj.company_members (company_id, profile_id, role, tenant_id)
  values (target_company, auth.uid(), 'owner', resolved_tenant);

  perform pj.create_default_categories(target_company);

  return target_company;
end;
$$;

-- Restrictive tenant policies
drop policy if exists "Tenant isolation companies" on pj.companies;
create policy "Tenant isolation companies"
  on pj.companies as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists "Tenant isolation company_members" on pj.company_members;
create policy "Tenant isolation company_members"
  on pj.company_members as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists "Tenant isolation company_categories" on pj.company_categories;
create policy "Tenant isolation company_categories"
  on pj.company_categories as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists "Tenant isolation company_fixed_costs" on pj.company_fixed_costs;
create policy "Tenant isolation company_fixed_costs"
  on pj.company_fixed_costs as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists "Tenant isolation company_transactions" on pj.company_transactions;
create policy "Tenant isolation company_transactions"
  on pj.company_transactions as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
