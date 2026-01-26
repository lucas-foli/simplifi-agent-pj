-- Tenants for multi-tenant branding and routing
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  branding jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

create policy "Tenants are readable by anyone"
  on public.tenants for select
  using (is_active = true);

create policy "Service role manages tenants"
  on public.tenants for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.update_tenants_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_tenants_updated_at on public.tenants;
create trigger update_tenants_updated_at
  before update on public.tenants
  for each row
  execute function public.update_tenants_updated_at();
