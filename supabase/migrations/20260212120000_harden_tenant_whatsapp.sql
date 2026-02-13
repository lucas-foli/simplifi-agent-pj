-- Tenant hardening: immutable tenant_id and explicit WhatsApp tenant linkage

-- Prevent changing tenant_id once set (allow null -> value)
create or replace function public.prevent_profile_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.tenant_id is not null and new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_tenant_change on public.profiles;
create trigger prevent_profile_tenant_change
  before update on public.profiles
  for each row execute function public.prevent_profile_tenant_change();

alter table public.whatsapp_links
  add column if not exists tenant_id uuid references public.tenants(id);

create index if not exists whatsapp_links_tenant_id_idx
  on public.whatsapp_links(tenant_id);

update public.whatsapp_links wl
set tenant_id = p.tenant_id
from public.profiles p
where wl.profile_id = p.id
  and wl.tenant_id is null;

update public.whatsapp_links wl
set tenant_id = c.tenant_id
from pj.companies c
where wl.company_id = c.id
  and wl.tenant_id is null;

create or replace function public.set_whatsapp_links_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, pj
as $$
declare
  profile_tenant uuid;
  company_tenant uuid;
begin
  select tenant_id into profile_tenant
  from public.profiles
  where id = new.profile_id;

  if profile_tenant is null then
    raise exception 'Profile tenant not set' using errcode = '23514';
  end if;

  if new.company_id is not null then
    select tenant_id into company_tenant
    from pj.companies
    where id = new.company_id;

    if company_tenant is null then
      raise exception 'Company not found' using errcode = '23503';
    end if;

    if company_tenant is distinct from profile_tenant then
      raise exception 'Company tenant mismatch' using errcode = '23514';
    end if;
  end if;

  new.tenant_id := profile_tenant;
  return new;
end;
$$;

drop trigger if exists set_whatsapp_links_tenant on public.whatsapp_links;
create trigger set_whatsapp_links_tenant
  before insert or update on public.whatsapp_links
  for each row execute function public.set_whatsapp_links_tenant();

drop policy if exists "Tenant isolation whatsapp_links" on public.whatsapp_links;
create policy "Tenant isolation whatsapp_links"
  on public.whatsapp_links as restrictive
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
