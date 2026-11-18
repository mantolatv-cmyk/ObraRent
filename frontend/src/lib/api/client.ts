import { ApiError } from '@/lib/api/errors';
import type { ApiErrorBody } from '@/lib/types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

/** Server-side rendering may use an internal URL (e.g. docker network) when provided. */
function baseUrl(): string {
  if (typeof window === 'undefined' && process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL.replace(/\/+$/, '');
  }
  return API_URL;
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  cache?: RequestCache;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseErrorBody(json: unknown, status: number): ApiErrorBody {
  if (isRecord(json) && isRecord(json.error)) {
    const err = json.error;
    return {
      code: typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR',
      message: typeof err.message === 'string' ? err.message : defaultMessage(status),
      details: Array.isArray(err.details) ? (err.details as ApiErrorBody['details']) : [],
    };
  }
  return { code: status >= 500 ? 'INTERNAL_ERROR' : 'BAD_RESPONSE', message: defaultMessage(status) };
}

function defaultMessage(status: number): string {
  if (status === 404) return 'Não encontrado.';
  if (status >= 500) return 'Nosso servidor está instável. Tente novamente em instantes.';
  return 'Não foi possível concluir a solicitação.';
}

/**
 * Typed fetch wrapper. Unwraps `{ data }` envelopes and throws `ApiError`
 * for `{ error }` envelopes, network failures and aborted requests.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, cache = 'no-store', headers = {} } = opts;
  let res: Response;
  const token = typeof window !== 'undefined' ? localStorage.getItem('mantovani_token') : null;

  try {
    res = await fetch(buildUrl(path, query), {
      method,
      signal,
      cache,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token && !headers.Authorization ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(0, { code: 'ABORTED', message: 'Requisição cancelada.' });
    }
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
    });
  }

  let json: unknown = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) throw new ApiError(res.status, parseErrorBody(json, res.status));

  if (isRecord(json) && 'data' in json) return json.data as T;
  throw new ApiError(res.status, { code: 'BAD_RESPONSE', message: 'Resposta inesperada do servidor.' });
}
