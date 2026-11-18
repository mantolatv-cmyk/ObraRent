'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { parseISODate } from '@/lib/format';
import type { Availability, CategoryAvailability } from '@/lib/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Params {
  startDate: string;
  endDate: string;
  /** Restrict to one category (uses the `category_id` filter). Omit to fetch all. */
  categoryId?: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface State {
  data: Availability | null;
  loading: boolean;
  error: ApiError | null;
}

function validRange(start: string, end: string): boolean {
  const a = parseISODate(start);
  const b = parseISODate(end);
  return Boolean(a && b && b.getTime() >= a.getTime());
}

/** Real-time availability for a period — debounced and abortable. */
export function useAvailability({ startDate, endDate, categoryId, enabled = true, debounceMs = 300 }: Params) {
  const key = enabled && validRange(startDate, endDate) ? `${startDate}|${endDate}|${categoryId ?? ''}` : '';
  const debouncedKey = useDebouncedValue(key, debounceMs);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!debouncedKey) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const [s, e, c] = debouncedKey.split('|');
    const ctrl = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .availability({ startDate: s, endDate: e, categoryId: c || undefined }, { signal: ctrl.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.isAborted) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof ApiError ? err : new ApiError(0, { code: 'NETWORK_ERROR', message: 'Falha ao consultar.' }),
        });
      });
    return () => ctrl.abort();
  }, [debouncedKey, nonce]);

  const byCategory = useCallback(
    (id: string): CategoryAvailability | undefined => state.data?.categories.find((c) => c.categoryId === id),
    [state.data],
  );

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    ...state,
    // true while the user is still typing (key changed but not yet debounced)
    pending: key !== debouncedKey || state.loading,
    stale: Boolean(state.data && (state.data.startDate !== startDate || state.data.endDate !== endDate)),
    byCategory,
    reload,
  };
}
