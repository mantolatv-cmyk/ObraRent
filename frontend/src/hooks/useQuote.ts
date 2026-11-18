'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Quote, QuoteRequest } from '@/lib/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface State {
  quote: Quote | null;
  loading: boolean;
  error: ApiError | null;
}

/** Calls POST /rentals/quote whenever the (serialized) request changes. Pass null to disable. */
export function useQuote(req: QuoteRequest | null, debounceMs = 400) {
  const key = req ? JSON.stringify(req) : '';
  const debouncedKey = useDebouncedValue(key, debounceMs);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State>({ quote: null, loading: false, error: null });

  useEffect(() => {
    if (!debouncedKey) {
      setState({ quote: null, loading: false, error: null });
      return;
    }
    const body = JSON.parse(debouncedKey) as QuoteRequest;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .quote(body, { signal: ctrl.signal })
      .then((quote) => setState({ quote, loading: false, error: null }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.isAborted) return;
        setState({
          quote: null,
          loading: false,
          error: err instanceof ApiError ? err : new ApiError(0, { code: 'NETWORK_ERROR', message: 'Falha ao calcular.' }),
        });
      });
    return () => ctrl.abort();
  }, [debouncedKey, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, pending: key !== debouncedKey || state.loading, reload };
}
