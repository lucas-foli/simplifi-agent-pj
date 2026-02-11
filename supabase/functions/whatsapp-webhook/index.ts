import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.45.1';
import { buildSystemPrompt, AI_CONFIG, type FinancialContext } from '../chat-assistant/prompt.ts';
import { checkRateLimit, createErrorResponse } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const token = Deno.env.get('META_WHATSAPP_TOKEN');
const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
const apiVersion = Deno.env.get('META_WHATSAPP_API_VERSION') ?? 'v20.0';
const verifyToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN');
const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET');

if (!token || !phoneNumberId) {
  console.warn('[WhatsApp] Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID.');
}
if (!appSecret) {
  console.warn('[WhatsApp] Missing META_WHATSAPP_APP_SECRET for webhook signature validation.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET' || req.method === 'POST') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const providedToken = url.searchParams.get('hub.verify_token');

    if (mode === 'subscribe' && challenge && verifyToken && providedToken === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    if (mode === 'subscribe') {
      return new Response('Verification failed', { status: 403 });
    }
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!appSecret) {
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256')
      ?? req.headers.get('X-Hub-Signature-256');
    const signatureValid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
    if (!signatureValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const messages = extractTextMessages(payload);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const message of messages) {
      try {
        await handleInboundMessage(supabase, message);
      } catch (error) {
        console.error('[WhatsApp] Failed to handle message:', error);
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

type WhatsAppTextMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: 'text';
  text: {
    body: string;
  };
};

async function handleInboundMessage(supabase: any, message: WhatsAppTextMessage) {
  const from = normalizePhoneNumber(message.from);
  const body = message.text?.body?.trim() ?? '';

  if (!from || !body) {
    return;
  }

  const recorded = await recordInboundEvent(supabase, message.id, from, message);
  if (!recorded) {
    return;
  }

  const linked = await findLinkedAccount(supabase, from);
  if (!linked) {
    await handleUnlinkedMessage(supabase, from, body);
    return;
  }

  checkRateLimit(linked.profile_id, { maxRequests: 30, windowMs: 60_000 });

  const conversationId = await ensureConversation(supabase, linked, from);
  await saveConversationMessage(supabase, conversationId, 'user', body);

  const transactionResult = await maybeSaveTransaction(supabase, linked, body);

  const context = linked.company_id
    ? await fetchCompanyFinancialContext(supabase, linked.profile_id, linked.company_id)
    : await fetchFinancialContext(supabase, linked.profile_id);

  const assistantMessage = await buildAssistantResponse(body, context);

  const combinedResponse = [transactionResult?.confirmation, assistantMessage]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!combinedResponse) {
    return;
  }

  const outboundId = await sendWhatsAppText(from, combinedResponse);
  await saveConversationMessage(supabase, conversationId, 'assistant', combinedResponse);

  if (outboundId) {
    await recordOutboundEvent(supabase, outboundId, from, { text: combinedResponse });
  }
}

async function handleUnlinkedMessage(supabase: any, from: string, body: string) {
  const pairingCode = extractPairingCode(body);

  if (!pairingCode) {
    await sendWhatsAppText(
      from,
      'Para conectar seu WhatsApp ao SimplifiQA, gere um código no app e envie aqui.'
    );
    return;
  }

  const { data: pendingLink } = await supabase
    .from('whatsapp_links')
    .select('*')
    .eq('pairing_code', pairingCode)
    .eq('status', 'pending')
    .gt('pairing_expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingLink) {
    await sendWhatsAppText(from, 'Código inválido ou expirado. Gere um novo código no app.');
    return;
  }

  const conversationId = await createConversation(supabase, pendingLink.profile_id, from);

  const { error } = await supabase
    .from('whatsapp_links')
    .update({
      phone: from,
      status: 'linked',
      verified_at: new Date().toISOString(),
      conversation_id: conversationId,
    })
    .eq('id', pendingLink.id);

  if (error) {
    if (error.code === '23505') {
      await sendWhatsAppText(from, 'Este número já está vinculado a outra conta.');
      return;
    }
    console.error('[WhatsApp] Failed to link phone:', error);
    await sendWhatsAppText(from, 'Não consegui completar a conexão. Tente gerar um novo código.');
    return;
  }

  await sendWhatsAppText(from, 'Tudo certo! Seu WhatsApp foi conectado ao SimplifiQA.');
}

async function findLinkedAccount(supabase: any, phone: string) {
  const { data } = await supabase
    .from('whatsapp_links')
    .select('id, profile_id, company_id, conversation_id, status')
    .eq('phone', phone)
    .eq('status', 'linked')
    .maybeSingle();

  return data ?? null;
}

async function ensureConversation(supabase: any, link: any, phone: string): Promise<string> {
  if (link.conversation_id) {
    return link.conversation_id;
  }

  const conversationId = await createConversation(supabase, link.profile_id, phone);
  await supabase
    .from('whatsapp_links')
    .update({ conversation_id: conversationId })
    .eq('id', link.id);

  return conversationId;
}

async function createConversation(supabase: any, userId: string, phone: string): Promise<string> {
  const title = `WhatsApp (${formatPhoneForTitle(phone)})`;
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function saveConversationMessage(
  supabase: any,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) {
  await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
    });
}

async function recordInboundEvent(supabase: any, messageId: string, phone: string, payload: any) {
  const { error } = await supabase
    .from('whatsapp_events')
    .insert({
      message_id: messageId,
      phone,
      direction: 'inbound',
      payload,
    });

  if (error) {
    if (error.code === '23505') {
      return false;
    }
    console.error('[WhatsApp] Failed to record inbound event:', error);
  }

  return true;
}

async function recordOutboundEvent(supabase: any, messageId: string, phone: string, payload: any) {
  const { error } = await supabase
    .from('whatsapp_events')
    .insert({
      message_id: messageId,
      phone,
      direction: 'outbound',
      payload,
    });

  if (error && error.code !== '23505') {
    console.error('[WhatsApp] Failed to record outbound event:', error);
  }
}

async function sendWhatsAppText(to: string, message: string): Promise<string | null> {
  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp] Missing API credentials, cannot send message.');
    return null;
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[WhatsApp] Failed to send message:', errorData);
    return null;
  }

  const data = await response.json();
  return data?.messages?.[0]?.id ?? null;
}

