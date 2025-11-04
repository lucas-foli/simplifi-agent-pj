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
import { useCategories } from '@/hooks/useFinancialData';

interface FixedCost {
  description: string;
  amount: number;
  category_id?: string;
}

interface FixedCostReviewProps {
  fixedCosts: FixedCost[];
  onSave?: () => void;
  onCancel?: () => void;
}

export const FixedCostReview = ({
  fixedCosts: initialFixedCosts,
  onSave,
  onCancel,
}: FixedCostReviewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [fixedCosts, setFixedCosts] = useState(initialFixedCosts);
  const [saving, setSaving] = useState(false);

  const updateFixedCost = (index: number, field: keyof FixedCost, value: any) => {
    setFixedCosts((prev) =>
      prev.map((cost, i) => (i === index ? { ...cost, [field]: value } : cost))
    );
  };

  const removeFixedCost = (index: number) => {
    setFixedCosts((prev) => prev.filter((_, i) => i !== index));
    toast.success('Custo fixo removido');
  };

  const saveFixedCosts = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (fixedCosts.length === 0) {
      toast.error('Nenhum custo fixo para salvar');
      return;
    }

    setSaving(true);

    try {
      // Format fixed costs for database
      const formattedCosts = fixedCosts.map((cost) => ({
        user_id: user.id,
        description: cost.description,
        amount: cost.amount,
        category_id: cost.category_id || null,
      }));

      console.log('Saving fixed costs:', formattedCosts);

      const { data, error } = await supabase
        .from('fixed_costs')
        .insert(formattedCosts);

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      toast.success(`${fixedCosts.length} custo(s) fixo(s) salvo(s) com sucesso!`);

      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });

      // Clear costs
      setFixedCosts([]);

      // Call callback
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving fixed costs:', error);
      toast.error('Erro ao salvar custos fixos');
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);

  if (fixedCosts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Check className="w-12 h-12 mx-auto mb-4 text-success" />
        <h3 className="text-lg font-semibold mb-2">Todos os custos fixos foram salvos!</h3>
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
            <h3 className="font-semibold text-lg">Revisar Custos Fixos</h3>
            <p className="text-sm text-muted-foreground">
              {fixedCosts.length} custo(s) encontrado(s) • Total: R${' '}
              {totalAmount.toFixed(2)}/mês
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
              onClick={saveFixedCosts}
              disabled={saving || fixedCosts.length === 0}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Todos'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {fixedCosts.map((cost, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                {/* Description */}
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Descrição
                  </label>
                  <Input
                    value={cost.description}
                    onChange={(e) =>
                      updateFixedCost(index, 'description', e.target.value)
                    }
                    placeholder="Ex: Aluguel, Energia, Internet"
                    className="h-9"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Categoria
                  </label>
                  <Select
                    value={cost.category_id || ''}
                    onValueChange={(value) =>
                      updateFixedCost(index, 'category_id', value || undefined)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Valor Mensal
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cost.amount}
                    onChange={(e) =>
                      updateFixedCost(index, 'amount', parseFloat(e.target.value))
                    }
                    className="h-9"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-end justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFixedCost(index)}
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
              Os custos fixos serão adicionados ao seu orçamento mensal
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
              {fixedCosts.length} custo(s)/mês
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
