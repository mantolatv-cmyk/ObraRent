'use client';

import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatBRL, formatPeriod, FREIGHT_ZONE_LABEL, pluralize } from '@/lib/format';
import type { CheckoutStep, EstimatedLine } from '@/components/checkout/state';
import type { Quote } from '@/lib/types';

export interface OrderSummarySidebarProps {
  step: CheckoutStep;
  startDate: string;
  endDate: string;
  deliveryTimeSlot?: string;
  estimate: {
    days: number;
    discountPct: number;
    lines: EstimatedLine[];
    subtotal: number;
    totalUnits: number;
  };
  quote: Quote | null;
  quoteLoading: boolean;
  canContinue: boolean;
  submitting: boolean;
  primaryLabel: string;
  onPrimaryAction: () => void;
  onBack?: () => void;
}

export function OrderSummarySidebar({
  step,
  startDate,
  endDate,
  deliveryTimeSlot,
  estimate,
  quote,
  quoteLoading,
  canContinue,
  submitting,
  primaryLabel,
  onPrimaryAction,
  onBack,
}: OrderSummarySidebarProps) {
  const displayTotal = quote ? quote.totalAmount : estimate.subtotal;
  const displaySubtotal = quote ? quote.subtotal : estimate.subtotal;
  const displayDays = quote ? quote.days : estimate.days;

  return (
    <>
      {/* Desktop Sticky Right Column (lg+) */}
      <aside aria-label="Resumo do pedido" className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <Card className="border-yellow-400/25">
            <CardHeader
              title="Resumo do pedido"
              description={
                estimate.totalUnits > 0
                  ? `${formatPeriod(startDate, endDate)}${deliveryTimeSlot ? ` · ${deliveryTimeSlot}` : ''}`
                  : 'Selecione ao menos 1 equipamento'
              }
              action={
                <div className="flex items-center gap-2">
                  {quoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" /> : null}
                  {estimate.discountPct > 0 ? (
                    <Badge tone="success">-{estimate.discountPct}% off</Badge>
                  ) : null}
                </div>
              }
            />
            <CardBody className="space-y-4">
              {estimate.lines.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
                  Nenhum equipamento selecionado ainda. Use os botões <strong className="text-yellow-400">+</strong> ao
                  lado para adicionar.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-white/10 text-sm">
                    {estimate.lines.map((line) => (
                      <li
                        key={line.category.id}
                        className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-white">
                            {line.quantity}× {line.category.name}
                          </p>
                          <p className="text-xs text-slate-400 tabular-nums">
                            {formatBRL(line.agreedDailyRate)}/dia × {displayDays}{' '}
                            {displayDays === 1 ? 'dia' : 'dias'}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-amber-400 tabular-nums">
                          {formatBRL(line.subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <dl className="space-y-2 border-t border-white/10 pt-3 text-sm">
                    <div className="flex items-center justify-between text-slate-300">
                      <dt>Diárias ({pluralize(estimate.totalUnits, 'item', 'itens')})</dt>
                      <dd className="font-medium text-white tabular-nums">
                        {formatBRL(displaySubtotal)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <dt className="flex items-center gap-1.5">
                        <Truck aria-hidden className="h-4 w-4 text-yellow-400" />
                        <span>
                          Frete de Entrega{' '}
                          {quote ? `(${FREIGHT_ZONE_LABEL[quote.freight.zone]})` : ''}
                        </span>
                      </dt>
                      <dd className="font-semibold text-emerald-400 tabular-nums">
                        Grátis (Incluso)
                      </dd>
                    </div>
                    {deliveryTimeSlot ? (
                      <div className="flex items-center justify-between text-xs text-yellow-300 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-2.5 py-1.5">
                        <span>Horário agendado:</span>
                        <span className="font-mono font-semibold">{deliveryTimeSlot}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
                      <dt>Total das diárias</dt>
                      <dd className="text-xl font-bold text-amber-400 tabular-nums drop-shadow-[0_0_10px_rgba(250, 204, 21, 0.25)]">
                        {formatBRL(displayTotal)}
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              {step < 3 ? (
                <div className="space-y-2.5 pt-2">
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    disabled={!canContinue}
                    loading={submitting}
                    onClick={onPrimaryAction}
                  >
                    {primaryLabel}
                    <ArrowRight aria-hidden className="h-5 w-5" />
                  </Button>
                  {onBack ? (
                    <Button variant="secondary" size="md" block onClick={onBack} disabled={submitting}>
                      <ArrowLeft aria-hidden className="h-4 w-4" />
                      Voltar etapa
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <p className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-amber-400" />
                Reserva imediata de patrimônio físico com aprovação automática via Pix.
              </p>
            </CardBody>
          </Card>
        </div>
      </aside>

      {/* Mobile Sticky Bottom Action Bar (< lg) */}
      {step < 3 ? (
        <div
          role="region"
          aria-label="Barra de ação do pedido"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-yellow-400/25 bg-slate-950/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.6)] lg:hidden"
        >
          <div className="mx-auto flex max-w-content items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">
                {estimate.totalUnits > 0
                  ? `${pluralize(estimate.totalUnits, 'item', 'itens')} · ${displayDays} ${displayDays === 1 ? 'dia' : 'dias'
                  }`
                  : 'Selecione os equipamentos'}
              </p>
              <p className="truncate text-lg font-bold text-amber-400 tabular-nums">
                {formatBRL(displayTotal)}
                {estimate.discountPct > 0 ? (
                  <span className="ml-1.5 text-xs font-semibold text-yellow-400">
                    (-{estimate.discountPct}%)
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onBack ? (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={onBack}
                  disabled={submitting}
                  aria-label="Voltar para a etapa anterior"
                >
                  <ArrowLeft aria-hidden className="h-5 w-5" />
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="lg"
                disabled={!canContinue}
                loading={submitting}
                onClick={onPrimaryAction}
              >
                {primaryLabel}
                <ArrowRight aria-hidden className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
