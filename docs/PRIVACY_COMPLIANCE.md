# Conformidade com LGPD/GDPR - FinSight

## 📋 Visão Geral

Este documento descreve como o FinSight está em conformidade com:
- **LGPD** (Lei Geral de Proteção de Dados - Brasil, Lei 13.709/2018)
- **GDPR** (General Data Protection Regulation - União Europeia)

## 🔐 Proteção de Dados Implementada

### 1. Criptografia de Dados Sensíveis

#### Dados Criptografados (AES-256)
- ✅ **CNPJ** (users.cnpj_encrypted, companies.cnpj_encrypted)
- ✅ Chaves de criptografia armazenadas separadamente
- ✅ Funções `encrypt_sensitive()` e `decrypt_sensitive()`

#### Dados Financeiros Protegidos por RLS
- Transações (valores, descrições, categorias)
- Renda mensal
- Custos fixos
- Padrões de transação

**Tecnologia**: PostgreSQL pgcrypto extension

**Artigos Relacionados**:
- LGPD Art. 46 (Segurança dos dados)
- GDPR Art. 32 (Security of processing)

---

### 2. Controle de Acesso (RLS - Row Level Security)

Todas as tabelas têm políticas RLS que garantem:
- Usuários só acessam seus próprios dados
- Isolamento completo entre usuários
- Políticas específicas para SELECT, INSERT, UPDATE, DELETE

**Tabelas Protegidas**: users, companies, transactions, fixed_costs, monthly_income, chat_history, transaction_patterns, data_access_log

**Artigos Relacionados**:
- LGPD Art. 46 (Princípio da segurança)
- GDPR Art. 32 (Security measures)

---

### 3. Auditoria de Acesso (Audit Trail)

#### Tabela: `data_access_log`

Registra automaticamente:
- ✅ Quem acessou dados sensíveis
- ✅ Quando acessou
- ✅ Qual tabela/registro foi acessado
- ✅ Tipo de ação (SELECT, INSERT, UPDATE, DELETE, EXPORT)
- ⚠️ IP address e user agent (opcional)

#### Função: `log_sensitive_access()`

```sql
SELECT log_sensitive_access('transactions', record_id, 'SELECT');
```

**Retenção**: 2 anos (730 dias)

**Artigos Relacionados**:
- LGPD Art. 37 (Responsabilização e prestação de contas)
- GDPR Art. 30 (Records of processing activities)

---

### 4. Retenção de Dados (Data Retention)

#### Tabela: `data_retention_policy`

| Tabela | Período de Retenção | Justificativa |
|--------|---------------------|---------------|
| transactions | 7 anos (2555 dias) | Obrigação legal fiscal |
| data_access_log | 2 anos (730 dias) | Auditoria LGPD |
| chat_history | 1 ano (365 dias) | Histórico operacional |
| transaction_patterns | 3 anos (1095 dias) | Aprendizado de máquina |

#### Função: `cleanup_old_data()`

```sql
-- Executar via cron job
SELECT * FROM cleanup_old_data();
```

**⚠️ IMPORTANTE**: Configurar cron job no Supabase para executar mensalmente.

**Artigos Relacionados**:
- LGPD Art. 15 (Término do tratamento)
- GDPR Art. 5 (1)(e) (Storage limitation)

---

### 5. Minimização de Dados (Data Minimization)

#### Dados NÃO coletados:
- ❌ CPF (pessoa física)
- ❌ Endereço residencial
- ❌ Dados biométricos
- ❌ Dados de saúde
- ❌ Orientação sexual, religião, político

#### Dados coletados apenas quando necessário:
- ✅ CNPJ (opcional, apenas para PJ)
- ✅ Email (autenticação)
- ✅ Nome (identificação básica)
- ✅ Dados financeiros (finalidade principal do app)

**Artigos Relacionados**:
- LGPD Art. 6º, III (Princípio da necessidade)
- GDPR Art. 5 (1)(c) (Data minimisation)

---

### 6. Anonimização para Analytics

#### Função: `anonymize_transaction_data()`

Retorna dados agregados SEM identificação de usuário:
- Média de gastos por categoria
- Contagem de transações por mês
- Sem user_id, sem descrições individuais

```sql
SELECT * FROM anonymize_transaction_data('2024-01-01', '2024-12-31');
```

**Uso**: Análises de produto, métricas de negócio

**Artigos Relacionados**:
- LGPD Art. 12 (Dados anonimizados)
- GDPR Recital 26 (Anonymous data)

---

### 7. Direitos do Titular (Data Subject Rights)

#### Implementado

| Direito | Artigo LGPD | Como exercer | Status |
|---------|-------------|--------------|--------|
| **Acesso** | Art. 18, I | Edge Function `gdpr-data-export` | ✅ |
| **Correção** | Art. 18, III | Update via app | ✅ |
| **Portabilidade** | Art. 18, V | Exportar JSON/CSV | ✅ |
| **Exclusão** | Art. 18, VI | Botão "Deletar Conta" | ⚠️ TODO |
| **Revogação de consentimento** | Art. 18, IX | Opt-out na configuração | ⚠️ TODO |
| **Oposição** | Art. 18, § 2º | Contato com DPO | ⚠️ Manual |

#### Edge Function: `gdpr-data-export`

Exporta TODOS os dados do usuário em formato machine-readable:

```typescript
// Request
POST /functions/v1/gdpr-data-export
{
  "userId": "uuid",
  "format": "json" | "csv"
}

// Response
{
  "export_date": "2024-01-25T...",
  "profile": {...},
  "transactions": [...],
  "companies": [...],
  "_metadata": {
    "rights": {
      "access": "You have the right...",
      "correction": "...",
      "deletion": "...",
      "portability": "..."
    }
  }
}
```

