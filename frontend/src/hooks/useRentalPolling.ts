'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { RentalSummary } from '@/lib/types';

const POLL_MS = 3000;

interface Options {
  initial?: RentalSummary | null;
  intervalMs?: number;
}

/**
 * Polls GET /rentals/:id every 3s while the rental is PENDING_PAYMENT.
 * Stops on any other status or on unmount; pauses while the tab is hidden
 * and refreshes immediately when it becomes visible again.
 */
export function useRentalPolling(id: string | null, { initial = null, intervalMs = POLL_MS }: Options = {}) {
  const [rental, setRental] = useState<RentalSummary | null>(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!initial && Boolean(id));
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!id) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const data = await api.rental(id, { signal: ctrl.signal });
      setRental(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.isAborted) return;
      setError(e instanceof ApiError ? e : new ApiError(0, { code: 'NETWORK_ERROR', message: 'Falha ao atualizar.' }));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [id]);

  // Initial fetch when no data was provided.
  useEffect(() => {
    if (!id || initial) return;
    void fetchOnce();
  }, [id, initial, fetchOnce]);

  const shouldPoll = Boolean(id) && rental?.status === 'PENDING_PAYMENT';

  useEffect(() => {
    if (!shouldPoll) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await fetchOnce();
        schedule();
      }, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer);
        void fetchOnce().then(schedule);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [shouldPoll, fetchOnce, intervalMs]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  return { rental, setRental, error, loading, refresh: fetchOnce, polling: shouldPoll };
}
