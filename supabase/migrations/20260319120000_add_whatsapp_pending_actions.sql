-- WhatsApp pending actions for undo/edit/cancel flow
create table if not exists public.whatsapp_pending_actions (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  company_id uuid references pj.companies(id) on delete cascade,
  phone text not null,
  kind text not null default 'create_transaction' check (kind in ('create_transaction')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'canceled', 'expired', 'executed')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_pending_actions_profile_id_idx on public.whatsapp_pending_actions(profile_id);
create index if not exists whatsapp_pending_actions_phone_idx on public.whatsapp_pending_actions(phone);
create index if not exists whatsapp_pending_actions_status_idx on public.whatsapp_pending_actions(status);

alter table public.whatsapp_pending_actions enable row level security;

create policy "Users can manage own pending actions"
  on public.whatsapp_pending_actions
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Service role needs full access for webhook operations
grant select, insert, update, delete on public.whatsapp_pending_actions to service_role;
grant select, insert, update on public.whatsapp_pending_actions to authenticated;
