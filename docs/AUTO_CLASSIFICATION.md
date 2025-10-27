# Classificação Automática de Transações

## Visão Geral

Sistema inteligente que sugere automaticamente a categoria de uma transação com base na sua descrição. O sistema aprende com o comportamento do usuário e melhora a precisão ao longo do tempo.

## Como Funciona

### 1. Métodos de Classificação (Ordem de Prioridade)

O sistema tenta classificar a transação usando os seguintes métodos, em ordem:

#### a) Padrões Salvos (Maior Prioridade)
- Busca em padrões previamente aprendidos do usuário
- **Confiança**: 99% para match exato, 85% para match parcial
- Aumenta a confiança automaticamente a cada uso

#### b) Histórico de Transações
- Analisa transações passadas do usuário
- Busca descrições similares ou palavras-chave em comum
- **Confiança**: 95% (exato), 85% (parcial), 75% (palavras)

#### c) Keywords (Palavras-chave)
- Usa dicionário pré-definido de palavras relacionadas a categorias
- **Confiança**: 70%
- Cobre casos comuns como "mercado" → Alimentação

#### d) Inteligência Artificial (Fallback)
- Usa OpenAI GPT-4o-mini quando outros métodos falham ou têm baixa confiança
- **Confiança**: 80%
- Requer `OPENAI_API_KEY` configurada

#### e) Categoria Padrão
- Se nenhum método funcionar, sugere "Outros"
- **Confiança**: 30%

### 2. Sistema de Aprendizado

#### Como o Sistema Aprende

Toda vez que o usuário adiciona uma transação, o sistema:

1. **Salva o padrão** (descrição → categoria)
2. **Incrementa contador** se o padrão já existe
3. **Aumenta confiança** em 5% a cada uso (máximo 99%)

#### Estrutura dos Padrões

```typescript
{
  description_pattern: string;  // Descrição normalizada (lowercase, trim)
  category: string;              // Categoria escolhida
  confidence: number;            // Nível de confiança (0.0 a 0.99)
  usage_count: number;           // Quantas vezes foi usado
}
```

#### Exemplo de Aprendizado

```
1ª vez: "Mercado Extra" → Alimentação
  - Padrão criado com 70% de confiança

2ª vez: "Mercado Extra" → Alimentação  
  - Confiança aumenta para 75%
  - Contador incrementado para 2

5ª vez: "Mercado Extra" → Alimentação
  - Confiança chega a 90%
  - Sistema fica cada vez mais preciso
```

### 3. Correção de Sugestões

Se o usuário **corrigir** uma sugestão:

1. Sistema salva o novo mapeamento
2. Na próxima vez, sugerirá a categoria correta
3. Confiança inicia em 70% e aumenta com uso

**Exemplo:**
```
1. Sistema sugere: "Uber" → Transporte
2. Usuário muda para: "Uber" → Lazer (foi viagem de lazer)
3. Próxima vez: Sistema sugere "Uber" → Lazer
```

## Como Usar

### No Formulário de Transação

1. Digite a descrição da transação
2. Clique no botão **✨ Sugerir Categoria**
3. Sistema preenche automaticamente a categoria
4. Mostra nível de confiança e origem da sugestão
5. Você pode aceitar ou alterar manualmente

### Indicadores Visuais

```
Sugestão: Alimentação (85% de confiança) - baseado no seu histórico
Sugestão: Transporte (70% de confiança) - sugerido por IA
```

## Arquitetura Técnica

### Edge Functions

#### `classify-transaction`
**Responsável por**: Classificar transação

**Input:**
```typescript
{
  description: string;
  userId: string;
  amount?: number;
}
```

**Output:**
```typescript
{
  category: string;
  confidence: number;
  source: 'keyword' | 'history' | 'ai';
}
```

#### `save-transaction-pattern`
**Responsável por**: Salvar/atualizar padrões de aprendizado

**Input:**
```typescript
{
  description: string;
  category: string;
  userId: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  pattern: TransactionPattern;
}
```

### Banco de Dados

#### Tabela: `transaction_patterns`

```sql
CREATE TABLE transaction_patterns (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  description_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  usage_count INTEGER NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(user_id, description_pattern)
);
```

## Melhorando a Precisão

### Dicas para o Usuário

1. **Seja consistente** nas descrições
   - ✅ Sempre "Mercado Extra"
   - ❌ Variações: "Extra", "Mercado", "Extra Supermercado"

2. **Use descrições específicas**
   - ✅ "Restaurante Italiano"
   - ❌ "Almoço"

3. **Corrija sugestões erradas**
   - Sistema aprenderá com suas correções

4. **Aceite sugestões corretas**
   - Aumenta confiança do sistema

### Para Desenvolvedores

1. **Adicionar keywords** para novas categorias
   - Edite `CATEGORY_KEYWORDS` em `classify-transaction/index.ts`

2. **Ajustar níveis de confiança**
   - Modifique valores em cada função de classificação

3. **Melhorar prompt da IA**
   - Edite função `classifyWithAI()` para contexto mais específico

4. **Treinar com dados históricos**
   - Rode script de migração para popular `transaction_patterns`

## Monitoramento

### Métricas Importantes

- Taxa de aceitação de sugestões
- Confiança média das classificações
- Distribuição de fontes (pattern/history/keyword/ai)
- Tempo médio de classificação

### Logs

```javascript
// Todas as classificações são logadas
console.log('Classification result:', {
  description,
  category: result.category,
  confidence: result.confidence,
  source: result.source,
});
```

## Troubleshooting

### Sugestões com baixa confiança

**Causa**: Pouco histórico ou descrição ambígua
**Solução**: Continue usando e corrigindo, sistema melhorará

### IA não está sendo usada

**Causa**: `OPENAI_API_KEY` não configurada
**Solução**: Configure a chave nas variáveis de ambiente do Supabase

### Padrão não está sendo salvo

**Causa**: RLS policies ou erro na Edge Function
**Solução**: Verifique logs da função `save-transaction-pattern`

### Classificação incorreta persistente

**Causa**: Padrão antigo com alta confiança
**Solução**: Delete o padrão incorreto ou force nova categoria várias vezes

## Roadmap Futuro

- [ ] Dashboard de aprendizado (mostrar padrões salvos)
- [ ] Permitir edição manual de padrões
- [ ] Sugestão de múltiplas categorias com probabilidades
- [ ] Machine Learning local (sem depender de API externa)
- [ ] Análise de contexto temporal (ex: "jantar" à noite vs. meio-dia)
- [ ] Compartilhamento de padrões entre usuários (opt-in)

## Segurança & Privacidade

- ✅ Todos os padrões são isolados por usuário (RLS)
- ✅ Dados nunca são compartilhados entre usuários
- ✅ IA processa apenas descrição e valor (sem dados pessoais)
- ✅ Padrões são deletados quando usuário é removido (CASCADE)

---

**Última atualização**: Janeiro 2024
**Versão**: 1.0.0
