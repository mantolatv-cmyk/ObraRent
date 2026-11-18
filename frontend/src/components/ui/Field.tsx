'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  invalid?: boolean;
}

export interface FieldProps {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactElement<ControlProps>;
  id?: string;
}

/**
 * Label + control + hint/error. Wires id, aria-describedby and aria-invalid
 * into the single child control.
 */
export function Field({ label, error, hint, optional = false, className, children, id }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? children.props.id ?? `f-${autoId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        invalid: Boolean(error),
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="text-sm font-semibold text-slate-200">
        {label}
        {optional ? <span className="ml-1 font-normal text-slate-400">(opcional)</span> : null}
      </label>
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-slate-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-rose-400" role="alert">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
