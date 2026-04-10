# Criptografia de Dados Sensíveis

## Visão Geral

A aplicação FinSight implementa criptografia AES-256 para proteger dados sensíveis (CNPJ) em conformidade com LGPD/GDPR.

## Arquitetura

### Dados Criptografados
- **users.cnpj_encrypted** - CNPJ criptografado dos usuários
- **companies.cnpj_encrypted** - CNPJ criptografado das empresas

### Funções de Criptografia

#### `encrypt_sensitive(data TEXT)`
Criptografa dados usando AES-256 via pgcrypto.

```sql
SELECT encrypt_sensitive('12.345.678/0001-90');
-- Retorna: "ww0EBwMC...base64..."
```

#### `decrypt_sensitive(encrypted_data TEXT)`
Descriptografa dados.

```sql
SELECT decrypt_sensitive('ww0EBwMC...');
-- Retorna: "12.345.678/0001-90"
```

### Views Descriptografadas

Para facilitar o acesso aos dados, existem views que descriptografam automaticamente:

- **users_decrypted** - Usuários com CNPJ descriptografado
- **companies_decrypted** - Empresas com CNPJ descriptografado

```sql
-- Usar a view ao invés da tabela diretamente
SELECT * FROM users_decrypted WHERE id = 'user-id';
```

## Uso na Aplicação

### Frontend (React)

O hook `useAuth` já está configurado para:

1. **Buscar dados**: Usa `users_decrypted`
2. **Inserir/Atualizar**: Criptografa CNPJ com `encrypt_sensitive()`

```typescript
// Exemplo de update
const { data: encryptedCnpj } = await supabase.rpc('encrypt_sensitive', {
  data: '12.345.678/0001-90'
});

await supabase.from('users').update({
  cnpj_encrypted: encryptedCnpj
});
```

### Backend (Edge Functions)

Use as views descriptografadas:

```typescript
const { data } = await supabase
  .from('users_decrypted')
  .select('*')
  .eq('id', userId)
  .single();

// data.cnpj já está descriptografado
```

## Gerenciamento de Chaves

### Localização das Chaves

1. **Supabase Vault**: `vault.decrypted_secrets` → `encryption_key`
2. **Tabela**: `encryption_keys` → `master_key`

### Backup das Chaves

⚠️ **CRÍTICO**: Faça backup das chaves em local seguro!

```sql
-- Visualizar chaves (APENAS em ambiente seguro)
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'encryption_key';
SELECT key_value FROM encryption_keys WHERE key_name = 'master_key';
```

**Locais de backup:**
- Arquivo `.env` (não versionado)
- Gerenciador de senhas (1Password, LastPass, etc.)
- Vault seguro da empresa

### Rotação de Chaves

Para rotacionar chaves (recomendado anualmente):

```sql
-- 1. Criar nova chave
INSERT INTO encryption_keys (key_name, key_value)
VALUES ('master_key_v2', encode(gen_random_bytes(32), 'hex'));

-- 2. Descriptografar com chave antiga e criptografar com nova
-- (Script de migração necessário)

-- 3. Atualizar funções para usar nova chave
-- 4. Remover chave antiga após confirmação
```

## Políticas de Retenção

### Dados que NUNCA são deletados
- `users` (perfil do usuário)
- `companies` (empresas)
- `transactions` (transações financeiras)
- `chat_history` (histórico de conversas)
- `fixed_costs` (custos fixos)
- `monthly_income` (renda mensal)

### Dados com limpeza automática
- `data_access_log`: 730 dias (2 anos)
- `transaction_patterns`: 1095 dias (3 anos)

### Job de Limpeza

Executa mensalmente (dia 1 às 3h):

```sql
-- Ver status do job
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-data';

-- Executar manualmente
SELECT * FROM cleanup_old_data();
```

## Auditoria (LGPD Compliance)

Todos os acessos a dados sensíveis são registrados:

```sql
-- Log de acesso
SELECT * FROM data_access_log 
WHERE user_id = 'user-id' 
ORDER BY accessed_at DESC;
```

### Função de Log

```sql
SELECT log_sensitive_access(
  'users',           -- tabela
  'user-id',         -- ID do registro
  'READ'             -- ação (READ, UPDATE, DELETE, EXPORT)
);
```

## Troubleshooting

### Erro: "function pgp_sym_encrypt does not exist"

1. Verificar se pgcrypto está instalado:
```sql
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```

2. Instalar se necessário:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Erro: "search_path" impedindo acesso às funções

Remova restrições de `search_path` nas funções:

```sql
CREATE OR REPLACE FUNCTION encrypt_sensitive(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ ... $$;
```

### CNPJ não está sendo criptografado

1. Verificar console do browser (F12)
2. Testar função manualmente:
```sql
SELECT encrypt_sensitive('test');
```
3. Verificar permissões:
```sql
GRANT EXECUTE ON FUNCTION encrypt_sensitive(TEXT) TO authenticated;
```

## Segurança

### Boas Práticas

✅ **FAZER:**
- Usar views descriptografadas (`users_decrypted`)
- Fazer backup regular das chaves
- Logar acessos a dados sensíveis
- Rotacionar chaves anualmente
- Usar HTTPS em produção

❌ **NÃO FAZER:**
- Commitar chaves no Git
- Expor chaves em logs
- Compartilhar chaves por canais inseguros
- Usar mesma chave em dev/prod
- Descriptografar dados desnecessariamente

## Conformidade

### LGPD (Lei Geral de Proteção de Dados)
- ✅ Art. 18, I - Direito de acesso aos dados
- ✅ Art. 18, III - Correção de dados
- ✅ Art. 18, V - Portabilidade de dados
- ✅ Art. 18, VI - Eliminação de dados
- ✅ Art. 46 - Medidas de segurança técnicas

### GDPR (General Data Protection Regulation)
- ✅ Article 15 - Right of access
- ✅ Article 16 - Right to rectification
- ✅ Article 17 - Right to erasure
- ✅ Article 20 - Right to data portability
- ✅ Article 32 - Security of processing

## Contato

Para questões sobre criptografia ou segurança, contate o time de desenvolvimento.
