'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { onlyDigits } from '@/lib/format';
import { isValidCpfOrCnpj } from '@/lib/validation';
import type { CnpjLookup } from '@/lib/types';

export type CnpjLookupState =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'loading'; cnpj: string }
  | { status: 'success'; cnpj: string; data: CnpjLookup }
  | { status: 'error'; cnpj: string; error: ApiError };

/**
 * Fires automatically once 11 (CPF) or 14 (CNPJ) digits are typed, after validating check digits
 * locally (no request for an invalid document).
 */
export function useCnpjLookup(value: string): CnpjLookupState {
  const digits = onlyDigits(value);
  const complete = digits.length === 11 || digits.length === 14;
  const valid = complete && isValidCpfOrCnpj(digits);
  const [state, setState] = useState<CnpjLookupState>({ status: 'idle' });

  useEffect(() => {
    if (!valid) return;
    const ctrl = new AbortController();
    setState({ status: 'loading', cnpj: digits });
    api
      .cnpj(digits, { signal: ctrl.signal })
      .then((data) => setState({ status: 'success', cnpj: digits, data }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.isAborted) return;
        setState({
          status: 'error',
          cnpj: digits,
          error: err instanceof ApiError ? err : new ApiError(0, { code: 'NETWORK_ERROR', message: 'Falha na consulta.' }),
        });
      });
    return () => ctrl.abort();
  }, [digits, valid]);

  if (!complete) return { status: 'idle' };
  if (!valid) return { status: 'invalid' };
  // Guard against a stale result for a previous CNPJ during the render before the effect runs.
  if (state.status !== 'idle' && state.status !== 'invalid' && state.cnpj !== digits) {
    return { status: 'loading', cnpj: digits };
  }
  return state.status === 'idle' ? { status: 'loading', cnpj: digits } : state;
}
