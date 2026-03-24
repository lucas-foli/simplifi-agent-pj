import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface CashFlowForecastProps {
  currentBalance: number;
  monthlyFixedCosts: number;
  transactions: Array<{
    amount: number;
    type: string;
    date: string;
  }>;
  isLoading?: boolean;
}

interface ForecastDataPoint {
  day: string;
  date: string;
  saldo: number;
  saldoPositive: number;
  saldoNegative: number;
  isNegative: boolean;
  isFixedCostDay: boolean;
}

const FIXED_COST_DAY = 5;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const shortCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export default function CashFlowForecast({
  currentBalance,
  monthlyFixedCosts,
  transactions,
  isLoading,
}: CashFlowForecastProps) {
  const forecastData = useMemo(() => {
    if (transactions === undefined) return [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);

    const pastTransactions = transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= thirtyDaysAgo && d <= now;
    });

    const dayCount = Math.max(
      1,
      Math.ceil((now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24))
    );

    let totalDailyIncome = 0;
    let totalDailyExpense = 0;

    for (const t of pastTransactions) {
      if (t.type === 'receita') {
        totalDailyIncome += Number(t.amount);
      } else {
        totalDailyExpense += Number(t.amount);
      }
    }

    const avgDailyIncome = totalDailyIncome / dayCount;
    const avgDailyExpense = totalDailyExpense / dayCount;

    const data: ForecastDataPoint[] = [];
    let balance = currentBalance;

    for (let i = 0; i <= 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      const dayOfMonth = date.getDate();
      const isFixedCostDay = dayOfMonth === FIXED_COST_DAY;

      if (i > 0) {
        balance += avgDailyIncome;
        balance -= avgDailyExpense;

        if (isFixedCostDay) {
          balance -= monthlyFixedCosts;
        }
      }

      const label =
        i === 0
          ? 'Hoje'
          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const roundedSaldo = Math.round(balance * 100) / 100;

      data.push({
        day: label,
        date: date.toISOString(),
        saldo: roundedSaldo,
        saldoPositive: Math.max(roundedSaldo, 0),
        saldoNegative: Math.min(roundedSaldo, 0),
        isNegative: balance < 0,
        isFixedCostDay,
      });
    }

    return data;
  }, [currentBalance, monthlyFixedCosts, transactions]);

  const minBalance = useMemo(
    () => Math.min(...forecastData.map((d) => d.saldo)),
    [forecastData]
  );

  const hasNegativeProjection = minBalance < 0;

  const fixedCostDays = forecastData.filter((d) => d.isFixedCostDay);

  const [isTouchSliding, setIsTouchSliding] = useState(false);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTouchSliding(true);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleTouchEnd = () => {
    setIsTouchSliding(false);
  };

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Projeção de Fluxo de Caixa
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Projeção de Fluxo de Caixa
            </CardTitle>
            <CardDescription>
              Estimativa para os próximos 30 dias com base no histórico de transações
            </CardDescription>
          </div>
          {hasNegativeProjection && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Saldo negativo projetado
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {forecastData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Dados insuficientes para gerar a projeção.
          </div>
        ) : (
          <>
            <div
              className="h-[280px] md:h-[320px]"
              style={{
                touchAction: 'none',
                position: isTouchSliding ? 'sticky' : 'relative',
                top: isTouchSliding ? 16 : undefined,
                zIndex: isTouchSliding ? 20 : undefined,
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2ECC71" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2ECC71" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E74C3C" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickCount={7}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: number) => shortCurrencyFormatter.format(value)}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value: number) => [currencyFormatter.format(value), 'Saldo projetado']}
                    labelFormatter={(label: string) => label}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <ReferenceLine y={0} stroke="#E74C3C" strokeDasharray="4 4" strokeWidth={1.5} />
                  {fixedCostDays.map((point) => (
                    <ReferenceLine
                      key={point.date}
                      x={point.day}
                      stroke="#F39C12"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: 'Custos fixos',
                        position: 'top',
                        fontSize: 10,
                        fill: '#F39C12',
                      }}
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="saldoPositive"
                    stroke="#2ECC71"
                    strokeWidth={2}
                    fill="url(#positiveGradient)"
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="saldoNegative"
                    stroke="#E74C3C"
                    strokeWidth={2}
                    fill="url(#negativeGradient)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2ECC71]" />
                Saldo positivo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E74C3C]" />
                Saldo negativo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 border-t-2 border-dashed border-[#F39C12]" />
                Vencimento custos fixos (dia {FIXED_COST_DAY})
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
