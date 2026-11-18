import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepperProps {
  steps: readonly string[];
  /** zero-based index of the current step */
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

/** Progress indicator for a multi-step flow. Past steps are clickable. */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <nav aria-label="Etapas do pedido" className={className}>
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done && Boolean(onStepClick);
          const content = (
            <>
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-all',
                  done &&
                    'border border-amber-400/50 bg-amber-400/20 text-amber-400 shadow-[0_0_14px_rgba(250, 204, 21, 0.25)]',
                  active &&
                    'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-[0_0_18px_rgba(250, 204, 21, 0.25)]',
                  !done && !active && 'border border-white/15 bg-slate-900/75 text-slate-400',
                )}
              >
                {done ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'truncate text-sm font-medium',
                  active ? 'font-semibold text-white' : done ? 'text-amber-400' : 'text-slate-400',
                  !active && 'hidden sm:inline',
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(i)}
                  className="-m-2 flex min-h-12 min-w-0 items-center gap-2 rounded-xl p-2 transition-colors hover:text-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                  aria-label={`Voltar para etapa ${i + 1}: ${label}`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-h-12 min-w-0 items-center gap-2">
                  {content}
                  <span className="sr-only">{done ? ' (concluída)' : active ? ' (etapa atual)' : ''}</span>
                </div>
              )}
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'h-px min-w-3 flex-1',
                    done
                      ? 'bg-gradient-to-r from-amber-400/60 to-yellow-400/60 shadow-[0_0_8px_rgba(250, 204, 21, 0.25)]'
                      : 'bg-white/10',
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
