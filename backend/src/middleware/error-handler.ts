import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { AppError, PG_ERRORS, pgErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: details[0]?.message ?? 'Dados de entrada inválidos.',
        details,
      },
    });
    return;
  }

  const pgCode = pgErrorCode(err);
  if (pgCode === PG_ERRORS.INVALID_TEXT_REPRESENTATION) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Identificador ou formato de parâmetro inválido.',
      },
    });
    return;
  }

  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error in request');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Erro interno do servidor. Tente novamente em instantes.'
        : err instanceof Error
          ? err.message
          : 'Erro inesperado',
    },
  });
}
