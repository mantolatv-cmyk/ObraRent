import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'dark' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-yellow-500/15 text-yellow-300 border border-yellow-400/35 shadow-[0_0_12px_rgba(250,204,21,0.18)]',
  info: 'bg-amber-500/15 text-amber-300 border border-amber-400/35 shadow-[0_0_12px_rgba(245,158,11,0.18)]',
  success: 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/40 shadow-[0_0_12px_rgba(250,204,21,0.25)]',
  warning: 'bg-amber-500/15 text-amber-300 border border-amber-400/40',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-400/40',
  accent:
    'bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-yellow-300 border border-yellow-400/50 shadow-[0_0_14px_rgba(250,204,21,0.3)]',
  dark: 'bg-slate-900/90 text-yellow-300 border border-yellow-400/35 shadow-[0_0_12px_rgba(250,204,21,0.15)]',
};

const dots: Record<BadgeTone, string> = {
  neutral: 'bg-yellow-400 shadow-[0_0_6px_#facc15]',
  info: 'bg-amber-400 shadow-[0_0_6px_#fbbf24]',
  success: 'bg-yellow-400 shadow-[0_0_6px_#facc15]',
  warning: 'bg-amber-400 shadow-[0_0_6px_#fbbf24]',
  danger: 'bg-rose-400 shadow-[0_0_6px_#fb7185]',
  accent: 'bg-yellow-400 shadow-[0_0_6px_#facc15]',
  dark: 'bg-yellow-400 shadow-[0_0_6px_#facc15]',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium backdrop-blur-md',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className={cn('h-2 w-2 rounded-full', dots[tone])} /> : null}
      {children}
    </span>
  );
}
