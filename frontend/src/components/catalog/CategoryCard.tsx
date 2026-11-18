import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { CategoryIcon } from '@/components/catalog/CategoryIcon';
import { UnitsBadge } from '@/components/catalog/UnitsBadge';
import { formatBRL } from '@/lib/format';
import type { Category } from '@/lib/types';

export function CategoryCard({ category }: { category: Category }) {
  const unavailable = category.operationalUnits <= 0;

  return (
    <li className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all duration-200 hover:border-yellow-400/50 hover:shadow-[0_0_28px_-4px_rgba(250, 204, 21, 0.25)]">
      {/* Subtle top neon gradient accent line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-yellow-400/70 to-amber-400/70 opacity-75 transition-opacity group-hover:opacity-100"
      />

      {/* Equipment Photo Banner */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-2 sm:p-3">
        {/* Subtle radial yellow highlight behind equipment */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(250,204,21,0.06)_0%,transparent_70%)]"
        />

        {category.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.imageUrl}
            alt={category.name}
            loading="lazy"
            className="h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-950">
            <CategoryIcon slug={category.slug} size="lg" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/80 to-transparent" />
        <div className="absolute right-3 top-3 z-10">
          <UnitsBadge operational={category.operationalUnits} />
        </div>
      </div>

      {/* Body details */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h3 className="text-lg font-bold leading-snug tracking-tight text-white transition-colors group-hover:text-yellow-400">
            {category.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-slate-300">{category.description}</p>
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between border-t border-white/10 pt-4">
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400">a partir de</span>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-amber-400 drop-shadow-[0_0_10px_rgba(250, 204, 21, 0.25)]">
                {formatBRL(category.baseDailyRate)}
                <span className="text-sm font-normal text-slate-400"> /dia</span>
              </p>
            </div>
          </div>

          <Link
            href={`/alugar?categoria=${encodeURIComponent(category.id)}`}
            className={buttonClasses({
              variant: unavailable ? 'secondary' : 'primary',
              size: 'lg',
              block: true,
              className: 'mt-4',
            })}
            aria-label={`Alugar ${category.name}`}
          >
            Alugar Agora
            <ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </li>
  );
}
