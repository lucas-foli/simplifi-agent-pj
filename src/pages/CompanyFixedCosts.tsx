import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencySelector } from '@/components/CurrencySelector';
import { LanguageSelector } from '@/components/LanguageSelector';
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
import { useCurrency } from '@/contexts/CurrencyContext';
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
  Bell,
  CalendarDays,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatAmountLive, formatAmountForInput, parseAmountFromInput } from '@/lib/currency';

const CompanyFixedCosts = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { formatAmount, convertAmount, currencyConfig, toBaseCurrency } = useCurrency();
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
    due_day: '',
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

  const filteredCosts = fixedCosts.filter((cost) =>
    cost.description.toLowerCase().includes(search.toLowerCase())
  );

  const total = filteredCosts.reduce((acc, cost) => acc + Number(cost.amount), 0);

  const resetForm = () => {
    setFormState({ description: '', amount: '', category_id: '', due_day: '' });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formState.description || !formState.amount) {
      toast.error(t('fixedCosts.fillDescriptionAndValue'));
      return;
    }

    const amount = parseAmountFromInput(formState.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error(t('common.invalidValue'));
      return;
    }

    const dueDay = formState.due_day ? Number(formState.due_day) : null;
    if (dueDay !== null && (Number.isNaN(dueDay) || dueDay < 1 || dueDay > 31 || !Number.isInteger(dueDay))) {
      toast.error(t('fixedCosts.invalidDueDay'));
      return;
    }

    try {
      if (editingId) {
        await updateCost.mutateAsync({
          id: editingId,
          updates: {
            description: formState.description,
            amount: toBaseCurrency(amount),
            category_id: formState.category_id || null,
            due_day: dueDay,
          },
        });
        toast.success(t('fixedCosts.fixedCostUpdated'));
      } else {
        await createCost.mutateAsync({
          description: formState.description,
          amount: toBaseCurrency(amount),
          category_id: formState.category_id || null,
          due_day: dueDay,
        });
        toast.success(t('fixedCosts.fixedCostCreated'));
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar custo fixo:', error);
      toast.error(t('fixedCosts.fixedCostSaveError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('fixedCosts.confirmDelete'))) return;
    try {
      await deleteCost.mutateAsync(id);
      toast.success(t('fixedCosts.fixedCostRemoved'));
    } catch (error) {
      console.error('Erro ao remover custo fixo:', error);
      toast.error(t('fixedCosts.fixedCostRemoveError'));
    }
  };

  if (loading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('fixedCosts.loadingData')}</p>
        </div>
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          {t('fixedCosts.noCompany')}
        </div>
      </div>
    );
  }

  const dateLocale = i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'pt-BR';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('fixedCosts.title')}</h1>
              <p className="text-xs text-muted-foreground">
                {t('fixedCosts.subtitle', { company: activeCompany.company.name })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('fixedCosts.newFixedCost')}
            </Button>
          </div>
      </div>

      <div className="space-y-6">
        <Card className="p-4 md:p-6 border-border/60 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-96">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('fixedCosts.searchPlaceholder')}
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t('fixedCosts.monthlyTotal')}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatAmount(total)}
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
                {t('fixedCosts.noCosts')}
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
                        {t('fixedCosts.updatedOn')} {new Date(cost.updated_at).toLocaleDateString(dateLocale)}
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
                            amount: formatAmountForInput(convertAmount(Number(cost.amount)), currencyConfig.locale),
                            category_id: cost.category_id ?? '',
                            due_day: cost.due_day != null ? cost.due_day.toString() : '',
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
                  {cost.due_day != null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{t('fixedCosts.dueDay', { day: cost.due_day })}</span>
                      <Bell className="h-3 w-3 ml-1 text-primary/60" title="WhatsApp reminders active" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {categories.find((category) => category.id === cost.category_id)?.name ?? t('common.noCategory')}
                    </span>
                    <span className="text-base font-semibold text-foreground">
                      {formatAmount(Number(cost.amount))}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('fixedCosts.editFixedCost') : t('fixedCosts.newFixedCost')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="description">{t('fixedCosts.descriptionLabel')}</Label>
              <Input
                id="description"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))}
                placeholder={t('fixedCosts.descriptionPlaceholder')}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="amount">{t('fixedCosts.monthlyValueLabel', { symbol: currencyConfig.symbol })}</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formState.amount}
                onChange={(event) => {
                  const formatted = formatAmountLive(event.target.value, currencyConfig.locale);
                  setFormState((prev) => ({ ...prev, amount: formatted }));
                }}
                placeholder="0,00"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>{t('fixedCosts.categoryLabel')}</Label>
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
              <Label htmlFor="due_day">{t('fixedCosts.dueDayLabel')}</Label>
              <Input
                id="due_day"
                type="number"
                min="1"
                max="31"
                step="1"
                value={formState.due_day}
                onChange={(event) => setFormState((prev) => ({
                  ...prev,
                  due_day: event.target.value,
                }))}
                placeholder={t('fixedCosts.dueDayPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('fixedCosts.dueDayHelp')}
              </p>
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
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={createCost.isPending || updateCost.isPending}>
              {editingId
                ? updateCost.isPending
                  ? t('common.saving')
                  : t('dashboard.saveChanges')
                : createCost.isPending
                  ? t('fixedCosts.creating')
                  : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyFixedCosts;
