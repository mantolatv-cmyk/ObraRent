'use client';

import { RotateCcw, WifiOff } from 'lucide-react';
import { CategoryIcon } from '@/components/catalog/CategoryIcon';
import { UnitsBadge } from '@/components/catalog/UnitsBadge';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatBRL, pluralize } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import type { Category } from '@/lib/types';

export interface EquipmentStepProps {
  categories: Category[];
  loading: boolean;
  error: ApiError | null;
  onReload: () => void;
  quantities: Record<string, number>;
  onQuantityChange: (categoryId: string, quantity: number) => void;
  onClearAll: () => void;
}

export function EquipmentStep({
  categories,
  loading,
  error,
  onReload,
  quantities,
  onQuantityChange,
  onClearAll,
}: EquipmentStepProps) {
  const selectedLinesCount = Object.values(quantities).filter((q) => q > 0).length;
  const totalUnits = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  return (
    <section aria-labelledby="step1-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="step1-heading" className="text-xl font-bold text-white">
            1. Escolha os equipamentos
          </h2>
          <p className="mt-1 text-base text-slate-300">
            Use os botões <strong className="text-yellow-400">+</strong> e <strong className="text-yellow-400">−</strong>{' '}
            para definir a quantidade de cada item.
          </p>
        </div>
        {totalUnits > 0 ? (
          <div className="flex items-center gap-3">
            <Badge tone="accent">
              {pluralize(totalUnits, 'item selecionado', 'itens selecionados')}
            </Badge>
            <button
              type="button"
              onClick={onClearAll}
              className="text-sm font-semibold text-yellow-400 underline underline-offset-4 hover:text-yellow-400"
            >
              Limpar
            </button>
          </div>
        ) : null}
      </div>

      {selectedLinesCount >= 10 ? (
        <Alert tone="warning" title="Limite de 10 categorias por pedido atingido">
          Para adicionar outra categoria, reduza a quantidade de uma das categorias já selecionadas.
        </Alert>
      ) : null}

      {loading && categories.length === 0 ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando categorias">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/65 p-5 backdrop-blur-xl"
            >
              <div className="flex flex-1 items-center gap-4">
                <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-12 w-36 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error && categories.length === 0 ? (
        <Alert
          tone="danger"
          title="Não foi possível carregar os equipamentos"
          action={
            <Button variant="dark" onClick={onReload}>
              <RotateCcw aria-hidden className="h-4 w-4" />
              Tentar novamente
            </Button>
          }
        >
          <span className="flex items-center gap-2">
            <WifiOff aria-hidden className="h-4 w-4" />
            {error.message}
          </span>
        </Alert>
      ) : categories.length === 0 ? (
        <Alert tone="info" title="Nenhuma categoria encontrada">
          Não há equipamentos disponíveis no catálogo neste momento.
        </Alert>
      ) : (
        <ul className="space-y-3">
          {categories.map((cat) => {
            const qty = quantities[cat.id] ?? 0;
            const selected = qty > 0;
            const maxAllowed =
              cat.operationalUnits > 0 ? Math.min(50, cat.operationalUnits) : qty > 0 ? qty : 0;
            const limitReachedForNewCategory = !selected && selectedLinesCount >= 10;

            return (
              <li
                key={cat.id}
                className={cn(
                  'rounded-2xl border p-4 backdrop-blur-xl transition-all duration-200 sm:p-5',
                  selected
                    ? 'border-amber-400/55 bg-amber-400/25 shadow-[0_0_28px_-4px_rgba(250, 204, 21, 0.25)] ring-1 ring-amber-400/35'
                    : 'border-white/10 bg-slate-900/65 shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:border-yellow-400/40 hover:shadow-[0_0_24px_-6px_rgba(250, 204, 21, 0.25)]',
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    {cat.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cat.imageUrl}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-2xl border border-yellow-400/30 bg-slate-950/80 p-1 object-contain drop-shadow-md"
                      />
                    ) : (
                      <CategoryIcon slug={cat.slug} size="md" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold leading-snug text-white">{cat.name}</h3>
                        {selected ? <Badge tone="accent">{qty} no pedido</Badge> : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-300">{cat.description}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <span className="text-base font-bold text-amber-400 tabular-nums">
                          {formatBRL(cat.baseDailyRate)}
                          <span className="text-sm font-normal text-slate-400">/dia</span>
                        </span>
                        <UnitsBadge operational={cat.operationalUnits} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-3 sm:border-t-0 sm:pt-0">
                    <span className="text-sm font-medium text-slate-300 sm:sr-only">Quantidade</span>
                    <QuantityStepper
                      label={cat.name}
                      value={qty}
                      min={0}
                      max={limitReachedForNewCategory ? 0 : maxAllowed}
                      onChange={(next) => onQuantityChange(cat.id, next)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
