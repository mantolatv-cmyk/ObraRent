import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-slate-900/65 text-slate-100 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
        interactive &&
          'transition-all duration-200 hover:border-yellow-400/50 hover:shadow-[0_0_28px_-4px_rgba(250, 204, 21, 0.25)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  as: Tag = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0', className)}>
      <div className="min-w-0">
        <Tag className="text-lg font-semibold tracking-tight text-white">{title}</Tag>
        {description ? <p className="mt-1 text-base text-slate-300">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />;
}
