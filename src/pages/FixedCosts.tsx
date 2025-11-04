import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  Upload,
  Receipt,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FixedCostImport } from '@/components/FixedCostImport';
import { useCategories } from '@/hooks/useFinancialData';

const FixedCosts = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (profile?.user_type === 'pessoa_juridica') {
      navigate('/company/fixed-costs', { replace: true });
    }
  }, [profile, navigate]);
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<any>(null);
  
  const [newCost, setNewCost] = useState({
    description: '',
    amount: '',
    category_id: '',
  });

  // Fetch fixed costs
  const { data: fixedCosts, isLoading } = useQuery({
    queryKey: ['fixed-costs'],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (cost: { description: string; amount: number }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('fixed_costs')
        .insert({
          user_id: user.id,
          description: cost.description,
          amount: cost.amount,
          category_id: cost.category_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Custo fixo adicionado!');
      setIsAddOpen(false);
      setNewCost({ description: '', amount: '', category_id: '' });
    },
    onError: (error) => {
      console.error('Error creating fixed cost:', error);
      toast.error('Erro ao adicionar custo fixo');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('fixed_costs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Custo fixo atualizado!');
      setEditingCost(null);
    },
    onError: (error) => {
      console.error('Error updating fixed cost:', error);
      toast.error('Erro ao atualizar custo fixo');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Custo fixo excluído!');
    },
    onError: (error) => {
      console.error('Error deleting fixed cost:', error);
      toast.error('Erro ao excluir custo fixo');
    },
  });

  const handleAdd = async () => {
    if (!newCost.description || !newCost.amount) {
      toast.error('Preencha todos os campos');
      return;
    }

    createMutation.mutate({
      description: newCost.description,
      amount: parseFloat(newCost.amount),
      category_id: newCost.category_id || undefined,
    });
  };

  const handleUpdate = async () => {
    if (!editingCost) return;

    updateMutation.mutate({
      id: editingCost.id,
      updates: {
        description: editingCost.description,
        amount: editingCost.amount,
        category_id: editingCost.category_id || null,
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este custo fixo?')) return;
    deleteMutation.mutate(id);
  };

  const filteredCosts = fixedCosts?.filter((cost) =>
    cost.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalMonthly = filteredCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Custos Fixos</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie suas despesas mensais recorrentes
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Importar</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Importar Custos Fixos</DialogTitle>
                </DialogHeader>
                <FixedCostImport />
              </DialogContent>
            </Dialog>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Custo Fixo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      placeholder="Ex: Aluguel, Internet, Luz"
                      value={newCost.description}
                      onChange={(e) =>
                        setNewCost({ ...newCost, description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={newCost.category_id}
                      onValueChange={(value) =>
                        setNewCost({ ...newCost, category_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
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
                  <div>
                    <Label htmlFor="amount">Valor Mensal (R$)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newCost.amount}
                      onChange={(e) =>
                        setNewCost({ ...newCost, amount: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    onClick={handleAdd}
                    disabled={createMutation.isPending}
                    className="w-full"
                  >
                    {createMutation.isPending ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="p-6 mb-8 bg-gradient-to-br from-card via-card to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Total Mensal</p>
                <p className="text-4xl font-bold text-foreground">
                  R$ {totalMonthly.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredCosts.length} custo(s) fixo(s)
                </p>
              </div>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Receipt className="h-8 w-8 text-primary" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar custos fixos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Fixed Costs List */}
        {filteredCosts.length === 0 ? (
          <Card className="p-12 text-center">
            <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'Nenhum custo encontrado' : 'Nenhum custo fixo cadastrado'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {searchTerm
                ? 'Tente outro termo de busca'
                : 'Adicione seus custos fixos mensais como aluguel, internet, etc.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeiro Custo
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCosts.map((cost, index) => (
              <motion.div
                key={cost.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="p-4 hover:shadow-md transition-smooth">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{cost.description}</h4>
                      <p className="text-sm text-muted-foreground">
                        Adicionado em{' '}
                        {new Date(cost.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">
                          R$ {Number(cost.amount).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                      <div className="flex gap-2">
                        <Dialog open={editingCost?.id === cost.id} onOpenChange={(open) => !open && setEditingCost(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingCost(cost)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Custo Fixo</DialogTitle>
                            </DialogHeader>
                            {editingCost && (
                              <div className="space-y-4 mt-4">
                                <div>
                                  <Label>Descrição</Label>
                                  <Input
                                    value={editingCost.description}
                                    onChange={(e) =>
                                      setEditingCost({
                                        ...editingCost,
                                        description: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Categoria</Label>
                                  <Select
                                    value={editingCost.category_id || ''}
                                    onValueChange={(value) =>
                                      setEditingCost({
                                        ...editingCost,
                                        category_id: value || null,
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione uma categoria" />
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
                                <div>
                                  <Label>Valor Mensal (R$)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingCost.amount}
                                    onChange={(e) =>
                                      setEditingCost({
                                        ...editingCost,
                                        amount: parseFloat(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <Button
                                  onClick={handleUpdate}
                                  disabled={updateMutation.isPending}
                                  className="w-full"
                                >
                                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cost.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FixedCosts;
