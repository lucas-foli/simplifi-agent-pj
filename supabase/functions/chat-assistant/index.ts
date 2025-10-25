import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  userId: string;
}

interface FinancialContext {
  monthlyIncome: number;
  fixedCosts: number;
  totalExpenses: number;
  balance: number;
  recentTransactions: Array<{
    description: string;
    amount: number;
    category: string;
    date: string;
  }>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, userId }: ChatRequest = await req.json();

    if (!message || !userId) {
      throw new Error('Missing required fields: message and userId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's financial context
    const context = await fetchFinancialContext(supabase, userId);

    // Call OpenAI API (você pode trocar por Anthropic ou outra IA)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      // Fallback para resposta simulada se não tiver API key
      const response = generateSimulatedResponse(message, context);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate AI response with financial context
    const aiResponse = await callOpenAI(openaiApiKey, message, context);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function fetchFinancialContext(supabase: any, userId: string): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Fetch monthly income
  const { data: incomeData } = await supabase
    .from('monthly_income')
    .select('amount')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .eq('year', currentYear)
    .single();

  // Fetch fixed costs
  const { data: costsData } = await supabase
    .from('fixed_costs')
    .select('amount')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .eq('year', currentYear);

  // Fetch transactions
  const { data: transactionsData } = await supabase
    .from('transactions')
    .select('description, amount, category, date')
    .eq('user_id', userId)
    .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .order('date', { ascending: false })
    .limit(10);

  const monthlyIncome = incomeData?.amount || 0;
  const fixedCosts = costsData?.reduce((sum: number, cost: any) => sum + cost.amount, 0) || 0;
  const totalExpenses = transactionsData?.reduce((sum: number, tx: any) => sum + tx.amount, 0) || 0;
  const balance = monthlyIncome - fixedCosts - totalExpenses;

  return {
    monthlyIncome: monthlyIncome / 100, // Convert from cents
    fixedCosts: fixedCosts / 100,
    totalExpenses: totalExpenses / 100,
    balance: balance / 100,
    recentTransactions: transactionsData?.map((tx: any) => ({
      description: tx.description,
      amount: tx.amount / 100,
      category: tx.category,
      date: tx.date,
    })) || [],
  };
}

async function callOpenAI(apiKey: string, message: string, context: FinancialContext) {
  const systemPrompt = `Você é o assistente financeiro SimplifiQA. Ajude o usuário com suas finanças pessoais.

Contexto financeiro do usuário (mês atual):
- Receita mensal: R$ ${context.monthlyIncome.toFixed(2)}
- Custos fixos: R$ ${context.fixedCosts.toFixed(2)}
- Gastos variáveis: R$ ${context.totalExpenses.toFixed(2)}
- Saldo restante: R$ ${context.balance.toFixed(2)}

Últimas transações:
${context.recentTransactions.map(tx => `- ${tx.description}: R$ ${tx.amount.toFixed(2)} (${tx.category})`).join('\n')}

Seja objetivo, prestativo e forneça insights financeiros relevantes. Se apropriado, sugira ações específicas.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  const aiMessage = data.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

  // Detect if should suggest actions
  const actions = detectActions(message, aiMessage);

  return {
    message: aiMessage,
    metadata: { type: 'ai_response', model: 'gpt-4o-mini' },
    actions,
  };
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
