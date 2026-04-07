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
  useUpdateCompanyTransaction,
  useUpdateCompanyCategory,
  useCreateCompanyCategory,
  useDeleteCompanyCategory,
} from '@/hooks/useCompanyFinancialData';
import ValueTagBadge from '@/components/ValueTagBadge';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/contexts/CurrencyContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { CurrencySelector } from '@/components/CurrencySelector';

const CompanyTransactions = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { formatAmount, currencyConfig, toBaseCurrency, convertAmount } = useCurrency();
  const {
    profile,
    loading,
    activeCompany,
    companyLoading,
  } = useAuth();

  const transactionTypes = [
    { label: t('transactions.types.expense'), value: 'despesa' as const },
    { label: t('transactions.types.income'), value: 'receita' as const },
  ];

  const isBR = i18n.resolvedLanguage === 'pt-BR';

  const paymentMethodOptions = isBR
    ? [
        { label: t('transactions.paymentMethods.pix'), value: 'Pix' },
        { label: t('transactions.paymentMethods.creditCard'), value: 'Cartão de Crédito' },
        { label: t('transactions.paymentMethods.debitCard'), value: 'Cartão de Débito' },
        { label: t('transactions.paymentMethods.ted'), value: 'TED' },
      ]
    : [
        { label: t('transactions.paymentMethods.zelle'), value: 'Zelle' },
        { label: t('transactions.paymentMethods.creditCard'), value: 'Credit Card' },
        { label: t('transactions.paymentMethods.debitCard'), value: 'Debit Card' },
        { label: t('transactions.paymentMethods.wireTransfer'), value: 'Wire Transfer' },
        { label: t('transactions.paymentMethods.ach'), value: 'ACH Transfer' },
        { label: t('transactions.paymentMethods.check'), value: 'Check' },
      ];

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const updateTransaction = useUpdateCompanyTransaction(activeCompany?.company_id);
  const deleteTransaction = useDeleteCompanyTransaction(activeCompany?.company_id);
  const updateCategory = useUpdateCompanyCategory(activeCompany?.company_id);
  const createCategory = useCreateCompanyCategory(activeCompany?.company_id);
  const deleteCategory = useDeleteCompanyCategory(activeCompany?.company_id);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#6366F1' });

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1).toLocaleDateString(
        i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'pt-BR',
        { month: 'long', year: 'numeric' }
      ),
    [month, year, i18n.resolvedLanguage]
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

  const resetForm = () => {
    setEditingId(null);
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
  };

  const handleEdit = (transaction: (typeof transactions)[number]) => {
    setEditingId(transaction.id);
    setNewTransaction({
      description: transaction.description,
      amount: String(convertAmount(Number(transaction.amount))),
      category_id: transaction.category_id ?? '',
      type: transaction.type as 'despesa' | 'receita',
      date: transaction.date,
      payment_method: transaction.payment_method ?? '',
      notes: transaction.notes ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!newTransaction.description || !newTransaction.amount) {
      toast.error(t('transactions.fillDescriptionAndValue'));
      return;
    }

    const amount = Number(newTransaction.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error(t('common.invalidValue'));
      return;
    }

    try {
      if (editingId) {
        await updateTransaction.mutateAsync({
          id: editingId,
          updates: {
            description: newTransaction.description,
            amount: toBaseCurrency(amount),
            type: newTransaction.type,
            category_id: newTransaction.category_id || null,
            date: newTransaction.date,
            notes: newTransaction.notes || null,
            payment_method: newTransaction.payment_method || null,
          },
        });
        toast.success(t('transactions.transactionUpdated'));
      } else {
        await createTransaction.mutateAsync({
          description: newTransaction.description,
          amount: toBaseCurrency(amount),
          type: newTransaction.type,
          category_id: newTransaction.category_id || null,
          date: newTransaction.date,
          notes: newTransaction.notes || null,
          payment_method: newTransaction.payment_method || null,
        } as any);
        toast.success(t('transactions.transactionCreated'));
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error(editingId ? t('transactions.transactionUpdateError') : t('transactions.transactionCreateError'));
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTransaction.mutateAsync(deletingId);
      toast.success(t('transactions.transactionRemoved'));
    } catch (error) {
      console.error('Erro ao remover transação:', error);
      toast.error(t('transactions.transactionRemoveError'));
    } finally {
      setDeletingId(null);
    }
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm({ name: '', color: '#6366F1' });
  };

  const handleEditCategory = (category: (typeof categories)[number]) => {
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name, color: category.color });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error(t('common.requiredFields'));
      return;
    }
    try {
      if (editingCategoryId) {
        await updateCategory.mutateAsync({
          id: editingCategoryId,
          updates: { name: categoryForm.name.trim(), color: categoryForm.color },
        });
        toast.success(t('transactions.categoryUpdated'));
      } else {
        await createCategory.mutateAsync({
          name: categoryForm.name.trim(),
          color: categoryForm.color,
        });
        toast.success(t('transactions.categoryCreated'));
      }
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
    } catch {
      toast.error(
        editingCategoryId
          ? t('transactions.categoryUpdateError')
          : t('transactions.categoryCreateError')
      );
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategoryId) return;
    try {
      await deleteCategory.mutateAsync(deletingCategoryId);
      toast.success(t('transactions.categoryRemoved'));
    } catch {
      toast.error(t('transactions.categoryRemoveError'));
    } finally {
      setDeletingCategoryId(null);
    }
  };

  if (loading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('transactions.loadingData')}</p>
        </div>
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          {t('transactions.noCompany')}
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
              <h1 className="text-2xl font-bold text-foreground">{t('transactions.title')}</h1>
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
              {t('common.today')}
            </Button>

            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('transactions.newTransaction')}
            </Button>

            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://wa.me/556132462163" target="_blank" rel="noopener noreferrer" aria-label="Registrar transação via WhatsApp">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span>{t('transactions.viaWhatsApp')}</span>
              </a>
            </Button>

            <LanguageSelector />
            <CurrencySelector />
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
                  <th className="px-4 py-3">{t('common.date')}</th>
                  <th className="px-4 py-3">{t('common.description')}</th>
                  <th className="px-4 py-3">{t('common.category')}</th>
                  <th className="px-4 py-3">{t('common.type')}</th>
                  <th className="px-4 py-3 text-right">{t('common.value')}</th>
                  <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {transactionsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {t('transactions.loadingTransactions')}
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {t('transactions.noTransactions')}
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
                        <span className="inline-flex items-center gap-1.5">
                          {transaction.company_categories?.name ?? t('common.noCategory')}
                          <ValueTagBadge valueTag={transaction.company_categories?.value_tag as 'essential' | 'optional' | null} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            transaction.type === 'despesa'
                              ? 'bg-danger/10 text-danger'
                              : 'bg-success/10 text-success'
                          }`}
                        >
                          {transaction.type === 'despesa' ? t('transactions.types.expense') : t('transactions.types.income')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatAmount(Number(transaction.amount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(transaction)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('transactions.categoryManagement')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('transactions.categoryManagementDescription')}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => { resetCategoryForm(); setIsCategoryDialogOpen(true); }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('transactions.addCategory')}
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('transactions.noCategories')}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCategory(category)}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingCategoryId(category.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-border/60 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t('transactions.categoryClassification')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('transactions.categoryClassificationDescription')}
          </p>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('transactions.noCategories')}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{category.name}</span>
                    <ValueTagBadge valueTag={category.value_tag as 'essential' | 'optional' | null} />
                  </div>
                  <Select
                    value={category.value_tag ?? 'none'}
                    onValueChange={(value) => {
                      const newTag = value === 'none' ? null : value;
                      updateCategory.mutate({
                        id: category.id,
                        updates: { value_tag: newTag },
                      });
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder={t('common.classify')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.none')}</SelectItem>
                      <SelectItem value="essential">{t('common.essential')}</SelectItem>
                      <SelectItem value="optional">{t('common.optional')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-border/60 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t('transactions.summaryByCategory')}</h2>
          {breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('transactions.noBreakdown')}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {breakdown.map((item) => (
                <div
                  key={item.category}
                  className="rounded-lg border border-border/40 bg-card/60 px-4 py-3"
                >
                  <div className="text-sm font-medium text-foreground">{item.category}</div>
                  <div className="text-xs text-muted-foreground">{item.count} {t('transactions.movements')}</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {formatAmount(item.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('transactions.editTransaction') : t('transactions.registerTransaction')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="description">{t('transactions.descriptionLabel')}</Label>
              <Input
                id="description"
                value={newTransaction.description}
                onChange={(event) => setNewTransaction((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))}
                placeholder={t('transactions.descriptionPlaceholder')}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="amount">{t('transactions.valueLabel', { symbol: currencyConfig.symbol })}</Label>
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
                    setAmountError(t('transactions.valueMustBePositive'));
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
              <Label>{t('transactions.categoryLabel')}</Label>
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
                  <SelectValue placeholder={t('common.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.noCategory')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>{t('transactions.typeLabel')}</Label>
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
              <Label>{t('transactions.dateLabel')}</Label>
              <Input
                type="date"
                value={newTransaction.date}
                onChange={(event) => setNewTransaction((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="payment_method">{t('transactions.paymentMethodLabel')}</Label>
              <Select
                value={newTransaction.payment_method || undefined}
                onValueChange={(value) =>
                  setNewTransaction((prev) => ({ ...prev, payment_method: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('transactions.paymentMethodPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">{t('transactions.notesLabel')}</Label>
              <Input
                id="notes"
                value={newTransaction.notes}
                onChange={(event) =>
                  setNewTransaction((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder={t('transactions.notesPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={createTransaction.isPending || updateTransaction.isPending || !!amountError}>
              {(createTransaction.isPending || updateTransaction.isPending) ? t('common.saving') : editingId ? t('common.save') : t('common.register')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('transactions.removeTransaction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('transactions.removeTransactionConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => { setIsCategoryDialogOpen(open); if (!open) resetCategoryForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? t('transactions.editCategory') : t('transactions.addCategory')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="categoryName">{t('transactions.categoryName')}</Label>
              <Input
                id="categoryName"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('transactions.categoryNamePlaceholder')}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="categoryColor">{t('transactions.categoryColor')}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="categoryColor"
                  type="color"
                  value={categoryForm.color}
                  onChange={(event) => setCategoryForm((prev) => ({ ...prev, color: event.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-border"
                />
                <span className="text-sm text-muted-foreground">{categoryForm.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsCategoryDialogOpen(false); resetCategoryForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveCategory} disabled={createCategory.isPending || updateCategory.isPending}>
              {(createCategory.isPending || updateCategory.isPending) ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCategoryId} onOpenChange={(open) => { if (!open) setDeletingCategoryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('transactions.removeCategory')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('transactions.removeCategoryConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyTransactions;
