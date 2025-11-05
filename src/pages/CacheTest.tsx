import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useCompanyTransactions } from '@/hooks/useCompanyFinancialData';

const CacheTest = () => {
  const now = new Date();
  const [requestCount, setRequestCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const { activeCompany } = useAuth();
  const companyId = activeCompany?.company_id;

  const {
    data: transactions,
    isLoading,
    isFetching,
    refetch,
  } = useCompanyTransactions(companyId, now.getMonth() + 1, now.getFullYear());

  // Interceptar quando o React Query faz fetch
  const handleRefetch = () => {
    setRequestCount(prev => prev + 1);
    setLastFetchTime(new Date());
    refetch();
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🧪 Teste de Cache - React Query</h1>

      <div className="space-y-4">
        {/* Instruções */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-950">
          <h2 className="font-bold text-lg mb-4">📖 Como testar o cache:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Clique em "Buscar Transações" várias vezes rapidamente</li>
            <li>Observe que o contador de requests NÃO aumenta (cache funcionando!)</li>
            <li>Abra o Network do DevTools (F12 → Network)</li>
            <li>Clique novamente - não verá novas requests ao Supabase</li>
            <li>Aguarde 30 segundos (tempo de staleTime)</li>
            <li>Clique novamente - agora verá uma nova request (cache expirou)</li>
          </ol>
        </Card>

        {/* Status */}
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4">📊 Status do Cache</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Estado</div>
              <div className="text-xl font-bold">
                {!companyId ? (
                  <span className="text-orange-600">⚠️ Nenhuma empresa selecionada</span>
                ) : isLoading ? (
                  <span className="text-yellow-600">⏳ Carregando inicial...</span>
                ) : isFetching ? (
                  <span className="text-blue-600">🔄 Buscando dados...</span>
                ) : (
                  <span className="text-green-600">✅ Dados em cache</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Requests ao Supabase</div>
              <div className="text-xl font-bold text-primary">
                {requestCount} {requestCount === 0 && '(use o botão abaixo)'}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Último fetch</div>
              <div className="text-lg font-mono">
                {lastFetchTime ? lastFetchTime.toLocaleTimeString('pt-BR') : '-'}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Transações em cache</div>
              <div className="text-xl font-bold">
                {transactions?.length || 0}
              </div>
            </div>
          </div>
        </Card>

        {/* Ações */}
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4">🎮 Ações</h2>
          <div className="flex gap-4">
            <Button onClick={handleRefetch} disabled={isFetching || !companyId} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Buscar Transações
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setRequestCount(0);
                setLastFetchTime(null);
              }}
            >
              Reset Contador
            </Button>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Dica:</strong> O React Query mantém os dados em cache por 5 minutos
              (cacheTime) e considera os dados "frescos" por 30 segundos (staleTime).
              Durante o staleTime, não há requests ao servidor!
            </p>
          </div>
        </Card>

        {/* Dados */}
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4">📦 Dados em Cache</h2>
          {!companyId ? (
            <p className="text-muted-foreground text-center py-8">
              Selecione uma empresa para visualizar transações.
            </p>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 bg-muted rounded-lg flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{tx.description}</div>
                    <div className="text-sm text-muted-foreground">{tx.type === 'despesa' ? 'Despesa' : 'Receita'}</div>
                  </div>
                  <div className="font-bold">
                    R$ {Number(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))}
              {transactions.length > 5 && (
                <p className="text-sm text-center text-muted-foreground pt-2">
                  + {transactions.length - 5} transações em cache
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma transação em cache
            </p>
          )}
        </Card>

        {/* DevTools */}
        <Card className="p-6 bg-purple-50 dark:bg-purple-950">
          <h2 className="font-bold text-lg mb-4">🔧 React Query DevTools</h2>
          <p className="text-sm mb-4">
            Para ver o cache em tempo real, instale o React Query DevTools:
          </p>
          <pre className="bg-black text-green-400 p-4 rounded text-xs overflow-auto">
            npm install @tanstack/react-query-devtools
          </pre>
          <p className="text-sm mt-4">
            Depois adicione no App.tsx e clique no ícone flutuante no canto da tela.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default CacheTest;
