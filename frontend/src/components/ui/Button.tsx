import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'icon';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold tracking-tight ' +
  'transition-all duration-200 motion-reduce:transition-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b12] ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 text-slate-950 font-bold shadow-[0_0_22px_rgba(250,204,21,0.45)] hover:shadow-[0_0_30px_rgba(250,204,21,0.7)] hover:brightness-110 active:brightness-95',
  dark:
    'bg-slate-900/80 backdrop-blur-md text-yellow-200 border border-yellow-400/40 hover:bg-yellow-500/20 hover:border-yellow-300 hover:text-white shadow-[0_0_18px_rgba(250,204,21,0.2)]',
  secondary:
    'bg-slate-900/70 backdrop-blur-md text-yellow-300 border border-yellow-400/35 hover:border-yellow-300 hover:bg-yellow-500/15 shadow-[0_0_15px_rgba(250,204,21,0.15)]',
  outline:
    'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-yellow-400/40 hover:text-white',
  ghost:
    'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 hover:border-yellow-400/40 hover:text-white',
  danger:
    'bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 hover:border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.15)]',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-12 min-h-12 px-5 text-base',
  lg: 'h-14 min-h-14 px-6 text-lg',
  icon: 'h-12 w-12 min-h-12 min-w-12 p-0',
};

export function buttonClasses(
  opts: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {},
) {
  const { variant = 'primary', size = 'md', block = false, className } = opts;
  return cn(base, variants[variant], sizes[size], block && 'w-full', className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading = false, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
});
