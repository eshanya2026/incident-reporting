import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/appError.js';
import { sendError } from '../common/helpers/response.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  logger.error({
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation error', 422, 'VALIDATION_ERROR', details);
    return;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    sendError(res, 'Invalid or expired token', 401, 'UNAUTHORIZED');
    return;
  }

  if (err.name === 'CastError') {
    sendError(res, 'Invalid resource identifier format', 400, 'BAD_REQUEST');
    return;
  }

  // Fallback for unhandled unexpected internal errors
  const message = env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred';
  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
};