type TransactionResult = {
  confirmation: string;
};

async function maybeSaveTransaction(supabase: any, link: any, message: string): Promise<TransactionResult | null> {
  const parsed = extractTransactionFromMessage(message);
  if (!parsed) {
    return null;
  }

  const categoryName = classifyCategory(parsed.description);
  const categoryId = categoryName
    ? await findCategoryId(supabase, link, categoryName)
    : null;

  const date = new Date().toISOString().split('T')[0];

  if (link.company_id) {
    const { error } = await supabase
      .from('company_transactions')
      .insert({
        company_id: link.company_id,
        description: parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        date,
        category_id: categoryId,
        created_by: link.profile_id,
      });

    if (error) {
      console.error('[WhatsApp] Failed to insert company transaction:', error);
      return null;
    }
  } else {
    const { error } = await supabase
      .from('transactions')
      .insert({
        user_id: link.profile_id,
        description: parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        date,
        category_id: categoryId,
      });

    if (error) {
      console.error('[WhatsApp] Failed to insert transaction:', error);
      return null;
    }
  }

  const typeLabel = parsed.type === 'receita' ? 'Receita' : 'Despesa';
  const categoryLabel = categoryName ? ` • ${categoryName}` : '';
  const confirmation = `✅ ${typeLabel} registrada: ${formatCurrency(parsed.amount)} - ${parsed.description}${categoryLabel}.`;

  return { confirmation };
}

