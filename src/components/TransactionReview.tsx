import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Save, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useFinancialData';

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  payment_method?: string;
  type?: 'despesa' | 'receita';
}

interface TransactionReviewProps {
  transactions: Transaction[];
  onSave?: () => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Casa',
  'Vestuário',
  'Receitas',
  'Outros',
];

const TRANSACTION_TYPES: Array<{ value: 'despesa' | 'receita'; label: string }> = [
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita' },
];

export const TransactionReview = ({
  transactions: initialTransactions,
  onSave,
  onCancel,
}: TransactionReviewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const mapInitialTransactions = (list: Transaction[]) =>
    list.map((transaction) => ({
      ...transaction,
      type: transaction.type ?? 'despesa',
    }));

  const [transactions, setTransactions] = useState(() =>
    mapInitialTransactions(initialTransactions)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTransactions(mapInitialTransactions(initialTransactions));
  }, [initialTransactions]);

  const updateTransaction = (index: number, field: keyof Transaction, value: any) => {
    setTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const removeTransaction = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
    toast.success('Transação removida');
  };

  const saveTransactions = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (transactions.length === 0) {
      toast.error('Nenhuma transação para salvar');
      return;
    }

    setSaving(true);

    try {
      // Create a map of category name -> category_id
      const categoryMap = new Map(
        categories.map(cat => [cat.name, cat.id])
      );

      // Format transactions for database
      const formattedTransactions = transactions.map((t) => {
        const categoryId = t.category ? categoryMap.get(t.category) : null;
        
        return {
          user_id: user.id,
          date: t.date,
          description: t.description,
          amount: Number(t.amount),
          type: (t.type ?? 'despesa') as 'despesa' | 'receita',
          category_id: categoryId || null,
          payment_method: t.payment_method ?? null,
        };
      });

      console.log('Saving transactions:', formattedTransactions);

      const { data, error } = await supabase
        .from('transactions')
        .insert(formattedTransactions)
        .select(); // Request the inserted data back for confirmation

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      // Supabase insert with select() returns the inserted rows
      toast.success(`${transactions.length} transações salvas com sucesso!`);

      // Small delay to ensure DB has committed (Supabase replication)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Invalidate React Query cache to refetch dashboard data
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions-by-category'] });

      // Clear transactions
      setTransactions([]);

      // Call callback
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving transactions:', error);
      toast.error('Erro ao salvar transações');
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (transactions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Check className="w-12 h-12 mx-auto mb-4 text-success" />
        <h3 className="text-lg font-semibold mb-2">Todas as transações foram salvas!</h3>
        <p className="text-muted-foreground mb-4">
          Você pode enviar mais arquivos ou fechar esta seção.
        </p>
        {onCancel && (
          <Button onClick={onCancel} variant="outline">
            Fechar
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Revisar Transações</h3>
            <p className="text-sm text-muted-foreground">
              {transactions.length} transações encontradas • Total: R${' '}
              {totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} size="sm">
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
            <Button
              onClick={saveTransactions}
              disabled={saving || transactions.length === 0}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Todas'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {transactions.map((transaction, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                {/* Date */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Data
                  </label>
                  <Input
                    type="date"
                    value={transaction.date}
                    onChange={(e) =>
                      updateTransaction(index, 'date', e.target.value)
                    }
                    className="h-9"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Descrição
                  </label>
                  <Input
                    value={transaction.description}
                    onChange={(e) =>
                      updateTransaction(index, 'description', e.target.value)
                    }
                    placeholder="Descrição da transação"
                    className="h-9"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Valor
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={transaction.amount}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      updateTransaction(
                        index,
                        'amount',
                        Number.isNaN(value) ? 0 : value
                      );
                    }}
                    className={`h-9 ${transaction.type === 'receita' ? 'text-success' : ''}`}
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Tipo
                  </label>
                  <Select
                    value={transaction.type ?? 'despesa'}
                    onValueChange={(value: 'despesa' | 'receita') =>
                      updateTransaction(index, 'type', value)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Categoria
                  </label>
                  <Select
                    value={transaction.category || 'Outros'}
                    onValueChange={(value) =>
                      updateTransaction(index, 'category', value)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex items-end justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTransaction(index)}
                    className="h-9 w-9"
                  >
                    <Trash2 className="w-4 h-4 text-danger" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Summary Card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              As transações serão adicionadas ao seu histórico
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Você pode editar qualquer campo antes de salvar
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              R$ {totalAmount.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {transactions.length} transações
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
