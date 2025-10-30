import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  ArrowLeft,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const Transactions = () => {
  const { user } = useAuth();
  const now = new Date();
  const getInitialMonth = () => {
    if (typeof window === 'undefined') {
      return { month: now.getMonth() + 1, year: now.getFullYear() };
    }
    const saved = window.localStorage.getItem('dashboard-selected-month');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed?.month === 'number' &&
          typeof parsed?.year === 'number'
        ) {
          return { month: parsed.month, year: parsed.year };
        }
      } catch (error) {
        console.warn('Erro ao ler mês salvo:', error);
      }
    }
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  };

  const [selectedDate, setSelectedDate] = useState(getInitialMonth);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { month: currentMonth, year: currentYear } = selectedDate;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<{category: string; confidence: number; source: string} | null>(null);
  
  const { data: transactions, isLoading } = useTransactions(currentMonth, currentYear);
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const [newTransaction, setNewTransaction] = useState({
    description: '',
    amount: '',
    category: '',
    payment_method: '',
    type: 'despesa' as 'despesa' | 'receita',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const categories = [
    'Alimentação',
    'Transporte',
    'Saúde',
    'Educação',
    'Lazer',
    'Moradia',
    'Vestuário',
    'Serviços',
    'Receitas',
    'Sem categoria',
    'Outros',
  ];

  const paymentMethods = ['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Transferência'];
  const transactionTypes = [
    { label: 'Despesa', value: 'despesa' as const },
    { label: 'Receita', value: 'receita' as const },
  ];
  const isCurrentMonth = currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear();
  const fullDate = new Date(currentYear, currentMonth - 1);
  const monthLabel = fullDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const monthLabelShort = fullDate.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dashboard-selected-month', JSON.stringify(selectedDate));
    }
  }, [selectedDate]);

  const goToPreviousMonth = () => {
    setSelectedDate((prev) => {
      const date = new Date(prev.year, prev.month - 2, 1);
      return {
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      };
    });
  };

  const goToNextMonth = () => {
    setSelectedDate((prev) => {
      const date = new Date(prev.year, prev.month, 1);
      return {
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      };
    });
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setSelectedDate({
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    });
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount || !newTransaction.category) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      // Find category_id from category name
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id);

      if (catError) throw catError;

      const category = categories?.find(c => c.name === newTransaction.category);
      const category_id = category?.id || null;

      const amountValue = Math.abs(parseFloat(newTransaction.amount));
      if (Number.isNaN(amountValue)) {
        toast.error('Informe um valor válido');
        return;
      }

      await createTransaction.mutateAsync({
        description: newTransaction.description,
        amount: amountValue,
        type: newTransaction.type,
        date: newTransaction.date,
        category_id: category_id,
        user_id: '', // Will be set by the mutation hook
      } as any);

      // Save pattern for learning (silent - don't show errors to user)
      if (user?.id) {
        try {
          await supabase.functions.invoke('save-transaction-pattern', {
            body: {
              description: newTransaction.description,
              category: newTransaction.category,
              userId: user.id,
            },
          });
        } catch (patternError) {
          console.error('Error saving pattern:', patternError);
          // Don't show error to user - learning is a background operation
        }
      }

      toast.success('Transação adicionada!');
      setIsAddOpen(false);
      setNewTransaction({
        description: '',
        amount: '',
        category: '',
        payment_method: '',
        type: 'despesa',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });
      setSuggestedCategory(null);
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Erro ao adicionar transação');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta transação?')) return;

    try {
      await deleteTransaction.mutateAsync(id);
      toast.success('Transação excluída!');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Erro ao excluir transação');
    }
  };

  const handleClassifyTransaction = async () => {
    if (!newTransaction.description || !user?.id) {
      toast.error('Digite uma descrição primeiro');
      return;
    }

    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-transaction', {
        body: {
          description: newTransaction.description,
          userId: user.id,
          amount: newTransaction.amount ? parseFloat(newTransaction.amount) : undefined,
        },
      });

      if (error) throw error;

      setSuggestedCategory(data);
      setNewTransaction({ ...newTransaction, category: data.category });
      
      const confidencePercent = Math.round(data.confidence * 100);
      toast.success(`Categoria sugerida: ${data.category} (${confidencePercent}% de confiança)`);
    } catch (error) {
      console.error('Error classifying transaction:', error);
      toast.error('Erro ao classificar transação');
    } finally {
      setIsClassifying(false);
    }
  };

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryName = ((tx as any).categories?.name as string | undefined) ?? 'Sem categoria';
    const matchesCategory = filterCategory === 'all' || categoryName === filterCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">Transações</h1>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova Transação</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Transação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={newTransaction.description}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, description: e.target.value })
                    }
                    placeholder="Ex: Mercado Extra"
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Valor (R$) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="transaction-type">Tipo *</Label>
                  <Select
                    value={newTransaction.type}
                    onValueChange={(value: 'despesa' | 'receita') =>
                      setNewTransaction({ ...newTransaction, type: value })
                    }
                  >
                    <SelectTrigger id="transaction-type">
                      <SelectValue placeholder="Selecione o tipo" />
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

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 h-7 text-xs"
                      onClick={handleClassifyTransaction}
                      disabled={!newTransaction.description || isClassifying}
                    >
                      <Sparkles className="h-3 w-3" />
                      {isClassifying ? 'Classificando...' : 'Sugerir Categoria'}
                    </Button>
                  </div>
                  <Select
                    value={newTransaction.category}
                    onValueChange={(value) => {
                      setNewTransaction({ ...newTransaction, category: value });
                      setSuggestedCategory(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {suggestedCategory && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sugestão: {suggestedCategory.category} ({Math.round(suggestedCategory.confidence * 100)}% de confiança)
                      {suggestedCategory.source === 'history' && ' - baseado no seu histórico'}
                      {suggestedCategory.source === 'ai' && ' - sugerido por IA'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="payment_method">Forma de Pagamento</Label>
                  <Select
                    value={newTransaction.payment_method}
                    onValueChange={(value) =>
                      setNewTransaction({ ...newTransaction, payment_method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, date: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={newTransaction.notes}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, notes: e.target.value })
                    }
                    placeholder="Opcional"
                  />
                </div>

                <Button
                  onClick={handleAddTransaction}
                  className="w-full"
                  disabled={createTransaction.isPending}
                >
                  {createTransaction.isPending ? 'Salvando...' : 'Adicionar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search" className="sr-only">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar transações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="filter-category" className="sr-only">Filtrar por categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="filter-category">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-1 sm:col-span-2 md:col-span-1 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-3 font-medium min-w-[140px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline capitalize">{monthLabel}</span>
                    <span className="sm:hidden capitalize">{monthLabelShort}</span>
                    {!isCurrentMonth && (
                      <span
                        className="ml-2 text-xs bg-primary/20 text-primary px-1.5 rounded hover:bg-primary/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToCurrentMonth();
                          setIsCalendarOpen(false);
                        }}
                      >
                        Ver atual
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    month={new Date(currentYear, currentMonth - 1)}
                    selected={new Date(currentYear, currentMonth - 1)}
                    onMonthChange={(newMonth) => {
                      setSelectedDate({
                        month: newMonth.getMonth() + 1,
                        year: newMonth.getFullYear(),
                      });
                    }}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate({
                          month: date.getMonth() + 1,
                          year: date.getFullYear(),
                        });
                        setIsCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Transactions List */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {filteredTransactions.length} transações encontradas
          </h2>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma transação encontrada</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsAddOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira transação
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction, index) => {
                const categoryName = ((transaction as any).categories?.name as string | undefined) ?? 'Sem categoria';
                const amountNumber = Math.abs(Number(transaction.amount));
                const isIncome = transaction.type === 'receita';
                const formattedAmount = amountNumber.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });

                return (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-lg hover:bg-muted/50 transition-smooth border border-transparent hover:border-border"
                  >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {transaction.description}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {transaction.type === 'despesa' ? 'Despesa' : 'Receita'}
                      {' • '}
                      {categoryName || 'Sem categoria'}
                      {' • '}
                      <span className="hidden sm:inline">{format(new Date(transaction.date), 'dd/MM/yyyy')}</span>
                      <span className="sm:hidden">{format(new Date(transaction.date), 'dd/MM')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right">
                      <div
                        className={`font-semibold text-sm sm:text-base ${isIncome ? 'text-success' : 'text-danger'}`}
                      >
                        {isIncome ? '+' : '-'} R$ {formattedAmount}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-10 sm:w-10"
                      onClick={() => handleDeleteTransaction(transaction.id)}
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
