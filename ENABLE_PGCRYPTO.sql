-- ============================================================================
-- STEP 1: HABILITAR PGCRYPTO
-- Execute SOMENTE este arquivo PRIMEIRO
-- ============================================================================

-- Verificar se pgcrypto está disponível
SELECT * FROM pg_available_extensions WHERE name = 'pgcrypto';

-- Habilitar pgcrypto (se disponível)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verificar se foi instalado
SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';

-- Testar se as funções do pgcrypto estão disponíveis
SELECT 
  proname 
FROM pg_proc 
WHERE proname IN ('pgp_sym_encrypt', 'pgp_sym_decrypt', 'gen_random_bytes')
ORDER BY proname;

-- Se você ver as 3 funções acima, está OK! 
-- Caso contrário, o pgcrypto não está disponível no seu plano Supabase
