import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-xl border border-white/5 bg-white/10 backdrop-blur-sm motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
