-- ============================================================================
-- MANUAL MIGRATION SCRIPT - SimplifiQA
-- Execute este script completo no SQL Editor do Supabase Dashboard
-- ============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Acesse: https://supabase.com/dashboard/project/[seu-project-id]/sql/new
-- 2. Copie e cole TODO este arquivo
-- 3. Clique em "Run" (canto inferior direito)
-- 4. Aguarde a execução (pode demorar ~30 segundos)
-- 5. Verifique se há erros no output
--
-- IMPORTANTE: Faça backup do banco antes se estiver em produção!
-- ============================================================================

-- Migration 1: Chat History Policies
-- ============================================================================
-- Enable RLS on chat_history table
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own chat messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_history' 
    AND policyname = 'Users can view own chat messages'
  ) THEN
    CREATE POLICY "Users can view own chat messages"
    ON chat_history
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Users can insert their own chat messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_history' 
    AND policyname = 'Users can insert own chat messages'
  ) THEN
    CREATE POLICY "Users can insert own chat messages"
    ON chat_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Users can update their own chat messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_history' 
    AND policyname = 'Users can update own chat messages'
  ) THEN
    CREATE POLICY "Users can update own chat messages"
    ON chat_history
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Users can delete their own chat messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_history' 
    AND policyname = 'Users can delete own chat messages'
  ) THEN
    CREATE POLICY "Users can delete own chat messages"
    ON chat_history
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Migration 2: Transaction Patterns Table
-- ============================================================================
-- Create table for storing user's transaction patterns
CREATE TABLE IF NOT EXISTS transaction_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, description_pattern)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_user_id ON transaction_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_description ON transaction_patterns(description_pattern);

-- Enable RLS
ALTER TABLE transaction_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transaction_patterns' 
    AND policyname = 'Users can view their own patterns'
  ) THEN
    CREATE POLICY "Users can view their own patterns"
      ON transaction_patterns
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transaction_patterns' 
    AND policyname = 'Users can insert their own patterns'
  ) THEN
    CREATE POLICY "Users can insert their own patterns"
      ON transaction_patterns
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transaction_patterns' 
    AND policyname = 'Users can update their own patterns'
  ) THEN
    CREATE POLICY "Users can update their own patterns"
      ON transaction_patterns
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transaction_patterns' 
    AND policyname = 'Users can delete their own patterns'
  ) THEN
    CREATE POLICY "Users can delete their own patterns"
      ON transaction_patterns
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_transaction_patterns_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaction_patterns_updated_at ON transaction_patterns;
CREATE TRIGGER transaction_patterns_updated_at
  BEFORE UPDATE ON transaction_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_patterns_updated_at();

-- Migration 3: Data Encryption & Privacy (LGPD/GDPR)
-- ============================================================================
-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key table (store key separately in production!)
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rotated_at TIMESTAMP WITH TIME ZONE
);

