import { Tag, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatBRL, formatPeriod, FREIGHT_ZONE_LABEL, pluralize } from '@/lib/format';
import type { RentalSummary } from '@/lib/types';

export function AllocatedItemsCard({ rental }: { rental: RentalSummary }) {
  return (
    <Card>
      <CardHeader
        title="Equipamentos e valores"
        description={formatPeriod(rental.startDate, rental.endDate)}
        action={
          <Badge tone="neutral">
            {pluralize(rental.items.length, 'unidade alocada', 'unidades alocadas')}
          </Badge>
        }
      />
      <CardBody className="space-y-6">
        {rental.items.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
              Patrimônios separados (asset tags)
            </h3>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {rental.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/65 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.categoryName}</p>
                    <p className="text-xs text-amber-400 tabular-nums">{formatBRL(item.agreedDailyRate)}/dia</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-yellow-400 shadow-[0_0_12px_rgba(250, 204, 21, 0.25)]">
                    <Tag aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                    {item.assetTag}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-400">Resumo financeiro</h3>
          <ul className="mt-3 divide-y divide-white/10">
            {rental.lines.map((line) => (
              <li key={line.categoryId} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {line.quantity}× {line.categoryName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-300 tabular-nums">
                    <span>
                      {formatBRL(line.agreedDailyRate)}/dia × {rental.days}{' '}
                      {rental.days === 1 ? 'dia' : 'dias'}
                    </span>
                    {line.discountPct > 0 ? (
                      <Badge tone="success">-{line.discountPct}% período longo</Badge>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-amber-400 tabular-nums">
                  {formatBRL(line.subtotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-2 border-t border-white/10 pt-3 text-sm">
            <div className="flex items-center justify-between text-slate-300">
              <dt>Subtotal dos equipamentos</dt>
              <dd className="font-medium text-white tabular-nums">{formatBRL(rental.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <dt className="flex items-center gap-1.5">
                <Truck aria-hidden className="h-4 w-4 text-yellow-400" />
                <span>
                  Frete de Entrega ({FREIGHT_ZONE_LABEL[rental.freight.zone]}
                  {rental.freight.distanceKm != null ? ` · ${rental.freight.distanceKm} km` : ''})
                </span>
              </dt>
              <dd className="font-semibold text-emerald-400 tabular-nums">
                {rental.freight.amount > 0 ? formatBRL(rental.freight.amount) : 'Grátis (Incluso)'}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <dt>Total das diárias</dt>
              <dd className="text-xl font-bold text-amber-400 tabular-nums drop-shadow-[0_0_10px_rgba(250, 204, 21, 0.25)]">
                {formatBRL(rental.totalAmount)}
              </dd>
            </div>
          </dl>
        </div>
      </CardBody>
    </Card>
  );
}
