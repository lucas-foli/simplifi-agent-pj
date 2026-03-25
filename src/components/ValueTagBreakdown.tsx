import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

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

  const { essentialTotal, optionalTotal } = useMemo(() => {
    let essential = 0;
    let optional = 0;

    for (const t of transactions) {
      if (t.type !== 'despesa') continue;
      const amount = Number(t.amount);
      const tag = t.company_categories?.value_tag;

      if (tag === 'essential') essential += amount;
      else if (tag === 'optional') optional += amount;
    }

    return { essentialTotal: essential, optionalTotal: optional };
  }, [transactions]);

  const classifiedTotal = essentialTotal + optionalTotal;

  if (isLoading || classifiedTotal === 0) return null;

  const essentialPercent = Math.round((essentialTotal / classifiedTotal) * 100);
  const optionalPercent = 100 - essentialPercent;

  return (
    <Card className="border-border/60 hover:border-primary/40 transition-smooth">
      <CardContent className="pt-4 pb-4 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Essencial vs Opcional
          </span>
        </div>

        {/* Compact bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 rounded-l-full"
            style={{ width: `${essentialPercent}%` }}
          />
          <div
            className="h-full bg-amber-400 rounded-r-full"
            style={{ width: `${optionalPercent}%` }}
          />
        </div>

        {/* Values row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-700">
            {currencyFormatter.format(essentialTotal)}{' '}
            <span className="text-muted-foreground">({essentialPercent}%)</span>
          </span>
          <span className="text-amber-700">
            {currencyFormatter.format(optionalTotal)}{' '}
            <span className="text-muted-foreground">({optionalPercent}%)</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ValueTagBreakdown;
