# Edge Functions - FinSight

Este diretório contém as Edge Functions do Supabase para o FinSight Agent.

## 📋 Funções Disponíveis

### 1. `chat-assistant`
Assistente de chat com IA que responde perguntas sobre finanças do usuário.

**Recursos:**
- ✅ Integração com qualquer modelo LLM
- ✅ Context-aware: busca dados financeiros do usuário automaticamente
- ✅ Fallback para respostas simuladas se API key não estiver configurada
- ✅ Sugestões de ações (navegar para dashboard, transações, etc.)

### 2. `send-whatsapp-message`
Integração com a API Oficial do WhatsApp (Meta) para disparo de mensagens de texto ou templates aprovados.

**Recursos:**
- ✅ Envia mensagens de texto simples
- ✅ Suporte a templates com variáveis (`body`)
- ✅ Normaliza o número para o formato aceito pela API (remove `+`)
- ✅ Limita a 20 envios/minuto por usuário para evitar floods

**Variáveis de ambiente necessárias:**

```
META_WHATSAPP_TOKEN=EAAG...
META_WHATSAPP_PHONE_NUMBER_ID=1234567890
# Opcional (default v20.0)
META_WHATSAPP_API_VERSION=v20.0
```

> Configure as chaves em **Settings → Edge Functions → Environment Variables** no dashboard do Supabase.

**Exemplo de payload (via Supabase Client):**

```ts
const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
  body: {
    userId: '<UUID-do-usuário>',
    to: '5511999999999',
    message: 'Olá! Seu fechamento mensal está pronto. 📊',
  },
});
```

**Exemplo com template aprovado:**

```ts
await supabase.functions.invoke('send-whatsapp-message', {
  body: {
    userId: '<UUID>',
    to: '5511999999999',
    type: 'template',
    template: {
      name: 'resumo_financeiro',
      languageCode: 'pt_BR',
      variables: ['Lucas', 'R$ 5.420,00'],
    },
  },
});
```

### 3. `whatsapp-webhook`
Webhook para receber mensagens do WhatsApp (Meta Cloud API), registrar no histórico e sincronizar transações.

**Recursos:**
- ✅ Verificação de webhook (`GET`)
- ✅ Recebe mensagens de texto
- ✅ Vincula número via código de pareamento
- ✅ Registra mensagens em `conversations` e `messages`
- ✅ Tenta registrar transação automaticamente

**Variáveis de ambiente necessárias:**

```
META_WHATSAPP_TOKEN=EAAG...
META_WHATSAPP_PHONE_NUMBER_ID=1234567890
META_WHATSAPP_APP_SECRET=seu-app-secret
META_WHATSAPP_VERIFY_TOKEN=seu-token-de-verificacao
```

**Configuração do webhook (Meta):**
- URL: `https://<seu-projeto>.functions.supabase.co/whatsapp-webhook`
- Verify Token: mesmo valor de `META_WHATSAPP_VERIFY_TOKEN`

### 4. `whatsapp-link`
Gera um código de pareamento para vincular o WhatsApp do usuário ao app.

**Exemplo de uso (frontend):**

```ts
const { data, error } = await supabase.functions.invoke('whatsapp-link', {
  body: { companyId: '<UUID-opcional>' },
});
```

## 🚀 Como fazer Deploy

### Pré-requisitos
1. Instalar Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Login no Supabase:
```bash
supabase login
```

3. Link com seu projeto:
```bash
supabase link --project-ref <SEU_PROJECT_REF>
```

### Deploy da Function

```bash
# Deploy da função chat-assistant
supabase functions deploy chat-assistant

# Ou deploy de todas as funções
supabase functions deploy
```

### Configurar Variáveis de Ambiente

No dashboard do Supabase (Settings > Edge Functions), adicione:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Opcional:** Se quiser usar outro modelo de IA (Anthropic Claude, etc.), basta modificar a função `callOpenAI` no código.

## 🧪 Como Testar Localmente

### 1. Iniciar Supabase local
```bash
supabase start
```

### 2. Servir a função localmente
```bash
supabase functions serve chat-assistant --env-file supabase/.env.local
```

### 3. Criar arquivo `.env.local` com suas chaves:
```bash
# supabase/.env.local
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<sua-key-local>
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

### 4. Testar com curl:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/chat-assistant' \
  --header 'Authorization: Bearer <ANON_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"message":"Qual meu saldo?","userId":"<UUID_DO_USER>"}'
```

## 📝 Estrutura de Requisição

### Request
```json
{
  "message": "Quanto gastei este mês?",
  "userId": "uuid-do-usuario"
}
```

### Response
```json
{
  "message": "Você gastou R$ 1.302,90 este mês, distribuídos em: Alimentação (R$ 222,90), Transporte (R$ 80,00)...",
  "metadata": {
    "type": "expenses_query",
    "model": "gpt-4o-mini"
  },
  "actions": [
    {
      "label": "Ver Transações",
      "action": "navigate",
      "data": "/transactions"
    }
  ]
}
```

## 🔑 Configuração de API Keys

### OpenAI
1. Criar conta em https://platform.openai.com
2. Criar API key
3. Adicionar no Supabase: `OPENAI_API_KEY`

**Custo estimado:** ~$0.0001 por mensagem (GPT-4o-mini)

### Anthropic Claude (alternativa)
Modifique a função `callOpenAI` para chamar a API da Anthropic:
```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    messages: [{ role: 'user', content: message }],
    system: systemPrompt,
    max_tokens: 500,
  }),
});
```

## 💰 Custos

### Supabase Edge Functions
- ✅ **2 milhões de invocações grátis/mês**
- Depois: $2/milhão de invocações


### Alternativas Grátis
Se não quiser pagar, a função já tem **fallback para respostas simuladas** baseadas em keywords!

## 🛠️ Troubleshooting

### Erro: "Failed to invoke function"
- Verifique se a função foi deployed: `supabase functions list`
- Verifique logs: `supabase functions logs chat-assistant`

### Erro: "OPENAI_API_KEY not found"
- A função usará fallback para respostas simuladas
- Configure a API key no dashboard do Supabase

### Respostas genéricas mesmo com API key
- Verifique se o usuário tem dados financeiros cadastrados
- Verifique logs da função para ver o contexto sendo enviado

## 📚 Próximas Funções

- [ ] `classify-transaction` - Classificação automática de despesas
- [x] `whatsapp-webhook` - Webhook para WhatsApp (Meta Cloud API)
- [x] `whatsapp-link` - Pareamento de números via código
- [ ] `generate-forecast` - Previsão de gastos futuros
- [ ] `generate-report` - Geração de relatórios PDF

## 🔗 Links Úteis

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Deno Deploy Docs](https://deno.com/deploy)
