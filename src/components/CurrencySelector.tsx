import { useCurrency } from '@/contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/currencies';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const selected = SUPPORTED_CURRENCIES.find((c) => c.code === currency);

  return (
    <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
      <SelectTrigger className="w-[110px] h-8 text-xs">
        <span className="flex items-center gap-1.5">
          <span>{selected?.flag}</span>
          <span>{selected?.code}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code} textValue={c.code} className="text-xs">
            <span className="flex items-center gap-1.5">
              <span>{c.flag}</span>
              <span>{c.code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
