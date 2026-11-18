'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Percent,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import {
  addDaysISO,
  formatBRL,
  formatDateLong,
  inclusiveDays,
  pluralize,
  todayISO,
} from '@/lib/format';
import { api, errorMessage, type ApiError } from '@/lib/api';
import type {
  Category,
  CategoryAvailability,
  InsufficientAvailabilityDetail,
  TimeSlotAvailability,
} from '@/lib/types';

const DURATION_CHIPS: { label: string; days: number; tomorrowStart?: boolean; badge?: string }[] = [
  { label: 'Amanhã · 1 dia', days: 1, tomorrowStart: true },
  { label: '3 dias', days: 3 },
  { label: '7 dias', days: 7, badge: '-10%' },
  { label: '15 dias', days: 15, badge: '-10%' },
  { label: '30 dias', days: 30, badge: '-20%' },
];

export interface DatesStepProps {
  startDate: string;
  endDate: string;
  onDatesChange: (startDate: string, endDate: string) => void;
  deliveryTimeSlot: string;
  onDeliveryTimeSlotChange: (slot: string) => void;
  selectedCategories: { category: Category; quantity: number }[];
  onQuantityChange: (categoryId: string, quantity: number) => void;
  availabilityByCategory: (categoryId: string) => CategoryAvailability | undefined;
  availabilityLoading: boolean;
  availabilityError: ApiError | null;
  onReloadAvailability: () => void;
  shortfalls: InsufficientAvailabilityDetail[];
}

