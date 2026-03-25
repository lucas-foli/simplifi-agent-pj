import { Badge } from '@/components/ui/badge';

type ValueTag = 'essential' | 'optional' | null | undefined;

interface ValueTagBadgeProps {
  valueTag: ValueTag;
}

const ValueTagBadge = ({ valueTag }: ValueTagBadgeProps) => {
  if (!valueTag) return null;

  if (valueTag === 'essential') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] px-1.5 py-0">
        Essencial
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px] px-1.5 py-0">
      Opcional
    </Badge>
  );
};

export default ValueTagBadge;
