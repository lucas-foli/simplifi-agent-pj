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
  Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const Dashboard = () => {
  const [balanceValue, setBalanceValue] = useState(0);
  const targetBalance = 2847.50;

  // Animate balance count-up
  useEffect(() => {
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
  }, []);

  // Mock data
  const kpis = [
    {
      label: "Receita Mensal",
      value: "5.000,00",
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      label: "Custos Fixos",
      value: "1.500,00",
      icon: Receipt,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      label: "Gastos do Mês",
      value: "652,50",
      icon: TrendingDown,
      color: "text-danger",
      bgColor: "bg-danger/10"
    },
    {
      label: "Meta de Economia",
      value: "1.000,00",
      icon: Target,
      color: "text-primary",
      bgColor: "bg-primary/10"
    }
  ];

  const categoryData = [
    { name: "Alimentação", value: 280, color: "#0B59A3" },
    { name: "Transporte", value: 150, color: "#2ECC71" },
    { name: "Lazer", value: 122.50, color: "#F39C12" },
    { name: "Outros", value: 100, color: "#E74C3C" },
  ];

  const recentTransactions = [
    { id: 1, description: "Mercado Extra", category: "Alimentação", amount: -85.30, date: "Hoje, 14:32", type: "Pix" },
    { id: 2, description: "Uber", category: "Transporte", amount: -23.50, date: "Hoje, 09:15", type: "Crédito" },
    { id: 3, description: "Netflix", category: "Lazer", amount: -39.90, date: "Ontem, 18:20", type: "Débito" },
    { id: 4, description: "Padaria", category: "Alimentação", amount: -12.50, date: "Ontem, 08:45", type: "Dinheiro" },
  ];

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
            <Button variant="ghost" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Maio 2025
            </Button>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4" />
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
          <Card className="p-8 mb-8 shadow-primary border-2 bg-gradient-to-br from-card via-card to-primary/5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Saldo Restante do Mês</p>
                <motion.div
                  className="text-5xl md:text-6xl font-mono font-bold text-success mb-2"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  R$ {balanceValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </motion.div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-success flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    +5.2% vs mês anterior
                  </span>
                  <span className="text-muted-foreground">• 57% do orçamento</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button className="gap-2 animate-pulse-subtle shadow-lg">
                  <Plus className="h-4 w-4" />
                  Adicionar Despesa
                </Button>
                <Button variant="outline" className="gap-2">
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
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Gastos por Categoria</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
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
                {recentTransactions.map((transaction, index) => (
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
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Suggestions */}
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
                <p className="text-sm text-muted-foreground mb-3">
                  Você está gastando 12% a mais em alimentação comparado ao mês passado. 
                  Que tal reduzir em 10% para economizar R$ 140?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Ver Detalhes</Button>
                  <Button size="sm">Aplicar Sugestão</Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
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
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
};

export default Dashboard;
