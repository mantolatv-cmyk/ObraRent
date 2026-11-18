'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  HardHat,
  MapPin,
  Plus,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { StatusBadge } from '@/components/order/StatusTimeline';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import {
  formatBRL,
  formatCpfOrCnpj,
  formatDateShort,
  formatPeriod,
  maskCep,
  maskCpfOrCnpj,
  PAYMENT_METHOD_LABEL,
} from '@/lib/format';
import type { RentalSummary } from '@/lib/types';

type FilterTab = 'ALL' | 'ACTIVE' | 'HISTORY';

export default function MinhasLocacoesPage() {
  const { user } = useAuth();
  const [rentals, setRentals] = useState<RentalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extendingKey, setExtendingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const loadRentals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listRentals({ limit: 100, cnpj: user?.cnpj });
      setRentals(data.rentals);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível carregar os contratos de locação.'));
    } finally {
      setLoading(false);
    }
  }, [user?.cnpj]);

  useEffect(() => {
    void loadRentals();
  }, [loadRentals]);

  const handleExtend = async (rental: RentalSummary, days: number) => {
    const key = `${rental.id}-${days}`;
    setExtendingKey(key);
    setError(null);
    setFeedback(null);
    try {
      const updated = await api.extendRental(rental.id, days);
      setRentals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setFeedback(
        `Contrato ${updated.code} prorrogado em +${days} dias! Novo término: ${formatDateShort(
          updated.endDate,
        )} (${updated.days} diárias · Total atualizado: ${formatBRL(updated.totalAmount)}).`,
      );
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível prorrogar este contrato para o período solicitado.'));
    } finally {
      setExtendingKey(null);
    }
  };

  const activeRentals = useMemo(
    () =>
      rentals.filter(
        (r) => r.status === 'ACTIVE' || r.status === 'CONFIRMED' || r.status === 'PENDING_PAYMENT',
      ),
    [rentals],
  );

  const historyRentals = useMemo(
    () => rentals.filter((r) => r.status === 'COMPLETED' || r.status === 'CANCELLED'),
    [rentals],
  );

  const displayedRentals = useMemo(() => {
    if (activeTab === 'ACTIVE') return activeRentals;
    if (activeTab === 'HISTORY') return historyRentals;
    return rentals;
  }, [activeTab, activeRentals, historyRentals, rentals]);

  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-content space-y-4 sm:space-y-6 px-3.5 pb-28 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
        {/* Page Header */}
        <div className="flex flex-col gap-3 rounded-2xl border border-yellow-400/25 bg-slate-900/65 p-4 text-white backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-yellow-400">
              <Building2 aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
                Painel do Cliente · Mantovani
              </span>
            </div>
            <h1 className="bg-gradient-to-r from-white via-yellow-300 to-amber-400 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-3xl">
              Minhas Locações &amp; Contratos
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Acompanhe seus equipamentos alocados na obra e o histórico completo de pedidos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => void loadRentals()} loading={loading} className="text-xs sm:text-sm h-9 sm:h-10">
              <RefreshCw aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Atualizar
            </Button>
            <Link href="/alugar" className={buttonClasses({ variant: 'primary', size: 'md', className: 'text-xs sm:text-sm h-9 sm:h-10 font-bold' })}>
              <Plus aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Nova Locação
            </Link>
          </div>
        </div>

        {/* User Account Status Indicator */}
        {user ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2.5 text-xs text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.15)]">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="truncate">
                Exibindo contratos de <strong>{user.companyName}</strong> (Doc: {formatCpfOrCnpj(user.cnpj)})
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-xs text-slate-300">
            <span>💡 <strong>Dica:</strong> Faça login para gerenciar apenas os contratos vinculados à sua conta.</span>
            <Link href="/login?redirect=/minhas-locacoes" className="font-semibold text-yellow-400 hover:underline shrink-0">
              Entrar ou Criar Conta →
            </Link>
          </div>
        )}

        {/* Operational Overview Metrics - Mobile 3-col Segments */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={cn(
              'rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 text-left transition-all backdrop-blur-md active:scale-95',
              activeTab === 'ALL'
                ? 'border-yellow-400/60 bg-yellow-400/25 ring-1 ring-yellow-400/40 shadow-[0_0_20px_rgba(250,204,21,0.25)]'
                : 'border-white/10 bg-slate-950/65 hover:border-yellow-400/35 hover:bg-slate-900/60',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-yellow-400 truncate">
                Total
              </p>
              <HardHat aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-400 shrink-0" />
            </div>
            <p className="mt-0.5 sm:mt-1 font-mono text-lg sm:text-2xl font-bold text-white tabular-nums">
              {rentals.length}
            </p>
            <p className="hidden sm:block mt-0.5 text-xs text-slate-400">Todos os pedidos</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={cn(
              'rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 text-left transition-all backdrop-blur-md active:scale-95',
              activeTab === 'ACTIVE'
                ? 'border-amber-400/60 bg-amber-400/25 ring-1 ring-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : 'border-white/10 bg-slate-950/65 hover:border-amber-400/35 hover:bg-slate-900/60',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400 truncate">
                Ativos
              </p>
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-400" />
              </span>
            </div>
            <p className="mt-0.5 sm:mt-1 font-mono text-lg sm:text-2xl font-bold text-amber-400 tabular-nums drop-shadow-[0_0_10px_rgba(250,204,21,0.25)]">
              {activeRentals.length}
            </p>
            <p className="hidden sm:block mt-0.5 text-xs text-slate-300">Na obra agora</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={cn(
              'rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 text-left transition-all backdrop-blur-md active:scale-95',
              activeTab === 'HISTORY'
                ? 'border-slate-300/60 bg-slate-800/40 ring-1 ring-slate-300/30 shadow-[0_0_16px_rgba(255,255,255,0.1)]'
                : 'border-white/10 bg-slate-950/65 hover:border-white/20 hover:bg-slate-900/60',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 truncate">
                Histórico
              </p>
              <Clock aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
            </div>
            <p className="mt-0.5 sm:mt-1 font-mono text-lg sm:text-2xl font-bold text-slate-200 tabular-nums">
              {historyRentals.length}
            </p>
            <p className="hidden sm:block mt-0.5 text-xs text-slate-400">Finalizados</p>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all',
              activeTab === 'ALL'
                ? 'border border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-[0_0_16px_rgba(250, 204, 21, 0.25)]'
                : 'border border-white/10 bg-slate-900/65 text-slate-300 hover:border-yellow-400/35 hover:text-white',
            )}
          >
            Todos ({rentals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all',
              activeTab === 'ACTIVE'
                ? 'border border-amber-400/50 bg-amber-400/15 text-amber-400 shadow-[0_0_16px_rgba(250, 204, 21, 0.25)]'
                : 'border border-white/10 bg-slate-900/65 text-slate-300 hover:border-amber-400/35 hover:text-white',
            )}
          >
            Ativos em Obra ({activeRentals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all',
              activeTab === 'HISTORY'
                ? 'border border-slate-400/50 bg-slate-500/15 text-slate-200 shadow-[0_0_16px_rgba(255,255,255,0.1)]'
                : 'border border-white/10 bg-slate-900/65 text-slate-300 hover:border-white/30 hover:text-white',
            )}
          >
            Histórico ({historyRentals.length})
          </button>
        </div>

        {error ? (
          <Alert tone="danger" title="Atenção">
            {error}
          </Alert>
        ) : null}

        {feedback ? (
          <Alert tone="success" title="Prorrogação confirmada">
            {feedback}
          </Alert>
        ) : null}

        {/* Contracts List */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        ) : displayedRentals.length === 0 ? (
          <Card>
            <CardBody className="space-y-3 py-12 text-center">
              <p className="text-base font-medium text-slate-300">
                {activeTab === 'ACTIVE'
                  ? 'Nenhum contrato ativo no momento.'
                  : activeTab === 'HISTORY'
                    ? 'Nenhum contrato no histórico.'
                    : 'Nenhum contrato de locação encontrado.'}
              </p>
              <div>
                <Link href="/alugar" className={buttonClasses({ variant: 'primary', size: 'md' })}>
                  Alugar equipamentos agora
                </Link>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayedRentals.map((rental) => {
              const addr = rental.deliveryAddress;
              const canExtend = rental.status === 'CONFIRMED' || rental.status === 'ACTIVE';

              return (
                <Card key={rental.id} interactive>
                  <CardBody className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link
                            href={`/pedidos/${encodeURIComponent(rental.id)}`}
                            className="font-mono text-xl font-bold text-yellow-400 hover:text-amber-400 hover:underline"
                          >
                            {rental.code}
                          </Link>
                          <StatusBadge status={rental.status} />
                          <Badge tone="neutral">{rental.channel}</Badge>
                          {rental.payment ? (
                            <Badge tone="info">
                              {PAYMENT_METHOD_LABEL[rental.payment.method]}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {rental.client.companyName}{' '}
                          <span className="font-mono text-xs font-normal text-slate-400">
                            · {rental.client.cnpj.length <= 11 ? 'CPF' : 'CNPJ'} {maskCpfOrCnpj(rental.client.cnpj)}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-300">
                          <MapPin aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                          <span>
                            Entrega: {addr.street}, {addr.number} — {addr.district}, {addr.city}/{addr.state} (CEP{' '}
                            {maskCep(addr.cep)})
                          </span>
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="font-mono text-xl font-bold text-amber-400 tabular-nums drop-shadow-[0_0_8px_rgba(250, 204, 21, 0.25)]">
                          {formatBRL(rental.totalAmount)}
                        </p>
                        <p className="text-xs font-medium text-slate-400">
                          {formatPeriod(rental.startDate, rental.endDate)} · {rental.days} diárias
                        </p>
                      </div>
                    </div>

                    {/* Allocated Asset Tags */}
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/65 px-3.5 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Equipamentos alocados:
                      </span>
                      {rental.items.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-400/35 bg-yellow-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-yellow-400"
                        >
                          <Tag aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                          {item.assetTag}
                          <span className="font-sans font-normal text-slate-300">({item.categoryName})</span>
                        </span>
                      ))}
                    </div>

                    {/* Express Extension + Links Bar */}
                    <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      {canExtend ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-yellow-400">
                            <CalendarPlus aria-hidden className="h-4 w-4 text-amber-400" />
                            Prorrogar:
                          </span>
                          {[3, 7, 15].map((days) => {
                            const isBusy = extendingKey === `${rental.id}-${days}`;
                            return (
                              <Button
                                key={days}
                                variant="secondary"
                                size="md"
                                loading={isBusy}
                                disabled={extendingKey !== null}
                                onClick={() => void handleExtend(rental, days)}
                                className="h-9 min-h-9 px-3 text-xs"
                              >
                                +{days} dias
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                          <CheckCircle2 aria-hidden className="h-4 w-4 text-yellow-400" />
                          {rental.status === 'COMPLETED'
                            ? 'Contrato concluído e equipamentos devolvidos ao pátio.'
                            : rental.status === 'CANCELLED'
                              ? 'Contrato cancelado.'
                              : 'Aguardando confirmação de pagamento para liberar prorrogações.'}
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/pedidos/${encodeURIComponent(rental.id)}/contrato`}
                          className={buttonClasses({
                            variant: 'dark',
                            size: 'md',
                            className: 'h-10 min-h-10 px-3.5 text-xs',
                          })}
                        >
                          <FileText aria-hidden className="h-4 w-4" />
                          Contrato &amp; Romaneio (PDF)
                        </Link>
                        <Link
                          href={`/pedidos/${encodeURIComponent(rental.id)}`}
                          className={buttonClasses({
                            variant: 'secondary',
                            size: 'md',
                            className: 'h-10 min-h-10 px-3.5 text-xs',
                          })}
                        >
                          Acompanhar Pedido
                          <ArrowRight aria-hidden className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
