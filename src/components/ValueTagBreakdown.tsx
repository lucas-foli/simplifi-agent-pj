import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldCheck, Lightbulb } from 'lucide-react';

interface Transaction {
  amount: number | string;
  type: string;
  company_categories?: {
    id: string;
    name: string;
    value_tag: string | null;
  } | null;
}

interface ValueTagBreakdownProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const ValueTagBreakdown = ({ transactions, isLoading }: ValueTagBreakdownProps) => {
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const { essentialTotal, optionalTotal, unclassifiedTotal } = useMemo(() => {
    let essential = 0;
    let optional = 0;
    let unclassified = 0;

    for (const t of transactions) {
      if (t.type !== 'despesa') continue;
      const amount = Number(t.amount);
      const tag = t.company_categories?.value_tag;

      if (tag === 'essential') {
        essential += amount;
      } else if (tag === 'optional') {
        optional += amount;
      } else {
        unclassified += amount;
      }
    }

    return {
      essentialTotal: essential,
      optionalTotal: optional,
      unclassifiedTotal: unclassified,
    };
  }, [transactions]);

  const classifiedTotal = essentialTotal + optionalTotal;
  const essentialPercent = classifiedTotal > 0 ? Math.round((essentialTotal / classifiedTotal) * 100) : 0;
  const optionalPercent = classifiedTotal > 0 ? 100 - essentialPercent : 0;

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (classifiedTotal === 0 && unclassifiedTotal === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Essencial vs Opcional
          </CardTitle>
          <CardDescription>
            Distribuição das despesas por classificação de valor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {classifiedTotal > 0 ? (
            <>
              {/* Stacked bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-700 font-medium">
                    {essentialPercent}% Essencial
                  </span>
                  <span className="text-amber-700 font-medium">
                    {optionalPercent}% Opcional
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 rounded-l-full"
                    style={{ width: `${essentialPercent}%` }}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-500 rounded-r-full"
                    style={{ width: `${optionalPercent}%` }}
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 px-4 py-3">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">
                    Essencial
                  </p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {currencyFormatter.format(essentialTotal)}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">
                    Opcional
                  </p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1">
                    {currencyFormatter.format(optionalTotal)}
                  </p>
                </div>
              </div>

              {/* Savings highlight */}
              {optionalTotal > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-900/30 px-4 py-3">
                  <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Potencial de economia: {currencyFormatter.format(optionalTotal)}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Gastos opcionais que podem ser revisados para melhorar o resultado.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : null}

          {/* Unclassified notice */}
          {unclassifiedTotal > 0 && (
            <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{currencyFormatter.format(unclassifiedTotal)}</span>
                {' '}em despesas ainda sem classificação.{' '}
                {classifiedTotal === 0
                  ? 'Classifique as categorias na página de transações para ver a análise.'
                  : 'Classifique mais categorias para uma análise mais precisa.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ValueTagBreakdown;
