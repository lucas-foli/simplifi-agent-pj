import { useState } from 'react';
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

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  payment_method?: string;
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
  'Outros',
];

const PAYMENT_METHODS = [
  'credit_card',
  'debit_card',
  'pix',
  'cash',
  'bank_transfer',
  'imported',
];

export const TransactionReview = ({
  transactions: initialTransactions,
  onSave,
  onCancel,
}: TransactionReviewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
      // Format transactions for database
      const formattedTransactions = transactions.map((t) => ({
        user_id: user.id,
        company_id: null,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category || 'Outros',
        payment_method: t.payment_method || 'imported',
        created_by: user.id,
      }));

      console.log('Saving transactions:', formattedTransactions);

      const { data, error } = await supabase
        .from('transactions')
        .insert(formattedTransactions);

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      // Supabase insert returns null data on success
      toast.success(`${transactions.length} transações salvas com sucesso!`);

      // Invalidate React Query cache to refetch dashboard data
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-by-category'] });

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
                    onChange={(e) =>
                      updateTransaction(index, 'amount', parseFloat(e.target.value))
                    }
                    className="h-9"
                  />
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
