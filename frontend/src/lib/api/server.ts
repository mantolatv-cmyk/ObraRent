import { request } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Category, RentalSummary } from '@/lib/types';

export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; status: number } };

function toFailure(e: unknown): Result<never> {
  if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message, status: e.status } };
  return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Falha inesperada.', status: 0 } };
}

/**
 * Server-side fetchers. They NEVER throw so pages render (and build) even
 * when the API is unreachable.
 */
export async function getCategoriesSafe(): Promise<Result<Category[]>> {
  try {
    const data = await request<Category[]>('/equipment/categories', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return { ok: true, data };
  } catch (e) {
    return toFailure(e);
  }
}

export async function getRentalSafe(id: string): Promise<Result<RentalSummary>> {
  try {
    const data = await request<RentalSummary>(`/rentals/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return { ok: true, data };
  } catch (e) {
    return toFailure(e);
  }
}
