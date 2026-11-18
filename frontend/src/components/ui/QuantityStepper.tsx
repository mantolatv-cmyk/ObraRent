import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  className?: string;
}

const btn =
  'flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-slate-900/75 text-slate-100 backdrop-blur-md ' +
  'transition-all duration-150 motion-reduce:transition-none hover:border-yellow-400/50 hover:bg-yellow-400/15 hover:text-yellow-400 active:scale-95 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ' +
  'disabled:cursor-not-allowed disabled:opacity-35';

/** +/- control with 48px targets. */
export function QuantityStepper({ value, onChange, min = 0, max = 50, label, className }: QuantityStepperProps) {
  return (
    <div role="group" aria-label={`Quantidade de ${label}`} className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Remover um ${label}`}
      >
        <Minus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <output
        aria-live="polite"
        className={cn(
          'w-10 text-center text-xl font-bold tabular-nums',
          value > 0 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(250, 204, 21, 0.25)]' : 'text-slate-400',
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={cn(
          btn,
          value === 0
            ? 'border-amber-400/60 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-[0_0_18px_rgba(250, 204, 21, 0.25)] hover:text-slate-950 hover:brightness-110'
            : 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400 shadow-[0_0_14px_rgba(250, 204, 21, 0.25)] hover:bg-yellow-400/25',
        )}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Adicionar um ${label}`}
      >
        <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
