-- Fix unrestricted views: set security_invoker = on so that RLS policies
-- on the underlying tables (pj.companies, pj.company_members, etc.) are
-- enforced for the querying user, not bypassed via postgres ownership.
--
-- Without this, anyone who can query these public views gets full access
-- to the underlying pj-schema tables, ignoring tenant isolation and
-- member-based RLS policies.

ALTER VIEW public.companies SET (security_invoker = on);
ALTER VIEW public.company_members SET (security_invoker = on);
ALTER VIEW public.company_categories SET (security_invoker = on);
ALTER VIEW public.company_fixed_costs SET (security_invoker = on);
ALTER VIEW public.company_transactions SET (security_invoker = on);
ALTER VIEW public.users_decrypted SET (security_invoker = on);
