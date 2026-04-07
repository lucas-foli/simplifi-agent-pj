# Guia de Segurança - FinSight

## Visão Geral

Este documento descreve as medidas de segurança implementadas na aplicação FinSight e as melhores práticas para manutenção e desenvolvimento seguro.

## 🔒 Medidas de Segurança Implementadas

### 1. Validação Server-Side (Input Validation)

**Status**: ✅ Implementado

Todas as Edge Functions utilizam validação robusta com Zod schemas:

#### Edge Functions Protegidas
- `chat-assistant`: Valida mensagem (1-5000 chars) e userId (UUID)
- `classify-transaction`: Valida descrição (1-500 chars), userId, e amount
- `save-transaction-pattern`: Valida descrição, categoria enum, e userId
- `validate-onboarding`: Valida email (RFC 5322), CNPJ (algoritmo oficial), senha forte

#### Schemas de Validação

```typescript
// Exemplos dos schemas implementados
- UUIDSchema: Valida formato UUID v4
- MessageSchema: 1-5000 caracteres, trimmed
- DescriptionSchema: 1-500 caracteres, trimmed
- CategorySchema: Enum com categorias fixas
- AmountSchema: Número positivo, finito, max 1M
- EmailSchema: RFC 5322 compliant
- PasswordSchema: Min 8 chars, maiúsc, minúsc, número, especial
```

**Localização**: `supabase/functions/_shared/validation.ts`

---

### 2. Rate Limiting

**Status**: ✅ Implementado

Proteção contra abuso de API e ataques DoS:

#### Limites por Edge Function
- `chat-assistant`: 20 requisições/minuto por usuário
- `classify-transaction`: 30 requisições/minuto por usuário
- `save-transaction-pattern`: 50 requisições/minuto por usuário

#### Características
- Rate limit por userId (isolado por usuário)
- Janela deslizante de 1 minuto
- Mensagem de erro informativa com tempo restante
- Limpeza automática de memória a cada 5 minutos

**Nota**: Implementação atual usa memória em Edge Function (reseta em cold start). Para produção em escala, considere migrar para Redis ou tabela Supabase.

---

### 3. Sanitização de Erros

**Status**: ✅ Implementado

Mensagens de erro sanitizadas para não expor detalhes internos:

#### Antes (❌ Inseguro)
```typescript
return { error: error.message } // Expõe stack traces, DB structure
```

#### Depois (✅ Seguro)
```typescript
// Cliente recebe apenas:
{ error: "An unexpected error occurred. Please try again later." }

// Servidor loga detalhes completos
console.error('Detailed error:', error.message, error.stack);
```

#### Erros Específicos Permitidos
- `ValidationError`: Mensagens de validação (seguro expor)
- `RateLimitError`: Informa tempo de espera
- Outros: Mensagem genérica

---

### 4. Row Level Security (RLS)

**Status**: ✅ Implementado

Todas as 8 tabelas têm RLS habilitado com policies user-scoped:

#### Tabelas Protegidas
1. `profiles` - Dados de usuário
2. `monthly_income` - Renda mensal
3. `fixed_costs` - Custos fixos
4. `transactions` - Transações financeiras
5. `chat_history` - Histórico de chat
6. `messages` - Mensagens (somente INSERT/SELECT)
7. `companies` - Empresas
8. `transaction_patterns` - Padrões aprendidos

#### Políticas
- `SELECT`: Apenas próprios dados (`auth.uid() = user_id`)
- `INSERT`: Apenas com próprio userId
- `UPDATE`: Apenas próprios registros
- `DELETE`: Apenas próprios registros (exceto messages*)

*Mensagens intencionalmente sem DELETE para integridade de conversação

---

### 6. SQL Injection Prevention

**Status**: ✅ Implementado

#### Supabase Client (✅ Seguro)
Todas as queries usam Supabase client com prepared statements:
```typescript
// ✅ Seguro - parametrizado
supabase.from('transactions').select('*').eq('user_id', userId);
```

Nenhuma raw SQL query no código frontend ou Edge Functions.

#### Database Functions
Funções SQL com `search_path` fixado para prevenir schema hijacking:

