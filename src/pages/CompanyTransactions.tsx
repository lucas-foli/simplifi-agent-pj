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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  useCompanyTransactions,
  useCompanyTransactionsByCategory,
  useCreateCompanyTransaction,
  useDeleteCompanyTransaction,
} from '@/hooks/useCompanyFinancialData';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const transactionTypes = [
  { label: 'Despesa', value: 'despesa' as const },
  { label: 'Receita', value: 'receita' as const },
];

const paymentMethodOptions = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'TED'];

const CompanyTransactions = () => {
  const navigate = useNavigate();
  const {
    profile,
    loading,
    activeCompany,
    companyLoading,
  } = useAuth();

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newTransaction, setNewTransaction] = useState({
    description: '',
    amount: '',
    category_id: '',
    type: 'despesa' as 'despesa' | 'receita',
    date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: '',
    notes: '',
  });
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    if (!loading && profile && profile.user_type !== 'pessoa_juridica') {
      navigate('/transactions', { replace: true });
    }
  }, [loading, profile, navigate]);

  const { month, year } = selectedDate;

  const { data: categories = [], isLoading: categoriesLoading } = useCompanyCategories(
    activeCompany?.company_id
  );

  const { data: transactions = [], isLoading: transactionsLoading } = useCompanyTransactions(
    activeCompany?.company_id,
    month,
    year
  );

  const { data: breakdown = [] } = useCompanyTransactionsByCategory(
    activeCompany?.company_id,
    month,
    year
  );

  const createTransaction = useCreateCompanyTransaction(activeCompany?.company_id);
  const deleteTransaction = useDeleteCompanyTransaction(activeCompany?.company_id);

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [month, year]
  );

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const goToPreviousMonth = () => {
    const date = new Date(year, month - 2, 1);
    setSelectedDate({ month: date.getMonth() + 1, year: date.getFullYear() });
  };

  const goToNextMonth = () => {
    const date = new Date(year, month, 1);
    setSelectedDate({ month: date.getMonth() + 1, year: date.getFullYear() });
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setSelectedDate({ month: today.getMonth() + 1, year: today.getFullYear() });
  };

  const handleCreate = async () => {
    if (!newTransaction.description || !newTransaction.amount) {
      toast.error('Informe descrição e valor');
      return;
    }

    const amount = Number(newTransaction.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      await createTransaction.mutateAsync({
        description: newTransaction.description,
        amount,
        type: newTransaction.type,
        category_id: newTransaction.category_id || null,
        date: newTransaction.date,
        notes: newTransaction.notes || null,
        payment_method: newTransaction.payment_method || null,
      } as any);
      toast.success('Transação registrada!');
      setIsDialogOpen(false);
      setAmountError('');
      setNewTransaction({
        description: '',
        amount: '',
        category_id: '',
        type: 'despesa',
        date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: '',
        notes: '',
      });
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      toast.error('Não foi possível registrar a transação');
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTransaction.mutateAsync(deletingId);
      toast.success('Transação removida');
    } catch (error) {
      console.error('Erro ao remover transação:', error);
      toast.error('Não foi possível remover a transação');
    } finally {
      setDeletingId(null);
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
          Selecione ou cadastre uma empresa para registrar transações.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/company/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline"></span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transações da empresa</h1>
              <p className="text-sm text-muted-foreground">
                {activeCompany.company.name} • {monthLabel}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground">
              <Calendar className="h-4 w-4" />
              {monthLabel}
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <Button variant="outline" onClick={goToCurrentMonth}>
              Hoje
            </Button>

            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova transação
            </Button>

            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://wa.me/556132462163" target="_blank" rel="noopener noreferrer" aria-label="Registrar transação via WhatsApp">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span>Via WhatsApp</span>
              </a>
            </Button>

            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card className="border-border/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] divide-y divide-border/60">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {transactionsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Carregando transações...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhuma transação registrada neste período.
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-card/60 transition-smooth">
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(transaction.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {transaction.description}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {transaction.company_categories?.name ?? 'Sem categoria'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            transaction.type === 'despesa'
                              ? 'bg-danger/10 text-danger'
                              : 'bg-success/10 text-success'
                          }`}
                        >
                          {transaction.type === 'despesa' ? 'Despesa' : 'Receita'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {currencyFormatter.format(Number(transaction.amount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(transaction.id)}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-border/60 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Resumo por categoria</h2>
          {breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Registre transações para visualizar a distribuição entre categorias.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {breakdown.map((item) => (
                <div
                  key={item.category}
                  className="rounded-lg border border-border/40 bg-card/60 px-4 py-3"
                >
                  <div className="text-sm font-medium text-foreground">{item.category}</div>
                  <div className="text-xs text-muted-foreground">{item.count} movimentações</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {currencyFormatter.format(item.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar transação</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={newTransaction.description}
                onChange={(event) => setNewTransaction((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))}
                placeholder="Ex.: Serviço de consultoria"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={newTransaction.amount}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewTransaction((prev) => ({ ...prev, amount: value }));
                  const num = Number(value);
                  if (value && (!Number.isNaN(num) && num <= 0)) {
                    setAmountError('O valor deve ser maior que zero');
                  } else {
                    setAmountError('');
                  }
                }}
                placeholder="1000.00"
                className={amountError ? 'border-destructive' : ''}
              />
              {amountError && (
                <p className="text-xs text-destructive mt-1">{amountError}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={newTransaction.category_id || 'none'}
                onValueChange={(value) =>
                  setNewTransaction((prev) => ({
                    ...prev,
                    category_id: value === 'none' ? '' : value,
                  }))
                }
                disabled={categoriesLoading}
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
              <Label>Tipo</Label>
              <Select
                value={newTransaction.type}
                onValueChange={(value) =>
                  setNewTransaction((prev) => ({ ...prev, type: value as 'despesa' | 'receita' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {transactionTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={newTransaction.date}
                onChange={(event) => setNewTransaction((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="payment_method">Forma de pagamento</Label>
              <Select
                value={newTransaction.payment_method || undefined}
                onValueChange={(value) =>
                  setNewTransaction((prev) => ({ ...prev, payment_method: value }))
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

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={newTransaction.notes}
                onChange={(event) =>
                  setNewTransaction((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="Informações adicionais"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createTransaction.isPending || !!amountError}>
              {createTransaction.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover transação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyTransactions;
