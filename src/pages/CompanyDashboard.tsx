import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  MessageCircle,
  MessageSquare,
  PieChart as PieChartIcon,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import LogoutButton from '@/components/LogoutButton';
import { supabase } from '@/lib/supabase';
import {
  useCompanyDashboardSummary,
  useCompanyFixedCosts,
  useCompanyTransactions,
  useCompanyTransactionsByCategory,
  useSetCompanyMonthlyRevenue,
} from '@/hooks/useCompanyFinancialData';
import CashFlowForecast from '@/components/CashFlowForecast';
import ValueTagBreakdown from '@/components/ValueTagBreakdown';
import { branding } from '@/config/branding';
import {
  createWhatsAppLink,
  fetchLatestWhatsAppLink,
  type WhatsAppLinkRecord,
  type WhatsAppLinkResponse,
} from '@/lib/whatsapp';

const COLORS = [
  '#0B59A3',
  '#2ECC71',
  '#F39C12',
  '#E74C3C',
  '#9B59B6',
  '#1ABC9C',
  '#E67E22',
  '#34495E',
];

const CompanyDashboard = () => {
  const navigate = useNavigate();
  const {
    profile,
    loading,
    companyLoading,
    companyMemberships,
    activeCompany,
    setActiveCompany,
  } = useAuth();

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [revenueInput, setRevenueInput] = useState('');
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<WhatsAppLinkResponse | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppLinkRecord | null>(null);
  const [whatsappStatusLoading, setWhatsappStatusLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappError, setWhatsappError] = useState('');

  const { month: selectedMonth, year: selectedYear } = selectedDate;

  useEffect(() => {
    if (!loading && profile && profile.user_type !== 'pessoa_juridica') {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, profile, navigate]);

  const { data: summary, isLoading: summaryLoading } = useCompanyDashboardSummary(
    activeCompany?.company_id,
    selectedMonth,
    selectedYear
  );

  const { data: transactions, isLoading: transactionsLoading } = useCompanyTransactions(
    activeCompany?.company_id,
    selectedMonth,
    selectedYear
  );

  const { data: allTransactions, isLoading: allTransactionsLoading } = useCompanyTransactions(
    activeCompany?.company_id
  );

  const { data: fixedCosts, isLoading: fixedCostsLoading } = useCompanyFixedCosts(
    activeCompany?.company_id
  );

  const { data: categoryBreakdown } = useCompanyTransactionsByCategory(
    activeCompany?.company_id,
    selectedMonth,
    selectedYear
  );

  const setCompanyRevenue = useSetCompanyMonthlyRevenue(activeCompany?.company_id);
  const logoSrc = branding.logo?.mark || branding.logo?.horizontal;
  const logoAlt = branding.brandName || activeCompany?.company?.name || 'Logo';

  useEffect(() => {
    if (summary?.revenue !== undefined) {
      setRevenueInput(summary.revenue ? summary.revenue.toString() : '');
    }
  }, [summary?.revenue]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const goToPreviousMonth = () => {
    const date = new Date(selectedYear, selectedMonth - 2, 1);
    setSelectedDate({
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    });
  };

  const goToNextMonth = () => {
    const date = new Date(selectedYear, selectedMonth, 1);
    setSelectedDate({
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    });
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setSelectedDate({
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    });
  };

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );
  const whatsappExpiryLabel = whatsappLink?.expiresAt
    ? new Date(whatsappLink.expiresAt).toLocaleString('pt-BR')
    : null;
  const whatsappStatusExpiryLabel = whatsappStatus?.pairing_expires_at
    ? new Date(whatsappStatus.pairing_expires_at).toLocaleString('pt-BR')
    : null;
  const whatsappPhoneSuffix = whatsappStatus?.phone
    ? whatsappStatus.phone.slice(-4)
    : null;
  const whatsappStatusLabel = whatsappStatus
    ? whatsappStatus.status === 'linked'
      ? `Conectado${whatsappPhoneSuffix ? ` • final ${whatsappPhoneSuffix}` : ''}`
      : whatsappStatus.status === 'pending'
        ? 'Pendente de confirmação'
        : 'Vínculo revogado'
    : 'Não conectado';

  const handleRevenueSave = async () => {
    if (!activeCompany?.company_id) return;
    const value = Number(revenueInput);

    if (Number.isNaN(value)) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      await setCompanyRevenue.mutateAsync(value);
      toast.success('Faturamento atualizado!');
      setIsRevenueDialogOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar faturamento:', error);
      toast.error('Não foi possível atualizar o faturamento');
    }
  };

  const handleAuthExpired = async () => {
    await supabase.auth.signOut();
    toast.error('Sessão expirada. Faça login novamente.');
    navigate('/login');
  };

  const isInvalidJwtError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /invalid jwt/i.test(message);
  };

  const isAuthError = (error: unknown) => {
    if (isInvalidJwtError(error)) return false;
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /jwt expired|not authenticated/i.test(message);
  };

  const loadWhatsAppStatus = async () => {
    if (!activeCompany?.company_id) {
      setWhatsappStatus(null);
      return;
    }

    setWhatsappStatusLoading(true);
    try {
      const status = await fetchLatestWhatsAppLink(activeCompany.company_id);
      setWhatsappStatus(status);
    } catch (error) {
      console.error('Erro ao carregar status WhatsApp:', error);
      if (isInvalidJwtError(error)) {
        setWhatsappError(
          'JWT inválido para este projeto. Verifique VITE_SUPABASE_URL/ANON_KEY do PJ.'
        );
        toast.error('JWT inválido');
        setWhatsappStatus(null);
        return;
      }
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      setWhatsappStatus(null);
    } finally {
      setWhatsappStatusLoading(false);
    }
  };

  const handleGenerateWhatsAppLink = async () => {
    if (whatsappLoading) return;
    setWhatsappLoading(true);
    setWhatsappError('');
    try {
      if (!activeCompany?.company_id) {
        throw new Error('Empresa não encontrada. Finalize o cadastro PJ.');
      }

      const link = await createWhatsAppLink(activeCompany.company_id);
      setWhatsappLink(link);
      await loadWhatsAppStatus();
      toast.success('Código gerado! Envie no WhatsApp para concluir o vínculo.');
    } catch (error) {
      console.error('Erro ao gerar código WhatsApp:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar código';
      if (isInvalidJwtError(error)) {
        setWhatsappError(
          'JWT inválido para este projeto. Verifique VITE_SUPABASE_URL/ANON_KEY do PJ.'
        );
        toast.error('JWT inválido');
        return;
      }
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      setWhatsappError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setWhatsappLoading(false);
    }
  };

  useEffect(() => {
    loadWhatsAppStatus();
  }, [activeCompany?.company_id]);

  if (loading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando informações da empresa...</p>
        </div>
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Nenhuma empresa encontrada</CardTitle>
            <CardDescription>
              Finalize o cadastro ou convide um administrador para te vincular a uma empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/onboarding')}>
              <Building2 className="h-4 w-4 mr-2" />
              Concluir cadastro PJ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Faturamento Base',
      value: currencyFormatter.format(summary?.revenue ?? 0),
      icon: DollarSign,
      color: 'text-primary',
      background: 'bg-primary/10',
      action: () => setIsRevenueDialogOpen(true),
      actionLabel: 'Editar',
    },
    {
      label: 'Custos Fixos',
      value: currencyFormatter.format(summary?.fixedCosts ?? 0),
      icon: Receipt,
      color: 'text-warning',
      background: 'bg-warning/10',
    },
    {
      label: 'Despesas do Mês',
      value: currencyFormatter.format(summary?.expenses ?? 0),
      icon: TrendingDown,
      color: 'text-danger',
      background: 'bg-danger/10',
    },
    {
      label: 'Receitas Registradas',
      value: currencyFormatter.format(summary?.transactionIncome ?? 0),
      icon: TrendingUp,
      color: 'text-success',
      background: 'bg-success/10',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={`${logoAlt} logotipo`}
                  className="h-6 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <Building2 className="h-6 w-6 text-primary" />
              )}
              {activeCompany.company.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              Visão geral financeira da empresa
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {companyMemberships.length > 1 && (
              <Select
                value={activeCompany.company_id}
                onValueChange={(value) => setActiveCompany(value)}
              >
                <SelectTrigger className="w-full md:w-72">
                  <SelectValue placeholder="Selecionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companyMemberships.map((company) => (
                    <SelectItem key={company.company_id} value={company.company_id}>
                      {company.company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Resumo Mensal</h2>
            <p className="text-xs text-muted-foreground">
              Analise faturamento, custos e resultado operacional
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:border-primary/50 transition-smooth"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {format(new Date(selectedYear, selectedMonth - 1), "MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={new Date(selectedYear, selectedMonth - 1)}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate({ month: date.getMonth() + 1, year: date.getFullYear() });
                    setIsCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

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
          </div>
        </section>

        <section className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/30 bg-primary/5 hover:border-primary/50 transition-smooth">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Lucro Líquido
                  </span>
                </div>
                <div
                  className={`text-4xl md:text-5xl font-extrabold tracking-tight ${
                    (summary?.remaining ?? 0) >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {currencyFormatter.format(summary?.remaining ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Receita total - Despesas totais do mês
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-border/60 hover:border-primary/40 transition-smooth h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {kpi.label}
                    </CardTitle>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                    {kpi.action ? (
                      <Button
                        variant="link"
                        className="px-0 text-xs mt-1"
                        onClick={kpi.action}
                      >
                        {kpi.actionLabel}
                      </Button>
                    ) : (
                      <div className="h-[28px]" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <CashFlowForecast
            currentBalance={summary?.remaining ?? 0}
            monthlyFixedCosts={summary?.fixedCosts ?? 0}
            transactions={
              allTransactions?.map((t) => ({
                amount: Number(t.amount),
                type: t.type,
                date: t.date,
              })) ?? []
            }
            isLoading={summaryLoading || allTransactionsLoading}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 order-2 lg:order-1 border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">Últimas movimentações</CardTitle>
                <CardDescription>Mês de {monthLabel}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/company/transactions')}>
                Ver transações
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {summaryLoading || transactionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.slice(0, 8).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.date), 'dd/MM/yyyy')} •{' '}
                          {transaction.type === 'despesa' ? 'Despesa' : 'Receita'}
                        </p>
                      </div>
                      <span
                        className={`font-semibold ${
                          transaction.type === 'despesa' ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {currencyFormatter.format(Number(transaction.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-12">
                  Nenhuma movimentação registrada para este período.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="order-1 lg:order-2 space-y-4">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4" />
                    Distribuição por categoria
                  </CardTitle>
                  <CardDescription>Resumo das despesas e receitas por categoria</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="h-[160px] md:h-[200px]">
                {categoryBreakdown && categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        innerRadius="40%"
                        paddingAngle={4}
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Categorias serão exibidas conforme as movimentações forem registradas.
                  </div>
                )}
              </CardContent>
            </Card>

            <ValueTagBreakdown
              transactions={transactions ?? []}
              isLoading={transactionsLoading}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">Custos Fixos</CardTitle>
                <CardDescription>Compromissos recorrentes da operação</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/company/fixed-costs')}>
                Gerenciar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {fixedCostsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : fixedCosts && fixedCosts.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {fixedCosts.slice(0, 6).map((cost) => (
                      <div
                        key={cost.id}
                        className="flex items-center justify-between rounded-lg border border-border/40 bg-card/50 px-4 py-2.5"
                      >
                        <div>
                          <p className="font-medium text-foreground">{cost.description}</p>
                          <p className="text-xs text-muted-foreground">Atualizado em {format(new Date(cost.updated_at), 'dd/MM/yyyy')}</p>
                        </div>
                        <span className="font-semibold text-foreground">
                          {currencyFormatter.format(Number(cost.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 pt-3">
                    <span className="text-sm text-muted-foreground">Total mensal</span>
                    <span className="font-semibold text-foreground">
                      {currencyFormatter.format(
                        fixedCosts.reduce((acc, cost) => acc + Number(cost.amount), 0)
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-10">
                  Cadastre os custos fixos para acompanhar o comprometimento mensal da empresa.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Próximos passos</CardTitle>
              <CardDescription>Atalhos para começar a usar o assistente PJ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Status do WhatsApp</span>
                <span className="font-medium text-foreground">
                  {whatsappStatusLoading ? 'Carregando...' : whatsappStatusLabel}
                </span>
              </div>
              <Button className="w-full justify-between" onClick={() => navigate('/company/transactions')}>
                Registrar nova transação
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                asChild
              >
                <a href="https://wa.me/556132462163" target="_blank" rel="noopener noreferrer">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    Registrar via WhatsApp
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/company/fixed-costs')}>
                Adicionar custo fixo
                <ArrowRight className="h-4 w-4" />
              </Button>
              {whatsappStatus?.status !== 'linked' && (
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setIsWhatsAppDialogOpen(true)}
                >
                  Conectar WhatsApp
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" className="w-full justify-between" onClick={() => navigate('/chat')}>
                Consultar assistente financeiro
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar faturamento mensal</DialogTitle>
            <DialogDescription>
              Informe o faturamento médio mensal da empresa para projeções mais precisas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground" htmlFor="revenue">
              Valor (R$)
            </label>
            <Input
              id="revenue"
              value={revenueInput}
              onChange={(event) => setRevenueInput(event.target.value)}
              placeholder="50.000"
            />
            <p className="text-xs text-muted-foreground">
              Utilize números inteiros ou decimais com ponto. Exemplo: 75000.50
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsRevenueDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRevenueSave} disabled={setCompanyRevenue.isPending}>
              {setCompanyRevenue.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Gere um código e envie para o WhatsApp do SimplifiQA para concluir o vínculo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p>1) Gere o código.</p>
                <p>2) Envie para o número do SimplifiQA.</p>
                <p>3) Aguarde a confirmação automática.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Status atual</span>
              <span className="font-medium text-foreground">
                {whatsappStatusLoading ? 'Carregando...' : whatsappStatusLabel}
              </span>
            </div>

            {whatsappLink ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground mb-1">Seu código</p>
                <div className="text-2xl font-mono tracking-widest text-primary">
                  {whatsappLink.code}
                </div>
                {whatsappExpiryLabel && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Expira em {whatsappExpiryLabel}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum código gerado ainda.</p>
            )}

            {whatsappStatus?.status === 'pending' && whatsappStatusExpiryLabel && (
              <p className="text-xs text-muted-foreground">
                Código pendente expira em {whatsappStatusExpiryLabel}.
              </p>
            )}

            {whatsappError && (
              <p className="text-xs text-danger">{whatsappError}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsWhatsAppDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleGenerateWhatsAppLink} disabled={whatsappLoading}>
              {whatsappLoading ? 'Gerando...' : whatsappLink ? 'Gerar novo código' : 'Gerar código'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyDashboard;
