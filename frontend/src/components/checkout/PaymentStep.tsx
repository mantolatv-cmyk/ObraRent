'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MapPin,
  MessageCircle,
  Plus,
  Tag,
} from 'lucide-react';
import { PaymentPanel } from '@/components/order/PaymentPanel';
import { StatusBadge } from '@/components/order/StatusTimeline';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useRentalPolling } from '@/hooks/useRentalPolling';
import { whatsappLink } from '@/lib/config';
import {
  formatBRL,
  formatDateLong,
  formatPeriod,
  maskCep,
  pluralize,
} from '@/lib/format';
import type { RentalSummary } from '@/lib/types';

export interface PaymentStepProps {
  rental: RentalSummary;
  onRentalUpdate: (rental: RentalSummary) => void;
  onStartNewRental: () => void;
}

export function PaymentStep({ rental, onRentalUpdate, onStartNewRental }: PaymentStepProps) {
  const { rental: polledRental, setRental, polling } = useRentalPolling(rental.id, {
    initial: rental,
  });

  const current = polledRental ?? rental;

  useEffect(() => {
    if (polledRental && polledRental.status !== rental.status) {
      onRentalUpdate(polledRental);
    }
  }, [polledRental, rental.status, onRentalUpdate]);

  const addr = current.deliveryAddress;
  const isConfirmed =
    current.status === 'CONFIRMED' || current.status === 'ACTIVE' || current.status === 'COMPLETED';

  return (
    <section aria-labelledby="step4-heading" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="step4-heading" className="text-xl font-bold text-white">
            4. {isConfirmed ? 'Reserva confirmada' : 'Pagamento do pedido'}
          </h2>
          <p className="mt-1 text-base text-slate-300">
            Código do pedido:{' '}
            <strong className="font-mono font-bold text-yellow-400">{current.code}</strong>
          </p>
        </div>
        <StatusBadge status={current.status} />
      </div>

      {isConfirmed ? (
        <Card className="border-amber-400/50 bg-amber-400/25 shadow-[0_0_32px_-4px_rgba(250, 204, 21, 0.25)]">
          <CardBody className="space-y-5">
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-400/20 text-amber-400 shadow-[0_0_18px_rgba(250, 204, 21, 0.25)]"
              >
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Pedido {current.code} · Aprovado
                </p>
                <h3 className="mt-0.5 text-2xl font-bold text-white">
                  Pagamento confirmado! Seus equipamentos estão garantidos.
                </h3>
                <p className="mt-1 text-base text-slate-200">
                  Separamos as unidades abaixo para entrega na obra em{' '}
                  <strong className="text-amber-400">{formatDateLong(current.startDate)}</strong>.
                </p>
              </div>
            </div>

            {/* Allocated Asset Tags */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  Equipamentos alocados ({pluralize(current.items.length, 'unidade', 'unidades')})
                </p>
                <Badge tone="success">{formatPeriod(current.startDate, current.endDate)}</Badge>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {current.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/75 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.categoryName}</p>
                      <p className="text-xs text-amber-400 tabular-nums">
                        {formatBRL(item.agreedDailyRate)}/dia
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-yellow-400 shadow-[0_0_12px_rgba(250, 204, 21, 0.25)]">
                      <Tag aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                      {item.assetTag}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Delivery summary */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-sm text-slate-200">
              <MapPin aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
              <div>
                <p className="font-semibold text-white">Endereço de entrega na obra</p>
                <p className="mt-0.5 text-slate-300">
                  {addr.street}, {addr.number}
                  {addr.complement ? ` · ${addr.complement}` : ''} — {addr.district}, {addr.city}/{addr.state}{' '}
                  (CEP {maskCep(addr.cep)})
                </p>
                {addr.reference ? (
                  <p className="mt-1 text-xs text-slate-400">Referência: {addr.reference}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={`/pedidos/${encodeURIComponent(current.id)}`}
                className={buttonClasses({ variant: 'primary', size: 'lg', className: 'flex-1' })}
              >
                Acompanhar pedido ({current.code})
                <ArrowRight aria-hidden className="h-5 w-5" />
              </Link>
              <Link
                href={`/pedidos/${encodeURIComponent(current.id)}/contrato`}
                className={buttonClasses({ variant: 'dark', size: 'lg' })}
              >
                <FileText aria-hidden className="h-5 w-5" />
                Ver Contrato &amp; Romaneio (PDF)
              </Link>
              <a
                href={whatsappLink(`Olá! Acabei de confirmar o pedido ${current.code}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'secondary', size: 'lg' })}
              >
                <MessageCircle aria-hidden className="h-5 w-5" />
                WhatsApp
              </a>
              <Button variant="ghost" size="lg" onClick={onStartNewRental}>
                <Plus aria-hidden className="h-5 w-5" />
                Novo pedido
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <PaymentPanel
            rental={current}
            polling={polling}
            onRentalUpdate={(updated) => {
              setRental(updated);
              onRentalUpdate(updated);
            }}
            showOrderPageLink={true}
          />

          <Card>
            <CardHeader
              title="Unidades pré-reservadas para sua obra"
              description="Estes equipamentos já estão bloqueados para o seu CNPJ enquanto aguarda o pagamento."
            />
            <CardBody className="space-y-4">
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {current.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/65 px-3.5 py-2.5"
                  >
                    <span className="truncate text-sm font-semibold text-white">{item.categoryName}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-yellow-400 shadow-[0_0_12px_rgba(250, 204, 21, 0.25)]">
                      <Tag aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                      {item.assetTag}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
                <span className="text-slate-300">
                  Entrega em <strong className="text-white">{formatDateLong(current.startDate)}</strong> · {addr.street},{' '}
                  {addr.number} ({addr.city}/{addr.state})
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href={`/pedidos/${encodeURIComponent(current.id)}/contrato`}
                    className="font-semibold text-yellow-400 underline underline-offset-4 hover:text-amber-400"
                  >
                    Ver Contrato &amp; Romaneio (PDF)
                  </Link>
                  <Link
                    href={`/pedidos/${encodeURIComponent(current.id)}`}
                    className="font-semibold text-amber-400 underline underline-offset-4 hover:text-yellow-400"
                  >
                    Abrir link compartilhável do pedido
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </section>
  );
}
