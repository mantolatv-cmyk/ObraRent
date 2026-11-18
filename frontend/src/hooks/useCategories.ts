'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Category } from '@/lib/types';

interface State {
  categories: Category[];
  loading: boolean;
  error: ApiError | null;
}

/**
 * Category list. Uses server-provided `initial` data when available and only
 * fetches on the client when it is missing (e.g. API was down during SSR).
 */
export function useCategories(initial?: Category[] | null) {
  const hasInitial = Array.isArray(initial) && initial.length > 0;
  const [state, setState] = useState<State>({
    categories: hasInitial ? initial : [],
    loading: !hasInitial,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (hasInitial && nonce === 0) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .categories({ signal: ctrl.signal })
      .then((categories) => setState({ categories, loading: false, error: null }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.isAborted) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof ApiError ? e : new ApiError(0, { code: 'NETWORK_ERROR', message: 'Falha ao carregar.' }),
        }));
      });
    return () => ctrl.abort();
  }, [hasInitial, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