**Artigos Relacionados**:
- LGPD Art. 18 (Direitos do titular)
- GDPR Art. 15-22 (Rights of the data subject)

---

### 8. Consentimento e Transparência

#### Termo de Consentimento

⚠️ **TODO**: Implementar tela de consentimento no onboarding

**Deve incluir**:
- [ ] Finalidades do tratamento (gestão financeira, IA, analytics)
- [ ] Categorias de dados coletados
- [ ] Compartilhamento com terceiros (OpenAI para IA)
- [ ] Prazo de retenção
- [ ] Direitos do titular
- [ ] Contato do DPO (Data Protection Officer)
- [ ] Checkbox explícito de aceite

**Artigos Relacionados**:
- LGPD Art. 8º (Consentimento)
- LGPD Art. 9º (Forma do consentimento)
- GDPR Art. 7 (Conditions for consent)

---

### 9. Transferência Internacional de Dados

**Medidas de Proteção**:
- ✅ Dados financeiros são contextualizados (sem CPF/CNPJ enviados à IA)
- ✅ Apenas descrições de transações e valores agregados
- ⚠️ Necessário: Cláusulas contratuais padrão ou certificação adequada

**Recomendação**: Avaliar uso de modelo de IA local ou europeu.

**Artigos Relacionados**:
- LGPD Art. 33 (Transferência internacional)
- GDPR Art. 44-49 (International transfers)

---

## 🚧 Pendências de Implementação

### Alta Prioridade

1. **Botão "Deletar Conta"** (LGPD Art. 18, VI)
   - [ ] Interface de usuário
   - [ ] Edge Function para deleção completa
   - [ ] Cascade delete de todos os dados relacionados
   - [ ] Log de deleção para auditoria

2. **Termo de Consentimento** (LGPD Art. 8º)
   - [ ] Tela de onboarding com texto claro
   - [ ] Checkbox de aceite
   - [ ] Armazenamento de timestamp do consentimento
   - [ ] Versionamento do termo

3. **Política de Privacidade Pública**
   - [ ] Documento legal revisado por advogado
   - [ ] Link no footer e signup
   - [ ] Versionamento e histórico

### Média Prioridade

4. **DPO (Data Protection Officer)**
   - [ ] Nomear responsável (pode ser externo)
   - [ ] Email de contato: dpo@finsight.com
   - [ ] Processo para resposta a requisições (15 dias)

5. **Cron Job de Limpeza**
   - [ ] Configurar no Supabase
   - [ ] Executar `cleanup_old_data()` mensalmente
   - [ ] Alertas de falha

6. **Opt-out de Analytics**
   - [ ] Toggle nas configurações
   - [ ] Respeitar preferência na função de anonimização

### Baixa Prioridade

7. **Registro de Incidentes**
   - [ ] Tabela `security_incidents`
   - [ ] Processo para notificação de breach (72h)

8. **Migração de Chave de Criptografia**
   - [ ] Mover `encryption_keys` para Vault/KMS
   - [ ] Processo de rotação de chaves

---

## 📊 Checklist de Conformidade

### LGPD

| Artigo | Requisito | Status |
|--------|-----------|--------|
| Art. 6º, III | Minimização | ✅ |
| Art. 8º | Consentimento | ⚠️ Parcial |
| Art. 9º | Formato do consentimento | ⚠️ TODO |
| Art. 12 | Anonimização | ✅ |
| Art. 15 | Retenção | ✅ |
| Art. 18, I | Acesso | ✅ |
| Art. 18, III | Correção | ✅ |
| Art. 18, V | Portabilidade | ✅ |
| Art. 18, VI | Exclusão | ❌ TODO |
| Art. 33 | Transferência internacional | ⚠️ Avaliar |
| Art. 37 | Auditoria | ✅ |
| Art. 41 | DPO | ❌ TODO |
| Art. 46 | Segurança | ✅ |
| Art. 48 | Notificação de incidente | ⚠️ TODO |

### GDPR

| Artigo | Requisito | Status |
|--------|-----------|--------|
| Art. 5 | Princípios | ✅ Maioria |
| Art. 7 | Consentimento | ⚠️ Parcial |
| Art. 15 | Acesso | ✅ |
| Art. 17 | Deleção | ❌ TODO |
| Art. 20 | Portabilidade | ✅ |
| Art. 30 | Registro de atividades | ✅ |
| Art. 32 | Segurança | ✅ |
| Art. 33 | Notificação de breach | ⚠️ TODO |
| Art. 37 | DPO | ❌ TODO |
| Art. 44 | Transferências | ⚠️ Avaliar |

---

## 📞 Contatos

### Data Protection Officer (DPO)
**Email**: dpo@finsight.com *(configurar)*  
**Prazo de resposta**: 15 dias úteis

### Requisições de Titulares
- Acesso aos dados: Usar função de exportação no app
- Correção: Diretamente no app
- Exclusão: *(Implementar botão)*
- Outras: Contatar DPO

---

## 🔄 Manutenção e Revisão

### Frequência de Revisão
- **Mensal**: Executar `cleanup_old_data()`
- **Trimestral**: Revisar logs de auditoria
- **Semestral**: Revisar política de privacidade
- **Anual**: Audit de segurança completo

### Responsável
- **Tech Lead**: Implementação técnica
- **DPO**: Conformidade legal
- **CEO**: Responsabilidade final

---

**Última Atualização**: Janeiro 2024  
**Versão**: 1.0.0  
**Próxima Revisão**: Abril 2024

**⚖️ IMPORTANTE**: Este documento não substitui orientação jurídica profissional. Consulte um advogado especializado em privacidade de dados antes de ir para produção.
