-- Backfill tenant_id on legacy rows created before tenant hardening

-- Companies: derive tenant from creator profile first
update pj.companies c
set tenant_id = p.tenant_id
from public.profiles p
where c.tenant_id is null
  and c.created_by = p.id
  and p.tenant_id is not null;

-- Companies fallback: derive tenant from any existing member profile
update pj.companies c
set tenant_id = x.tenant_id
from (
  select distinct on (cm.company_id)
    cm.company_id,
    p.tenant_id
  from pj.company_members cm
  join public.profiles p on p.id = cm.profile_id
  where p.tenant_id is not null
  order by cm.company_id, p.tenant_id::text
) x
where c.tenant_id is null
  and c.id = x.company_id
  and x.tenant_id is not null;

-- Company-scoped tables inherit from company
update pj.company_members cm
set tenant_id = c.tenant_id
from pj.companies c
where cm.tenant_id is null
  and cm.company_id = c.id
  and c.tenant_id is not null;

update pj.company_categories cc
set tenant_id = c.tenant_id
from pj.companies c
where cc.tenant_id is null
  and cc.company_id = c.id
  and c.tenant_id is not null;

update pj.company_fixed_costs cfc
set tenant_id = c.tenant_id
from pj.companies c
where cfc.tenant_id is null
  and cfc.company_id = c.id
  and c.tenant_id is not null;

update pj.company_transactions ct
set tenant_id = c.tenant_id
from pj.companies c
where ct.tenant_id is null
  and ct.company_id = c.id
  and c.tenant_id is not null;

-- WhatsApp links: derive from profile first, then company
update public.whatsapp_links wl
set tenant_id = p.tenant_id
from public.profiles p
where wl.tenant_id is null
  and wl.profile_id = p.id
  and p.tenant_id is not null;

update public.whatsapp_links wl
set tenant_id = c.tenant_id
from pj.companies c
where wl.tenant_id is null
  and wl.company_id = c.id
  and c.tenant_id is not null;
