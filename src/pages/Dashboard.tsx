import { FileUpload } from "@/components/FileUpload";
import { FixedCostImport } from "@/components/FixedCostImport";
import { TransactionReview } from "@/components/TransactionReview";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIInsights } from "@/hooks/useAIInsights";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardSummary, useSetMonthlyIncome } from "@/hooks/useFinancialData";
import {
  useTransactions,
  useTransactionsByCategory,
} from "@/hooks/useTransactions";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const now = new Date();

  // Get selected month from localStorage or use current month
  const getInitialMonth = () => {
    const saved = localStorage.getItem("dashboard-selected-month");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { month: parsed.month, year: parsed.year };
    }
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  };

  const [selectedDate, setSelectedDate] = useState(getInitialMonth());
  const { month: selectedMonth, year: selectedYear } = selectedDate;

  // Persist selected month to localStorage
  useEffect(() => {
    localStorage.setItem(
      "dashboard-selected-month",
      JSON.stringify(selectedDate)
    );
  }, [selectedDate]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    []
  );

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(
    selectedMonth,
    selectedYear
  );
  const { data: transactions, isLoading: transactionsLoading } =
    useTransactions(selectedMonth, selectedYear);
  const { data: categoryData, isLoading: categoryLoading } =
    useTransactionsByCategory(selectedMonth, selectedYear);
  const { data: aiInsight, isLoading: insightLoading } = useAIInsights();
  const setMonthlyIncome = useSetMonthlyIncome();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [balanceValue, setBalanceValue] = useState(0);
  const [extractedTransactions, setExtractedTransactions] = useState<any[]>([]);
  const targetBalance = summary?.remaining ?? null;

  // Navigation functions
  const goToPreviousMonth = () => {
    const newMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const newYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    setSelectedDate({ month: newMonth, year: newYear });
  };

  const goToNextMonth = () => {
    const newMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const newYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    setSelectedDate({ month: newMonth, year: newYear });
  };

  const goToCurrentMonth = () => {
    setSelectedDate({ month: now.getMonth() + 1, year: now.getFullYear() });
  };

  const isCurrentMonth =
    selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  // Animate balance count-up
  useEffect(() => {
    if (targetBalance === null || summaryLoading) return;

    const duration = 1000;
    const steps = 60;
    const increment = targetBalance / steps;
    let current = 0;

  const timer = setInterval(() => {
    current += increment;
    if (current >= targetBalance) {
      setBalanceValue(targetBalance);
      clearInterval(timer);
      } else {
        setBalanceValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [targetBalance, summaryLoading]);

  const monthlyIncomeValue = summary?.income ?? 0;
  const fixedCostsValue = summary?.fixedCosts ?? 0;
  const expensesValue = summary?.expenses ?? 0;
  const transactionIncomeValue = summary?.transactionIncome ?? 0;

  const kpis = [
    {
      label: "Receita Mensal",
      value: currencyFormatter.format(monthlyIncomeValue),
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
      editable: true,
    },
    {
      label: "Custos Fixos",
      value: currencyFormatter.format(fixedCostsValue),
      icon: Receipt,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Gastos do Mês",
      value: currencyFormatter.format(expensesValue),
      icon: TrendingDown,
      color: "text-danger",
      bgColor: "bg-danger/10",
    },
    {
      label: "Receitas Registradas",
      value: currencyFormatter.format(transactionIncomeValue),
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const colors = [
    "#0B59A3",
    "#2ECC71",
    "#F39C12",
    "#E74C3C",
    "#9B59B6",
    "#1ABC9C",
    "#E67E22",
  ];

  const chartData =
    categoryData?.map((cat: any, index: number) => ({
      name: cat.category,
      value: cat.total,
      color: colors[index % colors.length],
    })) || [];

  const recentTransactions =
    transactions?.slice(0, 4).map((tx) => ({
      id: tx.id,
      description: tx.description,
      category: (tx as any).categories?.name || "Sem categoria",
      amount:
        tx.type === "receita"
          ? Number(tx.amount)
          : -Number(tx.amount),
      date: new Date(tx.date).toLocaleDateString("pt-BR"),
      type: tx.type === "despesa" ? "Despesa" : "Receita",
    })) || [];

  const monthName = new Date(
    selectedYear,
    selectedMonth - 1
  ).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const sanitizeIncomeInput = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.,]/g, "");
    if (!cleaned) return "";
    const parsed = parseIncomeValue(cleaned);
    if (Number.isNaN(parsed)) return "";
    return numberFormatter.format(parsed);
  };

  const parseIncomeValue = (value: string) => {
    const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    return Number(normalized);
  };

  const buildSummaryMessage = () => {
    if (!summary) return "";

    const lines = [
      `SimplifiQA · Resumo de ${monthName}`,
      `Receita mensal: ${currencyFormatter.format(monthlyIncomeValue)}`,
      `Receitas registradas: ${currencyFormatter.format(transactionIncomeValue)}`,
      `Custos Fixos: ${currencyFormatter.format(fixedCostsValue)}`,
      `Despesas: ${currencyFormatter.format(expensesValue)}`,
      `Saldo restante: ${currencyFormatter.format(summary.remaining ?? 0)}`,
    ];

    if (chartData.length > 0) {
      const topCategories = chartData
        .slice(0, 3)
        .map(
          (cat) =>
            `${cat.name}: ${currencyFormatter.format(Number(cat.value) ?? 0)}`
        );

      lines.push("Principais categorias:", ...topCategories);
    }

    lines.push("Gerado automaticamente pelo SimplifiQA.");

    return lines.join("\n");
  };

  const handleSendWhatsAppSummary = async () => {
    if (!user?.id) {
      toast.error("É necessário estar autenticado para enviar mensagens.");
      return;
    }

    if (!summary) {
      toast.error("Resumo indisponível. Tente novamente em instantes.");
      return;
    }

    const sanitizedPhone = whatsAppPhone.trim();
    if (sanitizedPhone.length < 6) {
      toast.warning("Informe um número de WhatsApp válido.");
      return;
    }

    const message = buildSummaryMessage();
    if (!message) {
      toast.error("Não foi possível montar o resumo para envio.");
      return;
    }

    try {
      setIsSendingWhatsApp(true);
      await sendWhatsAppMessage({
        userId: user.id,
        to: sanitizedPhone,
        message,
      });
      toast.success("Resumo enviado via WhatsApp!");
      setIsWhatsAppDialogOpen(false);
    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      toast.error("Não foi possível enviar a mensagem no momento.");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleSaveMonthlyIncome = async () => {
    if (!incomeInput.trim()) {
      toast.error("Informe um valor válido para a receita mensal.");
      return;
    }

    const parsed = parseIncomeValue(incomeInput);
    if (Number.isNaN(parsed)) {
      toast.error("Informe um valor válido para a receita mensal.");
      return;
    }

    try {
      await setMonthlyIncome.mutateAsync(parsed);
      toast.success("Receita mensal atualizada!");
      setIsIncomeDialogOpen(false);
    } catch (error) {
      console.error("Erro ao atualizar receita mensal:", error);
      toast.error("Não foi possível atualizar a receita mensal.");
    }
  };

  if (summaryLoading) {
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
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              SimplifiQA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2 hidden md:inline">
              Olá, {profile?.full_name || user?.email}
            </span>

            {/* Month Selector */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-3 font-medium min-w-[140px]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {monthName}
                    {!isCurrentMonth && (
                      <span
                        className="ml-2 text-xs bg-primary/20 text-primary px-1.5 rounded hover:bg-primary/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToCurrentMonth();
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
                    month={new Date(selectedYear, selectedMonth - 1)}
                    selected={new Date(selectedYear, selectedMonth - 1)}
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

            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex gap-2"
              onClick={() => setIsWhatsAppDialogOpen(true)}
            >
              <MessageSquare className="h-4 w-4" />
              Enviar resumo
            </Button>

            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar resumo via WhatsApp</DialogTitle>
            <DialogDescription>
              Informe o número com DDD (somente dígitos ou com +) para receber o resumo do mês atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">Número de WhatsApp</Label>
              <Input
                id="whatsapp-phone"
                placeholder="Ex.: 5511999999999"
                value={whatsAppPhone}
                onChange={(event) => setWhatsAppPhone(event.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              O resumo inclui receitas, custos fixos, despesas, saldo restante e as principais categorias do mês {monthName}.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsWhatsAppDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendWhatsAppSummary} disabled={isSendingWhatsApp}>
              {isSendingWhatsApp ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar receita mensal</DialogTitle>
            <DialogDescription>
              Defina o valor de receita mensal utilizado para os cálculos do dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="income-value">Receita mensal (R$)</Label>
              <Input
                id="income-value"
                value={incomeInput}
                onChange={(event) => setIncomeInput(sanitizeIncomeInput(event.target.value))}
                placeholder="Ex.: 5000"
                inputMode="decimal"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Este valor corresponde à sua receita fixa mensal e é somado às receitas lançadas manualmente.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsIncomeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveMonthlyIncome}
              disabled={setMonthlyIncome.isPending}
            >
              {setMonthlyIncome.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Card - Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="p-4 sm:p-8 mb-8 shadow-primary border-2 bg-gradient-to-br from-card via-card to-primary/5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="w-full md:w-auto">
                <p className="text-sm text-muted-foreground mb-2">
                  Saldo Restante do Mês
                </p>
                <motion.div
                  className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold text-success mb-2"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  {summaryLoading ? (
                    <div className="animate-pulse">R$ ---.--</div>
                  ) : (
                    `R$ ${balanceValue.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </motion.div>
                {!summaryLoading && targetBalance !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`${
                        targetBalance >= 0 ? "text-success" : "text-danger"
                      } flex items-center gap-1`}
                    >
                      {targetBalance >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {targetBalance >= 0 ? "Positivo" : "Negativo"}
                    </span>
                    {summary && summary.income > 0 && (
                      <span className="text-muted-foreground">
                        •{" "}
                        {((summary.remaining / summary.income) * 100).toFixed(
                          0
                        )}
                        % do orçamento
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
                <Button
                  className="gap-2 animate-pulse-subtle shadow-lg w-full sm:w-auto"
                  onClick={() => navigate("/transactions")}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Despesa
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => {
                    const importSection =
                      document.getElementById("import-section");
                    importSection?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Upload className="h-4 w-4" />
                  Importar Arquivo
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => navigate("/fixed-costs")}
                >
                  <Receipt className="h-4 w-4" />
                  Custos Fixos
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi, index) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="p-4 hover:shadow-md transition-smooth">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {kpi.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {kpi.editable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setIncomeInput(
                            monthlyIncomeValue > 0
                              ? numberFormatter.format(monthlyIncomeValue)
                              : ""
                          );
                          setIsIncomeDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <div
                      className={`h-8 w-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}
                    >
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${kpi.color}`}>
                  {kpi.value}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Transaction Review */}
        {extractedTransactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <TransactionReview
              transactions={extractedTransactions}
              onSave={() => {
                setExtractedTransactions([]);
                // React Query will automatically refetch data
              }}
              onCancel={() => setExtractedTransactions([])}
            />
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">
                Gastos por Categoria
              </h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p>Nenhuma transação ainda</p>
                </div>
              )}
            </Card>
          </div>

          {/* Transactions Section */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">
                  Transações Recentes
                </h3>
                <Link to="/transactions">
                  <Button variant="ghost" size="sm">
                    Ver todas
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-smooth"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {transaction.description}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.category} • {transaction.type}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-semibold ${transaction.amount >= 0 ? 'text-success' : 'text-danger'}`}
                        >
                          {transaction.amount >= 0 ? '+' : '-'} R$ {Math.abs(transaction.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.date}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma transação ainda</p>
                    <p className="text-sm mt-2">
                      Adicione sua primeira despesa
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Import Section */}
        <motion.div
          id="import-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 mb-8"
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Importar Dados
                </h3>
                <p className="text-sm text-muted-foreground">
                  Envie arquivos para importar transações ou custos fixos
                </p>
              </div>
            </div>

            <Tabs defaultValue="transactions" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="transactions">Transações</TabsTrigger>
                <TabsTrigger value="fixed-costs">Custos Fixos</TabsTrigger>
              </TabsList>

              <TabsContent value="transactions" className="mt-4">
                <FileUpload
                  onTransactionsExtracted={(transactions) => {
                    setExtractedTransactions(transactions);
                  }}
                />
              </TabsContent>

              <TabsContent value="fixed-costs" className="mt-4">
                <FixedCostImport />
              </TabsContent>
            </Tabs>
          </Card>
        </motion.div>

        {/* AI Insights */}
        {(aiInsight || insightLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8"
          >
            <Card className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-2">
                    Sugestão do Assistente
                  </h4>
                  {insightLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                      <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
                    </div>
                  ) : aiInsight ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        {aiInsight.message}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aiInsight.actions && aiInsight.actions.length > 0 ? (
                          aiInsight.actions.map((action, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant={idx === 0 ? "default" : "outline"}
                              onClick={() => {
                                if (
                                  action.action === "navigate" &&
                                  action.data
                                ) {
                                  navigate(action.data);
                                }
                              }}
                            >
                              {action.label}
                            </Button>
                          ))
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => navigate("/transactions")}
                          >
                            Ver Transações
                          </Button>
                        )}
                        {/* Always show Assistente button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => navigate("/chat")}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Assistente
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="fixed bottom-6 right-6"
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-primary animate-pulse-subtle"
          onClick={() => navigate("/transactions")}
          title="Adicionar Despesa"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
};

export default Dashboard;
