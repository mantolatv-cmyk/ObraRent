'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { onlyDigits } from '@/lib/format';
import type { CepLookup } from '@/lib/types';

export type CepLookupState =
  | { status: 'idle' }
  | { status: 'loading'; cep: string }
  | { status: 'success'; cep: string; data: CepLookup }
  | { status: 'error'; cep: string; error: ApiError };

/** Fires automatically when 8 digits are typed. */
export function useCepLookup(value: string): CepLookupState {
  const digits = onlyDigits(value);
  const complete = digits.length === 8;
  const [state, setState] = useState<CepLookupState>({ status: 'idle' });

  useEffect(() => {
    if (!complete) return;
    const ctrl = new AbortController();
    setState({ status: 'loading', cep: digits });
    api
      .cep(digits, { signal: ctrl.signal })
      .then((data) => setState({ status: 'success', cep: digits, data }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.isAborted) return;
        setState({
          status: 'error',
          cep: digits,
          error: err instanceof ApiError ? err : new ApiError(0, { code: 'NETWORK_ERROR', message: 'Falha na consulta.' }),
        });
      });
    return () => ctrl.abort();
  }, [digits, complete]);

  if (!complete) return { status: 'idle' };
  if (state.status === 'idle' || state.cep !== digits) return { status: 'loading', cep: digits };
  return state;
}
