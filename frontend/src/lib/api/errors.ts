import type {
  ApiErrorBody,
  ApiErrorDetail,
  InsufficientAvailabilityDetail,
  ValidationErrorDetail,
} from '@/lib/types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetail[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = Array.isArray(body.details) ? body.details : [];
  }

  get isAborted(): boolean {
    return this.code === 'ABORTED';
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  /** Validation details keyed by path (e.g. "client.cnpj"). */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) {
      if (isValidationDetail(d) && !(d.path in out)) out[d.path] = d.message;
    }
    return out;
  }

  insufficientAvailability(): InsufficientAvailabilityDetail[] {
    if (this.code !== 'INSUFFICIENT_AVAILABILITY') return [];
    return this.details.filter(isInsufficientDetail);
  }
}

export function isValidationDetail(d: ApiErrorDetail): d is ValidationErrorDetail {
  return typeof (d as ValidationErrorDetail).path === 'string' && typeof (d as ValidationErrorDetail).message === 'string';
}

export function isInsufficientDetail(d: ApiErrorDetail): d is InsufficientAvailabilityDetail {
  const x = d as InsufficientAvailabilityDetail;
  return typeof x.categoryId === 'string' && typeof x.requested === 'number' && typeof x.available === 'number';
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Friendly pt-BR message for any thrown value. */
export function errorMessage(e: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
