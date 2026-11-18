/**
 * Domain error hierarchy. Every error that crosses the HTTP boundary is turned
 * into the structured envelope `{ error: { code, message, details } }` by the
 * error-handler middleware.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CNPJ'
  | 'NOT_FOUND'
  | 'CLIENT_BLOCKED'
  | 'INSUFFICIENT_AVAILABILITY'
  | 'INVALID_STATE_TRANSITION'
  | 'UNAUTHORIZED'
  | 'UPSTREAM_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ValidationIssue[]) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class InvalidCnpjError extends AppError {
  constructor(message = 'CNPJ inválido.') {
    super('INVALID_CNPJ', message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} não encontrado(a).`, 404);
  }
}

export class ClientBlockedError extends AppError {
  constructor() {
    super('CLIENT_BLOCKED', 'Cadastro bloqueado para novas locações. Fale com nosso financeiro.', 403);
  }
}

export interface AvailabilityShortfall {
  categoryId: string;
  categoryName: string;
  requested: number;
  available: number;
}

export class InsufficientAvailabilityError extends AppError {
  constructor(public readonly shortfalls: AvailabilityShortfall[]) {
    const summary = shortfalls
      .map((s) => `${s.categoryName}: ${s.available} disponível(is) de ${s.requested} solicitado(s)`)
      .join('; ');
    super('INSUFFICIENT_AVAILABILITY', `Disponibilidade insuficiente para o período. ${summary}`, 409, shortfalls);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `${entity} não pode passar de ${from} para ${to}.`, 409, { from, to });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado.') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class UpstreamError extends AppError {
  constructor(service: string, cause?: unknown) {
    super('UPSTREAM_ERROR', `Falha ao comunicar com ${service}. Tente novamente em instantes.`, 502);
    if (cause !== undefined) this.cause = cause;
  }
}

/** Postgres error codes we react to explicitly. */
export const PG_ERRORS = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  INVALID_TEXT_REPRESENTATION: '22P02',
} as const;

export function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
