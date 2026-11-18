import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'block h-12 min-h-12 w-full rounded-xl border bg-slate-950/75 backdrop-blur-md px-4 text-base text-white placeholder:text-slate-500 ' +
  'transition-all duration-150 motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 focus:shadow-[0_0_18px_rgba(250, 204, 21, 0.25)] ' +
  'disabled:cursor-not-allowed disabled:bg-slate-900/50 disabled:text-slate-500 read-only:bg-slate-900/60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  trailing?: ReactNode;
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, trailing, leading, className, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        invalid ? 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-400/30' : 'border-white/15',
        leading ? 'pl-11' : '',
        trailing ? 'pr-12' : '',
        className,
      )}
      {...props}
    />
  );
  if (!trailing && !leading) return input;
  return (
    <div className="relative">
      {leading ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center">
          {leading}
        </div>
      ) : null}
      {input}
      {trailing ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center">
          {trailing}
        </div>
      ) : null}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        'appearance-none pr-8 [&>option]:bg-slate-950 [&>option]:text-slate-100',
        invalid ? 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-400/30' : 'border-white/15',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
