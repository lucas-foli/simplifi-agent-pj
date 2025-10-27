import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSystemPrompt, AI_CONFIG, type FinancialContext } from './prompt.ts';
import {
  validateRequest,
  checkRateLimit,
  createErrorResponse,
  ChatRequestSchema,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FinancialContext agora vem de prompt.ts

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate and parse request
    const requestData = await req.json();
    const { message, userId } = validateRequest(ChatRequestSchema, requestData);

    // Check rate limit (20 requests per minute per user)
    checkRateLimit(userId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's financial context
    const context = await fetchFinancialContext(supabase, userId);

    // Call OpenAI API - require key to be configured
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('AI service temporarily unavailable');
    }

    // Generate AI response with financial context
    const aiResponse = await callOpenAI(openaiApiKey, message, context);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

async function fetchFinancialContext(supabase: any, userId: string): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Fetch monthly income from profiles table
  const { data: profileData } = await supabase
    .from('profiles')
    .select('monthly_income')
    .eq('id', userId)
    .single();

  // Fetch fixed costs (all fixed costs for user)
  const { data: costsData } = await supabase
    .from('fixed_costs')
    .select('amount')
    .eq('user_id', userId);

  // Fetch transactions for current month
  const { data: transactionsData } = await supabase
    .from('transactions')
    .select('description, amount, category_id, transaction_date, categories(name)')
    .eq('user_id', userId)
    .gte('transaction_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .order('transaction_date', { ascending: false })
    .limit(10);

  // Values are already stored as decimals (reais) in the database, not cents!
  const monthlyIncome = profileData?.monthly_income ? Number(profileData.monthly_income) : 0;
  const fixedCosts = costsData?.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0) || 0;
  const totalExpenses = transactionsData?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;
  const balance = monthlyIncome - fixedCosts - totalExpenses;

  return {
    monthlyIncome,
    fixedCosts,
    totalExpenses,
    balance,
    recentTransactions: transactionsData?.map((tx: any) => ({
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.categories?.name || 'Sem categoria',
      date: tx.transaction_date,
    })) || [],
  };
}

async function callOpenAI(apiKey: string, message: string, context: FinancialContext) {
  try {
    // Prompt agora vem do arquivo prompt.ts - edite lá para customizar!
    const systemPrompt = buildSystemPrompt(context);

    console.log('Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error('AI service error');
    }

    const data = await response.json();

    // Check if response has expected structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected AI response structure');
      throw new Error('Invalid AI response');
    }

    const aiMessage = data.choices[0].message.content || 'Desculpe, não consegui processar sua mensagem.';

    // Detect if should suggest actions
    const actions = detectActions(message, aiMessage);

    return {
      message: aiMessage,
      metadata: { type: 'ai_response', model: AI_CONFIG.model },
      actions,
    };
  } catch (error) {
    console.error('Error in callOpenAI:', error);
    throw error; // Propagate error instead of silent fallback
  }
}

function generateSimulatedResponse(message: string, context: FinancialContext) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('saldo') || lowerMessage.includes('quanto tenho')) {
    return {
      message: `Seu saldo restante este mês é de R$ ${context.balance.toFixed(2)}. Você já gastou R$ ${context.totalExpenses.toFixed(2)} em despesas variáveis.`,
      metadata: { type: 'balance_query' },
      actions: [{ label: 'Ver Detalhes', action: 'navigate', data: '/dashboard' }],
    };
  }

  if (lowerMessage.includes('gasto') || lowerMessage.includes('gastei')) {
    const topExpenses = context.recentTransactions.slice(0, 3);
    const expensesText = topExpenses.map(tx => `${tx.category} (R$ ${tx.amount.toFixed(2)})`).join(', ');
    return {
      message: `Você gastou R$ ${context.totalExpenses.toFixed(2)} este mês, distribuídos em: ${expensesText}.`,
      metadata: { type: 'expenses_query' },
      actions: [{ label: 'Ver Transações', action: 'navigate', data: '/transactions' }],
    };
  }

  if (lowerMessage.includes('adicionar') || lowerMessage.includes('registrar')) {
    return {
      message: 'Claro! Vou te ajudar a adicionar uma nova despesa. Clique no botão abaixo para abrir o formulário.',
      metadata: { type: 'add_transaction' },
      actions: [{ label: 'Adicionar Despesa', action: 'navigate', data: '/transactions' }],
    };
  }

  return {
    message: `Entendi que você disse: "${message}". Como posso ajudar? Você pode me perguntar sobre seu saldo, gastos ou pedir para adicionar uma despesa.`,
    metadata: { type: 'default' },
    actions: [],
  };
}

function detectActions(userMessage: string, aiResponse: string): Array<{ label: string; action: string; data: string }> {
  const actions = [];
  const combined = (userMessage + ' ' + aiResponse).toLowerCase();

  if (combined.includes('dashboard') || combined.includes('resumo') || combined.includes('visão geral')) {
    actions.push({ label: 'Ver Dashboard', action: 'navigate', data: '/dashboard' });
  }

  if (combined.includes('transaç') || combined.includes('despesa') || combined.includes('gasto')) {
    actions.push({ label: 'Ver Transações', action: 'navigate', data: '/transactions' });
  }

  return actions;
}
