# 🧪 Guia de Testes do Chat Assistant

## 🔍 Como saber se está usando OpenAI API (IA Real)

### **Método 1: Ver nos Logs (Recomendado)**

Acesse os logs no dashboard:
```
https://supabase.com/dashboard/project/yzbnxpxvqliizptozfgk/functions/chat-assistant/logs
```

**O que procurar:**
- ✅ Se estiver usando OpenAI, vai aparecer chamadas para `api.openai.com`
- ✅ Vai mostrar o `model: gpt-4o-mini` nos logs
- ❌ Se estiver usando fallback, não vai aparecer chamadas externas

### **Método 2: Inspecionar a Resposta**

Abra o DevTools (F12) no navegador → Network → Envie uma mensagem

Procure pela requisição para:
```
https://yzbnxpxvqliizptozfgk.supabase.co/functions/v1/chat-assistant
```

Na resposta, veja o campo `metadata`:

**Se estiver usando OpenAI:**
```json
{
  "message": "...",
  "metadata": {
    "type": "ai_response",
    "model": "gpt-4o-mini"  // ← AQUI!
  }
}
```

**Se estiver usando fallback (simulado):**
```json
{
  "metadata": {
    "type": "balance_query"  // ou "expenses_query", "default"
  }
}
```

### **Método 3: Testar perguntas complexas**

A IA real consegue responder perguntas mais complexas que o fallback não consegue:

**Teste com:**
- "Me dê 3 dicas de economia baseadas nos meus gastos"
- "Analise meu padrão de gastos e me dê insights"
- "Como posso economizar R$ 500 este mês?"

Se responder com inteligência e contexto, é a IA real! 🤖

---

## 📝 Como Editar o Prompt

### **Passo 1: Editar o arquivo de prompt**

Abra o arquivo:
```
supabase/functions/chat-assistant/prompt.ts
```

### **Passo 2: Modificar o prompt (linha 17-42)**

Exemplo de customização:

```typescript
export function buildSystemPrompt(context: FinancialContext): string {
  return `Você é Maria, a assistente financeira da SimplifiQA. Você é amigável e usa emojis! 🎉

Contexto financeiro (mês atual):
- 💰 Receita: R$ ${context.monthlyIncome.toFixed(2)}
- 📊 Custos fixos: R$ ${context.fixedCosts.toFixed(2)}
- 💸 Gastos: R$ ${context.totalExpenses.toFixed(2)}
- 🎯 Saldo: R$ ${context.balance.toFixed(2)}

Últimas transações:
${context.recentTransactions.map(tx => `- ${tx.description}: R$ ${tx.amount.toFixed(2)} (${tx.category})`).join('\n')}

PERSONALIDADE:
- Use linguagem informal e amigável
- Use emojis para deixar as mensagens mais leves
- Seja encorajadora quando o usuário estiver economizando
- Seja empática (não julgue) quando o usuário estiver gastando muito

REGRAS:
1. Sempre responda em português brasileiro
2. Use formato de moeda brasileiro (R$ X.XXX,XX)
3. Dê conselhos práticos e acionáveis
4. Se o saldo estiver negativo, sugira soluções concretas
5. Elogie progressos, mesmo que pequenos`;
}
```

### **Passo 3: Ajustar configurações da IA (linha 45-50)**

```typescript
export const AI_CONFIG = {
  model: 'gpt-4o-mini', // Opções: 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4o-mini'
  temperature: 0.7, // 0 = mais consistente, 1 = mais criativo
  maxTokens: 500, // Máximo de tokens na resposta
};
```

**Modelos disponíveis:**
- `gpt-4o-mini` - Rápido e barato (~$0.0001/msg) ✅ Recomendado
- `gpt-4o` - Mais inteligente, mais caro (~$0.003/msg)
- `gpt-3.5-turbo` - Mais barato, menos inteligente (~$0.00005/msg)

**Temperature:**
- `0.0-0.3` = Mais determinístico, consistente
- `0.4-0.7` = Balanceado ✅ Recomendado
- `0.8-1.0` = Mais criativo, variado

### **Passo 4: Deploy das mudanças**

```bash
supabase functions deploy chat-assistant
```

Pronto! Em ~10 segundos a nova versão estará online. ⚡

---

## 🧪 Sugestões de Testes

### **Teste 1: Perguntas básicas**
- "Qual meu saldo?"
- "Quanto gastei este mês?"
- "Qual minha receita?"

**Espera-se:** Resposta com valores corretos do banco de dados

### **Teste 2: Análises complexas**
- "Analise meus gastos e me dê 3 dicas"
- "Estou gastando muito com alguma categoria?"
- "Como posso economizar R$ 1000 este mês?"

**Espera-se:** Análise inteligente baseada nos dados reais

### **Teste 3: Contexto financeiro**
- "Vou conseguir economizar este mês?"
- "Meu saldo está bom?"
- "Devo me preocupar com algum gasto?"

**Espera-se:** Resposta contextualizada com a situação financeira

### **Teste 4: Ações sugeridas**
- Pergunte algo e veja se aparecem botões de ação
- Exemplo: "Quanto gastei?" → Deve sugerir "Ver Transações"

**Espera-se:** Botões clicáveis para navegar

---

## 💰 Monitorar Custos

### **Ver uso da OpenAI:**
```
https://platform.openai.com/usage
```

### **Estimativa de custos:**
- GPT-4o-mini: ~$0.0001 por mensagem
- 100 mensagens/dia = ~$0.01/dia = ~$3/ano
- 1000 mensagens/dia = ~$0.10/dia = ~$36/ano

Muito barato! 🎉

---

## 🛠️ Troubleshooting

### **"Erro ao processar mensagem"**
1. Veja os logs no Supabase
2. Verifique se a API key está configurada
3. Verifique se o usuário tem dados financeiros cadastrados

### **Resposta muito genérica**
- Verifique se há transações cadastradas no banco
- Edite o prompt para ser mais específico
- Aumente a temperature (0.7 → 0.9)

### **Resposta muito longa**
- Reduza `maxTokens` (500 → 300)
- Adicione no prompt: "Seja conciso, máximo 2 parágrafos"

### **Custo muito alto**
- Troque `gpt-4o` por `gpt-4o-mini`
- Reduza `maxTokens`
- Adicione cache de respostas comuns

---

## 📚 Exemplos de Prompts Customizados

### **Exemplo 1: Assistente Formal**
```typescript
return `Você é o consultor financeiro SimplifiQA.
Use linguagem formal e profissional.
Dirija-se ao usuário como "senhor(a)".
Forneça análises detalhadas e fundamentadas.`;
```

### **Exemplo 2: Assistente Motivacional**
```typescript
return `Você é o coach financeiro SimplifiQA! 💪
Sua missão é MOTIVAR o usuário a alcançar suas metas!
Use linguagem energética e encorajadora.
Comemore cada vitória, por menor que seja!
Transforme desafios em oportunidades de crescimento!`;
```

### **Exemplo 3: Assistente Técnico**
```typescript
return `Você é o analista financeiro SimplifiQA.
Forneça análises quantitativas detalhadas.
Use percentuais, médias e comparações.
Sugira otimizações baseadas em dados concretos.`;
```

---

**Pronto para testar?** 🚀

1. Abra o app em `/chat`
2. Faça perguntas
3. Veja os logs no Supabase
4. Ajuste o prompt conforme necessário
5. Deploy e teste novamente!
