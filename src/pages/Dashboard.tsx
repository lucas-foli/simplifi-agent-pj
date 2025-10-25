import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  Target,
  Plus,
  MessageSquare,
  Calendar,
  Filter,
  LogOut
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardSummary } from "@/hooks/useFinancialData";
import { useTransactions, useTransactionsByCategory } from "@/hooks/useTransactions";
import { useAIInsights } from "@/hooks/useAIInsights";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(currentMonth, currentYear);
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(currentMonth, currentYear);
  const { data: categoryData, isLoading: categoryLoading } = useTransactionsByCategory(currentMonth, currentYear);
  const { data: aiInsight, isLoading: insightLoading } = useAIInsights();
  
  const [balanceValue, setBalanceValue] = useState(0);
  const targetBalance = summary?.remaining ?? null;

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

  const kpis = [
    {
      label: "Receita Mensal",
      value: summary?.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00",
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      label: "Custos Fixos",
      value: summary?.fixedCosts.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00",
      icon: Receipt,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      label: "Gastos do Mês",
      value: summary?.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "0,00",
      icon: TrendingDown,
      color: "text-danger",
      bgColor: "bg-danger/10"
    },
    {
      label: "Meta de Economia",
      value: "1.000,00", // TODO: Implementar metas
      icon: Target,
      color: "text-primary",
      bgColor: "bg-primary/10"
    }
  ];

  const colors = ["#0B59A3", "#2ECC71", "#F39C12", "#E74C3C", "#9B59B6", "#1ABC9C", "#E67E22"];
  
  const chartData = categoryData?.map((cat, index) => ({
    name: cat.category,
    value: cat.amount,
    color: colors[index % colors.length]
  })) || [];

  const recentTransactions = transactions?.slice(0, 4).map(tx => ({
    id: tx.id,
    description: tx.description,
    category: tx.category,
    amount: -Number(tx.amount),
    date: new Date(tx.date).toLocaleDateString('pt-BR'),
    type: tx.payment_method || "N/A"
  })) || [];

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

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
            <span className="text-xl font-bold text-foreground">SimplifiQA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2 hidden md:inline">
              Olá, {profile?.name || user?.email}
            </span>
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Calendar className="h-4 w-4 mr-2" />
              {monthName}
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

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
                <p className="text-sm text-muted-foreground mb-2">Saldo Restante do Mês</p>
                <motion.div
                  className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold text-success mb-2"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  {summaryLoading ? (
                    <div className="animate-pulse">R$ ---.--</div>
                  ) : (
                    `R$ ${balanceValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </motion.div>
                {!summaryLoading && targetBalance !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`${targetBalance >= 0 ? 'text-success' : 'text-danger'} flex items-center gap-1`}>
                      {targetBalance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {targetBalance >= 0 ? 'Positivo' : 'Negativo'}
                    </span>
                    {summary && summary.income > 0 && (
                      <span className="text-muted-foreground">
                        • {((summary.remaining / summary.income) * 100).toFixed(0)}% do orçamento
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
                <Button 
                  className="gap-2 animate-pulse-subtle shadow-lg w-full sm:w-auto"
                  onClick={() => navigate('/transactions')}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Despesa
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2 w-full sm:w-auto"
                  onClick={() => toast.info('Relatórios em breve!')}
                >
                  <Filter className="h-4 w-4" />
                  Ver Relatório
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
                  <span className="text-sm text-muted-foreground">{kpi.label}</span>
                  <div className={`h-8 w-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <div className={`text-2xl font-bold ${kpi.color}`}>
                  R$ {kpi.value}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Gastos por Categoria</h3>
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
                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
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
                <h3 className="font-semibold text-foreground">Transações Recentes</h3>
                <Link to="/transactions">
                  <Button variant="ghost" size="sm">Ver todas</Button>
                </Link>
              </div>
              <div className="space-y-3">
                {recentTransactions.length > 0 ? recentTransactions.map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{transaction.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.category} • {transaction.type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-danger">
                        R$ {Math.abs(transaction.amount).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{transaction.date}</div>
                    </div>
                  </motion.div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma transação ainda</p>
                    <p className="text-sm mt-2">Adicione sua primeira despesa</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

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
                  <h4 className="font-semibold text-foreground mb-2">Sugestão do Assistente</h4>
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
                                if (action.action === 'navigate' && action.data) {
                                  navigate(action.data);
                                }
                              }}
                            >
                              {action.label}
                            </Button>
                          ))
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate('/chat')}
                            >
                              Conversar com Assistente
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => navigate('/transactions')}
                            >
                              Ver Transações
                            </Button>
                          </>
                        )}
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
          onClick={() => navigate('/transactions')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
};

export default Dashboard;