function extractTransactionFromMessage(message: string) {
  const amount = extractAmount(message);
  if (!amount) {
    return null;
  }

  const normalized = message.toLowerCase();
  const incomeRegex = /(recebi|receita|ganhei|vendi|entrada|credito|crédito)/i;
  const expenseRegex = /(paguei|gastei|comprei|despesa|debito|débito|saquei)/i;

  let type: 'receita' | 'despesa' = 'despesa';
  if (incomeRegex.test(normalized) && !expenseRegex.test(normalized)) {
    type = 'receita';
  } else if (expenseRegex.test(normalized) && !incomeRegex.test(normalized)) {
    type = 'despesa';
  }

  let description = message;
  description = description.replace(amount.raw, '').replace(/r\$/gi, '').trim();
  description = description.replace(incomeRegex, '').replace(expenseRegex, '').trim();
  description = description.replace(/^(no|na|em|para|por)\s+/i, '').trim();

  if (description.length < 3) {
    description = 'Transação via WhatsApp';
  }

  return {
    amount: amount.value,
    description: capitalizeSentence(description),
    type,
  };
}

function extractAmount(message: string): { value: number; raw: string } | null {
  const regex = /(?:R\$\s*)?((?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{2})?)/i;
  const match = message.match(regex);
  if (!match) {
    return null;
  }

  const raw = match[0];
  const numericPart = match[1];

  let normalized = numericPart.replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  } else if (normalized.includes('.')) {
    const parts = normalized.split('.');
    if (parts.length > 2) {
      normalized = parts.join('');
    } else {
      const [intPart, fracPart] = parts;
      if (fracPart && fracPart.length === 3) {
        normalized = `${intPart}${fracPart}`;
      } else if (fracPart) {
        normalized = `${intPart}.${fracPart}`;
      } else {
        normalized = intPart;
      }
    }
  }

  const value = Number(normalized);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }

  return { value, raw };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'mercado', 'supermercado', 'padaria', 'restaurante', 'lanchonete',
    'ifood', 'rappi', 'uber eats', 'delivery', 'café', 'bar',
    'açougue', 'feira', 'hortifruti', 'pizza', 'hamburguer'
  ],
  'Transporte': [
    'uber', 'taxi', '99', 'gasolina', 'combustível', 'estacionamento',
    'pedágio', 'ônibus', 'metrô', 'trem', 'passagem', 'ipva',
    'mecânico', 'oficina', 'lava-jato', 'app transporte'
  ],
  'Saúde': [
    'farmácia', 'drogaria', 'médico', 'hospital', 'clínica',
    'dentista', 'exame', 'laboratório', 'plano de saúde',
    'remédio', 'consulta', 'fisioterapia', 'academia'
  ],
  'Educação': [
    'escola', 'faculdade', 'universidade', 'curso', 'livro',
    'material escolar', 'mensalidade', 'matrícula', 'papelaria'
  ],
  'Lazer': [
    'cinema', 'teatro', 'show', 'ingresso', 'netflix', 'spotify',
    'streaming', 'jogo', 'game', 'viagem', 'hotel', 'turismo',
    'parque', 'balada', 'festa', 'bar', 'pub'
  ],
  'Moradia': [
    'aluguel', 'condomínio', 'água', 'luz', 'energia', 'gás',
    'internet', 'iptu', 'reforma', 'material construção',
    'móveis', 'decoração', 'limpeza'
  ],
  'Vestuário': [
    'roupa', 'calça', 'camisa', 'sapato', 'tênis', 'loja',
    'shopping', 'moda', 'boutique', 'calçado'
  ],
  'Serviços': [
    'telefone', 'celular', 'banco', 'taxa', 'tarifa', 'cartório',
    'seguro', 'advogado', 'contador', 'assinatura'
  ],
};

function classifyCategory(description: string): string | null {
  const descLower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => descLower.includes(keyword))) {
      return category;
    }
  }
  return null;
}

