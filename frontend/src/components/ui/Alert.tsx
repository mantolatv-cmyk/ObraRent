import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const styles: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: {
    box: 'border-yellow-400/35 bg-yellow-400/35 text-yellow-400 backdrop-blur-xl shadow-[0_0_24px_-4px_rgba(250, 204, 21, 0.25)]',
    icon: 'text-yellow-400',
    Icon: Info,
  },
  success: {
    box: 'border-amber-400/40 bg-amber-400/35 text-amber-400 backdrop-blur-xl shadow-[0_0_24px_-4px_rgba(250, 204, 21, 0.25)]',
    icon: 'text-amber-400',
    Icon: CheckCircle2,
  },
  warning: {
    box: 'border-amber-400/40 bg-amber-950/35 text-amber-100 backdrop-blur-xl shadow-[0_0_24px_-4px_rgba(245,158,11,0.18)]',
    icon: 'text-amber-400',
    Icon: AlertTriangle,
  },
  danger: {
    box: 'border-rose-500/45 bg-rose-950/35 text-rose-100 backdrop-blur-xl shadow-[0_0_24px_-4px_rgba(244,63,94,0.2)]',
    icon: 'text-rose-400',
    Icon: XCircle,
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}

export function Alert({ tone = 'info', title, children, action, className, role }: AlertProps) {
  const s = styles[tone];
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={cn('flex gap-3 rounded-2xl border p-4', s.box, className)}
    >
      <s.Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', s.icon)} />
      <div className="min-w-0 flex-1 text-base">
        {title ? <p className="font-semibold text-white">{title}</p> : null}
        {children ? <div className={cn(title ? 'mt-1' : '', 'text-slate-200')}>{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
