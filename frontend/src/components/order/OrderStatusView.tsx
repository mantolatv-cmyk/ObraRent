'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { AllocatedItemsCard } from '@/components/order/AllocatedItemsCard';
import { PaymentPanel } from '@/components/order/PaymentPanel';
import { StatusBadge, StatusTimeline } from '@/components/order/StatusTimeline';
import { useRentalPolling } from '@/hooks/useRentalPolling';
import { warehouseOrderWhatsappLink, whatsappLink } from '@/lib/config';
import {
  formatBRL,
  formatDateLong,
  formatDateTime,
  maskCep,
  maskCnpj,
  PAYMENT_METHOD_LABEL,
} from '@/lib/format';
import type { RentalSummary } from '@/lib/types';

export interface OrderStatusViewProps {
  id: string;
  initialRental: RentalSummary | null;
  initialError?: { code: string; message: string; status: number } | null;
}

export function OrderStatusView({ id, initialRental, initialError }: OrderStatusViewProps) {
  const { rental, setRental, error, loading, refresh, polling } = useRentalPolling(id, {
    initial: initialRental,
  });
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: rental ? `Pedido ${rental.code} · Mantovani` : 'Pedido · Mantovani',
          url,
        });
        return;
      } catch {
        // user cancelled or share failed; fall back to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  if (loading && !rental) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando pedido">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!rental) {
    const msg = error?.message || initialError?.message || 'Não foi possível carregar os dados deste pedido.';
    return (
      <Alert
        tone="danger"
        title="Não foi possível carregar o pedido"
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="dark" onClick={() => void refresh()}>
              <RefreshCw aria-hidden className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Link href="/alugar" className={buttonClasses({ variant: 'secondary' })}>
              Fazer novo pedido
            </Link>
          </div>
        }
      >
        {msg}
      </Alert>
    );
  }

  const addr = rental.deliveryAddress;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-yellow-400/25">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-semibold uppercase tracking-wider text-yellow-400">
                Pedido
              </span>
              <h1 className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {rental.code}
              </h1>
              <StatusBadge status={rental.status} />
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Criado em {formatDateTime(rental.createdAt)} · Período de {formatDateLong(rental.startDate)} até{' '}
              {formatDateLong(rental.endDate)} ({rental.days} {rental.days === 1 ? 'dia' : 'dias'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/pedidos/${encodeURIComponent(rental.id)}/contrato`}
              className={buttonClasses({ variant: 'dark', size: 'md' })}
            >
              <FileText aria-hidden className="h-4 w-4" />
              Ver Contrato &amp; Romaneio (PDF)
            </Link>
            <Button variant="secondary" size="md" onClick={handleShare}>
              {copiedLink ? (
                <>
                  <Check aria-hidden className="h-4 w-4 text-amber-400" />
                  Link copiado!
                </>
              ) : (
                <>
                  <Share2 aria-hidden className="h-4 w-4" />
                  Compartilhar
                </>
              )}
            </Button>
            <a
              href={whatsappLink(`Olá! Preciso de atendimento sobre o pedido ${rental.code}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: 'secondary', size: 'md' })}
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              Suporte WhatsApp
            </a>
          </div>
        </CardBody>
      </Card>

      {/* Status Timeline */}
      <StatusTimeline status={rental.status} />

      {/* Confirmed Banner */}
      {rental.status === 'CONFIRMED' || rental.status === 'ACTIVE' ? (
        <Alert
          tone="success"
          title="Locação ativa! Ordem de separação pronta para o estoque."
          action={
            <a
              href={rental.warehouseWhatsappUrl || warehouseOrderWhatsappLink(rental)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md transition hover:bg-emerald-400"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              Enviar Ordem de Separação ao Estoque (WhatsApp)
            </a>
          }
        >
          <p>
            Os ativos{' '}
            <span className="font-mono font-semibold text-amber-400">
              {rental.items.map((i) => i.assetTag).join(', ')}
            </span>{' '}
            foram alocados para entrega na obra em <strong className="text-white">{formatDateLong(rental.startDate)}</strong>.
          </p>
        </Alert>
      ) : null}

      {/* Pending Payment Panel */}
      {rental.status === 'PENDING_PAYMENT' ? (
        <PaymentPanel
          rental={rental}
          polling={polling}
          onRentalUpdate={(updated) => setRental(updated)}
          showOrderPageLink={false}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <AllocatedItemsCard rental={rental} />
        </div>

        <div className="space-y-6">
          {/* Delivery Info */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <MapPin aria-hidden className="h-5 w-5 text-yellow-400" />
                  Entrega na obra
                </span>
              }
            />
            <CardBody className="space-y-3 text-sm text-slate-300">
              <div>
                <p className="font-semibold text-white">
                  {addr.street}, {addr.number}
                  {addr.complement ? ` · ${addr.complement}` : ''}
                </p>
                <p className="text-slate-300">
                  {addr.district} · {addr.city}/{addr.state}
                </p>
                <p className="font-mono text-xs text-yellow-400">CEP {maskCep(addr.cep)}</p>
              </div>
              {addr.reference ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3 text-xs text-slate-300">
                  <strong className="font-semibold text-white">Referência:</strong> {addr.reference}
                </div>
              ) : null}
              <div className="flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-300">
                <Calendar aria-hidden className="h-4 w-4 text-yellow-400" />
                <span>
                  Início: <strong className="text-white">{formatDateLong(rental.startDate)}</strong> · Término:{' '}
                  <strong className="text-white">{formatDateLong(rental.endDate)}</strong>
                </span>
              </div>
              {rental.deliveryTimeSlot ? (
                <div className="flex items-center gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-300">
                  <Clock aria-hidden className="h-4 w-4 shrink-0 text-yellow-400" />
                  <span>
                    Janela agendada: <strong className="text-white font-mono">{rental.deliveryTimeSlot}</strong>
                  </span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Building2 aria-hidden className="h-5 w-5 text-yellow-400" />
                  Empresa locatária
                </span>
              }
            />
            <CardBody className="space-y-1.5 text-sm text-slate-300">
              <p className="font-semibold text-white">{rental.client.companyName}</p>
              {rental.client.tradeName ? (
                <p className="text-slate-300">{rental.client.tradeName}</p>
              ) : null}
              <p className="font-mono text-xs text-yellow-400">CNPJ {maskCnpj(rental.client.cnpj)}</p>
            </CardBody>
          </Card>

          {/* Paid / Payment Info Summary when not pending */}
          {rental.status !== 'PENDING_PAYMENT' && rental.payment ? (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CreditCard aria-hidden className="h-5 w-5 text-yellow-400" />
                    Dados do pagamento
                  </span>
                }
              />
              <CardBody className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Método</span>
                  <span className="font-semibold text-white">{PAYMENT_METHOD_LABEL[rental.payment.method]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Valor</span>
                  <span className="font-semibold text-amber-400 tabular-nums">{formatBRL(rental.payment.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <Badge tone={rental.payment.status === 'PAID' ? 'success' : 'neutral'}>
                    {rental.payment.status === 'PAID' ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Pago
                      </span>
                    ) : (
                      rental.payment.status
                    )}
                  </Badge>
                </div>
                {rental.payment.paidAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Confirmado em</span>
                    <span className="text-white tabular-nums">{formatDateTime(rental.payment.paidAt)}</span>
                  </div>
                ) : null}
                <div className="border-t border-white/10 pt-2 text-xs text-slate-400">
                  ID transação: <span className="font-mono text-yellow-400">{rental.payment.gatewayTxId}</span>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Link href="/alugar" className={buttonClasses({ variant: 'secondary', block: true })}>
            <Plus aria-hidden className="h-5 w-5" />
            Alugar outro equipamento
          </Link>
        </div>
      </div>
    </div>
  );
}
