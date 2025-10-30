import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  validateRequest,
  checkRateLimit,
  createErrorResponse,
  ClassifyTransactionRequestSchema,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClassificationResult {
  category: string;
  confidence: number;
  source: 'keyword' | 'history' | 'ai';
}

// Keyword-based classification rules
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate and parse request
    const requestData = await req.json();
    const { description, userId, amount } = validateRequest(
      ClassifyTransactionRequestSchema,
      requestData
    );

    // Check rate limit (30 requests per minute for classification)
    checkRateLimit(userId, { maxRequests: 30, windowMs: 60000 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try classification methods in order of confidence
    let result: ClassificationResult | null = null;

    // 1. Check saved patterns first (highest priority)
    result = await classifyByPattern(supabase, userId, description);

    // 2. Check user's transaction history for similar descriptions
    if (!result || result.confidence < 0.9) {
      const historyResult = await classifyByHistory(supabase, userId, description);
      if (historyResult && historyResult.confidence > (result?.confidence || 0)) {
        result = historyResult;
      }
    }

    // 3. If no history match, use keyword-based classification
    if (!result) {
      result = classifyByKeywords(description);
    }

    // 3. If still no match and is available, use AI
    if (!result || result.confidence < 0.7) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        const aiResult = await classifyWithAI(openaiKey, description, amount);
        if (aiResult && aiResult.confidence > (result?.confidence || 0)) {
          result = aiResult;
        }
      }
    }

    // Default to "Outros" if nothing matched
    if (!result) {
      result = {
        category: 'Outros',
        confidence: 0.3,
        source: 'keyword',
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

async function classifyByPattern(
  supabase: any,
  userId: string,
  description: string
): Promise<ClassificationResult | null> {
  const descLower = description.toLowerCase().trim();

  // Get user's saved patterns
  const { data: patterns } = await supabase
    .from('transaction_patterns')
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false })
    .order('usage_count', { ascending: false });

  if (!patterns || patterns.length === 0) {
    return null;
  }

  // Check for exact match
  const exactMatch = patterns.find((p: any) => p.description_pattern === descLower);
  if (exactMatch) {
    return {
      category: exactMatch.category,
      confidence: Math.min(0.99, exactMatch.confidence),
      source: 'history',
    };
  }

  // Check for partial match
  const partialMatch = patterns.find((p: any) => 
    descLower.includes(p.description_pattern) || 
    p.description_pattern.includes(descLower)
  );
  if (partialMatch) {
    return {
      category: partialMatch.category,
      confidence: Math.min(0.85, partialMatch.confidence * 0.9),
      source: 'history',
    };
  }

  return null;
}

async function classifyByHistory(
  supabase: any,
  userId: string,
  description: string
): Promise<ClassificationResult | null> {
  const descLower = description.toLowerCase();

  // Get user's past transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('description, category')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(100);

  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Find similar descriptions
  for (const tx of transactions) {
    const txDescLower = tx.description.toLowerCase();
    
    // Exact match
    if (txDescLower === descLower) {
      return {
        category: tx.category,
        confidence: 0.95,
        source: 'history',
      };
    }

    // Partial match (contains)
    if (txDescLower.includes(descLower) || descLower.includes(txDescLower)) {
      return {
        category: tx.category,
        confidence: 0.85,
        source: 'history',
      };
    }
  }

  // Check for word-level similarity
  const descWords = descLower.split(/\s+/);
  const categoryScores: Record<string, number> = {};

  for (const tx of transactions) {
    const txWords = tx.description.toLowerCase().split(/\s+/);
    const matchingWords = descWords.filter(word => txWords.includes(word)).length;
    
    if (matchingWords >= 2) {
      categoryScores[tx.category] = (categoryScores[tx.category] || 0) + matchingWords;
    }
  }

  if (Object.keys(categoryScores).length > 0) {
    const bestCategory = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a)[0];
    
    return {
      category: bestCategory[0],
      confidence: Math.min(0.75, 0.5 + (bestCategory[1] / descWords.length) * 0.25),
      source: 'history',
    };
  }

  return null;
}

function classifyByKeywords(description: string): ClassificationResult | null {
  const descLower = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (descLower.includes(keyword)) {
        return {
          category,
          confidence: 0.7,
          source: 'keyword',
        };
      }
    }
  }

  return null;
}

async function classifyWithAI(
  apiKey: string,
  description: string,
  amount?: number
): Promise<ClassificationResult | null> {
  try {
    const categories = Object.keys(CATEGORY_KEYWORDS);
    const prompt = `Classifique a seguinte transação em UMA das categorias: ${categories.join(', ')}.

Transação: ${description}${amount ? ` - R$ ${amount.toFixed(2)}` : ''}

Responda APENAS com o nome da categoria, nada mais.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente que classifica transações financeiras em categorias.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 50,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const category = data.choices[0]?.message?.content?.trim();

    if (category && categories.includes(category)) {
      return {
        category,
        confidence: 0.8,
        source: 'ai',
      };
    }

    return null;
  } catch (error) {
    console.error('AI classification error:', error);
    return null;
  }
}