-- Insert master key (IMPORTANT: Rotate in production!)
INSERT INTO encryption_keys (key_name, key_value)
VALUES ('master_key', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key_name) DO NOTHING;

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive(data TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  
  SELECT key_value INTO encryption_key
  FROM encryption_keys
  WHERE key_name = 'master_key';
  
  RETURN encode(
    pgp_sym_encrypt(data, encryption_key, 'cipher-algo=aes256'),
    'base64'
  );
END;
$$;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive(encrypted_data TEXT)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  
  SELECT key_value INTO encryption_key
  FROM encryption_keys
  WHERE key_name = 'master_key';
  
  RETURN pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Decryption failed';
    RETURN NULL;
END;
$$;

-- Create audit log table for sensitive data access
CREATE TABLE IF NOT EXISTS data_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_data_access_log_user_id ON data_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_log_accessed_at ON data_access_log(accessed_at);
CREATE INDEX IF NOT EXISTS idx_data_access_log_table_name ON data_access_log(table_name);

-- Enable RLS on audit log
ALTER TABLE data_access_log ENABLE ROW LEVEL SECURITY;

-- Audit log policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'data_access_log' 
    AND policyname = 'Service role can view audit logs'
  ) THEN
    CREATE POLICY "Service role can view audit logs"
      ON data_access_log
      FOR SELECT
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'data_access_log' 
    AND policyname = 'Service role can insert audit logs'
  ) THEN
    CREATE POLICY "Service role can insert audit logs"
      ON data_access_log
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Function to log sensitive data access
CREATE OR REPLACE FUNCTION log_sensitive_access(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO data_access_log (user_id, table_name, record_id, action)
  VALUES (auth.uid(), p_table_name, p_record_id, p_action);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to log data access: %', SQLERRM;
END;
$$;

-- Add columns for encrypted CNPJ (keep old column for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cnpj_encrypted TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj_encrypted TEXT;

-- Migrate existing CNPJs to encrypted format
UPDATE users
SET cnpj_encrypted = encrypt_sensitive(cnpj)
WHERE cnpj IS NOT NULL AND cnpj_encrypted IS NULL;

UPDATE companies
SET cnpj_encrypted = encrypt_sensitive(cnpj)
WHERE cnpj IS NOT NULL AND cnpj_encrypted IS NULL;

-- Create views with decrypted data
CREATE OR REPLACE VIEW users_decrypted AS
SELECT 
  id,
  email,
  name,
  user_type,
  company_name,
  CASE 
    WHEN cnpj_encrypted IS NOT NULL 
    THEN decrypt_sensitive(cnpj_encrypted)
    ELSE cnpj
  END as cnpj,
  created_at,
  updated_at
FROM users;

CREATE OR REPLACE VIEW companies_decrypted AS
SELECT 
  id,
  user_id,
  name,
  CASE 
    WHEN cnpj_encrypted IS NOT NULL 
    THEN decrypt_sensitive(cnpj_encrypted)
    ELSE cnpj
  END as cnpj,
  created_at,
  updated_at
FROM companies;

-- Add data retention policy
CREATE TABLE IF NOT EXISTS data_retention_policy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT UNIQUE NOT NULL,
  retention_days INTEGER NOT NULL,
  last_cleanup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set retention policies (LGPD compliance)
INSERT INTO data_retention_policy (table_name, retention_days) VALUES
  ('transactions', 2555),      -- 7 years (legal requirement)
  ('data_access_log', 730),    -- 2 years
  ('chat_history', 365),       -- 1 year
  ('transaction_patterns', 1095) -- 3 years
ON CONFLICT (table_name) DO NOTHING;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(table_name TEXT, deleted_count BIGINT)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  policy RECORD;
  delete_count BIGINT;
BEGIN
  FOR policy IN SELECT * FROM data_retention_policy LOOP
    EXECUTE format(
      'DELETE FROM %I WHERE created_at < NOW() - INTERVAL ''%s days''',
      policy.table_name,
      policy.retention_days
    );
    
    GET DIAGNOSTICS delete_count = ROW_COUNT;
    
    UPDATE data_retention_policy
    SET last_cleanup_at = NOW()
    WHERE id = policy.id;
    
    table_name := policy.table_name;
    deleted_count := delete_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Create anonymization function for analytics (LGPD Art. 12)
CREATE OR REPLACE FUNCTION anonymize_transaction_data(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE(
  month TEXT,
  category TEXT,
  avg_amount NUMERIC,
  transaction_count BIGINT
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date, 'YYYY-MM') as month,
    t.category,
    ROUND(AVG(t.amount), 2) as avg_amount,
    COUNT(*)::BIGINT as transaction_count
  FROM transactions t
  WHERE t.date BETWEEN start_date AND end_date
  GROUP BY TO_CHAR(date, 'YYYY-MM'), t.category
  ORDER BY month, category;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION encrypt_sensitive(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_sensitive(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_sensitive_access(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION anonymize_transaction_data(DATE, DATE) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION encrypt_sensitive IS 'Encrypts sensitive data using AES-256';
COMMENT ON FUNCTION decrypt_sensitive IS 'Decrypts sensitive data';
COMMENT ON FUNCTION log_sensitive_access IS 'Logs access to sensitive data for LGPD compliance';
COMMENT ON FUNCTION cleanup_old_data IS 'Removes data older than retention policy (run via cron)';
COMMENT ON FUNCTION anonymize_transaction_data IS 'Returns anonymized transaction data for analytics';
COMMENT ON TABLE data_access_log IS 'Audit trail for sensitive data access (LGPD Art. 37)';
COMMENT ON TABLE data_retention_policy IS 'Data retention policies per table (LGPD Art. 15)';

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================

-- Verificar se tudo foi criado corretamente
DO $$
DECLARE
  result TEXT;
BEGIN
  -- Verificar tabelas
  SELECT string_agg(tablename, ', ') INTO result
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('transaction_patterns', 'encryption_keys', 'data_access_log', 'data_retention_policy');
  
  RAISE NOTICE 'Tabelas criadas: %', result;
  
  -- Verificar funções
  SELECT string_agg(proname, ', ') INTO result
  FROM pg_proc 
  WHERE proname IN ('encrypt_sensitive', 'decrypt_sensitive', 'log_sensitive_access', 'cleanup_old_data', 'anonymize_transaction_data');
  
  RAISE NOTICE 'Funções criadas: %', result;
  
  RAISE NOTICE '✅ Migration concluída com sucesso!';
END $$;

-- ============================================================================
-- PÓS-EXECUÇÃO
-- ============================================================================
-- 
-- 1. Verifique o output acima - deve mostrar todas as tabelas e funções criadas
-- 2. Teste a criptografia:
--    SELECT encrypt_sensitive('12345678901234');
--    SELECT decrypt_sensitive(encrypt_sensitive('12345678901234'));
--
-- 3. Configure cron job para executar mensalmente:
--    SELECT * FROM cleanup_old_data();
--
-- 4. IMPORTANTE: Em produção, mova a encryption key para Vault/KMS!
-- ============================================================================