```sql
CREATE OR REPLACE FUNCTION update_transaction_patterns_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp  -- ✅ Protege contra SQL injection
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

---

### 7. CORS Configuration

**Status**: ✅ Implementado

Headers CORS configurados em todas Edge Functions:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // ⚠️ Amplo para dev
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Recomendação para Produção**: Restringir `Access-Control-Allow-Origin` ao domínio específico da aplicação.

---

### 8. Authentication & Authorization

**Status**: ✅ Implementado via Supabase Auth

#### Fluxo de Autenticação
1. **Signup**: Email/senha com validação forte
2. **Session Management**: JWT tokens via Supabase
3. **Client Storage**: `localStorage` (padrão Supabase)
4. **Protected Routes**: `ProtectedRoute` component

#### Validação de Senha
- Mínimo 8 caracteres
- Letra maiúscula obrigatória
- Letra minúscula obrigatória
- Número obrigatório
- Caractere especial obrigatório
- Score de força calculado (penaliza padrões comuns)

#### Validação de Email
- RFC 5322 compliant
- Detecção de domínios temporários
- Normalização (lowercase)

#### Validação de CNPJ
- Algoritmo oficial de validação
- Rejeita CNPJs com todos dígitos iguais
- Valida check digits

---

## 🚨 Vulnerabilidades Conhecidas & Mitigações

### 1. Client-Side Auth Storage (WARN)

**Vulnerabilidade**: Tokens JWT em `localStorage` são acessíveis via JavaScript (XSS risk).

**Mitigação Atual**: RLS no backend garante que mesmo com token roubado, usuário só acessa próprios dados.

**Recomendação Futura**: Migrar para `httpOnly` cookies para proteção adicional contra XSS.

**Nível de Risco**: 🟡 BAIXO (mitigado por RLS)

---

### 2. CORS Amplo (WARN)

**Vulnerabilidade**: `Access-Control-Allow-Origin: *` permite qualquer origem.

**Mitigação**: Todas as requests precisam de token válido (Supabase Auth).

**Recomendação**: Restringir a domínio específico em produção:
```typescript
'Access-Control-Allow-Origin': 'https://finsight.app',
```

**Nível de Risco**: 🟡 BAIXO (produção)

---

### 3. Rate Limit Memory-Based (INFO)

**Vulnerabilidade**: Rate limit em memória reseta em cold start de Edge Function.

**Impacto**: Atacante pode explorar cold starts para bypass temporário.

**Mitigação Futura**: Usar Redis ou tabela Supabase para persistência.

**Nível de Risco**: 🟢 MUITO BAIXO (apenas inconveniente)

---

## 📋 Checklist de Segurança para Produção

### Antes do Deploy

- [ ] Configurar `OPENAI_API_KEY` no Supabase
- [ ] Restringir CORS a domínio específico
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha ao cliente)
- [ ] Testar todas as políticas RLS
- [ ] Executar todas as migrations
- [ ] Verificar logs de segurança (SQL injection attempts, etc.)

### Pós-Deploy

- [ ] Monitorar rate limit hits
- [ ] Configurar alertas de erro (Sentry, etc.)
- [ ] Audit logs de acesso suspeito
- [ ] Backup regular do banco
- [ ] Teste de penetração básico

---

## 🛠️ Ferramentas de Segurança

### Análise Estática
- **Lovable Security Agent**: Análise automática no CI/CD
- **Supabase Database Linter**: Verifica best practices SQL

### Monitoramento
- **Supabase Logs**: Edge Function errors & performance
- **PostgreSQL Logs**: Queries suspeitas
- **Auth Logs**: Failed login attempts

---

## 🔐 Secrets Management

### Edge Functions
Todas as secrets são lidas de variáveis de ambiente Supabase:

```typescript
// ✅ Correto
const apiKey = Deno.env.get('OPENAI_API_KEY');

// ❌ NUNCA faça
const apiKey = 'sk-xxxxx'; // Hardcoded
```

### Deploy de Secrets
```bash
# Via Supabase CLI
supabase secrets set OPENAI_API_KEY=sk-xxxxx

# Ou via Dashboard
# Settings > Edge Functions > Secrets
```

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-security.html)
- [Zod Validation](https://zod.dev/)

---

## 🐛 Reportar Vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança, **NÃO** abra uma issue pública.

**Contato**: [Seu email de segurança]

Responderemos em até 48 horas.

---

**Última Atualização**: Janeiro 2024  
**Versão**: 2.0.0  
**Próxima Revisão**: Março 2024
