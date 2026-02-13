-- Fix legacy tenant gaps affecting WhatsApp link generation for PJ users

-- Backfill profile tenant_id from member company tenant when missing
update public.profiles p
set tenant_id = x.tenant_id
from (
  select distinct on (cm.profile_id)
    cm.profile_id,
    c.tenant_id
  from pj.company_members cm
  join pj.companies c on c.id = cm.company_id
  where c.tenant_id is not null
  order by cm.profile_id, c.tenant_id::text
) x
where p.id = x.profile_id
  and p.tenant_id is null
  and x.tenant_id is not null;

-- Make WhatsApp tenant trigger resilient for legacy profiles with tenant_id null.
-- If profile tenant is missing but company tenant exists, we auto-heal profile tenant.
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

  if new.company_id is not null then
    select tenant_id into company_tenant
    from pj.companies
    where id = new.company_id;

    if company_tenant is null then
      raise exception 'Company tenant not set' using errcode = '23514';
    end if;

    if profile_tenant is null then
      update public.profiles
      set tenant_id = company_tenant
      where id = new.profile_id
        and tenant_id is null;

      profile_tenant := company_tenant;
    end if;

    if company_tenant is distinct from profile_tenant then
      raise exception 'Company tenant mismatch' using errcode = '23514';
    end if;
  end if;

  if profile_tenant is null then
    raise exception 'Profile tenant not set' using errcode = '23514';
  end if;

  new.tenant_id := profile_tenant;
  return new;
end;
$$;
