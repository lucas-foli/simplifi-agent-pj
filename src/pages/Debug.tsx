import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import {
  useCompanyDashboardSummary,
  useCompanyFixedCosts,
  useCompanyProfile,
  useCompanyTransactions,
} from '@/hooks/useCompanyFinancialData';

const Debug = () => {
  const { user, profile, activeCompany } = useAuth();
  const companyId = activeCompany?.company_id;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: companyProfile, isLoading: companyLoading } = useCompanyProfile(companyId);
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useCompanyDashboardSummary(companyId, currentMonth, currentYear);
  const {
    data: fixedCosts,
    isLoading: costsLoading,
    error: costsError,
  } = useCompanyFixedCosts(companyId);
  const {
    data: transactions,
    isLoading: txLoading,
    error: txError,
  } = useCompanyTransactions(companyId, currentMonth, currentYear);

  return (
    <div className="container mx-auto p-8 space-y-4">
      <h1 className="text-3xl font-bold mb-8">Debug - Dados do Supabase (PJ)</h1>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Sessão atual</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify({ user: user?.id, profile, activeCompany }, null, 2)}
        </pre>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Empresa Ativa</h2>
        {!companyId && <p className="text-sm text-muted-foreground">Nenhuma empresa selecionada.</p>}
        {companyLoading && <p>Carregando...</p>}
        {companyProfile && (
          <pre className="text-xs overflow-auto">{JSON.stringify(companyProfile, null, 2)}</pre>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Resumo ({currentMonth}/{currentYear})</h2>
        {summaryLoading && <p>Carregando...</p>}
        {summaryError && <p className="text-red-500 text-xs">{JSON.stringify(summaryError)}</p>}
        <pre className="text-xs overflow-auto">{JSON.stringify(summary, null, 2)}</pre>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Custos Fixos</h2>
        {costsLoading && <p>Carregando...</p>}
        {costsError && <p className="text-red-500 text-xs">{JSON.stringify(costsError)}</p>}
        <pre className="text-xs overflow-auto">{JSON.stringify(fixedCosts, null, 2)}</pre>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Transações ({currentMonth}/{currentYear})</h2>
        {txLoading && <p>Carregando...</p>}
        {txError && <p className="text-red-500 text-xs">{JSON.stringify(txError)}</p>}
        <pre className="text-xs overflow-auto">{JSON.stringify(transactions, null, 2)}</pre>
      </Card>
    </div>
  );
};

export default Debug;

