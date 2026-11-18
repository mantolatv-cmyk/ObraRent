import { Check, Clock, PackageCheck, Truck, XCircle } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { RentalStatus } from '@/lib/types';

export function statusMeta(status: RentalStatus): {
  label: string;
  description: string;
  tone: BadgeTone;
} {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        label: 'Aguardando pagamento',
        description: 'Equipamentos reservados temporariamente aguardando confirmação do pagamento.',
        tone: 'warning',
      };
    case 'CONFIRMED':
      return {
        label: 'Reserva confirmada',
        description: 'Pagamento aprovado! Seus equipamentos estão separados para expedição.',
        tone: 'success',
      };
    case 'ACTIVE':
      return {
        label: 'Em locação na obra',
        description: 'Equipamentos entregues e em operação no canteiro de obras.',
        tone: 'info',
      };
    case 'COMPLETED':
      return {
        label: 'Locação concluída',
        description: 'Equipamentos devolvidos e conferidos. Obrigado por alugar com a Mantovani!',
        tone: 'neutral',
      };
    case 'CANCELLED':
      return {
        label: 'Pedido cancelado',
        description: 'Esta reserva foi cancelada e os equipamentos voltaram para o estoque.',
        tone: 'danger',
      };
  }
}

const TIMELINE_STEPS: {
  status: Exclude<RentalStatus, 'CANCELLED'>;
  label: string;
  detail: string;
  Icon: typeof Clock;
}[] = [
  {
    status: 'PENDING_PAYMENT',
    label: 'Aguardando pagamento',
    detail: 'Reserva criada',
    Icon: Clock,
  },
  {
    status: 'CONFIRMED',
    label: 'Confirmado',
    detail: 'Ativos alocados',
    Icon: Check,
  },
  {
    status: 'ACTIVE',
    label: 'Em operação na obra',
    detail: 'Expedido para o endereço',
    Icon: Truck,
  },
  {
    status: 'COMPLETED',
    label: 'Concluído',
    detail: 'Devolução registrada',
    Icon: PackageCheck,
  },
];

const ORDER_INDEX: Record<Exclude<RentalStatus, 'CANCELLED'>, number> = {
  PENDING_PAYMENT: 0,
  CONFIRMED: 1,
  ACTIVE: 2,
  COMPLETED: 3,
};

export function StatusBadge({ status }: { status: RentalStatus }) {
  const meta = statusMeta(status);
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function StatusTimeline({ status }: { status: RentalStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-rose-500/45 bg-rose-950/35 p-4 text-rose-100 backdrop-blur-xl shadow-[0_0_24px_-4px_rgba(244,63,94,0.2)]">
        <XCircle aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-rose-400" />
        <div>
          <p className="font-semibold text-white">Pedido cancelado</p>
          <p className="mt-0.5 text-sm text-rose-200/90">
            Esta locação foi cancelada e os equipamentos reservados foram liberados.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = ORDER_INDEX[status];

  return (
    <ol aria-label="Andamento do pedido" className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      {TIMELINE_STEPS.map((step, idx) => {
        const done = idx < currentIdx || status === 'COMPLETED';
        const active = idx === currentIdx && status !== 'COMPLETED';
        const StepIcon = done ? Check : step.Icon;

        return (
          <li
            key={step.status}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-2xl border p-3.5 backdrop-blur-xl transition-all sm:flex-col sm:items-start sm:gap-2',
              done &&
                'border-amber-400/45 bg-amber-400/30 text-amber-400 shadow-[0_0_22px_-4px_rgba(250, 204, 21, 0.25)]',
              active &&
                'border-yellow-400/60 bg-yellow-400/35 text-white ring-1 ring-yellow-400/40 shadow-[0_0_26px_-4px_rgba(250, 204, 21, 0.25)]',
              !done && !active && 'border-white/10 bg-slate-900/55 text-slate-400',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                done &&
                  'border border-amber-400/50 bg-amber-400/20 text-amber-400 shadow-[0_0_12px_rgba(250, 204, 21, 0.25)]',
                active &&
                  'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-[0_0_16px_rgba(250, 204, 21, 0.25)]',
                !done && !active && 'border border-white/10 bg-slate-950/70 text-slate-500',
              )}
            >
              <StepIcon aria-hidden className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className={cn('text-sm font-semibold leading-snug', (done || active) && 'text-white')}>
                {step.label}
              </p>
              <p className="text-xs opacity-80">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
