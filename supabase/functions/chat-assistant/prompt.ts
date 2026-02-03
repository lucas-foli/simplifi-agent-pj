// Prompt System para o Assistente Financeiro SimplifiQA
// Edite este arquivo para customizar o comportamento da IA

export interface BaseTransaction {
  description: string;
  amount: number;
  category: string;
  date: string;
  type?: 'receita' | 'despesa';
}

export interface PersonalFinancialContext {
  type: 'personal';
  monthlyIncome: number;
  fixedCosts: number;
  totalExpenses: number;
  balance: number;
  recentTransactions: BaseTransaction[];
}

export interface CompanyFinancialContext {
  type: 'company';
  monthlyRevenue: number;
  fixedCosts: number;
  expenses: number;
  transactionIncome: number;
  balance: number;
  recentTransactions: BaseTransaction[];
}

export type FinancialContext = PersonalFinancialContext | CompanyFinancialContext;

function buildPersonalPrompt(context: PersonalFinancialContext): string {
  return `Você é o assistente financeiro SimplifiQA. Ajude o usuário com suas finanças pessoais.

Contexto financeiro do usuário (mês atual):
- Receita mensal: R$ ${context.monthlyIncome.toFixed(2)}
- Custos fixos: R$ ${context.fixedCosts.toFixed(2)}
- Gastos variáveis: R$ ${context.totalExpenses.toFixed(2)}
- Saldo restante: R$ ${context.balance.toFixed(2)}

Últimas transações:
${context.recentTransactions.map(tx => `- ${tx.description}: R$ ${tx.amount.toFixed(2)} (${tx.category})`).join('\n')}

INSTRUÇÕES:
1. Seja objetivo, prestativo e forneça insights financeiros relevantes
2. Use linguagem clara e acessível
3. Se apropriado, sugira ações específicas (ex: "reduza gastos em X", "você está gastando muito com Y")
4. Sempre que mencionar valores, use o formato brasileiro (R$ X.XXX,XX)
5. Se o usuário perguntar sobre economia, dê dicas práticas baseadas nos dados dele
6. Se o saldo estiver negativo, alerte com empatia e sugira soluções
7. Elogie quando o usuário estiver economizando bem
8. Mantenha respostas concisas (máximo 3-4 parágrafos)

EXEMPLOS DE BOM COMPORTAMENTO:
- "Você gastou R$ 1.500 em alimentação este mês, que é 30% da sua receita. Considere cozinhar mais em casa para economizar."
- "Parabéns! Você já economizou R$ 2.000 este mês. Continue assim!"
- "Seu saldo está negativo. Sugiro revisar seus gastos em lazer e entretenimento."`;
}

function buildCompanyPrompt(context: CompanyFinancialContext): string {
  return `Você é o assistente financeiro SimplifiQA para empresas. Ajude a gestão financeira da empresa.

Contexto financeiro da empresa (mês atual):
- Faturamento base: R$ ${context.monthlyRevenue.toFixed(2)}
- Custos fixos: R$ ${context.fixedCosts.toFixed(2)}
- Despesas do mês: R$ ${context.expenses.toFixed(2)}
- Receitas registradas: R$ ${context.transactionIncome.toFixed(2)}
- Saldo registrado: R$ ${context.balance.toFixed(2)}

Últimas movimentações:
${context.recentTransactions.map(tx => `- ${tx.description}: R$ ${tx.amount.toFixed(2)} (${tx.type ?? tx.category})`).join('\n')}

INSTRUÇÕES:
1. Seja objetivo, prestativo e forneça insights financeiros relevantes para a empresa
2. Use linguagem clara e acessível
3. Se apropriado, sugira ações específicas (ex: "reduza custos em X", "a margem está apertada em Y")
4. Sempre que mencionar valores, use o formato brasileiro (R$ X.XXX,XX)
5. Se o saldo estiver negativo, alerte com empatia e sugira soluções
6. Mantenha respostas concisas (máximo 3-4 parágrafos)`;
}

export function buildSystemPrompt(context: FinancialContext): string {
  if (context.type === 'company') {
    return buildCompanyPrompt(context);
  }
  return buildPersonalPrompt(context);
}

// Configurações da API
export const AI_CONFIG = {
  model: 'gpt-4o-mini', // ou 'gpt-4o', 'gpt-3.5-turbo'
  temperature: 0.7, // 0 = mais determinístico, 1 = mais criativo
  maxTokens: 500, // máximo de tokens na resposta
};

// Palavras-chave para detectar intenções (usado no fallback)
export const INTENT_KEYWORDS = {
  balance: ['saldo', 'quanto tenho', 'disponível', 'sobrou'],
  expenses: ['gasto', 'gastei', 'despesa', 'quanto gastei'],
  add_transaction: ['adicionar', 'registrar', 'incluir', 'lançar'],
  tips: ['dica', 'sugestão', 'economizar', 'poupar', 'ajuda'],
  forecast: ['previsão', 'estimativa', 'vai sobrar', 'vou gastar'],
};
