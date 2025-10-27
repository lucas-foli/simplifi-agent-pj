-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key table (store key separately in production!)
-- For production: Use Vault or AWS KMS instead
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL, -- Should be rotated regularly
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rotated_at TIMESTAMP WITH TIME ZONE
);

-- Insert master key (IMPORTANT: In production, manage this securely!)
-- This is a placeholder - rotate immediately in production
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
  
  -- Get encryption key
  SELECT key_value INTO encryption_key
  FROM encryption_keys
  WHERE key_name = 'master_key';
  
  -- Encrypt using AES-256
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
  
  -- Get encryption key
  SELECT key_value INTO encryption_key
  FROM encryption_keys
  WHERE key_name = 'master_key';
  
  -- Decrypt
  RETURN pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't expose details
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
  action TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create index for audit queries
CREATE INDEX idx_data_access_log_user_id ON data_access_log(user_id);
CREATE INDEX idx_data_access_log_accessed_at ON data_access_log(accessed_at);
CREATE INDEX idx_data_access_log_table_name ON data_access_log(table_name);

-- Enable RLS on audit log
ALTER TABLE data_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs (for now, users can't see their own audit trail)
-- In production, consider allowing users to see their own access logs
CREATE POLICY "Service role can view audit logs"
  ON data_access_log
  FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can insert audit logs"
  ON data_access_log
  FOR INSERT
  WITH CHECK (true); -- Anyone can create audit logs

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
    -- Don't fail the main operation if logging fails
    RAISE WARNING 'Failed to log data access: %', SQLERRM;
END;
$$;

-- Add column for encrypted CNPJ to profiles (keep old column for migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cnpj_encrypted TEXT;

-- Migrate existing CNPJs to encrypted format
UPDATE profiles
SET cnpj_encrypted = encrypt_sensitive(cnpj)
WHERE cnpj IS NOT NULL AND cnpj_encrypted IS NULL;

-- Create view with decrypted data for application use
-- This view automatically decrypts when accessed through RLS
CREATE OR REPLACE VIEW users_decrypted AS
SELECT 
  id,
  email,
  full_name as name,
  user_type,
  company_name,
  monthly_income,
  CASE 
    WHEN cnpj_encrypted IS NOT NULL 
    THEN decrypt_sensitive(cnpj_encrypted)
    ELSE cnpj
  END as cnpj,
  created_at,
  updated_at
FROM profiles;

-- Note: companies_decrypted view removed - no companies table exists
-- If you need companies in the future, create the table first

-- Enable RLS on views (inherit from base tables)
-- Note: Views inherit RLS from underlying tables

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
  ('transactions', 2555),      -- 7 years (legal requirement for financial data)
  ('data_access_log', 730),    -- 2 years
  ('chat_history', 365),       -- 1 year
  ('transaction_patterns', 1095) -- 3 years
ON CONFLICT (table_name) DO NOTHING;

-- Function to cleanup old data (should be called by cron job)
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
    
    -- Update last cleanup time
    UPDATE data_retention_policy
    SET last_cleanup_at = NOW()
    WHERE id = policy.id;
    
    -- Return results
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
