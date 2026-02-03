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
    const { message, userId, companyId, month, year } = validateRequest(ChatRequestSchema, requestData);

    // Check rate limit (20 requests per minute per user)
    checkRateLimit(userId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's financial context
    const context = companyId
      ? await fetchCompanyFinancialContext(supabase, userId, companyId, month, year)
      : await fetchFinancialContext(supabase, userId);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('AI service temporarily unavailable');
    }

    const directResponse = getDirectResponse(message, context);

    if (directResponse) {
      return new Response(JSON.stringify(directResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    type: 'personal',
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

async function fetchCompanyFinancialContext(
  supabase: any,
  userId: string,
  companyId: string,
  month?: number,
  year?: number
): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = month ?? now.getMonth() + 1;
  const currentYear = year ?? now.getFullYear();

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

  const { data: fixedCostsData } = await supabase
    .from('company_fixed_costs')
    .select('amount')
    .eq('company_id', companyId);

  const fixedCosts = fixedCostsData?.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0) || 0;

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

  // Saldo registrado considera apenas receitas e despesas do mês
  const balance = transactionIncome - expenses;

  return {
    type: 'company',
    monthlyRevenue,
    fixedCosts,
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

async function callOpenAI(apiKey: string, message: string, context: FinancialContext) {
  try {
    // Prompt agora vem do arquivo prompt.ts - edite lá para customizar!
    const systemPrompt = buildSystemPrompt(context);

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
      console.error('API error:', errorData);
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
    console.error('Error in request:', error);
    throw error; // Propagate error instead of silent fallback
  }
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getDirectResponse(message: string, context: FinancialContext) {
  const lowerMessage = message.toLowerCase();
  const isCompany = context.type === 'company';
  const totalExpenses = isCompany ? context.expenses : context.totalExpenses;
  const balanceLabel = isCompany ? 'saldo registrado' : 'saldo restante';
  const expensesLabel = isCompany ? 'despesas do mês' : 'despesas variáveis';
  const dashboardPath = isCompany ? '/company/dashboard' : '/dashboard';
  const transactionsPath = isCompany ? '/company/transactions' : '/transactions';

  if (lowerMessage.includes('saldo') || lowerMessage.includes('quanto tenho') || lowerMessage.includes('disponível')) {
    return {
      message: `Seu ${balanceLabel} este mês é de ${formatCurrency(context.balance)}. Você já registrou ${formatCurrency(totalExpenses)} em ${expensesLabel}.`,
      metadata: { type: 'balance_query' },
      actions: [{ label: 'Ver Detalhes', action: 'navigate', data: dashboardPath }],
    };
  }

  if (lowerMessage.includes('gasto') || lowerMessage.includes('gastei') || lowerMessage.includes('despesa')) {
    const topExpenses = context.recentTransactions.slice(0, 3);
    const expensesText = topExpenses.length
      ? topExpenses.map(tx => `${tx.category} (${formatCurrency(tx.amount)})`).join(', ')
      : 'sem categorias detalhadas no período.';
    return {
      message: `Você gastou ${formatCurrency(totalExpenses)} este mês, distribuídos em: ${expensesText}`,
      metadata: { type: 'expenses_query' },
      actions: [{ label: 'Ver Transações', action: 'navigate', data: transactionsPath }],
    };
  }

  if (lowerMessage.includes('adicionar') || lowerMessage.includes('registrar')) {
    return {
      message: 'Claro! Vou te ajudar a adicionar uma nova despesa. Clique no botão abaixo para abrir o formulário.',
      metadata: { type: 'add_transaction' },
      actions: [{ label: 'Adicionar Despesa', action: 'navigate', data: transactionsPath }],
    };
  }

  return null;
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
