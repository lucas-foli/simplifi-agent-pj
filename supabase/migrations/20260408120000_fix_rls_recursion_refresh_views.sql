-- Fix infinite recursion in company_members RLS policies.
-- The SELECT policy on pj.company_members references company_members itself,
-- causing infinite recursion when security_invoker views are used.
--
-- Solution: a SECURITY DEFINER helper that bypasses RLS for the membership check.

-- 1. Create helper function (runs as postgres, skips RLS)
CREATE OR REPLACE FUNCTION pj.is_company_member(
  p_company_id UUID,
  p_profile_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pj
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_id = p_company_id
      AND profile_id = p_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION pj.get_company_role(
  p_company_id UUID,
  p_profile_id UUID DEFAULT auth.uid()
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pj
AS $$
  SELECT role::text FROM pj.company_members
  WHERE company_id = p_company_id
    AND profile_id = p_profile_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION pj.is_company_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION pj.get_company_role(UUID, UUID) TO authenticated;

-- 2. Replace recursive company_members policies

DROP POLICY IF EXISTS "Members can view memberships" ON pj.company_members;
CREATE POLICY "Members can view memberships" ON pj.company_members
FOR SELECT USING (
  profile_id = auth.uid()
  OR pj.is_company_member(company_id)
);

DROP POLICY IF EXISTS "Owners manage memberships" ON pj.company_members;
CREATE POLICY "Owners manage memberships" ON pj.company_members
FOR INSERT WITH CHECK (
  pj.get_company_role(company_id) = 'owner'
);

DROP POLICY IF EXISTS "Owners update memberships" ON pj.company_members;
CREATE POLICY "Owners update memberships" ON pj.company_members
FOR UPDATE USING (
  pj.get_company_role(company_id) = 'owner'
)
WITH CHECK (
  pj.get_company_role(company_id) = 'owner'
);

DROP POLICY IF EXISTS "Owners delete memberships" ON pj.company_members;
CREATE POLICY "Owners delete memberships" ON pj.company_members
FOR DELETE USING (
  pj.get_company_role(company_id) = 'owner'
);

-- 3. Replace companies policies (they reference company_members too)

DROP POLICY IF EXISTS "Members can view company" ON pj.companies;
CREATE POLICY "Members can view company" ON pj.companies
FOR SELECT USING (
  pj.is_company_member(id)
);

DROP POLICY IF EXISTS "Owners can update company" ON pj.companies;
CREATE POLICY "Owners can update company" ON pj.companies
FOR UPDATE USING (
  pj.get_company_role(id) IN ('owner', 'admin')
)
WITH CHECK (
  pj.get_company_role(id) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "Company inserts require ownership" ON pj.companies;
CREATE POLICY "Company inserts require ownership" ON pj.companies
FOR INSERT WITH CHECK (created_by = auth.uid());

-- 4. Replace policies on other pj tables that reference company_members directly

DROP POLICY IF EXISTS "Members can read company categories" ON pj.company_categories;
CREATE POLICY "Members can read company categories" ON pj.company_categories
FOR SELECT USING (pj.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage company categories" ON pj.company_categories;
CREATE POLICY "Members can manage company categories" ON pj.company_categories
FOR ALL USING (
  pj.get_company_role(company_id) IN ('owner', 'admin')
) WITH CHECK (
  pj.get_company_role(company_id) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "Members can read company fixed costs" ON pj.company_fixed_costs;
CREATE POLICY "Members can read company fixed costs" ON pj.company_fixed_costs
FOR SELECT USING (pj.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage company fixed costs" ON pj.company_fixed_costs;
CREATE POLICY "Members can manage company fixed costs" ON pj.company_fixed_costs
FOR ALL USING (
  pj.is_company_member(company_id)
) WITH CHECK (
  pj.is_company_member(company_id)
);

DROP POLICY IF EXISTS "Members can read company transactions" ON pj.company_transactions;
CREATE POLICY "Members can read company transactions" ON pj.company_transactions
FOR SELECT USING (pj.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage company transactions" ON pj.company_transactions;
CREATE POLICY "Members can manage company transactions" ON pj.company_transactions
FOR ALL USING (
  pj.is_company_member(company_id)
) WITH CHECK (
  pj.is_company_member(company_id)
);

-- 5. Refresh stale public views to pick up new columns (e.g. timezone)
--    Use security_invoker so RLS applies through the view.

CREATE OR REPLACE VIEW public.companies
  WITH (security_invoker = on) AS
  SELECT * FROM pj.companies;

CREATE OR REPLACE VIEW public.company_members
  WITH (security_invoker = on) AS
  SELECT * FROM pj.company_members;

CREATE OR REPLACE VIEW public.company_categories
  WITH (security_invoker = on) AS
  SELECT * FROM pj.company_categories;

CREATE OR REPLACE VIEW public.company_fixed_costs
  WITH (security_invoker = on) AS
  SELECT * FROM pj.company_fixed_costs;

CREATE OR REPLACE VIEW public.company_transactions
  WITH (security_invoker = on) AS
  SELECT * FROM pj.company_transactions;

-- Re-grant permissions on refreshed views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_fixed_costs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_transactions TO authenticated;
