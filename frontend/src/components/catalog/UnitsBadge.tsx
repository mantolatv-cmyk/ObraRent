import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { pluralize } from '@/lib/format';

export function stockTone(units: number): BadgeTone {
  if (units <= 0) return 'danger';
  if (units <= 2) return 'warning';
  return 'success';
}

/** Operational units badge (emerald / amber / red). */
export function UnitsBadge({ operational }: { operational: number }) {
  const tone = stockTone(operational);
  const label =
    operational <= 0
      ? 'Sem unidades no momento'
      : `${pluralize(operational, 'unidade', 'unidades')} ${operational === 1 ? 'operacional' : 'operacionais'}`;
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
