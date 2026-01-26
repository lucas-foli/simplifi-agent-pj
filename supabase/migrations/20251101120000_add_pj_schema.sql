-- PJ schema to support company-focused financial flows

-- Ensure pgcrypto is available for encryption helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encryption helpers (idempotent definitions)
CREATE OR REPLACE FUNCTION public.__get_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret
    INTO encryption_key
    FROM vault.decrypted_secrets
    WHERE name = 'encryption_key'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      BEGIN
        encryption_key := current_setting('app.settings.encryption_key', TRUE);
      EXCEPTION
        WHEN others THEN
          encryption_key := NULL;
      END;
  END;

  RETURN encryption_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_sensitive(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := public.__get_encryption_key();
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN data;
  END IF;

  RETURN encode(pgp_sym_encrypt(data, encryption_key), 'base64');
EXCEPTION
  WHEN others THEN
    RETURN data;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive(encrypted_data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := public.__get_encryption_key();
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN encrypted_data;
  END IF;

  RETURN convert_from(
    pgp_sym_decrypt(decode(encrypted_data, 'base64'), encryption_key),
    'utf8'
  );
EXCEPTION
  WHEN others THEN
    RETURN encrypted_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_sensitive(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive(TEXT) TO authenticated;

-- Create schema for company data
CREATE SCHEMA IF NOT EXISTS pj;

-- Member role enum
DO $$ BEGIN
  CREATE TYPE pj.member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Companies table
CREATE TABLE IF NOT EXISTS pj.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  activity TEXT,
  trade_name TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cnpj_encrypted TEXT,
  email TEXT,
  phone TEXT,
  monthly_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company members table
CREATE TABLE IF NOT EXISTS pj.company_members (
  company_id UUID REFERENCES pj.companies(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role pj.member_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, profile_id)
);

-- Company categories
CREATE TABLE IF NOT EXISTS pj.company_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES pj.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company fixed costs
CREATE TABLE IF NOT EXISTS pj.company_fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES pj.companies(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT,
  category_id UUID REFERENCES pj.company_categories(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure corresponding columns exist on public schema tables for compatibility
ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS activity TEXT;

ALTER TABLE IF EXISTS public.company_fixed_costs
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Company transactions
CREATE TABLE IF NOT EXISTS pj.company_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES pj.companies(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type public.transaction_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES pj.company_categories(id) ON DELETE SET NULL,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper trigger to update updated_at columns
CREATE OR REPLACE FUNCTION pj.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_pj_companies_updated_at'
  ) THEN
    CREATE TRIGGER update_pj_companies_updated_at
      BEFORE UPDATE ON pj.companies
      FOR EACH ROW
      EXECUTE FUNCTION pj.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_pj_fixed_costs_updated_at'
  ) THEN
    CREATE TRIGGER update_pj_fixed_costs_updated_at
      BEFORE UPDATE ON pj.company_fixed_costs
      FOR EACH ROW
      EXECUTE FUNCTION pj.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_pj_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_pj_transactions_updated_at
      BEFORE UPDATE ON pj.company_transactions
      FOR EACH ROW
      EXECUTE FUNCTION pj.update_updated_at_column();
  END IF;
END;
$$;

-- Default categories helper
CREATE OR REPLACE FUNCTION pj.create_default_categories(target_company UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pj, public
AS $$
BEGIN
  INSERT INTO pj.company_categories (company_id, name, color, is_default)
  SELECT target_company, category_name, color, TRUE
  FROM (
    VALUES
      ('Receitas', '#0EA5E9'),
      ('Folha de Pagamento', '#6366F1'),
      ('Operacional', '#FB923C'),
      ('Marketing e Vendas', '#F97316'),
      ('Tributos', '#EF4444'),
      ('Serviços Financeiros', '#10B981'),
      ('Infraestrutura', '#8B5CF6'),
      ('Outros', '#6B7280')
  ) AS defaults(category_name, color)
  ON CONFLICT (company_id, lower(name)) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION pj.create_default_categories(UUID) TO authenticated;

-- Company creation/ensure helpers
CREATE OR REPLACE FUNCTION pj.create_company_with_owner(
  company_name TEXT,
  cnpj TEXT DEFAULT NULL,
  monthly_revenue DECIMAL(15,2) DEFAULT 0,
  activity TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pj, public
AS $$
DECLARE
  target_company UUID;
  encrypted_cnpj TEXT;
  sanitized_activity TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Return existing company when membership already exists
  SELECT company_id INTO target_company
  FROM pj.company_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company IS NOT NULL THEN
    RETURN target_company;
  END IF;

  IF cnpj IS NOT NULL THEN
    SELECT public.encrypt_sensitive(cnpj) INTO encrypted_cnpj;
  END IF;

  sanitized_activity := NULLIF(trim(activity), '');

  INSERT INTO pj.companies (name, activity, created_by, cnpj_encrypted, monthly_revenue)
  VALUES (
    COALESCE(NULLIF(trim(company_name), ''), 'Empresa sem nome'),
    sanitized_activity,
    auth.uid(),
    encrypted_cnpj,
    COALESCE(monthly_revenue, 0)
  )
  RETURNING id INTO target_company;

  INSERT INTO pj.company_members (company_id, profile_id, role)
  VALUES (target_company, auth.uid(), 'owner');

  PERFORM pj.create_default_categories(target_company);

  RETURN target_company;
END;
$$;

CREATE OR REPLACE FUNCTION pj.ensure_company_for_user(
  company_name TEXT,
  cnpj TEXT DEFAULT NULL,
  monthly_revenue DECIMAL(15,2) DEFAULT 0,
  activity TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pj, public
AS $$
DECLARE
  target_company UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id INTO target_company
  FROM pj.company_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company IS NOT NULL THEN
    RETURN target_company;
  END IF;

  RETURN pj.create_company_with_owner(company_name, cnpj, monthly_revenue, activity);
END;
$$;

GRANT EXECUTE ON FUNCTION pj.create_company_with_owner(TEXT, TEXT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION pj.ensure_company_for_user(TEXT, TEXT, DECIMAL, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.pg_create_company_with_owner(payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pj
AS $$
BEGIN
  RETURN pj.create_company_with_owner(
    COALESCE(NULLIF(payload->>'company_name', ''), 'Empresa sem nome'),
    NULLIF(payload->>'cnpj', ''),
    COALESCE((payload->>'monthly_revenue')::DECIMAL, 0),
    NULLIF(payload->>'activity', '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pg_ensure_company_for_user(payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pj
AS $$
BEGIN
  RETURN pj.ensure_company_for_user(
    COALESCE(NULLIF(payload->>'company_name', ''), 'Empresa sem nome'),
    NULLIF(payload->>'cnpj', ''),
    COALESCE((payload->>'monthly_revenue')::DECIMAL, 0),
    NULLIF(payload->>'activity', '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pg_create_company_with_owner(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_ensure_company_for_user(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_company_with_owner(
  company_name TEXT,
  cnpj TEXT DEFAULT NULL,
  monthly_revenue DECIMAL(15,2) DEFAULT 0,
  activity TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pj
AS $$
  SELECT public.pg_create_company_with_owner(
    jsonb_build_object(
      'company_name', company_name,
      'cnpj', cnpj,
      'monthly_revenue', monthly_revenue,
      'activity', activity
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_company_for_user(
  company_name TEXT,
  cnpj TEXT DEFAULT NULL,
  monthly_revenue DECIMAL(15,2) DEFAULT 0,
  activity TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pj
AS $$
  SELECT public.pg_ensure_company_for_user(
    jsonb_build_object(
      'company_name', company_name,
      'cnpj', cnpj,
      'monthly_revenue', monthly_revenue,
      'activity', activity
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.create_company_with_owner(TEXT, TEXT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_company_for_user(TEXT, TEXT, DECIMAL, TEXT) TO authenticated;

-- Row Level Security
ALTER TABLE pj.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pj.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pj.company_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pj.company_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pj.company_transactions ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Members can view company" ON pj.companies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_members.company_id = companies.id
      AND company_members.profile_id = auth.uid()
  )
);

CREATE POLICY "Owners can update company" ON pj.companies
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_members.company_id = companies.id
      AND company_members.profile_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_members.company_id = companies.id
      AND company_members.profile_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Company inserts require ownership" ON pj.companies
FOR INSERT WITH CHECK (created_by = auth.uid());

-- Company members policies
CREATE POLICY "Members can view memberships" ON pj.company_members
FOR SELECT USING (
  auth.uid() = profile_id OR EXISTS (
    SELECT 1 FROM pj.company_members AS self
    WHERE self.company_id = company_members.company_id
      AND self.profile_id = auth.uid()
  )
);

CREATE POLICY "Owners manage memberships" ON pj.company_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM pj.company_members AS owner_members
    WHERE owner_members.company_id = company_members.company_id
      AND owner_members.profile_id = auth.uid()
      AND owner_members.role = 'owner'
  )
);

CREATE POLICY "Owners update memberships" ON pj.company_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM pj.company_members AS self
    WHERE self.company_id = company_members.company_id
      AND self.profile_id = auth.uid()
      AND self.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pj.company_members AS self
    WHERE self.company_id = company_members.company_id
      AND self.profile_id = auth.uid()
      AND self.role = 'owner'
  )
);

CREATE POLICY "Owners delete memberships" ON pj.company_members
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM pj.company_members AS self
    WHERE self.company_id = company_members.company_id
      AND self.profile_id = auth.uid()
      AND self.role = 'owner'
  )
);

-- Categories policies
CREATE POLICY "Members can read company categories" ON pj.company_categories
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_members.company_id = company_categories.company_id
      AND company_members.profile_id = auth.uid()
  )
);

CREATE POLICY "Members can manage company categories" ON pj.company_categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM pj.company_members AS cm
    WHERE cm.company_id = company_categories.company_id
      AND cm.profile_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM pj.company_members AS cm
    WHERE cm.company_id = company_categories.company_id
      AND cm.profile_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
);

-- Fixed costs policies
CREATE POLICY "Members can read company fixed costs" ON pj.company_fixed_costs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_members.company_id = company_fixed_costs.company_id
      AND company_members.profile_id = auth.uid()
  )
);

CREATE POLICY "Members can manage company fixed costs" ON pj.company_fixed_costs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM pj.company_members AS cm
    WHERE cm.company_id = company_fixed_costs.company_id
      AND cm.profile_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM pj.company_members AS cm
    WHERE cm.company_id = company_fixed_costs.company_id
      AND cm.profile_id = auth.uid()
  )
);

-- Transactions policies
CREATE POLICY "Members can read company transactions" ON pj.company_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pj.company_members
    WHERE company_members.company_id = company_transactions.company_id
      AND company_members.profile_id = auth.uid()
  )
);

CREATE POLICY "Members can manage company transactions" ON pj.company_transactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM pj.company_members AS cm
    WHERE cm.company_id = company_transactions.company_id
      AND cm.profile_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM pj.company_members AS cm
    WHERE cm.company_id = company_transactions.company_id
      AND cm.profile_id = auth.uid()
  )
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_pj_company_members_profile ON pj.company_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_pj_company_categories_company ON pj.company_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_pj_company_fixed_costs_company ON pj.company_fixed_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_pj_company_transactions_company ON pj.company_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_pj_company_transactions_date ON pj.company_transactions(date);

-- Grant schema usage to authenticated users
GRANT USAGE ON SCHEMA pj TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pj TO authenticated;

-- Expose pj schema through public views for PostgREST compatibility
CREATE OR REPLACE VIEW public.companies AS
  SELECT * FROM pj.companies;

CREATE OR REPLACE VIEW public.company_members AS
  SELECT * FROM pj.company_members;

CREATE OR REPLACE VIEW public.company_categories AS
  SELECT * FROM pj.company_categories;

CREATE OR REPLACE VIEW public.company_fixed_costs AS
  SELECT * FROM pj.company_fixed_costs;

CREATE OR REPLACE VIEW public.company_transactions AS
  SELECT * FROM pj.company_transactions;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pj_company_categories_unique_name
  ON pj.company_categories (company_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_fixed_costs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_transactions TO authenticated;