async function findCategoryId(supabase: any, link: any, categoryName: string): Promise<string | null> {
  if (link.company_id) {
    const { data } = await supabase
      .from('company_categories')
      .select('id')
      .eq('company_id', link.company_id)
      .eq('name', categoryName)
      .maybeSingle();
    return data?.id ?? null;
  }

  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', link.profile_id)
    .eq('name', categoryName)
    .maybeSingle();

  return data?.id ?? null;
}

async function fetchFinancialContext(supabase: any, userId: string): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('monthly_income')
    .eq('id', userId)
    .single();

  const { data: costsData, count: fixedCostsCount } = await supabase
    .from('fixed_costs')
    .select('amount', { count: 'exact' })
    .eq('user_id', userId);

  const { data: transactionsData } = await supabase
    .from('transactions')
    .select('description, amount, category_id, date, categories(name)')
    .eq('user_id', userId)
    .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .order('date', { ascending: false })
    .limit(10);

  const monthlyIncome = profileData?.monthly_income ? Number(profileData.monthly_income) : 0;
  const fixedCosts = costsData?.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0) || 0;
  const hasFixedCosts = (fixedCostsCount ?? 0) > 0;
  const totalExpenses = transactionsData?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;
  const balance = monthlyIncome - fixedCosts - totalExpenses;

  return {
    type: 'personal',
    monthlyIncome,
    fixedCosts,
    hasFixedCosts,
    totalExpenses,
    balance,
    recentTransactions: transactionsData?.map((tx: any) => ({
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.categories?.name || 'Sem categoria',
      date: tx.date,
    })) || [],
  };
}

async function fetchCompanyFinancialContext(
  supabase: any,
  userId: string,
  companyId: string
): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('company_id', companyId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error('Company access denied');

  const { data: companyData } = await supabase
    .from('companies')
    .select('monthly_revenue')
    .eq('id', companyId)
    .single();

  const monthlyRevenue = Number(companyData?.monthly_revenue ?? 0);

  const { data: fixedCostsData, count: companyFixedCostsCount } = await supabase
    .from('company_fixed_costs')
    .select('amount', { count: 'exact' })
    .eq('company_id', companyId);

  const fixedCosts = fixedCostsData?.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0) || 0;
  const hasFixedCosts = (companyFixedCostsCount ?? 0) > 0;

  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0);

  const { data: transactionsData } = await supabase
    .from('company_transactions')
    .select('description, amount, type, date, company_categories(name)')
    .eq('company_id', companyId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(10);

  const expenses = transactionsData
    ?.filter((transaction: any) => transaction.type === 'despesa')
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0) || 0;

  const transactionIncome = transactionsData
    ?.filter((transaction: any) => transaction.type === 'receita')
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0) || 0;

  const balance = transactionIncome - expenses;

  return {
    type: 'company',
    monthlyRevenue,
    fixedCosts,
    hasFixedCosts,
    expenses,
    transactionIncome,
    balance,
    recentTransactions: transactionsData?.map((tx: any) => ({
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.company_categories?.name || 'Sem categoria',
      date: tx.date,
      type: tx.type,
    })) || [],
  };
}

async function buildAssistantResponse(message: string, context: FinancialContext): Promise<string> {
  const direct = getDirectResponse(message, context);
  if (direct) {
    return direct;
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return 'Recebi sua mensagem. Se precisar, também posso registrar despesas e receitas por aqui.';
  }

  const systemPrompt = buildSystemPrompt(context);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[WhatsApp] OpenAI error:', errorData);
    return 'Tive um problema para responder agora. Tente novamente em instantes.';
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim()
    || 'Desculpe, não consegui processar sua mensagem.';
}

const balanceIntentRegex = /(saldo|quanto\s+(ainda\s+)?tenho|quanto\s+resta|dispon[ií]vel)/i;

