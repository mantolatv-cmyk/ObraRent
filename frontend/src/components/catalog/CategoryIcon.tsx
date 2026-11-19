import {
  ArrowUpFromLine,
  Columns3,
  Disc3,
  Droplets,
  Fan,
  Grid3x3,
  Hammer,
  Layers,
  RefreshCw,
  Ruler,
  Vibrate,
  Weight,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const RULES: { test: RegExp; icon: LucideIcon }[] = [
  { test: /betoneira|misturador/, icon: RefreshCw },
  { test: /regua/, icon: Ruler },
  { test: /placa|vibrat|mangote/, icon: Vibrate },
  { test: /compact|sapo|soquete/, icon: Weight },
  { test: /martel|rompedor|demoli/, icon: Hammer },
  { test: /alisad|acabad|helicop/, icon: Fan },
  { test: /cortad|serra|corte/, icon: Disc3 },
  { test: /gerador|energia/, icon: Zap },
  { test: /plataforma|piso-metalico|pranchao/, icon: Layers },
  { test: /andaime/, icon: Grid3x3 },
  { test: /escora|escoramento|estronca/, icon: Columns3 },
  { test: /guincho|talha|coluna/, icon: ArrowUpFromLine },
  { test: /bomba|motobomba|submers/, icon: Droplets },
];

export function iconForSlug(slug: string): LucideIcon {
  const s = slug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return RULES.find((r) => r.test.test(s))?.icon ?? Wrench;
}

export function CategoryIcon({
  slug,
  className,
  size = 'md',
}: {
  slug: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = iconForSlug(slug);
  const box =
    size === 'lg' ? 'h-16 w-16 rounded-2xl' : size === 'sm' ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-xl';
  const icon = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center border border-yellow-400/30 bg-yellow-400/10 text-yellow-400 shadow-[0_0_16px_rgba(250, 204, 21, 0.25)]',
        box,
        className,
      )}
    >
      <Icon className={icon} strokeWidth={2} />
    </span>
  );
}
