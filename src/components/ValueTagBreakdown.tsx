import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ShieldCheck, Lightbulb, Info } from 'lucide-react';

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
  const [open, setOpen] = useState(false);

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

      if (tag === 'essential') essential += amount;
      else if (tag === 'optional') optional += amount;
      else unclassified += amount;
    }

    return { essentialTotal: essential, optionalTotal: optional, unclassifiedTotal: unclassified };
  }, [transactions]);

  const classifiedTotal = essentialTotal + optionalTotal;

  if (isLoading || classifiedTotal === 0) return null;

  const essentialPercent = Math.round((essentialTotal / classifiedTotal) * 100);
  const optionalPercent = 100 - essentialPercent;

  return (
    <Card className="border-border/60">
      <CardContent className="pt-3 pb-3 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Essencial vs Opcional
          </span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setOpen(!open)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              className="w-72 p-3 space-y-2"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] text-emerald-600 font-medium uppercase">Essencial</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {currencyFormatter.format(essentialTotal)}
                  </p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[10px] text-amber-600 font-medium uppercase">Opcional</p>
                  <p className="text-sm font-bold text-amber-700">
                    {currencyFormatter.format(optionalTotal)}
                  </p>
                </div>
              </div>

              {optionalTotal > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-800">
                      Potencial de economia: {currencyFormatter.format(optionalTotal)}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      Gastos opcionais que podem ser revisados.
                    </p>
                  </div>
                </div>
              )}

              {unclassifiedTotal > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {currencyFormatter.format(unclassifiedTotal)} em despesas sem classificação.
                </p>
              )}
            </PopoverContent>
          </Popover>
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
