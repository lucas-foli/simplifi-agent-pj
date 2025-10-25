import { useAuth } from '@/hooks/useAuth';
import { useDashboardSummary, useFixedCosts, useMonthlyIncome } from '@/hooks/useFinancialData';
import { useTransactions } from '@/hooks/useTransactions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';

const Debug = () => {
  const { user, profile } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useDashboardSummary(currentMonth, currentYear);
  const { data: income, isLoading: incomeLoading, error: incomeError } = useMonthlyIncome(currentMonth, currentYear);
  const { data: fixedCosts, isLoading: costsLoading, error: costsError } = useFixedCosts(currentMonth, currentYear);
  const { data: transactions, isLoading: txLoading, error: txError } = useTransactions(currentMonth, currentYear);

  // Audit log
  const { data: auditLog, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Debug - Dados do Supabase</h1>

      <div className="space-y-4">
        {/* User Info */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">Usuário</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({ user: user?.id, profile }, null, 2)}
          </pre>
        </Card>

        {/* Monthly Income */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">Receita Mensal (Mês {currentMonth}/{currentYear})</h2>
          {incomeLoading && <p>Carregando...</p>}
          {incomeError && <p className="text-red-500">Erro: {JSON.stringify(incomeError)}</p>}
          <pre className="text-xs overflow-auto">
            {JSON.stringify(income, null, 2)}
          </pre>
        </Card>

        {/* Fixed Costs */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">Custos Fixos (Mês {currentMonth}/{currentYear})</h2>
          {costsLoading && <p>Carregando...</p>}
          {costsError && <p className="text-red-500">Erro: {JSON.stringify(costsError)}</p>}
          <pre className="text-xs overflow-auto">
            {JSON.stringify(fixedCosts, null, 2)}
          </pre>
        </Card>

        {/* Transactions */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">Transações (Mês {currentMonth}/{currentYear})</h2>
          {txLoading && <p>Carregando...</p>}
          {txError && <p className="text-red-500">Erro: {JSON.stringify(txError)}</p>}
          <pre className="text-xs overflow-auto">
            {JSON.stringify(transactions, null, 2)}
          </pre>
        </Card>

        {/* Summary */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">Resumo (Dashboard Summary)</h2>
          {summaryLoading && <p>Carregando...</p>}
          {summaryError && <p className="text-red-500">Erro: {JSON.stringify(summaryError)}</p>}
          <pre className="text-xs overflow-auto">
            {JSON.stringify(summary, null, 2)}
          </pre>
        </Card>

        {/* Audit Log */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">🔍 Auditoria (Últimas 10 ações)</h2>
          {auditLoading && <p>Carregando...</p>}
          <div className="space-y-2">
            {auditLog?.map((log: any) => (
              <div key={log.id} className="text-xs border-l-2 border-primary pl-2 py-1">
                <div className="font-bold">
                  {log.action} em {log.table_name}
                </div>
                <div className="text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </div>
                {log.new_values && (
                  <details className="mt-1">
                    <summary className="cursor-pointer hover:text-primary">Ver dados</summary>
                    <pre className="mt-1 bg-muted p-2 rounded">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Debug;
