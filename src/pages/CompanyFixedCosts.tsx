import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import LogoutButton from '@/components/LogoutButton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import {
  useCompanyCategories,
  useCompanyFixedCosts,
  useCreateCompanyFixedCost,
  useDeleteCompanyFixedCost,
  useUpdateCompanyFixedCost,
} from '@/hooks/useCompanyFinancialData';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const paymentMethodOptions = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'TED'];

const CompanyFixedCosts = () => {
  const navigate = useNavigate();
  const {
    profile,
    loading,
    activeCompany,
    companyLoading,
  } = useAuth();

  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    description: '',
    amount: '',
    category_id: '',
    payment_method: '',
  });

  useEffect(() => {
    if (!loading && profile && profile.user_type !== 'pessoa_juridica') {
      navigate('/fixed-costs', { replace: true });
    }
  }, [loading, profile, navigate]);

  const { data: categories = [] } = useCompanyCategories(activeCompany?.company_id);
  const { data: fixedCosts = [], isLoading } = useCompanyFixedCosts(activeCompany?.company_id);

  const createCost = useCreateCompanyFixedCost(activeCompany?.company_id);
  const updateCost = useUpdateCompanyFixedCost(activeCompany?.company_id);
  const deleteCost = useDeleteCompanyFixedCost(activeCompany?.company_id);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const filteredCosts = fixedCosts.filter((cost) =>
    cost.description.toLowerCase().includes(search.toLowerCase())
  );

  const total = filteredCosts.reduce((acc, cost) => acc + Number(cost.amount), 0);

  const resetForm = () => {
    setFormState({ description: '', amount: '', category_id: '', payment_method: '' });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formState.description || !formState.amount) {
      toast.error('Preencha descrição e valor');
      return;
    }

    const amount = Number(formState.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      if (editingId) {
        await updateCost.mutateAsync({
          id: editingId,
          updates: {
            description: formState.description,
            amount,
            category_id: formState.category_id || null,
            payment_method: formState.payment_method || null,
          } as any,
        });
        toast.success('Custo fixo atualizado!');
      } else {
        await createCost.mutateAsync({
          description: formState.description,
          amount,
          category_id: formState.category_id || null,
          payment_method: formState.payment_method || null,
        } as any);
        toast.success('Custo fixo criado!');
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar custo fixo:', error);
      toast.error('Não foi possível salvar o custo fixo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este custo fixo?')) return;
    try {
      await deleteCost.mutateAsync(id);
      toast.success('Custo fixo removido');
    } catch (error) {
      console.error('Erro ao remover custo fixo:', error);
      toast.error('Não foi possível remover o custo fixo');
    }
  };

  if (loading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          Selecione ou cadastre uma empresa para gerenciar custos fixos.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/company/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline"></span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Custos fixos</h1>
              <p className="text-sm text-muted-foreground">
                Controle compromissos recorrentes da empresa {activeCompany.company.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo custo fixo
            </Button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card className="p-4 md:p-6 border-border/60 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-96">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total mensal</p>
              <p className="text-xl font-semibold text-foreground">
                {currencyFormatter.format(total)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <div className="md:col-span-2 xl:col-span-3 flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredCosts.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 text-center text-muted-foreground py-12">
                Nenhum custo fixo encontrado para a busca atual.
              </div>
            ) : (
              filteredCosts.map((cost) => (
                <motion.div
                  key={cost.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg border border-border/50 bg-card/60 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{cost.description}</h3>
                      <p className="text-xs text-muted-foreground">
                        Atualizado em {new Date(cost.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(cost.id);
                          setFormState({
                            description: cost.description,
                            amount: Number(cost.amount).toString(),
                            category_id: cost.category_id ?? '',
                            payment_method: ((cost as any).payment_method as string | null) ?? '',
                          });
                          setIsDialogOpen(true);
                        }}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cost.id)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {categories.find((category) => category.id === cost.category_id)?.name ?? 'Sem categoria'}
                    </span>
                    <span className="text-base font-semibold text-foreground">
                      {currencyFormatter.format(Number(cost.amount))}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </main>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar custo fixo' : 'Novo custo fixo'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))}
                placeholder="Ex.: Aluguel, Folha de pagamento"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="amount">Valor mensal (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formState.amount}
                onChange={(event) => setFormState((prev) => ({
                  ...prev,
                  amount: event.target.value,
                }))}
                placeholder="5000.00"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={formState.category_id || 'none'}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    category_id: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select
                value={formState.payment_method || undefined}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    payment_method: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createCost.isPending || updateCost.isPending}>
              {editingId
                ? updateCost.isPending
                  ? 'Salvando...'
                  : 'Salvar alterações'
                : createCost.isPending
                  ? 'Criando...'
                  : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyFixedCosts;