function hasFixedCostsMention(text: string) {
  return /custo(s)?\s+fixo(s)?/i.test(text);
}

function buildFixedCostsNote(context: FinancialContext) {
  const fixedCostsNote = context.hasFixedCosts
    ? `Custos fixos: ${formatCurrency(context.fixedCosts)}.`
    : 'Não encontrei custos fixos cadastrados. Quer informar um valor para eu considerar?';
  const companyFixedCostsImpact = context.type === 'company' && context.hasFixedCosts
    ? `Saldo considerando custos fixos: ${formatCurrency(context.balance - context.fixedCosts)}.`
    : '';
  return [fixedCostsNote, companyFixedCostsImpact].filter(Boolean).join(' ');
}

function getDirectResponse(message: string, context: FinancialContext): string | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('custo fixo') || lowerMessage.includes('custos fixos') || lowerMessage.includes('consider')) {
    return null;
  }

  const isCompany = context.type === 'company';
  const totalExpenses = isCompany ? context.expenses : context.totalExpenses;
  const balanceLabel = isCompany ? 'saldo registrado' : 'saldo restante';
  const expensesLabel = isCompany ? 'despesas do mês' : 'despesas variáveis';
  const fixedCostsNote = context.hasFixedCosts
    ? ` Custos fixos: ${formatCurrency(context.fixedCosts)}.`
    : ' Não encontrei custos fixos cadastrados. Quer informar um valor para eu considerar?';
  const companyFixedCostsImpact = isCompany && context.hasFixedCosts
    ? ` Considerando custos fixos, o saldo fica ${formatCurrency(context.balance - context.fixedCosts)}.`
    : '';

  if (balanceIntentRegex.test(lowerMessage)) {
    return `Seu ${balanceLabel} este mês é de ${formatCurrency(context.balance)}. Você já registrou ${formatCurrency(totalExpenses)} em ${expensesLabel}.${fixedCostsNote}${companyFixedCostsImpact}`;
  }

  if (lowerMessage.includes('gasto') || lowerMessage.includes('gastei') || lowerMessage.includes('despesa')) {
    const topExpenses = context.recentTransactions.slice(0, 3);
    const expensesText = topExpenses.length
      ? topExpenses.map(tx => `${tx.category} (${formatCurrency(tx.amount)})`).join(', ')
      : 'sem categorias detalhadas no período.';
    return `Você gastou ${formatCurrency(totalExpenses)} este mês, distribuídos em: ${expensesText}.${fixedCostsNote}${companyFixedCostsImpact}`;
  }

  if (lowerMessage.includes('adicionar') || lowerMessage.includes('registrar')) {
    return 'Claro! Me envie o valor e a descrição que eu registro por aqui.';
  }

  return null;
}

function extractPairingCode(message: string): string | null {
  const match = message.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPhoneForTitle(value: string): string {
  if (value.length <= 4) return value;
  return `...${value.slice(-4)}`;
}

function capitalizeSentence(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function extractTextMessages(payload: any): WhatsAppTextMessage[] {
  const messages: WhatsAppTextMessage[] = [];

  // Official Meta webhook format
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      collectTextMessages(value?.messages, messages);
    }
  }

  // Some brokers/webhooks forward only the "value" object
  collectTextMessages(payload?.messages, messages);

  // Some integrations wrap the original payload under "body"
  collectTextMessages(payload?.body?.messages, messages);

  return messages;
}

function collectTextMessages(source: any, target: WhatsAppTextMessage[]) {
  const eventMessages = Array.isArray(source) ? source : [];
  for (const msg of eventMessages) {
    if (msg?.type === 'text' && msg?.text?.body) {
      target.push(msg as WhatsAppTextMessage);
    }
  }
}

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }

  const [algo, signature] = signatureHeader.split('=');
  if (algo !== 'sha256' || !signature) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = toHex(mac);
  return timingSafeEqual(signature.toLowerCase(), expected.toLowerCase());
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