export function DatesStep({
  startDate,
  endDate,
  onDatesChange,
  deliveryTimeSlot,
  onDeliveryTimeSlotChange,
  selectedCategories,
  onQuantityChange,
  availabilityByCategory,
  availabilityLoading,
  availabilityError,
  onReloadAvailability,
  shortfalls,
}: DatesStepProps) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const days = inclusiveDays(startDate, endDate);

  const [timeSlots, setTimeSlots] = useState<TimeSlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const catSignature = selectedCategories
    .map((c) => `${c.category.id}:${c.quantity}`)
    .sort()
    .join(',');

  useEffect(() => {
    let active = true;
    if (!startDate || selectedCategories.length === 0) {
      setTimeSlots([]);
      return;
    }

    setLoadingSlots(true);
    setSlotsError(null);

    const categoryIds = selectedCategories.map((c) => c.category.id);
    const quantities = selectedCategories.map((c) => c.quantity);

    api
      .getTimeSlots({ date: startDate, categoryIds, quantities })
      .then((res) => {
        if (!active) return;
        setTimeSlots(res.slots);

        const currentSelected = res.slots.find((s) => s.slot === deliveryTimeSlot);
        if (deliveryTimeSlot && (!currentSelected || !currentSelected.available)) {
          const firstAvailable = res.slots.find((s) => s.available);
          onDeliveryTimeSlotChange(firstAvailable ? firstAvailable.slot : '');
        } else if (!deliveryTimeSlot) {
          const firstAvailable = res.slots.find((s) => s.available);
          if (firstAvailable) {
            onDeliveryTimeSlotChange(firstAvailable.slot);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setSlotsError(errorMessage(err, 'Erro ao carregar horários de entrega.'));
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [startDate, catSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChipClick = (chip: (typeof DURATION_CHIPS)[number]) => {
    const baseStart = chip.tomorrowStart ? tomorrow : startDate >= today ? startDate : tomorrow;
    const nextEnd = addDaysISO(baseStart, chip.days - 1);
    onDatesChange(baseStart, nextEnd);
  };

  return (
    <section aria-labelledby="step2-heading" className="space-y-6">
      <div>
        <h2 id="step2-heading" className="text-xl font-bold text-white">
          2. Período da locação
        </h2>
        <p className="mt-1 text-base text-slate-300">
          As diárias são contadas de forma inclusiva (data de entrega até a data de retirada).
        </p>
      </div>

      {shortfalls.length > 0 ? (
        <Alert
          tone="warning"
          title="A disponibilidade mudou para o período selecionado"
        >
          <p className="text-sm">
            Ajuste as quantidades ou escolha outras datas para continuar:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-medium">
            {shortfalls.map((s) => (
              <li key={s.categoryId}>
                {s.categoryName}: solicitado <strong>{s.requested}</strong>, disponível{' '}
                <strong>{s.available}</strong>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Datas de entrega e devolução"
          description={
            days > 0
              ? `${formatDateLong(startDate)} até ${formatDateLong(endDate)} · ${pluralize(days, 'diária', 'diárias')}`
              : 'Selecione datas válidas'
          }
        />
        <CardBody className="space-y-5">
          {/* Quick Duration Chips */}
          <div>
            <p className="text-sm font-semibold text-slate-200">Atalhos de duração</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Atalhos de duração">
              {DURATION_CHIPS.map((chip) => {
                const isActive = chip.tomorrowStart
                  ? startDate === tomorrow && days === 1
                  : days === chip.days && (!chip.tomorrowStart || startDate !== tomorrow);
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    aria-pressed={isActive}
                    className={cn(
                      'inline-flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400',
                      isActive
                        ? 'border-yellow-400 bg-yellow-400/20 text-white shadow-[0_0_20px_rgba(250, 204, 21, 0.25)]'
                        : 'border-white/15 bg-slate-950/65 text-slate-200 hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-400',
                    )}
                  >
                    <span>{chip.label}</span>
                    {chip.badge ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-bold',
                          isActive
                            ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(250, 204, 21, 0.25)]'
                            : 'border border-amber-400/40 bg-amber-400/15 text-amber-400',
                        )}
                      >
                        {chip.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Inputs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Início (entrega na obra)"
              error={startDate < today ? 'A data inicial não pode ser no passado.' : null}
            >
              <Input
                type="date"
                min={today}
                value={startDate}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  if (!nextStart) return;
                  const nextEnd = endDate < nextStart ? nextStart : endDate;
                  onDatesChange(nextStart, nextEnd);
                }}
              />
            </Field>

            <Field
              label="Término (retirada na obra)"
              error={endDate < startDate ? 'A data final deve ser igual ou posterior à inicial.' : null}
            >
              <Input
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(e) => {
                  const nextEnd = e.target.value;
                  if (!nextEnd) return;
                  onDatesChange(startDate, nextEnd);
                }}
              />
            </Field>
          </div>

          {/* Long-period Discount Banner */}
          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-sm backdrop-blur-md',
              days >= 7
                ? 'border-amber-400/45 bg-amber-400/35 text-amber-400 shadow-[0_0_24px_-4px_rgba(250, 204, 21, 0.25)]'
                : 'border-yellow-400/35 bg-yellow-400/30 text-yellow-400 shadow-[0_0_24px_-4px_rgba(250, 204, 21, 0.25)]',
            )}
          >
            {days >= 7 ? (
              <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            ) : (
              <Percent aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
            )}
            <div className="space-y-0.5">
              {days >= 30 ? (
                <>
                  <p className="font-semibold text-white">Desconto máximo de 20% aplicado automaticamente!</p>
                  <p className="text-amber-400/90">
                    Locações de 30 dias ou mais recebem 20% de desconto na diária de todos os equipamentos.
                  </p>
                </>
              ) : days >= 7 ? (
                <>
                  <p className="font-semibold text-white">Desconto de 10% aplicado automaticamente (7+ dias)!</p>
                  <p className="text-amber-400/90">
                    Dica: a partir de <strong className="text-amber-400">30 dias</strong>, o desconto sobe para{' '}
                    <strong className="text-amber-400">20% off</strong> nas diárias.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-white">Descontos progressivos para períodos longos</p>
                  <p className="text-slate-300">
                    Alugue por <strong className="text-yellow-400">7+ dias e ganhe 10% off</strong> ou por{' '}
                    <strong className="text-amber-400">30+ dias para 20% off</strong> no valor das diárias.
                  </p>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Horário de Entrega Disponível (Capacidade Operacional em Tempo Real) */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clock aria-hidden="true" className="h-5 w-5 text-yellow-400" />
              Horário de entrega na obra
            </span>
          }
          description={`Janelas de despacho para ${formatDateLong(startDate)}. A capacidade de cada horário é proporcional à frota física operacional.`}
        />
        <CardBody className="space-y-4">
          {slotsError ? (
            <Alert tone="warning" title="Não foi possível carregar os horários">
              {slotsError}
            </Alert>
          ) : null}

          {loadingSlots && timeSlots.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              role="radiogroup"
              aria-label="Horário de entrega na obra"
            >
              {timeSlots.map((slot) => {
                const isSelected = deliveryTimeSlot === slot.slot;
                const isAvailable = slot.available;

                return (
                  <button
                    key={slot.slot}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!isAvailable}
                    onClick={() => {
                      if (isAvailable) onDeliveryTimeSlotChange(slot.slot);
                    }}
                    className={cn(
                      'relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400',
                      isSelected
                        ? 'border-yellow-400 bg-yellow-400/20 text-white shadow-[0_0_24px_rgba(250,204,21,0.25)] ring-1 ring-yellow-400'
                        : isAvailable
                        ? 'border-white/10 bg-slate-950/65 text-slate-200 hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-white'
                        : 'border-white/5 bg-slate-950/40 text-slate-500 opacity-60 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <Clock
                            aria-hidden="true"
                            className={cn(
                              'h-4 w-4',
                              isSelected
                                ? 'text-yellow-400'
                                : isAvailable
                                ? 'text-slate-400'
                                : 'text-slate-600',
                            )}
                          />
                          <span
                            className={cn(
                              'text-base',
                              isSelected
                                ? 'text-white'
                                : isAvailable
                                ? 'text-slate-200'
                                : 'text-slate-500',
                            )}
                          >
                            {slot.slot}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{slot.periodLabel}</p>
                      </div>

                      {isSelected ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.5)]">
                          <Check aria-hidden="true" className="h-4 w-4 stroke-[3]" />
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 border-t border-white/5 pt-2">
                      {isAvailable ? (
                        <div className="flex items-center justify-between text-xs">
                          <Badge tone="success">
                            <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                            Disponível
                          </Badge>
                          <span className="font-mono text-[11px] text-slate-400">
                            {slot.categories
                              .map((c) => `${c.availableUnits}/${c.slotCapacity}`)
                              .join(' · ')}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge tone="danger">
                            <XCircle aria-hidden="true" className="h-3 w-3" />
                            Indisponível
                          </Badge>
                          {slot.reason ? (
                            <p className="text-[11px] font-medium leading-tight text-rose-400">
                              {slot.reason}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!deliveryTimeSlot && timeSlots.some((s) => s.available) ? (
            <p className="text-xs text-amber-300">
              * Selecione um dos horários disponíveis acima para agendar o despacho na obra.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Real-time Availability Check per Selected Line */}
      <Card>
        <CardHeader
          title="Disponibilidade em tempo real no período"
          description="Verificamos o estoque físico disponível para as datas escolhidas."
          action={
            <Button variant="ghost" size="md" onClick={onReloadAvailability} disabled={availabilityLoading}>
              <RefreshCw
                aria-hidden
                className={cn('h-4 w-4 text-yellow-400', availabilityLoading && 'animate-spin motion-reduce:animate-none')}
              />
              Atualizar
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {availabilityError ? (
            <Alert
              tone="warning"
              title="Não foi possível confirmar o estoque em tempo real"
              action={
                <Button variant="dark" size="md" onClick={onReloadAvailability}>
                  Tentar novamente
                </Button>
              }
            >
              {availabilityError.message}
            </Alert>
          ) : null}

          <ul className="divide-y divide-white/10">
            {selectedCategories.map(({ category, quantity }) => {
              const avail = availabilityByCategory(category.id);
              const availableCount = avail ? avail.availableCount : category.operationalUnits;
              const isOver = avail ? quantity > avail.availableCount : quantity > category.operationalUnits;
              const isZero = availableCount <= 0;
              const isTight = !isOver && availableCount <= 2;

              return (
                <li
                  key={category.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-semibold text-white">{category.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {availabilityLoading && !avail ? (
                        <Skeleton className="h-6 w-36 rounded-full" />
                      ) : isZero ? (
                        <Badge tone="danger">
                          <XCircle aria-hidden className="h-3.5 w-3.5" />0 disponíveis neste período
                        </Badge>
                      ) : isOver ? (
                        <Badge tone="danger">
                          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
                          Apenas {pluralize(availableCount, 'disponível', 'disponíveis')} (solicitado: {quantity})
                        </Badge>
                      ) : isTight ? (
                        <Badge tone="warning">
                          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
                          {pluralize(availableCount, 'disponível', 'disponíveis')} (últimas unidades)
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                          {pluralize(availableCount, 'disponível', 'disponíveis')}
                        </Badge>
                      )}
                      <span className="font-medium text-amber-400 tabular-nums">
                        {formatBRL(category.baseDailyRate)}/dia
                      </span>
                    </div>

                    {isOver ? (
                      <p role="alert" className="text-sm font-medium text-rose-400">
                        {availableCount > 0
                          ? `Reduza a quantidade para no máximo ${availableCount} para continuar.`
                          : 'Remova este item ou escolha outra data para continuar.'}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isOver && availableCount > 0 ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => onQuantityChange(category.id, availableCount)}
                      >
                        Ajustar para {availableCount}
                      </Button>
                    ) : null}
                    <QuantityStepper
                      label={category.name}
                      value={quantity}
                      min={0}
                      max={Math.max(quantity, Math.min(50, availableCount))}
                      onChange={(next) => onQuantityChange(category.id, next)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </section>
  );
}
