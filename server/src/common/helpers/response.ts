import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: Record<string, any>
): Response => {
  const responsePayload: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };
  return res.status(statusCode).json(responsePayload);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errorCode = 'INTERNAL_SERVER_ERROR',
  details?: any
): Response => {
  const responsePayload: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details,
    },
  };
  return res.status(statusCode).json(responsePayload);
};
