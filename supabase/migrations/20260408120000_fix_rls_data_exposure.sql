-- Fix critical RLS vulnerabilities: data_retention_policy and encryption_keys
-- tables were created without Row-Level Security, exposing them to any user
-- (including anonymous) with the project URL.
-- Also tightens overly permissive grants on data_access_log and transaction_patterns.

-- =============================================================================
-- 1. encryption_keys — CRITICAL: was fully exposed without RLS
-- =============================================================================
alter table public.encryption_keys enable row level security;

-- Only service_role should ever access encryption keys
create policy "Service role manages encryption keys"
  on public.encryption_keys
  for all
  to service_role
  using (true)
  with check (true);

-- Revoke all access from anon and authenticated — keys are internal
revoke all on public.encryption_keys from anon;
revoke all on public.encryption_keys from authenticated;

-- =============================================================================
-- 2. data_retention_policy — was fully exposed without RLS
-- =============================================================================
alter table public.data_retention_policy enable row level security;

-- Only service_role should manage retention configuration
create policy "Service role manages retention policies"
  on public.data_retention_policy
  for all
  to service_role
  using (true)
  with check (true);

-- Revoke all access from anon and authenticated — config table, not user-facing
revoke all on public.data_retention_policy from anon;
revoke all on public.data_retention_policy from authenticated;

-- =============================================================================
-- 3. data_access_log — has RLS but overly permissive grants & policies
-- =============================================================================

-- Revoke excessive anon access (anon should never touch audit logs)
revoke all on public.data_access_log from anon;

-- Revoke excessive authenticated privileges (keep only insert for logging)
revoke delete, truncate, references, trigger on public.data_access_log from authenticated;

-- Drop the overly permissive insert policy (allows anyone to insert fake logs)
drop policy if exists "Service role can insert audit logs" on public.data_access_log;

-- Replace with authenticated-only insert (for the log_sensitive_access function)
create policy "Authenticated users can insert audit logs"
  on public.data_access_log
  as permissive
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Service role full access for backend operations
create policy "Service role full access audit logs"
  on public.data_access_log
  for all
  to service_role
  using (true)
  with check (true);

-- =============================================================================
-- 4. transaction_patterns — has RLS + proper policies but unnecessary anon grants
-- =============================================================================

-- Revoke all anon access (patterns are user-specific, require authentication)
revoke all on public.transaction_patterns from anon;
